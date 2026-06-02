import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, 
  RefreshCw, 
  Brain, 
  Heart, 
  Zap, 
  Moon, 
  Sun,
  TrendingUp,
  History,
  ChevronRight,
  Loader2,
  Target,
  Activity,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

interface PoseRecommendation {
  poseId: string;
  reason: string;
  confidence: number;
  pose: {
    id: string;
    name: string;
    sanskritName: string;
    difficulty: number;
    category: string;
    benefits: string[];
  };
  personalHistory: {
    usedBefore: boolean;
    moodImprovement?: string;
  };
}

interface RecommendationResponse {
  success: boolean;
  recommendations: PoseRecommendation[];
  reasoning: string;
  context: {
    currentMood: string;
    targetBenefit: string | null;
    moodMemoriesUsed: number;
    sessionMemoriesUsed: number;
    successfulPastSessions: number;
  };
}

const moodIcons: Record<string, typeof Sun> = {
  very_low: Moon,
  low: Moon,
  neutral: Activity,
  good: Sun,
  great: Zap,
};

const moodColors: Record<string, string> = {
  very_low: 'text-violet-500',
  low: 'text-blue-500',
  neutral: 'text-teal-500',
  good: 'text-emerald-500',
  great: 'text-amber-500',
};

const moodLabels: Record<string, string> = {
  very_low: 'Very Low',
  low: 'Low',
  neutral: 'Neutral',
  good: 'Good',
  great: 'Great',
};

const difficultyLabels: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
};

const benefitOptions = [
  { value: 'stress', label: 'Stress Relief' },
  { value: 'energy', label: 'Energy Boost' },
  { value: 'balance', label: 'Better Balance' },
  { value: 'strength', label: 'Build Strength' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'focus', label: 'Mental Focus' },
  { value: 'relaxation', label: 'Deep Relaxation' },
];

export function PersonalizedPoseRecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<PoseRecommendation[]>([]);
  const [reasoning, setReasoning] = useState<string>('');
  const [context, setContext] = useState<RecommendationResponse['context'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetBenefit, setTargetBenefit] = useState<string>('');
  const [overrideMood, setOverrideMood] = useState<string>('');

  const fetchRecommendations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pose-recommendations', {
        body: {
          userId: user.id,
          currentMood: overrideMood || undefined,
          targetBenefit: targetBenefit || undefined,
          limit: 5,
        },
      });

      if (error) throw error;

      if (data.success) {
        setRecommendations(data.recommendations);
        setReasoning(data.reasoning);
        setContext(data.context);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [user, targetBenefit, overrideMood]);

  useEffect(() => {
    if (user) {
      fetchRecommendations();
    }
  }, [user, fetchRecommendations]);

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="py-8 text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to get personalized pose recommendations</p>
        </CardContent>
      </Card>
    );
  }

  const MoodIcon = context?.currentMood ? moodIcons[context.currentMood] || Activity : Activity;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Personalized For You</CardTitle>
              <CardDescription>AI-powered pose recommendations based on your mood & history</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecommendations}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={overrideMood} onValueChange={setOverrideMood}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Current mood" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Auto-detect</SelectItem>
              <SelectItem value="very_low">Very Low</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="great">Great</SelectItem>
            </SelectContent>
          </Select>

          <Select value={targetBenefit} onValueChange={setTargetBenefit}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Target benefit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any benefit</SelectItem>
              {benefitOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchRecommendations} disabled={loading}>
            <Target className="h-4 w-4 mr-1" />
            Apply
          </Button>
        </div>

        {/* Context summary */}
        {context && !loading && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className="gap-1">
              <MoodIcon className={`h-3 w-3 ${moodColors[context.currentMood] || ''}`} />
              {moodLabels[context.currentMood] || 'Unknown'} mood
            </Badge>
            {context.moodMemoriesUsed > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Brain className="h-3 w-3" />
                {context.moodMemoriesUsed} mood memories
              </Badge>
            )}
            {context.sessionMemoriesUsed > 0 && (
              <Badge variant="secondary" className="gap-1">
                <History className="h-3 w-3" />
                {context.sessionMemoriesUsed} past sessions
              </Badge>
            )}
            {context.successfulPastSessions > 0 && (
              <Badge variant="secondary" className="gap-1 text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                {context.successfulPastSessions} mood improvements
              </Badge>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your patterns...</p>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <AnimatePresence mode="wait">
          {!loading && recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {recommendations.map((rec, index) => (
                <motion.div
                  key={rec.poseId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={`/yoga/pose/${rec.poseId}`}>
                    <Card className="group hover:shadow-md transition-all cursor-pointer border-border/50 hover:border-primary/30">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Confidence indicator */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="relative w-12 h-12 flex items-center justify-center">
                              <svg className="w-12 h-12 -rotate-90">
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  className="text-muted/30"
                                />
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  strokeDasharray={`${rec.confidence * 125.6} 125.6`}
                                  className="text-primary"
                                />
                              </svg>
                              <span className="absolute text-xs font-medium">
                                {Math.round(rec.confidence * 100)}%
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">match</span>
                          </div>

                          {/* Pose info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{rec.pose.name}</h4>
                              {rec.personalHistory.usedBefore && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 text-emerald-600 border-emerald-200">
                                  <TrendingUp className="h-2.5 w-2.5" />
                                  Worked before
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground italic mb-2">{rec.pose.sanskritName}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{rec.reason}</p>
                            
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {rec.pose.category}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {difficultyLabels[rec.pose.difficulty]}
                              </Badge>
                              {rec.personalHistory.moodImprovement && (
                                <Badge variant="outline" className="text-[10px] text-emerald-600">
                                  {rec.personalHistory.moodImprovement}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI reasoning */}
        {!loading && reasoning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 rounded-lg bg-muted/50 border border-border/50"
          >
            <div className="flex items-start gap-2">
              <Brain className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">AI Reasoning</p>
                <p className="text-sm">{reasoning}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && recommendations.length === 0 && (
          <div className="text-center py-8">
            <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No recommendations yet. Start tracking your mood and practicing yoga!</p>
            <Button variant="outline" className="mt-4" onClick={fetchRecommendations}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
