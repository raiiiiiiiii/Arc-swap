"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, ShieldCheck, Droplets, ExternalLink, Activity, Waves } from "lucide-react";
import Image from "next/image";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={`w-64 h-full border-r bg-background flex flex-col shrink-0 ${className || "hidden md:flex"}`}>
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img src="/arc-logo.png" alt="Arc Logo" width={32} height={32} className="rounded-lg" />
          <span className="font-space-grotesk font-bold text-xl">ArcSwap</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-8">
        {/* Workspace */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider mb-2">Workspace</p>
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === "/"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Swap Tokens</span>
          </Link>
          
          <Link
            href="/pools"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === "/pools"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Waves className="w-4 h-4" />
            <span>Liquidity Pools</span>
          </Link>

          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === "/admin"
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Vault</span>
          </Link>
        </div>

        {/* Resources */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider mb-2">Resources</p>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all group"
          >
            <div className="flex items-center gap-3">
              <Droplets className="w-4 h-4" />
              <span>Claim Faucet</span>
            </div>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>

          
          <a
            href="https://testnet.arcscan.app/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all group"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4" />
              <span>Arc Explorer</span>
            </div>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>

      {/* Built By Section */}
      <div className="p-4 border-t shrink-0">
        <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50 border border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
              <img src="https://unavatar.io/twitter/anya_yfa7" alt="Anya PFP" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground leading-tight">Built By</span>
              <span className="text-xs font-bold leading-tight">@anya_yfa7</span>
            </div>
          </div>
          <a
            href="https://x.com/anya_yfa7"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold bg-foreground text-background px-2.5 py-1 rounded-full hover:opacity-90 transition-opacity"
          >
            FOLLOW
          </a>
        </div>
      </div>
    </aside>
  );
}
