import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [admin] = await ethers.getSigners();
  
  const deploymentPath = path.join(__dirname, "../deployments/arcTestnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const contractAddress = deployment.contractAddress;

  const arcSwap = await ethers.getContractAt("ArcSwap", contractAddress, admin);
  
  const ADMIN_ROLE = await arcSwap.ADMIN_ROLE();
  const targetAddress = "0x1fEc1e7e84A4f850a7a7Ce1E3D02b6bBDE7DAB3f";
  
  console.log(`Granting ADMIN_ROLE to ${targetAddress}...`);
  const tx = await arcSwap.grantRole(ADMIN_ROLE, targetAddress);
  await tx.wait();
  
  console.log(`✅ ADMIN_ROLE successfully granted to ${targetAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
