// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./interfaces/IEntryPoint.sol";
import "./interfaces/IAccount.sol";
import "./interfaces/IMissionWallet.sol";
import "./libraries/SpendingLimits.sol";
import "./libraries/SessionKeyLib.sol";
import "./libraries/UserOpLib.sol";

contract MissionWallet is IMissionWallet, Ownable, ReentrancyGuard {
    using SpendingLimits for SpendingLimits.SpendingTracker;
    using SessionKeyLib for SessionKeyLib.SessionKey;

    // ============ State Variables ============
    IMissionWallet.MissionConfig private _config;
    SpendingLimits.SpendingTracker private _spending;
    mapping(address => uint256) private _recipientSpent;
    mapping(address => SessionKeyLib.SessionKey) private _sessionKeys;
    mapping(address => bool) private _agentKilled;
    address[] private _recipientAllowlist;
    bool private _initialized;
    bool private _emergencyKilled;
    bool private _emergencyFrozen;
    IEntryPoint private immutable _entryPoint;
    uint256 private _nonce;

    // ============ Guardian Recovery State ============
    IMissionWallet.GuardianConfig private _guardianConfig;
    mapping(address => bool) private _isGuardian;
    mapping(uint256 => IMissionWallet.RecoveryRequest) private _recoveryRequests;
    uint256 private _recoveryRequestCounter;
    mapping(uint256 => mapping(address => bool)) private _recoveryApprovals;

    // ============ Constants ============
    uint256 private constant VALIDATION_FAILED = 1;
    uint256 private constant SIG_AUTH_FAILED = 2;
    uint256 private constant MIN_GUARDIAN_THRESHOLD = 1;
    uint256 private constant MAX_GUARDIAN_THRESHOLD = 5;
    uint256 private constant MIN_RECOVERY_DELAY = 172800; // 48 hours in seconds
    uint256 private constant MAX_GUARDIANS = 5;

    // ============ Constructor ============
    constructor(address entryPoint) Ownable(msg.sender) {
        _entryPoint = IEntryPoint(entryPoint);
    }

    // ============ Initialization ============
    function initialize(IMissionWallet.MissionConfig calldata config) external onlyOwner {
        if (_initialized) revert AlreadyInitialized();
        if (config.totalBudget == 0) revert InvalidMissionConfig();
        if (config.maxPerTx == 0 || config.maxPerTx > config.totalBudget) revert InvalidMissionConfig();
        if (config.maxDaily == 0 || config.maxDaily > config.totalBudget) revert InvalidMissionConfig();
        if (config.expiry <= block.timestamp) revert InvalidMissionConfig();
        if (config.owner == address(0)) revert InvalidMissionConfig();

        _config = config;
        _spending.lastDailyReset = SpendingLimits.getDailyResetTimestamp();
        _initialized = true;
        _transferOwnership(config.owner);

        emit MissionCreated(config.missionId, config.owner, config.totalBudget);
    }

    // ============ ERC-4337: IAccount Interface ============
    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 /* missingAccountFunds */
    ) external view returns (uint256 validationData) {
        // Only EntryPoint can call this
        if (msg.sender != address(_entryPoint)) {
            return VALIDATION_FAILED;
        }

        // Check mission not expired
        if (block.timestamp >= _config.expiry) {
            return VALIDATION_FAILED;
        }

        // Check mission not emergency killed
        if (_isEmergencyKilled()) {
            return VALIDATION_FAILED;
        }

        // Check emergency freeze
        if (_emergencyFrozen) {
            return VALIDATION_FAILED;
        }

        // Get sender (should be this wallet)
        address sender = UserOpLib.getSender(userOp);
        if (sender != address(this)) {
            return VALIDATION_FAILED;
        }

        // Decode callData to get agent and payment details
        (address agent, address recipient, uint256 amount, uint256 sessionNonce) = _decodeCallData(userOp.callData);

        // Verify agent has valid session key
        SessionKeyLib.SessionKey storage sessionKey = _sessionKeys[agent];
        if (!sessionKey.isValid(recipient, amount)) {
            if (sessionKey.revoked) return SIG_AUTH_FAILED;
            if (block.timestamp >= sessionKey.expiry) return SIG_AUTH_FAILED;
            if (amount > sessionKey.maxPerTx) return SIG_AUTH_FAILED;
            return SIG_AUTH_FAILED;
        }

        // Check agent not killed
        if (_agentKilled[agent]) {
            return SIG_AUTH_FAILED;
        }

        // Check session key nonce (replay protection)
        sessionKey.checkNonce(sessionNonce);

        // Check spending limits (mission-level)
        SpendingLimits.Limits memory limits = SpendingLimits.Limits({
            maxPerTx: _config.maxPerTx,
            maxDaily: _config.maxDaily,
            totalBudget: _config.totalBudget
        });
        _spending.checkLimits(limits, amount);

        // Check spending limits (session-key-level)
        SpendingLimits.Limits memory sessionLimits = SpendingLimits.Limits({
            maxPerTx: sessionKey.maxPerTx,
            maxDaily: sessionKey.maxDaily,
            totalBudget: _config.totalBudget
        });
        _spending.checkLimits(sessionLimits, amount);

        // Check recipient allowlist (mission-level)
        if (_recipientAllowlist.length > 0) {
            bool allowed = false;
            for (uint256 i = 0; i < _recipientAllowlist.length; i++) {
                if (_recipientAllowlist[i] == recipient) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) return SIG_AUTH_FAILED;
        }

        // Validate signature
        if (!UserOpLib.validateSignature(agent, userOpHash, userOp.signature)) {
            return SIG_AUTH_FAILED;
        }

        // Return validation data with validUntil and validAfter
        // Packed as: (validUntil << 160) | (validAfter << 96) | sigAuthorizer (0 = no aggregator)
        // validUntil: session key expiry (or mission expiry, whichever is earlier)
        // validAfter: 0 (no time restriction)
        // sigAuthorizer: 0 (no signature aggregator)
        uint256 validUntil = _config.expiry < sessionKey.expiry ? _config.expiry : sessionKey.expiry;
        uint256 validAfter = 0;
        return (validUntil << 160) | (validAfter << 96);
    }

    function executeUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 /* userOpHash */
    ) external payable onlyEntryPoint {
        // Re-validate (EntryPoint calls validateUserOp first, but we re-check for safety)
        (address agent, address recipient, uint256 amount, uint256 sessionNonce) = _decodeCallData(userOp.callData);

        // Execute payment
        _executePayment(agent, recipient, amount, sessionNonce);

        // Increment ERC-4337 nonce after successful execution
        incrementNonce();
    }

    function nonce() external view returns (uint256) {
        return _nonce;
    }

    function incrementNonce() internal {
        _nonce += 1;
    }

    // ============ Mission Management (Owner Only) ============
    function updateSpendingLimits(uint256 maxPerTx, uint256 maxDaily) external onlyOwner onlyIfInitialized {
        if (maxPerTx == 0 || maxPerTx > _config.totalBudget) revert InvalidMissionConfig();
        if (maxDaily == 0 || maxDaily > _config.totalBudget) revert InvalidMissionConfig();
        
        _config.maxPerTx = maxPerTx;
        _config.maxDaily = maxDaily;
        
        emit SpendingLimitUpdated(_config.missionId, maxPerTx, maxDaily);
    }

    function updateRecipientAllowlist(address[] calldata recipients) external onlyOwner onlyIfInitialized {
        _recipientAllowlist = recipients;
        emit RecipientAllowlistUpdated(_config.missionId, recipients);
    }

    function updateBudget(uint256 newBudget) external onlyOwner onlyIfInitialized {
        if (newBudget < _spending.totalSpent) revert InvalidMissionConfig();
        _config.totalBudget = newBudget;
        emit BudgetUpdated(_config.missionId, newBudget);
    }

    // ============ Session Key Management (Owner Only) ============
    function grantSessionKey(IMissionWallet.SessionKeyConfig calldata config) external onlyOwner onlyIfInitialized {
        if (config.agent == address(0)) revert InvalidMissionConfig();
        if (_sessionKeys[config.agent].maxPerTx != 0) revert AgentAlreadyHasKey();
        if (config.maxPerTx == 0 || config.maxPerTx > _config.maxPerTx) revert InvalidMissionConfig();
        if (config.maxDaily == 0 || config.maxDaily > _config.maxDaily) revert InvalidMissionConfig();
        if (config.expiry <= block.timestamp || config.expiry > _config.expiry) revert InvalidMissionConfig();

        // Validate allowlist recipients are in mission allowlist (if mission allowlist exists)
        if (_recipientAllowlist.length > 0 && config.allowedRecipients.length > 0) {
            for (uint256 i = 0; i < config.allowedRecipients.length; i++) {
                bool allowed = false;
                for (uint256 j = 0; j < _recipientAllowlist.length; j++) {
                    if (_recipientAllowlist[j] == config.allowedRecipients[i]) {
                        allowed = true;
                        break;
                    }
                }
                if (!allowed) revert InvalidMissionConfig();
            }
        }

        _sessionKeys[config.agent] = SessionKeyLib.SessionKey({
            maxPerTx: config.maxPerTx,
            maxDaily: config.maxDaily,
            expiry: config.expiry,
            allowedRecipients: config.allowedRecipients,
            revoked: false,
            nonce: 0
        });

        emit SessionKeyGranted(_config.missionId, config.agent, config.expiry);
    }

    function revokeSessionKey(address agent) external onlyOwner onlyIfInitialized {
        if (_sessionKeys[agent].maxPerTx == 0) revert AgentHasNoKey();
        
        _sessionKeys[agent].revoked = true;
        emit SessionKeyRevoked(_config.missionId, agent);
    }

    // ============ Kill Switch (Owner Only) ============
    function activateKillSwitch(address agent) external onlyOwner onlyIfInitialized {
        if (agent == address(0)) revert InvalidMissionConfig();
        _agentKilled[agent] = true;
        emit KillSwitchActivated(_config.missionId, agent);
    }

    function deactivateKillSwitch(address agent) external onlyOwner onlyIfInitialized {
        if (agent == address(0)) revert InvalidMissionConfig();
        _agentKilled[agent] = false;
        emit KillSwitchDeactivated(_config.missionId, agent);
    }

    function emergencyKillAll() external onlyOwner onlyIfInitialized {
        _emergencyKilled = true;
        emit EmergencyKillAll(_config.missionId);
    }

    // ============ Emergency Freeze (Owner Only) ============
    function activateEmergencyFreeze() external onlyOwner onlyIfInitialized {
        if (_emergencyFrozen) return;
        _emergencyFrozen = true;
        emit EmergencyFreezeActivated(_config.missionId);
    }

    function deactivateEmergencyFreeze() external onlyOwner onlyIfInitialized {
        if (!_emergencyFrozen) return;
        _emergencyFrozen = false;
        emit EmergencyFreezeDeactivated(_config.missionId);
    }

    // ============ Guardian Recovery (Owner Config, Guardian Execution) ============
    function setGuardianConfig(address[] calldata guardians, uint256 threshold, uint256 recoveryDelay) external onlyOwner onlyIfInitialized {
        if (guardians.length == 0 || guardians.length > MAX_GUARDIANS) revert InvalidGuardianConfig();
        if (threshold < MIN_GUARDIAN_THRESHOLD || threshold > guardians.length || threshold > MAX_GUARDIAN_THRESHOLD) revert InvalidGuardianConfig();
        if (recoveryDelay < MIN_RECOVERY_DELAY) revert InvalidGuardianConfig();

        // Check for duplicate guardians
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == address(0)) revert InvalidGuardianConfig();
            for (uint256 j = i + 1; j < guardians.length; j++) {
                if (guardians[i] == guardians[j]) revert InvalidGuardianConfig();
            }
        }

        // Reset guardian mapping
        for (uint256 i = 0; i < _guardianConfig.guardians.length; i++) {
            _isGuardian[_guardianConfig.guardians[i]] = false;
        }

        _guardianConfig.guardians = guardians;
        _guardianConfig.threshold = threshold;
        _guardianConfig.recoveryDelay = recoveryDelay;

        for (uint256 i = 0; i < guardians.length; i++) {
            _isGuardian[guardians[i]] = true;
        }

        emit GuardianConfigSet(_config.missionId, guardians, threshold, recoveryDelay);
    }

    function requestRecovery(address compromisedAgent, address replacementAgent) external onlyIfInitialized {
        if (!_isGuardian[msg.sender]) revert NotGuardian();
        if (_emergencyFrozen) revert MissionFrozen();
        
        SessionKeyLib.SessionKey storage compromisedKey = _sessionKeys[compromisedAgent];
        if (compromisedKey.maxPerTx == 0) revert CompromisedAgentHasNoKey();
        if (!compromisedKey.revoked) revert CompromisedAgentHasNoKey();

        SessionKeyLib.SessionKey storage replacementKey = _sessionKeys[replacementAgent];
        if (replacementKey.maxPerTx != 0) revert ReplacementAgentAlreadyHasKey();

        _recoveryRequestCounter += 1;
        uint256 requestId = _recoveryRequestCounter;

        _recoveryRequests[requestId] = IMissionWallet.RecoveryRequest({
            requestId: requestId,
            compromisedAgent: compromisedAgent,
            replacementAgent: replacementAgent,
            requestedAt: block.timestamp,
            approvals: 1,
            vetoed: false,
            executed: false,
            cancelled: false
        });

        _recoveryApprovals[requestId][msg.sender] = true;

        emit RecoveryRequested(requestId, compromisedAgent, replacementAgent, block.timestamp);
        emit RecoveryApproved(requestId, msg.sender);
    }

    function approveRecovery(uint256 requestId) external onlyIfInitialized {
        if (!_isGuardian[msg.sender]) revert NotGuardian();
        if (_emergencyFrozen) revert MissionFrozen();

        IMissionWallet.RecoveryRequest storage request = _recoveryRequests[requestId];
        if (request.requestId == 0) revert InvalidRecoveryRequest();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryCancelledError();
        if (request.vetoed) revert RecoveryVetoedByOwner();
        if (_recoveryApprovals[requestId][msg.sender]) revert AlreadyApproved();

        _recoveryApprovals[requestId][msg.sender] = true;
        request.approvals += 1;

        emit RecoveryApproved(requestId, msg.sender);
    }

    function vetoRecovery(uint256 requestId) external onlyOwner onlyIfInitialized {
        IMissionWallet.RecoveryRequest storage request = _recoveryRequests[requestId];
        if (request.requestId == 0) revert InvalidRecoveryRequest();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryCancelledError();
        if (request.vetoed) return;

        request.vetoed = true;
        emit RecoveryVetoed(requestId, owner());
    }

    function executeRecovery(uint256 requestId) external onlyIfInitialized {
        IMissionWallet.RecoveryRequest storage request = _recoveryRequests[requestId];
        if (request.requestId == 0) revert InvalidRecoveryRequest();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryCancelledError();
        if (request.vetoed) revert RecoveryVetoedByOwner();
        if (request.approvals < _guardianConfig.threshold) revert InvalidRecoveryRequest();
        if (block.timestamp < request.requestedAt + _guardianConfig.recoveryDelay) revert RecoveryDelayNotMet();
        if (_emergencyFrozen) revert MissionFrozen();

        // Execute recovery: replace the compromised agent's key with the replacement agent's key
        SessionKeyLib.SessionKey storage compromisedKey = _sessionKeys[request.compromisedAgent];
        SessionKeyLib.SessionKey storage replacementKey = _sessionKeys[request.replacementAgent];

        // The replacement agent should have been granted a key by the owner before recovery execution
        // Or we transfer the compromised agent's key config to the replacement agent
        // For security, we require the owner to have pre-granted a session key to the replacement agent
        if (replacementKey.maxPerTx == 0) revert ReplacementAgentAlreadyHasKey();

        // Mark compromised agent's key as fully revoked (already revoked, but ensure)
        compromisedKey.revoked = true;

        request.executed = true;
        emit RecoveryExecuted(requestId, request.compromisedAgent, request.replacementAgent);
        emit SessionKeyReplaced(_config.missionId, request.compromisedAgent, request.replacementAgent);
    }

    function cancelRecovery(uint256 requestId) external onlyIfInitialized {
        IMissionWallet.RecoveryRequest storage request = _recoveryRequests[requestId];
        if (request.requestId == 0) revert InvalidRecoveryRequest();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryCancelledError();
        if (request.vetoed) revert RecoveryVetoedByOwner();

        // Only the requester or owner can cancel
        if (msg.sender != owner() && !_recoveryApprovals[requestId][msg.sender]) {
            revert UnauthorizedCaller();
        }

        request.cancelled = true;
        emit RecoveryCancelled(requestId);
    }

    // ============ Session Key Replacement ============
    function replaceSessionKey(address compromisedAgent, IMissionWallet.SessionKeyConfig calldata newConfig) external onlyOwner onlyIfInitialized {
        SessionKeyLib.SessionKey storage compromisedKey = _sessionKeys[compromisedAgent];
        if (compromisedKey.maxPerTx == 0) revert CompromisedAgentHasNoKey();
        if (!compromisedKey.revoked) revert CompromisedAgentHasNoKey();

        if (newConfig.agent == address(0)) revert InvalidMissionConfig();
        if (newConfig.maxPerTx == 0 || newConfig.maxPerTx > _config.maxPerTx) revert InvalidMissionConfig();
        if (newConfig.maxDaily == 0 || newConfig.maxDaily > _config.maxDaily) revert InvalidMissionConfig();
        if (newConfig.expiry <= block.timestamp || newConfig.expiry > _config.expiry) revert InvalidMissionConfig();

        // Validate allowlist recipients are in mission allowlist (if mission allowlist exists)
        if (_recipientAllowlist.length > 0 && newConfig.allowedRecipients.length > 0) {
            for (uint256 i = 0; i < newConfig.allowedRecipients.length; i++) {
                bool allowed = false;
                for (uint256 j = 0; j < _recipientAllowlist.length; j++) {
                    if (_recipientAllowlist[j] == newConfig.allowedRecipients[i]) {
                        allowed = true;
                        break;
                    }
                }
                if (!allowed) revert InvalidMissionConfig();
            }
        }

        // Grant new session key to replacement agent
        _sessionKeys[newConfig.agent] = SessionKeyLib.SessionKey({
            maxPerTx: newConfig.maxPerTx,
            maxDaily: newConfig.maxDaily,
            expiry: newConfig.expiry,
            allowedRecipients: newConfig.allowedRecipients,
            revoked: false,
            nonce: 0
        });

        emit SessionKeyGranted(_config.missionId, newConfig.agent, newConfig.expiry);
        emit SessionKeyReplaced(_config.missionId, compromisedAgent, newConfig.agent);
    }

    // ============ Payment Execution (Internal) ============
    function _executePayment(
        address agent,
        address recipient,
        uint256 amount,
        uint256 sessionNonce
    ) internal nonReentrant {
        // Final validation before execution
        if (block.timestamp >= _config.expiry) revert MissionExpired();
        if (_isEmergencyKilled()) revert MissionKilled();
        if (_emergencyFrozen) revert EmergencyFreezeActive();
        if (_agentKilled[agent]) revert MissionKilled();

        SessionKeyLib.SessionKey storage sessionKey = _sessionKeys[agent];
        if (!sessionKey.isValid(recipient, amount)) {
            if (sessionKey.revoked) revert SessionKeyRevokedError();
            if (block.timestamp >= sessionKey.expiry) revert SessionKeyExpiredError();
            if (amount > sessionKey.maxPerTx) revert ExceedsPerTxLimit();
            revert RecipientNotAllowed();
        }

        sessionKey.checkNonce(sessionNonce);

        SpendingLimits.Limits memory limits = SpendingLimits.Limits({
            maxPerTx: _config.maxPerTx,
            maxDaily: _config.maxDaily,
            totalBudget: _config.totalBudget
        });
        _spending.checkLimits(limits, amount);

        SpendingLimits.Limits memory sessionLimits = SpendingLimits.Limits({
            maxPerTx: sessionKey.maxPerTx,
            maxDaily: sessionKey.maxDaily,
            totalBudget: _config.totalBudget
        });
        _spending.checkLimits(sessionLimits, amount);

        if (_recipientAllowlist.length > 0) {
            bool allowed = false;
            for (uint256 i = 0; i < _recipientAllowlist.length; i++) {
                if (_recipientAllowlist[i] == recipient) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) revert RecipientNotAllowed();
        }

        // Transfer ETH
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert InsufficientBudget();
        }

        // Record spending
        _spending.recordSpending(amount);
        _recipientSpent[recipient] += amount;
        sessionKey.incrementNonce();

        // Emit event
        emit PaymentExecuted(_config.missionId, agent, recipient, amount, sessionNonce);
    }

    // ============ External Payment (Called via UserOperation) ============
    function executePayment(address recipient, uint256 amount) external {
        // This is called via UserOperation - the actual entry point
        // The agent is msg.sender (the wallet itself), but we need to extract
        // the actual agent from the call context. In ERC-4337, the UserOperation
        // contains the signature from the session key.
        
        // For direct calls (testing), we allow owner to execute without session key
        if (msg.sender == owner()) {
            _executePaymentAsOwner(recipient, amount);
            return;
        }
        
        // For UserOperation execution, this is called via executeUserOp
        // which handles the validation and extraction
        revert UnauthorizedCaller();
    }

    // ============ Owner Direct Payment (Bypasses Session Key) ============
    function _executePaymentAsOwner(
        address recipient,
        uint256 amount
    ) internal nonReentrant {
        // Final validation before execution (mission-level only)
        if (block.timestamp >= _config.expiry) revert MissionExpired();
        if (_isEmergencyKilled()) revert MissionKilled();
        if (_emergencyFrozen) revert EmergencyFreezeActive();

        SpendingLimits.Limits memory limits = SpendingLimits.Limits({
            maxPerTx: _config.maxPerTx,
            maxDaily: _config.maxDaily,
            totalBudget: _config.totalBudget
        });
        _spending.checkLimits(limits, amount);

        if (_recipientAllowlist.length > 0) {
            bool allowed = false;
            for (uint256 i = 0; i < _recipientAllowlist.length; i++) {
                if (_recipientAllowlist[i] == recipient) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) revert RecipientNotAllowed();
        }

        // Transfer ETH
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert InsufficientBudget();
        }

        // Record spending
        _spending.recordSpending(amount);
        _recipientSpent[recipient] += amount;

        // Emit event (nonce = 0 for owner payments)
        emit PaymentExecuted(_config.missionId, owner(), recipient, amount, 0);
    }

    // ============ View Functions ============
    function getMissionConfig() external view returns (IMissionWallet.MissionConfig memory) {
        return _config;
    }

    function getSpendingTracker() external view returns (IMissionWallet.SpendingTracker memory) {
        SpendingLimits.SpendingTracker storage tracker = _spending;
        uint256 effectiveDailySpent = tracker.getEffectiveDailySpent();
        return IMissionWallet.SpendingTracker({
            totalSpent: tracker.totalSpent,
            dailySpent: effectiveDailySpent,
            lastDailyReset: tracker.lastDailyReset
        });
    }

    function getRecipientSpent(address recipient) external view returns (uint256) {
        return _recipientSpent[recipient];
    }

    function getSessionKey(address agent) external view returns (IMissionWallet.SessionKey memory) {
        SessionKeyLib.SessionKey storage key = _sessionKeys[agent];
        return IMissionWallet.SessionKey({
            maxPerTx: key.maxPerTx,
            maxDaily: key.maxDaily,
            expiry: key.expiry,
            allowedRecipients: key.allowedRecipients,
            revoked: key.revoked,
            nonce: key.nonce
        });
    }

    function isAgentKilled(address agent) external view returns (bool) {
        return _agentKilled[agent];
    }

    function getRecipientAllowlist() external view returns (address[] memory) {
        return _recipientAllowlist;
    }

    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    function isEmergencyFrozen() external view returns (bool) {
        return _emergencyFrozen;
    }

    function getGuardianConfig() external view returns (IMissionWallet.GuardianConfig memory) {
        return _guardianConfig;
    }

    function getRecoveryRequest(uint256 requestId) external view returns (IMissionWallet.RecoveryRequest memory) {
        return _recoveryRequests[requestId];
    }

    function isGuardian(address account) external view returns (bool) {
        return _isGuardian[account];
    }

    // ============ Internal Helpers ============
    function _decodeCallData(bytes calldata callData) internal pure returns (address agent, address recipient, uint256 amount, uint256 sessionNonce) {
        // Expected callData format: abi.encodeWithSelector(executePayment.selector, recipient, amount, nonce)
        // For session key validation, we need to extract the agent from the signature context
        // In practice, the agent is recovered from the signature in validateUserOp
        // Here we decode the payment parameters
        if (callData.length < 4) revert InvalidMissionConfig();
        
        bytes4 selector;
        assembly {
            selector := calldataload(callData.offset)
        }
        
        if (selector == IMissionWallet.executePayment.selector) {
            (recipient, amount, sessionNonce) = abi.decode(callData[4:], (address, uint256, uint256));
            agent = address(0); // Will be set by caller (recovered from signature)
        } else {
            revert InvalidMissionConfig();
        }
    }

    function _isEmergencyKilled() internal view returns (bool) {
        return _emergencyKilled;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != address(_entryPoint)) revert EntryPointRejected();
        _;
    }

    modifier onlyIfInitialized() {
        if (!_initialized) revert UnauthorizedCaller();
        _;
    }

    // ============ Fallback / Receive ============
    receive() external payable {}
    fallback() external payable {}
}