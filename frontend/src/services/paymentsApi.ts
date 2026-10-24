import type {
  AgentStatusResult, AgentSummary, CreatePaymentResult, KillResult, Payment, PaymentProposal, SimulationResult,
} from '../paymentTypes';
import { ApiError, newId } from './paymentLogic';

export { ApiError, friendlyError } from './paymentLogic';

const API_BASE: string = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
// The real backend is the default. Set VITE_USE_MOCK=true in .env to work offline with fake data.
export const USE_MOCK: boolean = import.meta.env?.VITE_USE_MOCK === 'true';

// ---- Access token (demo only): kept for this browser tab, never in the built code ----
const TOKEN_KEY = 'aegis_payment_token';
let memoryToken = '';
const store = (): Storage | null => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
};
export const getAccessToken = (): string => store()?.getItem(TOKEN_KEY) ?? memoryToken;
export const hasAccessToken = (): boolean => getAccessToken().length > 0;
export function setAccessToken(token: string): void {
  memoryToken = token;
  const s = store();
  if (!s) return;
  if (token) s.setItem(TOKEN_KEY, token); else s.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the backend.', 0);
  }
  const body = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg = (body?.message as string) || (body?.error as string) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, body?.violations as string[] | undefined);
  }
  return body as T;
}

const post = <T,>(path: string, data: unknown = {}) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data) });

export interface PaymentsApi {
  simulate(p: PaymentProposal): Promise<SimulationResult>;
  createPayment(p: PaymentProposal): Promise<CreatePaymentResult>;
  listPayments(): Promise<Payment[]>;
  approve(id: string): Promise<Payment>;
  reject(id: string, reason: string): Promise<Payment>;
  freeze(id: string, reason?: string): Promise<Payment>;
  unfreeze(id: string): Promise<Payment>;
  execute(id: string): Promise<Payment>;
  reconcile(id: string): Promise<Payment>;
  freezeMission(missionId: string): Promise<void>;
  unfreezeMission(missionId: string): Promise<void>;
  listAgents(): Promise<AgentSummary[]>;
  agentStatus(agentId: string): Promise<AgentStatusResult>;
  killAgent(agentId: string): Promise<KillResult>;
}

// ---------------- REAL BACKEND ----------------
const real: PaymentsApi = {
  simulate: (p) => post<SimulationResult>('/api/payments/simulate', p),
  createPayment: (p) => post<CreatePaymentResult>('/api/payments', p),
  listPayments: async () => (await request<{ payments: Payment[] }>('/api/payments')).payments,
  // Approval is bound to the exact payment details, so fetch the current hash first.
  approve: async (id) => {
    const current = await request<{ payment: Payment; detailsHash: string }>(`/api/payments/${id}`);
    return (await post<{ payment: Payment }>(`/api/payments/${id}/approve`, { detailsHash: current.detailsHash })).payment;
  },
  reject: async (id, reason) => (await post<{ payment: Payment }>(`/api/payments/${id}/reject`, { reason })).payment,
  freeze: async (id, reason) => (await post<{ payment: Payment }>(`/api/payments/${id}/freeze`, { reason })).payment,
  unfreeze: async (id) => (await post<{ payment: Payment }>(`/api/payments/${id}/unfreeze`)).payment,
  execute: async (id) => (await post<{ payment: Payment }>(`/api/payments/${id}/execute`)).payment,
  reconcile: async (id) => (await post<{ payment: Payment }>(`/api/payments/${id}/reconcile`)).payment,
  freezeMission: async (missionId) => { await post(`/api/payments/missions/${encodeURIComponent(missionId)}/freeze`); },
  unfreezeMission: async (missionId) => { await post(`/api/payments/missions/${encodeURIComponent(missionId)}/unfreeze`); },
  // PENDING: this route does not exist on the backend yet (not used outside demo mode). See usePaymentsData.
  listAgents: async () => (await request<{ agents: AgentSummary[] }>('/api/payments/agents')).agents,
  agentStatus: (agentId) => request<AgentStatusResult>(`/api/payments/agents/${encodeURIComponent(agentId)}/status`),
  killAgent: (agentId) => post<KillResult>(`/api/payments/agents/${encodeURIComponent(agentId)}/kill`),
};

