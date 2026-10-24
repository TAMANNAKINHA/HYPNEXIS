# Backend API (current, from src/routes). Base: http://localhost:5000

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/missions/create | body {text} -> {success, mission{...}} |
| POST | /api/missions/execute | body {missionId} |
| POST | /api/missions/cancel | body {missionId} |
| POST | /api/missions/freeze, /unfreeze, /nuke, /rotate-key | wallet controls |
| GET  | /api/missions/policies | policy profiles |
| POST | /api/missions/reset | reset demo state |
| POST | /api/missions/verify/otp, /verify/reject, /verify/approve | approvals |
| POST | /api/attacks/prompt-injection, /spam, /stolen-key | attack simulations |

WebSocket (socket.io) streams live events to the dashboard.
Rate limit: 100 requests / 15 min / IP on /api/.
Fixtures: add JSON request/response samples under tests/fixtures/ (TODO).
