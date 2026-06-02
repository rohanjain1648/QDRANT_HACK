import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calendar, 
  Clock, 
  Sun, 
  Moon,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Sparkles,
  BarChart3,
  Snowflake,
  Flower2,
  CloudSun,
  Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface CyclicalPattern {
  cycleType: 'daily' | 'weekly' | 'monthly' | 'seasonal';
  pattern: string;
  strength: number;
  peakPeriods: string[];
  lowPeriods: string[];
  confidence: number;
  dataPoints: number;
  recommendation: string;
}

interface TemporalAnalysis {
  weeklyPattern: CyclicalPattern | null;
  monthlyPattern: CyclicalPattern | null;
  seasonalPattern: CyclicalPattern | null;
  overallTrend: 'improving' | 'declining' | 'stable' | 'cyclical';
  predictedNextWeek: { mood: string; confidence: number };
  historicalComparison: {
    currentPeriodAvg: number;
    samePeriodLastYear: number | null;
    yearOverYearChange: number | null;
  };
  aiInsight: string;
  dataPoints: number;
  dateRange?: { start: string; end: string };
}

const seasonIcons: Record<string, React.ReactNode> = {
  'Winter': <Snowflake className="w-4 h-4" />,
  'Spring': <Flower2 className="w-4 h-4" />,
  'Summer': <Sun className="w-4 h-4" />,
  'Fall': <Leaf className="w-4 h-4" />,
};

const moodPredictionColors: Record<string, string> = {
  very_low: 'text-red-500',
  low: 'text-orange-500',
  neutral: 'text-yellow-500',
  good: 'text-lime-500',
  great: 'text-green-500',
};

