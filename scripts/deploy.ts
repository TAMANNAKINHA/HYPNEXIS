import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying MissionWallet to selected network...");

  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const MissionWallet = await ethers.getContractFactory("MissionWallet");

  const missionId = `MID-${Date.now().toString(36).toUpperCase()}`;
  const budget = ethers.parseEther("0.1"); // 0.1 ETH
  const merchant = "0x0000000000000000000000000000000000000001";
  const timelockSeconds = 60;  // matches UI
  const expirySeconds = 60 * 60 * 24; // 24h

  const wallet = await MissionWallet.deploy(
    "Sample Mission",
    missionId,
    "general",
    budget,
    merchant,
    timelockSeconds,
    expirySeconds
  );

  await wallet.waitForDeployment();
  const address = await wallet.getAddress();

  console.log(`✅ MissionWallet deployed at: ${address}`);
  console.log(`📝 Mission ID: ${missionId}`);
  console.log(`🔗 Explorer: https://sepolia.basescan.org/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });