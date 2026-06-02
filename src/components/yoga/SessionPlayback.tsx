import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  Percent,
  Download,
  Share2,
  FileJson,
  Film,
  Loader2,
} from 'lucide-react';
import { RecordedSession, RecordingFrame } from '@/hooks/useSessionRecording';
import { useSessionExport } from '@/hooks/useSessionExport';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';

interface SessionPlaybackProps {
  session: RecordedSession;
  onClose?: () => void;
}

export const SessionPlayback = ({ session, onClose }: SessionPlaybackProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    isExporting,
    exportProgress,
    downloadVideo,
    exportAsJSON,
    shareProgress,
    downloadShareImage,
  } = useSessionExport();
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const currentFrame = session.frames[currentFrameIndex];
  const progress = (currentFrameIndex / (session.frames.length - 1)) * 100;

  const drawFrame = useCallback((frame: RecordingFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw skeleton
    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 480;

    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
    ];

    const getKeypoint = (name: string) => frame.keypoints.find(k => k.name === name);

    // Draw connections
    ctx.lineWidth = 3;
    ctx.strokeStyle = frame.feedback.isCorrect ? '#22c55e' : '#f59e0b';

    connections.forEach(([start, end]) => {
      const startKp = getKeypoint(start);
      const endKp = getKeypoint(end);

      if (startKp && endKp && (startKp.score || 0) > 0.5 && (endKp.score || 0) > 0.5) {
        ctx.beginPath();
        ctx.moveTo(startKp.x * scaleX, startKp.y * scaleY);
        ctx.lineTo(endKp.x * scaleX, endKp.y * scaleY);
        ctx.stroke();
      }
    });

    // Draw keypoints
    frame.keypoints.forEach(kp => {
      if ((kp.score || 0) > 0.5) {
        ctx.fillStyle = frame.feedback.isCorrect ? '#22c55e' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(kp.x * scaleX, kp.y * scaleY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(kp.x * scaleX, kp.y * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw accuracy overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 120, 40);
    ctx.fillStyle = frame.feedback.isCorrect ? '#22c55e' : '#f59e0b';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText(`${Math.round(frame.feedback.accuracy)}%`, 20, 38);

    // Draw time
    const timeStr = formatTime(frame.timestamp);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui';
    ctx.fillText(timeStr, 80, 36);
  }, []);

  const playAnimation = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;

    const elapsed = (timestamp - lastTimeRef.current) * playbackSpeed;
    
    if (elapsed >= 33) { // ~30fps
      lastTimeRef.current = timestamp;
      
      setCurrentFrameIndex(prev => {
        const next = prev + 1;
        if (next >= session.frames.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(playAnimation);
    }
  }, [isPlaying, playbackSpeed, session.frames.length]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(playAnimation);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playAnimation]);

  useEffect(() => {
    if (currentFrame) {
      drawFrame(currentFrame);
    }
  }, [currentFrame, drawFrame]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const restart = () => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  };

  const skipBack = () => {
    setCurrentFrameIndex(prev => Math.max(0, prev - 30));
  };

  const skipForward = () => {
    setCurrentFrameIndex(prev => Math.min(session.frames.length - 1, prev + 30));
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-500';
    if (accuracy >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-4"
    >
      {/* Playback Canvas */}
      <div className="relative aspect-[4/3] bg-muted rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-full object-contain"
        />

        {/* Accuracy Overlay */}
        {currentFrame && (
          <div className="absolute top-4 right-4 glass-card rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Activity className={cn("w-5 h-5", getAccuracyColor(currentFrame.feedback.accuracy))} />
              <span className={cn("font-bold text-lg", getAccuracyColor(currentFrame.feedback.accuracy))}>
                {Math.round(currentFrame.feedback.accuracy)}%
              </span>
              {currentFrame.feedback.isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-2">
        <Slider
          value={[currentFrameIndex]}
          onValueChange={([value]) => {
            setIsPlaying(false);
            setCurrentFrameIndex(value);
          }}
          min={0}
          max={session.frames.length - 1}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTime(currentFrame?.timestamp || 0)}</span>
          <span>{formatTime(session.duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={restart}
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={skipBack}
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={togglePlay}
          className="p-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button
          onClick={skipForward}
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <SkipForward className="w-5 h-5" />
        </button>
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-muted border-none text-sm"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
      </div>

      {/* Export Options */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Export & Share</h4>
        
        {isExporting && (
          <div className="glass-card rounded-lg p-3">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm">Exporting video...</span>
            </div>
            <Progress value={exportProgress} className="h-2" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => downloadVideo(session)}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Film className="w-4 h-4" />
            Export Video
          </button>
          <button
            onClick={() => shareProgress(session)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share Progress
          </button>
          <button
            onClick={() => downloadShareImage(session)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Image
          </button>
          <button
            onClick={() => exportAsJSON(session)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <FileJson className="w-4 h-4" />
            Export Data
          </button>
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{formatTime(session.duration)}</p>
          <p className="text-xs text-muted-foreground">Duration</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className={cn("text-lg font-bold", getAccuracyColor(session.averageAccuracy))}>
            {Math.round(session.averageAccuracy)}%
          </p>
          <p className="text-xs text-muted-foreground">Avg Accuracy</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <Percent className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className={cn("text-lg font-bold", getAccuracyColor(session.correctFramePercentage))}>
            {Math.round(session.correctFramePercentage)}%
          </p>
          <p className="text-xs text-muted-foreground">Correct Time</p>
        </div>
      </div>

      {/* Current Feedback */}
      {currentFrame && currentFrame.feedback.suggestions.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h4 className="font-medium mb-2">Feedback at this moment:</h4>
          <ul className="space-y-1">
            {currentFrame.feedback.suggestions.map((suggestion, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
};
