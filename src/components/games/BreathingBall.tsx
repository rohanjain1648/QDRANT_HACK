import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type BreathPhase = "inhale" | "hold" | "exhale" | "holdOut";
type BreathPattern = {
  name: string;
  description: string;
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
};

const breathPatterns: BreathPattern[] = [
  {
    name: "4-7-8 Relaxation",
    description: "Deep anxiety relief technique",
    inhale: 4,
    holdIn: 7,
    exhale: 8,
    holdOut: 0,
  },
  {
    name: "Box Breathing",
    description: "Used by Navy SEALs for focus",
    inhale: 4,
    holdIn: 4,
    exhale: 4,
    holdOut: 4,
  },
  {
    name: "Coherent Breathing",
    description: "Optimal heart rate variability",
    inhale: 5.5,
    holdIn: 0,
    exhale: 5.5,
    holdOut: 0,
  },
  {
    name: "Deep Breathing",
    description: "Simple relaxation technique",
    inhale: 6,
    holdIn: 0,
    exhale: 6,
    holdOut: 0,
  },
  {
    name: "Energizing Breath",
    description: "Morning activation",
    inhale: 3,
    holdIn: 1,
    exhale: 3,
    holdOut: 0,
  },
];

const sessionDurations = [2, 5, 10, 15, 20];

export const BreathingBall = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPattern, setCurrentPattern] = useState(breathPatterns[0]);
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [phaseTime, setPhaseTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(5);
  const [breathCount, setBreathCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const getPhaseColor = (phase: BreathPhase) => {
    switch (phase) {
      case "inhale":
        return "from-breath-inhale to-wellness-sky";
      case "hold":
      case "holdOut":
        return "from-breath-hold to-wellness-mint";
      case "exhale":
        return "from-breath-exhale to-wellness-lavender";
    }
  };

  const getPhaseText = (phase: BreathPhase) => {
    switch (phase) {
      case "inhale":
        return "Breathe In";
      case "hold":
        return "Hold";
      case "exhale":
        return "Breathe Out";
      case "holdOut":
        return "Hold";
    }
  };

  const getPhaseDuration = useCallback(
    (phase: BreathPhase) => {
      switch (phase) {
        case "inhale":
          return currentPattern.inhale;
        case "hold":
          return currentPattern.holdIn;
        case "exhale":
          return currentPattern.exhale;
        case "holdOut":
          return currentPattern.holdOut;
      }
    },
    [currentPattern]
  );

  const getNextPhase = useCallback(
    (currentPhase: BreathPhase): BreathPhase => {
      switch (currentPhase) {
        case "inhale":
          return currentPattern.holdIn > 0 ? "hold" : "exhale";
        case "hold":
          return "exhale";
        case "exhale":
          return currentPattern.holdOut > 0 ? "holdOut" : "inhale";
        case "holdOut":
          return "inhale";
      }
    },
    [currentPattern]
  );

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setPhaseTime((prev) => {
        const phaseDuration = getPhaseDuration(phase);
        if (prev >= phaseDuration) {
          const nextPhase = getNextPhase(phase);
          if (nextPhase === "inhale") {
            setBreathCount((b) => b + 1);
          }
          setPhase(nextPhase);
          return 0;
        }
        return prev + 0.1;
      });

      setTotalTime((prev) => {
        if (prev >= sessionDuration * 60) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, phase, getPhaseDuration, getNextPhase, sessionDuration]);

  const handleReset = () => {
    setIsPlaying(false);
    setPhase("inhale");
    setPhaseTime(0);
    setTotalTime(0);
    setBreathCount(0);
  };

  const progress = (phaseTime / getPhaseDuration(phase)) * 100;
  const sessionProgress = (totalTime / (sessionDuration * 60)) * 100;

  const ballScale = phase === "inhale" ? 1.4 : phase === "exhale" ? 0.6 : 1;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/20"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, Math.random() * -200],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        ))}
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute right-0 top-0 bottom-0 w-80 glass-card p-6 z-20 overflow-y-auto"
          >
            <h3 className="font-display text-xl font-semibold mb-6">Settings</h3>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Breathing Pattern
                </label>
                <div className="space-y-2">
                  {breathPatterns.map((pattern) => (
                    <button
                      key={pattern.name}
                      onClick={() => {
                        setCurrentPattern(pattern);
                        handleReset();
                      }}
                      className={cn(
                        "w-full p-3 rounded-xl text-left transition-all",
                        currentPattern.name === pattern.name
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 border-2 border-transparent hover:bg-muted"
                      )}
                    >
                      <div className="font-medium">{pattern.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {pattern.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Session Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {sessionDurations.map((duration) => (
                    <button
                      key={duration}
                      onClick={() => {
                        setSessionDuration(duration);
                        handleReset();
                      }}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        sessionDuration === duration
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {duration} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Pattern info */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="font-display text-2xl font-semibold mb-1">
            {currentPattern.name}
          </h2>
          <p className="text-muted-foreground">{currentPattern.description}</p>
        </motion.div>

        {/* Breathing Ball */}
        <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-8">
          {/* Outer glow ring */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-br opacity-30 blur-xl",
              getPhaseColor(phase)
            )}
            animate={{ scale: ballScale }}
            transition={{ duration: getPhaseDuration(phase), ease: "easeInOut" }}
          />

          {/* Main ball */}
          <motion.div
            className={cn(
              "w-40 h-40 md:w-52 md:h-52 rounded-full bg-gradient-to-br shadow-glow",
              getPhaseColor(phase)
            )}
            animate={{ scale: ballScale }}
            transition={{ duration: getPhaseDuration(phase), ease: "easeInOut" }}
          >
            {/* Inner highlight */}
            <div className="w-full h-full rounded-full flex items-center justify-center">
              <div className="w-1/3 h-1/3 rounded-full bg-white/30 blur-sm -translate-x-4 -translate-y-4" />
            </div>
          </motion.div>

          {/* Phase text */}
          <motion.div
            key={phase}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="font-display text-xl md:text-2xl font-semibold text-foreground/80">
              {getPhaseText(phase)}
            </span>
          </motion.div>
        </div>

        {/* Progress indicator */}
        <div className="w-64 md:w-80 mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Breath {breathCount + 1}</span>
            <span>
              {Math.floor(totalTime / 60)}:{String(Math.floor(totalTime % 60)).padStart(2, "0")} / {sessionDuration}:00
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${sessionProgress}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-5 rounded-full bg-primary text-primary-foreground shadow-glow hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 ml-1" />
            )}
          </button>

          <button
            onClick={handleReset}
            className="p-3 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-3 rounded-full transition-colors",
              showSettings ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
