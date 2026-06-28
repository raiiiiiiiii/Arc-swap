"use client";

import { usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { ARCSWAP_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS } from "@/lib/constants";

export function StatusBar() {
  const publicClient = usePublicClient();
  const [blockNumber, setBlockNumber] = useState<string>("—");
  const [blockTime, setBlockTime] = useState<string>("—");
  const [lastUpdated, setLastUpdated] = useState<string>("—");

  // BUG FIX: Real swap stats from the contract instead of hardcoded numbers
  const { data: swapStats } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "getSwapStats",
    query: { refetchInterval: 15000 }
  });

  const stats = swapStats as readonly [bigint, bigint] | undefined;
  const totalSwaps = stats ? Number(stats[0]).toLocaleString() : "—";
  const uniqueUsers = stats ? Number(stats[1]).toLocaleString() : "—";

  useEffect(() => {
    if (!publicClient) return;

    let prevBlock: bigint | null = null;
    let prevBlockTime: number | null = null;

    const fetchBlock = async () => {
      try {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        const num = block.number;
        const ts = Number(block.timestamp);

        // Calculate avg block time from last two blocks
        if (prevBlock !== null && prevBlockTime !== null && num > prevBlock) {
          const diff = ts - prevBlockTime;
          const blocks = Number(num - prevBlock);
          const avgSec = (diff / blocks).toFixed(1);
          setBlockTime(`${avgSec}s`);
        }

        prevBlock = num;
        prevBlockTime = ts;
        setBlockNumber(num.toLocaleString());
        setLastUpdated("just now");
      } catch {
        setBlockNumber("—");
      }
    };

    fetchBlock();
    const interval = setInterval(fetchBlock, 10000);
    return () => clearInterval(interval);
  }, [publicClient]);

  return (
    <div className="h-10 w-full border-t bg-background/95 backdrop-blur flex items-center px-4 text-[10px] sm:text-xs font-medium text-muted-foreground shrink-0 overflow-x-auto whitespace-nowrap">
      <div className="flex items-center gap-2 pr-6 border-r border-border/50">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="tracking-wider uppercase">Arc Testnet</span>
      </div>

      {/* BUG FIX: Real total swaps from contract */}
      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Total Swaps</span>
        <span className="text-foreground font-bold font-space-grotesk">{totalSwaps}</span>
      </div>

      {/* BUG FIX: Real unique users from contract */}
      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Unique Users</span>
        <span className="text-foreground font-bold font-space-grotesk">{uniqueUsers}</span>
      </div>

      {/* BUG FIX: Real avg block time calculated from chain */}
      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Avg Block</span>
        <span className="text-foreground font-bold font-space-grotesk">{blockTime}</span>
      </div>

      {/* BUG FIX: Real current block from chain */}
      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Block</span>
        <span className="text-foreground font-bold font-space-grotesk">#{blockNumber}</span>
      </div>

      <div className="ml-auto flex items-center opacity-50">
        <span>Updated {lastUpdated}</span>
      </div>
    </div>
  );
}
