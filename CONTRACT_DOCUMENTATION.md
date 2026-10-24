# MissionWallet Smart Contract Documentation

## Overview

MissionWallet is an ERC-4337 compatible smart contract wallet designed for autonomous AI agents operating within defined mission budgets. It enforces spending limits, session key permissions, and provides emergency controls.

**Contract Address**: Deployed per mission
**Solidity Version**: ^0.8.20
**License**: MIT

---

## Architecture

```
MissionWallet
├── Ownable (OpenZeppelin) - Ownership management
├── ReentrancyGuard (OpenZeppelin) - Reentrancy protection
├── SpendingLimits (Library) - Budget enforcement
├── SessionKeyLib (Library) - Session key management
├── UserOpLib (Library) - ERC-4337 UserOperation handling
└── IMissionWallet (Interface) - External interface
```

---

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `_config` | `MissionConfig` | Mission configuration (budget, limits, expiry) |
| `_spending` | `SpendingTracker` | Tracks total/daily spending with UTC reset |
| `_recipientSpent` | `mapping(address => uint256)` | Per-recipient spending tracking |
| `_sessionKeys` | `mapping(address => SessionKey)` | Agent session key configurations |
| `_agentKilled` | `mapping(address => bool)` | Per-agent kill switch status |
| `_recipientAllowlist` | `address[]` | Mission-level recipient allowlist |
| `_initialized` | `bool` | Initialization flag |
| `_emergencyKilled` | `bool` | Global emergency kill flag |
| `_entryPoint` | `IEntryPoint` | Immutable ERC-4337 EntryPoint reference |
| `_nonce` | `uint256` | ERC-4337 sequential nonce |

---

## Data Structures

### MissionConfig
```solidity
struct MissionConfig {
    string missionId;       // Unique mission identifier
    uint256 totalBudget;    // Total mission budget (wei)
    uint256 maxPerTx;       // Max per-transaction limit (wei)
    uint256 maxDaily;       // Max daily spending limit (wei)
    uint256 expiry;         // Mission expiry timestamp (UTC)
    address owner;          // Mission owner (wallet owner after init)
}
```

### SpendingTracker
```solidity
struct SpendingTracker {
    uint256 totalSpent;      // Cumulative spending
    uint256 dailySpent;      // Spending since last UTC reset
    uint256 lastDailyReset;  // Timestamp of last daily reset
}
```

### SessionKeyConfig
```solidity
struct SessionKeyConfig {
    address agent;              // Agent address
    uint256 maxPerTx;           // Agent's max per-transaction
    uint256 maxDaily;           // Agent's max daily spending
    uint256 expiry;             // Session key expiry
    address[] allowedRecipients; // Agent-specific allowlist
}
```

### SessionKey
```solidity
struct SessionKey {
    uint256 maxPerTx;
    uint256 maxDaily;
    uint256 expiry;
    address[] allowedRecipients;
    bool revoked;
    uint256 nonce;              // Replay protection counter
}
```

---

## Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `MissionCreated` | `missionId, owner, budget` | Emitted on initialization |
| `PaymentExecuted` | `missionId, agent, recipient, amount, nonce` | Payment completed |
| `SessionKeyGranted` | `missionId, agent, expiry` | Session key granted |
| `SessionKeyRevoked` | `missionId, agent` | Session key revoked |
| `SessionKeyExpired` | `missionId, agent` | Session key expired (emitted on check) |
| `KillSwitchActivated` | `missionId, agent` | Agent kill switch on |
| `KillSwitchDeactivated` | `missionId, agent` | Agent kill switch off |
| `EmergencyKillAll` | `missionId` | Global emergency kill |
| `SpendingLimitUpdated` | `missionId, maxPerTx, maxDaily` | Mission limits updated |
| `RecipientAllowlistUpdated` | `missionId, recipients[]` | Allowlist updated |
| `BudgetUpdated` | `missionId, newBudget` | Budget changed |

---

## Errors

