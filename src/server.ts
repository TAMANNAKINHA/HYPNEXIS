import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { TerminalLogger } from './services/terminalLogger';
import { Store } from './store';
import missionRoutes from './routes/missionRoutes';
import attackRoutes from './routes/attackRoutes';
import paymentRoutes from './routes/paymentRoutes';

const app = express();

// CORS – FRONTEND_URL may hold several origins, comma-separated. Vite serves on
// localhost or 127.0.0.1 depending on how it is opened, so list both if you use both.
// Falls back to * for local dev when unset.
const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);
const corsOrigin = allowedOrigins.length ? allowedOrigins : '*';
app.use(cors({ origin: corsOrigin }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'aegis-backend' }));

// Rate limiting – default 100 requests per 15 minutes per IP (RATE_LIMIT_MAX to change)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

app.use(express.json({ limit: '32kb' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin } });

TerminalLogger.initialize(io, () => Store.getPublicState());

app.use('/api/missions', missionRoutes);
app.use('/api/attacks', attackRoutes);
app.use('/api/payments', paymentRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`AEGIS demo backend running on port ${PORT}`);
});
