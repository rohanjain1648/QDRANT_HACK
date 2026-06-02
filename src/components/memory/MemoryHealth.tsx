import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, AlertTriangle, Ghost, RefreshCw, TrendingUp, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface InsightHealth {
  id: string;
  text: string;
  type: string;
  baseConfidence: number;
  decayFactor: number;
  effectiveConfidence: number;
  status: 'active' | 'fading' | 'forgotten';
  daysSinceReinforced: number;
}

interface MemoryHealthData {
  totalInsights: number;
  activeInsights: number;
  fadingInsights: number;
  forgottenInsights: number;
  insights: InsightHealth[];
}

const statusConfig = {
  active: { color: 'bg-emerald-500', icon: Sparkles, label: 'Active', textColor: 'text-emerald-600' },
  fading: { color: 'bg-amber-500', icon: AlertTriangle, label: 'Fading', textColor: 'text-amber-600' },
  forgotten: { color: 'bg-muted', icon: Ghost, label: 'Forgotten', textColor: 'text-muted-foreground' },
};

export function MemoryHealth() {
  const { user } = useAuth();
  const [health, setHealth] = useState<MemoryHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reinforcing, setReinforcing] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('memory-decay', {
        body: { operation: 'health_check', userId: user.id },
      });

      if (error) throw error;
      setHealth(data.data);
    } catch (e) {
      console.error('Error fetching memory health:', e);
      toast.error('Failed to load memory health');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleReinforce = async (insightId: string) => {
    if (!user) return;

    setReinforcing(insightId);
    try {
      const { data, error } = await supabase.functions.invoke('memory-decay', {
        body: { 
          operation: 'reinforce', 
          userId: user.id, 
          insightId,
          evidenceType: 'user_feedback' 
        },
      });

      if (error) throw error;
      
      toast.success(`Memory reinforced! Confidence: ${(data.data.newConfidence * 100).toFixed(0)}%`);
      fetchHealth();
    } catch (e) {
      console.error('Error reinforcing insight:', e);
      toast.error('Failed to reinforce memory');
    } finally {
      setReinforcing(null);
    }
  };

  const handleApplyDecay = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('memory-decay', {
        body: { operation: 'apply_decay', userId: user.id },
      });

      if (error) throw error;
      
      toast.success(`Decay applied: ${data.data.fadingCount} fading, ${data.data.forgottenCount} forgotten`);
      fetchHealth();
    } catch (e) {
      console.error('Error applying decay:', e);
      toast.error('Failed to apply decay');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          Sign in to view your memory health
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Memory Health</CardTitle>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleApplyDecay} disabled={loading}>
                  <Clock className="h-4 w-4 mr-1" />
                  Apply Decay
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Simulate time passing to see memory decay in action</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading && !health ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : health ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{health.totalInsights}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <div className="text-2xl font-bold text-emerald-600">{health.activeInsights}</div>
                <div className="text-xs text-emerald-600">Active</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <div className="text-2xl font-bold text-amber-600">{health.fadingInsights}</div>
                <div className="text-xs text-amber-600">Fading</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-muted-foreground">{health.forgottenInsights}</div>
                <div className="text-xs text-muted-foreground">Forgotten</div>
              </div>
            </div>

            {/* Insight List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {health.insights.map((insight, index) => {
                  const config = statusConfig[insight.status];
                  const StatusIcon = config.icon;

                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 rounded-lg border ${
                        insight.status === 'forgotten' ? 'opacity-50' : ''
                      } bg-background/50`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusIcon className={`h-4 w-4 ${config.textColor}`} />
                            <Badge variant="outline" className="text-xs">
                              {insight.type}
                            </Badge>
                            <Badge className={`${config.color} text-white text-xs`}>
                              {config.label}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-foreground line-clamp-2 mb-3">
                            {insight.text}
                          </p>

                          {/* Confidence Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Effective Confidence</span>
                              <span>{(insight.effectiveConfidence * 100).toFixed(0)}%</span>
                            </div>
                            <Progress 
                              value={insight.effectiveConfidence * 100} 
                              className="h-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Base: {(insight.baseConfidence * 100).toFixed(0)}%</span>
                              <span>Decay: {(insight.decayFactor * 100).toFixed(0)}%</span>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{insight.daysSinceReinforced} days since last reinforcement</span>
                          </div>
                        </div>

                        {insight.status !== 'forgotten' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReinforce(insight.id)}
                                  disabled={reinforcing === insight.id}
                                  className="shrink-0"
                                >
                                  {reinforcing === insight.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Zap className="h-4 w-4 text-primary" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reinforce this memory</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {health.insights.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No insights yet. Use the app to generate memories!</p>
                </div>
              )}
            </div>

            {/* Memory Decay Explanation */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">How Memory Decay Works</p>
                  <p className="text-muted-foreground">
                    Insights naturally fade over time (halving every 2 weeks) unless reinforced by new evidence. 
                    Active engagement with the app discovers patterns that strengthen related memories.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Failed to load memory health</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
