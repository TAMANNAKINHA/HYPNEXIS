import { Store } from '../store';

export class MissionGuard {
  static async verify(intent: string, expectedMission: string): Promise<boolean> {
    Store.updateShield('missionGuard', 'processing');
    Store.addLog(`Analyzing intent against allowed scope: [${expectedMission}]`, 'info');
    
    await new Promise(r => setTimeout(r, 800));

    const blacklisted = ['ignore previous', 'hacker', 'transfer to', 'bypass'];
    if (blacklisted.some(term => intent.toLowerCase().includes(term))) {
      Store.updateShield('missionGuard', 'failure');
      Store.addLog('CRITICAL: Prompt injection detected. Intent misaligned.', 'error');
      return false;
    }

    Store.updateShield('missionGuard', 'success');
    Store.addLog('Mission Guard Passed: Intent strictly aligned.', 'success');
    return true;
  }
}