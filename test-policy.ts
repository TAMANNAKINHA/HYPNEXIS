// test-policy.ts

import { parseIntent } from './src/services/aiParser';
import { getPolicyByCategory } from './src/constants/policyProfiles';
import { VerificationEngine } from './src/services/verificationEngine';
import { RiskEscalation } from './src/services/riskEscalation';
import { Mission } from './src/types';

async function runTests() {
  console.log('🧪 Testing Policy Library & Verification Engine\n');

  // Test 1: Parse Intent (Category Detection)
  const samples = [
    'Buy AWS Server for ₹45,000',
    'Renew GitHub Subscription at ₹1,800',
    'Book IndiGo Flight for ₹22,000',
    'Pay salary to contractor ₹1,50,000',
    'Buy office chairs for ₹12,000',
    'Run Google Ads campaign ₹35,000',
    'Hire legal consultant ₹1,00,000',
    'Buy coffee for ₹500',
  ];

  for (const text of samples) {
    const parsed = await parseIntent(text);
    console.log(`📝 "${text}"`);
    console.log(`   → Merchant: ${parsed.merchant}, Budget: ${parsed.budget}, Category: ${parsed.category}\n`);
  }

  // Test 2: Policy Library
  const categories = ['cloud', 'saas', 'travel', 'payroll', 'procurement', 'marketing', 'professional', 'general'];
  console.log('📋 Policy Library:');
  for (const cat of categories) {
    const policy = getPolicyByCategory(cat);
    if (policy) {
      console.log(`  ${policy.icon} ${policy.name}: defaultBudget ₹${policy.defaultBudget}, OTP threshold ₹${policy.verificationThresholds.otp}, Phone threshold ₹${policy.verificationThresholds.phone}`);
    } else {
      console.log(`  ❌ No policy for category: ${cat}`);
    }
  }
  console.log('');

  // Test 3: Verification Engine (Cloud Policy)
  const cloudPolicy = getPolicyByCategory('cloud')!;
  const sampleMission: Partial<Mission> = {
    budget: 0,
    merchant: 'AWS India',
    trustScore: 85,
  };

  const testAmounts = [10000, 45000, 80000, 120000, 200000];
  console.log('🔐 Verification Engine (Cloud Policy):');
  for (const amount of testAmounts) {
    sampleMission.budget = amount;
    const result = VerificationEngine.determineLevel(
      sampleMission as Mission,
      cloudPolicy,
      20 // low risk
    );
    console.log(`  Amount ₹${amount} → Level ${result.level} (${result.reason})`);
  }
  console.log('');

  // Test 4: Risk Escalation
  console.log('⚠️ Risk Escalation (Cloud Policy, budget ₹45,000):');
  const riskScores = [10, 50, 75, 90];
  for (const risk of riskScores) {
    const result = RiskEscalation.adapt(
      { budget: 45000, merchant: 'AWS India', trustScore: 85 } as Mission,
      cloudPolicy,
      risk
    );
    console.log(`  Risk ${risk}% → Level ${result.level} (${result.reason})`);
  }
}

runTests().catch(console.error);