import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDecimals(amount: bigint | undefined, decimals: number = 6): string {
  if (amount === undefined) return "0.00";
  const numString = amount.toString();
  if (numString === "0") return "0.00";
  
  const padded = numString.padStart(decimals + 1, "0");
  const integerPart = padded.slice(0, -decimals);
  const fractionalPart = padded.slice(-decimals);
  
  return `${integerPart}.${fractionalPart.slice(0, 2)}`;
}

export function parseDecimals(amount: string, decimals: number = 6): bigint {
  if (!amount) return 0n;
  try {
    const [int, frac = ""] = amount.split(".");
    const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);
    return BigInt(int + paddedFrac);
  } catch (_) {
    return 0n;
  }
}
