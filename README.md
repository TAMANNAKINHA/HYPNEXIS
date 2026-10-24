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
Method	Endpoint	Description
POST	`/mission`	Create a new mission and wallet
GET	`/mission/:id`	Get mission + wallet status
POST	`/mission/:id/freeze`	Freeze an active wallet
POST	`/mission/:id/terminate`	Terminate a mission
GET	`/audit`	Fetch the audit trail
---
🔭 Future Vision
AEGIS aims to become the governance layer that powers autonomous financial agents across every enterprise payment network.
---
Built with 🛡️ for InnovaHack.
