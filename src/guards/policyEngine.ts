import { Store } from '../store';

export class PolicyEngine {
  /**
   * Verify transaction against mission’s policy.
   * @param amount        Requested transaction amount
   * @param maxBudget     Policy’s default (or custom) budget limit
   * @param merchant      Target merchant name
   * @param allowedVendors List of approved merchants for this mission
   */
  static async verify(
    amount: number,
    maxBudget: number,
    merchant: string,
    allowedVendors: string[]
  ): Promise<boolean> {
    Store.updateShield('policyEngine', 'processing');
    await new Promise(r => setTimeout(r, 600));

    // Check if the merchant is allowed
    if (!allowedVendors.includes(merchant)) {
      Store.updateShield('policyEngine', 'failure');
      Store.addLog(`Policy Violation: Merchant "${merchant}" not in allowlist.`, 'error');
      return false;
    }

    // Check budget against policy’s default budget (or per‑mission cap)
    if (amount > maxBudget) {
      Store.updateShield('policyEngine', 'failure');
      Store.addLog(
        `Policy Violation: Requested amount ₹${amount} exceeds policy budget of ₹${maxBudget}.`,
        'error'
      );
      return false;
    }

    Store.updateShield('policyEngine', 'success');
    Store.addLog('Policy Engine Passed: Merchant approved and amount within limits.', 'success');
    return true;
  }
}