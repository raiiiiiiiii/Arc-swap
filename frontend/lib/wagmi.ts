import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  network: "arcTestnet",
  nativeCurrency: {
    decimals: 6, // USDC is the native gas token, which has 6 decimals
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
    public: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

export const config = getDefaultConfig({
  appName: "ArcSwap",
  projectId: "YOUR_PROJECT_ID_HERE", // RainbowKit requires a WalletConnect project ID, but for testnet and generic usage we can provide a dummy or require the user to set it
  chains: [arcTestnet],
  ssr: true, // If using Next.js App Router
});
