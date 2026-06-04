"use client";

import { usePublicClient } from "wagmi";
import { useEffect, useState } from "react";

export function StatusBar() {
  const publicClient = usePublicClient();
  const [blockNumber, setBlockNumber] = useState<string>("Loading...");

  useEffect(() => {
    if (!publicClient) return;

    const fetchBlock = async () => {
      try {
        const block = await publicClient.getBlockNumber();
        setBlockNumber(block.toString());
      } catch (error) {
        setBlockNumber("Unknown");
      }
    };

    fetchBlock();
    const interval = setInterval(fetchBlock, 10000); // update every 10s
    return () => clearInterval(interval);
  }, [publicClient]);

  return (
    <div className="h-10 w-full border-t bg-background/95 backdrop-blur flex items-center px-4 text-[10px] sm:text-xs font-medium text-muted-foreground shrink-0 overflow-x-auto whitespace-nowrap">
      <div className="flex items-center gap-2 pr-6 border-r border-border/50">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="tracking-wider uppercase">Arc Testnet</span>
      </div>
      
      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Total Txns</span>
        <span className="text-foreground font-bold font-space-grotesk">480.78M</span>
      </div>

      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Txns Today</span>
        <span className="text-foreground font-bold font-space-grotesk">3.14M</span>
      </div>

      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Avg Block Time</span>
        <span className="text-foreground font-bold font-space-grotesk">2.0s</span>
      </div>

      <div className="flex items-center gap-6 px-6 border-r border-border/50">
        <span className="opacity-70 uppercase tracking-wider">Current Block</span>
        <span className="text-foreground font-bold font-space-grotesk">{blockNumber}</span>
      </div>
      
      <div className="flex items-center gap-6 px-6">
        <span className="opacity-70 uppercase tracking-wider">Network Load</span>
        <span className="text-foreground font-bold font-space-grotesk text-green-500">9.03%</span>
      </div>
      
      <div className="ml-auto flex items-center opacity-50">
        <span>Updated just now</span>
      </div>
    </div>
  );
}
