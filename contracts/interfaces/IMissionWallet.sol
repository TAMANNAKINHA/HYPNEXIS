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

    // ============ Mission Management (Owner Only) ============
    function initialize(MissionConfig calldata config) external;
    function updateSpendingLimits(uint256 maxPerTx, uint256 maxDaily) external;
    function updateRecipientAllowlist(address[] calldata recipients) external;
    function updateBudget(uint256 newBudget) external;

    // ============ Session Key Management (Owner Only) ============
    function grantSessionKey(SessionKeyConfig calldata config) external;
    function revokeSessionKey(address agent) external;

    // ============ Kill Switch (Owner Only) ============
    function activateKillSwitch(address agent) external;
    function deactivateKillSwitch(address agent) external;
    function emergencyKillAll() external;

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
}