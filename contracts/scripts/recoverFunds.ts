import { ethers } from "hardhat";

async function main() {
  const oldContractAddress = "0x50430d900FA167b8918cd2a04c17817B50e8fFb5";
  const userAddress = "0x1fEc1e7e84A4f850a7a7Ce1E3D02b6bBDE7DAB3f";
  
  const USDC = "0x3600000000000000000000000000000000000000";
  const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

  const usdcToken = await ethers.getContractAt("IERC20", USDC);
  const eurcToken = await ethers.getContractAt("IERC20", EURC);
  
  const usdcBalance = await usdcToken.balanceOf(oldContractAddress);
  const eurcBalance = await eurcToken.balanceOf(oldContractAddress);

  console.log(`Old Contract USDC Balance: ${ethers.formatUnits(usdcBalance, 6)}`);
  console.log(`Old Contract EURC Balance: ${ethers.formatUnits(eurcBalance, 6)}`);

  const arcSwap = await ethers.getContractAt("ArcSwap", oldContractAddress);
  
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);
  const isAdmin = await arcSwap.isAdmin(deployer.address);
  console.log("Is deployer admin?", isAdmin);

  if (isAdmin && usdcBalance > 0n) {
    console.log("Withdrawing USDC to user...");
    const tx = await arcSwap.withdrawLiquidity(USDC, usdcBalance, userAddress);
    await tx.wait();
    console.log("✅ USDC withdrawn");
  }

  if (isAdmin && eurcBalance > 0n) {
    console.log("Withdrawing EURC to user...");
    const tx = await arcSwap.withdrawLiquidity(EURC, eurcBalance, userAddress);
    await tx.wait();
    console.log("✅ EURC withdrawn");
  }
  
  if (!isAdmin) {
    console.log("Deployer is not admin. Cannot withdraw.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
