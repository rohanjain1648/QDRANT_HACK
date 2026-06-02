import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Brain, Database, ChevronRight, ExternalLink, 
  CheckCircle2, AlertCircle, Loader2, Sparkles, FileText,
  Activity, Heart, Lightbulb, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface EvidencePoint {
  id: string;
  collection: string;
  score: number;
  payload: Record<string, unknown>;
  relevanceExplanation?: string;
}

interface ReasoningStep {
  step: number;
  action: string;
  collection?: string;
  query?: string;
  resultsCount?: number;
  topScore?: number;
}

interface EvidenceTrail {
  query: string;
  evidencePoints: EvidencePoint[];
  reasoningSteps: ReasoningStep[];
  finalOutput: string;
  confidence: number;
  groundedIn: string[];
}

const collectionIcons: Record<string, typeof Heart> = {
  mood_memories: Heart,
  therapy_sessions: Activity,
  user_insights: Lightbulb,
  wellness_activities: Sparkles,
};

const collectionColors: Record<string, string> = {
  mood_memories: 'bg-rose-500',
  therapy_sessions: 'bg-emerald-500',
  user_insights: 'bg-amber-500',
  wellness_activities: 'bg-sky-500',
};

export function EvidenceTrail() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [trail, setTrail] = useState<EvidenceTrail | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const searchWithEvidence = useCallback(async () => {
    if (!user || !query.trim()) return;

    setLoading(true);
    setTrail(null);

    try {
      const { data, error } = await supabase.functions.invoke('evidence-trail', {
        body: {
          operation: 'search_with_trail',
          query: query.trim(),
          userId: user.id,
          responseType: 'insight',
        },
      });

      if (error) throw error;
      setTrail(data.data);
    } catch (e) {
      console.error('Evidence trail error:', e);
      toast.error('Failed to search memories');
    } finally {
      setLoading(false);
    }
  }, [user, query]);

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'generate_embedding': return 'Creating semantic query';
      case 'search_collection': return 'Searching memories';
      case 'generate_grounded_response': return 'Generating grounded response';
      default: return action;
    }
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          Sign in to explore your memory evidence trails
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Evidence Trail Explorer</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          See exactly which memories influence AI responses — full transparency into Qdrant retrieval
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ask about your wellness patterns, mood history, or activities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchWithEvidence()}
              className="pl-10"
            />
          </div>
          <Button onClick={searchWithEvidence} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Example Queries */}
        {!trail && !loading && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Try:</span>
            {[
              'What helps when I feel anxious?',
              'How has my mood improved?',
              'Best activities for stress relief',
            ].map((example) => (
              <button
                key={example}
                onClick={() => {
                  setQuery(example);
                  setTimeout(searchWithEvidence, 100);
                }}
                className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              Searching across all memory collections...
            </p>
          </div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {trail && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Confidence Score */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Response Confidence</span>
                  <span className="text-sm font-bold text-primary">
                    {(trail.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={trail.confidence * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Based on {trail.evidencePoints.length} retrieved memories, {trail.groundedIn.length} directly cited
                </p>
              </div>

              {/* AI Response */}
              <div className="p-4 rounded-lg bg-background border">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">AI-Generated Insight</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {trail.finalOutput}
                    </p>
                  </div>
                </div>
              </div>

              {/* Evidence Points */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">Retrieved Evidence</h3>
                  <Badge variant="outline">{trail.evidencePoints.length} memories</Badge>
                </div>

                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {trail.evidencePoints.map((evidence, index) => {
                      const Icon = collectionIcons[evidence.collection] || FileText;
                      const colorClass = collectionColors[evidence.collection] || 'bg-muted';
                      const isCited = trail.groundedIn.includes(evidence.id);

                      return (
                        <Collapsible
                          key={evidence.id}
                          open={expandedEvidence === evidence.id}
                          onOpenChange={(open) => setExpandedEvidence(open ? evidence.id : null)}
                        >
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`rounded-lg border ${isCited ? 'border-primary/50 bg-primary/5' : 'bg-background'}`}
                          >
                            <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 text-left">
                              <div className={`p-1.5 rounded ${colorClass}`}>
                                <Icon className="h-3.5 w-3.5 text-white" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium capitalize">
                                    {evidence.collection.replace('_', ' ')}
                                  </span>
                                  {isCited && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {evidence.relevanceExplanation || `Relevance: ${(evidence.score * 100).toFixed(0)}%`}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={evidence.score > 0.7 ? 'default' : evidence.score > 0.5 ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  {(evidence.score * 100).toFixed(0)}%
                                </Badge>
                                <ChevronRight className={`h-4 w-4 transition-transform ${expandedEvidence === evidence.id ? 'rotate-90' : ''}`} />
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="px-3 pb-3 pt-0">
                                <div className="p-3 rounded bg-muted/50 text-xs">
                                  <pre className="whitespace-pre-wrap overflow-x-auto">
                                    {JSON.stringify(evidence.payload, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </motion.div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Reasoning Steps */}
              <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      View Reasoning Steps ({trail.reasoningSteps.length})
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${showReasoning ? 'rotate-90' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-2">
                    {trail.reasoningSteps.map((step, index) => (
                      <motion.div
                        key={step.step}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{getActionLabel(step.action)}</p>
                          {step.collection && (
                            <p className="text-xs text-muted-foreground">
                              Collection: {step.collection}
                            </p>
                          )}
                          {step.resultsCount !== undefined && (
                            <p className="text-xs text-muted-foreground">
                              Found: {step.resultsCount} results
                              {step.topScore && ` (top: ${(step.topScore * 100).toFixed(0)}%)`}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Clear Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTrail(null);
                  setQuery('');
                }}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Clear & Start New Search
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
