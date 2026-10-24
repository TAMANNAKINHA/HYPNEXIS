import { Store } from '../store';

export class CircuitBreaker {
  static async checkAndTrigger(missionId: string): Promise<boolean> {
    const state = Store.getState();
    const mission = Store.getMission(missionId);

    // Determine the max allowed failures from the mission’s policy
    const policy = Store.getCurrentPolicy(missionId) || Store.getDefaultPolicy();
    const maxFailures = policy?.maxConsecutiveFailures ?? 2;

    if ((state.consecutiveFailures || 0) >= maxFailures) {
      Store.updateShield('circuitBreaker', 'processing');
      await new Promise(r => setTimeout(r, 400));
      Store.updateShield('circuitBreaker', 'failure');
      Store.addLog(`CIRCUIT BREAKER TRIPPED: ${state.consecutiveFailures} consecutive failures (limit: ${maxFailures}). Freezing wallet.`, 'error');

      if (mission) {
        Store.freezeWallet(missionId);
      }

      return true;
    }

    Store.updateShield('circuitBreaker', 'success');
    return false;
  }
}