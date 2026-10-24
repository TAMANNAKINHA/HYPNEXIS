# Backend API

Base URL: `http://localhost:5000`. JSON request bodies are limited to 32 KB. Requests under `/api/` are rate limited to 100 per 15 minutes per IP. Socket.IO broadcasts dashboard events.

## Demo mission and wallet APIs

These compatibility endpoints use the in-memory demo store. They do not authenticate requests and are not a production authorization boundary. Mission responses omit the internal session key. Wallet responses explicitly identify the wallet as a non-deployed demo.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/missions` | List missions with session keys removed |
| GET | `/api/missions/:missionId` | Get mission data with session key removed |
| GET | `/api/missions/:missionId/wallet/status` | Get mission wallet state; includes `mode: demo`, `deployed: false` |
| GET | `/api/missions/policies` | List policy profiles |
| POST | `/api/missions/create` | Body `{ "text": "..." }`; create a simulated mission wallet |
| POST | `/api/missions/execute` | Body `{ "missionId": "..." }`; demo simulation only, never broadcasts |
| POST | `/api/missions/cancel`, `/freeze`, `/unfreeze`, `/nuke`, `/rotate-key` | Legacy demo wallet controls |
| POST | `/api/missions/verify/otp`, `/verify/reject`, `/verify/approve` | Legacy demo verification flow |
| POST | `/api/missions/reset` | Reset demo state |
| POST | `/api/attacks/prompt-injection`, `/spam`, `/stolen-key` | Demo attack simulations |

Demo mission execution returns `simulated: true` and `broadcasted: false`; it does not return a transaction hash or receipt. Setting `USE_REAL_CONTRACT=true` makes mission creation fail closed because no reviewed deployment adapter for `IMissionWallet` exists.

## Payment, agent, and history APIs

Authenticate with `Authorization: Bearer <role-token>`. Configure separate random tokens of at least 32 characters for `PAYMENT_READER_TOKEN`, `PAYMENT_OPERATOR_TOKEN`, `PAYMENT_APPROVER_TOKEN`, `PAYMENT_EXECUTOR_TOKEN`, and `PAYMENT_ADMIN_TOKEN`. The `admin` role is accepted for all operations.

Proposal body: `missionId`, nonzero EVM `recipient`, decimal-string `amount` (up to 18 fractional digits), positive integer `chainId`, future ISO `expiresAt`, unique `requestId`, `idempotencyKey` (8–200 chars), and `agentId`.

| Method | Path | Allowed role | Purpose |
|---|---|---|---|
| POST | `/api/payments/simulate` | reader, operator | Non-broadcasting policy preview (`preview: true`, `broadcasted: false`) |
| POST | `/api/payments` | operator | Create an idempotent `PENDING` request and return approval `detailsHash` |
| GET | `/api/payments` | reader | Payment history and lifecycle events |
| GET | `/api/payments/:id` | reader | Payment details and approval hash |
| POST | `/api/payments/:id/approve` | approver | Body `{ "detailsHash": "..." }`; exact-detail approval and budget reservation |
| POST | `/api/payments/:id/reject`, `/freeze`, `/unfreeze` | approver | Payment controls; unfreeze requires fresh approval |
| POST | `/api/payments/missions/:missionId/freeze`, `/unfreeze` | approver | Mission payment controls |
| POST | `/api/payments/:id/execute`, `/reconcile` | executor | Execution fails closed until compatible adapter exists; reconcile known tx hash |
| GET | `/api/payments/agents` | reader | Agent IDs seen in payment history and backend status |
| GET | `/api/payments/agents/:agentId/status` | reader | Backend disablement and separate on-chain revocation status |
| POST | `/api/payments/agents/:agentId/kill` | admin | Disable backend intake; on-chain revocation is not performed |

Payment states: `PENDING`, `APPROVED`, `SUBMITTED`, `CONFIRMED`, `REJECTED`, `FROZEN`, `EXPIRED`, `FAILED`. Ambiguous submissions remain `SUBMITTED` with budget reserved. Confirmation requires a matching transaction hash, successful receipt, configured confirmation depth, and matching contract event. A reverted confirmed receipt becomes `FAILED` and releases the reservation. A missing or mismatching receipt/event remains unconfirmed.

## Blockchain interface limitation

`src/services/paymentService.ts` currently accepts a generic `execute(address,uint256)` method and `PaymentExecuted(address,uint256)` event. That ABI does **not** match `contracts/interfaces/IMissionWallet.sol`, which exposes `executePayment(address,uint256)` and emits `PaymentExecuted(string,address,address,uint256,uint256)`; its session-key/UserOperation path also requires account-abstraction handling that this backend does not implement. Do not enable real payment mode against the checked-in contract. Real-chain behavior has not been verified. Demo and mocked-runtime tests do not broadcast transactions.

The production payment path now fails closed even when an arbitrary ABI is configured. An injected runtime is used only by tests; the API does not construct a signer or submit real transactions until the repository `IMissionWallet` UserOperation path and matching receipt decoder are implemented and reviewed.
