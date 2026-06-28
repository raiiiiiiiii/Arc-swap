import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x748006b7A10faf6431F889A8d2130c7c26483978";
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
