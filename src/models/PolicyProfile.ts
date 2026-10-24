// src/models/PolicyProfile.ts

export type VerificationLevel = 0 | 1 | 2 | 3;

export interface PolicyProfile {
  id: string;
  name: string;
  description: string; // ✅ Ensured required to match type definitions
  category: string;
  icon: string;
  defaultBudget: number;
  dailyCeiling: number;
  allowedVendors: string[];
  verificationThresholds: {
    otp: number;
    phone: number;
    manual: number;
  };
  timelockSeconds: number;
  expiryHours: number;
  trustRequirement: 'low' | 'medium' | 'high';
  maxConsecutiveFailures: number;
  fallback: 'manual_review' | 'reject';
  enabled: boolean;
}