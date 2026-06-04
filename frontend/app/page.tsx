import { SwapCard } from "@/components/swap/SwapCard";

export default function Home() {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-space-grotesk font-bold tracking-tight mb-4">
          Stablecoin Swap on <span className="text-primary">Arc</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Secure, fixed 1:1 swaps between USDC and EURC with zero slippage.
          Powered by the Arc Network.
        </p>
      </div>

      <SwapCard />


    </div>
  );
}
