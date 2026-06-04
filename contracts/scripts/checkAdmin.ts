import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "../deployments/arcTestnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const contractAddress = deployment.contractAddress;

  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const arcSwap = await ethers.getContractAt("ArcSwap", contractAddress, provider);
  
  const targetAddress = "0x1fEc1e7e84A4f850a7a7Ce1E3D02b6bBDE7DAB3f";
  const deployerAddress = "0x443a28069601710a8d6Cb45722bAeaFf3aAA4bd6";
  
  const isTargetAdmin = await arcSwap.isAdmin(targetAddress);
  const isDeployerAdmin = await arcSwap.isAdmin(deployerAddress);
  
  console.log(`Target (${targetAddress}) isAdmin: ${isTargetAdmin}`);
  console.log(`Deployer (${deployerAddress}) isAdmin: ${isDeployerAdmin}`);
}

main().catch(console.error);
