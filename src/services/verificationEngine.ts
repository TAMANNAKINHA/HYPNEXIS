import { Mission, PolicyProfile, VerificationLevel } from '../types';

import { Store } from '../store';

import { getDefaultPolicy } from '../constants/policyProfiles';



export class VerificationEngine {

 

  static determineLevel(

    mission: Mission,

    policy: PolicyProfile,

    riskScore: number

  ): { level: VerificationLevel; reason: string } {

    const amount = mission.budget;



    // Risk-based escalation (highest priority)

    if (riskScore > 80) return { level: 3, reason: `High risk (${riskScore}%) → Manual review required.` };

    if (riskScore > 70 && riskScore <= 80) return { level: 2, reason: `Moderate risk (${riskScore}%) → Phone notification activated.` };



    // Amount-based thresholds from policy

    if (amount >= policy.verificationThresholds.manual) return { level: 3, reason: `Amount ₹${amount} exceeds manual review threshold of ₹${policy.verificationThresholds.manual}.` };

    if (amount >= policy.verificationThresholds.phone) return { level: 2, reason: `Amount ₹${amount} exceeds phone notification threshold of ₹${policy.verificationThresholds.phone}.` };

    if (amount >= policy.verificationThresholds.otp) return { level: 1, reason: `Amount ₹${amount} exceeds OTP threshold of ₹${policy.verificationThresholds.otp}.` };



    return { level: 0, reason: 'Amount within auto-execute limits.' };

  }



  static verify(

    mission: Mission,

    policy: PolicyProfile | undefined | null,

    riskScore: number

  ): { level: VerificationLevel; reason: string } {

    // ✅ Safe casting to satisfy strict TypeScript type checking without modifying interfaces

    const activePolicy = policy || Store.getPolicyForCategory(mission.category as any) || getDefaultPolicy();

    return this.determineLevel(mission, activePolicy as PolicyProfile, riskScore);

  }

}



export const verificationEngine = {

  verify: VerificationEngine.verify.bind(VerificationEngine),

};



export default verificationEngine;