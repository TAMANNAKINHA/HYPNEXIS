// Shapes returned by Person 2's backend (see backend API_CONTRACT.md). Timestamps are ISO strings.
export type PaymentStatus =
  | 'PENDING' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMED'
  | 'REJECTED' | 'FROZEN' | 'EXPIRED' | 'FAILED';

export const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  'PENDING', 'APPROVED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REJECTED', 'FROZEN', 'EXPIRED',
];

export interface PaymentEvent {
  from: PaymentStatus | null;
  to: PaymentStatus;
  actor: string;
  at: string;
  reason?: string;
}

export interface Payment {
  id: string;
  requestId: string;
  idempotencyKey: string;
  missionId: string;
  recipient: string;
  amount: string; // decimal string, never a float
  chainId: number;
  expiresAt: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  actor: string;
  agentId?: string;
  txHash?: string;
  failureReason?: string; // also used by the backend for approval/rejection reasons
  events: PaymentEvent[];
  approval?: { actor: string; at: string; detailsHash: string; usedAt?: string };
}

export interface PaymentProposal {
  missionId: string;
  recipient: string;
  amount: string;
  chainId: number;
  expiresAt: string;
  requestId: string;
  idempotencyKey: string;
  agentId: string;
}

export interface SimulationResult {
  simulationId: string;
  preview: boolean;
  canProceed: boolean;
  estimatedFee: string | null;
  remainingBudgetAfterPayment: string | null;
  warnings: string[];
  violations: string[];
  broadcasted: boolean;
}

export interface CreatePaymentResult {
  payment: Payment;
  duplicate: boolean;
  warnings?: string[];
  detailsHash?: string;
}

// UI badge states for agents. The backend only reports active/disabled.
export type AgentStatus = 'ACTIVE' | 'REVOCATION_PENDING' | 'DISABLED' | 'ERROR' | 'UNKNOWN';

export interface AgentSummary {
  agentId: string;
  // 'unknown' = built from the payment list; the backend has no agent-list route yet, so status is only known after "Check status".
  backendStatus: 'active' | 'disabled' | 'unknown';
  paymentCount: number;
}

export interface KillResult {
  agentId: string;
  backendStatus: 'active' | 'disabled';
  onChainRevocation: { status: string; reason?: string };
  inFlight: { paymentId: string; transactionHash?: string; status: PaymentStatus }[];
}

export interface AgentStatusResult {
  agentId: string;
  backendStatus: 'active' | 'disabled';
  onChainRevocation: { status: string; reason?: string };
}

export type PaymentAction = 'approve' | 'reject' | 'freeze' | 'unfreeze' | 'execute' | 'reconcile';
