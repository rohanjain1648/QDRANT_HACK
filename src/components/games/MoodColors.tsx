import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Clock, Zap, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type Emotion = {
  name: string;
  colors: string[];
  correctColor: string;
  description: string;
};

const emotions: Emotion[] = [
  { name: "Joy", colors: ["#FFD700", "#FF6B6B", "#4ECDC4", "#9B59B6"], correctColor: "#FFD700", description: "Bright and warm like sunshine" },
  { name: "Calm", colors: ["#2ECC71", "#3498DB", "#E74C3C", "#F39C12"], correctColor: "#3498DB", description: "Peaceful like a clear sky" },
  { name: "Anger", colors: ["#E74C3C", "#1ABC9C", "#9B59B6", "#F1C40F"], correctColor: "#E74C3C", description: "Intense and fiery" },
  { name: "Sadness", colors: ["#3498DB", "#2ECC71", "#E67E22", "#E74C3C"], correctColor: "#3498DB", description: "Deep and reflective like rain" },
  { name: "Peace", colors: ["#2ECC71", "#E74C3C", "#F39C12", "#9B59B6"], correctColor: "#2ECC71", description: "Fresh and renewing like nature" },
  { name: "Love", colors: ["#E91E63", "#00BCD4", "#CDDC39", "#795548"], correctColor: "#E91E63", description: "Warm and tender" },
  { name: "Fear", colors: ["#34495E", "#E74C3C", "#F1C40F", "#2ECC71"], correctColor: "#34495E", description: "Dark and uncertain" },
  { name: "Hope", colors: ["#9B59B6", "#F1C40F", "#E74C3C", "#1ABC9C"], correctColor: "#F1C40F", description: "Bright like dawn" },
  { name: "Confusion", colors: ["#9B59B6", "#2ECC71", "#E74C3C", "#3498DB"], correctColor: "#9B59B6", description: "Mixed and complex" },
  { name: "Excitement", colors: ["#F39C12", "#3498DB", "#2ECC71", "#9B59B6"], correctColor: "#F39C12", description: "Energetic and vibrant" },
  { name: "Serenity", colors: ["#1ABC9C", "#E74C3C", "#F39C12", "#9B59B6"], correctColor: "#1ABC9C", description: "Tranquil like still water" },
  { name: "Gratitude", colors: ["#FFB6C1", "#E74C3C", "#3498DB", "#2ECC71"], correctColor: "#FFB6C1", description: "Soft and heartfelt" },
];

export const MoodColors = () => {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  const [shuffledColors, setShuffledColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [gameState, setGameState] = useState<"playing" | "result" | "idle">("idle");
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0 });
  const [timer, setTimer] = useState(30);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const [usedEmotions, setUsedEmotions] = useState<string[]>([]);

  const startGame = () => {
    nextRound([]);
    setStats({ correct: 0, total: 0, streak: 0 });
    setTimer(30);
    setIsTimerActive(true);
  };

  const nextRound = (used: string[]) => {
    const available = emotions.filter((e) => !used.includes(e.name));
    if (available.length === 0) {
      setUsedEmotions([]);
      const emotion = emotions[Math.floor(Math.random() * emotions.length)];
      setCurrentEmotion(emotion);
      setShuffledColors([...emotion.colors].sort(() => Math.random() - 0.5));
    } else {
      const emotion = available[Math.floor(Math.random() * available.length)];
      setCurrentEmotion(emotion);
      setShuffledColors([...emotion.colors].sort(() => Math.random() - 0.5));
      setUsedEmotions([...used, emotion.name]);
    }
    setSelectedColor(null);
    setGameState("playing");
    setShowEducation(false);
  };

  useEffect(() => {
    if (!isTimerActive || gameState !== "playing") return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, gameState]);

  const handleTimeout = () => {
    setStats((prev) => ({ ...prev, total: prev.total + 1, streak: 0 }));
    nextRound(usedEmotions);
  };

  const handleColorSelect = (color: string) => {
    if (gameState !== "playing" || !currentEmotion) return;

    setSelectedColor(color);
    setGameState("result");
    setIsTimerActive(false);

    const isCorrect = color === currentEmotion.correctColor;

    if (isCorrect) {
      setStats((prev) => ({
        correct: prev.correct + 1,
        total: prev.total + 1,
        streak: prev.streak + 1,
      }));
    } else {
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        streak: 0,
      }));
    }

    setShowEducation(true);
  };

  const continueGame = () => {
    setTimer(30);
    setIsTimerActive(true);
    nextRound(usedEmotions);
  };

  const resetGame = () => {
    setGameState("idle");
    setCurrentEmotion(null);
    setIsTimerActive(false);
    setUsedEmotions([]);
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      {gameState === "idle" ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-wellness-peach/50 flex items-center justify-center mx-auto mb-6">
            <Heart className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="font-display text-2xl font-semibold mb-4">Mood Color Matching</h2>
          <p className="text-muted-foreground mb-8">
            Explore the connection between emotions and colors. Match each emotion to its 
            corresponding color and learn about color psychology along the way.
          </p>
          <button onClick={startGame} className="btn-wellness">
            Start Game
          </button>
        </motion.div>
      ) : (
        <>
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="glass-card rounded-xl px-5 py-3 text-center">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Trophy className="w-4 h-4" />
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
                <Clock className="w-4 h-4" />
                Time
              </div>
              <div className={cn(
                "font-display text-2xl font-semibold",
                timer <= 10 && "text-destructive"
              )}>
                {timer}s
              </div>
            </div>
          </div>

          {/* Current emotion */}
          {currentEmotion && (
            <motion.div
              key={currentEmotion.name}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center mb-8"
            >
              <h2 className="font-display text-4xl font-bold mb-2">{currentEmotion.name}</h2>
              <p className="text-muted-foreground">Which color represents this emotion?</p>
            </motion.div>
          )}

          {/* Color options */}
          <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm w-full">
            {shuffledColors.map((color, index) => {
              const isCorrect = currentEmotion?.correctColor === color;
              const isSelected = selectedColor === color;

              return (
                <motion.button
                  key={color}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleColorSelect(color)}
                  disabled={gameState === "result"}
                  className={cn(
                    "aspect-square rounded-2xl transition-all duration-300",
                    "hover:scale-105 hover:shadow-lg",
                    "disabled:hover:scale-100",
                    gameState === "result" && isCorrect && "ring-4 ring-green-400 scale-105",
                    gameState === "result" && isSelected && !isCorrect && "ring-4 ring-red-400 opacity-70"
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>

          {/* Education panel */}
          <AnimatePresence>
            {showEducation && currentEmotion && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-card rounded-2xl p-6 max-w-md w-full text-center mb-6"
              >
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-4"
                  style={{ backgroundColor: currentEmotion.correctColor }}
                />
                <h3 className="font-display text-lg font-semibold mb-2">
                  {selectedColor === currentEmotion.correctColor ? "Correct! 🎉" : "Not quite!"}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  <strong>{currentEmotion.name}</strong> is associated with this color because it's{" "}
                  {currentEmotion.description.toLowerCase()}.
                </p>
                <button onClick={continueGame} className="btn-wellness">
                  Next Emotion
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset button */}
          <button
            onClick={resetGame}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            End Game
          </button>
        </>
      )}
    </div>
  );
};
