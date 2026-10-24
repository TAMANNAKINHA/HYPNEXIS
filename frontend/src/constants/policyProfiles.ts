// src/constants/policyProfiles.ts

export interface PolicyProfile {
  id: string;
  name: string;
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

export const POLICY_LIBRARY: PolicyProfile[] = [
  {
    id: 'cloud',
    name: 'Cloud Infrastructure',
    category: 'cloud',
    icon: '☁️',
    defaultBudget: 100000,
    dailyCeiling: 200000,
    allowedVendors: ['AWS India', 'Azure', 'GCP', 'DigitalOcean', 'Vercel'],
    verificationThresholds: {
      otp: 40000,
      phone: 75000,
      manual: 150000,
    },
    timelockSeconds: 60,
    expiryHours: 2,
    trustRequirement: 'medium',
    maxConsecutiveFailures: 3,
    fallback: 'manual_review',
    enabled: true,
  },
  {
    id: 'saas',
    name: 'AI & SaaS',
    category: 'saas',
    icon: '🤖',
    defaultBudget: 50000,
    dailyCeiling: 100000,
    allowedVendors: ['OpenAI', 'Anthropic', 'GitHub', 'Cursor', 'Notion', 'Slack', 'Figma'],
    verificationThresholds: {
      otp: 30000,
      phone: 60000,
      manual: 100000,
    },
    timelockSeconds: 60,
    expiryHours: 24,
    trustRequirement: 'medium',
    maxConsecutiveFailures: 3,
    fallback: 'manual_review',
    enabled: true,
  },
  {
    id: 'travel',
    name: 'Business Travel',
    category: 'travel',
    icon: '✈️',
    defaultBudget: 30000,
    dailyCeiling: 60000,
    allowedVendors: ['Uber', 'Airbnb', 'MakeMyTrip', 'IndiGo', 'Air India'],
    verificationThresholds: {
      otp: 15000,
      phone: 30000,
      manual: 50000,
    },
    timelockSeconds: 60,
    expiryHours: 24,
    trustRequirement: 'low',
    maxConsecutiveFailures: 3,
    fallback: 'manual_review',
    enabled: true,
  },
  {
    id: 'payroll',
    name: 'Payroll',
    category: 'payroll',
    icon: '👨‍💼',
    defaultBudget: 500000,
    dailyCeiling: 1000000,
    allowedVendors: ['Employees'],
    verificationThresholds: {
      otp: 200000,
      phone: 500000,
      manual: 1000000,
    },
    timelockSeconds: 60,
    expiryHours: 48,
    trustRequirement: 'high',
    maxConsecutiveFailures: 2,
    fallback: 'manual_review',
    enabled: true,
  },
  {
    id: 'procurement',
    name: 'Office Procurement',
    category: 'procurement',
    icon: '📦',
    defaultBudget: 20000,
    dailyCeiling: 50000,
    allowedVendors: ['Amazon Business', 'Staples', 'Office Depot'],
    verificationThresholds: {
      otp: 10000,
      phone: 25000,
      manual: 40000,
    },
    timelockSeconds: 60,
    expiryHours: 6,
    trustRequirement: 'low',
    maxConsecutiveFailures: 3,
    fallback: 'manual_review',
    enabled: true,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    category: 'marketing',
    icon: '📢',
    defaultBudget: 50000,
    dailyCeiling: 100000,
    allowedVendors: ['Google Ads', 'Meta', 'LinkedIn', 'Canva'],
    verificationThresholds: {
      otp: 20000,
      phone: 40000,
      manual: 70000,
    },
    timelockSeconds: 60,
    expiryHours: 24,
    trustRequirement: 'medium',
    maxConsecutiveFailures: 3,
    fallback: 'manual_review',
    enabled: true,
  },
  {
    id: 'professional',
    name: 'Professional Services',
    category: 'professional',
    icon: '💼',
    defaultBudget: 100000,
    dailyCeiling: 200000,
    allowedVendors: ['Legal', 'CA', 'Consultant'],
    verificationThresholds: {
      otp: 50000,
      phone: 100000,
      manual: 200000,
    },
    timelockSeconds: 60,
    expiryHours: 24,
    trustRequirement: 'medium',
    maxConsecutiveFailures: 3,
    fallback: 'manual_review',
    enabled: true,
  },
  {
    id: 'general',
    name: 'General',
    category: 'general',
    icon: '📄',
    defaultBudget: 10000,
    dailyCeiling: 20000,
    allowedVendors: [],
    verificationThresholds: {
      otp: 5000,
      phone: 10000,
      manual: 15000,
    },
    timelockSeconds: 60,
    expiryHours: 2,
    trustRequirement: 'high',
    maxConsecutiveFailures: 2,
    fallback: 'manual_review',
    enabled: true,
  },
];

export function getPolicyByCategory(category: string): PolicyProfile | undefined {
  if (!category) return undefined;
  const normalized = category.trim().toLowerCase();
  return POLICY_LIBRARY.find(p => p.category === normalized);
}

export function getDefaultPolicy(): PolicyProfile {
  return POLICY_LIBRARY.find(p => p.category === 'general')!;
}