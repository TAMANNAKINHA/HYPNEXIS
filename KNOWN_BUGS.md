# Known bugs and gaps (found on clean checkout)

| ID | Severity | Finding | Repro | Owner |
|----|----------|---------|-------|-------|
| BUG-001 | High | `npx hardhat compile` fails: "Hardhat only supports ESM projects". package.json uses hardhat ^3 without `"type": "module"`; hardhat.config.ts and scripts/deploy.ts use Hardhat 2 style (`import { ethers } from "hardhat"`, `hardhat-toolbox`). Pick one: downgrade to Hardhat 2 or migrate to Hardhat 3. | `cd backend && npm install && npx hardhat compile` | Person 1 |
| GAP-001 | High | Contract is `MissionWallet.sol`, not an ERC-4337 account. No EntryPoint, UserOperation, nonce or chain-ID validation, so tests C-06/C-07 are blocked. | read contracts/ | Person 1 |
| GAP-002 | Medium | No automated tests exist (`test-policy.ts` is a loose script; no `test` script in package.json). | see package.json | Person 4 |
| BUG-002 | Low | `io` package in backend dependencies looks accidental (socket.io is already used). | package.json | Person 2 |
| BUG-003 | Low | backend README describes folders/endpoints that don't match code (real routes are under /api/missions and /api/attacks). | compare README vs src/routes | Person 2 |
| BUG-004 | Low | frontend repo contains a 30 MB `aegis-project.zip`; remove from git. | ls frontend | Person 3 |
| BUG-005 | Info | Frontend package name is still `vite-react-typescript-starter`. | package.json | Person 3 |

Verified OK: backend `npm install`, `tsc --noEmit`, server boots; frontend `npm install`, `typecheck`, `build`.
