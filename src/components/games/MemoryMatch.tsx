import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "medium" | "hard";
type Card = {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
};

const natureEmojis = ["🌸", "🌿", "🦋", "🌊", "🌙", "⭐", "🌺", "🍃", "🌈", "🌻", "🦜", "🐚", "🌴", "🪷", "🌾", "🍀", "🦢", "🐝"];

const difficultySettings: Record<Difficulty, { pairs: number; cols: number }> = {
  easy: { pairs: 4, cols: 4 },
  medium: { pairs: 8, cols: 4 },
  hard: { pairs: 18, cols: 6 },
};

export const MemoryMatch = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const initializeGame = () => {
    const { pairs } = difficultySettings[difficulty];
    const selectedEmojis = natureEmojis.slice(0, pairs);
    const cardPairs = [...selectedEmojis, ...selectedEmojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));

    setCards(cardPairs);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setGameComplete(false);
    setTimer(0);
    setIsPlaying(false);
  };

  useEffect(() => {
    initializeGame();
  }, [difficulty]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !gameComplete) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, gameComplete]);

  useEffect(() => {
    if (matches === difficultySettings[difficulty].pairs) {
      setGameComplete(true);
      setIsPlaying(false);
      if (!bestScore || moves < bestScore) {
        setBestScore(moves);
      }
    }
  }, [matches, difficulty, moves, bestScore]);

  const handleCardClick = (cardId: number) => {
    if (!isPlaying) setIsPlaying(true);

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.length >= 2) {
      return;
    }

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c))
    );

    if (newFlipped.length === 2) {
      setMoves((prev) => prev + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find((c) => c.id === firstId);
      const secondCard = cards.find((c) => c.id === secondId);

      if (firstCard?.emoji === secondCard?.emoji) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isMatched: true }
                : c
            )
          );
          setMatches((prev) => prev + 1);
          setFlippedCards([]);
        }, 500);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isFlipped: false }
                : c
            )
          );
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  const { cols } = difficultySettings[difficulty];

  return (
    <div className="min-h-[80vh] flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Difficulty selector */}
          <div className="flex gap-2">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium capitalize transition-all",
                  difficulty === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            onClick={initializeGame}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-6 text-center">
          <div className="glass-card rounded-xl px-6 py-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Zap className="w-4 h-4" />
              Moves
            </div>
            <div className="font-display text-2xl font-semibold">{moves}</div>
          </div>
          <div className="glass-card rounded-xl px-6 py-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Trophy className="w-4 h-4" />
              Matches
            </div>
            <div className="font-display text-2xl font-semibold">
              {matches}/{difficultySettings[difficulty].pairs}
            </div>
          </div>
          <div className="glass-card rounded-xl px-6 py-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="w-4 h-4" />
              Time
            </div>
            <div className="font-display text-2xl font-semibold">
              {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      {/* Game board */}
      <div
        className="grid gap-3 w-full max-w-2xl"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {cards.map((card) => (
          <motion.button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            className={cn(
              "aspect-square rounded-xl text-3xl md:text-4xl flex items-center justify-center transition-all duration-300",
              card.isMatched
                ? "bg-wellness-mint/50 cursor-default"
                : card.isFlipped
                ? "bg-white shadow-card"
                : "bg-gradient-to-br from-primary/80 to-primary hover:from-primary hover:to-primary/90 cursor-pointer"
            )}
            whileHover={!card.isFlipped && !card.isMatched ? { scale: 1.05 } : {}}
            whileTap={!card.isFlipped && !card.isMatched ? { scale: 0.95 } : {}}
            style={{
              transformStyle: "preserve-3d",
            }}
          >
            <AnimatePresence mode="wait">
              {(card.isFlipped || card.isMatched) && (
                <motion.span
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {card.emoji}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>

      {/* Completion modal */}
      <AnimatePresence>
        {gameComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="glass-card rounded-3xl p-8 text-center max-w-md w-full"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="font-display text-2xl font-semibold mb-2">
                Excellent Work!
              </h2>
              <p className="text-muted-foreground mb-6">
                You completed the puzzle in {moves} moves and{" "}
                {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
              </p>
              {bestScore === moves && (
                <p className="text-primary font-medium mb-6">
                  🏆 New Best Score!
                </p>
              )}
              <button
                onClick={initializeGame}
                className="btn-wellness w-full"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
