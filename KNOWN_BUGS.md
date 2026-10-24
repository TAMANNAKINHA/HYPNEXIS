# Known bugs and gaps (found on clean checkout)

| ID | Severity | Finding | Repro | Owner |
|----|----------|---------|-------|-------|
| BUG-001 | High | Hardhat compile/deploy status needs re-verification. package.json and package-lock now specify Hardhat 2 (`^2.22.0`, lock resolves 2.29.1) with the Hardhat 2 config, but no dependency install or contract build was possible in this workspace. | `npm ci && npm run compile` | Person 1 |
| GAP-001 | High | Contract is `MissionWallet.sol`, not an ERC-4337 account. No EntryPoint, UserOperation, nonce or chain-ID validation, so tests C-06/C-07 are blocked. | read contracts/ | Person 1 |
| GAP-002 | Resolved | Backend lifecycle tests now run with `npm test`; contract tests/build remain separate and require a working Hardhat environment. | `npm test` | Person 2 |
| BUG-002 | Low | `io` package in backend dependencies looks accidental (socket.io is already used). | package.json | Person 2 |
| BUG-003 | Resolved | README and API_CONTRACT.md document the current `/api/missions`, `/api/attacks`, and `/api/payments` routes. | compare docs with `src/routes` | Person 2 |
| BUG-004 | Resolved in merged layout | `aegis-project.zip` (30 MB) is not carried into `frontend/`; also delete it from the old frontend repo history/tree. | ls frontend | Person 3 |
| BUG-005 | Resolved | Frontend package name is `aegis-frontend`. | package.json | Person 3 |
| INT-001 | Resolved | Dashboard Policy modal showed hard-coded policies and its toggle called a missing `/api/missions/toggle-policy`. Backend now owns the policy list (sent in `state_init`, `policy_update`) and implements the toggle; a disabled policy falls back to the General policy. | open Policies modal | Integration |
| INT-002 | Open | `POST /api/missions/cancel-pending` is still unimplemented; `cancelPendingTx` in `frontend/src/services/api.ts` is not used by any component. | grep cancelPendingTx | Person 2/3 |
| INT-003 | Open | Backend emits `trust_update` but the dashboard has no listener; `time_lock_update` is listened for but never emitted. | compare socket events | Person 2/3 |

Prior verification claims are historical. In this workspace, `npm ci` failed with Windows `EPERM` while creating `node_modules/@types`; build and test commands therefore could not run here.
