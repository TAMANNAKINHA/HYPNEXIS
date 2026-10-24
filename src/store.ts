import { AegisState, Mission, ShieldId, ShieldStatus, TerminalLog, ChatMessage, AuditEntry, PolicyProfile, MissionCategory } from './types';
import { TerminalLogger } from './services/terminalLogger';
import { POLICY_LIBRARY, getDefaultPolicy } from './constants/policyProfiles';

// Policy list as sent to the dashboard. The dashboard's Policy Engine modal shows a one-line
// `rule`, so it is derived here from the real policy fields.
function serializePolicy(p: PolicyProfile): PolicyProfile {
  const vendors = (p.allowedVendors || []).join(', ');
  return { ...p, rule: `budget <= ${p.defaultBudget} AND merchant IN (${vendors})` };
}
const freshPolicies = (): PolicyProfile[] => POLICY_LIBRARY.map(p => ({ ...p }));

export class Store {
  private static state: Partial<AegisState> = {
    missions: [],
    policies: freshPolicies(),
    walletStatus: 'empty',
    trustScore: 98,
    attackCount: 0,
    blockedCount: 0,
    consecutiveFailures: 0,
    reserveBalance: 1000000,
    allocatedBalance: 0,
    profile: {
      owner: 'Rajesh Sharma',
      role: 'Chief Financial Officer',
      enterprise: 'Apex Labs India Pvt Ltd',
      plan: 'Enterprise Sovereign',
      perMissionCap: 100000,
      dailyOutflowCeiling: 300000,
      dailySpent: 0,
      highestSpend: 0,
    },
  };

  static getState() {
    return this.state;
  }

  static getPublicState() {
    return {
      ...this.state,
      missions: (this.state.missions || []).map(({ sessionKey: _sessionKey, ...mission }) => mission),
      policies: this.getPublicPolicies(),
    };
  }

  static getMission(id: string): Mission | undefined {
    return this.state.missions?.find((m: Mission) => m.id === id);
  }

  static getAllMissions(): Mission[] {
    return this.state.missions || [];
  }

  static getPublicPolicies(): PolicyProfile[] {
    return (this.state.policies || []).map(serializePolicy);
  }

  // A disabled policy is not applied: callers fall back to the default (general) policy.
  static getPolicyForCategory(category: MissionCategory): PolicyProfile | undefined {
    return (this.state.policies || []).find(p => p.category === category && p.enabled);
  }

  static togglePolicy(policyId: string): PolicyProfile | undefined {
    const policy = (this.state.policies || []).find(p => p.id === policyId);
    if (!policy) return undefined;
    policy.enabled = !policy.enabled;
    TerminalLogger.broadcast('policy_update', { policies: this.getPublicPolicies() });
    return policy;
  }

  static getDefaultPolicy(): PolicyProfile {
    return getDefaultPolicy();
  }

  static getCurrentPolicy(missionId?: string): PolicyProfile | undefined {
    if (!missionId) return undefined;
    const mission = this.getMission(missionId);
    if (!mission || !mission.category) return undefined;
    return this.getPolicyForCategory(mission.category);
  }

  static updateMission(mission: Mission) {
    if (!this.state.missions) this.state.missions = [];
    const idx = this.state.missions.findIndex((m: Mission) => m.id === mission.id);
    if (idx >= 0) {
      this.state.missions[idx] = { ...this.state.missions[idx], ...mission };
    } else {
      this.state.missions.push(mission);
      if (mission.status === 'created') {
        this.state.allocatedBalance = (this.state.allocatedBalance || 0) + mission.budget;
        this.state.reserveBalance = (this.state.reserveBalance || 1000000) - mission.budget;
        TerminalLogger.broadcast('balance_update', { reserveBalance: this.state.reserveBalance, allocatedBalance: this.state.allocatedBalance });
      }
    }

    const activeMissions = this.state.missions.filter(
      (m: Mission) => !['completed', 'failed', 'nuked', 'cancelled'].includes(m.status)
    );
    if (activeMissions.length === 0) {
      this.state.walletStatus = 'empty';
    } else if (activeMissions.some((m: Mission) => m.status === 'frozen')) {
      this.state.walletStatus = 'frozen';
    } else {
      this.state.walletStatus = 'active';
    }

    const { sessionKey: _sessionKey, ...publicMission } = mission;
    TerminalLogger.broadcast('mission_update', { mission: publicMission });
    TerminalLogger.broadcast('wallet_status', { status: this.state.walletStatus });
    TerminalLogger.broadcast('missions_list', { missions: this.getPublicState().missions });
  }

  static refundMission(missionId: string) {
    const mission = this.getMission(missionId);
    if (mission && ['created', 'validating', 'awaiting_otp', 'awaiting_review', 'executing', 'frozen'].includes(mission.status)) {
      this.state.reserveBalance = (this.state.reserveBalance || 0) + mission.budget;
      this.state.allocatedBalance = Math.max(0, (this.state.allocatedBalance || 0) - mission.budget);
      TerminalLogger.broadcast('balance_update', { reserveBalance: this.state.reserveBalance, allocatedBalance: this.state.allocatedBalance });
    }
  }

