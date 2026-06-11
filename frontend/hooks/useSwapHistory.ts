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

// ─── localStorage key ────────────────────────────────────────────────────────
const STORAGE_KEY = "arcswap_global_history_v3";

function loadFromStorage(): SwapEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(events: SwapEvent[]) {
  try {
    // Keep max 1000 entries to avoid quota issues
    const toSave = events.slice(0, 1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // If quota exceeded, clear and retry with fewer entries
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 200)));
    } catch {}
  }
}

/** Merge two lists, deduplicate by tx hash, sort newest first */
function mergeAndSort(a: SwapEvent[], b: SwapEvent[]): SwapEvent[] {
  const map = new Map<string, SwapEvent>();
  for (const ev of [...a, ...b]) {
    if (ev.hash) map.set(ev.hash, ev);
  }
  return Array.from(map.values()).sort((x, y) => y.timestamp - x.timestamp);
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useSwapHistory(filterByUser: boolean = true) {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Start empty — localStorage is loaded in useEffect (client only)
  const [allHistory, setAllHistory] = useState<SwapEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Step 1: Load localStorage on client mount (fixes SSR bug) ──────────────
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.length > 0) {
      setAllHistory(stored);
      setIsLoading(false); // Show cached data immediately
    }
  }, []); // runs once on mount

  // ── Helper: merge incoming events into state + localStorage ────────────────
  const persistAndMerge = (incoming: SwapEvent[]) => {
    setAllHistory(prev => {
      const merged = mergeAndSort(prev, incoming);
      saveToStorage(merged);
      return merged;
    });
  };

  // ── Step 2: Fetch fresh data from blockchain ────────────────────────────────
  useEffect(() => {
    // For "My Swaps" view — wait until wallet is connected
    if (filterByUser && !address) {
      setIsLoading(false);
      return;
    }
    if (!publicClient) return;

    const fetchHistory = async () => {
      setIsLoading(true);

      // ── Try ArcScan Explorer API first (fast path) ──────────────────────
      try {
        const swappedTopic0 =
          "0xc9163c3bdf7263acf1bb3d24072cc7da025f7181c31e2edc7e1673edf5e0ca32";
        const apiUrl = `/api/logs?address=${ARCSWAP_ADDRESS}&topic0=${swappedTopic0}`;
        const response = await fetch(apiUrl, { cache: "no-store" });
        const data = await response.json();

        console.log("[SwapHistory] Explorer API response:", data?.status, "result count:", data?.result?.length);

        if (response.ok && data.status === "1" && Array.isArray(data.result) && data.result.length > 0) {
          const { decodeEventLog } = await import("viem");
          const decoded: SwapEvent[] = [];

          for (const log of data.result) {
            try {
              const d = decodeEventLog({
                abi: ARCSWAP_ABI,
                data: log.data,
                topics: log.topics.filter((t: any) => t !== null),
              });
              const args = d.args as any;
              const isUsdcIn =
                args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
              decoded.push({
                hash: log.transactionHash,
                user: args.user,
                tokenInSymbol: isUsdcIn ? "USDC" : "EURC",
                tokenOutSymbol: isUsdcIn ? "EURC" : "USDC",
                amountInFormatted: formatDecimals(args.amountIn),
                amountOutFormatted: formatDecimals(args.amountOut),
                timestamp: Number(args.timestamp) * 1000,
              });
            } catch (e) {
              console.warn("[SwapHistory] Failed to decode log", e);
            }
          }

          if (decoded.length > 0) {
            console.log("[SwapHistory] API decoded", decoded.length, "events");
            persistAndMerge(decoded);
            setIsLoading(false);
            return; // Success — skip RPC fallback
          }
        }
      } catch (apiErr) {
        console.warn("[SwapHistory] Explorer API failed:", apiErr);
      }

      // ── Fallback: Chunked RPC logs ──────────────────────────────────────
      console.log("[SwapHistory] Falling back to RPC chunked fetch...");
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const START_BLOCK = 45446000n;
        const BATCH_SIZE = 9000n;

        const fetchPromises: Promise<any[]>[] = [];
        for (let from = START_BLOCK; from <= currentBlock; from += BATCH_SIZE) {
          const to = from + BATCH_SIZE - 1n > currentBlock ? currentBlock : from + BATCH_SIZE - 1n;
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
                console.warn(`[SwapHistory] RPC batch ${from}–${to} failed`, e);
                return [];
              })
          );
        }

        const rpcEvents: SwapEvent[] = [];
        const CHUNK_SIZE = 5;
        for (let i = 0; i < fetchPromises.length; i += CHUNK_SIZE) {
          const results = await Promise.all(fetchPromises.slice(i, i + CHUNK_SIZE));
          results.forEach(batch => {
            (batch as any[]).forEach(log => {
              const args = log.args as any;
              const isUsdcIn = args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
              rpcEvents.push({
                hash: log.transactionHash ?? "",
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

        console.log("[SwapHistory] RPC fetched", rpcEvents.length, "events");
        if (rpcEvents.length > 0) {
          persistAndMerge(rpcEvents);
        }
      } catch (rpcErr) {
        console.error("[SwapHistory] RPC fallback also failed:", rpcErr);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient, filterByUser]);

  // ── Step 3: Watch for new real-time swap events ────────────────────────────
  useWatchContractEvent({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    eventName: "Swapped",
    onLogs(logs) {
      const newEvents: SwapEvent[] = logs.map(log => {
        const args = log.args as any;
        const isUsdcIn = args.tokenIn.toLowerCase() === TOKENS.USDC.address.toLowerCase();
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
      console.log("[SwapHistory] Real-time event received:", newEvents.length, "new swaps");
      persistAndMerge(newEvents);
    },
  });

  // ── Return filtered view ───────────────────────────────────────────────────
  const history =
    filterByUser && address
      ? allHistory.filter(tx => tx.user.toLowerCase() === address.toLowerCase())
      : allHistory;

  return { history, isLoading };
}
