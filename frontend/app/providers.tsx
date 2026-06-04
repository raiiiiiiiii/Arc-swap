"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowProviderWrapper>{children}</RainbowProviderWrapper>
        </QueryClientProvider>
      </WagmiProvider>
    </NextThemesProvider>
  );
}

function RainbowProviderWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <RainbowKitProvider
      theme={mounted && resolvedTheme === "light" ? lightTheme({
        accentColor: '#3E74BB', // Arc Primary
      }) : darkTheme({
        accentColor: '#ACC6E9', // Arc Primary Light
        accentColorForeground: '#0D1B2F',
      })}
    >
      {children}
    </RainbowKitProvider>
  );
}
