import fs from 'fs';
import path from 'path';
import { formatUnits, parseUnits } from 'ethers';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'FROZEN' | 'EXPIRED' | 'FAILED';
export interface PaymentEvent { from: PaymentStatus | null; to: PaymentStatus; actor: string; at: string; reason?: string }
export interface Payment {
  id: string; requestId: string; idempotencyKey: string; missionId: string; recipient: string; amount: string;
  chainId: number; expiresAt: string; status: PaymentStatus; createdAt: string; updatedAt: string;
  actor: string; agentId?: string; txHash?: string; receipt?: unknown; failureReason?: string; events: PaymentEvent[];
  approval?: { actor: string; at: string; detailsHash: string; usedAt?: string };
}
interface Data { payments: Payment[]; frozenMissions: string[]; disabledAgents: Record<string, { actor: string; at: string; txHash?: string; result: string }>; }

const filename = path.resolve(process.env.PAYMENT_DB_PATH || './data/payments.json');
let data: Data = { payments: [], frozenMissions: [], disabledAgents: {} };
let writeChain: Promise<void> = Promise.resolve();
let healthy = true;
try { if (fs.existsSync(filename)) data = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (e) { throw new Error(`Cannot load payment database at ${filename}: ${String(e)}`); }

function persist(): Promise<void> {
  if (!healthy) return Promise.reject(new Error('Payment persistence is unhealthy; restart after repairing the payment database.'));
  const snapshot = JSON.stringify(data, null, 2);
  writeChain = writeChain.then(async () => {
    await fs.promises.mkdir(path.dirname(filename), { recursive: true });
    const temp = `${filename}.${process.pid}.tmp`;
    await fs.promises.writeFile(temp, snapshot, { mode: 0o600 });
    await fs.promises.rename(temp, filename);
  });
  writeChain = writeChain.catch(error => { healthy = false; throw error; });
  return writeChain;
}

export function assertPaymentStoreHealthy() { if (!healthy) throw Object.assign(new Error('Payment persistence is unhealthy; payment mutations are disabled.'), { status: 503 }); }

export const PaymentStore = {
  all: () => data.payments,
  get: (id: string) => data.payments.find(p => p.id === id),
  byIdempotency: (key: string) => data.payments.find(p => p.idempotencyKey === key),
  byRequest: (requestId: string) => data.payments.find(p => p.requestId === requestId),
  activeForMission: (missionId: string) => data.payments.filter(p => p.missionId === missionId && ['PENDING', 'APPROVED', 'SUBMITTED', 'FROZEN'].includes(p.status)),
  reservedForMission: (missionId: string) => formatUnits(data.payments.filter(p => p.missionId === missionId && ['APPROVED', 'SUBMITTED', 'FROZEN'].includes(p.status)).reduce((n, p) => n + parseUnits(p.amount, 18), 0n), 18),
  confirmedForMission: (missionId: string) => formatUnits(data.payments.filter(p => p.missionId === missionId && p.status === 'CONFIRMED').reduce((n, p) => n + parseUnits(p.amount, 18), 0n), 18),
  isMissionFrozen: (missionId: string) => data.frozenMissions.includes(missionId),
  isAgentDisabled: (id: string) => data.disabledAgents[id],
  setAgentDisabled: async (id: string, record: Data['disabledAgents'][string]) => { assertPaymentStoreHealthy(); data.disabledAgents[id] = record; await persist(); },
  freezeMission: async (missionId: string) => { assertPaymentStoreHealthy(); if (!data.frozenMissions.includes(missionId)) data.frozenMissions.push(missionId); await persist(); },
  unfreezeMission: async (missionId: string) => { assertPaymentStoreHealthy(); data.frozenMissions = data.frozenMissions.filter(id => id !== missionId); await persist(); },
  add: async (payment: Payment) => {
    assertPaymentStoreHealthy();
    if (data.payments.some(p => p.idempotencyKey === payment.idempotencyKey || p.requestId === payment.requestId)) throw Object.assign(new Error('Payment idempotency key or request ID already exists.'), { status: 409 });
    data.payments.push(payment); await persist(); return payment;
  },
  save: async (payment: Payment) => { assertPaymentStoreHealthy(); payment.updatedAt = new Date().toISOString(); await persist(); return payment; },
};

export function transition(payment: Payment, to: PaymentStatus, actor: string, reason?: string) {
  assertPaymentStoreHealthy();
  const allowed: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: ['APPROVED', 'REJECTED', 'FROZEN', 'EXPIRED'], APPROVED: ['SUBMITTED', 'REJECTED', 'FROZEN', 'EXPIRED', 'FAILED'],
    SUBMITTED: ['CONFIRMED', 'FAILED'], FROZEN: ['PENDING', 'REJECTED', 'EXPIRED'],
    CONFIRMED: [], REJECTED: [], EXPIRED: [], FAILED: [],
  };
  if (!allowed[payment.status].includes(to)) throw new Error(`Invalid payment transition ${payment.status} -> ${to}`);
  const from = payment.status; payment.status = to; payment.updatedAt = new Date().toISOString();
  if (reason) payment.failureReason = reason;
  payment.events.push({ from, to, actor, at: payment.updatedAt, reason });
}
