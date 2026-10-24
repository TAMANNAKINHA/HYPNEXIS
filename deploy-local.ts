/**
 * Reproducible local deployment (Person 4).
 *
 *   npx hardhat run scripts/deploy-local.ts --network localhost
 *
 * Deploys EntryPointMock -> MissionWallet -> AgentPaymentGateway, initialises the
 * mission (gateway becomes the wallet owner), sets the on-chain recipient
 * allowlist, funds the wallet, then writes:
 *   - deployments/<network>.json   (addresses, limits, accounts, adapter ABI)
 *   - .env                         (RPC_URL, CHAIN_ID, CONTRACT_*, PRIVATE_KEY ...) unless NO_ENV_UPDATE=1
 *
 * Only runs against chainId 1337 (local). Testnet deployment stays a manual,
 * reviewed step (see DEPLOYMENT_CHECKLIST.md).
 */
import { ethers, network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const envfile = require("./lib/envfile.cjs");

// Hardhat's publicly documented account #0 key. Local chain only; never holds value.
const HARDHAT_ACCOUNT_0_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const ADAPTER_ABI = [
  "function execute(address recipient, uint256 amount)",
  "event PaymentExecuted(address indexed recipient, uint256 amount)",
];

async function main() {
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);
  if (chainId !== 1337) {
    throw new Error(`deploy-local.ts only targets the local chain (1337); connected to ${chainId}. Use the checklist for testnets.`);
  }

  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const recipients = [signers[5].address, signers[6].address];
  const attacker = signers[7].address;

  console.log(`Network ${network.name} (chainId ${chainId})`);
  console.log(`Deployer/operator: ${deployer.address}`);

  const entryPoint = await (await ethers.getContractFactory("EntryPointMock")).deploy();
  await entryPoint.waitForDeployment();

  const wallet: any = await (await ethers.getContractFactory("MissionWallet")).deploy(await entryPoint.getAddress());
  await wallet.waitForDeployment();
  const walletAddress = await wallet.getAddress();

  const gateway: any = await (await ethers.getContractFactory("AgentPaymentGateway")).deploy(walletAddress);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();

  const block = await ethers.provider.getBlock("latest");
  const missionId = `LOCAL-${Date.now().toString(36).toUpperCase()}`;
  const limits = {
    totalBudget: ethers.parseEther("1"),
    maxPerTx: ethers.parseEther("0.1"),
    maxDaily: ethers.parseEther("0.5"),
  };
  const expiry = (block?.timestamp ?? Math.floor(Date.now() / 1000)) + 7 * 24 * 3600;

  await (await wallet.initialize({ missionId, ...limits, expiry, owner: gatewayAddress })).wait();
  await (await gateway.setRecipientAllowlist(recipients)).wait();
  await (await deployer.sendTransaction({ to: walletAddress, value: limits.totalBudget })).wait();

  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const info = {
    network: network.name,
    chainId,
    rpcUrl,
    deployedAt: new Date().toISOString(),
    blockNumber: (await ethers.provider.getBlock("latest"))?.number,
    deployer: deployer.address,
    entryPoint: await entryPoint.getAddress(),
    missionWallet: walletAddress,
    gateway: gatewayAddress,
    missionId,
    limits: {
      totalBudget: limits.totalBudget.toString(),
      maxPerTx: limits.maxPerTx.toString(),
      maxDaily: limits.maxDaily.toString(),
      expiry,
    },
    accounts: { recipients, attacker },
    adapterAbi: ADAPTER_ABI,
  };

  const dir = path.resolve(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);

  if (process.env.NO_ENV_UPDATE !== "1") {
    const envPath = path.resolve(__dirname, "..", ".env");
    envfile.update(envPath, {
      EXECUTION_MODE: "real",
      RPC_URL: rpcUrl,
      CHAIN_ID: String(chainId),
      CONTRACT_ADDRESS: gatewayAddress,
      CONTRACT_ABI: JSON.stringify(ADAPTER_ABI),
      CONTRACT_EXECUTE_METHOD: "execute",
      CONTRACT_EXECUTION_EVENT: "PaymentExecuted",
      PRIVATE_KEY: HARDHAT_ACCOUNT_0_KEY,
      PAYMENT_DECIMALS: "18",
      CONFIRMATIONS: "1",
      RECIPIENT_ALLOWLIST: recipients.join(","),
      MISSION_RECIPIENTS_JSON: JSON.stringify({ "*": recipients }),
    });
    console.log("Updated .env for the local chain (EXECUTION_MODE=real).");
  }

  console.log("\nGateway (CONTRACT_ADDRESS):", gatewayAddress);
  console.log("MissionWallet:             ", walletAddress);
  console.log("Allowed recipients:        ", recipients.join(", "));
  console.log("Attacker (not allowlisted):", attacker);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
