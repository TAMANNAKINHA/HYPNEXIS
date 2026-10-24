# Deployment checklist

## Local (do first)
- [ ] BUG-001 fixed, `npx hardhat compile` passes
- [ ] `npx hardhat node` + deploy script succeeds
- [ ] Contract address recorded below

## Testnet (Phase 2, NOT done yet)
- [ ] Person 1 confirms ERC-4337 implementation + EntryPoint version
- [ ] Throwaway deployer key funded from a faucet, stored only in local .env
- [ ] Deploy to Base Sepolia (chainId 84532), verify on Basescan
- [ ] Record address + tx hash, then run integration tests against it

Backend real payment execution remains disabled. Do not set `USE_REAL_CONTRACT=true` or `EXECUTION_MODE=real` yet: the backend does not implement the checked-in `IMissionWallet` UserOperation submission and event-decoding path. Enable only after the exact contract interface is confirmed and a reviewed backend adapter is tested against a deployment.

## Record (fill in only after real deployment)
| Item | Value |
|------|-------|
| ERC-4337 implementation | TBD (Person 1) |
| EntryPoint version | TBD (Person 1) |
| Local contract address | TBD |
| Testnet contract address | Not deployed |
