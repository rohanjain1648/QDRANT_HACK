import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Brain, 
  Sparkles, 
  BarChart3,
  Calendar,
  Tag,
  Lightbulb,
  RefreshCw,
  Database,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface PatternData {
  insight: string;
  recommendations: string[];
  patternType: string;
  confidence: number;
  weeklyStats: {
    averageMood: number;
    moodTrend: 'improving' | 'declining' | 'stable';
    trendValue: number;
    dominantMood: string;
    entriesCount: number;
    topTags: Array<{ tag: string; count: number }>;
    moodDistribution: Record<string, number>;
  } | null;
  qdrantContext: {
    historicalPatternsFound: number;
    relatedSessionsFound: number;
    similarMoodsFound: number;
    totalMatches: number;
  };
  patternId: string;
}

const moodColors: Record<string, string> = {
  very_low: 'bg-red-500',
  low: 'bg-orange-500',
  neutral: 'bg-yellow-500',
  good: 'bg-lime-500',
  great: 'bg-green-500',
};

const moodLabels: Record<string, string> = {
  very_low: 'Very Low',
  low: 'Low',
  neutral: 'Neutral',
  good: 'Good',
  great: 'Great',
};

export function PatternDetection() {
  const { user } = useAuth();
  const [pattern, setPattern] = useState<PatternData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week');

  const fetchPattern = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pattern-detection', {
        body: { userId: user.id, timeRange },
      });

      if (error) throw error;

      if (data.success) {
        setPattern(data.pattern);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Pattern detection error:', err);
      toast.error('Failed to analyze mood patterns');
    } finally {
      setLoading(false);
    }
  }, [user, timeRange]);

  useEffect(() => {
    if (user) {
      fetchPattern();
    }
  }, [user, timeRange, fetchPattern]);

  const getTrendIcon = () => {
    if (!pattern?.weeklyStats) return <Minus className="w-5 h-5 text-muted-foreground" />;
    
    switch (pattern.weeklyStats.moodTrend) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      default:
        return <Minus className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getPatternTypeColor = (type: string) => {
    switch (type) {
      case 'improving':
        return 'bg-green-500/20 text-green-700 dark:text-green-300';
      case 'declining':
        return 'bg-red-500/20 text-red-700 dark:text-red-300';
      case 'fluctuating':
        return 'bg-orange-500/20 text-orange-700 dark:text-orange-300';
      case 'stable':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-8 text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to see your mood patterns</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Pattern Detection
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchPattern}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="quarter">Quarter</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 py-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Searching Qdrant vector database...</span>
              </div>
              <Progress value={33} className="h-1" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <Brain className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Analyzing patterns with AI...</span>
              </div>
              <Progress value={66} className="h-1" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Generating personalized insights...</span>
              </div>
              <Progress value={100} className="h-1" />
            </motion.div>
          ) : pattern ? (
            <motion.div
              key="pattern"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Qdrant Context Banner */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                <Database className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  Qdrant found <strong className="text-foreground">{pattern.qdrantContext.totalMatches}</strong> related memories
                </span>
                <div className="flex gap-1 ml-auto">
                  <Badge variant="outline" className="text-xs py-0">
                    {pattern.qdrantContext.historicalPatternsFound} patterns
                  </Badge>
                  <Badge variant="outline" className="text-xs py-0">
                    {pattern.qdrantContext.relatedSessionsFound} sessions
                  </Badge>
                </div>
              </div>

              {/* Stats Overview */}
              {pattern.weeklyStats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {getTrendIcon()}
                      <span className="text-2xl font-bold">
                        {pattern.weeklyStats.averageMood}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Avg Mood</p>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">
                        {pattern.weeklyStats.entriesCount}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Entries</p>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Badge className={getPatternTypeColor(pattern.patternType)}>
                      {pattern.patternType}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Pattern</p>
                  </div>
                </div>
              )}

              {/* Mood Distribution */}
              {pattern.weeklyStats?.moodDistribution && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Mood Distribution</span>
                  </div>
                  <div className="flex gap-1 h-4 rounded-full overflow-hidden">
                    {Object.entries(pattern.weeklyStats.moodDistribution).map(([mood, count]) => {
                      const total = Object.values(pattern.weeklyStats!.moodDistribution).reduce((a, b) => a + b, 0);
                      const percentage = (count / total) * 100;
                      return (
                        <div
                          key={mood}
                          className={`${moodColors[mood]} transition-all`}
                          style={{ width: `${percentage}%` }}
                          title={`${moodLabels[mood]}: ${count} entries (${Math.round(percentage)}%)`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(pattern.weeklyStats.moodDistribution).map(([mood, count]) => (
                      <div key={mood} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${moodColors[mood]}`} />
                        <span className="text-xs text-muted-foreground">
                          {moodLabels[mood]} ({count})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insight */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">AI Insight</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {Math.round(pattern.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {pattern.insight}
                </p>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Personalized Recommendations</span>
                </div>
                <div className="space-y-2">
                  {pattern.recommendations.map((rec, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <Activity className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Top Tags */}
              {pattern.weeklyStats?.topTags && pattern.weeklyStats.topTags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Top Context Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pattern.weeklyStats.topTags.map(({ tag, count }) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag} <span className="ml-1 opacity-60">×{count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                No pattern data available yet
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={fetchPattern}
              >
                Analyze Patterns
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
