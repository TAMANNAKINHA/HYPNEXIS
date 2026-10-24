# Known bugs and gaps (found on clean checkout)

| ID | Severity | Finding | Repro | Owner |
|----|----------|---------|-------|-------|
| BUG-001 | High | Hardhat compile/deploy status needs re-verification. package.json and package-lock now specify Hardhat 2 (`^2.22.0`, lock resolves 2.29.1) with the Hardhat 2 config, but no dependency install or contract build was possible in this workspace. | `npm ci && npm run compile` | Person 1 |
| GAP-001 | High | Contract is `MissionWallet.sol`, not an ERC-4337 account. No EntryPoint, UserOperation, nonce or chain-ID validation, so tests C-06/C-07 are blocked. | read contracts/ | Person 1 |
| GAP-002 | Resolved | Backend lifecycle tests now run with `npm test`; contract tests/build remain separate and require a working Hardhat environment. | `npm test` | Person 2 |
| BUG-002 | Low | `io` package in backend dependencies looks accidental (socket.io is already used). | package.json | Person 2 |
| BUG-003 | Resolved | README and API_CONTRACT.md document the current `/api/missions`, `/api/attacks`, and `/api/payments` routes. | compare docs with `src/routes` | Person 2 |
| BUG-004 | Low | frontend repo contains a 30 MB `aegis-project.zip`; remove from git. | ls frontend | Person 3 |
| BUG-005 | Info | Frontend package name is still `vite-react-typescript-starter`. | package.json | Person 3 |

Prior verification claims are historical. In this workspace, `npm ci` failed with Windows `EPERM` while creating `node_modules/@types`; build and test commands therefore could not run here.
