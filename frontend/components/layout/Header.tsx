"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Moon, Sun, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { usePublicClient } from "wagmi";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // BUG FIX: Real gas price from chain instead of hardcoded "20.4 Gwei"
  const [gasPrice, setGasPrice] = useState<string | null>(null);
  const publicClient = usePublicClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!publicClient) return;

    const fetchGasPrice = async () => {
      try {
        const price = await publicClient.getGasPrice();
        // Convert from wei to Gwei (1 Gwei = 1e9 wei)
        const gwei = Number(price) / 1e9;
        setGasPrice(gwei < 1 ? gwei.toFixed(3) : gwei.toFixed(1));
      } catch {
        setGasPrice(null);
      }
    };

    fetchGasPrice();
    const interval = setInterval(fetchGasPrice, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [publicClient]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="px-4 h-16 flex items-center justify-between">
          {/* Left Side: Mobile Menu & Gas Info */}
          <div className="flex items-center gap-4">
            {/* Mobile Sidebar Trigger */}
            <div className="md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
            </div>

            {/* Gas Info — real price from chain */}
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="opacity-70">GAS:</span>
              {gasPrice !== null ? (
                <span className="text-blue-500 font-space-grotesk font-bold">
                  {gasPrice} Gwei
                </span>
              ) : (
                <span className="text-muted-foreground font-space-grotesk animate-pulse">
                  —
                </span>
              )}
            </div>
          </div>

          {/* Right: connect + theme */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            />

            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-background md:hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <span className="font-space-grotesk font-bold text-xl px-2">Menu</span>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) {
                setIsMobileMenuOpen(false);
              }
            }}>
              <div className="flex-1 w-full">
                <Sidebar className="!flex w-full border-none" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
