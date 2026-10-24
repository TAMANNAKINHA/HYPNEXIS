# Test matrix

Status key: **WRITTEN** = automated test exists in this repo but has not been executed by its author (the
sandbox it was written in had no network to install dependencies); **UNVERIFIED** = pre-existing test not
re-run; **PASS/FAIL** = only after a recorded run; **BLOCKED** = cannot be tested until another component
exists; **TODO** = no test yet.

Run everything: `npm run test:all`. Record results in the "Last run" table below after the first real run.

| ID | Area | Scenario | Layer | Status | Notes |
|----|------|----------|-------|--------|-------|
| C-01 | Contract | Spend above per-tx limit reverts | contract | UNVERIFIED | `test/MissionWallet.test.ts` (Person 1); run `npm run test:contracts`. Also E2E ATTACK-1 on chain. |
| C-02 | Contract | Spend above daily/budget limit reverts | contract | UNVERIFIED | As above; E2E ATTACK-2 drives the daily limit through the gateway. |
| C-03 | Contract | Non-allowlisted recipient reverts | contract | UNVERIFIED | E2E ATTACK-4 (backend bypassed, contract refuses). |
| C-04 | Contract | Spend after expiry reverts | contract | UNVERIFIED | `MissionWallet.test.ts`; not in e2e (needs time travel). |
| C-05 | Contract | Spend after revoke/freeze reverts | contract | UNVERIFIED | `MissionWallet.test.ts`; see INT-003 for owner-path kill gap. |
| C-06 | Contract | Replay of same signed op rejected | contract | BLOCKED | Needs real ERC-4337 flow (GAP-001). |
| C-07 | Contract | Wrong chain ID / nonce rejected | contract | BLOCKED | Needs real ERC-4337 flow (GAP-001). Backend-level chain check: E2E-2 / E2E-3. |
| B-01 | Budget | Two simultaneous payments cannot exceed budget | integration | WRITTEN | E2E-3 concurrent execution; unit test in `paymentLifecycle.test.cjs`. |
| B-02 | Budget | Insufficient remaining budget rejected | integration | WRITTEN | E2E-2. |
| B-03 | Budget | Failed tx does not reduce spent amount | integration | WRITTEN | ATTACK-1 asserts on-chain `totalSpent` and balances unchanged. See INT-002 for status. |
| K-01 | Kill switch | Disabled agent's new payment rejected | integration | WRITTEN | E2E-3, ATTACK-7. |
| K-02 | Kill switch | In-flight tx status handled | integration | WRITTEN | Unit test in `paymentLifecycle.test.cjs` (mock runtime). |
| S-01 | Simulator | Valid payment simulated, nothing broadcast | integration | WRITTEN | E2E-1 (`broadcasted:false`, no record created). |
| S-02 | Simulator | Insufficient budget / blocked recipient reported | integration | TODO | Create-time checks covered (E2E-2); simulate-specific assertion not written. |
| D-01 | Duplicate | Retry of same request is idempotent | api | WRITTEN | E2E-1. |
| D-02 | Duplicate | Concurrent duplicates -> one payment | api | WRITTEN | Unit test in `paymentLifecycle.test.cjs`. |
| D-03 | Duplicate | Legitimate similar payment still allowed | api | WRITTEN | Unit test in `paymentLifecycle.test.cjs`. |
| A-01 | Approvals | Expired approval rejected | api | WRITTEN | E2E-2 (410 + EXPIRED). |
| A-02 | Approvals | Reused approval rejected | api | WRITTEN | E2E-1 replay + ATTACK-5; unit test. |
| A-03 | Approvals | Approval for altered details rejected | api | WRITTEN | E2E-2 and ATTACK-6. |
| H-01 | History | State transitions + audit records correct | api | WRITTEN | E2E-1. |
| H-02 | History | Freezing eligible payments | api | WRITTEN | E2E-3. |
| F-01 | Frontend | Loading + error states shown | e2e | TODO | No browser harness yet. |
| F-02 | Frontend | Backend unavailable handled gracefully | e2e | TODO | No browser harness yet; `friendlyError` maps fetch failures. |
| F-03 | Frontend | Statuses match backend/chain | e2e | PARTIAL | API, list and on-disk store agree (E2E-1). UI mapping blocked by INT-005/INT-006. |
| I-01 | Integration | Reported tx hash matches chain tx | integration | WRITTEN | E2E-1 (needs local chain). |
| I-02 | Integration | DB/store status matches on-chain outcome | integration | WRITTEN | E2E-1. |
| I-03 | Integration | Freeze/revoke enforced at contract layer, not just UI | integration | BLOCKED | INT-003: on-chain kill switch is a stub. |
| E-01 | Integration | Wrong configured chain blocks execution | integration | WRITTEN | E2E-3. |
| E-02 | Integration | Contract address without code fails closed | integration | WRITTEN | E2E-3. |
| X-01..X-07 | Hijack | Overspend, drain loop, bad recipient (2 layers), replay, tampered approval, disabled agent | e2e | WRITTEN | E2E-4 ATTACK-1..7 + final loss <= daily limit. |
| P-01 | Phase 2 | Auto-freeze detection rate / false freezes | e2e | BLOCKED | Feature not implemented. |
| P-02 | Phase 2 | 3-of-5 guardian recovery, 48 h delay, owner veto | contract | BLOCKED | Feature not implemented. |
| P-03 | Phase 2 | Gas sponsorship quota cannot be drained by spam | contract | BLOCKED | Feature not implemented. |
| P-04 | Phase 2 | Invariant fuzzing | contract | BLOCKED | Feature not implemented. |

## Last run
| Date | Command | Result | Notes |
|------|---------|--------|-------|
| _not yet run_ | `npm run test:all` | - | Fill in after the first full run; update WRITTEN rows to PASS/FAIL |

## Where things live
- `test/MissionWallet.test.ts` — contract unit tests (Person 1)
- `test/paymentLifecycle.test.cjs` — payment service unit tests with mocked runtime (Person 2)
- `test/e2e/e2e.test.cjs` — real routes + real chain + real contracts (Person 4); groups E2E-1 ... E2E-4
- `scripts/e2e.sh` — builds, starts a throwaway chain, deploys, runs both node test files, cleans up
