// Pure helpers (no React, no network) so they can be unit-tested.
import type { AgentSummary, Payment, PaymentAction, PaymentStatus } from '../paymentTypes';

export class ApiError extends Error {
  status?: number;
  violations?: string[];
  constructor(message: string, status?: number, violations?: string[]) {
    super(message);
    this.status = status;
    this.violations = violations;
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Cannot reach the backend. Check that it is running, then try again.';
    if (e.status === 401) return 'Access token missing or invalid. Enter a valid token above.';
    if (e.status === 403) return 'Your token is not allowed to do that (or the agent is disabled).';
    if (e.status === 410) return 'This payment has expired. Create a new payment request.';
    if (e.status === 429) return 'Too many requests. Wait a few minutes and try again.';
    if (e.status === 503) return `Backend unavailable: ${e.message}`;
    if (e.violations?.length) return `${e.message}`;
    return e.message;
  }
  if (e instanceof Error) {
    if (/failed to fetch|load failed|networkerror/i.test(e.message)) {
      return 'Cannot reach the backend. Check that it is running, then try again.';
    }
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

export const isEvmAddress = (s: string): boolean =>
  /^0x[0-9a-fA-F]{40}$/.test(s) && !/^0x0{40}$/i.test(s);

export const isValidAmount = (s: string): boolean =>
  /^\d+(\.\d{1,18})?$/.test(s) && Number(s) > 0;

export function newId(prefix: string): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const rand = c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${rand}`;
}

export const expiryInMinutes = (minutes: number, now: number = Date.now()): string =>
  new Date(now + minutes * 60_000).toISOString();

/** Format checks only. The backend remains the authority on every policy decision. */
export function formatErrors(input: {
  missionId: string; agentId: string; recipient: string; amount: string; chainId: string;
}): string[] {
  const errors: string[] = [];
  if (!input.missionId) errors.push('Choose a mission wallet.');
  if (!input.agentId.trim()) errors.push('Enter the agent ID.');
  if (!isEvmAddress(input.recipient.trim())) errors.push('Recipient must be a valid 0x address (42 characters, not all zeros).');
  if (!isValidAmount(input.amount.trim())) errors.push('Amount must be a positive number with at most 18 decimals.');
  if (!/^[1-9]\d*$/.test(input.chainId.trim())) errors.push('Chain ID must be a positive whole number.');
  return errors;
}

export const MISSION_MERCHANTS = [
  'AWS', 'GitHub', 'OpenAI', 'Anthropic', 'Vercel', 'Notion', 'IndiGo', 'Amazon Business', 'Google Ads',
] as const;

/** The backend parses a sentence, so the form builds one. No free text: other words could change the detected merchant. */
export function buildMissionPrompt(merchant: string, budget: number): string {
  return `Pay ${merchant} up to ₹${Math.round(budget).toLocaleString('en-IN')}`;
}

/** Which actions the backend allows for each status (mirrors its transition table). */
export function allowedActions(status: PaymentStatus): PaymentAction[] {
  switch (status) {
    case 'PENDING': return ['approve', 'reject', 'freeze'];
    case 'APPROVED': return ['execute', 'reject', 'freeze'];
    case 'FROZEN': return ['unfreeze', 'reject'];
    case 'SUBMITTED': return ['reconcile'];
    default: return [];
  }
}

export function filterPayments(
  payments: Payment[],
  f: { status?: PaymentStatus | ''; missionId?: string; from?: string },
): Payment[] {
  const fromMs = f.from ? new Date(f.from).getTime() : null;
  return payments.filter((p) =>
    (!f.status || p.status === f.status) &&
    (!f.missionId || p.missionId === f.missionId) &&
    (fromMs === null || Date.parse(p.createdAt) >= fromMs));
}

export const latestReason = (p: Payment): string => {
  const last = p.events?.[p.events.length - 1];
  return p.failureReason || last?.reason || '';
};

/** The backend has no agent-list route yet, so list the agents that appear in payments. Status stays 'unknown' until checked. */
export function agentsFromPayments(payments: Payment[]): AgentSummary[] {
  const counts = new Map<string, number>();
  for (const p of payments) if (p.agentId) counts.set(p.agentId, (counts.get(p.agentId) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([agentId, paymentCount]) => ({ agentId, backendStatus: 'unknown' as const, paymentCount }));
}

export const shortHash = (h: string): string => (h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

export type SessionState = 'Active' | 'Expired' | 'Frozen' | 'Revoked' | 'Cancelled' | 'Completed' | 'Pending';

export function sessionState(m: { status: string; expiry: string }, now: number = Date.now()): SessionState {
  if (m.status === 'nuked') return 'Revoked';
  if (m.status === 'cancelled') return 'Cancelled';
  if (m.status === 'frozen') return 'Frozen';
  if (Date.parse(m.expiry) <= now) return 'Expired';
  if (m.status === 'completed') return 'Completed';
  if (['created', 'validating', 'awaiting_otp', 'awaiting_review'].includes(m.status)) return 'Pending';
  return 'Active';
}