// ---------------- MOCK (offline demo only; never touches a chain) ----------------
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const iso = (ms: number) => new Date(ms).toISOString();
const ADDR = '0x1111111111111111111111111111111111111111';
const mkPayment = (over: Partial<Payment>): Payment => ({
  id: newId('pay'), requestId: newId('req'), idempotencyKey: newId('idem'), missionId: 'm1', recipient: ADDR,
  amount: '2.0', chainId: 1337, expiresAt: iso(Date.now() + 3_600_000), status: 'PENDING',
  createdAt: iso(Date.now() - 600_000), updatedAt: iso(Date.now() - 600_000), actor: 'payment-operator',
  agentId: 'agent-1', events: [{ from: null, to: 'PENDING', actor: 'payment-operator', at: iso(Date.now() - 600_000) }], ...over,
});
let mockPayments: Payment[] = [
  mkPayment({}),
  mkPayment({ status: 'SUBMITTED', amount: '1.5', txHash: `0x${'a'.repeat(64)}` }),
  mkPayment({ status: 'CONFIRMED', amount: '0.75', txHash: `0x${'b'.repeat(64)}` }),
  mkPayment({ status: 'REJECTED', amount: '5.0', failureReason: 'Recipient not on allowlist' }),
];
const mockAgentsOff = new Set<string>();
const NEXT: Record<string, Payment['status'][]> = {
  PENDING: ['APPROVED', 'REJECTED', 'FROZEN'], APPROVED: ['REJECTED', 'FROZEN'], FROZEN: ['PENDING', 'REJECTED'],
};
async function move(id: string, to: Payment['status'], reason?: string): Promise<Payment> {
  await wait();
  const p = mockPayments.find((x) => x.id === id);
  if (!p) throw new ApiError('Payment not found', 404);
  if (!(NEXT[p.status] ?? []).includes(to)) throw new ApiError(`Invalid payment transition ${p.status} -> ${to}`, 409);
  const at = iso(Date.now());
  p.events.push({ from: p.status, to, actor: 'mock', at, reason });
  p.status = to; p.updatedAt = at; if (reason) p.failureReason = reason;
  return { ...p };
}
const mock: PaymentsApi = {
  async simulate(p) {
    await wait();
    const violations: string[] = [];
    if (Number(p.amount) > 18) violations.push('Mission budget would be exceeded');
    return { simulationId: newId('preview'), preview: true, canProceed: violations.length === 0, estimatedFee: null,
      remainingBudgetAfterPayment: String(Math.max(0, 18 - Number(p.amount))), warnings: ['Fee estimate unavailable; no chain simulation was run'],
      violations, broadcasted: false };
  },
  async createPayment(p) {
    await wait();
    const prior = mockPayments.find((x) => x.idempotencyKey === p.idempotencyKey);
    if (prior) return { payment: prior, duplicate: true };
    const payment = mkPayment({ ...p, status: 'PENDING', createdAt: iso(Date.now()), updatedAt: iso(Date.now()) });
    const similar = mockPayments.some((x) => x.recipient === p.recipient && x.amount === p.amount);
    mockPayments = [payment, ...mockPayments];
    return { payment, duplicate: false, warnings: similar ? ['A recent payment has the same mission, recipient, and amount; verify this is intentional.'] : [] };
  },
  async listPayments() { await wait(150); return mockPayments.map((p) => ({ ...p })); },
  approve: (id) => move(id, 'APPROVED', 'Exact payment details approved'),
  reject: (id, reason) => move(id, 'REJECTED', reason),
  freeze: (id, reason) => move(id, 'FROZEN', reason),
  unfreeze: (id) => move(id, 'PENDING', 'Payment unfrozen; approval required again'),
  async execute() { await wait(); throw new ApiError('Execution is disabled in demo mode.', 409); },
  async reconcile() { await wait(); throw new ApiError('No transaction hash is available for automatic chain reconciliation.', 409); },
  async freezeMission() { await wait(); },
  async unfreezeMission() { await wait(); },
  async listAgents() {
    await wait(150);
    const ids = [...new Set(mockPayments.map((p) => p.agentId).filter((x): x is string => !!x))];
    return ids.map((agentId) => ({ agentId, backendStatus: mockAgentsOff.has(agentId) ? 'disabled' as const : 'active' as const,
      paymentCount: mockPayments.filter((p) => p.agentId === agentId).length }));
  },
  async agentStatus(agentId) {
    await wait(150);
    return { agentId, backendStatus: mockAgentsOff.has(agentId) ? 'disabled' : 'active', onChainRevocation: { status: 'unknown_or_not_configured' } };
  },
  async killAgent(agentId) {
    await wait();
    mockAgentsOff.add(agentId);
    return { agentId, backendStatus: 'disabled', onChainRevocation: { status: 'not_performed', reason: 'No compatible revocation adapter is configured.' },
      inFlight: mockPayments.filter((p) => p.agentId === agentId && p.status === 'SUBMITTED').map((p) => ({ paymentId: p.id, transactionHash: p.txHash, status: p.status })) };
  },
};

export const paymentsApi: PaymentsApi = USE_MOCK ? mock : real;
export const realPaymentsApi = real;
