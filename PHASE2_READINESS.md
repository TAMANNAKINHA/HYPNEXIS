# Phase 2 readiness (Person 4 view)

## Infrastructure / QA (this role)
- [x] Clean install path scripted (`scripts/setup.sh`); backend `.env` generation with valid tokens
- [x] Local chain, deploy and stack scripts (`scripts/chain.sh`, `deploy-local.ts`, `dev.sh`)
- [x] `.env.example` for backend and frontend with every variable documented
- [x] Test runners: `test:contracts`, `test:payments`, `test:e2e`, `doctor`, `check:api`
- [x] End-to-end suite written: mission -> payment -> chain, 7 hijack scripts, kill/freeze/expiry/chain-mismatch
- [x] SETUP, DEPLOYMENT_CHECKLIST, DEMO, TEST_MATRIX, KNOWN_BUGS updated
- [ ] **First full green run of `npm run test:e2e` recorded** (the suite was written without network access to
      install dependencies, so it has not been executed yet)
- [ ] CI workflow (not added: needs repo-hosting decision)
- [ ] Testnet deployment (blocked on GAP-001, INT-001, INT-003)

## Phase 2 requirement coverage
| Requirement | Exists in code? | QA hook |
|-------------|-----------------|---------|
| Script 5+ hijack attacks; losses never exceed daily limit | Limits yes (contract) | `E2E-4` ATTACK-1..7, final loss assertion |
| Auto-freeze on unusual spending; detection rate + false freezes | No | Needs Person 2 detector; add a labelled spend trace and compute rates in e2e |
| Recovery with 3 of 5 guardians after 48 h, owner veto | No | Needs Person 1; use `hardhat_mine`/`evm_increaseTime` for the 48 h delay |
| Gas sponsorship with per-agent quota | No | Needs Person 1 paymaster; spam test: N ops from one agent must stop at quota |
| Fuzz invariant: funds move only with valid owner / in-policy agent / recovery approval | No | Add Foundry or Hardhat property tests; invariant: `balance delta <= limits` and `msg.sender` is authorised |
