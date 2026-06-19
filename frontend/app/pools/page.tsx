"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { ARCSWAP_ABI, ERC20_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS, TOKENS } from "@/lib/constants";
import { formatDecimals, parseDecimals } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  Droplets,
  TrendingUp,
  Info,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  Loader2,
  Wallet,
  ShieldCheck,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val: bigint | undefined): string {
  if (val === undefined || val === null) return "0.00";
  return formatDecimals(val);
}

function pct(a: bigint, b: bigint): number {
  const total = a + b;
  if (total === 0n) return 50;
  return Number((a * 10000n) / total) / 100;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"add" | "remove">("add");
  const [depositToken, setDepositToken] = useState<"USDC" | "EURC">("USDC");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawToken, setWithdrawToken] = useState<"USDC" | "EURC">("USDC");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const tokenAddr = depositToken === "USDC" ? TOKENS.USDC.address : TOKENS.EURC.address;
  const withdrawTokenAddr = withdrawToken === "USDC" ? TOKENS.USDC.address : TOKENS.EURC.address;

  // ── On-chain reads ─────────────────────────────────────────────────────────
  const { data: poolStats, refetch: refetchPool } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "getPoolStats",
    query: { refetchInterval: 10000 },
  });

  const { data: lpBalance, refetch: refetchLp } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "getLpBalance",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

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

  // ── Derived values ─────────────────────────────────────────────────────────
  const usdcReserve = poolStats?.[0] ?? 0n;
  const eurcReserve = poolStats?.[1] ?? 0n;
  const totalLpUSDC = poolStats?.[2] ?? 0n;
  const totalLpEURC = poolStats?.[3] ?? 0n;
  const totalLpProviders = poolStats?.[4] ?? 0n;
  const tvl = usdcReserve + eurcReserve;
  const usdcPct = pct(usdcReserve, eurcReserve);
  const eurcPct = 100 - usdcPct;

  const myUsdcLp = lpBalance?.[0] ?? 0n;
  const myEurcLp = lpBalance?.[1] ?? 0n;
  const hasMyLp = myUsdcLp > 0n || myEurcLp > 0n;

  const parsedDeposit = parseDecimals(depositAmount);
  const parsedWithdraw = parseDecimals(withdrawAmount);
  const needsApproval = parsedDeposit > 0n && (!allowance || allowance < parsedDeposit);

  // ── Write hooks ────────────────────────────────────────────────────────────
  const { writeContractAsync } = useWriteContract();

  const handleApprove = async () => {
    if (!parsedDeposit) return;
    try {
      setIsApproving(true);
      await writeContractAsync({
        address: tokenAddr as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ARCSWAP_ADDRESS, parsedDeposit],
      });
      toast({ title: "Approval Submitted", description: "Waiting for confirmation..." });
      await new Promise(r => setTimeout(r, 4000));
      refetchAllowance();
      toast({ title: "Approved ✓", description: `${depositToken} approved.` });
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
    if (!parsedDeposit) return;
    try {
      setIsDepositing(true);
      await writeContractAsync({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "addLiquidity",
        args: [tokenAddr as `0x${string}`, parsedDeposit],
      });
      toast({ title: "Adding Liquidity...", description: `Depositing ${depositAmount} ${depositToken}` });
      await new Promise(r => setTimeout(r, 4000));
      refetchPool();
      refetchLp();
      setDepositAmount("");
      toast({ title: "Liquidity Added ✓", description: `${depositAmount} ${depositToken} added to pool!` });
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

  const handleWithdraw = async () => {
    if (!parsedWithdraw) return;
    const myLp = withdrawToken === "USDC" ? myUsdcLp : myEurcLp;
    if (parsedWithdraw > myLp) {
      toast({ title: "Insufficient LP Balance", description: `You only have ${fmt(myLp)} ${withdrawToken} in the pool.`, variant: "destructive" });
      return;
    }
    try {
      setIsWithdrawing(true);
      await writeContractAsync({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "removeLiquidity",
        args: [withdrawTokenAddr as `0x${string}`, parsedWithdraw],
      });
      toast({ title: "Withdrawing...", description: `Removing ${withdrawAmount} ${withdrawToken}` });
      await new Promise(r => setTimeout(r, 4000));
      refetchPool();
      refetchLp();
      setWithdrawAmount("");
      toast({ title: "Withdrawn ✓", description: `${withdrawAmount} ${withdrawToken} returned to your wallet!` });
    } catch (err: any) {
      toast({
        title: "Withdrawal Failed",
        description: err?.shortMessage?.includes("User rejected") ? "You rejected the transaction." : err?.shortMessage || "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
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
          USDC / EURC fixed-rate pool · Anyone can provide liquidity
        </p>
      </div>

      {/* TVL Overview Card */}
      <div className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Value Locked</span>
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>

        <div className="text-4xl font-space-grotesk font-bold text-foreground">
          {poolStats ? `$${fmt(tvl)}` : <span className="animate-pulse text-muted-foreground">Loading...</span>}
        </div>

        {/* Pool Ratio Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-blue-400">💵 USDC {usdcPct.toFixed(1)}%</span>
            <span className="text-green-400">💶 EURC {eurcPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden flex">
            <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${usdcPct}%` }} />
            <div className="h-full bg-green-500 transition-all duration-700" style={{ width: `${eurcPct}%` }} />
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
          </div>
          <div className="bg-secondary/50 border border-border rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">💶</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase">EURC Reserve</span>
            </div>
            <p className="text-xl font-bold font-space-grotesk text-foreground">{fmt(eurcReserve)}</p>
          </div>
        </div>

        {/* Pool Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-secondary/30 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">LP Providers</p>
            <p className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-primary" />
              {totalLpProviders.toString()}
            </p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">LP USDC</p>
            <p className="text-lg font-bold text-foreground">{fmt(totalLpUSDC)}</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">LP EURC</p>
            <p className="text-lg font-bold text-foreground">{fmt(totalLpEURC)}</p>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            This is a <strong className="text-foreground">fixed 1:1 reserve pool</strong>. Anyone can add liquidity and withdraw it anytime. No impermanent loss.
          </span>
        </div>
      </div>

      {/* My Liquidity Card */}
      {isConnected && hasMyLp && (
        <div className="bg-card border border-primary/30 rounded-3xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <h2 className="text-base font-space-grotesk font-semibold text-foreground">My Liquidity</h2>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Active</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {myUsdcLp > 0n && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">💵 USDC Deposited</p>
                <p className="text-xl font-bold text-blue-400">{fmt(myUsdcLp)}</p>
              </div>
            )}
            {myEurcLp > 0n && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">💶 EURC Deposited</p>
                <p className="text-xl font-bold text-green-400">{fmt(myEurcLp)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Remove Liquidity Card */}
      <div className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-5 shadow-sm">

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "add"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" /> Add Liquidity
          </button>
          <button
            onClick={() => setActiveTab("remove")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "remove"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" /> Remove
          </button>
        </div>

        {/* ── ADD LIQUIDITY ── */}
        {activeTab === "add" && (
          <>
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
                      onClick={() => { if (userBalance) setDepositAmount(fmt(userBalance).replace(/,/g, "")); }}
                      className="text-primary font-bold hover:underline"
                    >MAX</button>
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
                  disabled={!isConnected}
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
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isApproving || !depositAmount}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                  isApproving || !depositAmount
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                }`}
              >
                {isApproving ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Approving...</span>
                ) : `Approve ${depositToken}`}
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
                  <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Adding Liquidity...</span>
                ) : `Add ${depositAmount || "0"} ${depositToken} to Pool`}
              </button>
            )}
          </>
        )}

        {/* ── REMOVE LIQUIDITY ── */}
        {activeTab === "remove" && (
          <>
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <Wallet className="w-8 h-8 opacity-30" />
                <p className="text-sm">Connect your wallet to withdraw liquidity.</p>
              </div>
            ) : !hasMyLp ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <Droplets className="w-8 h-8 opacity-30" />
                <p className="text-sm">You have no liquidity in this pool.</p>
                <button onClick={() => setActiveTab("add")} className="text-primary text-sm font-semibold hover:underline">
                  Add Liquidity →
                </button>
              </div>
            ) : (
              <>
                {/* My LP Summary */}
                <div className="grid grid-cols-2 gap-3">
                  {myUsdcLp > 0n && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Your USDC LP</p>
                      <p className="text-lg font-bold text-blue-400">{fmt(myUsdcLp)}</p>
                    </div>
                  )}
                  {myEurcLp > 0n && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Your EURC LP</p>
                      <p className="text-lg font-bold text-green-400">{fmt(myEurcLp)}</p>
                    </div>
                  )}
                </div>

                {/* Token Selector */}
                <div className="flex gap-2">
                  {(["USDC", "EURC"] as const).filter(t => t === "USDC" ? myUsdcLp > 0n : myEurcLp > 0n).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setWithdrawToken(t); setWithdrawAmount(""); }}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold border transition-all ${
                        withdrawToken === t
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
                    <span className="text-xs text-muted-foreground font-medium">Amount to Withdraw</span>
                    <button
                      onClick={() => {
                        const myLp = withdrawToken === "USDC" ? myUsdcLp : myEurcLp;
                        setWithdrawAmount(fmt(myLp).replace(/,/g, ""));
                      }}
                      className="text-xs text-primary font-bold hover:underline"
                    >MAX</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-transparent text-3xl font-medium outline-none flex-1 min-w-0 text-foreground placeholder:text-muted"
                    />
                    <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl shrink-0">
                      <span>{withdrawToken === "USDC" ? "💵" : "💶"}</span>
                      <span className="font-semibold text-sm">{withdrawToken}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAmount || parsedWithdraw <= 0n}
                  className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                    isWithdrawing || !withdrawAmount || parsedWithdraw <= 0n
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md"
                  }`}
                >
                  {isWithdrawing ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Withdrawing...</span>
                  ) : `Withdraw ${withdrawAmount || "0"} ${withdrawToken}`}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Admin Liquidity Badge */}
      <div className="flex items-center gap-2 p-3 bg-secondary/40 border border-border/50 rounded-2xl text-xs text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>Admin can also manage pool reserves via the <strong className="text-foreground">Admin Vault</strong> panel.</span>
      </div>

    </div>
  );
}
