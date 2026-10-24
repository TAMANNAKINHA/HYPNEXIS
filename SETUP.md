# Setup (clean checkout)

Verified on: Node v22, npm 10, Ubuntu. Required: Node >= 20, npm >= 10, git.

## Backend (repository root)
    cp .env.example .env        # use safe local placeholders; set distinct role tokens for payment API calls
    npm ci
    npm run dev                 # http://localhost:5000
    npm test                    # TypeScript build + backend lifecycle tests

## Frontend
    cd frontend
    cp .env.example .env.local
    npm install
    npm run dev                 # http://localhost:5173
    npm run typecheck && npm run build

## Local chain (not available for backend payment verification)
    npx hardhat node
    npx hardhat run scripts/deploy.ts --network localhost
The checked-in mission contract interface is not compatible with the current backend transaction adapter. Keep `USE_REAL_CONTRACT=false` and `EXECUTION_MODE=demo`; real execution fails closed. See `API_CONTRACT.md` and `DEPLOYMENT_CHECKLIST.md` before changing these settings.

## Safety rules
- Never commit .env or real private keys. Local tests use Hardhat's built-in fake accounts only.
- No real funds are needed for any Phase 1 test.
