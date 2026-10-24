# Deployment checklist

## Local (automated: `scripts/deploy-local.ts`, `scripts/dev.sh up`)
- [x] `npx hardhat compile` config is consistent (Hardhat 2 + `hardhat-ethers`; see KNOWN_BUGS BUG-001)
- [x] `hardhat node` start/stop script (`scripts/chain.sh`)
- [x] Reproducible deploy script writes `deployments/localhost.json` and `.env`
- [ ] Run `npm run test:e2e` once on a machine with network access and record the result in TEST_MATRIX.md
- Contract addresses change on every chain restart; read them from `deployments/localhost.json`, not from this file.

## Testnet — Base Sepolia (chainId 84532), Phase 2, NOT done
- [ ] Person 1 confirms ERC-4337 implementation + EntryPoint version (GAP-001)
- [ ] Person 1 resolves INT-001/INT-003 (backend adapter ABI vs wallet ABI; on-chain kill switch), or the
      gateway in `contracts/mocks/` is explicitly accepted as the testnet adapter after review
- [ ] Throwaway deployer key created, funded from a faucet, stored only in local `.env` as `PRIVATE_KEY`
- [ ] `BASE_SEPOLIA_RPC` set; `npx hardhat run scripts/deploy.ts --network baseSepolia`
- [ ] Verify on Basescan; record address + tx hash below
- [ ] Set `CHAIN_ID=84532`, `CONFIRMATIONS` >= 2, real `RECIPIENT_ALLOWLIST` and per-mission recipients
- [ ] Re-run the e2e scenarios against the testnet RPC

## Record (fill in only after a real deployment)
| Item | Value |
|------|-------|
| ERC-4337 implementation | TBD (Person 1) |
| EntryPoint version | TBD (Person 1) |
| Local gateway / wallet | see `deployments/localhost.json` (regenerated per run) |
| Testnet contract address | Not deployed |
| Testnet tx hash | Not deployed |
