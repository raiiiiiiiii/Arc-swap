"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Clock, Zap } from "lucide-react";

export default function PlayPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  
  // Array of 9 holes. Value is either "bear", "bull", "hit", or null
  const [holes, setHoles] = useState<(string | null)[]>(Array(9).fill(null));
  const gameInterval = useRef<NodeJS.Timeout | null>(null);

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
    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 h-full overflow-y-auto">
      <div className="max-w-2xl w-full flex flex-col items-center gap-8">
        <div className="text-center space-y-4 mt-8">
          <h1 className="text-4xl font-space-grotesk font-bold tracking-tight text-white flex items-center justify-center gap-3">
            <Zap className="text-primary w-8 h-8" />
            Whack-a-Bear
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Bear market got you down? Whack the bears 🐻 for +10 points! But careful, hitting a bull 🐂 costs you -10 points!
          </p>
        </div>

        <Card className="w-full max-w-md p-6 bg-secondary/30 backdrop-blur-md border-border/50 shadow-2xl relative overflow-hidden mb-8">
          
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
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <h2 className="text-4xl font-bold mb-2 font-space-grotesk">Game Over!</h2>
              <p className="text-xl text-muted-foreground mb-8">Final Score: <span className="text-primary font-bold">{score}</span></p>
              <Button size="lg" onClick={startGame} className="font-bold text-lg px-8 rounded-full h-14">Play Again</Button>
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
                  aspect-square rounded-2xl border-4 flex items-center justify-center text-4xl md:text-5xl cursor-pointer
                  transition-all duration-150 transform select-none overflow-hidden
                  ${hole === null ? 'bg-background/50 border-border/20 shadow-inner' : ''}
                  ${hole === 'bear' ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20 scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}
                  ${hole === 'bull' ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20 scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : ''}
                  ${hole === 'hit' ? 'bg-yellow-500/20 border-yellow-500/50 scale-95 opacity-50' : ''}
                `}
              >
                <div className={`transition-transform duration-200 ${hole === null ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
                  {hole === "bear" && "🐻"}
                  {hole === "bull" && "🐂"}
                  {hole === "hit" && "💥"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
