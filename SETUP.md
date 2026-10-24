# Setup (clean checkout)

Verified on: Node v22, npm 10, Ubuntu. Required: Node >= 20, npm >= 10, git.

## Backend
    cd backend
    cp .env.example .env        # defaults work for local simulated mode
    npm install
    npm run dev                 # http://localhost:5000

## Frontend
    cd frontend
    cp .env.example .env.local
    npm install
    npm run dev                 # http://localhost:5173
    npm run typecheck && npm run build

## Local chain (blocked until Hardhat config is fixed, see KNOWN_BUGS BUG-001)
    npx hardhat node
    npx hardhat run scripts/deploy.ts --network localhost
Then set USE_REAL_CONTRACT=true in backend/.env.

## Safety rules
- Never commit .env or real private keys. Local tests use Hardhat's built-in fake accounts only.
- No real funds are needed for any Phase 1 test.
