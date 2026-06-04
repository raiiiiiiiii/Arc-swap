"use client";

import { useAdminRole } from "@/hooks/useAdminRole";
import { useSwap } from "@/hooks/useSwap";
import { useSwapHistory } from "@/hooks/useSwapHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDecimals, parseDecimals } from "@/lib/utils";
import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { ARCSWAP_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS, TOKENS } from "@/lib/constants";
import { ShieldAlert, Settings, Coins, Activity, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function AdminDashboard() {
  const { isAdmin, isLoading: isAdminLoading, error } = useAdminRole();
  const { address } = useAccount();
  const { reserves, refetchReserves, approveToken, maxSwapAmount, dailySwapLimit } = useSwap();
  const { history: globalHistory, isLoading: globalHistoryLoading } = useSwapHistory(false);
  const { writeContractAsync } = useWriteContract();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<"USDC" | "EURC">("USDC");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState(address || "");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawToken, setWithdrawToken] = useState<"USDC" | "EURC">("USDC");

  const [newMaxAmount, setNewMaxAmount] = useState("");
  const [newDailyLimit, setNewDailyLimit] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  if (isAdminLoading) {
    return <div className="flex justify-center items-center h-64">Loading Admin Status...</div>;
  }
  
  if (!isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto mt-20 border-destructive/50 bg-destructive/10">
        <CardContent className="p-8 text-center flex flex-col items-center">
          <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You do not have the required ADMIN_ROLE to view this dashboard.
          </p>
          <div className="bg-background/50 p-3 rounded text-xs text-left w-full overflow-hidden text-ellipsis">
            <p><strong>Connected Wallet:</strong> {address || "Not connected"}</p>
            <p><strong>Required Wallet:</strong> 0x1fEc1e7e84A4f850a7a7Ce1E3D02b6bBDE7DAB3f</p>
            <p><strong>Contract:</strong> {ARCSWAP_ADDRESS}</p>
            {error && <p className="text-destructive mt-2"><strong>Error:</strong> {error.message}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleDeposit = async () => {
    try {
      setIsDepositing(true);
      const token = TOKENS[selectedToken];
      const amount = parseDecimals(depositAmount);
      
      toast({
        title: "Approving",
        description: `Please approve ${depositAmount} ${selectedToken} in your wallet...`,
      });
      
      // Step 1: Approve Token
      await approveToken(token.address, depositAmount);
      await new Promise(r => setTimeout(r, 4000)); // wait for approval to mine
      
      toast({
        title: "Depositing",
        description: `Please confirm the deposit of ${depositAmount} ${selectedToken}...`,
      });
      
      // Step 2: Deposit Liquidity
      const tx = await writeContractAsync({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "depositLiquidity",
        args: [token.address, amount]
      });
      
      toast({
        title: "Deposit Initiated",
        description: `Tx hash: ${tx}`,
      });
      
      await new Promise(r => setTimeout(r, 4000));
      refetchReserves();
      setDepositAmount("");
      
      toast({
        title: "Deposit Successful",
        description: `Successfully deposited ${depositAmount} ${selectedToken}`,
      });
    } catch (e) {
      toast({
        title: "Deposit Failed",
        description: (e as Error).message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setIsWithdrawing(true);
      const token = TOKENS[withdrawToken];
      const amount = parseDecimals(withdrawAmount);
      
      const tx = await writeContractAsync({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "withdrawLiquidity",
        args: [token.address, amount, withdrawTo as `0x${string}`]
      });
      
      toast({
        title: "Withdrawal Initiated",
        description: `Tx hash: ${tx}`,
      });
      
      await new Promise(r => setTimeout(r, 4000));
      refetchReserves();
      setWithdrawAmount("");
      
      toast({
        title: "Withdrawal Successful",
        description: `Successfully withdrew ${withdrawAmount} ${withdrawToken}`,
      });
    } catch (e) {
      toast({
        title: "Withdrawal Failed",
        description: (e as Error).message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSetMaxAmount = async () => {
    if (!newMaxAmount) return;
    try {
      setIsSavingSettings(true);
      const amountInDecimals = BigInt(Math.round(parseFloat(newMaxAmount) * 1_000_000));
      await writeContractAsync({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "setMaxSwapAmount",
        args: [amountInDecimals]
      });
      toast({ title: "✅ Max Swap Amount Updated", description: `Now set to ${newMaxAmount} tokens per swap` });
      setNewMaxAmount("");
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSetDailyLimit = async () => {
    if (!newDailyLimit) return;
    try {
      setIsSavingSettings(true);
      await writeContractAsync({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "setDailySwapLimit",
        args: [BigInt(newDailyLimit)]
      });
      toast({ title: "✅ Daily Limit Updated", description: `Now set to ${newDailyLimit} swaps/day` });
      setNewDailyLimit("");
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-space-grotesk font-bold">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">💵</span> USDC Reserve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold font-space-grotesk text-primary">
              {formatDecimals(reserves?.usdc)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">💶</span> EURC Reserve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold font-space-grotesk text-primary">
              {formatDecimals(reserves?.eurc)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" /> Deposit Liquidity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <select 
                className="bg-secondary rounded-lg px-4 py-2 border outline-none h-10"
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value as "USDC" | "EURC")}
              >
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
              <input
                type="number"
                placeholder="Amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 bg-background rounded-lg px-4 py-2 border outline-none min-w-0"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleDeposit}
              disabled={!depositAmount || isDepositing}
            >
              {isDepositing ? "Processing..." : "Approve & Deposit"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Note: You must approve the contract to spend your tokens before depositing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-destructive" /> Withdraw Liquidity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <select 
                className="bg-secondary rounded-lg px-4 py-2 border outline-none h-10"
                value={withdrawToken}
                onChange={(e) => setWithdrawToken(e.target.value as "USDC" | "EURC")}
              >
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
              <input
                type="number"
                placeholder="Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="flex-1 bg-background rounded-lg px-4 py-2 border outline-none min-w-0"
              />
            </div>
            <input
              type="text"
              placeholder="Destination Address (0x...)"
              value={withdrawTo}
              onChange={(e) => setWithdrawTo(e.target.value)}
              className="w-full bg-background rounded-lg px-4 py-2 border outline-none h-10"
            />
            <Button 
              variant="destructive"
              className="w-full" 
              onClick={handleWithdraw}
              disabled={!withdrawAmount || !withdrawTo || isWithdrawing}
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw"}
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Security Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-xl border border-border flex items-center justify-between">
              <div>
                <p className="font-semibold">Pause Contract</p>
                <p className="text-xs text-muted-foreground">Emergency stop all swaps</p>
              </div>
              <Button variant="destructive" size="sm">Pause</Button>
            </div>
          </CardContent>
        </Card>

        {/* Contract Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> Swap Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Current values */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Max Per Swap</p>
                <p className="text-2xl font-bold text-primary">{maxSwapAmount}</p>
                <p className="text-xs text-muted-foreground">USDC/EURC</p>
              </div>
              <div className="bg-secondary/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Daily Limit</p>
                <p className="text-2xl font-bold text-primary">{dailySwapLimit}</p>
                <p className="text-xs text-muted-foreground">swaps / 24h</p>
              </div>
            </div>
            {/* Change Max Swap Amount */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Change Max Swap Amount</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={`Current: ${maxSwapAmount}`}
                  value={newMaxAmount}
                  onChange={(e) => setNewMaxAmount(e.target.value)}
                  className="flex-1 bg-background rounded-lg px-4 py-2 border outline-none text-sm"
                />
                <Button size="sm" onClick={handleSetMaxAmount} disabled={!newMaxAmount || isSavingSettings}>
                  Set
                </Button>
              </div>
            </div>
            {/* Change Daily Limit */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Change Daily Swap Limit</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={`Current: ${dailySwapLimit}`}
                  value={newDailyLimit}
                  onChange={(e) => setNewDailyLimit(e.target.value)}
                  className="flex-1 bg-background rounded-lg px-4 py-2 border outline-none text-sm"
                />
                <Button size="sm" onClick={handleSetDailyLimit} disabled={!newDailyLimit || isSavingSettings}>
                  Set
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Global Swap Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {globalHistoryLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading history...</p>
            ) : globalHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No swaps have been made yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                    <tr>
                      <th className="px-6 py-3">Time</th>
                      <th className="px-6 py-3">User Address</th>
                      <th className="px-6 py-3">Swap Detail</th>
                      <th className="px-6 py-3 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalHistory.map((tx, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {formatAddress(tx.user)}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          <span className="text-destructive">-{tx.amountInFormatted} {tx.tokenInSymbol}</span>
                          <span className="mx-2">→</span>
                          <span className="text-primary">+{tx.amountOutFormatted} {tx.tokenOutSymbol}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a 
                            href={`https://testnet.arcscan.app/tx/${tx.hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-500 hover:underline flex items-center justify-end gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
