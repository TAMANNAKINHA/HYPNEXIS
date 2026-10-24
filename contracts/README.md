# MissionWallet Smart Contracts

ERC-4337 compatible smart contract wallet for AI mission governance with spending limits, session keys, and kill switches.

## Features

- **ERC-4337 Account Abstraction**: Compatible with EntryPoint v0.7
- **Spending Limits**: Per-transaction, daily (UTC midnight reset), and total budget caps
- **Recipient Allowlist**: Restrict payments to approved addresses
- **Session Keys**: ECDSA-based agent authorization with configurable limits and expiry
- **Kill Switch**: Per-agent and emergency kill switches
- **Replay Protection**: Nonce-based protection at both EntryPoint and session key levels
- **ETH Payments**: Native ETH transfers (ERC20 support can be added)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MissionWallet                             │
├─────────────────────────────────────────────────────────────┤
│  IAccount (ERC-4337)                                        │
│  ├── validateUserOp()  - Validates UserOperations           │
│  ├── executeUserOp()   - Executes validated UserOperations  │
│  └── nonce()           - Account nonce for replay protection│
├─────────────────────────────────────────────────────────────┤
│  Mission Management (Owner Only)                            │
│  ├── initialize()       - Initialize mission config         │
│  ├── updateSpendingLimits() - Update per-tx/daily limits    │
│  ├── updateRecipientAllowlist() - Update recipient allowlist│
│  └── updateBudget()     - Increase total budget             │
├─────────────────────────────────────────────────────────────┤
│  Session Key Management (Owner Only)                        │
│  ├── grantSessionKey()  - Grant agent payment permissions   │
│  └── revokeSessionKey() - Revoke agent permissions          │
├─────────────────────────────────────────────────────────────┤
│  Kill Switch (Owner Only)                                   │
│  ├── activateKillSwitch()  - Disable specific agent         │
│  ├── deactivateKillSwitch() - Re-enable agent               │
│  └── emergencyKillAll()    - Emergency disable all agents   │
├─────────────────────────────────────────────────────────────┤
│  Payment Execution                                          │
│  └── executePayment() - Direct ETH payments (owner only)    │
└─────────────────────────────────────────────────────────────┘
```

## Contract Structure

```
contracts/
├── interfaces/
│   ├── IEntryPoint.sol      # ERC-4337 EntryPoint interface
│   ├── IAccount.sol         # ERC-4337 IAccount interface
│   └── IMissionWallet.sol   # Main MissionWallet interface
├── libraries/
│   ├── SpendingLimits.sol   # Spending limit validation logic
│   ├── SessionKeyLib.sol    # Session key validation logic
│   └── UserOpLib.sol        # UserOperation helpers
├── mocks/
│   └── EntryPointMock.sol   # Mock EntryPoint for testing
└── MissionWallet.sol        # Main implementation
```

## Deployment

### Local Development

```bash
# Start local Hardhat node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy.ts --network localhost
```

### Base Sepolia Testnet

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export BASESCAN_API_KEY=your_basescan_key

# Deploy
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### Grant Session Key (Post-Deployment)

```bash
export MISSION_WALLET_ADDRESS=0x...
export AGENT_ADDRESS=0x...
export MAX_PER_TX_ETH=0.01
export MAX_DAILY_ETH=0.05
export EXPIRY_DAYS=7
export ALLOWED_RECIPIENTS=0xRecipient1,0xRecipient2

npx hardhat run scripts/grant-session-key.ts --network baseSepolia
```

## Usage

### 1. Initialize Mission

```solidity
await wallet.initialize({
  missionId: "MID-ABC123",
  totalBudget: 1 ether,
  maxPerTx: 0.1 ether,
  maxDaily: 0.5 ether,
  expiry: block.timestamp + 7 days,
  owner: ownerAddress
});
```

### 2. Grant Session Key to Agent

```solidity
await wallet.grantSessionKey({
  agent: agentAddress,
  maxPerTx: 0.05 ether,
  maxDaily: 0.2 ether,
  expiry: block.timestamp + 30 days,
  allowedRecipients: [recipient1, recipient2] // empty = any recipient
});
```

### 3. Agent Makes Payment (via UserOperation)

The agent signs a UserOperation with their session key private key:

```javascript
// UserOperation callData encodes: executePayment(recipient, amount)
const callData = wallet.interface.encodeFunctionData("executePayment", [recipient, amount]);

