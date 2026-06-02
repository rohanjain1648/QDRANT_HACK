import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Volume2,
  VolumeX,
  Target,
  Activity,
} from 'lucide-react';
import { usePoseDetection, PoseFeedback, Keypoint } from '@/hooks/usePoseDetection';
import { cn } from '@/lib/utils';

interface PoseDetectorProps {
  poseId: string;
  poseName: string;
  onFeedbackChange?: (feedback: PoseFeedback) => void;
  onKeypointsChange?: (keypoints: Keypoint[]) => void;
  onCanvasReady?: (canvasRef: React.RefObject<HTMLCanvasElement>) => void;
  onDetectionStateChange?: (isDetecting: boolean) => void;
}

export const PoseDetector = ({ 
  poseId, 
  poseName, 
  onFeedbackChange,
  onKeypointsChange,
  onCanvasReady,
  onDetectionStateChange,
}: PoseDetectorProps) => {
  const {
    videoRef,
    canvasRef,
    isLoading,
    isDetecting,
    error,
    feedback,
    currentPose,
    startDetection,
    stopDetection,
  } = usePoseDetection(poseId);

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [lastSpokenSuggestion, setLastSpokenSuggestion] = useState<string>('');

  // Voice feedback
  useEffect(() => {
    if (!voiceEnabled || !isDetecting) return;

    const suggestion = feedback.suggestions[0];
    if (suggestion && suggestion !== lastSpokenSuggestion && !feedback.isCorrect) {
      const utterance = new SpeechSynthesisUtterance(suggestion);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
      setLastSpokenSuggestion(suggestion);
    }

    if (feedback.isCorrect && lastSpokenSuggestion !== 'perfect') {
      const utterance = new SpeechSynthesisUtterance('Great job! Your pose looks correct.');
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
      setLastSpokenSuggestion('perfect');
    }
  }, [feedback, voiceEnabled, isDetecting, lastSpokenSuggestion]);

  // Notify parent of feedback changes
  useEffect(() => {
    onFeedbackChange?.(feedback);
  }, [feedback, onFeedbackChange]);

  // Notify parent of keypoints changes
  useEffect(() => {
    onKeypointsChange?.(currentPose);
  }, [currentPose, onKeypointsChange]);

  // Notify parent of canvas ref
  useEffect(() => {
    if (canvasRef) {
      onCanvasReady?.(canvasRef);
    }
  }, [canvasRef, onCanvasReady]);

  // Notify parent of detection state changes
  useEffect(() => {
    onDetectionStateChange?.(isDetecting);
  }, [isDetecting, onDetectionStateChange]);

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-500';
    if (accuracy >= 50) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-green-500';
    if (accuracy >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-4">
      {/* Camera view */}
      <div className="relative aspect-[4/3] bg-muted rounded-2xl overflow-hidden">
        {/* Hidden video element for processing */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />

        {/* Canvas for displaying pose overlay */}
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-full object-cover",
            !isDetecting && "hidden"
          )}
        />

        {/* Placeholder when not detecting */}
        {!isDetecting && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-wellness-sage/20 to-wellness-mint/20">
            <Camera className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center px-4">
              Enable camera to get real-time pose feedback
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Initializing pose detection...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 p-4">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-destructive text-center">{error}</p>
          </div>
        )}

        {/* Accuracy overlay */}
        {isDetecting && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="glass-card rounded-full px-4 py-2 flex items-center gap-2">
              <Activity className={cn("w-5 h-5", getAccuracyColor(feedback.accuracy))} />
              <span className="font-semibold">{Math.round(feedback.accuracy)}%</span>
            </div>

            {feedback.isCorrect && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="glass-card rounded-full px-4 py-2 flex items-center gap-2 bg-green-500/20"
              >
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-green-600 font-semibold">Correct!</span>
              </motion.div>
            )}
          </div>
        )}

        {/* Target pose indicator */}
        {isDetecting && (
          <div className="absolute bottom-4 left-4 glass-card rounded-lg px-3 py-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Target: {poseName}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={isDetecting ? stopDetection : startDetection}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all",
            isDetecting
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "bg-primary text-primary-foreground hover:scale-105 shadow-glow"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isDetecting ? (
            <CameraOff className="w-5 h-5" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
          {isLoading ? 'Loading...' : isDetecting ? 'Stop Detection' : 'Start Detection'}
        </button>

        {isDetecting && (
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={cn(
              "p-3 rounded-full transition-colors",
              voiceEnabled 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {voiceEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Feedback panel */}
      <AnimatePresence>
        {isDetecting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-4 space-y-4">
              {/* Accuracy bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Pose Accuracy</span>
                  <span className={cn("font-semibold", getAccuracyColor(feedback.accuracy))}>
                    {Math.round(feedback.accuracy)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", getAccuracyBg(feedback.accuracy))}
                    initial={{ width: 0 }}
                    animate={{ width: `${feedback.accuracy}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Suggestions */}
              {feedback.suggestions.length > 0 && !feedback.isCorrect && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    Adjustments Needed
                  </h4>
                  <ul className="space-y-1">
                    {feedback.suggestions.map((suggestion, i) => (
                      <motion.li
                        key={suggestion}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                        {suggestion}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success message */}
              {feedback.isCorrect && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10"
                >
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600">Excellent form!</p>
                    <p className="text-sm text-muted-foreground">
                      Your {poseName} looks great. Hold this position.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Joint feedback details */}
              {Object.keys(feedback.jointFeedback).length > 0 && (
                <div className="pt-2 border-t border-border">
                  <h4 className="text-sm font-medium mb-2">Joint Analysis</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(feedback.jointFeedback).map(([joint, info]) => (
                      <div
                        key={joint}
                        className={cn(
                          "text-xs px-2 py-1 rounded-lg flex items-center gap-1",
                          info.status === 'correct' ? "bg-green-500/10 text-green-600" :
                          info.status === 'adjust' ? "bg-yellow-500/10 text-yellow-600" :
                          "bg-red-500/10 text-red-600"
                        )}
                      >
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          info.status === 'correct' ? "bg-green-500" :
                          info.status === 'adjust' ? "bg-yellow-500" :
                          "bg-red-500"
                        )} />
                        {joint.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
