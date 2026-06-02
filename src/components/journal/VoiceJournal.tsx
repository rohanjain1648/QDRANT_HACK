import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Send, 
  Trash2,
  Waves,
  Brain,
  Heart,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface EmotionAnalysis {
  dominantEmotion: string;
  emotions: Record<string, number>;
  sentiment: 'positive' | 'negative' | 'neutral';
  intensity: number;
  voiceCharacteristics: {
    pace: 'slow' | 'normal' | 'fast';
    energy: 'low' | 'medium' | 'high';
    stability: 'stable' | 'variable';
  };
}

interface ProcessingResult {
  transcription: string;
  emotionAnalysis: EmotionAnalysis;
  moodLevel: string;
  moodScore: number;
}

const emotionEmojis: Record<string, string> = {
  joy: '😊',
  hopeful: '🌟',
  peaceful: '😌',
  surprise: '😮',
  neutral: '😐',
  anxious: '😰',
  fear: '😨',
  sadness: '😢',
  anger: '😠',
  disgust: '🤢',
};

const emotionColors: Record<string, string> = {
  joy: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  hopeful: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  peaceful: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  surprise: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  neutral: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
  anxious: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  fear: 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30',
  sadness: 'bg-blue-600/20 text-blue-800 border-blue-600/30',
  anger: 'bg-red-500/20 text-red-700 border-red-500/30',
  disgust: 'bg-green-600/20 text-green-800 border-green-600/30',
};

const sentimentColors = {
  positive: 'bg-green-500/20 text-green-700 border-green-500/30',
  negative: 'bg-red-500/20 text-red-700 border-red-500/30',
  neutral: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
};

export function VoiceJournal() {
  const { user } = useAuth();
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    clearRecording,
    getAudioBase64,
  } = useVoiceRecorder();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;

    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
      setAudioElement(audio);
    }
  }, [audioUrl, audioElement, isPlaying]);

  const processVoiceEntry = useCallback(async () => {
    if (!user || !audioBlob) return;

    setIsProcessing(true);
    try {
      const audioBase64 = await getAudioBase64();
      
      if (!audioBase64) {
        throw new Error('Failed to encode audio');
      }

      const { data, error } = await supabase.functions.invoke('voice-journal', {
        body: {
          audioBase64,
          userId: user.id,
          duration,
        },
      });

      if (error) throw error;

      if (data.success) {
        setResult(data.entry);
        toast.success('Voice journal saved!', {
          description: `Detected emotion: ${data.entry.emotionAnalysis.dominantEmotion}`,
        });
      } else {
        throw new Error(data.error || 'Processing failed');
      }
    } catch (err) {
      console.error('Voice processing error:', err);
      toast.error('Failed to process voice entry', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [user, audioBlob, duration, getAudioBase64]);

  const handleClear = () => {
    clearRecording();
    setResult(null);
    if (audioElement) {
      audioElement.pause();
      setAudioElement(null);
    }
    setIsPlaying(false);
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 text-center">
          <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to use voice journaling</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          Voice Journal
          <Badge variant="outline" className="ml-2 text-xs">
            <Brain className="w-3 h-3 mr-1" />
            Emotion AI
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Recording Section */}
        <div className="flex flex-col items-center gap-4">
          {/* Recording Visualization */}
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div
                key="recording"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative"
              >
                {/* Pulsing rings */}
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-red-500/20"
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="absolute inset-0 rounded-full bg-red-500/10"
                />
                
                <Button
                  size="lg"
                  variant="destructive"
                  className="relative z-10 h-20 w-20 rounded-full"
                  onClick={stopRecording}
                >
                  <MicOff className="h-8 w-8" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <Button
                  size="lg"
                  className="h-20 w-20 rounded-full"
                  onClick={startRecording}
                  disabled={!!audioBlob}
                >
                  <Mic className="h-8 w-8" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Duration Display */}
          <div className="text-center">
            {isRecording ? (
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-500"
                />
                <span className="text-lg font-mono">{formatDuration(duration)}</span>
                <Waves className="w-4 h-4 text-muted-foreground animate-pulse" />
              </div>
            ) : audioBlob ? (
              <span className="text-lg font-mono text-muted-foreground">
                {formatDuration(duration)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Tap to start recording
              </span>
            )}
          </div>

          {/* Error Display */}
          {recorderError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {recorderError}
            </div>
          )}
        </div>

        {/* Audio Preview */}
        <AnimatePresence>
          {audioBlob && !result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-lg bg-muted/30 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={togglePlayback}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 mr-1" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClear}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={processVoiceEntry}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    {isProcessing ? 'Processing...' : 'Save Entry'}
                  </Button>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="w-4 h-4 animate-pulse" />
                    Analyzing emotions & transcribing...
                  </div>
                  <Progress value={undefined} className="h-1" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Display */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Success Header */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Voice entry saved to Qdrant
                </span>
              </div>

              {/* Transcription */}
              <div className="p-4 rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Transcription
                </h4>
                <p className="text-sm text-muted-foreground">
                  {result.transcription}
                </p>
              </div>

              {/* Emotion Analysis */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Emotion Analysis
                </h4>

                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className={emotionColors[result.emotionAnalysis.dominantEmotion] || emotionColors.neutral}
                  >
                    {emotionEmojis[result.emotionAnalysis.dominantEmotion]} {result.emotionAnalysis.dominantEmotion}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={sentimentColors[result.emotionAnalysis.sentiment]}
                  >
                    {result.emotionAnalysis.sentiment}
                  </Badge>
                </div>

                {/* Emotion Breakdown */}
                <div className="space-y-2">
                  {Object.entries(result.emotionAnalysis.emotions)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([emotion, score]) => (
                      <div key={emotion} className="flex items-center gap-2">
                        <span className="text-xs w-20 capitalize">{emotion}</span>
                        <Progress value={score * 100} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-10">
                          {Math.round(score * 100)}%
                        </span>
                      </div>
                    ))}
                </div>

                {/* Voice Characteristics */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                  <Badge variant="secondary" className="text-xs">
                    Pace: {result.emotionAnalysis.voiceCharacteristics.pace}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Energy: {result.emotionAnalysis.voiceCharacteristics.energy}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {result.emotionAnalysis.voiceCharacteristics.stability}
                  </Badge>
                </div>
              </div>

              {/* New Recording Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClear}
              >
                <Mic className="w-4 h-4 mr-2" />
                Record Another Entry
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Footer */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p className="flex items-center justify-center gap-1">
            <Brain className="w-3 h-3" />
            Voice entries are transcribed and stored with emotion embeddings in Qdrant
          </p>
          <p>Enables multimodal search across text and voice journals</p>
        </div>
      </CardContent>
    </Card>
  );
}
