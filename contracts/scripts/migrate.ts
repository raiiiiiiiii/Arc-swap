import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Migrate liquidity from old ArcSwap contract to new one.
 * Old: 0x7A86C22Cf888b4375609f5E940B2aedeb743D7A2
 * New: 0x748006b7A10faf6431F889A8d2130c7c26483978
 */
async function main() {
  const [admin] = await ethers.getSigners();

  const OLD_CONTRACT = "0xDA0763aCccfd328b8a1Cb4B0E17E471dAE97884B";
  const NEW_CONTRACT = "0x978738473e7B1693a44088a4B3243a60B6d2C734";
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

  console.log("═══════════════════════════════════════════");
  console.log("  ArcSwap Liquidity Migration");
  console.log("═══════════════════════════════════════════");
  console.log(`  Admin:    ${admin.address}`);
  console.log(`  Old:      ${OLD_CONTRACT}`);
  console.log(`  New:      ${NEW_CONTRACT}`);

  const arcSwapAbi = [
    "function getReserves() external view returns (uint256 usdcReserve, uint256 eurcReserve)",
    "function withdrawLiquidity(address token, uint256 amount, address to) external",
    "function depositLiquidity(address token, uint256 amount) external",
  ];
  const erc20Abi = [
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];

  const oldContract = new ethers.Contract(OLD_CONTRACT, arcSwapAbi, admin);
  const newContract = new ethers.Contract(NEW_CONTRACT, arcSwapAbi, admin);
  const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, admin);
  const eurc = new ethers.Contract(EURC_ADDRESS, erc20Abi, admin);

  // Check old reserves
  const oldReserves = await oldContract.getReserves();
  const oldUsdc = oldReserves.usdcReserve;
  const oldEurc = oldReserves.eurcReserve;

  console.log(`\n  Old Contract Reserves:`);
  console.log(`    USDC: ${ethers.formatUnits(oldUsdc, 6)}`);
  console.log(`    EURC: ${ethers.formatUnits(oldEurc, 6)}`);

  if (oldUsdc === 0n && oldEurc === 0n) {
    console.log("\n  ❌ Old contract has no reserves to migrate.");
    return;
  }

  // Keep 1 USDC for gas if withdrawing USDC (USDC = native gas token)
  const gasBuffer = ethers.parseUnits("1", 6);

  // ── Withdraw USDC from old contract ────────────────────────────────────
  if (oldUsdc > 0n) {
    const withdrawUsdc = oldUsdc > gasBuffer ? oldUsdc - gasBuffer : oldUsdc;
    if (withdrawUsdc > 0n) {
      console.log(`\n  Withdrawing ${ethers.formatUnits(withdrawUsdc, 6)} USDC from old contract...`);
      const tx = await oldContract.withdrawLiquidity(USDC_ADDRESS, withdrawUsdc, admin.address);
      await tx.wait();
      console.log("  ✅ USDC withdrawn");
    }
  }

  // ── Withdraw EURC from old contract ────────────────────────────────────
  if (oldEurc > 0n) {
    console.log(`\n  Withdrawing ${ethers.formatUnits(oldEurc, 6)} EURC from old contract...`);
    const tx = await oldContract.withdrawLiquidity(EURC_ADDRESS, oldEurc, admin.address);
    await tx.wait();
    console.log("  ✅ EURC withdrawn");
  }

  // Check admin wallet balances after withdrawal
  const adminUsdc = await usdc.balanceOf(admin.address);
  const adminEurc = await eurc.balanceOf(admin.address);
  console.log(`\n  Admin wallet after withdrawal:`);
  console.log(`    USDC: ${ethers.formatUnits(adminUsdc, 6)}`);
  console.log(`    EURC: ${ethers.formatUnits(adminEurc, 6)}`);

  // ── Deposit USDC into new contract ─────────────────────────────────────
  const depositUsdc = adminUsdc > gasBuffer ? adminUsdc - gasBuffer : 0n;
  if (depositUsdc > 0n) {
    console.log(`\n  Approving ${ethers.formatUnits(depositUsdc, 6)} USDC for new contract...`);
    const approveTx = await usdc.approve(NEW_CONTRACT, depositUsdc);
    await approveTx.wait();

    console.log(`  Depositing USDC into new contract...`);
    const depositTx = await newContract.depositLiquidity(USDC_ADDRESS, depositUsdc);
    await depositTx.wait();
    console.log("  ✅ USDC deposited into new contract");
  }

  // ── Deposit EURC into new contract ─────────────────────────────────────
  if (adminEurc > 0n) {
    console.log(`\n  Approving ${ethers.formatUnits(adminEurc, 6)} EURC for new contract...`);
    const approveTx = await eurc.approve(NEW_CONTRACT, adminEurc);
    await approveTx.wait();

    console.log(`  Depositing EURC into new contract...`);
    const depositTx = await newContract.depositLiquidity(EURC_ADDRESS, adminEurc);
    await depositTx.wait();
    console.log("  ✅ EURC deposited into new contract");
  }

  // Final reserves check
  const newReserves = await newContract.getReserves();
  console.log("\n═══════════════════════════════════════════");
  console.log("  ✅ Migration Complete!");
  console.log(`  New Contract Reserves:`);
  console.log(`    USDC: ${ethers.formatUnits(newReserves.usdcReserve, 6)}`);
  console.log(`    EURC: ${ethers.formatUnits(newReserves.eurcReserve, 6)}`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
