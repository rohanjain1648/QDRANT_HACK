import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  Camera,
  Sparkles,
  ChevronRight,
  Clock,
  Target,
  Award,
  Loader2,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { RecordedSession, RecordingFrame } from '@/hooks/useSessionRecording';

interface ComparisonResult {
  pointId: string;
  similarity: number;
  historicalAccuracy: number;
  historicalFormQuality: string;
  historicalAlignment: string;
  historicalObservations: string[];
  timestamp: number;
  sessionId: string;
  comparison: string;
}

interface CurrentAnalysis {
  description: string;
  alignment: string;
  formQuality: string;
  keyObservations: string[];
}

interface ComparisonStats {
  totalHistoricalSessions: number;
  averageHistoricalAccuracy: number;
  formQualityDistribution: Record<string, number>;
}

interface PoseComparisonProps {
  poseId: string;
  poseName: string;
  currentSession?: RecordedSession | null;
  currentFrame?: RecordingFrame | null;
  onCompare?: () => void;
}

export const PoseComparison = ({
  poseId,
  poseName,
  currentSession,
  currentFrame,
}: PoseComparisonProps) => {
  const { user } = useAuth();
  const [isComparing, setIsComparing] = useState(false);
  const [isStoring, setIsStoring] = useState(false);
  const [comparisons, setComparisons] = useState<ComparisonResult[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<CurrentAnalysis | null>(null);
  const [stats, setStats] = useState<ComparisonStats | null>(null);
  const [history, setHistory] = useState<Array<{
    pointId: string;
    accuracy: number;
    formQuality: string;
    timestamp: number;
    sessionId: string;
  }>>([]);

  // Load history on mount
  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user?.id, poseId]);

  const loadHistory = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('pose-comparison', {
        body: { action: 'history', userId: user.id, poseId, limit: 10 },
      });

      if (error) throw error;
      setHistory(data.history || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  // Store current session snapshot
  const storeSnapshot = useCallback(async (frame: RecordingFrame) => {
    if (!user?.id || !frame.imageData) return;

    setIsStoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('pose-comparison', {
        body: {
          action: 'store',
          userId: user.id,
          sessionId: currentSession?.id || `snapshot-${Date.now()}`,
          poseId,
          poseName,
          imageData: frame.imageData,
          accuracy: frame.feedback.accuracy,
          keypoints: frame.keypoints.map(k => ({
            x: k.x,
            y: k.y,
            score: k.score || 0,
            name: k.name || 'unknown',
          })),
          timestamp: Date.now(),
        },
      });

      if (error) throw error;
      toast.success('Pose snapshot stored for future comparison');
      await loadHistory();
    } catch (error) {
      console.error('Failed to store snapshot:', error);
      toast.error('Failed to store snapshot');
    } finally {
      setIsStoring(false);
    }
  }, [user?.id, poseId, poseName, currentSession?.id]);

  // Compare current pose with historical attempts
  const compareWithHistory = useCallback(async () => {
    if (!user?.id || !currentFrame?.imageData) {
      toast.error('No current pose image to compare');
      return;
    }

    setIsComparing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pose-comparison', {
        body: {
          action: 'compare',
          userId: user.id,
          poseId,
          currentImage: currentFrame.imageData,
          limit: 5,
        },
      });

      if (error) throw error;

      setCurrentAnalysis(data.currentAnalysis);
      setComparisons(data.comparisons || []);
      setStats(data.stats);

      if (data.comparisons?.length === 0) {
        toast.info('No historical sessions found. Keep practicing to build your comparison history!');
      }
    } catch (error) {
      console.error('Comparison failed:', error);
      toast.error('Failed to compare poses');
    } finally {
      setIsComparing(false);
    }
  }, [user?.id, poseId, currentFrame]);

  const getFormQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'needs_improvement': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getFormQualityBadge = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'good': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'needs_improvement': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'poor': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return '';
    }
  };

  const getTrendIcon = (current: string, historical: string) => {
    const formMap: Record<string, number> = { excellent: 4, good: 3, needs_improvement: 2, poor: 1 };
    const currentScore = formMap[current] || 0;
    const historicalScore = formMap[historical] || 0;

    if (currentScore > historicalScore) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (currentScore < historicalScore) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Pose Comparison</h3>
            <p className="text-sm text-muted-foreground font-normal">
              Compare with your historical attempts
            </p>
          </div>
          {history.length > 0 && (
            <Badge variant="secondary">{history.length} sessions</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={compareWithHistory}
            disabled={isComparing || !currentFrame?.imageData}
            className="flex-1"
          >
            {isComparing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Compare with History
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => currentFrame && storeSnapshot(currentFrame)}
            disabled={isStoring || !currentFrame?.imageData}
          >
            {isStoring ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Current Analysis */}
        <AnimatePresence mode="wait">
          {currentAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-primary/5 border border-primary/10"
            >
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="font-medium">Current Pose Analysis</span>
                <Badge className={getFormQualityBadge(currentAnalysis.formQuality)}>
                  {currentAnalysis.formQuality.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{currentAnalysis.alignment}</p>
              <div className="flex flex-wrap gap-1">
                {currentAnalysis.keyObservations.slice(0, 3).map((obs, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {obs}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats summary */}
        {stats && stats.totalHistoricalSessions > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <BarChart3 className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold">{stats.totalHistoricalSessions}</div>
              <div className="text-xs text-muted-foreground">Sessions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold">{stats.averageHistoricalAccuracy}%</div>
              <div className="text-xs text-muted-foreground">Avg Accuracy</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Award className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold">{stats.formQualityDistribution.excellent || 0}</div>
              <div className="text-xs text-muted-foreground">Excellent</div>
            </div>
          </div>
        )}

        {/* Comparison Results */}
        {comparisons.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Similar Historical Sessions
            </h4>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {comparisons.map((comp, index) => (
                  <motion.div
                    key={comp.pointId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                          {comp.similarity}%
                        </div>
                        <div>
                          <div className="text-sm font-medium flex items-center gap-1">
                            {getTrendIcon(currentAnalysis?.formQuality || '', comp.historicalFormQuality)}
                            <span className={getFormQualityColor(comp.historicalFormQuality)}>
                              {comp.historicalFormQuality.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(comp.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{comp.historicalAccuracy}%</div>
                        <div className="text-xs text-muted-foreground">accuracy</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{comp.comparison}</p>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* History timeline */}
        {history.length > 0 && comparisons.length === 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Sessions
            </h4>
            <div className="space-y-2">
              {history.slice(0, 5).map((session, index) => (
                <div
                  key={session.pointId}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <Badge className={getFormQualityBadge(session.formQuality)} variant="outline">
                      {session.formQuality.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">{session.accuracy}%</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {history.length === 0 && comparisons.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No historical sessions yet</p>
            <p className="text-xs mt-1">
              Practice poses with camera detection to build comparison data
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
