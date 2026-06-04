"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Moon, Sun, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar"; // Mobile support

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

            {/* Gas Info (Simulated) */}
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="opacity-70">GAS:</span>
              <span className="text-blue-500 font-space-grotesk font-bold">20.4 Gwei</span>
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
            {/* We wrap Sidebar in a div that handles clicks to close the menu on navigation */}
            <div onClick={(e) => {
              // Close if a link is clicked
              if ((e.target as HTMLElement).closest('a')) {
                setIsMobileMenuOpen(false);
              }
            }}>
              {/* Force Sidebar to be visible on mobile for this overlay by overriding its hidden class */}
              <div className="[&>aside]:flex [&>aside]:w-full [&>aside]:border-none">
                <Sidebar />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
