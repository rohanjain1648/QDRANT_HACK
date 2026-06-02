import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Settings,
  Volume2,
  Star,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Box,
  Camera,
  Columns,
  History,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useVoiceGuidance } from "@/hooks/useVoiceGuidance";
import { getPoseById, PoseInstruction } from "@/data/yogaPoses";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { PoseViewer3D } from "@/components/yoga/PoseViewer3D";
import { PoseDetector } from "@/components/yoga/PoseDetector";
import { SessionRecorder } from "@/components/yoga/SessionRecorder";
import { PoseComparison } from "@/components/yoga/PoseComparison";
import { PoseFeedback, Keypoint } from "@/hooks/usePoseDetection";
import { RecordingFrame } from "@/hooks/useSessionRecording";

const PoseDetailPage = () => {
  const { poseId } = useParams<{ poseId: string }>();
  const pose = getPoseById(poseId || "");

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale" | "rest">("rest");
  const [viewMode, setViewMode] = useState<"3d" | "camera" | "sidebyside">("3d");
  
  // Session recording state
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<PoseFeedback>({
    isCorrect: false,
    accuracy: 0,
    suggestions: [],
    jointFeedback: {},
  });
  const [currentKeypoints, setCurrentKeypoints] = useState<Keypoint[]>([]);
  const canvasRefFromDetector = useRef<React.RefObject<HTMLCanvasElement> | null>(null);
  
  // Track current frame for comparison
  const [currentFrame, setCurrentFrame] = useState<RecordingFrame | null>(null);
  
  // Update current frame when detection is active
  useEffect(() => {
    if (isDetecting && currentKeypoints.length > 0) {
      // Capture frame data for comparison
      let imageData: string | undefined;
      if (canvasRefFromDetector.current?.current) {
        try {
          const tempCanvas = document.createElement('canvas');
          const sourceCanvas = canvasRefFromDetector.current.current;
          tempCanvas.width = 320;
          tempCanvas.height = 240;
          const ctx = tempCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(sourceCanvas, 0, 0, 320, 240);
            imageData = tempCanvas.toDataURL('image/jpeg', 0.6);
          }
        } catch (e) {
          // Ignore canvas capture errors
        }
      }
      
      setCurrentFrame({
        timestamp: Date.now(),
        keypoints: currentKeypoints,
        feedback: currentFeedback,
        imageData,
      });
    }
  }, [isDetecting, currentKeypoints, currentFeedback]);

  const {
    isSupported,
    isSpeaking,
    isPaused,
    voices,
    settings,
    speak,
    speakSequence,
    pause,
    resume,
    stop,
    updateSettings,
  } = useVoiceGuidance();

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  if (!pose) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold mb-4">Pose not found</h1>
            <Link to="/yoga" className="btn-wellness">
              Back to Yoga Library
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const startGuidedSession = () => {
    setIsPlaying(true);
    setCurrentStep(0);

    const allInstructions = pose.instructions.map((inst) => inst.text);
    
    // Speak the first instruction
    if (pose.instructions[0]) {
      speak(pose.instructions[0].text);
    }
  };

  const playCurrentStep = () => {
    if (pose.instructions[currentStep]) {
      speak(pose.instructions[currentStep].text);
    }
  };

  const nextStep = () => {
    if (currentStep < pose.instructions.length - 1) {
      stop();
      const nextIndex = currentStep + 1;
      setCurrentStep(nextIndex);
      speak(pose.instructions[nextIndex].text);
    } else {
      stopSession();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      stop();
      const prevIndex = currentStep - 1;
      setCurrentStep(prevIndex);
      speak(pose.instructions[prevIndex].text);
    }
  };

  const stopSession = () => {
    stop();
    setIsPlaying(false);
    setCurrentStep(0);
    setBreathPhase("rest");
  };

  const togglePlayPause = () => {
    if (isPaused) {
      resume();
    } else if (isSpeaking) {
      pause();
    } else if (!isPlaying) {
      startGuidedSession();
    } else {
      playCurrentStep();
    }
  };

  const currentInstruction = pose.instructions[currentStep];
  const progress = ((currentStep + 1) / pose.instructions.length) * 100;

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "intro":
        return "bg-wellness-lavender/50 text-accent-foreground";
      case "setup":
        return "bg-wellness-sage/50 text-secondary-foreground";
      case "entry":
        return "bg-primary/10 text-primary";
      case "hold":
        return "bg-wellness-mint/50 text-secondary-foreground";
      case "adjust":
        return "bg-wellness-sky/50 text-blue-700";
      case "release":
        return "bg-wellness-peach/50 text-orange-700";
      case "benefit":
        return "bg-green-100 text-green-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link
              to="/yoga"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Yoga Library
            </Link>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold mb-1">{pose.name}</h1>
                <p className="text-lg text-muted-foreground italic mb-2">
                  {pose.sanskritName} • {pose.pronunciation}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {pose.duration}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < pose.difficulty ? "text-primary fill-primary" : "text-muted"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {!isSupported && (
                <div className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                  Voice guidance not supported in this browser
                </div>
              )}
            </div>
          </motion.div>

          {/* Main content grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column - Pose info */}
            <div className={cn(
              "space-y-6",
              viewMode === "sidebyside" ? "lg:col-span-2" : "lg:col-span-1"
            )}>
              {/* View Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("3d")}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm",
                    viewMode === "3d" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <Box className="w-4 h-4" />
                  3D View
                </button>
                <button
                  onClick={() => setViewMode("camera")}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm",
                    viewMode === "camera" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <Camera className="w-4 h-4" />
                  Camera
                </button>
                <button
                  onClick={() => setViewMode("sidebyside")}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm",
                    viewMode === "sidebyside" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <Columns className="w-4 h-4" />
                  Side by Side
                </button>
              </div>

              {/* Side by Side View */}
              {viewMode === "sidebyside" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {/* 3D Reference */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Box className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Reference Pose</span>
                    </div>
                    <div className="aspect-square bg-gradient-to-br from-wellness-sage/30 to-wellness-mint/20 rounded-xl overflow-hidden relative">
                      <PoseViewer3D 
                        poseName={pose.name}
                        poseId={pose.id}
                        muscleGroups={pose.muscleGroups}
                      />
                    </div>
                  </div>

                  {/* Camera Detection */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Camera className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Your Pose</span>
                    </div>
                    <PoseDetector 
                      poseId={pose.id}
                      poseName={pose.name}
                      onFeedbackChange={setCurrentFeedback}
                      onKeypointsChange={setCurrentKeypoints}
                      onCanvasReady={(ref) => { canvasRefFromDetector.current = ref; }}
                      onDetectionStateChange={setIsDetecting}
                    />
                  </div>
                </motion.div>
              )}

              {/* Session Recording - Visible when camera is active */}
              {(viewMode === "camera" || viewMode === "sidebyside") && (
                <>
                  <SessionRecorder
                    poseId={pose.id}
                    poseName={pose.name}
                    isDetecting={isDetecting}
                    currentKeypoints={currentKeypoints}
                    currentFeedback={currentFeedback}
                    canvasRef={canvasRefFromDetector.current || undefined}
                  />
                  
                  {/* Pose Comparison with Historical Sessions */}
                  <PoseComparison
                    poseId={pose.id}
                    poseName={pose.name}
                    currentFrame={currentFrame}
                  />
                </>
              )}

              {/* Single View - 3D */}
              {viewMode === "3d" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="aspect-square bg-gradient-to-br from-wellness-sage/30 to-wellness-mint/20 rounded-2xl overflow-hidden relative">
                    <PoseViewer3D 
                      poseName={pose.name}
                      poseId={pose.id}
                      muscleGroups={pose.muscleGroups}
                    />
                  </div>
                  
                  <div className="glass-card rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Box className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold">3D Pose Viewer</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Interactive 3D model with skeleton view and muscle highlighting. 
                      Drag to rotate, scroll to zoom.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Single View - Camera */}
              {viewMode === "camera" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <PoseDetector 
                    poseId={pose.id}
                    poseName={pose.name}
                    onFeedbackChange={setCurrentFeedback}
                    onKeypointsChange={setCurrentKeypoints}
                    onCanvasReady={(ref) => { canvasRefFromDetector.current = ref; }}
                    onDetectionStateChange={setIsDetecting}
                  />
                  
                  <div className="glass-card rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold">AI Pose Detection</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Real-time pose analysis using computer vision. 
                      Get instant feedback on your form.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Benefits */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Benefits
                </h3>
                <ul className="space-y-2">
                  {pose.benefits.map((benefit, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contraindications */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Avoid if
                </h3>
                <ul className="space-y-2">
                  {pose.contraindications.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right column - Voice guidance */}
            <div className={cn(
              "space-y-6",
              viewMode === "sidebyside" ? "lg:col-span-1" : "lg:col-span-2"
            )}>
              {/* Voice controls */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-xl font-semibold">Voice-Guided Session</h3>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      showSettings ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                {/* Settings panel */}
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-6"
                    >
                      <div className="space-y-4 p-4 rounded-xl bg-muted/50">
                        {/* Voice selection */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">Voice</label>
                          <select
                            value={settings.voiceIndex}
                            onChange={(e) => updateSettings({ voiceIndex: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                          >
                            {voices.map((voice, i) => (
                              <option key={i} value={i}>
                                {voice.name} ({voice.lang})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Speed */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Speed: {settings.rate.toFixed(2)}x
                          </label>
                          <Slider
                            value={[settings.rate]}
                            onValueChange={([value]) => updateSettings({ rate: value })}
                            min={0.5}
                            max={1.5}
                            step={0.05}
                            className="w-full"
                          />
                        </div>

                        {/* Pitch */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Pitch: {settings.pitch.toFixed(1)}
                          </label>
                          <Slider
                            value={[settings.pitch]}
                            onValueChange={([value]) => updateSettings({ pitch: value })}
                            min={0.5}
                            max={2}
                            step={0.1}
                            className="w-full"
                          />
                        </div>

                        {/* Volume */}
                        <div>
                          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                            <Volume2 className="w-4 h-4" />
                            Volume: {Math.round(settings.volume * 100)}%
                          </label>
                          <Slider
                            value={[settings.volume]}
                            onValueChange={([value]) => updateSettings({ volume: value })}
                            min={0}
                            max={1}
                            step={0.1}
                            className="w-full"
                          />
                        </div>

                        {/* Test button */}
                        <button
                          onClick={() => speak("This is a test of the voice guidance settings.")}
                          className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80"
                        >
                          Test Voice
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Progress bar */}
                {isPlaying && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Step {currentStep + 1} of {pose.instructions.length}</span>
                      <span>{Math.round(progress)}% complete</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Current instruction */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="mb-6"
                  >
                    {currentInstruction && isPlaying ? (
                      <div className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-wellness-lavender/10">
                        <div className="flex items-center gap-2 mb-3">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium capitalize",
                              getPhaseColor(currentInstruction.phase)
                            )}
                          >
                            {currentInstruction.phase}
                          </span>
                          {currentInstruction.breathCue && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-breath-inhale/20 text-blue-700">
                              {currentInstruction.breathCue}
                            </span>
                          )}
                        </div>
                        <p className="text-lg leading-relaxed">{currentInstruction.text}</p>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-muted/50 text-center">
                        <p className="text-muted-foreground">
                          Press play to begin your voice-guided yoga session
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Playback controls */}
                <div className="flex items-center justify-center gap-4">
                  {isPlaying && (
                    <button
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className="p-3 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-50 transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}

                  <button
                    onClick={togglePlayPause}
                    className="p-5 rounded-full bg-primary text-primary-foreground shadow-glow hover:scale-105 transition-transform"
                  >
                    {isSpeaking && !isPaused ? (
                      <Pause className="w-8 h-8" />
                    ) : (
                      <Play className="w-8 h-8 ml-1" />
                    )}
                  </button>

                  {isPlaying && (
                    <>
                      <button
                        onClick={nextStep}
                        disabled={currentStep === pose.instructions.length - 1}
                        className="p-3 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-50 transition-colors"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <button
                        onClick={stopSession}
                        className="p-3 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <Square className="w-6 h-6" />
                      </button>
                    </>
                  )}
                </div>

                {/* Speaking indicator */}
                {isSpeaking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-2 h-2 rounded-full bg-primary"
                    />
                    Speaking...
                  </motion.div>
                )}
              </div>

              {/* All instructions list */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-display text-lg font-semibold mb-4">All Instructions</h3>
                <div className="space-y-3">
                  {pose.instructions.map((instruction, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentStep(index);
                        setIsPlaying(true);
                        speak(instruction.text);
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-xl transition-all",
                        currentStep === index && isPlaying
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium capitalize",
                                getPhaseColor(instruction.phase)
                              )}
                            >
                              {instruction.phase}
                            </span>
                            {instruction.breathCue && (
                              <span className="text-xs text-muted-foreground">
                                ({instruction.breathCue})
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {instruction.text}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PoseDetailPage;
