import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x7A86C22Cf888b4375609f5E940B2aedeb743D7A2";
  const arcSwap = await ethers.getContractAt("ArcSwap", contractAddress);
  
  const filter = arcSwap.filters.Swapped();
  const events = await arcSwap.queryFilter(filter, 0, "latest");
  
  console.log(`Found ${events.length} Swapped events`);
  for (const event of events) {
    console.log(event.args);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
