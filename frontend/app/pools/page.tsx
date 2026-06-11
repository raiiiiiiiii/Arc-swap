"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { ARCSWAP_ABI, ERC20_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS, TOKENS } from "@/lib/constants";
import { formatDecimals, parseDecimals } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  Droplets,
  TrendingUp,
  Info,
  ArrowDownToLine,
  ShieldAlert,
  Loader2,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(val: bigint | undefined): string {
  if (val === undefined) return "—";
  return formatDecimals(val);
}

function pct(a: bigint, b: bigint): number {
  const total = a + b;
  if (total === 0n) return 50;
  return Number((a * 10000n) / total) / 100;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  const [depositAmount, setDepositAmount] = useState("");
  const [depositToken, setDepositToken] = useState<"USDC" | "EURC">("USDC");
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

  // ── On-chain reads ──────────────────────────────────────────────────────
  const { data: reserves, refetch: refetchReserves } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "getReserves",
    query: { refetchInterval: 10000 },
  });

  const { data: isAdmin } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const tokenAddr =
    depositToken === "USDC" ? TOKENS.USDC.address : TOKENS.EURC.address;

  const { data: userBalance } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, ARCSWAP_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  // ── Derived values ──────────────────────────────────────────────────────
  const usdcReserve = reserves?.[0] ?? 0n;
  const eurcReserve = reserves?.[1] ?? 0n;
  const tvl = usdcReserve + eurcReserve;
  const usdcPct = pct(usdcReserve, eurcReserve);
  const eurcPct = 100 - usdcPct;

  const parsedDeposit = parseDecimals(depositAmount);
  const needsApproval = parsedDeposit > 0n && (!allowance || allowance < parsedDeposit);

  // ── Write hooks ─────────────────────────────────────────────────────────
  const { writeContractAsync: approve } = useWriteContract();
  const { writeContractAsync: deposit } = useWriteContract();

  const handleApprove = async () => {
    if (!parsedDeposit) return;
    try {
      setIsApproving(true);
      await approve({
        address: tokenAddr as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ARCSWAP_ADDRESS, parsedDeposit],
      });
      toast({ title: "Approval Submitted", description: "Waiting for confirmation..." });
      await new Promise(r => setTimeout(r, 4000));
      refetchAllowance();
      toast({ title: "Approved ✓", description: `${depositToken} approved for deposit.` });
    } catch (err: any) {
      toast({
        title: "Approval Failed",
        description: err?.shortMessage?.includes("User rejected") ? "You rejected the transaction." : err?.shortMessage || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async () => {
    if (!parsedDeposit || !isAdmin) return;
    try {
      setIsDepositing(true);
      await deposit({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "depositLiquidity",
        args: [tokenAddr as `0x${string}`, parsedDeposit],
      });
      toast({ title: "Deposit Submitted", description: "Adding liquidity..." });
      await new Promise(r => setTimeout(r, 4000));
      refetchReserves();
      setDepositAmount("");
      toast({ title: "Liquidity Added ✓", description: `${depositAmount} ${depositToken} added to the pool.` });
    } catch (err: any) {
      toast({
        title: "Deposit Failed",
        description: err?.shortMessage?.includes("User rejected") ? "You rejected the transaction." : err?.shortMessage || "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setIsDepositing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full py-8 px-4">

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-space-grotesk font-bold text-foreground flex items-center gap-3">
          <Droplets className="w-8 h-8 text-primary" />
          Liquidity Pools
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          USDC / EURC fixed-rate pool · 1:1 swap · Zero slippage
        </p>
      </div>

      {/* TVL Overview Card */}
      <div className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Value Locked</span>
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>

        <div className="text-4xl font-space-grotesk font-bold text-foreground">
          {reserves ? `$${fmt(tvl)}` : <span className="animate-pulse text-muted-foreground">Loading...</span>}
        </div>

        {/* Pool Ratio Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-blue-400">💵 USDC {usdcPct.toFixed(1)}%</span>
            <span className="text-green-400">💶 EURC {eurcPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-700"
              style={{ width: `${usdcPct}%` }}
            />
            <div
              className="h-full bg-green-500 transition-all duration-700"
              style={{ width: `${eurcPct}%` }}
            />
          </div>
        </div>

        {/* Reserve Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 border border-border rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">💵</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase">USDC Reserve</span>
            </div>
            <p className="text-xl font-bold font-space-grotesk text-foreground">{fmt(usdcReserve)}</p>
            <p className="text-[10px] text-muted-foreground">USD Coin</p>
          </div>
          <div className="bg-secondary/50 border border-border rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">💶</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase">EURC Reserve</span>
            </div>
            <p className="text-xl font-bold font-space-grotesk text-foreground">{fmt(eurcReserve)}</p>
            <p className="text-[10px] text-muted-foreground">Euro Coin</p>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            This is a <strong className="text-foreground">fixed 1:1 reserve pool</strong>. There is no impermanent loss.
            Liquidity funds all USDC ↔ EURC swaps on the platform.
          </span>
        </div>
      </div>

      {/* Add Liquidity Card */}
      <div className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-space-grotesk font-semibold text-foreground flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            Add Liquidity
          </h2>
          {/* Admin badge */}
          {isConnected && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              isAdmin
                ? "bg-green-500/10 text-green-500 border-green-500/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            }`}>
              {isAdmin ? "✓ Admin" : "Non-Admin"}
            </span>
          )}
        </div>

        {/* Admin-only warning for non-admins */}
        {isConnected && !isAdmin && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Admin Only:</strong> Currently only the pool admin can deposit liquidity.
              Public liquidity provision will be enabled in a future contract upgrade.
            </span>
          </div>
        )}

        {/* Token Selector */}
        <div className="flex gap-2">
          {(["USDC", "EURC"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setDepositToken(t); setDepositAmount(""); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold border transition-all ${
                depositToken === t
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              <span>{t === "USDC" ? "💵" : "💶"}</span> {t}
            </button>
          ))}
        </div>

        {/* Amount Input */}
        <div className="bg-secondary/50 border border-border rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">Amount</span>
            {isConnected && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Balance: <span className="font-semibold text-foreground">{fmt(userBalance)}</span></span>
                <button
                  onClick={() => {
                    if (userBalance) setDepositAmount(fmt(userBalance).replace(/,/g, ""));
                  }}
                  className="text-primary font-bold hover:underline"
                >
                  MAX
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="bg-transparent text-3xl font-medium outline-none flex-1 min-w-0 text-foreground placeholder:text-muted"
              disabled={!isConnected || !isAdmin}
            />
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl shrink-0">
              <span>{depositToken === "USDC" ? "💵" : "💶"}</span>
              <span className="font-semibold text-sm">{depositToken}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {!isConnected ? (
          <button className="w-full py-4 rounded-2xl font-bold text-lg bg-muted text-muted-foreground cursor-not-allowed">
            Connect Wallet
          </button>
        ) : !isAdmin ? (
          <button className="w-full py-4 rounded-2xl font-bold text-lg bg-muted text-muted-foreground cursor-not-allowed">
            Admin Access Required
          </button>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || !depositAmount}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
              isApproving || !depositAmount
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-primary/25"
            }`}
          >
            {isApproving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Approving...
              </span>
            ) : (
              `Approve ${depositToken}`
            )}
          </button>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !depositAmount || parsedDeposit <= 0n}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
              isDepositing || !depositAmount || parsedDeposit <= 0n
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-500 shadow-md hover:shadow-green-500/25"
            }`}
          >
            {isDepositing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Depositing...
              </span>
            ) : (
              `Add ${depositAmount || "0"} ${depositToken} to Pool`
            )}
          </button>
        )}
      </div>

      {/* Coming Soon Card */}
      <div className="bg-card border border-dashed border-border rounded-3xl p-6 text-center flex flex-col items-center gap-3 opacity-60">
        <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center text-xl">🔮</div>
        <div>
          <p className="font-semibold text-foreground">Public LP + Fee Rewards</p>
          <p className="text-xs text-muted-foreground mt-1">
            Coming in v2 — anyone will be able to provide liquidity and earn a share of swap fees.
          </p>
        </div>
        <span className="text-[10px] font-bold bg-secondary text-muted-foreground px-3 py-1 rounded-full uppercase tracking-wider">
          Coming Soon
        </span>
      </div>

    </div>
  );
}