| Error | Description |
|-------|-------------|
| `UnauthorizedCaller()` | Caller not authorized |
| `MissionExpired()` | Mission past expiry |
| `MissionKilled()` | Emergency kill active |
| `InsufficientBudget()` | Exceeds total budget |
| `ExceedsPerTxLimit()` | Exceeds per-tx limit |
| `ExceedsDailyLimit()` | Exceeds daily limit |
| `RecipientNotAllowed()` | Recipient not in allowlist |
| `SessionKeyRevokedError()` | Session key revoked |
| `SessionKeyExpiredError()` | Session key expired |
| `InvalidNonce()` | Replay attack detected |
| `AgentNotAuthorized()` | Agent not permitted |
| `InvalidSignature()` | Signature verification failed |
| `EntryPointRejected()` | Caller not EntryPoint |
| `AlreadyInitialized()` | Double initialization |
| `InvalidMissionConfig()` | Invalid configuration |
| `AgentAlreadyHasKey()` | Duplicate session key |
| `AgentHasNoKey()` | Session key not found |

---

## External Functions

### Initialization
```solidity
function initialize(MissionConfig calldata config) external onlyOwner
```
**Requirements**: Not initialized, budget > 0, maxPerTx ≤ budget, maxDaily ≤ budget, expiry > now, owner ≠ 0

### Mission Management (Owner Only)
```solidity
function updateSpendingLimits(uint256 maxPerTx, uint256 maxDaily) external onlyOwner onlyIfInitialized
function updateRecipientAllowlist(address[] calldata recipients) external onlyOwner onlyIfInitialized
function updateBudget(uint256 newBudget) external onlyOwner onlyIfInitialized
```

### Session Key Management (Owner Only)
```solidity
function grantSessionKey(SessionKeyConfig calldata config) external onlyOwner onlyIfInitialized
function revokeSessionKey(address agent) external onlyOwner onlyIfInitialized
```

**grantSessionKey Requirements**: agent ≠ 0, no existing key, maxPerTx ≤ mission.maxPerTx, maxDaily ≤ mission.maxDaily, expiry ≤ mission.expiry, agent allowlist ⊆ mission allowlist (if set)

### Kill Switch (Owner Only)
```solidity
function activateKillSwitch(address agent) external onlyOwner onlyIfInitialized
function deactivateKillSwitch(address agent) external onlyOwner onlyIfInitialized
function emergencyKillAll() external onlyOwner onlyIfInitialized
```

### Payment Execution
```solidity
function executePayment(address recipient, uint256 amount) external
```
- **Owner**: Executes directly via `_executePaymentAsOwner()`
- **UserOperation**: Called via `executeUserOp()` after `validateUserOp()`

### View Functions
```solidity
function getMissionConfig() external view returns (MissionConfig)
function getSpendingTracker() external view returns (SpendingTracker)
function getRecipientSpent(address recipient) external view returns (uint256)
function getSessionKey(address agent) external view returns (SessionKey)
function isAgentKilled(address agent) external view returns (bool)
function getRecipientAllowlist() external view returns (address[])
function isInitialized() external view returns (bool)
```

---

## ERC-4337 Interface (IAccount)

### validateUserOp
```solidity
function validateUserOp(
    UserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 missingAccountFunds
) external view returns (uint256 validationData)
```

**Validation Checks**:
1. Caller is EntryPoint
2. Mission not expired
3. Emergency kill not active
4. Sender is this wallet
5. Agent has valid session key (not revoked, not expired, amount ≤ maxPerTx, recipient allowed)
6. Agent not killed
7. Session key nonce matches (replay protection)
8. Mission spending limits (per-tx, daily, total)
9. Session key spending limits (per-tx, daily)
10. Mission recipient allowlist
11. Signature valid (ECDSA recovery)

**Returns**: Packed `validationData` = `(validUntil << 160) | (validAfter << 96) | sigAuthorizer`
- `validUntil`: min(sessionKey.expiry, mission.expiry)
- `validAfter`: 0 (no time restriction)
- `sigAuthorizer`: 0 (no aggregator)

**Error Codes**:
- `1` (VALIDATION_FAILED): Generic validation failure
- `2` (SIG_AUTH_FAILED): Signature/auth failure

### executeUserOp
```solidity
function executeUserOp(
    UserOperation calldata userOp,
    bytes32 userOpHash
) external payable onlyEntryPoint
```
Executes payment after EntryPoint validation. Increments ERC-4337 nonce.

### nonce
```solidity
function nonce() external view returns (uint256)
```
Returns sequential ERC-4337 nonce.

---

## Security Features

### 1. Reentrancy Protection
- `ReentrancyGuard` on all payment execution functions
- Low-level `call{value: amount}("")` with success check

