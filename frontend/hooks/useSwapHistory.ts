"use client";

import { useEffect, useState, useRef } from "react";
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

// ─── localStorage helpers ───────────────────────────────────────────────────
const STORAGE_KEY = "arcswap_history_v2";

function loadFromStorage(): SwapEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SwapEvent[];
  } catch {
    return [];
  }
}

function saveToStorage(events: SwapEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Storage quota exceeded — trim old entries and retry
    try {
      const trimmed = events.slice(0, 500);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }
}

/** Merge new events into existing list, deduplicate by hash, keep newest-first */
function mergeEvents(existing: SwapEvent[], incoming: SwapEvent[]): SwapEvent[] {
  const map = new Map<string, SwapEvent>();
  for (const ev of [...existing, ...incoming]) {
    map.set(ev.hash, ev);
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Main Hook ───────────────────────────────────────────────────────────────
export function useSwapHistory(filterByUser: boolean = true) {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Start with whatever is already in localStorage
  const [allHistory, setAllHistory] = useState<SwapEvent[]>(() => loadFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);

  /** Persist merged list and update state */
  const persistAndSet = (newEvents: SwapEvent[]) => {
    setAllHistory(prev => {
      const merged = mergeEvents(prev, newEvents);
      saveToStorage(merged);
      return merged;
    });
  };

  // ── Fetch on mount (once per session) ──────────────────────────────────────
  useEffect(() => {
    if (hasFetched.current) return;
    if ((filterByUser && !address) || !publicClient) return;
    hasFetched.current = true;

    const fetchHistory = async () => {
      try {
        setIsLoading(true);

        // ── Try Explorer API proxy first ──────────────────────────────────
        try {
          const swappedTopic0 =
            "0xc9163c3bdf7263acf1bb3d24072cc7da025f7181c31e2edc7e1673edf5e0ca32";
          const response = await fetch(
            `/api/logs?address=${ARCSWAP_ADDRESS}&topic0=${swappedTopic0}`
          );
          const data = await response.json();

          if (response.ok && data.status === "1" && data.result?.length > 0) {
            const { decodeEventLog } = await import("viem");
            const formattedLogs: SwapEvent[] = data.result
              .map((log: any) => {
                try {
                  const decoded = decodeEventLog({
                    abi: ARCSWAP_ABI,
                    data: log.data,
                    topics: log.topics.filter((t: any) => t !== null),
                  });
                  const args = decoded.args as any;

                  const isUsdcIn =
                    args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
                  return {
                    hash: log.transactionHash,
                    user: args.user,
                    tokenInSymbol: isUsdcIn ? "USDC" : "EURC",
                    tokenOutSymbol: isUsdcIn ? "EURC" : "USDC",
                    amountInFormatted: formatDecimals(args.amountIn),
                    amountOutFormatted: formatDecimals(args.amountOut),
                    timestamp: Number(args.timestamp) * 1000,
                  } as SwapEvent;
                } catch {
                  return null;
                }
              })
              .filter(Boolean) as SwapEvent[];

            persistAndSet(formattedLogs);
            return; // Done
          }
        } catch (apiError) {
          console.warn("Explorer API failed, falling back to RPC chunks", apiError);
        }

        // ── Fallback: chunked RPC ─────────────────────────────────────────
        const currentBlock = await publicClient.getBlockNumber();
        const START_BLOCK = 45446000n;
        const BATCH_SIZE = 9000n;

        const fetchPromises = [];
        for (let from = START_BLOCK; from <= currentBlock; from += BATCH_SIZE) {
          const to =
            from + BATCH_SIZE - 1n > currentBlock
              ? currentBlock
              : from + BATCH_SIZE - 1n;
          fetchPromises.push(
            publicClient
              .getContractEvents({
                address: ARCSWAP_ADDRESS,
                abi: ARCSWAP_ABI,
                eventName: "Swapped",
                fromBlock: from,
                toBlock: to,
              })
              .catch(e => {
                console.warn(`RPC batch ${from}–${to} failed`, e);
                return [];
              })
          );
        }

        const allLogs: SwapEvent[] = [];
        const CHUNK_SIZE = 5;
        for (let i = 0; i < fetchPromises.length; i += CHUNK_SIZE) {
          const chunkResults = await Promise.all(
            fetchPromises.slice(i, i + CHUNK_SIZE)
          );
          chunkResults.forEach(batchLogs => {
            (batchLogs as any[]).forEach(log => {
              const args = log.args as any;
              const isUsdcIn =
                args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
              allLogs.push({
                hash: log.transactionHash,
                user: args.user,
                tokenInSymbol: isUsdcIn ? "USDC" : "EURC",
                tokenOutSymbol: isUsdcIn ? "EURC" : "USDC",
                amountInFormatted: formatDecimals(args.amountIn),
                amountOutFormatted: formatDecimals(args.amountOut),
                timestamp: Number(args.timestamp) * 1000,
              });
            });
          });
          await new Promise(r => setTimeout(r, 150));
        }

        persistAndSet(allLogs);
      } catch (error) {
        console.error("Failed to fetch swap history", error);
        // Still show what we have in localStorage (already in state)
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
    // Re-run if address changes (user switches wallet)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient, filterByUser]);

  // Reset fetch flag when address changes so we re-fetch for new wallet
  useEffect(() => {
    hasFetched.current = false;
  }, [address]);

  // ── Watch for new real-time events ─────────────────────────────────────────
  useWatchContractEvent({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    eventName: "Swapped",
    onLogs(logs) {
      const newEvents: SwapEvent[] = logs.map(log => {
        const args = log.args as any;
        const isUsdcIn =
          args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
        return {
          hash: log.transactionHash ?? "",
          user: args.user,
          tokenInSymbol: isUsdcIn ? "USDC" : "EURC",
          tokenOutSymbol: isUsdcIn ? "EURC" : "USDC",
          amountInFormatted: formatDecimals(args.amountIn),
          amountOutFormatted: formatDecimals(args.amountOut),
          timestamp: Number(args.timestamp) * 1000,
        };
      });
      persistAndSet(newEvents);
    },
  });

  // ── Return filtered view ───────────────────────────────────────────────────
  const history = filterByUser && address
    ? allHistory.filter(tx => tx.user.toLowerCase() === address.toLowerCase())
    : allHistory;

  return { history, isLoading };
}
