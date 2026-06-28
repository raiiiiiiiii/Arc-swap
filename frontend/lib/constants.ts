export const ARC_TESTNET_CHAIN_ID = 5042002;

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
export const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

// Hardcoded for Arc Testnet to avoid Next.js env loading issues
export const ARCSWAP_ADDRESS = "0xDA0763aCccfd328b8a1Cb4B0E17E471dAE97884B" as `0x${string}`;
// 1 USDC = 1 EURC (fixed rate)
export const SWAP_RATE = 1; 

export const TOKENS = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: USDC_ADDRESS,
    decimals: 6,
    icon: "💵"
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: EURC_ADDRESS,
    decimals: 6,
    icon: "💶"
  }
} as const;
