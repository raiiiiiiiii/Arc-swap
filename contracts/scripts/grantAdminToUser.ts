import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x978738473e7B1693a44088a4B3243a60B6d2C734";
  const userAddress = "0x1fEc1e7e84A4f850a7a7Ce1E3D02b6bBDE7DAB3f";

  const arcSwap = await ethers.getContractAt("ArcSwap", contractAddress);

  console.log(`Granting ADMIN_ROLE to ${userAddress}...`);
  
  const tx = await arcSwap.grantAdminRole(userAddress);
  await tx.wait();
  
  console.log(`✅ ADMIN_ROLE granted successfully!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
