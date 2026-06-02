import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Brain, Heart, Activity, Shield, Loader2, Send, 
  MessageSquare, Lightbulb, Users, Database, 
  ArrowRight, CheckCircle2, AlertTriangle, Sparkles,
  ThumbsUp, ThumbsDown, BookOpen, TrendingUp, Vote, XCircle
} from 'lucide-react';
import { toast } from 'sonner';

type AgentType = 'mood_analyst' | 'yoga_coach' | 'crisis_detector' | 'orchestrator';

interface PastSuccess {
  recommendation: string;
  effectiveness: number;
  context: string;
  created_at: string;
}

interface AgentMessage {
  from: AgentType;
  to: AgentType | 'all';
  type: 'query' | 'insight' | 'alert' | 'recommendation';
  content: string;
  confidence: number;
  timestamp: string;
}

interface AgentResponse {
  agent: AgentType;
  status: 'success' | 'error';
  insights: string[];
  recommendations: string[];
  crossAgentData?: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  pastSuccesses?: PastSuccess[];
}

interface AgentMemory {
  id: string;
  agent: AgentType;
  insight: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AgentVote {
  agent: Exclude<AgentType, 'orchestrator'>;
  recommendation: string;
  vote: 'agree' | 'disagree' | 'abstain';
  confidence: number;
  reasoning: string;
}

interface ConsensusRecommendation {
  recommendation: string;
  proposingAgent: AgentType;
  supportingAgents: AgentType[];
  confidence: number;
  evidence: string[];
  votes: AgentVote[];
  consensusStrength: number;
  verdict: 'approved' | 'rejected' | 'mixed';
}

interface LearningStats {
  totalOutcomes: number;
  helpfulCount: number;
  byAgent: Record<AgentType, { total: number; helpful: number }>;
}

interface AgentRoutingScore {
  agent: Exclude<AgentType, 'orchestrator'>;
  similarityScore: number;
  keywordMatches: string[];
  shouldActivate: boolean;
  reason: string;
}

interface RoutingDecision {
  primaryAgent: Exclude<AgentType, 'orchestrator'>;
  activatedAgents: Exclude<AgentType, 'orchestrator'>[];
  routingScores: AgentRoutingScore[];
  routingReason: string;
  crisisOverride: boolean;
}

interface VotingStats {
  totalVotesCast: number;
  consensusRate: number;
  agentWeights: Record<Exclude<AgentType, 'orchestrator'>, number>;
}

interface CollaborativeResult {
  orchestratorSummary: string;
  agentResponses: AgentResponse[];
  sharedMemories: AgentMemory[];
  consensusRecommendations: ConsensusRecommendation[];
  communicationLog: AgentMessage[];
  learningStats: LearningStats;
  routingDecision?: RoutingDecision;
  votingStats?: VotingStats;
}

const agentConfig: Record<AgentType, { 
  name: string; 
  icon: typeof Brain; 
  color: string; 
  bgColor: string;
  description: string;
}> = {
  mood_analyst: {
    name: 'Mood Analyst',
    icon: Heart,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    description: 'Analyzes emotional patterns and mood dynamics',
  },
  yoga_coach: {
    name: 'Yoga Coach',
    icon: Activity,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    description: 'Recommends physical wellness activities',
  },
  crisis_detector: {
    name: 'Crisis Detector',
    icon: Shield,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    description: 'Monitors for concerning patterns',
  },
  orchestrator: {
    name: 'Orchestrator',
    icon: Brain,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    description: 'Coordinates agent collaboration',
  },
};

export function MultiAgentWellness() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollaborativeResult | null>(null);
  const [agentStats, setAgentStats] = useState<Record<AgentType, number> | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);

  const submitOutcome = useCallback(async (
    recommendation: string,
    agentId: AgentType,
    outcome: 'helpful' | 'not_helpful'
  ) => {
    if (!user) return;
    setSubmittingFeedback(recommendation);
    
    try {
      const { error } = await supabase.functions.invoke('multi-agent-wellness', {
        body: {
          operation: 'store_outcome',
          userId: user.id,
          context: {
            outcome: {
              recommendation_id: crypto.randomUUID(),
              recommendation,
              agent_id: agentId,
              outcome,
              effectiveness_score: outcome === 'helpful' ? 8 : 2,
              context_summary: query,
              query,
            },
          },
        },
      });

      if (error) throw error;
      toast.success('Feedback stored! Agents will learn from this.');
    } catch (err) {
      console.error('Outcome error:', err);
      toast.error('Failed to store feedback');
    } finally {
      setSubmittingFeedback(null);
    }
  }, [user, query]);

  const runCollaboration = useCallback(async () => {
    if (!user || !query.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('multi-agent-wellness', {
        body: {
          operation: 'collaborate',
          userId: user.id,
          query: query.trim(),
          context: {
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;

      if (data.success) {
        setResult(data.data);
        toast.success('Multi-agent collaboration complete');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Collaboration error:', err);
      toast.error('Failed to run agent collaboration');
    } finally {
      setLoading(false);
    }
  }, [user, query]);

  const fetchAgentStats = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('multi-agent-wellness', {
        body: {
          operation: 'get_stats',
          userId: user.id,
        },
      });

      if (error) throw error;
      if (data.success) {
        setAgentStats(data.data);
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, [user]);

  if (!user) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Sign in to use the multi-agent wellness system</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-card bg-gradient-to-r from-primary/5 via-wellness-lavender/10 to-wellness-sage/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-display">Multi-Agent Wellness System</CardTitle>
              <CardDescription>
                Collaborative AI agents sharing a Qdrant memory pool for personalized wellness insights
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Agent Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {(['mood_analyst', 'yoga_coach', 'crisis_detector'] as AgentType[]).map((agentType) => {
              const config = agentConfig[agentType];
              const Icon = config.icon;
              const stats = agentStats?.[agentType] || 0;

              return (
                <motion.div
                  key={agentType}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl ${config.bgColor} border border-border/50`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`h-6 w-6 ${config.color}`} />
                    <span className="font-semibold">{config.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{config.description}</p>
                  {agentStats && (
                    <Badge variant="secondary" className="text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      {stats} memories
                    </Badge>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Query Input */}
          <div className="flex gap-3">
            <Input
              placeholder="Ask the agents about your wellness... (e.g., 'How can I improve my mood today?')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && runCollaboration()}
              className="flex-1"
            />
            <Button 
              onClick={runCollaboration} 
              disabled={loading || !query.trim()}
              className="btn-wellness"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Ask Agents
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={fetchAgentStats}
              title="Refresh agent statistics"
            >
              <Database className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6 glass-card">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Overview</span>
                </TabsTrigger>
                <TabsTrigger value="voting" className="flex items-center gap-2">
                  <Vote className="h-4 w-4" />
                  <span className="hidden sm:inline">Votes</span>
                </TabsTrigger>
                <TabsTrigger value="agents" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Agents</span>
                </TabsTrigger>
                <TabsTrigger value="learning" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Learning</span>
                </TabsTrigger>
                <TabsTrigger value="communication" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Log</span>
                </TabsTrigger>
                <TabsTrigger value="memory" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline">Memory</span>
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-4 space-y-4">
                {/* RAG Routing Decision */}
                {result.routingDecision && (
                  <Card className="glass-card bg-gradient-to-r from-primary/5 to-transparent">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">RAG Router Decision</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{result.routingDecision.routingReason}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {result.routingDecision.routingScores.map((score) => {
                          const config = agentConfig[score.agent];
                          const Icon = config.icon;
                          return (
                            <div key={score.agent} className={`p-3 rounded-lg border ${score.shouldActivate ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20 opacity-50'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className={`h-4 w-4 ${config.color}`} />
                                <span className="text-xs font-medium">{config.name}</span>
                              </div>
                              <div className="text-lg font-bold">{(score.similarityScore * 100).toFixed(0)}%</div>
                              <Badge variant={score.shouldActivate ? "default" : "secondary"} className="text-xs mt-1">
                                {score.shouldActivate ? 'Active' : 'Skipped'}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Orchestrator Summary */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Collaborative Summary</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {result.orchestratorSummary}
                    </p>
                  </CardContent>
                </Card>

                {/* Consensus Recommendations */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-amber-500" />
                      <CardTitle className="text-lg">Consensus Recommendations</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.consensusRecommendations.length > 0 ? (
                        result.consensusRecommendations.map((rec, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`p-4 rounded-lg border ${
                              rec.verdict === 'approved' 
                                ? 'bg-emerald-500/5 border-emerald-500/30' 
                                : rec.verdict === 'rejected'
                                  ? 'bg-destructive/5 border-destructive/30'
                                  : 'bg-muted/30 border-border/50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {rec.verdict === 'approved' ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                              ) : rec.verdict === 'rejected' ? (
                                <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                              ) : (
                                <Vote className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge 
                                    variant={rec.verdict === 'approved' ? 'default' : rec.verdict === 'rejected' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {rec.verdict.toUpperCase()}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {(rec.consensusStrength * 100).toFixed(0)}% consensus
                                  </span>
                                </div>
                                <p className="font-medium">{rec.recommendation}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">Proposed by:</span>
                                  {rec.proposingAgent && (
                                    <Badge variant="outline" className={`text-xs ${agentConfig[rec.proposingAgent]?.bgColor || ''}`}>
                                      {agentConfig[rec.proposingAgent]?.name || rec.proposingAgent}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-2">Supported by:</span>
                                  {rec.supportingAgents.map((agent) => {
                                    const config = agentConfig[agent];
                                    return (
                                      <Badge key={agent} variant="secondary" className={`text-xs ${config.bgColor}`}>
                                        {config.name}
                                      </Badge>
                                    );
                                  })}
                                </div>
                                
                                {/* Vote breakdown */}
                                {rec.votes && rec.votes.length > 0 && (
                                  <div className="mt-3 pt-2 border-t border-border/50">
                                    <p className="text-xs text-muted-foreground mb-2">Agent Votes:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {rec.votes.map((vote, vIdx) => {
                                        const voteConfig = agentConfig[vote.agent];
                                        return (
                                          <div 
                                            key={vIdx}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                              vote.vote === 'agree' 
                                                ? 'bg-emerald-500/10 text-emerald-600' 
                                                : vote.vote === 'disagree'
                                                  ? 'bg-destructive/10 text-destructive'
                                                  : 'bg-muted text-muted-foreground'
                                            }`}
                                            title={vote.reasoning}
                                          >
                                            {vote.vote === 'agree' ? (
                                              <ThumbsUp className="h-3 w-3" />
                                            ) : vote.vote === 'disagree' ? (
                                              <ThumbsDown className="h-3 w-3" />
                                            ) : null}
                                            <span>{voteConfig?.name.split(' ')[0] || vote.agent}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Feedback buttons */}
                                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                                  <span className="text-xs text-muted-foreground">Was this helpful?</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => submitOutcome(rec.recommendation, rec.proposingAgent || rec.supportingAgents[0], 'helpful')}
                                    disabled={submittingFeedback === rec.recommendation}
                                  >
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                    Yes
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => submitOutcome(rec.recommendation, rec.proposingAgent || rec.supportingAgents[0], 'not_helpful')}
                                    disabled={submittingFeedback === rec.recommendation}
                                  >
                                    <ThumbsDown className="h-3 w-3 mr-1" />
                                    No
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No consensus recommendations yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Voting Tab */}
              <TabsContent value="voting" className="mt-4 space-y-4">
                {/* Voting Stats */}
                {result.votingStats && (
                  <Card className="glass-card bg-gradient-to-r from-primary/5 to-transparent">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Vote className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Consensus Voting Overview</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-muted/30 text-center">
                          <p className="text-2xl font-bold text-primary">{result.votingStats.totalVotesCast}</p>
                          <p className="text-xs text-muted-foreground">Total Votes Cast</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center">
                          <p className="text-2xl font-bold text-emerald-500">{result.votingStats.consensusRate.toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">Consensus Rate</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center">
                          <p className="text-2xl font-bold">{result.consensusRecommendations.filter(r => r.verdict === 'approved').length}</p>
                          <p className="text-xs text-muted-foreground">Approved</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center">
                          <p className="text-2xl font-bold">{result.consensusRecommendations.filter(r => r.verdict === 'mixed').length}</p>
                          <p className="text-xs text-muted-foreground">Mixed Votes</p>
                        </div>
                      </div>

                      {/* Agent Weights */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Agent Voting Weights</h4>
                        <p className="text-xs text-muted-foreground">
                          Weights are adjusted based on voting accuracy. Higher weights mean the agent's votes count more in consensus.
                        </p>
                        {(['mood_analyst', 'yoga_coach', 'crisis_detector'] as Exclude<AgentType, 'orchestrator'>[]).map((agentId) => {
                          const config = agentConfig[agentId];
                          const Icon = config.icon;
                          const weight = result.votingStats?.agentWeights?.[agentId] || 1;
                          const weightPercent = ((weight - 0.5) / 1.5) * 100; // Normalize from 0.5-2.0 to 0-100%

                          return (
                            <div key={agentId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                              <div className={`p-2 rounded-lg ${config.bgColor}`}>
                                <Icon className={`h-4 w-4 ${config.color}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{config.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Weight: {weight.toFixed(2)}x
                                  </span>
                                </div>
                                <Progress value={weightPercent} className="h-2" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Voting Log */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Voting Details
                    </CardTitle>
                    <CardDescription>
                      How each agent voted on the recommendations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {result.consensusRecommendations.map((rec, idx) => (
                          <div key={idx} className="p-4 rounded-lg border border-border/50 bg-muted/10">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge 
                                variant={rec.verdict === 'approved' ? 'default' : rec.verdict === 'rejected' ? 'destructive' : 'secondary'}
                              >
                                {rec.verdict}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {(rec.consensusStrength * 100).toFixed(0)}% strength
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-3">{rec.recommendation}</p>
                            
                            <div className="space-y-2">
                              {rec.votes?.map((vote, vIdx) => {
                                const voteConfig = agentConfig[vote.agent];
                                const VoteIcon = voteConfig?.icon || Brain;
                                
                                return (
                                  <div 
                                    key={vIdx}
                                    className={`flex items-start gap-3 p-2 rounded-lg ${
                                      vote.vote === 'agree' 
                                        ? 'bg-emerald-500/5' 
                                        : vote.vote === 'disagree'
                                          ? 'bg-destructive/5'
                                          : 'bg-muted/30'
                                    }`}
                                  >
                                    <div className={`p-1.5 rounded-lg ${voteConfig?.bgColor || 'bg-muted'}`}>
                                      <VoteIcon className={`h-3 w-3 ${voteConfig?.color || ''}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium">{voteConfig?.name || vote.agent}</span>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            vote.vote === 'agree' 
                                              ? 'border-emerald-500 text-emerald-600' 
                                              : vote.vote === 'disagree'
                                                ? 'border-destructive text-destructive'
                                                : ''
                                          }`}
                                        >
                                          {vote.vote.toUpperCase()}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground ml-auto">
                                          {(vote.confidence * 100).toFixed(0)}% conf
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">{vote.reasoning}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Agents Tab */}
              <TabsContent value="agents" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {result.agentResponses.map((response) => {
                    const config = agentConfig[response.agent];
                    const Icon = config.icon;
                    const isError = response.status === 'error';
                    const crisisData = response.crossAgentData as { priority?: string } | undefined;
                    const hasPriority = crisisData?.priority === 'high';

                    return (
                      <Card 
                        key={response.agent} 
                        className={`glass-card ${hasPriority ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-lg ${config.bgColor}`}>
                                <Icon className={`h-5 w-5 ${config.color}`} />
                              </div>
                              <CardTitle className="text-base">{config.name}</CardTitle>
                            </div>
                            <Badge 
                              variant={isError ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {isError ? 'Error' : `${(response.confidence * 100).toFixed(0)}%`}
                            </Badge>
                          </div>
                          {hasPriority && (
                            <div className="flex items-center gap-2 text-amber-600 text-xs mt-2">
                              <AlertTriangle className="h-4 w-4" />
                              High Priority Alert
                            </div>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Insights */}
                          {response.insights.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Insights</p>
                              <ul className="space-y-1">
                                {response.insights.map((insight, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <ArrowRight className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
                                    <span>{insight}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Recommendations */}
                          {response.recommendations.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                              <ul className="space-y-1">
                                {response.recommendations.map((rec, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <Lightbulb className="h-3 w-3 mt-1 shrink-0 text-amber-500" />
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Reasoning */}
                          {response.reasoning && (
                            <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-2 mt-2">
                              {response.reasoning}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Learning Tab */}
              <TabsContent value="learning" className="mt-4">
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Agent Learning Progress
                    </CardTitle>
                    <CardDescription>
                      Agents learn from your feedback to improve future recommendations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <p className="text-3xl font-bold text-primary">{result.learningStats?.totalOutcomes || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Feedback</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <p className="text-3xl font-bold text-emerald-500">{result.learningStats?.helpfulCount || 0}</p>
                        <p className="text-xs text-muted-foreground">Helpful Outcomes</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Learning by Agent</h4>
                      {(['mood_analyst', 'yoga_coach', 'crisis_detector'] as AgentType[]).map((agentId) => {
                        const config = agentConfig[agentId];
                        const Icon = config.icon;
                        const agentLearning = result.learningStats?.byAgent?.[agentId] || { total: 0, helpful: 0 };
                        const rate = agentLearning.total > 0 ? (agentLearning.helpful / agentLearning.total) * 100 : 0;

                        return (
                          <div key={agentId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                            <div className={`p-2 rounded-lg ${config.bgColor}`}>
                              <Icon className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{config.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {agentLearning.helpful}/{agentLearning.total} helpful
                                </span>
                              </div>
                              <Progress value={rate} className="h-2" />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {result.learningStats?.helpfulCount > 0 && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Agents are learning from {result.learningStats.helpfulCount} successful recommendations
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Communication Log Tab */}
              <TabsContent value="communication" className="mt-4">
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Agent Communication Log
                    </CardTitle>
                    <CardDescription>
                      Real-time messages between agents during collaboration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {result.communicationLog.map((msg, idx) => {
                          const fromConfig = agentConfig[msg.from];
                          const FromIcon = fromConfig.icon;

                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="flex gap-3 p-3 rounded-lg bg-muted/30"
                            >
                              <div className={`p-2 rounded-lg ${fromConfig.bgColor} h-fit`}>
                                <FromIcon className={`h-4 w-4 ${fromConfig.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{fromConfig.name}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    {msg.to === 'all' ? 'All Agents' : agentConfig[msg.to as AgentType].name}
                                  </span>
                                  <Badge variant="outline" className="text-xs ml-auto">
                                    {msg.type}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{msg.content}</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                  {new Date(msg.timestamp).toLocaleTimeString()} · {(msg.confidence * 100).toFixed(0)}% confidence
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Memory Tab */}
              <TabsContent value="memory" className="mt-4">
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Shared Memory Pool (Qdrant)
                    </CardTitle>
                    <CardDescription>
                      Agent memories stored in the shared Qdrant vector database
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {result.sharedMemories.length > 0 ? (
                          result.sharedMemories.map((memory, idx) => {
                            const config = agentConfig[memory.agent];
                            const Icon = config.icon;

                            return (
                              <motion.div
                                key={memory.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="p-4 rounded-lg border border-border/50 bg-muted/20"
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                                    <Icon className={`h-4 w-4 ${config.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sm">{config.name}</span>
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {memory.id.slice(0, 8)}...
                                      </Badge>
                                    </div>
                                    <p className="text-sm">{memory.insight}</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {new Date(memory.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })
                        ) : (
                          <p className="text-center text-muted-foreground py-8">
                            No shared memories yet. Run a collaboration to generate agent memories.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Qdrant Explanation */}
                <Card className="glass-card mt-4 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Database className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm mb-1">How Qdrant Powers Multi-Agent Memory</p>
                        <p className="text-xs text-muted-foreground">
                          Each agent stores its insights as vectors in the shared <code className="bg-muted px-1 rounded">agent_memories</code> collection. 
                          When collaborating, agents query this pool to access insights from other agents, enabling cross-agent learning and consensus building.
                          The <code className="bg-muted px-1 rounded">created_by_agent</code> filter allows selective retrieval of specific agent memories.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initial State */}
      {!result && !loading && (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Ready for Collaboration</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Enter a wellness query above to have the MoodAnalyst, YogaCoach, and CrisisDetector 
              work together using their shared Qdrant memory pool.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
