"use client";

import { useAccount, useReadContract } from "wagmi";
import { ARCSWAP_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS } from "@/lib/constants";

export function useAdminRole() {
  const { address } = useAccount();

  const { data: isAdmin, isLoading, error } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    }
  });

  return {
    isAdmin: !!isAdmin,
    isLoading,
    error
  };
}
