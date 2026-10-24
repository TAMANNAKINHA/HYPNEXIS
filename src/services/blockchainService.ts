/**
 * Legacy dashboard compatibility adapter. The checked-in MissionWallet does not
 * expose the legacy ABI that this dashboard originally expected. Keep demo
 * workflows available, but never impersonate deployment or chain activity.
 */
export class BlockchainService {
  static async deployMissionWallet(_merchant: string, _limit: number): Promise<void> {
    if (process.env.USE_REAL_CONTRACT === 'true') {
      throw new Error('Real MissionWallet deployment is unavailable: no reviewed deployment adapter is configured.');
    }
  }

  // ============= OPTIONAL REAL CONTRACT DEPLOYMENT =============
  static async deployRealMissionWallet(
    name: string,
    missionId: string,
    category: string,
    budget: number,
    merchant: string,
    timelockSeconds: number = 60,
    expirySeconds: number = 86400
  ): Promise<{ address: string; txHash: string }> {
    void name; void missionId; void category; void budget; void merchant; void timelockSeconds; void expirySeconds;
    throw new Error('Real MissionWallet deployment is unavailable: the repository has no reviewed deployment adapter or deployable artifact.');
  }

  // ============= Execute On-Chain =============
  static async executeOnChain(
    walletAddress: string,
    amount: number,
    sessionKey: string
  ): Promise<{ success: boolean; simulated: boolean; broadcasted: boolean }> {
    void walletAddress; void amount; void sessionKey;
    if (process.env.USE_REAL_CONTRACT === 'true') {
      throw new Error('Real payment execution is unavailable: the configured payment adapter does not match IMissionWallet.');
    }
    return { success: true, simulated: true, broadcasted: false };
  }

  // ============= Kill Switches =============
  static async triggerKillSwitch(
    walletAddress: string,
    type: 'freeze' | 'nuke' | 'cancel'
  ): Promise<{ simulated: boolean; broadcasted: boolean }> {
    void walletAddress; void type;
    if (process.env.USE_REAL_CONTRACT === 'true') {
      throw new Error('On-chain wallet controls are unavailable: no reviewed adapter for the configured MissionWallet is enabled.');
    }
    return { simulated: true, broadcasted: false };
  }

  static getExplorerUrl(address: string): string {
    void address;
    throw new Error('An explorer URL is unavailable until a real wallet deployment is verified.');
  }
}
