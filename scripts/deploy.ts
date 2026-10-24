import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying MissionWallet to selected network...");

  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  // EntryPoint v0.7 addresses
  // Base Sepolia: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
  // Base Mainnet: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
  // Hardhat local: will deploy mock
  const entryPointAddresses: Record<number, string> = {
    84532: "0x0000000071727De22E5E9d8BAf0edAc6f37da032", // Base Sepolia
    8453: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",  // Base Mainnet
    1337: "", // Hardhat local - will deploy mock
  };

  let entryPointAddress = entryPointAddresses[network.chainId];
  
  if (!entryPointAddress) {
    // Deploy mock EntryPoint for local testing
    console.log("📦 Deploying mock EntryPoint for local network...");
    const EntryPointMock = await ethers.getContractFactory("EntryPointMock");
    const entryPointMock = await EntryPointMock.deploy();
    await entryPointMock.waitForDeployment();
    entryPointAddress = await entryPointMock.getAddress();
    console.log(`✅ Mock EntryPoint deployed at: ${entryPointAddress}`);
  } else {
    console.log(`📦 Using EntryPoint v0.7 at: ${entryPointAddress}`);
  }

  const MissionWallet = await ethers.getContractFactory("MissionWallet");

  const missionId = `MID-${Date.now().toString(36).toUpperCase()}`;
  const totalBudget = ethers.parseEther("1.0"); // 1 ETH
  const maxPerTx = ethers.parseEther("0.1");    // 0.1 ETH per tx
  const maxDaily = ethers.parseEther("0.5");    // 0.5 ETH per day
  const expirySeconds = 60 * 60 * 24 * 7;       // 7 days
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;

  console.log("\n📋 Mission Configuration:");
  console.log(`  Mission ID: ${missionId}`);
  console.log(`  Total Budget: ${ethers.formatEther(totalBudget)} ETH`);
  console.log(`  Max Per Tx: ${ethers.formatEther(maxPerTx)} ETH`);
  console.log(`  Max Daily: ${ethers.formatEther(maxDaily)} ETH`);
  console.log(`  Expiry: ${new Date(expiry * 1000).toISOString()}`);
  console.log(`  Owner: ${deployer.address}`);
  console.log(`  EntryPoint: ${entryPointAddress}`);

  // Deploy MissionWallet
  console.log("\n📦 Deploying MissionWallet...");
  const wallet = await MissionWallet.deploy(entryPointAddress);
  await wallet.waitForDeployment();
  const walletAddress = await wallet.getAddress();

  console.log(`✅ MissionWallet deployed at: ${walletAddress}`);

  // Initialize the mission
  console.log("\n⚙️ Initializing mission...");
  const initTx = await wallet.initialize({
    missionId,
    totalBudget,
    maxPerTx,
    maxDaily,
    expiry,
    owner: deployer.address
  });
  await initTx.wait();
  console.log("✅ Mission initialized");

  // Fund the wallet
  console.log("\n💰 Funding wallet with budget...");
  const fundTx = await deployer.sendTransaction({
    to: walletAddress,
    value: totalBudget
  });
  await fundTx.wait();
  console.log(`✅ Wallet funded with ${ethers.formatEther(totalBudget)} ETH`);

  // Verify deployment
  const config = await wallet.getMissionConfig();
  console.log("\n🔍 Verification:");
  console.log(`  Mission ID: ${config.missionId}`);
  console.log(`  Total Budget: ${ethers.formatEther(config.totalBudget)} ETH`);
  console.log(`  Max Per Tx: ${ethers.formatEther(config.maxPerTx)} ETH`);
  console.log(`  Max Daily: ${ethers.formatEther(config.maxDaily)} ETH`);
  console.log(`  Owner: ${config.owner}`);
  console.log(`  Initialized: ${await wallet.isInitialized()}`);

  const balance = await ethers.provider.getBalance(walletAddress);
  console.log(`  Contract Balance: ${ethers.formatEther(balance)} ETH`);

  console.log(`\n📝 Mission ID: ${missionId}`);
  console.log(`📍 Contract Address: ${walletAddress}`);
  
  if (network.chainId === 84532) {
    console.log(`🔗 Explorer: https://sepolia.basescan.org/address/${walletAddress}`);
  } else if (network.chainId === 8453) {
    console.log(`🔗 Explorer: https://basescan.org/address/${walletAddress}`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    missionWallet: walletAddress,
    entryPoint: entryPointAddress,
    missionId,
    totalBudget: totalBudget.toString(),
    maxPerTx: maxPerTx.toString(),
    maxDaily: maxDaily.toString(),
    expiry,
    owner: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: (await ethers.provider.getBlock("latest"))?.number
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });