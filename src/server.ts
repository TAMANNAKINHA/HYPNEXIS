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

const app = express();

// CORS – use FRONTEND_URL from env, or fallback to * for local dev
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Rate limiting – 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_URL || '*' } });

TerminalLogger.initialize(io, () => Store.getState());

app.use('/api/missions', missionRoutes);
app.use('/api/attacks', attackRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`AEGIS Backend Engine running on port ${PORT}`);
});