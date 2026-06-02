import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, RotateCcw, Lightbulb, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type WordNode = {
  id: string;
  word: string;
  parentId: string | null;
  x: number;
  y: number;
};

const seedWords = [
  "Ocean", "Mountain", "Dream", "Light", "Garden",
  "Music", "Journey", "Peace", "Hope", "Nature",
  "Calm", "Joy", "Love", "Time", "Home"
];

const prompts = [
  "What does this remind you of?",
  "What feeling does this evoke?",
  "What comes to mind?",
  "Free associate...",
  "Let your mind wander...",
];

export const WordFlow = () => {
  const [nodes, setNodes] = useState<WordNode[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [prompt, setPrompt] = useState("");

  const startGame = useCallback((word?: string) => {
    const seedWord = word || seedWords[Math.floor(Math.random() * seedWords.length)];
    const rootNode: WordNode = {
      id: "root",
      word: seedWord,
      parentId: null,
      x: 0,
      y: 0,
    };
    setNodes([rootNode]);
    setCurrentWord(seedWord);
    setSelectedNodeId("root");
    setGameStarted(true);
    setWordCount(1);
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
    setInputValue("");
  }, []);

  const addWord = () => {
    if (!inputValue.trim() || !selectedNodeId) return;

    const parentNode = nodes.find((n) => n.id === selectedNodeId);
    if (!parentNode) return;

    const siblings = nodes.filter((n) => n.parentId === selectedNodeId);
    const angle = (siblings.length * 60 - 90) * (Math.PI / 180);
    const distance = 150;

    const newNode: WordNode = {
      id: `node-${Date.now()}`,
      word: inputValue.trim(),
      parentId: selectedNodeId,
      x: parentNode.x + Math.cos(angle) * distance,
      y: parentNode.y + Math.sin(angle) * distance,
    };

    setNodes((prev) => [...prev, newNode]);
    setCurrentWord(inputValue.trim());
    setSelectedNodeId(newNode.id);
    setWordCount((prev) => prev + 1);
    setInputValue("");
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addWord();
    }
  };

  const selectNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNodeId(nodeId);
      setCurrentWord(node.word);
    }
  };

  const resetGame = () => {
    setNodes([]);
    setCurrentWord("");
    setSelectedNodeId(null);
    setGameStarted(false);
    setWordCount(0);
    setInputValue("");
  };

  // Calculate bounds for the mind map
  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      maxX: Math.max(acc.maxX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxY: Math.max(acc.maxY, node.y),
    }),
    { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  );

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return (
    <div className="min-h-[80vh] flex flex-col items-center p-4">
      {!gameStarted ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-wellness-sky/30 flex items-center justify-center mx-auto mb-6">
            <Lightbulb className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="font-display text-2xl font-semibold mb-4">Word Association Flow</h2>
          <p className="text-muted-foreground mb-8">
            Build a mind map of associations. Start with a seed word and let your thoughts flow freely.
            There are no wrong answers - just explore your mind!
          </p>

          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-3">Choose a seed word or get a random one:</p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {seedWords.slice(0, 8).map((word) => (
                <button
                  key={word}
                  onClick={() => startGame(word)}
                  className="px-3 py-1.5 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors text-sm"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => startGame()} className="btn-wellness flex items-center gap-2 mx-auto">
            <Shuffle className="w-5 h-5" />
            Random Word
          </button>
        </motion.div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{wordCount} words</span>
            </div>
            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              New Game
            </button>
          </div>

          {/* Current word and input */}
          <div className="text-center mb-8 max-w-md w-full">
            <motion.div
              key={currentWord}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-4xl font-bold gradient-text mb-2"
            >
              {currentWord}
            </motion.div>
            <p className="text-muted-foreground text-sm mb-4">{prompt}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your association..."
                className="flex-1 px-4 py-3 rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <button
                onClick={addWord}
                disabled={!inputValue.trim()}
                className="btn-wellness disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Mind map */}
          <div className="relative w-full h-80 md:h-96 glass-card rounded-2xl overflow-hidden">
            <svg className="absolute inset-0 w-full h-full">
              {/* Connection lines */}
              {nodes.map((node) => {
                if (!node.parentId) return null;
                const parent = nodes.find((n) => n.id === node.parentId);
                if (!parent) return null;

                const offsetX = 400 - centerX;
                const offsetY = 180 - centerY;

                return (
                  <motion.line
                    key={`line-${node.id}`}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    x1={parent.x + offsetX + 200}
                    y1={parent.y + offsetY + 100}
                    x2={node.x + offsetX + 200}
                    y2={node.y + offsetY + 100}
                    stroke="hsl(var(--primary) / 0.3)"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>

            {/* Word nodes */}
            <AnimatePresence>
              {nodes.map((node) => {
                const offsetX = 400 - centerX;
                const offsetY = 180 - centerY;

                return (
                  <motion.button
                    key={node.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => selectNode(node.id)}
                    className={cn(
                      "absolute px-4 py-2 rounded-full font-medium transition-all",
                      "transform -translate-x-1/2 -translate-y-1/2",
                      selectedNodeId === node.id
                        ? "bg-primary text-primary-foreground shadow-lg scale-110"
                        : "bg-white dark:bg-card border border-border shadow hover:shadow-md hover:scale-105"
                    )}
                    style={{
                      left: node.x + offsetX + 200,
                      top: node.y + offsetY + 100,
                    }}
                  >
                    {node.word}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          <p className="text-sm text-muted-foreground mt-4 text-center">
            Click any word to branch from it
          </p>
        </>
      )}
    </div>
  );
};
