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

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center max-w-4xl mx-auto opacity-70">
        <div className="p-4">
          <div className="font-bold text-xl mb-2 text-foreground">Zero Slippage</div>
          <p className="text-sm text-muted-foreground">Fixed 1:1 exchange rate guaranteed by the smart contract reserves.</p>
        </div>
        <div className="p-4">
          <div className="font-bold text-xl mb-2 text-foreground">Native Gas</div>
          <p className="text-sm text-muted-foreground">Powered by Arc Testnet using USDC as the native gas token.</p>
        </div>
        <div className="p-4">
          <div className="font-bold text-xl mb-2 text-foreground">Highly Secure</div>
          <p className="text-sm text-muted-foreground">Secured by OpenZeppelin contracts with daily limits and re-entrancy guards.</p>
        </div>
      </div>
    </div>
  );
}
