import type { Metadata } from "next";
import { Inter, Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "ArcSwap | Arc Testnet USDC/EURC",
  description: "Securely swap USDC and EURC 1:1 on Arc Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${dmSans.variable} font-sans bg-background text-foreground min-h-screen flex flex-col`}>
        <Providers
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Main Dashboard Layout Container */}
          <div className="flex h-screen w-full overflow-hidden bg-background">
            
            {/* Left Sidebar (Desktop) */}
            <Sidebar />

            {/* Right Main Area */}
            <div className="flex flex-col flex-1 w-full overflow-hidden relative">
              <Header />
              
              {/* Scrollable Content Area */}
              <main className="flex-1 overflow-y-auto w-full p-4 md:p-8 flex flex-col items-center">
                <div className="w-full max-w-7xl mx-auto">
                  {children}
                </div>
              </main>
              
              {/* Bottom Status Bar */}
              <StatusBar />
            </div>

          </div>
          
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
