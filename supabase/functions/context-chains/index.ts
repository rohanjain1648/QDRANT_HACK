import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface ChainNode {
  id: string;
  collection: string;
  content: string;
  timestamp: string;
  type: 'mood' | 'voice' | 'session' | 'insight' | 'activity';
  metadata: Record<string, unknown>;
  connections: Array<{
    targetId: string;
    targetCollection: string;
    relationshipType: 'causes' | 'follows' | 'similar_to' | 'contradicts' | 'reinforces';
    strength: number;
  }>;
}

interface ContextChain {
  id: string;
  rootNode: ChainNode;
  nodes: ChainNode[];
  chainType: 'temporal' | 'causal' | 'thematic';
  summary: string;
  createdAt: string;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchQdrant(
  collection: string,
  vector: number[],
  userId: string,
  limit: number = 10,
  scoreThreshold: number = 0.7
): Promise<any[]> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: 'POST',
    headers: {
      'api-key': QDRANT_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vector,
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
      },
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.result || [];
}

async function getPointById(collection: string, pointId: string): Promise<any | null> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/${pointId}`, {
    method: 'GET',
    headers: {
      'api-key': QDRANT_API_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.result;
}

async function updatePointPayload(
  collection: string,
  pointId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/payload`, {
    method: 'POST',
    headers: {
      'api-key': QDRANT_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      points: [pointId],
      payload,
    }),
  });

  return response.ok;
}

async function scrollCollection(collection: string, userId: string, limit: number = 50): Promise<any[]> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/scroll`, {
    method: 'POST',
    headers: {
      'api-key': QDRANT_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit,
      with_payload: true,
      with_vector: true,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
      },
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.result?.points || [];
}

function determineRelationship(
  sourcePayload: any,
  targetPayload: any,
  similarity: number
): { type: 'causes' | 'follows' | 'similar_to' | 'contradicts' | 'reinforces'; strength: number } {
  const sourceTime = new Date(sourcePayload?.created_at || 0).getTime();
  const targetTime = new Date(targetPayload?.created_at || 0).getTime();
  const timeDiff = Math.abs(targetTime - sourceTime);
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  // Check for temporal sequence (within 24 hours)
  if (hoursDiff < 24 && sourceTime < targetTime) {
    // Check mood changes for causal relationships
    const sourceMood = sourcePayload?.mood_score || sourcePayload?.emotion_analysis?.sentiment_score * 5;
    const targetMood = targetPayload?.mood_score || targetPayload?.emotion_analysis?.sentiment_score * 5;
    
    if (sourceMood && targetMood) {
      const moodChange = targetMood - sourceMood;
      if (Math.abs(moodChange) > 2) {
        return { type: 'causes', strength: Math.min(0.9, similarity + 0.1) };
      }
    }
    return { type: 'follows', strength: similarity };
  }

  // Check for contradictions (similar topic, opposite sentiment)
  const sourceSentiment = sourcePayload?.emotion_analysis?.sentiment || sourcePayload?.mood_level;
  const targetSentiment = targetPayload?.emotion_analysis?.sentiment || targetPayload?.mood_level;
  
  if (similarity > 0.8) {
    const positiveStates = ['good', 'great', 'positive', 'happy', 'joy'];
    const negativeStates = ['low', 'very_low', 'negative', 'sad', 'anger'];
    
    const sourcePositive = positiveStates.some(s => sourceSentiment?.toLowerCase()?.includes(s));
    const sourceNegative = negativeStates.some(s => sourceSentiment?.toLowerCase()?.includes(s));
    const targetPositive = positiveStates.some(s => targetSentiment?.toLowerCase()?.includes(s));
    const targetNegative = negativeStates.some(s => targetSentiment?.toLowerCase()?.includes(s));

    if ((sourcePositive && targetNegative) || (sourceNegative && targetPositive)) {
      return { type: 'contradicts', strength: similarity };
    }
  }

  // Check for reinforcement (similar sentiment and content)
  if (similarity > 0.85 && sourceSentiment === targetSentiment) {
    return { type: 'reinforces', strength: similarity };
  }

  return { type: 'similar_to', strength: similarity };
}

function extractNodeContent(payload: any): string {
  return payload?.journal_text || 
         payload?.transcription || 
         payload?.insight_text ||
         payload?.activity_name ||
         payload?.notes ||
         'Unknown content';
}

function determineNodeType(collection: string, payload: any): ChainNode['type'] {
  if (collection === 'voice_memories') return 'voice';
  if (collection === 'mood_memories') return 'mood';
  if (collection === 'therapy_sessions') return 'session';
  if (collection === 'user_insights') return 'insight';
  if (collection === 'wellness_activities') return 'activity';
  return 'mood';
}

async function buildContextChain(
  userId: string,
  startPointId: string,
  startCollection: string,
  maxDepth: number = 3
): Promise<ContextChain | null> {
  const visited = new Set<string>();
  const nodes: ChainNode[] = [];
  const collections = ['mood_memories', 'voice_memories', 'therapy_sessions', 'user_insights'];

  async function traverseNode(pointId: string, collection: string, depth: number): Promise<ChainNode | null> {
    if (depth > maxDepth || visited.has(`${collection}:${pointId}`)) {
      return null;
    }

    visited.add(`${collection}:${pointId}`);

    const point = await getPointById(collection, pointId);
    if (!point) return null;

    const payload = point.payload || {};
    const vector = point.vector;

    const connections: ChainNode['connections'] = [];

    // Search for related points across collections
    if (vector && depth < maxDepth) {
      for (const targetCollection of collections) {
        const relatedPoints = await searchQdrant(targetCollection, vector, userId, 5, 0.75);
        
        for (const related of relatedPoints) {
          if (related.id === pointId && targetCollection === collection) continue;
          if (visited.has(`${targetCollection}:${related.id}`)) continue;

          const relationship = determineRelationship(payload, related.payload, related.score);
          
          connections.push({
            targetId: String(related.id),
            targetCollection,
            relationshipType: relationship.type,
            strength: relationship.strength,
          });

          // Store the connection in Qdrant payload for future traversal
          const existingConnections = payload.context_chain_connections || [];
          if (!existingConnections.some((c: any) => c.targetId === related.id)) {
            await updatePointPayload(collection, pointId, {
              context_chain_connections: [
                ...existingConnections,
                {
                  targetId: String(related.id),
                  targetCollection,
                  relationshipType: relationship.type,
                  strength: relationship.strength,
                  linkedAt: new Date().toISOString(),
                },
              ],
            });
          }
        }
      }
    }

    const node: ChainNode = {
      id: String(pointId),
      collection,
      content: extractNodeContent(payload),
      timestamp: payload.created_at || new Date().toISOString(),
      type: determineNodeType(collection, payload),
      metadata: {
        mood_level: payload.mood_level,
        mood_score: payload.mood_score,
        emotion: payload.emotion_analysis?.dominant_emotion,
        tags: payload.tags,
        activity_type: payload.activity_type || payload.session_type,
      },
      connections,
    };

    nodes.push(node);

    // Recursively traverse connected nodes
    for (const conn of connections.slice(0, 2)) {
      await traverseNode(conn.targetId, conn.targetCollection, depth + 1);
    }

    return node;
  }

  const rootNode = await traverseNode(startPointId, startCollection, 0);
  if (!rootNode) return null;

  // Determine chain type based on relationships
  const relationships = nodes.flatMap(n => n.connections.map(c => c.relationshipType));
  const chainType: ContextChain['chainType'] = 
    relationships.filter(r => r === 'causes' || r === 'follows').length > relationships.length / 2
      ? 'temporal'
      : relationships.filter(r => r === 'reinforces' || r === 'contradicts').length > relationships.length / 2
        ? 'causal'
        : 'thematic';

  // Generate summary
  const summary = `Chain of ${nodes.length} connected memories spanning ${
    nodes.map(n => n.type).filter((v, i, a) => a.indexOf(v) === i).join(', ')
  } entries`;

  return {
    id: `chain_${Date.now()}`,
    rootNode,
    nodes,
    chainType,
    summary,
    createdAt: new Date().toISOString(),
  };
}

async function discoverChains(userId: string): Promise<ContextChain[]> {
  const chains: ContextChain[] = [];
  const collections = ['mood_memories', 'voice_memories'];

  for (const collection of collections) {
    const points = await scrollCollection(collection, userId, 10);
    
    // Build chains from recent points
    for (const point of points.slice(0, 3)) {
      const chain = await buildContextChain(userId, String(point.id), collection, 2);
      if (chain && chain.nodes.length > 1) {
        chains.push(chain);
      }
    }
  }

  // Deduplicate chains by overlapping nodes
  const uniqueChains: ContextChain[] = [];
  for (const chain of chains) {
    const nodeIds = new Set(chain.nodes.map(n => `${n.collection}:${n.id}`));
    const isOverlapping = uniqueChains.some(existing => {
      const existingIds = new Set(existing.nodes.map(n => `${n.collection}:${n.id}`));
      const overlap = [...nodeIds].filter(id => existingIds.has(id)).length;
      return overlap > Math.min(nodeIds.size, existingIds.size) * 0.5;
    });
    
    if (!isOverlapping) {
      uniqueChains.push(chain);
    }
  }

  return uniqueChains;
}

async function traverseFromNode(
  userId: string,
  pointId: string,
  collection: string,
  direction: 'forward' | 'backward' | 'both'
): Promise<ChainNode[]> {
  const point = await getPointById(collection, pointId);
  if (!point) return [];

  const payload = point.payload || {};
  const connections = payload.context_chain_connections || [];
  const nodes: ChainNode[] = [];

  // Get connected nodes based on direction
  for (const conn of connections) {
    if (direction === 'forward' && (conn.relationshipType === 'causes' || conn.relationshipType === 'follows')) {
      const connectedPoint = await getPointById(conn.targetCollection, conn.targetId);
      if (connectedPoint) {
        nodes.push({
          id: conn.targetId,
          collection: conn.targetCollection,
          content: extractNodeContent(connectedPoint.payload),
          timestamp: connectedPoint.payload?.created_at || new Date().toISOString(),
          type: determineNodeType(conn.targetCollection, connectedPoint.payload),
          metadata: connectedPoint.payload || {},
          connections: [],
        });
      }
    } else if (direction === 'backward' || direction === 'both') {
      const connectedPoint = await getPointById(conn.targetCollection, conn.targetId);
      if (connectedPoint) {
        nodes.push({
          id: conn.targetId,
          collection: conn.targetCollection,
          content: extractNodeContent(connectedPoint.payload),
          timestamp: connectedPoint.payload?.created_at || new Date().toISOString(),
          type: determineNodeType(conn.targetCollection, connectedPoint.payload),
          metadata: connectedPoint.payload || {},
          connections: [],
        });
      }
    }
  }

  return nodes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId, pointId, collection, direction } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any;

    switch (action) {
      case 'discover':
        result = await discoverChains(userId);
        break;

      case 'build':
        if (!pointId || !collection) {
          return new Response(
            JSON.stringify({ error: 'pointId and collection required for build action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await buildContextChain(userId, pointId, collection);
        break;

      case 'traverse':
        if (!pointId || !collection) {
          return new Response(
            JSON.stringify({ error: 'pointId and collection required for traverse action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await traverseFromNode(userId, pointId, collection, direction || 'both');
        break;

      default:
        result = await discoverChains(userId);
    }

    console.log(`Context chains ${action || 'discover'} completed for user:`, userId);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Context chains error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
