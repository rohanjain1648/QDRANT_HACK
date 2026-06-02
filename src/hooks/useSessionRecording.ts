import { useState, useRef, useCallback } from 'react';
import { PoseFeedback, Keypoint } from './usePoseDetection';

export type RecordingFrame = {
  timestamp: number;
  keypoints: Keypoint[];
  feedback: PoseFeedback;
  imageData?: string; // Base64 snapshot
};

export type RecordedSession = {
  id: string;
  poseId: string;
  poseName: string;
  startTime: number;
  endTime: number;
  duration: number;
  frames: RecordingFrame[];
  averageAccuracy: number;
  peakAccuracy: number;
  correctFramePercentage: number;
};

export const useSessionRecording = (poseId: string, poseName: string) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<RecordedSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<RecordedSession[]>(() => {
    try {
      const stored = localStorage.getItem(`yoga-sessions-${poseId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const framesRef = useRef<RecordingFrame[]>([]);
  const startTimeRef = useRef<number>(0);
  const recordingIntervalRef = useRef<number>();

  const startRecording = useCallback(() => {
    framesRef.current = [];
    startTimeRef.current = Date.now();
    setIsRecording(true);
    setCurrentSession(null);
  }, []);

  const recordFrame = useCallback((
    keypoints: Keypoint[],
    feedback: PoseFeedback,
    canvasRef?: React.RefObject<HTMLCanvasElement>
  ) => {
    if (!isRecording) return;

    const frame: RecordingFrame = {
      timestamp: Date.now() - startTimeRef.current,
      keypoints: [...keypoints],
      feedback: { ...feedback },
    };

    // Capture canvas snapshot every 500ms to reduce storage
    if (canvasRef?.current && framesRef.current.length % 15 === 0) {
      try {
        const tempCanvas = document.createElement('canvas');
        const sourceCanvas = canvasRef.current;
        tempCanvas.width = 320;
        tempCanvas.height = 240;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(sourceCanvas, 0, 0, 320, 240);
          frame.imageData = tempCanvas.toDataURL('image/jpeg', 0.6);
        }
      } catch (e) {
        // Ignore canvas capture errors
      }
    }

    framesRef.current.push(frame);
  }, [isRecording]);

  const stopRecording = useCallback((): RecordedSession | null => {
    if (!isRecording || framesRef.current.length === 0) {
      setIsRecording(false);
      return null;
    }

    const endTime = Date.now();
    const frames = framesRef.current;
    
    // Calculate statistics
    const accuracies = frames.map(f => f.feedback.accuracy);
    const averageAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const peakAccuracy = Math.max(...accuracies);
    const correctFrames = frames.filter(f => f.feedback.isCorrect).length;
    const correctFramePercentage = (correctFrames / frames.length) * 100;

    const session: RecordedSession = {
      id: `session-${Date.now()}`,
      poseId,
      poseName,
      startTime: startTimeRef.current,
      endTime,
      duration: endTime - startTimeRef.current,
      frames,
      averageAccuracy,
      peakAccuracy,
      correctFramePercentage,
    };

    setCurrentSession(session);
    setIsRecording(false);

    return session;
  }, [isRecording, poseId, poseName]);

  const saveSession = useCallback((session: RecordedSession) => {
    const updated = [session, ...savedSessions].slice(0, 10); // Keep last 10 sessions
    setSavedSessions(updated);
    
    // Save to localStorage (without image data to save space)
    const toStore = updated.map(s => ({
      ...s,
      frames: s.frames.map(f => ({ ...f, imageData: undefined })),
    }));
    try {
      localStorage.setItem(`yoga-sessions-${poseId}`, JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to save session to localStorage');
    }
  }, [savedSessions, poseId]);

  const deleteSession = useCallback((sessionId: string) => {
    const updated = savedSessions.filter(s => s.id !== sessionId);
    setSavedSessions(updated);
    localStorage.setItem(`yoga-sessions-${poseId}`, JSON.stringify(updated));
  }, [savedSessions, poseId]);

  const clearAllSessions = useCallback(() => {
    setSavedSessions([]);
    localStorage.removeItem(`yoga-sessions-${poseId}`);
  }, [poseId]);

  return {
    isRecording,
    currentSession,
    savedSessions,
    startRecording,
    recordFrame,
    stopRecording,
    saveSession,
    deleteSession,
    clearAllSessions,
  };
};
