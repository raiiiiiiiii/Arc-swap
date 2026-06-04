import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

/**
 * Seed ArcSwap contract with initial liquidity.
 * Run this after deploying the contract.
 * Ensure you have USDC and EURC on Arc Testnet first!
 */
async function main() {
  const [admin] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════");
  console.log("  ArcSwap Liquidity Seeding — Arc Testnet");
  console.log("═══════════════════════════════════════════");
  console.log(`  Admin: ${admin.address}`);

  // Load deployment info
  const deploymentPath = path.join(__dirname, "../deployments/arcTestnet.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deployment file not found. Run deploy script first.");
    process.exitCode = 1;
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const contractAddress = deployment.contractAddress;
  const USDC_ADDRESS = deployment.usdc;
  const EURC_ADDRESS = deployment.eurc;

  console.log(`  Contract: ${contractAddress}`);

  // ERC20 ABI (minimal for approve and balance)
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
  ];

  const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, admin);
  const eurc = new ethers.Contract(EURC_ADDRESS, erc20Abi, admin);
  const arcSwap = await ethers.getContractAt("ArcSwap", contractAddress, admin);

  // Check admin balances
  const adminUsdcBalance = await usdc.balanceOf(admin.address);
  const adminEurcBalance = await eurc.balanceOf(admin.address);

  console.log(`\n  Admin USDC balance: ${ethers.formatUnits(adminUsdcBalance, 6)}`);
  console.log(`  Admin EURC balance: ${ethers.formatUnits(adminEurcBalance, 6)}`);

  // Amount to seed: Let's do 100 of each if available, or whatever admin has up to 100
  const targetSeedAmount = ethers.parseUnits("100", 6); // 100 tokens

  const seedUsdcAmount = adminUsdcBalance < targetSeedAmount ? adminUsdcBalance : targetSeedAmount;
  const seedEurcAmount = adminEurcBalance < targetSeedAmount ? adminEurcBalance : targetSeedAmount;

  if (seedUsdcAmount === 0n && seedEurcAmount === 0n) {
    console.log("\n❌ Admin has no USDC or EURC. Get test tokens from the faucet first!");
    return;
  }

  // USDC is the native gas token. If we are using all of our balance, leave 1 USDC for gas!
  let safeUsdcSeed = seedUsdcAmount;
  const gasBuffer = ethers.parseUnits("1", 6);
  if (adminUsdcBalance < targetSeedAmount && adminUsdcBalance > gasBuffer) {
    safeUsdcSeed = adminUsdcBalance - gasBuffer;
  } else if (adminUsdcBalance <= gasBuffer) {
    safeUsdcSeed = 0n; // Not enough to seed and pay gas
    console.log("Not enough USDC to seed and pay for gas.");
  }

  console.log(`\n  Seeding:`);
  console.log(`  ${ethers.formatUnits(safeUsdcSeed, 6)} USDC`);
  console.log(`  ${ethers.formatUnits(seedEurcAmount, 6)} EURC`);

  // Approve and Deposit USDC
  if (safeUsdcSeed > 0n) {
    console.log("\n  Approving USDC...");
    const approveTx = await usdc.approve(contractAddress, safeUsdcSeed);
    await approveTx.wait();

    console.log("  Depositing USDC...");
    const depositTx = await arcSwap.depositLiquidity(USDC_ADDRESS, safeUsdcSeed);
    await depositTx.wait();
    console.log("  ✅ USDC deposited");
  }

  // Approve and Deposit EURC
  if (seedEurcAmount > 0n) {
    console.log("\n  Approving EURC...");
    const approveTx = await eurc.approve(contractAddress, seedEurcAmount);
    await approveTx.wait();

    console.log("  Depositing EURC...");
    const depositTx = await arcSwap.depositLiquidity(EURC_ADDRESS, seedEurcAmount);
    await depositTx.wait();
    console.log("  ✅ EURC deposited");
  }

  // Final check
  const reserves = await arcSwap.getReserves();
  console.log("\n═══════════════════════════════════════════");
  console.log("  ✅ Seeding Complete");
  console.log(`  Current Contract Reserves:`);
  console.log(`    USDC: ${ethers.formatUnits(reserves.usdcReserve, 6)}`);
  console.log(`    EURC: ${ethers.formatUnits(reserves.eurcReserve, 6)}`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