const userOp = {
  sender: walletAddress,
  nonce: await wallet.nonce(),
  initCode: "0x",
  callData,
  callGasLimit: 100000,
  verificationGasLimit: 100000,
  preVerificationGas: 50000,
  maxFeePerGas: ethers.parseUnits("1", "gwei"),
  maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
  paymasterAndData: "0x",
  signature: agentSessionKey.sign(userOpHash)
};
```

### 4. Owner Direct Payment (Testing/Admin)

```solidity
await wallet.executePayment(recipient, amount);
```

### 5. Kill Switch

```solidity
// Disable specific agent
await wallet.activateKillSwitch(agentAddress);

// Re-enable agent
await wallet.deactivateKillSwitch(agentAddress);

// Emergency kill all
await wallet.emergencyKillAll();
```

## Events

| Event | Description |
|-------|-------------|
| `MissionCreated` | Mission initialized |
| `PaymentExecuted` | Payment completed (agent, recipient, amount, nonce) |
| `SessionKeyGranted` | New session key granted |
| `SessionKeyRevoked` | Session key revoked |
| `KillSwitchActivated` | Agent disabled |
| `KillSwitchDeactivated` | Agent re-enabled |
| `EmergencyKillAll` | All agents disabled |
| `SpendingLimitUpdated` | Per-tx/daily limits changed |
| `RecipientAllowlistUpdated` | Recipient list changed |
| `BudgetUpdated` | Total budget changed |

## Errors

| Error | Description |
|-------|-------------|
| `UnauthorizedCaller` | Caller not owner |
| `MissionExpired` | Mission past expiry |
| `MissionKilled` | Kill switch active |
| `InsufficientBudget` | Exceeds total budget |
| `ExceedsPerTxLimit` | Exceeds per-transaction limit |
| `ExceedsDailyLimit` | Exceeds daily limit |
| `RecipientNotAllowed` | Recipient not in allowlist |
| `SessionKeyRevokedError` | Session key revoked |
| `SessionKeyExpiredError` | Session key expired |
| `InvalidNonce` | Replay attack detected |
| `AgentNotAuthorized` | Agent has no valid session key |
| `InvalidSignature` | Invalid ECDSA signature |
| `EntryPointRejected` | Called by non-EntryPoint |
| `AlreadyInitialized` | Double initialization attempt |
| `InvalidMissionConfig` | Invalid configuration |
| `AgentAlreadyHasKey` | Duplicate session key |
| `AgentHasNoKey` | No session key for agent |

## Testing

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run coverage
npx hardhat coverage
```

## Security Considerations

1. **Owner Key Security**: The owner private key must be kept secure. Consider using a multisig or hardware wallet.

2. **Session Key Management**: 
   - Session keys should have short expiries
   - Use minimal necessary permissions (maxPerTx, maxDaily, allowlist)
   - Revoke keys immediately when no longer needed

3. **Kill Switch**: 
   - Test kill switch functionality before production
   - Have emergency procedures for `emergencyKillAll()`

4. **Replay Protection**: 
   - EntryPoint nonce prevents UserOperation replay
   - Session key nonce prevents payment replay within same session

5. **EntryPoint Trust**: Only the official EntryPoint v0.7 should be used. Verify address on each network.

## Networks

| Network | Chain ID | EntryPoint v0.7 |
|---------|----------|-----------------|
| Base Sepolia | 84532 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| Base Mainnet | 8453 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| Ethereum Mainnet | 1 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| Polygon | 137 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| Arbitrum | 42161 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| Optimism | 10 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |

## License

MIT