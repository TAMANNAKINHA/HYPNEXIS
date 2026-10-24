import { ethers } from "hardhat";

async function main() {
  // Configuration - UPDATE THESE VALUES AFTER DEPLOYMENT
  const MISSION_WALLET_ADDRESS = process.env.MISSION_WALLET_ADDRESS || "";
  const AGENT_ADDRESS = process.env.AGENT_ADDRESS || "";
  const MAX_PER_TX_ETH = process.env.MAX_PER_TX_ETH || "0.01";
  const MAX_DAILY_ETH = process.env.MAX_DAILY_ETH || "0.05";
  const EXPIRY_DAYS = parseInt(process.env.EXPIRY_DAYS || "7");
  const ALLOWED_RECIPIENTS = process.env.ALLOWED_RECIPIENTS 
    ? process.env.ALLOWED_RECIPIENTS.split(",").map(a => a.trim())
    : [];

  if (!MISSION_WALLET_ADDRESS) {
    console.error("❌ MISSION_WALLET_ADDRESS environment variable is required");
    process.exit(1);
  }

  if (!AGENT_ADDRESS) {
    console.error("❌ AGENT_ADDRESS environment variable is required");
    process.exit(1);
  }

  if (!ethers.isAddress(AGENT_ADDRESS)) {
    console.error("❌ Invalid AGENT_ADDRESS");
    process.exit(1);
  }

  console.log("🔑 Granting Session Key");
  console.log("=========================");
  console.log(`Mission Wallet: ${MISSION_WALLET_ADDRESS}`);
  console.log(`Agent: ${AGENT_ADDRESS}`);
  console.log(`Max Per Tx: ${MAX_PER_TX_ETH} ETH`);
  console.log(`Max Daily: ${MAX_DAILY_ETH} ETH`);
  console.log(`Expiry: ${EXPIRY_DAYS} days`);
  console.log(`Allowed Recipients: ${ALLOWED_RECIPIENTS.length > 0 ? ALLOWED_RECIPIENTS.join(", ") : "(any)"}`);

  const [owner] = await ethers.getSigners();
  console.log(`\nOwner: ${owner.address}`);

  const MissionWallet = await ethers.getContractFactory("MissionWallet");
  const wallet = MissionWallet.attach(MISSION_WALLET_ADDRESS) as any;

  // Verify owner
  const config = await wallet.getMissionConfig();
  if (config.owner.toLowerCase() !== owner.address.toLowerCase()) {
    console.error("❌ Caller is not the mission owner");
    process.exit(1);
  }

  const expiry = Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 24 * 60 * 60;
  const maxPerTx = ethers.parseEther(MAX_PER_TX_ETH);
  const maxDaily = ethers.parseEther(MAX_DAILY_ETH);

  // Verify limits don't exceed mission limits
  if (maxPerTx > config.maxPerTx) {
    console.error(`❌ Max per tx (${MAX_PER_TX_ETH} ETH) exceeds mission limit (${ethers.formatEther(config.maxPerTx)} ETH)`);
    process.exit(1);
  }
  if (maxDaily > config.maxDaily) {
    console.error(`❌ Max daily (${MAX_DAILY_ETH} ETH) exceeds mission limit (${ethers.formatEther(config.maxDaily)} ETH)`);
    process.exit(1);
  }
  if (expiry > config.expiry) {
    console.error(`❌ Session key expiry exceeds mission expiry`);
    process.exit(1);
  }

  console.log("\n📝 Granting session key...");
  const tx = await wallet.grantSessionKey({
    agent: AGENT_ADDRESS,
    maxPerTx,
    maxDaily,
    expiry,
    allowedRecipients: ALLOWED_RECIPIENTS
  });

  console.log(`⏳ Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Session key granted in block ${receipt?.blockNumber}`);

  // Verify
  const sessionKey = await wallet.getSessionKey(AGENT_ADDRESS);
  console.log("\n🔍 Verification:");
  console.log(`  Agent: ${AGENT_ADDRESS}`);
  console.log(`  Max Per Tx: ${ethers.formatEther(sessionKey.maxPerTx)} ETH`);
  console.log(`  Max Daily: ${ethers.formatEther(sessionKey.maxDaily)} ETH`);
  console.log(`  Expiry: ${new Date(Number(sessionKey.expiry) * 1000).toISOString()}`);
  console.log(`  Revoked: ${sessionKey.revoked}`);
  console.log(`  Nonce: ${sessionKey.nonce}`);
  console.log(`  Allowed Recipients: ${sessionKey.allowedRecipients.length > 0 ? sessionKey.allowedRecipients.join(", ") : "(any)"}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });