import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Zap, GitMerge, Check, Scale, ArrowLeftRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface InsightRef {
  id: string;
  text: string;
  type: string;
  confidence: number;
}

interface Contradiction {
  insight1: InsightRef;
  insight2: InsightRef;
  contradictionScore: number;
  explanation: string;
  resolution: string;
}

type ResolutionType = 'keep_both' | 'keep_first' | 'keep_second' | 'merge';

export function ContradictionDetection() {
  const { user } = useAuth();
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [selectedContradiction, setSelectedContradiction] = useState<Contradiction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const detectContradictions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('contradiction-detection', {
        body: { operation: 'detect', userId: user.id },
      });

      if (error) throw error;

      setContradictions(data.data || []);
      
      if (data.data?.length === 0) {
        toast.success('No contradictions detected in your insights');
      } else {
        toast.info(`Found ${data.data.length} potential contradiction(s)`);
      }
    } catch (e) {
      console.error('Error detecting contradictions:', e);
      toast.error('Failed to detect contradictions');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleResolve = async (
    contradiction: Contradiction,
    resolution: ResolutionType
  ) => {
    if (!user) return;

    const key = `${contradiction.insight1.id}-${contradiction.insight2.id}`;
    setResolving(key);
    setDialogOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke('contradiction-detection', {
        body: {
          operation: 'resolve',
          userId: user.id,
          insight1Id: contradiction.insight1.id,
          insight2Id: contradiction.insight2.id,
          resolution,
        },
      });

      if (error) throw error;

      toast.success(data.data.message);
      
      // Remove resolved contradiction from list
      setContradictions(prev => 
        prev.filter(c => 
          !(c.insight1.id === contradiction.insight1.id && 
            c.insight2.id === contradiction.insight2.id)
        )
      );
    } catch (e) {
      console.error('Error resolving contradiction:', e);
      toast.error('Failed to resolve contradiction');
    } finally {
      setResolving(null);
      setSelectedContradiction(null);
    }
  };

  const openResolutionDialog = (contradiction: Contradiction) => {
    setSelectedContradiction(contradiction);
    setDialogOpen(true);
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          Sign in to detect contradictions in your insights
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Contradiction Detection</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={detectContradictions}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Scan for Contradictions
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Explanation */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">
                  Negative Similarity Search
                </p>
                <p className="text-muted-foreground">
                  Uses Qdrant vector search with inverted embeddings to find insights 
                  that are semantically opposite. AI then validates if they truly contradict.
                </p>
              </div>
            </div>
          </div>

          {/* Contradictions List */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {contradictions.map((contradiction, index) => {
                const key = `${contradiction.insight1.id}-${contradiction.insight2.id}`;
                const isResolving = resolving === key;

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-lg border border-amber-500/30 bg-background/50"
                  >
                    {/* Contradiction Score */}
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {(contradiction.contradictionScore * 100).toFixed(0)}% Confidence
                      </Badge>
                      <Progress 
                        value={contradiction.contradictionScore * 100} 
                        className="w-24 h-2"
                      />
                    </div>

                    {/* Two Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {contradiction.insight1.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(contradiction.insight1.confidence * 100).toFixed(0)}% conf
                          </span>
                        </div>
                        <p className="text-sm text-foreground line-clamp-3">
                          "{contradiction.insight1.text}"
                        </p>
                      </div>

                      <div className="relative">
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 hidden md:block">
                          <ArrowLeftRight className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {contradiction.insight2.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {(contradiction.insight2.confidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                          <p className="text-sm text-foreground line-clamp-3">
                            "{contradiction.insight2.text}"
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="mb-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Analysis: </span>
                        {contradiction.explanation}
                      </p>
                    </div>

                    {/* Suggested Resolution */}
                    <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm">
                        <span className="font-medium text-primary">Suggested Resolution: </span>
                        <span className="text-muted-foreground">{contradiction.resolution}</span>
                      </p>
                    </div>

                    {/* Resolution Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openResolutionDialog(contradiction)}
                        disabled={isResolving}
                      >
                        {isResolving ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <GitMerge className="h-4 w-4 mr-1" />
                        )}
                        Resolve
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {contradictions.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Click "Scan for Contradictions" to analyze your insights</p>
                <p className="text-sm mt-1">
                  Uses negative similarity search in Qdrant to find opposing patterns
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analyzing insights with negative similarity search...
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve Contradiction</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how to handle this contradiction between your insights.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedContradiction && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs font-medium mb-1 text-red-600">Insight 1</p>
                  <p className="text-sm line-clamp-2">{selectedContradiction.insight1.text}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs font-medium mb-1 text-blue-600">Insight 2</p>
                  <p className="text-sm line-clamp-2">{selectedContradiction.insight2.text}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleResolve(selectedContradiction, 'keep_both')}
                >
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Keep Both - They may both be valid in different contexts
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleResolve(selectedContradiction, 'keep_first')}
                >
                  <Check className="h-4 w-4 mr-2 text-red-500" />
                  Keep Insight 1 - Demote Insight 2
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleResolve(selectedContradiction, 'keep_second')}
                >
                  <Check className="h-4 w-4 mr-2 text-blue-500" />
                  Keep Insight 2 - Demote Insight 1
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleResolve(selectedContradiction, 'merge')}
                >
                  <GitMerge className="h-4 w-4 mr-2 text-primary" />
                  Merge - Create a nuanced insight from both
                </Button>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
