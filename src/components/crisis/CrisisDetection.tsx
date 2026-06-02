import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Shield, 
  TrendingDown, 
  TrendingUp, 
  Activity,
  Phone,
  MessageCircle,
  Heart,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Info,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface CrisisIndicator {
  type: 'rapid_decline' | 'isolation_pattern' | 'severity_spike' | 'anomaly_detected' | 'sustained_low';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  evidencePoints: Array<{
    id: string;
    score: number;
    timestamp: string;
    mood: string;
    content?: string;
  }>;
  suggestedActions: string[];
}

interface CrisisReport {
  userId: string;
  timestamp: string;
  overallRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  indicators: CrisisIndicator[];
  baselineDeviation: number;
  recentTrend: 'improving' | 'stable' | 'declining' | 'volatile';
  supportResources: Array<{ name: string; description: string; contact?: string }>;
  message?: string;
}

const riskColors = {
  none: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const riskIcons = {
  none: CheckCircle,
  low: Info,
  medium: AlertCircle,
  high: AlertTriangle,
  critical: Zap,
};

const indicatorIcons = {
  rapid_decline: TrendingDown,
  isolation_pattern: Heart,
  severity_spike: Zap,
  anomaly_detected: Activity,
  sustained_low: TrendingDown,
};

const trendIcons = {
  improving: TrendingUp,
  stable: Activity,
  declining: TrendingDown,
  volatile: Zap,
};

export function CrisisDetection() {
  const { user } = useAuth();
  const [report, setReport] = useState<CrisisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIndicator, setExpandedIndicator] = useState<number | null>(null);
  const [showResources, setShowResources] = useState(false);

  const runDetection = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('crisis-detection', {
        body: { userId: user.id },
      });

      if (error) throw error;
      setReport(data);
      
      // Auto-show resources if risk is high or critical
      if (data.overallRisk === 'high' || data.overallRisk === 'critical') {
        setShowResources(true);
      }
    } catch (error) {
      console.error('Crisis detection error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    runDetection();
  }, [runDetection]);

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Sign in to enable crisis pattern detection</p>
        </CardContent>
      </Card>
    );
  }

  const RiskIcon = report ? riskIcons[report.overallRisk] : Shield;
  const TrendIcon = report ? trendIcons[report.recentTrend] : Activity;

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              Crisis Pattern Detection
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={runDetection}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Analyzing...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !report ? (
            <div className="py-8 text-center">
              <Activity className="w-8 h-8 mx-auto mb-3 animate-pulse text-primary" />
              <p className="text-muted-foreground">Analyzing emotional patterns...</p>
            </div>
          ) : report ? (
            <div className="space-y-4">
              {/* Risk Level Display */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`p-4 rounded-lg border ${riskColors[report.overallRisk]}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RiskIcon className="w-8 h-8" />
                    <div>
                      <h3 className="font-semibold capitalize">
                        {report.overallRisk === 'none' ? 'No Concerns Detected' : `${report.overallRisk} Risk Level`}
                      </h3>
                      <p className="text-sm opacity-80">
                        {report.indicators.length} pattern{report.indicators.length !== 1 ? 's' : ''} analyzed
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendIcon className="w-4 h-4" />
                      <span className="capitalize">{report.recentTrend}</span>
                    </div>
                    {report.baselineDeviation > 0 && (
                      <p className="text-xs opacity-70 mt-1">
                        {report.baselineDeviation.toFixed(1)}σ from baseline
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Message for insufficient data */}
              {report.message && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <Info className="w-4 h-4 inline mr-2" />
                  {report.message}
                </div>
              )}

              {/* Indicators */}
              {report.indicators.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Detected Patterns</h4>
                  <AnimatePresence>
                    {report.indicators.map((indicator, index) => {
                      const IndicatorIcon = indicatorIcons[indicator.type];
                      const isExpanded = expandedIndicator === index;

                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Collapsible open={isExpanded} onOpenChange={() => setExpandedIndicator(isExpanded ? null : index)}>
                            <CollapsibleTrigger asChild>
                              <div className="w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <IndicatorIcon className="w-5 h-5 text-muted-foreground" />
                                    <div className="text-left">
                                      <p className="font-medium text-sm capitalize">
                                        {indicator.type.replace(/_/g, ' ')}
                                      </p>
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        {indicator.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={riskColors[indicator.severity]}>
                                      {indicator.severity}
                                    </Badge>
                                    <Progress 
                                      value={indicator.confidence * 100} 
                                      className="w-16 h-2"
                                    />
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 p-3 rounded-lg bg-muted/20 space-y-3">
                                {/* Evidence Points */}
                                {indicator.evidencePoints.length > 0 && (
                                  <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Evidence Points</h5>
                                    <div className="space-y-1">
                                      {indicator.evidencePoints.map((point, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-background/50">
                                          <span className="font-mono text-primary">{point.score.toFixed(1)}</span>
                                          <span className="capitalize text-muted-foreground">{point.mood}</span>
                                          <span className="text-muted-foreground/60 flex-1 truncate">
                                            {point.content || new Date(point.timestamp).toLocaleDateString()}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Suggested Actions */}
                                <div>
                                  <h5 className="text-xs font-medium text-muted-foreground mb-2">Suggested Actions</h5>
                                  <ul className="space-y-1">
                                    {indicator.suggestedActions.map((action, i) => (
                                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                        <CheckCircle className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                                        {action}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* Support Resources */}
              {report.supportResources.length > 0 && (
                <Collapsible open={showResources} onOpenChange={setShowResources}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <Phone className="w-4 h-4" />
                      {showResources ? 'Hide' : 'Show'} Support Resources
                      {showResources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 space-y-2"
                    >
                      {report.supportResources.map((resource, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-primary/5 border border-primary/20"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-primary/10">
                              {index === 0 ? <Phone className="w-4 h-4 text-primary" /> :
                               index === 1 ? <MessageCircle className="w-4 h-4 text-primary" /> :
                               <Heart className="w-4 h-4 text-primary" />}
                            </div>
                            <div>
                              <h5 className="font-medium text-sm">{resource.name}</h5>
                              <p className="text-xs text-muted-foreground">{resource.description}</p>
                              {resource.contact && (
                                <p className="text-sm font-mono text-primary mt-1">{resource.contact}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>Unable to run crisis detection</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Qdrant Info Banner */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
        <div className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-muted-foreground">
            <span className="text-purple-400 font-medium">Qdrant Distance Thresholds</span>
            {' '}detect anomalies by comparing current emotional vectors against historical baselines
          </span>
        </div>
      </div>
    </div>
  );
}
