import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Minimal ABI for the MissionWallet contract
const MISSION_WALLET_ABI = [
  "function missionName() view returns (string)",
  "function missionId() view returns (string)",
  "function category() view returns (string)",
  "function budget() view returns (uint256)",
  "function spent() view returns (uint256)",
  "function frozen() view returns (bool)",
  "function expiry() view returns (uint256)",
  "function merchant() view returns (address)",
  "function remainingBudget() view returns (uint256)",
  "function isActive() view returns (bool)",
  "function getStatus() view returns (string)",
  "function execute(uint256 amount)",
  "function freeze()",
  "function unfreeze()",
  "function refund()",
  "function nuke()",
];

export class BlockchainService {
  private static provider: ethers.Provider | null = null;
  private static signer: ethers.Signer | null = null;
  private static walletAddress: string | null = null;
  static useRealContract = process.env.USE_REAL_CONTRACT === 'true';

  static initialize() {
    if (this.useRealContract) {
      const rpcUrl = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      if (process.env.PRIVATE_KEY) {
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      }
    }
  }

  // ============= ORIGINAL MOCK DEPLOYMENT (unchanged signature) =============
  static async deployMissionWallet(merchant: string, limit: number): Promise<string> {
    const mockWallet = ethers.Wallet.createRandom();
    return mockWallet.address;
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
    if (!this.useRealContract) {
      throw new Error('Real contract deployment disabled. Set USE_REAL_CONTRACT=true.');
    }

    if (!this.signer) this.initialize();
    if (!this.signer) throw new Error('Signer not configured; check PRIVATE_KEY in .env');

    // In a full integration, you'd load the contract artifact here.
    // For now, we still return a mock but log that it's the "real" path.
    console.log('Real contract deployment requested – using mock for demonstration.');
    const mockAddress = `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;
    const mockTxHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;
    this.walletAddress = mockAddress;
    return { address: mockAddress, txHash: mockTxHash };

    /* Real implementation after Hardhat compilation:
    const factory = new ethers.ContractFactory(
      MISSION_WALLET_ABI,
      // bytecode from build artifacts
      '0x...',
      this.signer
    );
    const contract = await factory.deploy(
      name, missionId, category, budget, merchant,
      timelockSeconds, expirySeconds
    );
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const txHash = contract.deploymentTransaction()!.hash;
    this.walletAddress = address;
    return { address, txHash };
    */
  }

  // ============= Execute On-Chain =============
  static async executeOnChain(
    walletAddress: string,
    amount: number,
    sessionKey: string
  ): Promise<{ success: boolean; txHash: string }> {
    if (!this.useRealContract) {
      const mockTxHash = ethers.keccak256(
        ethers.toUtf8Bytes(`tx_${sessionKey}_${Date.now()}`)
      );
      return { success: true, txHash: mockTxHash };
    }
    const mockTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`exec_${walletAddress}_${Date.now()}`)
    );
    return { success: true, txHash: mockTxHash };
  }

  // ============= Kill Switches =============
  static async triggerKillSwitch(
    walletAddress: string,
    type: 'freeze' | 'nuke' | 'cancel'
  ): Promise<string> {
    if (!this.useRealContract) {
      return ethers.keccak256(
        ethers.toUtf8Bytes(`kill_${type}_${Date.now()}`)
      );
    }
    return ethers.keccak256(
      ethers.toUtf8Bytes(`kill_${type}_${walletAddress}_${Date.now()}`)
    );
  }

  static getExplorerUrl(address: string): string {
    return `https://sepolia.basescan.org/address/${address}`;
  }
}