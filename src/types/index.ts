// ==========================
// SHIELDS & SECURITY
// ==========================
export type ShieldId = 'missionGuard' | 'policyEngine' | 'riskEngine' | 'smartContract' | 'timeLock' | 'circuitBreaker';

export type ShieldStatus = 'idle' | 'processing' | 'success' | 'failure';

export interface ShieldState {
  id: ShieldId;
  label: string;
  status: ShieldStatus;
  lastCheck?: string;
}

// ==========================
// MISSION & POLICIES
// ==========================
export type VerificationLevel = 0 | 1 | 2 | 3;
export type MissionCategory = 'cloud' | 'saas' | 'travel' | 'payroll' | 'procurement' | 'marketing' | 'professional' | 'general';

export interface Mission {
  id: string;
  name: string;
  missionId: string;
  merchant: string;
  budget: number;
  spent: number;
  expiry: string;
  trustScore: number;
  status: 'created' | 'validating' | 'awaiting_otp' | 'awaiting_review' | 'executing' | 'completed' | 'failed' | 'frozen' | 'nuked' | 'cancelled';
  createdAt: number;
  userPrompt?: string;
  sessionKey: string;

  // New properties for Verification Engine
  category?: MissionCategory;
  policyId?: string;
  expectedOtp?: string;
  riskScore?: number;

  // Phase 2 optional fields
  walletAddress?: string;
  contractTxHash?: string;
  explorerUrl?: string;
}

export interface PolicyProfile {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rule?: string;
  category?: string;
  icon?: string;
  defaultBudget: number;
  dailyCeiling?: number;
  allowedVendors?: string[];
  verificationThresholds: {
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

// Alias for older components
export type Policy = PolicyProfile;

// ==========================
// LOGS & AUDIT
// ==========================
export interface TerminalLog {
  id: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error' | 'gold';
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'aegis';
  text: string;
  timestamp: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: number;
  hash: string;
  result: 'success' | 'blocked' | 'warning';
}

// ==========================
// ENTERPRISE & ACCOUNTS
// ==========================
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

// ==========================
// GLOBAL STATE (ZUSTAND)
// ==========================
export interface AegisState {
  // ✅ Changed to an array to support multiple missions
  missions: Mission[];
  shields: Record<ShieldId, ShieldState>;
  logs: TerminalLog[];
  chat: ChatMessage[];
  audit: AuditEntry[];

  activePolicy: PolicyProfile | null;
  policies: PolicyProfile[];

  walletStatus: 'empty' | 'active' | 'frozen' | 'nuked';
  trustScore: number;
  attackCount: number;
  blockedCount: number;
  bankAccounts: BankAccount[];
  profile: EnterpriseProfile;
  reserveBalance: number;
  allocatedBalance: number;
  consecutiveFailures: number;

  // UI & Processing States
  isProcessing?: boolean;
  isDemoComplete?: boolean;

  // NEW VERIFICATION PHASE 2 STATES
  verificationLevel?: number | string | null;
  verificationReason?: string | null;
  isAwaitingVerification?: boolean;
  otpCode?: string | null;
}