  static updateProfileStats(amountSpent: number) {
    if (this.state.profile) {
      this.state.profile.dailySpent += amountSpent;
      if (amountSpent > this.state.profile.highestSpend) {
        this.state.profile.highestSpend = amountSpent;
      }
      this.state.allocatedBalance = Math.max(0, (this.state.allocatedBalance || 0) - amountSpent);
      TerminalLogger.broadcast('profile_update', this.state.profile);
      TerminalLogger.broadcast('balance_update', { reserveBalance: this.state.reserveBalance, allocatedBalance: this.state.allocatedBalance });
    }
  }

  static updateShield(id: ShieldId, status: ShieldStatus) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    TerminalLogger.broadcast('shield_update', { id, status, lastCheck: time });
  }

  static setAllShieldsToSuccess() {
    const shieldOrder: ShieldId[] = ['missionGuard', 'policyEngine', 'riskEngine', 'smartContract', 'timeLock', 'circuitBreaker'];
    shieldOrder.forEach(id => this.updateShield(id, 'success'));
  }

  static addLog(message: string, severity: 'info' | 'success' | 'warning' | 'error' | 'gold') {
    const log: TerminalLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      message,
      severity,
      timestamp: Date.now(),
    };
    TerminalLogger.broadcast('log', log);
  }

  static addChat(role: 'user' | 'aegis', text: string) {
    const chat: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      role,
      text,
      timestamp: Date.now(),
    };
    TerminalLogger.broadcast('chat', chat);
  }

  static addAudit(action: string, actor: string, hash: string, result: 'success' | 'blocked' | 'warning') {
    const audit: AuditEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      action,
      actor,
      hash,
      result,
      timestamp: Date.now(),
    };
    TerminalLogger.broadcast('audit', audit);
  }

  static updateTrust(modifier: number) {
    this.state.trustScore = Math.max(0, Math.min(100, (this.state.trustScore || 100) + modifier));
    TerminalLogger.broadcast('trust_update', { trustScore: this.state.trustScore });
  }

  static incrementFailure() {
    this.state.consecutiveFailures = (this.state.consecutiveFailures || 0) + 1;
    this.state.blockedCount = (this.state.blockedCount || 0) + 1;
    this.state.attackCount = (this.state.attackCount || 0) + 1;
    TerminalLogger.broadcast('attack_stats', {
      attackCount: this.state.attackCount,
      blockedCount: this.state.blockedCount,
    });
  }

  static resetFailures() {
    this.state.consecutiveFailures = 0;
  }

  static freezeWallet(missionId: string) {
    const mission = this.getMission(missionId);
    if (mission) {
      mission.status = 'frozen';
      this.updateMission(mission);
    }
    this._updateWalletStatusFromMissions();
  }

  static unfreezeWallet(missionId: string) {
    const mission = this.getMission(missionId);
    if (mission) {
      // Reset the failure counter so a fresh attack can again cause a visible breach
      this.resetFailures();
      mission.status = 'executing';
      this.updateMission(mission);
      // Set all shields to success (green) to signal full recovery
      this.setAllShieldsToSuccess();
    }
    this._updateWalletStatusFromMissions();
  }

  static nukeWallet(missionId: string) {
    const mission = this.getMission(missionId);
    if (mission) {
      this.refundMission(missionId);
      mission.status = 'nuked';
      this.updateMission(mission);
    }
    this._updateWalletStatusFromMissions();
  }

  private static _updateWalletStatusFromMissions() {
    const activeMissions = (this.state.missions || []).filter(
      (m: Mission) => !['completed', 'failed', 'nuked', 'cancelled'].includes(m.status)
    );
    if (activeMissions.length === 0) {
      this.state.walletStatus = 'empty';
    } else if (activeMissions.some((m: Mission) => m.status === 'frozen')) {
      this.state.walletStatus = 'frozen';
    } else {
      this.state.walletStatus = 'active';
    }
    TerminalLogger.broadcast('wallet_status', { status: this.state.walletStatus });
  }

  static resetDemoState() {
    this.state = {
      missions: [],
      policies: freshPolicies(),
      walletStatus: 'empty',
      trustScore: 98,
      attackCount: 0,
      blockedCount: 0,
      consecutiveFailures: 0,
      reserveBalance: 1000000,
      allocatedBalance: 0,
      logs: [],
      audit: [],
      chat: [
        {
          id: `msg_${Date.now()}`,
          role: 'aegis',
          text: 'AEGIS demo reset. Issue a mission instruction to provision a Mission Wallet.',
          timestamp: Date.now(),
        },
      ],
      profile: {
        owner: 'Rajesh Sharma',
        role: 'Chief Financial Officer',
        enterprise: 'Apex Labs India Pvt Ltd',
        plan: 'Enterprise Sovereign',
        perMissionCap: 100000,
        dailyOutflowCeiling: 300000,
        dailySpent: 0,
        highestSpend: 0,
      },
    };
    TerminalLogger.broadcast('state_reset', this.getPublicState());
    TerminalLogger.broadcast('balance_update', { reserveBalance: 1000000, allocatedBalance: 0 });
    TerminalLogger.broadcast('profile_update', this.state.profile);
    TerminalLogger.broadcast('wallet_status', { status: 'empty' });
    TerminalLogger.broadcast('missions_list', { missions: [] });
    this.addLog('✨ Demo environment completely purged and reset to initial sovereign state.', 'success');
  }
}
