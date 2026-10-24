export type ShieldStatus = 'idle' | 'processing' | 'success' | 'failure';

export type ShieldId =
  | 'missionGuard'
  | 'policyEngine'
  | 'riskEngine'
  | 'smartContract'
  | 'timeLock'
  | 'circuitBreaker';

export type MissionStatus =
  | 'idle'
  | 'created'
  | 'validating'
  | 'awaiting_otp'
  | 'awaiting_review'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'frozen'
  | 'nuked'
  | 'cancelled';

export type LogSeverity = 'info' | 'success' | 'warning' | 'error' | 'gold';

export type MissionCategory =
  | 'cloud'
  | 'saas'
  | 'travel'
  | 'payroll'
  | 'procurement'
  | 'marketing'
  | 'professional'
  | 'general';

export interface ChatMessage {
  id: string;
  role: 'user' | 'aegis';
  text: string;
  timestamp: number;
}

export interface TerminalLog {
  id: string;
  message: string;
  severity: LogSeverity;
  timestamp: number;
}

export interface ShieldState {
  id: ShieldId;
  label: string;
  status: ShieldStatus;
  description: string;
  lastCheck: string;
}

export interface Mission {
  id: string;
  name: string;
  missionId: string;
  merchant: string;
  budget: number;
  spent: number;
  expiry: string;
  trustScore: number;
  status: MissionStatus;
  createdAt: number;
  userPrompt?: string;
  sessionKey: string;
  category?: MissionCategory;
  policyId?: string;
  riskScore?: number;
  walletAddress?: string;
  contractTxHash?: string;
  explorerUrl?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: number;
  hash: string;
  result: 'success' | 'blocked' | 'warning';
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  rule?: string;
  category?: string;
  icon?: string;
  defaultBudget?: number;
  dailyCeiling?: number;
  allowedVendors?: string[];
  verificationThresholds?: {
    otp: number;
    phone: number;
    manual: number;
  };
  timelockSeconds?: number;
  expiryHours?: number;
  trustRequirement?: 'low' | 'medium' | 'high';
  maxConsecutiveFailures?: number;
  fallback?: 'manual_review' | 'reject';
}

export interface BankAccount {
  id: string;
  bank: string;
  label: string;
  last4: string;
  ifsc: string;
  balance: number;
  type: string;
  status: 'connected' | 'syncing' | 'error';
}

export interface EnterpriseProfile {
  owner: string;
  role: string;
  enterprise: string;
  plan: string;
  perMissionCap: number;
  dailyOutflowCeiling: number;
  dailySpent: number;
  highestSpend: number;
}

export interface VerificationState {
  active: boolean;
  missionId: string | null;
  level: 'otp' | 'phone' | 'manual' | 'resolved' | 'rejected' | null;
  message: string | null;
  otp?: string | null;               // ← added
}

export interface AegisState {
  missions: Mission[];
  selectedMissionId: string | null;
  shields: Record<ShieldId, ShieldState>;
  logs: TerminalLog[];
  chat: ChatMessage[];
  audit: AuditEntry[];
  policies: Policy[];
  walletStatus: 'empty' | 'active' | 'frozen' | 'nuked';
  attackCount: number;
  blockedCount: number;
  bankAccounts: BankAccount[];
  profile: EnterpriseProfile;
  reserveBalance: number;
  allocatedBalance: number;
  consecutiveFailures: number;
  timeLockRemaining?: number;
  verification: VerificationState;
}