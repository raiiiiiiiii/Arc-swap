"use client";

import { useState } from "react";
import { useSwap } from "@/hooks/useSwap";
import { useSwapHistory } from "@/hooks/useSwapHistory";
import { TOKENS, ARCSWAP_ADDRESS } from "@/lib/constants";
import { ArrowDown, Activity, Settings, ExternalLink, CheckCircle2, Circle, Globe, User } from "lucide-react";
import { formatDecimals, parseDecimals } from "@/lib/utils";
import { useAccount, useReadContract } from "wagmi";
import { ERC20_ABI } from "@/lib/abis";
import { useToast } from "@/components/ui/use-toast";

// Format time-ago helper
function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function SwapCard() {
  const [activeTab, setActiveTab] = useState<"swap" | "activity">("swap");
  const [activityView, setActivityView] = useState<"mine" | "all">("all");
  const [isUsdcToEurc, setIsUsdcToEurc] = useState(true);
  const [amount, setAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapStep, setSwapStep] = useState<"idle" | "approving" | "swapping">("idle");

  const { address } = useAccount();
  const { toast } = useToast();
  const { reserves, userSwapInfo, approveToken, executeSwap, isConnected, maxSwapAmount, dailySwapLimit } = useSwap();
  // My swaps (filtered by connected wallet address)
  const { history: myHistory, isLoading: myHistoryLoading } = useSwapHistory(true);
  // All swaps (global feed — all wallets)
  const { history: allHistory, isLoading: allHistoryLoading } = useSwapHistory(false);

  const tokenIn = isUsdcToEurc ? TOKENS.USDC : TOKENS.EURC;
  const tokenOut = isUsdcToEurc ? TOKENS.EURC : TOKENS.USDC;

  // Read User Balance (token in)
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenIn.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 }
  });

  // Read User Balance (token out)
  const { data: balanceOut } = useReadContract({
    address: tokenOut.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 }
  });

  // Read Allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, ARCSWAP_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 }
  });

  const parsedAmount = parseDecimals(amount);
  const parsedMax = parseDecimals(String(maxSwapAmount));
  const exceedsMax = parsedAmount > 0n && parsedAmount > parsedMax;
  const needsApproval = parsedAmount > 0n && !exceedsMax && (!allowance || allowance < parsedAmount);

  const currentReserve = reserves
    ? (isUsdcToEurc ? reserves.eurc : reserves.usdc)
    : 0n;

  // BUG FIX #1: MAX = min(userBalance, maxSwapAmountRaw) — not just maxSwapAmount
  const handleMax = () => {
    if (!balance) return;
    // parsedMax is maxSwapAmount in raw units (6 decimals). Take the minimum.
    const effectiveMax = balance < parsedMax ? balance : parsedMax;
    const formatted = formatDecimals(effectiveMax).replace(/0+$/, "").replace(/\.$/, "");
    setAmount(formatted);
  };

  // BUG FIX #2: Proper error toasts + BUG FIX #3: step indicator
  const handleSwap = async () => {
    if (!amount || parsedAmount <= 0n) return;
    try {
      setIsSwapping(true);
      if (needsApproval) {
        setSwapStep("approving");
        const tx = await approveToken(tokenIn.address, amount);
        console.log("Approval TX:", tx);
        toast({
          title: "Approval Submitted",
          description: `Approving ${tokenIn.symbol}... waiting for confirmation.`,
        });
        await new Promise(r => setTimeout(r, 4000));
        refetchAllowance();
        toast({
          title: "Approved ✓",
          description: `${tokenIn.symbol} approved. Click Swap to continue.`,
        });
        setSwapStep("idle");
      } else {
        setSwapStep("swapping");
        const tx = await executeSwap(tokenIn.address, amount);
        console.log("Swap TX:", tx);
        toast({
          title: "Swap Submitted",
          description: `Swapping ${amount} ${tokenIn.symbol} → ${tokenOut.symbol}...`,
        });
        await new Promise(r => setTimeout(r, 4000));
        refetchBalance();
        setAmount("");
        setSwapStep("idle");
        toast({
          title: "Swap Complete ✓",
          description: `Successfully swapped ${amount} ${tokenIn.symbol} for ${tokenOut.symbol}!`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setSwapStep("idle");
      // User-friendly error messages
      const msg = err?.shortMessage || err?.message || "Transaction failed.";
      toast({
        title: "Transaction Failed",
        description: msg.includes("User rejected") ? "You rejected the transaction." : msg,
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Daily limit progress
  const swapsUsed = userSwapInfo?.used ?? 0;
  const swapsTotal = dailySwapLimit;
  const swapsRemaining = userSwapInfo?.remaining ?? dailySwapLimit;
  const progressPct = swapsTotal > 0 ? (swapsUsed / swapsTotal) * 100 : 0;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col mt-8">
      {/* Top Header / Tabs */}
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("swap")}
            className={`text-sm font-semibold transition-colors ${activeTab === "swap" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Swap
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`text-sm font-semibold transition-colors flex items-center gap-1 ${activeTab === "activity" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Activity
          </button>
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {activeTab === "swap" ? (
        <div className="relative flex flex-col gap-1 w-full">

          {/* Sell Container */}
          <div className="bg-card rounded-3xl p-5 shadow-sm border border-border flex flex-col gap-4 relative z-0 hover:border-primary/30 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium text-sm">Sell</span>
              {address && (
                <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full flex items-center gap-1">
                  <img src="/metamask-fox.svg" alt="MetaMask" className="w-4 h-4" /> {formatAddress(address)}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center gap-4">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent text-5xl font-medium outline-none flex-1 w-full min-w-0 text-foreground placeholder:text-muted"
              />
              <div className="flex items-center gap-2 bg-secondary px-3 py-2 rounded-full cursor-pointer hover:bg-secondary/80 transition-colors shrink-0 border border-border/50">
                <span className="text-xl">{tokenIn.icon}</span>
                <span className="font-semibold">{tokenIn.symbol}</span>
                <span className="text-muted-foreground text-xs ml-1">▼</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-medium text-muted-foreground mt-2">
              <span>$0.00</span>
              <div className="flex items-center gap-2">
                <span>Balance: {formatDecimals(balance)}</span>
                {/* BUG FIX #1: MAX uses min(balance, maxSwapAmountRaw) */}
                <button
                  onClick={handleMax}
                  className="text-primary hover:underline ml-1 font-bold"
                >
                  MAX
                </button>
                <span className="text-muted-foreground/60">({maxSwapAmount} limit)</span>
              </div>
            </div>
          </div>

          {/* Swap Arrow Button (Overlapping) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <button
              className="bg-card border-4 border-background p-2 rounded-xl text-muted-foreground hover:text-primary hover:rotate-180 transition-all active:scale-95 shadow-sm"
              onClick={() => {
                setIsUsdcToEurc(!isUsdcToEurc);
                setAmount("");
              }}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>

          {/* Buy Container */}
          <div className="bg-card rounded-3xl p-5 shadow-sm border border-border flex flex-col gap-4 relative z-0 hover:border-primary/30 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium text-sm">Buy</span>
              {address && (
                <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full flex items-center gap-1">
                  <img src="/metamask-fox.svg" alt="MetaMask" className="w-4 h-4" /> {formatAddress(address)}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center gap-4">
              <input
                type="text"
                readOnly
                placeholder="0"
                value={amount || ""}
                className="bg-transparent text-5xl font-medium outline-none flex-1 w-full min-w-0 text-foreground placeholder:text-muted cursor-not-allowed"
              />
              <div className="flex items-center gap-2 bg-secondary px-3 py-2 rounded-full shrink-0 border border-border/50 opacity-90">
                <span className="text-xl">{tokenOut.icon}</span>
                <span className="font-semibold text-foreground">{tokenOut.symbol}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-medium text-muted-foreground mt-2">
              <span>$0.00</span>
              <span>Balance: {formatDecimals(balanceOut)}</span>
            </div>
          </div>

          {/* BUG FIX #4: Rate Info Row */}
          {parsedAmount > 0n && (
            <div className="flex justify-between items-center px-1 py-2 text-xs text-muted-foreground">
              <span>Rate</span>
              <span className="font-semibold text-foreground">
                1 {tokenIn.symbol} = 1 {tokenOut.symbol}
                <span className="text-muted-foreground font-normal ml-1">(1:1 fixed)</span>
              </span>
            </div>
          )}

          {/* BUG FIX #3: Approve → Swap Step Indicator */}
          {isConnected && needsApproval && (
            <div className="flex items-center justify-center gap-3 py-2 px-3 bg-secondary/50 rounded-2xl text-xs font-medium">
              <div className={`flex items-center gap-1.5 ${swapStep === "approving" ? "text-primary" : "text-muted-foreground"}`}>
                {swapStep === "approving"
                  ? <Circle className="w-3.5 h-3.5 animate-pulse text-primary" />
                  : <Circle className="w-3.5 h-3.5" />
                }
                <span>1. Approve {tokenIn.symbol}</span>
              </div>
              <div className="w-4 h-px bg-border" />
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Circle className="w-3.5 h-3.5" />
                <span>2. Swap</span>
              </div>
            </div>
          )}

          {isConnected && !needsApproval && swapStep === "swapping" && (
            <div className="flex items-center justify-center gap-3 py-2 px-3 bg-secondary/50 rounded-2xl text-xs font-medium">
              <div className="flex items-center gap-1.5 text-green-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>1. Approved</span>
              </div>
              <div className="w-4 h-px bg-border" />
              <div className="flex items-center gap-1.5 text-primary">
                <Circle className="w-3.5 h-3.5 animate-pulse" />
                <span>2. Swapping...</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          {!isConnected ? (
            <button className="w-full mt-4 bg-muted text-muted-foreground py-4 rounded-2xl font-bold text-lg cursor-not-allowed">
              Connect Wallet
            </button>
          ) : exceedsMax ? (
            <button className="w-full mt-4 bg-destructive/10 text-destructive border border-destructive/30 py-4 rounded-2xl font-bold text-lg cursor-not-allowed">
              Max {maxSwapAmount} {tokenIn.symbol} per swap
            </button>
          ) : parsedAmount > currentReserve ? (
            <button className="w-full mt-4 bg-destructive text-destructive-foreground py-4 rounded-2xl font-bold text-lg cursor-not-allowed shadow-md">
              Insufficient Liquidity
            </button>
          ) : userSwapInfo?.remaining === 0 ? (
            <button className="w-full mt-4 bg-muted text-muted-foreground py-4 rounded-2xl font-bold text-lg cursor-not-allowed">
              Daily Limit Reached ({dailySwapLimit} swaps/day)
            </button>
          ) : (
            <button
              onClick={handleSwap}
              disabled={!amount || parsedAmount <= 0n || isSwapping}
              className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg transition-all shadow-md active:scale-[0.98] ${
                !amount || parsedAmount <= 0n || isSwapping
                  ? "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
              }`}
            >
              {swapStep === "approving"
                ? `Approving ${tokenIn.symbol}...`
                : swapStep === "swapping"
                ? "Swapping..."
                : needsApproval
                ? `Approve ${tokenIn.symbol}`
                : "Swap"}
            </button>
          )}

          {/* BUG FIX #5: Daily Swap Progress Bar */}
          {isConnected && userSwapInfo && (
            <div className="mt-3 px-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Daily Swaps Used</span>
                <span className={swapsRemaining === 0 ? "text-destructive font-semibold" : "text-foreground font-semibold"}>
                  {swapsUsed} / {swapsTotal}
                  {swapsRemaining === 0 && " — Limit Reached"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressPct >= 100 ? "bg-destructive" : progressPct >= 66 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              {swapsRemaining > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  {swapsRemaining} swap{swapsRemaining !== 1 ? "s" : ""} remaining today
                </p>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className="bg-card rounded-3xl p-5 shadow-sm border border-border min-h-[400px] flex flex-col">

          {/* My Swaps / All Swaps Toggle */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-space-grotesk font-semibold text-foreground">Activity</h2>
            <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
              <button
                onClick={() => setActivityView("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activityView === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="w-3 h-3" />
                All Swaps
              </button>
              <button
                onClick={() => setActivityView("mine")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activityView === "mine"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="w-3 h-3" />
                My Swaps
              </button>
            </div>
          </div>

          {/* ALL SWAPS — Global Feed */}
          {activityView === "all" ? (
            allHistoryLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <Activity className="w-6 h-6 animate-pulse" />
                <span className="text-sm">Loading global feed...</span>
              </div>
            ) : allHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <Activity className="w-6 h-6 opacity-30" />
                <span className="text-sm">No swaps on this network yet.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <span>Wallet</span>
                  <span className="text-center">Pair</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Time</span>
                </div>
                {allHistory.map((tx, i) => {
                  const isMyTx = address && tx.user.toLowerCase() === address.toLowerCase();
                  const shortAddr = `${tx.user.slice(0, 6)}...${tx.user.slice(-4)}`;
                  return (
                    <a
                      key={i}
                      href={`https://testnet.arcscan.app/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2.5 rounded-xl transition-colors ${
                        isMyTx
                          ? "bg-primary/10 border border-primary/20 hover:bg-primary/15"
                          : "hover:bg-secondary/60 border border-transparent"
                      }`}
                    >
                      {/* Wallet */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isMyTx ? "bg-primary" : "bg-muted-foreground/40"
                        }`} />
                        <span className={`text-xs font-mono truncate ${
                          isMyTx ? "text-primary font-semibold" : "text-muted-foreground"
                        }`}>
                          {isMyTx ? "You" : shortAddr}
                        </span>
                      </div>
                      {/* Pair */}
                      <div className="flex items-center gap-1 text-xs font-semibold text-foreground shrink-0">
                        <span>{tx.tokenInSymbol}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{tx.tokenOutSymbol}</span>
                      </div>
                      {/* Amount */}
                      <span className="text-xs font-bold text-green-500 text-right shrink-0">
                        {tx.amountOutFormatted}
                      </span>
                      {/* Time */}
                      <span className="text-[10px] text-muted-foreground text-right shrink-0 tabular-nums">
                        {timeAgo(tx.timestamp)}
                      </span>
                    </a>
                  );
                })}
              </div>
            )
          ) : (
            /* MY SWAPS */
            !isConnected ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <User className="w-8 h-8 opacity-30" />
                <p className="text-sm">Connect your wallet to see your swaps.</p>
              </div>
            ) : myHistoryLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <Activity className="w-6 h-6 animate-pulse" />
                <span className="text-sm">Loading your swaps...</span>
              </div>
            ) : myHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <Activity className="w-6 h-6 opacity-30" />
                <p className="text-sm">No swaps yet. Make your first swap!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {myHistory.map((tx, i) => (
                  <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-foreground text-sm">
                        {tx.amountInFormatted} {tx.tokenInSymbol} → {tx.amountOutFormatted} {tx.tokenOutSymbol}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(tx.timestamp)} · {new Date(tx.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href={`https://testnet.arcscan.app/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0 ml-3"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
