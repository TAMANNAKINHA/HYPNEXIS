// src/services/riskEscalation.ts

import { Mission, PolicyProfile, VerificationLevel } from '../types';
import { VerificationEngine } from './verificationEngine';

export class RiskEscalation {
  static adapt(
    mission: Mission,
    policy: PolicyProfile,
    riskScore: number
  ): { level: VerificationLevel; reason: string } {
    // If riskScore is high, escalate regardless of original level
    if (riskScore > 70 && riskScore <= 80) {
      return { level: 2, reason: `Moderate risk (${riskScore}%) → Phone notification activated.` };
    }
    if (riskScore > 80) {
      return { level: 3, reason: `High risk (${riskScore}%) → Manual review required.` };
    }

    // Otherwise, use the default verification
    const defaultLevel = VerificationEngine.determineLevel(mission, policy, riskScore);
    return defaultLevel;
  }
}