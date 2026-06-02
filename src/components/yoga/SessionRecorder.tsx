import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle,
  Square,
  Save,
  Trash2,
  Play,
  Clock,
  TrendingUp,
  X,
  Video,
  History,
  Download,
  Share2,
  MoreVertical,
} from 'lucide-react';
import { useSessionRecording, RecordedSession } from '@/hooks/useSessionRecording';
import { useSessionExport } from '@/hooks/useSessionExport';
import { SessionPlayback } from './SessionPlayback';
import { PoseFeedback, Keypoint } from '@/hooks/usePoseDetection';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SessionRecorderProps {
  poseId: string;
  poseName: string;
  isDetecting: boolean;
  currentKeypoints: Keypoint[];
  currentFeedback: PoseFeedback;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const SessionRecorder = ({
  poseId,
  poseName,
  isDetecting,
  currentKeypoints,
  currentFeedback,
  canvasRef,
}: SessionRecorderProps) => {
  const {
    isRecording,
    currentSession,
    savedSessions,
    startRecording,
    recordFrame,
    stopRecording,
    saveSession,
    deleteSession,
  } = useSessionRecording(poseId, poseName);

  const {
    downloadVideo,
    exportAsJSON,
    shareProgress,
    isExporting,
  } = useSessionExport();

  const [recordingTime, setRecordingTime] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [playbackSession, setPlaybackSession] = useState<RecordedSession | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // Record frames while recording is active
  useEffect(() => {
    if (isRecording && isDetecting && currentKeypoints.length > 0) {
      recordFrame(currentKeypoints, currentFeedback, canvasRef);
    }
  }, [isRecording, isDetecting, currentKeypoints, currentFeedback, recordFrame, canvasRef]);

  // Update recording timer
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      setRecordingTime(0);
      interval = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleStopRecording = () => {
    const session = stopRecording();
    if (session && session.frames.length > 10) {
      setShowSavePrompt(true);
    }
  };

  const handleSave = () => {
    if (currentSession) {
      saveSession(currentSession);
      setShowSavePrompt(false);
    }
  };

  const handleDiscard = () => {
    setShowSavePrompt(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-500';
    if (accuracy >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Show playback view
  if (playbackSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">Session Playback</h3>
          <button
            onClick={() => setPlaybackSession(null)}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <SessionPlayback session={playbackSession} onClose={() => setPlaybackSession(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Session Recording</h3>
          </div>
          {savedSessions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors",
                showHistory ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              <History className="w-4 h-4" />
              History ({savedSessions.length})
            </button>
          )}
        </div>

        {/* Recording Button */}
        <div className="flex items-center gap-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!isDetecting}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                isDetecting
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Circle className="w-4 h-4 fill-current" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-all animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Recording
            </button>
          )}

          {isRecording && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
            </motion.div>
          )}
        </div>

        {!isDetecting && !isRecording && (
          <p className="text-sm text-muted-foreground mt-2">
            Start pose detection to enable recording
          </p>
        )}
      </div>

      {/* Save Prompt */}
      <AnimatePresence>
        {showSavePrompt && currentSession && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass-card rounded-xl p-4"
          >
            <h4 className="font-semibold mb-3">Session Complete!</h4>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-lg font-bold">{formatTime(Math.floor(currentSession.duration / 1000))}</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
              <div className="text-center">
                <p className={cn("text-lg font-bold", getAccuracyColor(currentSession.averageAccuracy))}>
                  {Math.round(currentSession.averageAccuracy)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Accuracy</p>
              </div>
              <div className="text-center">
                <p className={cn("text-lg font-bold", getAccuracyColor(currentSession.peakAccuracy))}>
                  {Math.round(currentSession.peakAccuracy)}%
                </p>
                <p className="text-xs text-muted-foreground">Peak</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Session
              </button>
              <button
                onClick={() => setPlaybackSession(currentSession)}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <Play className="w-4 h-4" />
                Review
              </button>
              <button
                onClick={handleDiscard}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {savedSessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className={cn("w-5 h-5", getAccuracyColor(session.averageAccuracy))} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{formatDate(session.startTime)}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(Math.floor(session.duration / 1000))}
                        </span>
                        <span className={getAccuracyColor(session.averageAccuracy)}>
                          {Math.round(session.averageAccuracy)}% avg
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPlaybackSession(session)}
                      className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      title="Play"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadVideo(session)} disabled={isExporting}>
                          <Download className="w-4 h-4 mr-2" />
                          Export Video
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareProgress(session)}>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteSession(session.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
