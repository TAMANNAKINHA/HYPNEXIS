// src/state.ts

import type {
  AegisState,
  ShieldId,
  ShieldState,
  Policy,
  AuditEntry,
  TerminalLog,
  LogSeverity,
  Mission,
  BankAccount,
  EnterpriseProfile,
  ChatMessage,
  VerificationState,
} from '@/types';

let idCounter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${idCounter++}`;

export const SHIELD_ORDER: ShieldId[] = [
  'missionGuard',
  'policyEngine',
  'riskEngine',
  'smartContract',
  'timeLock',
  'circuitBreaker',
];

export const SHIELD_META: Record<
  ShieldId,
  { label: string; description: string }
> = {
  missionGuard: {
    label: 'Mission Guard',
    description: 'Validates mission intent against authorized scope.',
  },
  policyEngine: {
    label: 'Policy Engine',
    description: 'Enforces spending limits, merchant allowlists & rules.',
  },
  riskEngine: {
    label: 'Risk Engine',
    description: 'Scores transaction risk using behavioral models.',
  },
  smartContract: {
    label: 'Smart Contract',
    description: 'On-chain escrow enforcing budget & expiry constraints.',
  },
  timeLock: {
    label: 'Time Lock',
    description: 'Delay window before any irreversible action executes.',
  },
  circuitBreaker: {
    label: 'Circuit Breaker',
    description: 'Halts all activity when anomaly threshold is breached.',
  },
};

// Policies are owned by the backend (sent in `state_init` / `policy_update`); nothing is hard-coded here.
const DEFAULT_PROFILE: EnterpriseProfile = {
  owner: 'Rajesh Sharma',
  role: 'Chief Financial Officer',
  enterprise: 'Apex Labs India Pvt Ltd',
  plan: 'Enterprise Sovereign',
  perMissionCap: 100000,
  dailyOutflowCeiling: 300000,
  dailySpent: 0,          // ✅ reset to zero
  highestSpend: 0,
};

const DEFAULT_BANKS: BankAccount[] = [
  {
    id: 'b1',
    bank: 'HDFC Corporate Banking',
    label: 'Operating Account',
    last4: '8842',
    ifsc: 'HDFC0008842',
    balance: 600000,
    type: 'Corporate Current',
    status: 'connected',
  },
  {
    id: 'b2',
    bank: 'ICICI Commercial Bank',
    label: 'Reserve Treasury',
    last4: '1190',
    ifsc: 'ICIC0001190',
    balance: 400000,
    type: 'Sweep / Treasury',
    status: 'connected',
  },
];

function makeShields(): Record<ShieldId, ShieldState> {
  const out = {} as Record<ShieldId, ShieldState>;
  for (const id of SHIELD_ORDER) {
    out[id] = {
      id,
      label: SHIELD_META[id].label,
      description: SHIELD_META[id].description,
      status: 'idle',
      lastCheck: '—',
    };
  }
  return out;
}

export function initialState(): AegisState {
  return {
    missions: [],
    shields: makeShields(),
    logs: [],
    chat: [
      {
        id: uid('msg'),
        role: 'aegis',
        text: 'AEGIS online. Issue a mission instruction to provision a Mission Wallet. Try "Buy AWS Server for ₹45,000".',
        timestamp: Date.now(),
      },
    ],
    audit: [],
    policies: [],
    walletStatus: 'empty',
    attackCount: 0,
    blockedCount: 0,
    consecutiveFailures: 0,
    bankAccounts: DEFAULT_BANKS,
    profile: DEFAULT_PROFILE,
    reserveBalance: 1000000,
    allocatedBalance: 0,
    timeLockRemaining: 0,
    verification: { active: false, missionId: null, level: null, message: null },
    selectedMissionId: null,
  };
}

export type Action =
  | { type: 'INIT_STATE'; payload: Partial<AegisState> }
  | { type: 'RESET' }
  | { type: 'ADD_LOG'; payload: { message: string; severity: LogSeverity; timestamp?: number } }
  | { type: 'ADD_CHAT'; payload: { role: 'user' | 'aegis'; text: string; timestamp?: number } }
  | { type: 'UPDATE_SHIELD'; payload: { id: ShieldId; status: ShieldState['status']; lastCheck?: string } }
  | { type: 'SET_MISSION'; payload: Mission }
  | { type: 'SET_MISSIONS'; payload: Mission[] }
  | { type: 'REMOVE_MISSION'; payload: string }
  | { type: 'SET_WALLET_STATUS'; payload: AegisState['walletStatus'] }
  | { type: 'ADD_AUDIT'; payload: AuditEntry }
  | { type: 'UPDATE_ATTACK_STATS'; payload: { attackCount: number; blockedCount: number } }
  | { type: 'UPDATE_POLICIES'; payload: Policy[] }
  | { type: 'UPDATE_BALANCES'; payload: { reserveBalance: number; allocatedBalance: number } }
  | { type: 'UPDATE_PROFILE'; payload: EnterpriseProfile }
  | { type: 'UPDATE_MISSION'; payload: { id: string; changes: Partial<Mission> } }
  | { type: 'UPDATE_TIMELOCK'; payload: number }
  | { type: 'SELECT_MISSION'; payload: string | null }
  | { type: 'SET_VERIFICATION'; payload: { missionId: string; level: string; message: string; otp?: string } }
  | { type: 'CLEAR_VERIFICATION' };

export function reducer(state: AegisState, action: Action): AegisState {
  switch (action.type) {
    case 'INIT_STATE':
      return {
        ...initialState(),
        ...action.payload,
        missions: action.payload.missions || [],
        selectedMissionId: action.payload.selectedMissionId || null,
        verification: action.payload.verification || initialState().verification,
      };

    case 'RESET':
      return initialState();

    case 'ADD_LOG': {
      const currentLogs = Array.isArray(state.logs) ? state.logs : [];
      const log: TerminalLog = {
        id: uid('log'),
        message: action.payload.message,
        severity: action.payload.severity,
        timestamp: action.payload.timestamp || Date.now(),
      };
      return { ...state, logs: [...currentLogs, log].slice(-200) };
    }

    case 'ADD_CHAT': {
      const currentChat = Array.isArray(state.chat) ? state.chat : [];
      const msg: ChatMessage = {
        id: uid('msg'),
        role: action.payload.role,
        text: action.payload.text,
        timestamp: action.payload.timestamp || Date.now(),
      };
      return { ...state, chat: [...currentChat, msg] };
    }

    case 'UPDATE_SHIELD': {
      const { id, status, lastCheck } = action.payload;
      const shields = state.shields || makeShields();
      return {
        ...state,
        shields: {
          ...shields,
          [id]: {
            ...(shields[id] || { id, label: id, description: '', status: 'idle', lastCheck: '—' }),
            status,
            lastCheck: lastCheck || shields[id]?.lastCheck || '—',
          },
        },
      };
    }

    case 'SET_MISSION': {
      const existing = state.missions.find(m => m.id === action.payload.id);
      const missions = existing
        ? state.missions.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m)
        : [...state.missions, action.payload];
      return { ...state, missions };
    }

    case 'SET_MISSIONS':
      return { ...state, missions: action.payload };

    case 'REMOVE_MISSION':
      return { ...state, missions: state.missions.filter(m => m.id !== action.payload) };

    case 'SET_WALLET_STATUS':
      return { ...state, walletStatus: action.payload };

    case 'ADD_AUDIT': {
      const currentAudit = Array.isArray(state.audit) ? state.audit : [];
      return { ...state, audit: [action.payload, ...currentAudit].slice(0, 100) };
    }

    case 'UPDATE_ATTACK_STATS':
      return { ...state, attackCount: action.payload.attackCount, blockedCount: action.payload.blockedCount };

    case 'UPDATE_POLICIES':
      return { ...state, policies: action.payload };

    case 'UPDATE_BALANCES':
      return { ...state, reserveBalance: action.payload.reserveBalance, allocatedBalance: action.payload.allocatedBalance };

    case 'UPDATE_PROFILE':
      return { ...state, profile: action.payload };

    case 'UPDATE_MISSION': {
      const missions = state.missions.map(m =>
        m.id === action.payload.id ? { ...m, ...action.payload.changes } : m
      );
      return { ...state, missions };
    }

    case 'UPDATE_TIMELOCK':
      return { ...state, timeLockRemaining: action.payload };

    case 'SELECT_MISSION':
      return { ...state, selectedMissionId: action.payload };

   case 'SET_VERIFICATION': {
  const isClosingEvent = ['resolved', 'rejected'].includes(action.payload.level);
  return {
    ...state,
    verification: {
      active: !isClosingEvent,
      missionId: action.payload.missionId,
      level: action.payload.level as VerificationState['level'],
      message: action.payload.message,
      otp: action.payload.otp || null,
    },
  };
}

    case 'CLEAR_VERIFICATION':
      return { ...state, verification: { active: false, missionId: null, level: null, message: null } };

    default:
      return state;
  }
}