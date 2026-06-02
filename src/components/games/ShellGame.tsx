import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Trophy, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Difficulty = 1 | 2 | 3 | 4 | 5;

const difficultySettings: Record<Difficulty, { shuffles: number; speed: number; label: string; color: string }> = {
  1: { shuffles: 3, speed: 800, label: "Beginner", color: "bg-green-500" },
  2: { shuffles: 5, speed: 600, label: "Easy", color: "bg-lime-500" },
  3: { shuffles: 7, speed: 450, label: "Medium", color: "bg-yellow-500" },
  4: { shuffles: 9, speed: 300, label: "Hard", color: "bg-orange-500" },
  5: { shuffles: 10, speed: 200, label: "Expert", color: "bg-red-500" },
};

const encouragements = [
  "Great focus! 👁️",
  "You're improving! 🌟",
  "Stay present! 🧘",
  "Trust your instincts! ✨",
  "Sharp eyes! 👀",
];

export const ShellGame = () => {
  const [gameState, setGameState] = useState<"idle" | "showing" | "shuffling" | "choosing" | "result">("idle");
  const [ballPosition, setBallPosition] = useState(1);
  const [cupPositions, setCupPositions] = useState([0, 1, 2]);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [selectedCup, setSelectedCup] = useState<number | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
  const [message, setMessage] = useState("");

  const startGame = useCallback(() => {
    const newBallPos = Math.floor(Math.random() * 3);
    setBallPosition(newBallPos);
    setCupPositions([0, 1, 2]);
    setSelectedCup(null);
    setGameState("showing");
    setMessage("");

    setTimeout(() => {
      setGameState("shuffling");
      performShuffles(newBallPos);
    }, 2000);
  }, [difficulty]);

  const performShuffles = (ballPos: number) => {
    const { shuffles, speed } = difficultySettings[difficulty];
    let currentPositions = [0, 1, 2];
    let currentBallPos = ballPos;
    let shuffleCount = 0;

    const shuffle = () => {
      if (shuffleCount >= shuffles) {
        setBallPosition(currentBallPos);
        setGameState("choosing");
        return;
      }

      const pos1 = Math.floor(Math.random() * 3);
      let pos2 = Math.floor(Math.random() * 3);
      while (pos2 === pos1) pos2 = Math.floor(Math.random() * 3);

      const newPositions = [...currentPositions];
      [newPositions[pos1], newPositions[pos2]] = [newPositions[pos2], newPositions[pos1]];

      if (currentPositions[pos1] === currentBallPos) {
        currentBallPos = newPositions.indexOf(currentPositions[pos1]);
      } else if (currentPositions[pos2] === currentBallPos) {
        currentBallPos = newPositions.indexOf(currentPositions[pos2]);
      }

      currentPositions = newPositions;
      setCupPositions([...newPositions]);
      shuffleCount++;

      setTimeout(shuffle, speed);
    };

    setTimeout(shuffle, 500);
  };

  const handleCupClick = (cupIndex: number) => {
    if (gameState !== "choosing") return;

    setSelectedCup(cupIndex);
    setGameState("result");

    const isCorrect = cupPositions[cupIndex] === ballPosition;

    if (isCorrect) {
      const newStreak = stats.streak + 1;
      setStats((prev) => ({
        correct: prev.correct + 1,
        total: prev.total + 1,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      }));
      setMessage(encouragements[Math.floor(Math.random() * encouragements.length)]);
    } else {
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        streak: 0,
      }));
      setMessage("Not quite! Try again 💪");
    }
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      {/* Stats */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <div className="glass-card rounded-xl px-5 py-3 text-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Target className="w-4 h-4" />
            Accuracy
          </div>
          <div className="font-display text-2xl font-semibold">{accuracy}%</div>
        </div>
        <div className="glass-card rounded-xl px-5 py-3 text-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Zap className="w-4 h-4" />
            Streak
          </div>
          <div className="font-display text-2xl font-semibold">{stats.streak}</div>
        </div>
        <div className="glass-card rounded-xl px-5 py-3 text-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Trophy className="w-4 h-4" />
            Best
          </div>
          <div className="font-display text-2xl font-semibold">{stats.bestStreak}</div>
        </div>
      </div>

      {/* Difficulty selector */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            disabled={gameState !== "idle" && gameState !== "result"}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              difficulty === d
                ? `${difficultySettings[d].color} text-white`
                : "bg-muted hover:bg-muted/80 disabled:opacity-50"
            )}
          >
            {difficultySettings[d].label}
          </button>
        ))}
      </div>

      {/* Game area */}
      <div className="relative w-full max-w-md h-48 mb-8">
        {/* Cups */}
        <div className="absolute inset-0 flex items-center justify-center gap-4">
          {[0, 1, 2].map((cupIndex) => {
            const visualPosition = cupPositions.indexOf(cupIndex);
            const hasBall = cupIndex === ballPosition;
            const isSelected = selectedCup === cupIndex;
            const showBall = (gameState === "showing" || gameState === "result") && hasBall;

            return (
              <motion.div
                key={cupIndex}
                className="absolute"
                animate={{
                  x: (visualPosition - 1) * 120,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
              >
                {/* Ball */}
                <AnimatePresence>
                  {showBall && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg z-0"
                    />
                  )}
                </AnimatePresence>

                {/* Cup */}
                <motion.button
                  onClick={() => handleCupClick(cupIndex)}
                  disabled={gameState !== "choosing"}
                  className={cn(
                    "relative w-24 h-28 cursor-pointer transition-all z-10",
                    gameState === "choosing" && "hover:scale-105",
                    isSelected && gameState === "result" && (hasBall ? "scale-105" : "opacity-70")
                  )}
                  animate={{
                    y: gameState === "result" && isSelected ? -40 : 0,
                  }}
                  whileHover={gameState === "choosing" ? { y: -5 } : {}}
                >
                  {/* Cup body */}
                  <div
                    className={cn(
                      "w-full h-full rounded-t-full rounded-b-lg",
                      "bg-gradient-to-br from-primary/80 to-primary shadow-lg",
                      "border-4 border-primary/30",
                      isSelected && gameState === "result" && hasBall && "ring-4 ring-green-400",
                      isSelected && gameState === "result" && !hasBall && "ring-4 ring-red-400"
                    )}
                    style={{
                      clipPath: "polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)",
                    }}
                  >
                    {/* Shine effect */}
                    <div className="absolute top-4 left-6 w-3 h-8 bg-white/20 rounded-full blur-sm" />
                  </div>
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-lg font-medium mb-6"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="text-center text-muted-foreground mb-6">
        {gameState === "idle" && "Press Start to begin"}
        {gameState === "showing" && "Watch the ball carefully..."}
        {gameState === "shuffling" && "Follow the cup with the ball..."}
        {gameState === "choosing" && "Where is the ball? Click a cup!"}
        {gameState === "result" && (selectedCup !== null && cupPositions[selectedCup] === ballPosition ? "Correct! 🎉" : "Wrong cup!")}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        {(gameState === "idle" || gameState === "result") && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="btn-wellness flex items-center gap-2"
          >
            <Play className="w-5 h-5" />
            {gameState === "result" ? "Play Again" : "Start Game"}
          </motion.button>
        )}
        {gameState === "result" && (
          <button
            onClick={() => {
              setGameState("idle");
              setStats({ correct: 0, total: 0, streak: 0, bestStreak: stats.bestStreak });
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Stats
          </button>
        )}
      </div>
    </div>
  );
};
