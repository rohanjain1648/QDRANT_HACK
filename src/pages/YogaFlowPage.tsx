import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Clock, Flame, Heart, Sun, Moon, Zap } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PoseViewer3D } from "@/components/yoga/PoseViewer3D";
import { cn } from "@/lib/utils";

interface YogaSequence {
  id: string;
  name: string;
  description: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  poses: string[];
  poseNames: string[];
  icon: typeof Sun;
  color: string;
}

const yogaSequences: YogaSequence[] = [
  {
    id: "sun-salutation",
    name: "Sun Salutation A",
    description: "Classic morning flow to energize body and mind",
    duration: "5-10 min",
    level: "Beginner",
    poses: ["mountain", "mountain", "downdog", "plank", "cobra", "downdog", "mountain"],
    poseNames: ["Mountain Pose", "Arms Up", "Downward Dog", "Plank", "Cobra", "Downward Dog", "Mountain Pose"],
    icon: Sun,
    color: "from-orange-400 to-yellow-400",
  },
  {
    id: "warrior-flow",
    name: "Warrior Flow",
    description: "Build strength and confidence with warrior poses",
    duration: "10-15 min",
    level: "Intermediate",
    poses: ["mountain", "warrior1", "warrior2", "triangle", "warrior2", "warrior1", "mountain"],
    poseNames: ["Mountain Pose", "Warrior I", "Warrior II", "Triangle", "Warrior II", "Warrior I", "Mountain Pose"],
    icon: Flame,
    color: "from-red-400 to-orange-400",
  },
  {
    id: "gentle-morning",
    name: "Gentle Morning",
    description: "Soft, awakening sequence to start your day",
    duration: "10 min",
    level: "Beginner",
    poses: ["child", "cat", "cow", "downdog", "mountain", "tree", "mountain"],
    poseNames: ["Child's Pose", "Cat Pose", "Cow Pose", "Downward Dog", "Mountain Pose", "Tree Pose", "Mountain Pose"],
    icon: Sun,
    color: "from-amber-300 to-orange-300",
  },
  {
    id: "evening-wind-down",
    name: "Evening Wind Down",
    description: "Calming sequence to release tension before sleep",
    duration: "15 min",
    level: "Beginner",
    poses: ["child", "cat", "cow", "seatedforward", "bridge", "child"],
    poseNames: ["Child's Pose", "Cat Pose", "Cow Pose", "Seated Forward Bend", "Bridge Pose", "Child's Pose"],
    icon: Moon,
    color: "from-indigo-400 to-purple-400",
  },
  {
    id: "core-power",
    name: "Core Power",
    description: "Strengthen your center with core-focused poses",
    duration: "12 min",
    level: "Intermediate",
    poses: ["plank", "boat", "plank", "downdog", "cobra", "child"],
    poseNames: ["Plank Pose", "Boat Pose", "Plank Pose", "Downward Dog", "Cobra Pose", "Child's Pose"],
    icon: Zap,
    color: "from-emerald-400 to-teal-400",
  },
  {
    id: "heart-opener",
    name: "Heart Opener",
    description: "Open your chest and cultivate self-compassion",
    duration: "15 min",
    level: "Intermediate",
    poses: ["mountain", "cow", "cobra", "bridge", "child", "mountain"],
    poseNames: ["Mountain Pose", "Cow Pose", "Cobra Pose", "Bridge Pose", "Child's Pose", "Mountain Pose"],
    icon: Heart,
    color: "from-pink-400 to-rose-400",
  },
];

const YogaFlowPage = () => {
  const [selectedSequence, setSelectedSequence] = useState<YogaSequence | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePoseChange = (poseId: string, index: number) => {
    setCurrentPoseIndex(index);
  };

  const handleSelectSequence = (sequence: YogaSequence) => {
    setSelectedSequence(sequence);
    setCurrentPoseIndex(0);
    setIsPlaying(false);
  };

  const handleBack = () => {
    setSelectedSequence(null);
    setIsPlaying(false);
    setCurrentPoseIndex(0);
  };

  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          {!selectedSequence ? (
            <>
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
              >
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Yoga <span className="gradient-text">Flow Sequences</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Experience smooth animated transitions between poses with our pre-built yoga flows.
                  Watch the 3D model seamlessly move from one asana to the next.
                </p>
              </motion.div>

              {/* Sequence Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {yogaSequences.map((sequence, index) => (
                  <motion.div
                    key={sequence.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <button
                      onClick={() => handleSelectSequence(sequence)}
                      className="w-full text-left glass-card rounded-2xl p-6 hover:scale-[1.02] transition-all duration-300 group"
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4",
                        sequence.color
                      )}>
                        <sequence.icon className="w-6 h-6 text-white" />
                      </div>
                      
                      <h3 className="font-display text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                        {sequence.name}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground mb-4">
                        {sequence.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {sequence.duration}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          sequence.level === "Beginner" && "bg-green-100 text-green-700",
                          sequence.level === "Intermediate" && "bg-yellow-100 text-yellow-700",
                          sequence.level === "Advanced" && "bg-red-100 text-red-700"
                        )}>
                          {sequence.level}
                        </span>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">
                          {sequence.poses.length} poses • Smooth transitions
                        </p>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Flow Player */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-6xl mx-auto"
              >
                {/* Back button and title */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Back to Sequences
                  </button>
                  
                  <div className="text-right">
                    <h2 className="font-display text-2xl font-bold">{selectedSequence.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedSequence.duration}</p>
                  </div>
                </div>

                {/* Main content */}
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* 3D Viewer */}
                  <div className="lg:col-span-2">
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-wellness-sage/30 to-wellness-mint/20">
                      <PoseViewer3D
                        poseName={selectedSequence.poseNames[currentPoseIndex]}
                        poseId={selectedSequence.poses[currentPoseIndex]}
                        enableFlowMode={true}
                        flowSequence={selectedSequence.poses}
                        onPoseChange={handlePoseChange}
                      />
                    </div>
                  </div>

                  {/* Pose list */}
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="font-display font-semibold mb-4">Sequence</h3>
                    
                    <div className="space-y-2 mb-6">
                      {selectedSequence.poseNames.map((poseName, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentPoseIndex(index)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                            currentPoseIndex === index
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          )}
                        >
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                            currentPoseIndex === index
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium">{poseName}</span>
                        </button>
                      ))}
                    </div>

                    {/* Play controls */}
                    <div className="flex items-center justify-center gap-4 pt-4 border-t border-border/50">
                      <button
                        onClick={() => setCurrentPoseIndex(Math.max(0, currentPoseIndex - 1))}
                        disabled={currentPoseIndex === 0}
                        className="p-2 rounded-full hover:bg-muted disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw className="w-5 h-5 rotate-90" />
                      </button>
                      
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6 ml-0.5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => setCurrentPoseIndex(Math.min(selectedSequence.poses.length - 1, currentPoseIndex + 1))}
                        disabled={currentPoseIndex === selectedSequence.poses.length - 1}
                        className="p-2 rounded-full hover:bg-muted disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw className="w-5 h-5 -rotate-90" />
                      </button>
                    </div>

                    <p className="text-center text-xs text-muted-foreground mt-4">
                      {isPlaying ? "Auto-advancing every 4 seconds" : "Click play to auto-advance"}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-muted-foreground mb-2">
                    <span>Progress</span>
                    <span>{currentPoseIndex + 1} of {selectedSequence.poses.length}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentPoseIndex + 1) / selectedSequence.poses.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default YogaFlowPage;
