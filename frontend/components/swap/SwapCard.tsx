"use client";

import { useState } from "react";
import { useSwap } from "@/hooks/useSwap";
import { useSwapHistory } from "@/hooks/useSwapHistory";
import { TOKENS, ARCSWAP_ADDRESS } from "@/lib/constants";
import { ArrowDown, Activity, Settings, ExternalLink } from "lucide-react";
import { formatDecimals, parseDecimals } from "@/lib/utils";
import { useAccount, useReadContract } from "wagmi";
import { ERC20_ABI } from "@/lib/abis";

export function SwapCard() {
  const [activeTab, setActiveTab] = useState<"swap" | "activity">("swap");
  const [isUsdcToEurc, setIsUsdcToEurc] = useState(true);
  const [amount, setAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  
  const { address } = useAccount();
  const { reserves, userSwapInfo, approveToken, executeSwap, isConnected, maxSwapAmount, dailySwapLimit } = useSwap();
  const { history, isLoading: historyLoading } = useSwapHistory();

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

  const handleMax = () => {
    if (balance) {
      setAmount(formatDecimals(balance).replace(/0+$/, "").replace(/\.$/, ""));
    }
  };

  const handleSwap = async () => {
    if (!amount || parsedAmount <= 0n) return;
    try {
      setIsSwapping(true);
      if (needsApproval) {
        const tx = await approveToken(tokenIn.address, amount);
        console.log("Approval TX:", tx);
        await new Promise(r => setTimeout(r, 4000)); 
        refetchAllowance();
      } else {
        const tx = await executeSwap(tokenIn.address, amount);
        console.log("Swap TX:", tx);
        await new Promise(r => setTimeout(r, 4000));
        refetchBalance();
        setAmount("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSwapping(false);
    }
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

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
        <div className="relative flex flex-col gap-1 w-full relative">
          
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
                <button 
                  onClick={() => setAmount(String(maxSwapAmount))} 
                  className="text-primary hover:underline ml-1 font-bold"
                >
                  MAX ({maxSwapAmount} limit)
                </button>
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
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg"
              }`}
            >
              {isSwapping ? "Processing..." : needsApproval ? `Approve ${tokenIn.symbol}` : "Swap"}
            </button>
          )}

        </div>
      ) : (
        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border min-h-[400px]">
          <h2 className="text-xl font-space-grotesk font-semibold mb-4 text-foreground">Recent Activity</h2>
          
          {!isConnected ? (
            <p className="text-center text-muted-foreground py-8">Connect your wallet to see history.</p>
          ) : historyLoading ? (
            <p className="text-center text-muted-foreground py-8 flex flex-col items-center gap-2">
               <Activity className="w-6 h-6 animate-pulse" />
               Loading history...
            </p>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent swaps found.</p>
          ) : (
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {history.map((tx, i) => (
                <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-foreground">
                      Swap {tx.tokenInSymbol} for {tx.tokenOutSymbol}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-bold text-primary">
                      + {tx.amountOutFormatted}
                    </p>
                    <a 
                      href={`https://testnet.arcscan.app/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
