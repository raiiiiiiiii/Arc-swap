"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWatchContractEvent } from "wagmi";
import { ARCSWAP_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS, TOKENS } from "@/lib/constants";
import { formatDecimals } from "@/lib/utils";

export type SwapEvent = {
  hash: string;
  user: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  timestamp: number;
};

export function useSwapHistory(filterByUser: boolean = true) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [history, setHistory] = useState<SwapEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch past logs on mount
  useEffect(() => {
    if ((filterByUser && !address) || !publicClient) return;

    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        // Fetch logs from the last 9,000 blocks to avoid the 10,000 limit
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 9000n ? currentBlock - 9000n : 0n;

        const logs = await publicClient.getContractEvents({
          address: ARCSWAP_ADDRESS,
          abi: ARCSWAP_ABI,
          eventName: "Swapped",
          args: filterByUser && address ? { user: address } : undefined,
          fromBlock,
          toBlock: "latest"
        });

        const formattedLogs = logs.map(log => {
          const args = log.args as any;
          const isUsdcIn = args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
          return {
            hash: log.transactionHash,
            user: args.user,
            tokenInSymbol: isUsdcIn ? "USDC" : "EURC",
            tokenOutSymbol: isUsdcIn ? "EURC" : "USDC",
            amountInFormatted: formatDecimals(args.amountIn),
            amountOutFormatted: formatDecimals(args.amountOut),
            timestamp: Number(args.timestamp) * 1000 // Convert to JS ms
          };
        }).reverse(); // Newest first

        setHistory(formattedLogs);
      } catch (error) {
        console.error("Failed to fetch swap history", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [address, publicClient, filterByUser]);

  // Listen for new events
  useWatchContractEvent({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    eventName: "Swapped",
    args: filterByUser && address ? { user: address } : undefined,
    onLogs(logs) {
      const newEvents = logs.map(log => {
        const args = log.args as any;
        const isUsdcIn = args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
        return {
          hash: log.transactionHash,
          user: args.user,
          tokenInSymbol: isUsdcIn ? "USDC" : "EURC",
          tokenOutSymbol: isUsdcIn ? "EURC" : "USDC",
          amountInFormatted: formatDecimals(args.amountIn),
          amountOutFormatted: formatDecimals(args.amountOut),
          timestamp: Number(args.timestamp) * 1000
        };
      });
      setHistory(prev => [...newEvents, ...prev]);
    },
  });

  return { history, isLoading };
}
