"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ARCSWAP_ABI, ERC20_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS } from "@/lib/constants";
import { parseDecimals } from "@/lib/utils";

export function useSwap() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Read reserves
  const { data: reserves, refetch: refetchReserves } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "getReserves",
    query: { refetchInterval: 10000 }
  });

  // Read user swap info
  const { data: userSwapInfo, refetch: refetchUserInfo } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "getUserSwapInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 }
  });

  // Read max swap amount from contract
  const { data: maxSwapAmountRaw } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "maxSwapAmount",
    query: { refetchInterval: 30000 }
  });

  // Read daily swap limit from contract
  const { data: dailySwapLimitRaw } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "dailySwapLimit",
    query: { refetchInterval: 30000 }
  });

  // Approve token
  const approveToken = async (tokenAddress: `0x${string}`, amountStr: string) => {
    if (!amountStr) throw new Error("Invalid amount");
    const amount = parseDecimals(amountStr);
    const tx = await writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ARCSWAP_ADDRESS, amount],
    });
    return tx;
  };

  // Execute Swap
  const executeSwap = async (tokenInAddress: `0x${string}`, amountStr: string) => {
    if (!amountStr) throw new Error("Invalid amount");
    const amount = parseDecimals(amountStr);
    const tx = await writeContractAsync({
      address: ARCSWAP_ADDRESS,
      abi: ARCSWAP_ABI,
      functionName: "swap",
      args: [tokenInAddress, amount],
    });
    return tx;
  };

  // maxSwapAmount in human-readable form (e.g. 1.0)
  const maxSwapAmount = maxSwapAmountRaw ? Number(maxSwapAmountRaw) / 1_000_000 : 1;
  const dailySwapLimit = dailySwapLimitRaw ? Number(dailySwapLimitRaw) : 3;

  return {
    reserves: reserves ? { usdc: reserves[0], eurc: reserves[1] } : null,
    userSwapInfo: userSwapInfo ? {
      used: Number(userSwapInfo[0]),
      remaining: Number(userSwapInfo[1]),
      nextReset: Number(userSwapInfo[2])
    } : null,
    maxSwapAmount,
    dailySwapLimit,
    approveToken,
    executeSwap,
    refetchReserves,
    refetchUserInfo,
    isConnected,
  };
}
