// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IEntryPoint.sol";
import "./IAccount.sol";

interface IMissionWallet is IAccount {
    // ============ Mission Configuration ============
    struct MissionConfig {
        string missionId;
        uint256 totalBudget;
        uint256 maxPerTx;
        uint256 maxDaily;
        uint256 expiry;
        address owner;
    }

    struct SpendingTracker {
        uint256 totalSpent;
        uint256 dailySpent;
        uint256 lastDailyReset;
    }

    struct SessionKeyConfig {
        address agent;
        uint256 maxPerTx;
        uint256 maxDaily;
        uint256 expiry;
        address[] allowedRecipients;
    }

    struct SessionKey {
        uint256 maxPerTx;
        uint256 maxDaily;
        uint256 expiry;
        address[] allowedRecipients;
        bool revoked;
        uint256 nonce;
    }

    // ============ Emergency Freeze & Guardian Recovery ============
    struct GuardianConfig {
        address[] guardians;
        uint256 threshold;
        uint256 recoveryDelay;
    }

    struct RecoveryRequest {
        uint256 requestId;
        address compromisedAgent;
        address replacementAgent;
        uint256 requestedAt;
        uint256 approvals;
        bool vetoed;
        bool executed;
        bool cancelled;
    }

    // ============ Events ============
    event MissionCreated(string indexed missionId, address indexed owner, uint256 budget);
    event PaymentExecuted(string indexed missionId, address indexed agent, address indexed recipient, uint256 amount, uint256 nonce);
    event SessionKeyGranted(string indexed missionId, address indexed agent, uint256 expiry);
    event SessionKeyRevoked(string indexed missionId, address indexed agent);
    event SessionKeyExpired(string indexed missionId, address indexed agent);
    event KillSwitchActivated(string indexed missionId, address indexed agent);
    event KillSwitchDeactivated(string indexed missionId, address indexed agent);
    event EmergencyKillAll(string indexed missionId);
    event SpendingLimitUpdated(string indexed missionId, uint256 maxPerTx, uint256 maxDaily);
    event RecipientAllowlistUpdated(string indexed missionId, address[] recipients);
    event BudgetUpdated(string indexed missionId, uint256 newBudget);
    event EmergencyFreezeActivated(string indexed missionId);
    event EmergencyFreezeDeactivated(string indexed missionId);
    event GuardianConfigSet(string indexed missionId, address[] guardians, uint256 threshold, uint256 recoveryDelay);
    event RecoveryRequested(uint256 indexed requestId, address indexed compromisedAgent, address indexed replacementAgent, uint256 requestedAt);
    event RecoveryApproved(uint256 indexed requestId, address indexed guardian);
    event RecoveryVetoed(uint256 indexed requestId, address indexed owner);
    event RecoveryExecuted(uint256 indexed requestId, address indexed compromisedAgent, address indexed replacementAgent);
    event RecoveryCancelled(uint256 indexed requestId);
    event SessionKeyReplaced(string indexed missionId, address indexed oldAgent, address indexed newAgent);

    // ============ Errors ============
    error UnauthorizedCaller();
    error MissionExpired();
    error MissionKilled();
    error InsufficientBudget();
    error ExceedsPerTxLimit();
    error ExceedsDailyLimit();
    error RecipientNotAllowed();
    error SessionKeyRevokedError();
    error SessionKeyExpiredError();
    error InvalidNonce();
    error AgentNotAuthorized();
    error InvalidSignature();
    error EntryPointRejected();
    error AlreadyInitialized();
    error InvalidMissionConfig();
    error AgentAlreadyHasKey();
    error AgentHasNoKey();
    error EmergencyFreezeActive();
    error InvalidGuardianConfig();
    error NotGuardian();
    error AlreadyApproved();
    error RecoveryDelayNotMet();
    error RecoveryVetoedByOwner();
    error RecoveryAlreadyExecuted();
    error RecoveryCancelledError();
    error InvalidRecoveryRequest();
    error CompromisedAgentHasNoKey();
    error ReplacementAgentAlreadyHasKey();
    error MissionFrozen();

    // ============ Mission Management (Owner Only) ============
    function initialize(MissionConfig calldata config) external;
    function updateSpendingLimits(uint256 maxPerTx, uint256 maxDaily) external;
    function updateRecipientAllowlist(address[] calldata recipients) external;
    function updateBudget(uint256 newBudget) external;

    // ============ Session Key Management (Owner Only) ============
    function grantSessionKey(SessionKeyConfig calldata config) external;
    function revokeSessionKey(address agent) external;
    function replaceSessionKey(address compromisedAgent, SessionKeyConfig calldata newConfig) external;

    // ============ Kill Switch (Owner Only) ============
    function activateKillSwitch(address agent) external;
    function deactivateKillSwitch(address agent) external;
    function emergencyKillAll() external;

    // ============ Emergency Freeze (Owner Only) ============
    function activateEmergencyFreeze() external;
    function deactivateEmergencyFreeze() external;

    // ============ Guardian Recovery (Owner Config, Guardian Execution) ============
    function setGuardianConfig(address[] calldata guardians, uint256 threshold, uint256 recoveryDelay) external;
    function requestRecovery(address compromisedAgent, address replacementAgent) external;
    function approveRecovery(uint256 requestId) external;
    function vetoRecovery(uint256 requestId) external;
    function executeRecovery(uint256 requestId) external;
    function cancelRecovery(uint256 requestId) external;

    // ============ Payment Execution (Via UserOperation) ============
    function executePayment(address recipient, uint256 amount) external;

    // ============ View Functions ============
    function getMissionConfig() external view returns (MissionConfig memory);
    function getSpendingTracker() external view returns (SpendingTracker memory);
    function getSessionKey(address agent) external view returns (SessionKey memory);
    function isAgentKilled(address agent) external view returns (bool);
    function getRecipientAllowlist() external view returns (address[] memory);
    function isInitialized() external view returns (bool);
    function getRecipientSpent(address recipient) external view returns (uint256);
    function isEmergencyFrozen() external view returns (bool);
    function getGuardianConfig() external view returns (GuardianConfig memory);
    function getRecoveryRequest(uint256 requestId) external view returns (RecoveryRequest memory);
    function isGuardian(address account) external view returns (bool);
}