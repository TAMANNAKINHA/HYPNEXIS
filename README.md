🛡️ AEGIS Backend
Every AI Needs a Mission. Every Mission Needs a Wallet.
The Governance Engine Behind Autonomous AI Payments
Instead of giving AI unrestricted access to company funds, AEGIS creates Mission Wallets — temporary, purpose-bound wallets protected by enterprise-grade security policies.
The backend is the brain behind AEGIS. It:
🧭 Creates Mission Wallets
📋 Evaluates policies
🛡️ Enforces security
💸 Coordinates payment execution
📜 Maintains a complete, immutable audit trail
> 🧩 **Where this fits:** rails like AP2, Visa Intelligent Commerce, and Skyfire move the money. AEGIS is the governance layer enterprises put in front of them.

---
🚀 Run the full stack (backend + frontend)

```
./scripts/setup.sh   # once: writes .env files (random role tokens), installs both apps
./scripts/dev.sh     # backend on :5000, dashboard on :5173
```
Open http://localhost:5173. Missions, wallet controls, attack simulations, the live terminal and the Policy Engine modal use REST + Socket.IO against the backend. The Payments tab needs a role token: paste `PAYMENT_ADMIN_TOKEN` from `.env` (the admin token is accepted for every action). Set `VITE_USE_MOCK=true` in `frontend/.env.local` to run the Payments tab on fake data without a backend.

---
🤔 Why AEGIS Exists
	
Traditional AI	Give the AI access to money and hope it behaves.
AEGIS	Give every task its own Mission Wallet with built-in rules.
Result	Even if the AI is compromised, the treasury isn't.
---
🚨 The Problem
AI can make payments. It can also:
🤯 Hallucinate
🙃 Misunderstand instructions
💉 Get prompt-injected
💸 Overspend
🔧 Call the wrong tools
Traditional financial systems assume a human clicks "pay." AI breaks that assumption.
---
✅ Our Solution
Instead of trusting AI with company money... AEGIS trusts Mission Wallets.
Every payment begins with a mission. Every mission gets:
✅ Its own wallet
✅ Its own budget
✅ Its own approved merchants
✅ Its own expiry
✅ Its own verification rules
When the mission ends, the wallet disappears.
---
💳 What Is a Mission Wallet?
> **Mission Wallet**
> **Purpose:** Deploy AWS Server
> **Budget:** ₹80,000
> **Category:** Cloud Infrastructure
> **Allowed Merchant:** AWS
> **Verification:** Phone Approval
> **Expiry:** 2 Hours
> **Status:** 🟢 Active
A Mission Wallet is a temporary wallet created for one AI task — with its own identity, limits, policies, and lifecycle.
---
🧠 Core Philosophy
> Don't make AI safer.
> **Make money safer.**
Instead of controlling what the AI thinks, AEGIS controls where, how, when, and why money moves.
---
🏗️ Architecture Flow
```
AI
 ↓
Mission Parser
 ↓
Category Engine
 ↓
Policy Engine
 ↓
Mission Wallet
 ↓
Security Pipeline
 ↓
Blockchain Layer
 ↓
Payment
```
---
🛡️ Security Pipeline
```
Mission Guard → Policy Engine → Dynamic Verification → Smart Contract → Time Lock → Emergency Controls
```
Layer	What it does
🎯 Mission Guard	Confirms the AI's action actually matches what was requested
📋 Policy Engine	Loads the right enterprise policy for the mission's category
🔐 Dynamic Verification	Security scales automatically with transaction risk
⛓️ Smart Contract	Immutable spend-cap enforcement, deployed on testnet
⏱️ Time Lock	Opens a short cancellation window before large payments execute
🚨 Emergency Controls	Freeze, terminate, or rotate a wallet instantly
---
⚡ Event-Driven Architecture
```
REST      → Commands
WebSocket → Live Events
Store     → Frontend
```
Every state change streams to the dashboard in real time — nothing polled, nothing stale.
---
✨ Features
		
💳 Mission Wallets	🗣️ Natural Language Missions	📋 Category Policies
🔐 Dynamic Verification	📡 Real-time Activity Feed	🎯 Attack Simulation
📜 Audit Trail	⛓️ Smart Contract Enforcement	🔴 Kill Switch
🔌 WebSocket Events		
---
🧰 Tech Stack
Layer	Tools
Runtime	Node, Express
Realtime	Socket.io
Language	TypeScript
Contracts	Solidity, OpenZeppelin
Chain	Base / Polygon Testnet
---
📁 Folder Structure
```
backend/
├── src/
│   ├── missions/
│   ├── policies/
│   ├── security/
│   ├── contracts/
│   └── events/
├── test/
└── README.md
```
---
🚀 Running the Backend
```bash
npm install
npm run dev
```
---
🔌 API Endpoints

The backend listens on port 5000 by default. Full request bodies, authentication roles, response fields, and lifecycle details are documented in [API_CONTRACT.md](API_CONTRACT.md).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/missions` | List demo missions (session keys omitted) |
| GET | `/api/missions/:missionId` | Get demo mission details |
| GET | `/api/missions/:missionId/wallet/status` | Get wallet state, explicitly labeled demo/not deployed |
| POST | `/api/missions/create` | Create a demo mission |
| POST | `/api/missions/execute` | Run demo simulation (`broadcasted: false`) |
| GET/POST | `/api/payments` | Authenticated payment history and request creation |
| POST | `/api/payments/:id/approve`, `/execute`, `/reconcile` | Authenticated lifecycle operations |

Real payment execution remains disabled for the checked-in `IMissionWallet` interface; demo success is never represented as an on-chain transaction.
---
🔭 Future Vision
AEGIS aims to become the governance layer that powers autonomous financial agents across every enterprise payment network.
---
Built with 🛡️ for InnovaHack.