export function TemporalPatterns() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<TemporalAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'weekly' | 'monthly' | 'seasonal'>('overview');

  const fetchAnalysis = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('temporal-patterns', {
        body: { userId: user.id, analysisType: 'all' },
      });

      if (error) throw error;

      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Temporal analysis error:', err);
      toast.error('Failed to analyze temporal patterns');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAnalysis();
    }
  }, [user, fetchAnalysis]);

  const getTrendIcon = () => {
    if (!analysis) return <Minus className="w-5 h-5 text-muted-foreground" />;
    
    switch (analysis.overallTrend) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'cyclical':
        return <BarChart3 className="w-5 h-5 text-primary" />;
      default:
        return <Minus className="w-5 h-5 text-yellow-500" />;
    }
  };

  const renderPatternCard = (pattern: CyclicalPattern | null, title: string, icon: React.ReactNode) => {
    if (!pattern) {
      return (
        <Card className="bg-muted/30">
          <CardContent className="py-6 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
              {icon}
              <span className="text-sm font-medium">{title}</span>
            </div>
            <p className="text-xs text-muted-foreground">Not enough data yet</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-medium">{title}</span>
            </div>
            <Badge 
              variant="outline" 
              className={pattern.strength > 0.5 ? 'bg-green-500/10 text-green-600' : 'bg-muted'}
            >
              {Math.round(pattern.strength * 100)}% strength
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">{pattern.pattern}</p>
          
          <div className="flex flex-wrap gap-2">
            {pattern.peakPeriods.map((period) => (
              <Badge key={period} className="bg-green-500/20 text-green-700 dark:text-green-300 text-xs">
                ↑ {period}
              </Badge>
            ))}
            {pattern.lowPeriods.map((period) => (
              <Badge key={period} className="bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs">
                ↓ {period}
              </Badge>
            ))}
          </div>
          
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-primary">{pattern.recommendation}</p>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{pattern.dataPoints} data points</span>
            <span>{Math.round(pattern.confidence * 100)}% confidence</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-8 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to see temporal patterns</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Temporal Patterns
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchAnalysis}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
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
                <Clock className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Scrolling Qdrant with time filters...</span>
              </div>
              <Progress value={33} className="h-1" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <BarChart3 className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Detecting cyclical patterns...</span>
              </div>
              <Progress value={66} className="h-1" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Generating temporal insights...</span>
              </div>
              <Progress value={100} className="h-1" />
            </motion.div>
          ) : analysis ? (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {activeView === 'overview' && (
                <>
                  {/* Overview Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {getTrendIcon()}
                        <span className="text-lg font-bold capitalize">{analysis.overallTrend}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Overall Trend</p>
                    </div>
                    
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-lg font-bold">{analysis.dataPoints}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Data Points</p>
                    </div>
                    
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className={`text-lg font-bold ${moodPredictionColors[analysis.predictedNextWeek.mood]}`}>
                          {analysis.predictedNextWeek.mood.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Next Week ({Math.round(analysis.predictedNextWeek.confidence * 100)}%)
                      </p>
                    </div>
                  </div>

                  {/* Historical Comparison */}
                  {analysis.historicalComparison.samePeriodLastYear !== null && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Year-over-Year</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <p className="text-lg font-bold">{analysis.historicalComparison.currentPeriodAvg}</p>
                          <p className="text-xs text-muted-foreground">This Period</p>
                        </div>
                        <div className="text-center">
                          {analysis.historicalComparison.yearOverYearChange !== null && (
                            <p className={`text-lg font-bold ${
                              analysis.historicalComparison.yearOverYearChange > 0 
                                ? 'text-green-500' 
                                : analysis.historicalComparison.yearOverYearChange < 0 
                                  ? 'text-red-500' 
                                  : 'text-muted-foreground'
                            }`}>
                              {analysis.historicalComparison.yearOverYearChange > 0 ? '+' : ''}
                              {analysis.historicalComparison.yearOverYearChange}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">Change</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold">{analysis.historicalComparison.samePeriodLastYear}</p>
                          <p className="text-xs text-muted-foreground">Last Year</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Insight */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Temporal Insight</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {analysis.aiInsight}
                    </p>
                  </div>

                  {/* Pattern Summary */}
                  <div className="grid gap-2">
                    {analysis.weeklyPattern && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <span className="text-xs flex-1">Weekly pattern detected</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(analysis.weeklyPattern.strength * 100)}%
                        </Badge>
                      </div>
                    )}
                    {analysis.monthlyPattern && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <Moon className="w-4 h-4 text-blue-500" />
                        <span className="text-xs flex-1">Monthly pattern detected</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(analysis.monthlyPattern.strength * 100)}%
                        </Badge>
                      </div>
                    )}
                    {analysis.seasonalPattern && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <CloudSun className="w-4 h-4 text-primary" />
                        <span className="text-xs flex-1">Seasonal pattern detected</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(analysis.seasonalPattern.strength * 100)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeView === 'weekly' && (
                <div className="space-y-4">
                  {renderPatternCard(
                    analysis.weeklyPattern, 
                    'Day-of-Week Patterns',
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                  {analysis.weeklyPattern && (
                    <div className="grid grid-cols-7 gap-1">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        const isPeak = analysis.weeklyPattern?.peakPeriods.includes(dayNames[i]);
                        const isLow = analysis.weeklyPattern?.lowPeriods.includes(dayNames[i]);
                        return (
                          <div 
                            key={i}
                            className={`text-center p-2 rounded-lg text-xs font-medium ${
                              isPeak 
                                ? 'bg-green-500/20 text-green-600' 
                                : isLow 
                                  ? 'bg-orange-500/20 text-orange-600'
                                  : 'bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeView === 'monthly' && (
                <div className="space-y-4">
                  {renderPatternCard(
                    analysis.monthlyPattern,
                    'Week-of-Month Patterns',
                    <Moon className="w-4 h-4 text-blue-500" />
                  )}
                  {analysis.monthlyPattern && (
                    <div className="grid grid-cols-4 gap-2">
                      {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((week, i) => {
                        const weekNames = ['First week', 'Second week', 'Third week', 'Fourth week'];
                        const isPeak = analysis.monthlyPattern?.peakPeriods.includes(weekNames[i]);
                        const isLow = analysis.monthlyPattern?.lowPeriods.includes(weekNames[i]);
                        return (
                          <div 
                            key={i}
                            className={`text-center p-3 rounded-lg text-xs font-medium ${
                              isPeak 
                                ? 'bg-green-500/20 text-green-600' 
                                : isLow 
                                  ? 'bg-orange-500/20 text-orange-600'
                                  : 'bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            {week}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeView === 'seasonal' && (
                <div className="space-y-4">
                  {renderPatternCard(
                    analysis.seasonalPattern,
                    'Seasonal Patterns',
                    <CloudSun className="w-4 h-4 text-primary" />
                  )}
                  {analysis.seasonalPattern && (
                    <div className="grid grid-cols-4 gap-2">
                      {['Winter', 'Spring', 'Summer', 'Fall'].map((season) => {
                        const isPeak = analysis.seasonalPattern?.peakPeriods.includes(season);
                        const isLow = analysis.seasonalPattern?.lowPeriods.includes(season);
                        return (
                          <div 
                            key={season}
                            className={`text-center p-3 rounded-lg ${
                              isPeak 
                                ? 'bg-green-500/20 text-green-600' 
                                : isLow 
                                  ? 'bg-orange-500/20 text-orange-600'
                                  : 'bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-center mb-1">
                              {seasonIcons[season]}
                            </div>
                            <span className="text-xs font-medium">{season}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Date Range Info */}
              {analysis.dateRange && (
                <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
                  Analyzing data from {new Date(analysis.dateRange.start).toLocaleDateString()} to{' '}
                  {new Date(analysis.dateRange.end).toLocaleDateString()}
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
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                No temporal data available yet
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={fetchAnalysis}
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
