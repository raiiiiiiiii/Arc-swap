import { ethers } from "hardhat";
import { formatUnits } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
  const CONTRACT_ADDRESS = "0x50430d900FA167b8918cd2a04c17817B50e8fFb5";
  const USER_ADDRESS = "0x1fEc1e7e84A4f850a7a7Ce1E3D02b6bBDE7DAB3f";

  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS, provider);
  const eurc = await ethers.getContractAt("IERC20", EURC_ADDRESS, provider);

  const contractUsdc = await usdc.balanceOf(CONTRACT_ADDRESS);
  const contractEurc = await eurc.balanceOf(CONTRACT_ADDRESS);
  
  const userUsdc = await usdc.balanceOf(USER_ADDRESS);
  const userEurc = await eurc.balanceOf(USER_ADDRESS);

  console.log("=== CONTRACT RESERVES ===");
  console.log(`USDC: ${formatUnits(contractUsdc, 6)}`);
  console.log(`EURC: ${formatUnits(contractEurc, 6)}`);

  console.log("\n=== USER BALANCES ===");
  console.log(`USDC: ${formatUnits(userUsdc, 6)}`);
  console.log(`EURC: ${formatUnits(userEurc, 6)}`);
}

main().catch(console.error);
