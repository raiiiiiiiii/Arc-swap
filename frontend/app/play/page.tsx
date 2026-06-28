"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Clock, Zap, Upload } from "lucide-react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { ARCSWAP_ABI } from "@/lib/abis";
import { ARCSWAP_ADDRESS } from "@/lib/constants";
import { toast } from "@/components/ui/use-toast";

export default function PlayPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  
  // Array of 9 holes. Value is either "bear", "bull", "hit", or null
  const [holes, setHoles] = useState<(string | null)[]>(Array(9).fill(null));
  const gameInterval = useRef<NodeJS.Timeout | null>(null);

  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: topScores, refetch } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "getTopScores",
    query: { refetchInterval: 10000 }
  });

  const { data: myHighScore } = useReadContract({
    address: ARCSWAP_ADDRESS,
    abi: ARCSWAP_ABI,
    functionName: "highScores",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 }
  });

  const submitScore = async () => {
    if (!isConnected) {
      toast({ title: "Wallet Connected nahi hai", description: "Pehle wallet connect karein.", variant: "destructive" });
      return;
    }
    if (score <= 0) {
      toast({ title: "Score 0 hai!", description: "Pehle game khel kar kuch points banaein.", variant: "destructive" });
      return;
    }
    try {
      toast({ title: "Transaction bhej raha hai...", description: "MetaMask mein confirm karein." });
      await writeContractAsync({
        address: ARCSWAP_ADDRESS,
        abi: ARCSWAP_ABI,
        functionName: "submitHighScore",
        args: [BigInt(score)]
      });
      toast({ title: "Score Submit Ho Gaya! 🏆", description: `Score ${score} leaderboard par save ho gaya.` });
      refetch();
    } catch (e: any) {
      const msg: string = e?.shortMessage || e?.message || "Unknown error";
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        toast({ title: "Transaction Cancel", description: "Aapne transaction reject kar di.", variant: "destructive" });
      } else if (msg.includes("InvalidAmount") || msg.includes("score == 0")) {
        toast({ title: "Score Invalid", description: "Score 0 se zyada hona chahiye.", variant: "destructive" });
      } else if (msg.includes("insufficient funds") || msg.includes("gas")) {
        toast({ title: "Insufficient Gas", description: "Wallet mein testnet USDC (gas) ki zaroorat hai. Faucet se claim karein.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
      }
    }
  };

  const startGame = () => {
    setIsPlaying(true);
    setScore(0);
    setTimeLeft(30);
    setHoles(Array(9).fill(null));
  };

  const endGame = () => {
    setIsPlaying(false);
    if (gameInterval.current) clearInterval(gameInterval.current);
    setHoles(Array(9).fill(null));
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && isPlaying) {
      endGame();
    }
    return () => clearTimeout(timer);
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    if (isPlaying) {
      gameInterval.current = setInterval(() => {
        setHoles((prevHoles) => {
          const newHoles = [...prevHoles];
          // Randomly clear some holes
          for (let i = 0; i < 9; i++) {
             if (Math.random() > 0.5 && newHoles[i] !== "hit") newHoles[i] = null;
          }
          
          // Randomly spawn bear or bull
          const emptyHoles = newHoles.map((h, i) => h === null ? i : -1).filter(i => i !== -1);
          if (emptyHoles.length > 0) {
            const numToSpawn = Math.floor(Math.random() * 3) + 1; // 1 to 3
            for (let i = 0; i < numToSpawn; i++) {
              if (emptyHoles.length === 0) break;
              const randomIndex = Math.floor(Math.random() * emptyHoles.length);
              const holeIndex = emptyHoles.splice(randomIndex, 1)[0];
              newHoles[holeIndex] = Math.random() > 0.2 ? "bear" : "bull"; // 80% bear, 20% bull
            }
          }
          return newHoles;
        });
      }, 700);
    }
    return () => {
      if (gameInterval.current) clearInterval(gameInterval.current);
    };
  }, [isPlaying]);

  const hitHole = (index: number) => {
    if (!isPlaying || !holes[index] || holes[index] === "hit") return;
    
    if (holes[index] === "bear") {
      setScore(s => s + 10);
    } else if (holes[index] === "bull") {
      setScore(s => s - 10);
    }

    setHoles(prev => {
      const newHoles = [...prev];
      newHoles[index] = "hit"; // visual feedback
      
      // clear the hit after a short delay
      setTimeout(() => {
        setHoles(current => {
          const revertHoles = [...current];
          if (revertHoles[index] === "hit") revertHoles[index] = null;
          return revertHoles;
        });
      }, 200);
      
      return newHoles;
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 h-full overflow-y-auto relative">
      {/* Animated Glowing Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-amber-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="max-w-2xl w-full flex flex-col items-center gap-8 relative z-10">
        <div className="text-center space-y-4 mt-8">
          <h1 className="text-4xl font-space-grotesk font-bold tracking-tight text-white flex items-center justify-center gap-3">
            <Zap className="text-primary w-8 h-8" />
            Whack-a-Bear
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Bear market got you down? Whack the bears 🐻 for +10 points! But careful, hitting a bull 🐂 costs you -10 points!
          </p>
        </div>

        <Card className="w-full max-w-md p-6 bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden mb-4 rounded-3xl">
          
          <div className="flex justify-between items-center mb-8 px-4">
            <div className="flex flex-col items-center">
              <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Trophy className="w-4 h-4 text-amber-500" /> Score
              </span>
              <span className="text-3xl font-bold font-space-grotesk text-white">{score}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4 text-blue-400" /> Time
              </span>
              <span className={`text-3xl font-bold font-space-grotesk ${timeLeft <= 5 && timeLeft > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {timeLeft}s
              </span>
            </div>
          </div>

          {/* Overlays */}
          {!isPlaying && timeLeft === 0 && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-6 text-center">
              <h2 className="text-4xl font-bold mb-2 font-space-grotesk">Game Over!</h2>
              <p className="text-xl text-muted-foreground mb-8">Final Score: <span className="text-primary font-bold">{score}</span></p>
              
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button size="lg" onClick={startGame} className="font-bold text-lg rounded-full h-12">Play Again</Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={submitScore} 
                  disabled={isPending || score === 0}
                  className="font-bold border-primary text-primary hover:bg-primary/10 rounded-full h-12 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isPending ? "Submitting..." : "Submit Score"}
                </Button>
              </div>
            </div>
          )}

          {!isPlaying && timeLeft === 30 && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <Button size="lg" onClick={startGame} className="font-bold text-lg px-8 rounded-full h-14 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">Start Game</Button>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {holes.map((hole, index) => (
              <div 
                key={index}
                onClick={() => hitHole(index)}
                className={`
                  aspect-square rounded-3xl border flex items-center justify-center text-5xl md:text-6xl cursor-pointer
                  transition-all duration-200 transform select-none overflow-hidden
                  ${hole === null ? 'bg-black/60 border-white/5 shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)]' : ''}
                  ${hole === 'bear' ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30 scale-[1.05] active:scale-90 shadow-[0_0_30px_rgba(239,68,68,0.4),inset_0_0_20px_rgba(239,68,68,0.2)]' : ''}
                  ${hole === 'bull' ? 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30 scale-[1.05] active:scale-90 shadow-[0_0_30px_rgba(34,197,94,0.4),inset_0_0_20px_rgba(34,197,94,0.2)]' : ''}
                  ${hole === 'hit' ? 'bg-yellow-500/30 border-yellow-500 scale-75 opacity-70 rotate-12' : ''}
                `}
              >
                <div className={`transition-transform duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] ${hole === null ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
                  {hole === "bear" && "🐻"}
                  {hole === "bull" && "🐂"}
                  {hole === "hit" && "💥"}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Leaderboard Section */}
        <div className="w-full max-w-md bg-black/40 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="text-amber-500 w-5 h-5 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" /> Global Top 10
            </h3>
            {myHighScore !== undefined && (
              <span className="text-sm text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/10">My Best: <strong className="text-primary">{Number(myHighScore)}</strong></span>
            )}
          </div>
          
          <div className="space-y-3">
            {topScores ? (topScores as unknown as any[]).map((entry: any, i: number) => {
              if (Number(entry.score) === 0) return null;
              
              let medal = "";
              if (i === 0) medal = "🥇";
              else if (i === 1) medal = "🥈";
              else if (i === 2) medal = "🥉";

              return (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-sm font-bold w-6 text-center">{medal || `${i + 1}.`}</span>
                    <span className="font-mono text-sm tracking-wider text-muted-foreground">{entry.player.slice(0,6)}...{entry.player.slice(-4)}</span>
                  </div>
                  <span className="font-bold text-primary text-lg drop-shadow-[0_0_8px_rgba(var(--primary),0.6)]">{Number(entry.score)}</span>
                </div>
              );
            }) : null}
            {(!topScores || (topScores as unknown as any[])[0]?.score === 0n) && (
              <p className="text-muted-foreground text-sm text-center py-8 border border-dashed rounded-xl border-white/10 bg-white/5">
                No scores yet. Be the first to conquer the bears!
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