### 2. Replay Protection
- Per-session-key nonce (incremented on each payment)
- ERC-4337 global nonce (incremented per UserOperation)
- `checkNonce()` reverts on mismatch

### 3. Spending Limits (Multi-Layer)
- **Mission-level**: totalBudget, maxPerTx, maxDaily
- **Session-key-level**: maxPerTx, maxDaily (≤ mission limits)
- **Daily reset**: Automatic at UTC midnight via `getDailyResetTimestamp()`

### 4. Access Control
- `onlyOwner` on all admin functions
- `onlyEntryPoint` on `executeUserOp`
- `onlyIfInitialized` on post-init functions
- Session key signature verification (ECDSA)

### 5. Emergency Controls
- Per-agent kill switch (`activateKillSwitch`/`deactivateKillSwitch`)
- Global emergency kill (`emergencyKillAll` sets `_emergencyKilled = true`)
- All payment paths check `_isEmergencyKilled()`

### 6. Allowlist Enforcement
- Mission-level allowlist (owner configurable)
- Session-key-level allowlist (subset of mission allowlist)
- Empty allowlist = any recipient allowed

---

## Assumptions & Limitations

1. **Single Owner**: One owner per mission (transferred on initialize)
2. **ETH Only**: Native ETH payments only (no ERC-20)
3. **UTC Daily Reset**: Daily limits reset at UTC midnight
4. **No Allowlist Iteration**: Cannot iterate allowlist on-chain (off-chain tracking needed)
5. **EntryPoint Trust**: Assumes canonical ERC-4337 EntryPoint
6. **No Signature Aggregator**: `sigAuthorizer` always 0
7. **Fixed Decimals**: All amounts in wei (18 decimals)
8. **No Upgradeability**: Contract is not upgradeable
9. **Gas Estimation**: `validateUserOp` must be gas-efficient for bundlers

---

## Deployment

```bash
# Compile
npx hardhat compile

# Deploy (requires EntryPoint address)
npx hardhat run scripts/deploy.ts --network <network>

# Verify
npx hardhat verify --network <network> <contract_address> <entry_point_address>
```

**Constructor Arguments**:
- `entryPoint`: Address of ERC-4337 EntryPoint contract

---

## Integration Guide

### For Person 2 (Backend)
1. Use `IMissionWallet` interface for type-safe calls
2. Monitor events: `PaymentExecuted`, `SessionKeyGranted`, `KillSwitchActivated`
3. Call `getMissionConfig()`, `getSpendingTracker()`, `getSessionKey()` for state
4. Submit UserOperations via EntryPoint for agent payments

### For Person 3 (Frontend)
1. Display mission config from `getMissionConfig()`
2. Show spending from `getSpendingTracker()`
3. List session keys via `getSessionKey(agent)`
4. Show kill switch status via `isAgentKilled(agent)`
5. Use allowlist from `getRecipientAllowlist()`

### For Person 4 (DevOps)
1. Configure `EntryPoint` address per network
2. Fund wallet with ETH before operations
3. Monitor `EmergencyKillAll` for disaster recovery
4. Use `updateBudget()` for budget increases

---

## Testing

```bash
# Run all tests
npx hardhat test

# Run with coverage
npx hardhat coverage

# Gas report
REPORT_GAS=true npx hardhat test
```

**Test Coverage**: 54 tests covering:
- Initialization validation
- Session key lifecycle
- Spending limits (mission & session)
- Recipient allowlist
- Kill switch operations
- Payment execution
- Replay protection
- Unauthorized access prevention
- Budget updates
- Mission lifecycle
- ERC-4337 interface
- Adversarial scenarios (reentrancy, replay, overflow, expiry, allowlist)

---

## Security Audit Checklist

- [x] Reentrancy protection on all value transfers
- [x] Access control on all admin functions
- [x] Input validation on all external functions
- [x] Arithmetic overflow protection (Solidity 0.8+)
- [x] Replay protection via nonces
- [x] Signature verification for UserOperations
- [x] Emergency kill switch
- [x] Spending limit enforcement (multi-layer)
- [x] Allowlist validation
- [x] Mission expiry enforcement
- [x] Session key expiry enforcement
- [x] ERC-4337 compliance (validateUserOp, executeUserOp, nonce)
- [x] Event emission for all state changes

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024 | Initial release |
| 1.1.0 | 2024 | Fixed `_isEmergencyKilled()`, ERC-4337 nonce, validationData format, added adversarial tests |