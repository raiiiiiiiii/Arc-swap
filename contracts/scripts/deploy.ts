import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Deploy ArcSwap to Arc Testnet
 *
 * Arc Testnet (Chain ID: 5042002):
 *   USDC: 0x3600000000000000000000000000000000000000 (native gas token)
 *   EURC: 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════");
  console.log("  ArcSwap Deployment — Arc Testnet");
  console.log("═══════════════════════════════════════════");
  console.log(`  Deployer:  ${deployer.address}`);

  // Arc Testnet token addresses (official from Arc docs)
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
  const DAILY_SWAP_LIMIT = 3;      // 3 swaps per wallet per 24h
  const MAX_SWAP_AMOUNT = 1_000_000; // 1 USDC/EURC per swap (6 decimals)

  console.log(`\n  USDC:        ${USDC_ADDRESS}`);
  console.log(`  EURC:        ${EURC_ADDRESS}`);
  console.log(`  Daily limit: ${DAILY_SWAP_LIMIT} swaps/wallet/24h`);
  console.log(`  Max amount:  ${MAX_SWAP_AMOUNT / 1_000_000} USDC per swap`);

  console.log("\n  Deploying ArcSwap...");

  const ArcSwap = await ethers.getContractFactory("ArcSwap");
  const arcSwap = await ArcSwap.deploy(USDC_ADDRESS, EURC_ADDRESS, DAILY_SWAP_LIMIT, MAX_SWAP_AMOUNT);
  await arcSwap.waitForDeployment();

  const contractAddress = await arcSwap.getAddress();
  console.log(`\n✅ ArcSwap deployed at: ${contractAddress}`);
  console.log(`   Block Explorer: https://testnet.arcscan.app/address/${contractAddress}`);

  // Save deployment info
  const deploymentInfo = {
    network: "arcTestnet",
    chainId: 5042002,
    contractAddress,
    deployer: deployer.address,
    usdc: USDC_ADDRESS,
    eurc: EURC_ADDRESS,
    dailySwapLimit: DAILY_SWAP_LIMIT,
    maxSwapAmount: MAX_SWAP_AMOUNT,
    deployedAt: new Date().toISOString(),
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "./deployments/arcTestnet.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n  Deployment info saved to ./deployments/arcTestnet.json");
  console.log("\n  Next steps:");
  console.log("  1. Fund the contract with USDC and EURC using the seed script");
  console.log(`     npx hardhat run scripts/seed.ts --network arcTestnet`);
  console.log("  2. Update NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env.local");
  console.log(`     NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("\n═══════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
