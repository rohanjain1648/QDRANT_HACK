import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  RefreshCw,
  ChevronRight,
  Heart,
  Mic,
  Activity,
  Lightbulb,
  Brain,
  ArrowRight,
  GitBranch,
  Clock,
  Zap,
  Link2,
  MoreHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ChainConnection {
  targetId: string;
  targetCollection: string;
  relationshipType: 'causes' | 'follows' | 'similar_to' | 'contradicts' | 'reinforces';
  strength: number;
}

interface ChainNode {
  id: string;
  collection: string;
  content: string;
  timestamp: string;
  type: 'mood' | 'voice' | 'session' | 'insight' | 'activity';
  metadata: Record<string, unknown>;
  connections: ChainConnection[];
}

interface ContextChain {
  id: string;
  rootNode: ChainNode;
  nodes: ChainNode[];
  chainType: 'temporal' | 'causal' | 'thematic';
  summary: string;
  createdAt: string;
}

const nodeTypeIcons = {
  mood: Heart,
  voice: Mic,
  session: Activity,
  insight: Lightbulb,
  activity: Brain,
};

const nodeTypeColors = {
  mood: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  voice: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  session: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  insight: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  activity: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const relationshipColors = {
  causes: 'text-red-400',
  follows: 'text-blue-400',
  similar_to: 'text-purple-400',
  contradicts: 'text-orange-400',
  reinforces: 'text-green-400',
};

const chainTypeIcons = {
  temporal: Clock,
  causal: Zap,
  thematic: GitBranch,
};

export function ContextChains() {
  const { user } = useAuth();
  const [chains, setChains] = useState<ContextChain[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ContextChain | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const discoverChains = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('context-chains', {
        body: { action: 'discover', userId: user.id },
      });

      if (error) throw error;
      setChains(data.data || []);
      if (data.data?.length > 0) {
        setSelectedChain(data.data[0]);
      }
    } catch (error) {
      console.error('Failed to discover chains:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    discoverChains();
  }, [discoverChains]);

  const traverseNode = async (node: ChainNode, direction: 'forward' | 'backward' | 'both') => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('context-chains', {
        body: {
          action: 'traverse',
          userId: user.id,
          pointId: node.id,
          collection: node.collection,
          direction,
        },
      });

      if (error) throw error;
      console.log('Traversed nodes:', data.data);
    } catch (error) {
      console.error('Traverse error:', error);
    }
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Sign in to view context chains</p>
        </CardContent>
      </Card>
    );
  }

  const renderNode = (node: ChainNode, isRoot: boolean = false) => {
    const NodeIcon = nodeTypeIcons[node.type];
    const isExpanded = expandedNode === node.id;

    return (
      <motion.div
        key={node.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative ${isRoot ? '' : 'ml-8'}`}
      >
        {!isRoot && (
          <div className="absolute left-[-24px] top-6 w-6 h-px bg-border" />
        )}
        
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            isExpanded ? 'ring-2 ring-primary' : ''
          } ${nodeTypeColors[node.type]}`}
          onClick={() => setExpandedNode(isExpanded ? null : node.id)}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-background/50`}>
              <NodeIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {node.type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(node.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm line-clamp-2">{node.content}</p>
              
              {/* Connections indicator */}
              {node.connections.length > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Link2 className="w-3 h-3" />
                  <span>{node.connections.length} connections</span>
                </div>
              )}
            </div>
          </div>

          {/* Expanded view with connections */}
          <AnimatePresence>
            {isExpanded && node.connections.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t border-border/50"
              >
                <h5 className="text-xs font-medium mb-2">Connections</h5>
                <div className="space-y-1">
                  {node.connections.slice(0, 5).map((conn, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs p-2 rounded bg-background/30"
                    >
                      <ArrowRight className={`w-3 h-3 ${relationshipColors[conn.relationshipType]}`} />
                      <span className="capitalize">{conn.relationshipType.replace('_', ' ')}</span>
                      <span className="text-muted-foreground">→ {conn.targetCollection}</span>
                      <span className="ml-auto font-mono text-muted-foreground">
                        {(conn.strength * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      traverseNode(node, 'forward');
                    }}
                    className="text-xs"
                  >
                    <ChevronRight className="w-3 h-3 mr-1" />
                    Forward
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      traverseNode(node, 'backward');
                    }}
                    className="text-xs"
                  >
                    <ChevronRight className="w-3 h-3 mr-1 rotate-180" />
                    Backward
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Network className="w-5 h-5 text-primary" />
            Context Chains
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={discoverChains}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Discovering...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && chains.length === 0 ? (
          <div className="py-8 text-center">
            <Network className="w-8 h-8 mx-auto mb-3 animate-pulse text-primary" />
            <p className="text-muted-foreground">Discovering memory chains...</p>
          </div>
        ) : chains.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <GitBranch className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>No context chains discovered yet</p>
            <p className="text-xs mt-1">Log more moods and activities to build connections</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-[240px,1fr] gap-4">
            {/* Chain selector */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Discovered Chains ({chains.length})
              </h4>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-2">
                  {chains.map((chain) => {
                    const ChainIcon = chainTypeIcons[chain.chainType];
                    const isSelected = selectedChain?.id === chain.id;

                    return (
                      <motion.div
                        key={chain.id}
                        whileHover={{ scale: 1.02 }}
                        className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedChain(chain)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <ChainIcon className="w-4 h-4 text-primary" />
                          <Badge variant="outline" className="text-xs capitalize">
                            {chain.chainType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {chain.summary}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{chain.nodes.length} nodes</span>
                          <MoreHorizontal className="w-3 h-3" />
                          <span>
                            {new Date(chain.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Chain visualization */}
            <div className="border-l border-border/50 pl-4">
              {selectedChain ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium capitalize">
                        {selectedChain.chainType} Chain
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedChain.summary}
                      </p>
                    </div>
                  </div>

                  {/* Node tree */}
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-3 pr-4">
                      {renderNode(selectedChain.rootNode, true)}
                      {selectedChain.nodes
                        .filter(n => n.id !== selectedChain.rootNode.id)
                        .slice(0, 5)
                        .map(node => renderNode(node))}
                      {selectedChain.nodes.length > 6 && (
                        <div className="ml-8 p-2 text-xs text-muted-foreground">
                          +{selectedChain.nodes.length - 6} more nodes...
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>Select a chain to explore</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Qdrant info */}
        <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <span className="text-muted-foreground">
              <span className="text-indigo-400 font-medium">Qdrant Payload References</span>
              {' '}enable graph-like traversal between semantically linked memories
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
