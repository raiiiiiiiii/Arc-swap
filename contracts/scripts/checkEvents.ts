import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x748006b7A10faf6431F889A8d2130c7c26483978";
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
