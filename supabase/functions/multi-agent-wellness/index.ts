import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

// Agent types and their expertise areas
type AgentType = 'mood_analyst' | 'yoga_coach' | 'crisis_detector' | 'orchestrator';

// Agent expertise definitions for semantic routing
const AGENT_EXPERTISE: Record<Exclude<AgentType, 'orchestrator'>, {
  keywords: string[];
  description: string;
  priority: number;
  activationThreshold: number;
}> = {
  mood_analyst: {
    keywords: [
      'mood', 'emotion', 'feeling', 'sad', 'happy', 'anxious', 'stressed', 'depressed',
      'mental health', 'emotional', 'psychology', 'mindset', 'thought patterns',
      'worry', 'fear', 'joy', 'anger', 'frustration', 'motivation', 'mindfulness',
      'cognitive', 'emotional regulation', 'mood tracking', 'how am i feeling'
    ],
    description: 'Expert in emotional patterns, mood dynamics, psychological well-being, and mental health analysis',
    priority: 1,
    activationThreshold: 0.35,
  },
  yoga_coach: {
    keywords: [
      'yoga', 'exercise', 'stretch', 'pose', 'breathing', 'workout', 'physical',
      'body', 'flexibility', 'strength', 'meditation', 'relaxation', 'energy',
      'fitness', 'movement', 'posture', 'wellness activity', 'asana', 'pranayama',
      'sleep', 'rest', 'tension', 'muscle', 'back pain', 'neck pain'
    ],
    description: 'Expert in physical wellness, yoga practices, breathing exercises, and body-mind connection',
    priority: 2,
    activationThreshold: 0.35,
  },
  crisis_detector: {
    keywords: [
      'crisis', 'emergency', 'urgent', 'suicide', 'self-harm', 'danger', 'risk',
      'help me', 'hopeless', 'worthless', 'give up', 'end it', 'no point',
      'overwhelmed', 'desperate', 'alone', 'isolated', 'cant cope', 'breaking down',
      'panic', 'severe anxiety', 'trauma', 'abuse', 'safety'
    ],
    description: 'Expert in crisis detection, safety monitoring, and identifying concerning emotional patterns',
    priority: 0, // Highest priority - always runs for safety
    activationThreshold: 0.25, // Lower threshold for safety
  },
};

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

interface AgentMessage {
  from: AgentType;
  to: AgentType | 'all';
  type: 'query' | 'insight' | 'alert' | 'recommendation' | 'routing';
  content: string;
  data?: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

interface AgentMemory {
  id: string;
  agent: AgentType;
  insight: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AgentResponse {
  agent: AgentType;
  status: 'success' | 'error' | 'skipped';
  insights: string[];
  recommendations: string[];
  crossAgentData?: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  pastSuccesses?: PastSuccess[];
  wasActivated: boolean;
}

interface PastSuccess {
  recommendation: string;
  effectiveness: number;
  context: string;
  created_at: string;
}

interface OutcomeRecord {
  recommendation_id: string;
  recommendation: string;
  agent_id: AgentType;
  outcome: 'helpful' | 'not_helpful' | 'neutral';
  user_feedback?: string;
  effectiveness_score: number;
  context_summary: string;
  query: string;
}

// Consensus voting types
interface AgentVote {
  agent: Exclude<AgentType, 'orchestrator'>;
  recommendation: string;
  vote: 'agree' | 'disagree' | 'abstain';
  confidence: number;
  reasoning: string;
}

// VoteRecord and AgentVotingHistory are used internally in Qdrant storage

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

interface CollaborativeResult {
  orchestratorSummary: string;
  agentResponses: AgentResponse[];
  sharedMemories: AgentMemory[];
  consensusRecommendations: ConsensusRecommendation[];
  communicationLog: AgentMessage[];
  learningStats: LearningStats;
  routingDecision: RoutingDecision;
  votingStats: {
    totalVotesCast: number;
    consensusRate: number;
    agentWeights: Record<Exclude<AgentType, 'orchestrator'>, number>;
  };
}

interface LearningStats {
  totalOutcomes: number;
  helpfulCount: number;
  byAgent: Record<AgentType, { total: number; helpful: number }>;
}

// Qdrant operations
async function qdrantRequest(path: string, method: string, body?: unknown) {
  if (!QDRANT_URL || !QDRANT_API_KEY) {
    throw new Error('Qdrant configuration missing');
  }

  const response = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Qdrant error:', response.status, errorText);
    throw new Error(`Qdrant request failed: ${response.status}`);
  }

  return response.json();
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
    throw new Error(`Embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Ensure expertise embeddings collection exists
async function ensureExpertiseCollection() {
  try {
    await qdrantRequest('/collections/agent_expertise', 'GET');
  } catch {
    console.log('Creating agent_expertise collection');
    await qdrantRequest('/collections/agent_expertise', 'PUT', {
      vectors: { size: 1536, distance: 'Cosine' },
    });
  }
}

// Store or update agent expertise embeddings
async function storeAgentExpertise(agent: Exclude<AgentType, 'orchestrator'>) {
  const expertise = AGENT_EXPERTISE[agent];
  const expertiseText = `${expertise.description} Keywords: ${expertise.keywords.join(', ')}`;
  const embedding = await generateEmbedding(expertiseText);
  
  // Use a deterministic ID based on agent name
  const pointId = agent;
  
  await qdrantRequest('/collections/agent_expertise/points', 'PUT', {
    points: [{
      id: pointId,
      vector: embedding,
      payload: {
        agent,
        description: expertise.description,
        keywords: expertise.keywords,
        priority: expertise.priority,
        activationThreshold: expertise.activationThreshold,
        updated_at: new Date().toISOString(),
      },
    }],
  });
  
  return pointId;
}

// Semantic RAG Router: Route query to best-suited agents
async function routeQuery(
  query: string,
  queryVector: number[]
): Promise<RoutingDecision> {
  console.log('RAG Router: Analyzing query for agent routing');
  
  await ensureExpertiseCollection();
  
  // Initialize or update expertise embeddings if needed
  const agents: Exclude<AgentType, 'orchestrator'>[] = ['mood_analyst', 'yoga_coach', 'crisis_detector'];
  
  // Check if expertise embeddings exist
  let expertisePoints: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];
  try {
    const result = await qdrantRequest('/collections/agent_expertise/points/scroll', 'POST', {
      limit: 10,
      with_vector: true,
      with_payload: true,
    });
    expertisePoints = result.result?.points || [];
  } catch (e) {
    console.log('Expertise points not found, will create them');
  }
  
  // Store expertise if not found
  if (expertisePoints.length < 3) {
    console.log('Storing agent expertise embeddings');
    for (const agent of agents) {
      await storeAgentExpertise(agent);
    }
    // Fetch again
    const result = await qdrantRequest('/collections/agent_expertise/points/scroll', 'POST', {
      limit: 10,
      with_vector: true,
      with_payload: true,
    });
    expertisePoints = result.result?.points || [];
  }
  
  // Calculate routing scores using embedding similarity
  const routingScores: AgentRoutingScore[] = [];
  const queryLower = query.toLowerCase();
  
  for (const agent of agents) {
    const expertise = AGENT_EXPERTISE[agent];
    const expertisePoint = expertisePoints.find(p => p.id === agent || p.payload?.agent === agent);
    
    // Calculate semantic similarity
    let similarityScore = 0;
    if (expertisePoint && expertisePoint.vector) {
      similarityScore = cosineSimilarity(queryVector, expertisePoint.vector);
    }
    
    // Also check keyword matches for hybrid scoring
    const keywordMatches = expertise.keywords.filter(kw => 
      queryLower.includes(kw.toLowerCase())
    );
    
    // Boost score if keywords match
    const keywordBoost = keywordMatches.length > 0 ? 0.15 * Math.min(keywordMatches.length, 3) : 0;
    const finalScore = similarityScore + keywordBoost;
    
    const shouldActivate = finalScore >= expertise.activationThreshold;
    
    let reason = '';
    if (shouldActivate) {
      reason = `Activated: similarity=${(similarityScore * 100).toFixed(1)}%`;
      if (keywordMatches.length > 0) {
        reason += `, keywords matched: ${keywordMatches.slice(0, 3).join(', ')}`;
      }
    } else {
      reason = `Below threshold (${(expertise.activationThreshold * 100).toFixed(0)}%): score=${(finalScore * 100).toFixed(1)}%`;
    }
    
    routingScores.push({
      agent,
      similarityScore: finalScore,
      keywordMatches,
      shouldActivate,
      reason,
    });
  }
  
  // Sort by similarity score
  routingScores.sort((a, b) => b.similarityScore - a.similarityScore);
  
  // Crisis detector always runs for safety (priority 0)
  const crisisScore = routingScores.find(s => s.agent === 'crisis_detector')!;
  const hasCrisisKeywords = crisisScore.keywordMatches.length > 0;
  const crisisOverride = hasCrisisKeywords || crisisScore.similarityScore > 0.3;
  
  if (crisisOverride && !crisisScore.shouldActivate) {
    crisisScore.shouldActivate = true;
    crisisScore.reason = 'Safety override: Crisis detector always active when risk indicators present';
  }
  
  // Determine activated agents
  const activatedAgents = routingScores
    .filter(s => s.shouldActivate)
    .map(s => s.agent);
  
  // Ensure at least one agent is activated
  if (activatedAgents.length === 0) {
    // Activate the top scoring agent
    routingScores[0].shouldActivate = true;
    routingScores[0].reason = 'Default activation: Highest semantic match';
    activatedAgents.push(routingScores[0].agent);
  }
  
  // Ensure crisis detector is included if override is active
  if (crisisOverride && !activatedAgents.includes('crisis_detector')) {
    activatedAgents.push('crisis_detector');
  }
  
  const primaryAgent = routingScores[0].agent;
  
  const routingReason = `Query routed to ${activatedAgents.length} agent(s). ` +
    `Primary: ${primaryAgent} (${(routingScores[0].similarityScore * 100).toFixed(1)}% match). ` +
    (crisisOverride ? 'Crisis safety check enabled.' : '');
  
  console.log(`RAG Router: ${routingReason}`);
  
  return {
    primaryAgent,
    activatedAgents,
    routingScores,
    routingReason,
    crisisOverride,
  };
}

async function ensureAgentMemoryCollection() {
  try {
    await qdrantRequest('/collections/agent_memories', 'GET');
  } catch {
    console.log('Creating agent_memories collection');
    await qdrantRequest('/collections/agent_memories', 'PUT', {
      vectors: { size: 1536, distance: 'Cosine' },
    });
  }
}

async function ensureOutcomesCollection() {
  try {
    await qdrantRequest('/collections/agent_outcomes', 'GET');
  } catch {
    console.log('Creating agent_outcomes collection');
    await qdrantRequest('/collections/agent_outcomes', 'PUT', {
      vectors: { size: 1536, distance: 'Cosine' },
    });
  }
}

// Ensure voting history collection exists
async function ensureVotingCollection() {
  try {
    await qdrantRequest('/collections/agent_votes', 'GET');
  } catch {
    console.log('Creating agent_votes collection');
    await qdrantRequest('/collections/agent_votes', 'PUT', {
      vectors: { size: 1536, distance: 'Cosine' },
    });
  }
}

// Store a voting record
async function storeVoteRecord(
  userId: string,
  voteRecord: {
    recommendation: string;
    proposingAgent: AgentType;
    votes: AgentVote[];
    consensusStrength: number;
    verdict: 'approved' | 'rejected' | 'mixed';
    query: string;
  }
): Promise<string> {
  const embedding = await generateEmbedding(voteRecord.recommendation);
  const pointId = crypto.randomUUID();
  
  await qdrantRequest('/collections/agent_votes/points', 'PUT', {
    points: [{
      id: pointId,
      vector: embedding,
      payload: {
        user_id: userId,
        recommendation_id: pointId,
        ...voteRecord,
        created_at: new Date().toISOString(),
        validated: false, // Will be set when user provides feedback
      },
    }],
  });
  
  console.log(`Stored vote record: ${voteRecord.verdict} (strength: ${voteRecord.consensusStrength.toFixed(2)})`);
  return pointId;
}

// Get voting accuracy for each agent based on validated votes
async function getAgentVotingWeights(userId: string): Promise<Record<Exclude<AgentType, 'orchestrator'>, number>> {
  const weights: Record<Exclude<AgentType, 'orchestrator'>, number> = {
    mood_analyst: 1.0,
    yoga_coach: 1.0,
    crisis_detector: 1.0,
  };

  try {
    // Get validated vote records
    const result = await qdrantRequest('/collections/agent_votes/points/scroll', 'POST', {
      filter: {
        must: [
          { key: 'user_id', match: { value: userId } },
          { key: 'validated', match: { value: true } },
        ],
      },
      limit: 100,
      with_payload: true,
    });

    const validatedVotes = result.result?.points || [];
    
    if (validatedVotes.length === 0) {
      return weights; // Return default weights if no validated votes
    }

    // Calculate accuracy for each agent
    const agentStats: Record<string, { correct: number; total: number }> = {
      mood_analyst: { correct: 0, total: 0 },
      yoga_coach: { correct: 0, total: 0 },
      crisis_detector: { correct: 0, total: 0 },
    };

    for (const votePoint of validatedVotes) {
      const votes = votePoint.payload.votes as AgentVote[];
      const wasHelpful = votePoint.payload.user_outcome === 'helpful';
      
      for (const vote of votes) {
        if (vote.vote === 'abstain') continue;
        
        agentStats[vote.agent].total++;
        
        // Correct vote: agreed and was helpful, OR disagreed and wasn't helpful
        const wasCorrect = (vote.vote === 'agree' && wasHelpful) || 
                          (vote.vote === 'disagree' && !wasHelpful);
        if (wasCorrect) {
          agentStats[vote.agent].correct++;
        }
      }
    }

    // Calculate weights based on accuracy (min 0.5, max 2.0)
    for (const agent of Object.keys(weights) as Exclude<AgentType, 'orchestrator'>[]) {
      const stats = agentStats[agent];
      if (stats.total > 0) {
        const accuracy = stats.correct / stats.total;
        // Weight formula: 0.5 + accuracy * 1.5 (ranges from 0.5 to 2.0)
        weights[agent] = 0.5 + accuracy * 1.5;
      }
    }

    console.log('Agent voting weights:', weights);
  } catch (e) {
    console.error('Failed to get voting weights:', e);
  }

  return weights;
}

// Have agents vote on a recommendation
async function collectAgentVotes(
  recommendation: string,
  proposingAgent: AgentType,
  allInsights: Record<AgentType, string[]>,
  query: string,
  agentWeights: Record<Exclude<AgentType, 'orchestrator'>, number>
): Promise<{ votes: AgentVote[]; consensusStrength: number; verdict: 'approved' | 'rejected' | 'mixed' }> {
  const agents: Exclude<AgentType, 'orchestrator'>[] = ['mood_analyst', 'yoga_coach', 'crisis_detector'];
  const votes: AgentVote[] = [];

  // Each agent votes on the recommendation
  for (const agent of agents) {
    const isProposer = agent === proposingAgent;
    
    if (isProposer) {
      // Proposing agent always agrees with own recommendation
      votes.push({
        agent,
        recommendation,
        vote: 'agree',
        confidence: 0.95,
        reasoning: 'I proposed this recommendation based on my analysis.',
      });
      continue;
    }

    // Other agents evaluate based on their domain expertise
    const agentInsights = allInsights[agent] || [];
    
    const votePrompt = `You are the ${agent.replace('_', ' ')} agent. Another agent (${proposingAgent.replace('_', ' ')}) has proposed this recommendation:

"${recommendation}"

For user query: "${query}"

Your insights: ${agentInsights.join('; ') || 'No specific insights available'}

Based on your domain expertise, vote on this recommendation:
- AGREE: If it aligns with your insights and would benefit the user
- DISAGREE: If it conflicts with your expertise or could be counterproductive
- ABSTAIN: If it's outside your domain or you have no strong opinion

Respond with JSON: { "vote": "agree|disagree|abstain", "confidence": 0.8, "reasoning": "brief explanation" }`;

    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'user', content: votePrompt },
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          votes.push({
            agent,
            recommendation,
            vote: parsed.vote || 'abstain',
            confidence: parsed.confidence || 0.5,
            reasoning: parsed.reasoning || 'No reasoning provided',
          });
          continue;
        }
      }
    } catch (e) {
      console.error(`${agent} voting error:`, e);
    }

    // Default to abstain if voting fails
    votes.push({
      agent,
      recommendation,
      vote: 'abstain',
      confidence: 0,
      reasoning: 'Voting failed or timed out',
    });
  }

  // Calculate weighted consensus
  let weightedAgree = 0;
  let weightedDisagree = 0;
  let totalWeight = 0;

  for (const vote of votes) {
    if (vote.vote === 'abstain') continue;
    
    const weight = agentWeights[vote.agent] * vote.confidence;
    totalWeight += weight;
    
    if (vote.vote === 'agree') {
      weightedAgree += weight;
    } else {
      weightedDisagree += weight;
    }
  }

  const consensusStrength = totalWeight > 0 
    ? Math.abs(weightedAgree - weightedDisagree) / totalWeight 
    : 0;

  let verdict: 'approved' | 'rejected' | 'mixed';
  if (totalWeight === 0) {
    verdict = 'mixed';
  } else if (weightedAgree > weightedDisagree && consensusStrength > 0.3) {
    verdict = 'approved';
  } else if (weightedDisagree > weightedAgree && consensusStrength > 0.3) {
    verdict = 'rejected';
  } else {
    verdict = 'mixed';
  }

  return { votes, consensusStrength, verdict };
}

// Search memories created by specific agent or all agents
async function searchAgentMemories(
  userId: string,
  queryVector: number[],
  agentFilter?: AgentType,
  limit: number = 10
): Promise<AgentMemory[]> {
  const filter: Record<string, unknown> = {
    must: [{ key: 'user_id', match: { value: userId } }],
  };

  if (agentFilter) {
    filter.must = [
      ...(filter.must as unknown[]),
      { key: 'created_by_agent', match: { value: agentFilter } },
    ];
  }

  try {
    const result = await qdrantRequest('/collections/agent_memories/points/search', 'POST', {
      vector: queryVector,
      filter,
      limit,
      with_payload: true,
    });

    return (result.result || []).map((r: { id: string; score: number; payload: Record<string, unknown> }) => ({
      id: r.id,
      agent: r.payload.created_by_agent as AgentType,
      insight: r.payload.insight as string,
      metadata: r.payload,
      created_at: r.payload.created_at as string,
    }));
  } catch (e) {
    console.error('Agent memory search failed:', e);
    return [];
  }
}

// Store agent insight in shared memory pool
async function storeAgentMemory(
  userId: string,
  agent: AgentType,
  insight: string,
  embedding: number[],
  metadata: Record<string, unknown>
): Promise<string> {
  const pointId = crypto.randomUUID();
  
  await qdrantRequest('/collections/agent_memories/points', 'PUT', {
    points: [{
      id: pointId,
      vector: embedding,
      payload: {
        user_id: userId,
        created_by_agent: agent,
        insight,
        created_at: new Date().toISOString(),
        ...metadata,
      },
    }],
  });

  return pointId;
}

// Store recommendation outcome for agent learning
async function storeOutcome(
  userId: string,
  outcome: OutcomeRecord
): Promise<string> {
  const embedding = await generateEmbedding(`${outcome.recommendation} ${outcome.context_summary}`);
  const pointId = crypto.randomUUID();
  
  await qdrantRequest('/collections/agent_outcomes/points', 'PUT', {
    points: [{
      id: pointId,
      vector: embedding,
      payload: {
        user_id: userId,
        ...outcome,
        created_at: new Date().toISOString(),
      },
    }],
  });
  
  console.log(`Stored outcome for agent ${outcome.agent_id}: ${outcome.outcome}`);
  return pointId;
}

// Retrieve past successful recommendations for an agent
async function getPastSuccesses(
  userId: string,
  queryVector: number[],
  agentId: AgentType,
  limit: number = 5
): Promise<PastSuccess[]> {
  try {
    const result = await qdrantRequest('/collections/agent_outcomes/points/search', 'POST', {
      vector: queryVector,
      filter: {
        must: [
          { key: 'user_id', match: { value: userId } },
          { key: 'agent_id', match: { value: agentId } },
          { key: 'outcome', match: { value: 'helpful' } },
        ],
      },
      limit,
      with_payload: true,
    });

    return (result.result || []).map((r: { payload: Record<string, unknown> }) => ({
      recommendation: r.payload.recommendation as string,
      effectiveness: r.payload.effectiveness_score as number,
      context: r.payload.context_summary as string,
      created_at: r.payload.created_at as string,
    }));
  } catch (e) {
    console.error('Failed to get past successes:', e);
    return [];
  }
}

// Get learning statistics
async function getLearningStats(userId: string): Promise<LearningStats> {
  const stats: LearningStats = {
    totalOutcomes: 0,
    helpfulCount: 0,
    byAgent: {
      mood_analyst: { total: 0, helpful: 0 },
      yoga_coach: { total: 0, helpful: 0 },
      crisis_detector: { total: 0, helpful: 0 },
      orchestrator: { total: 0, helpful: 0 },
    },
  };

  try {
    // Get all outcomes for user
    const result = await qdrantRequest('/collections/agent_outcomes/points/scroll', 'POST', {
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
      },
      limit: 100,
      with_payload: true,
    });

    const points = result.result?.points || [];
    stats.totalOutcomes = points.length;

    for (const point of points) {
      const agentId = point.payload.agent_id as AgentType;
      const isHelpful = point.payload.outcome === 'helpful';
      
      if (isHelpful) stats.helpfulCount++;
      
      if (stats.byAgent[agentId]) {
        stats.byAgent[agentId].total++;
        if (isHelpful) stats.byAgent[agentId].helpful++;
      }
    }
  } catch (e) {
    console.error('Failed to get learning stats:', e);
  }

  return stats;
}

// Search across all wellness collections for context
async function searchWellnessCollections(
  userId: string,
  queryVector: number[],
  collections: string[] = ['mood_memories', 'therapy_sessions', 'user_insights']
): Promise<Record<string, unknown[]>> {
  const results: Record<string, unknown[]> = {};

  for (const collection of collections) {
    try {
      const result = await qdrantRequest(`/collections/${collection}/points/search`, 'POST', {
        vector: queryVector,
        filter: {
          must: [{ key: 'user_id', match: { value: userId } }],
        },
        limit: 5,
        with_payload: true,
      });
      results[collection] = result.result || [];
    } catch (e) {
      console.error(`Failed to search ${collection}:`, e);
      results[collection] = [];
    }
  }

  return results;
}

// Agent implementations
async function runMoodAnalyst(
  userId: string,
  context: Record<string, unknown>,
  queryVector: number[],
  crossAgentMemories: AgentMemory[],
  isActivated: boolean
): Promise<AgentResponse> {
  if (!isActivated) {
    return {
      agent: 'mood_analyst',
      status: 'skipped',
      insights: [],
      recommendations: [],
      confidence: 0,
      reasoning: 'Agent not activated by router for this query',
      wasActivated: false,
    };
  }
  
  console.log('MoodAnalyst: Starting analysis');

  // Get mood-specific data from Qdrant
  const moodData = await searchWellnessCollections(userId, queryVector, ['mood_memories']);
  
  // Query insights from other agents
  const otherAgentInsights = crossAgentMemories.filter(m => m.agent !== 'mood_analyst');
  
  // Get past successful recommendations for learning
  const pastSuccesses = await getPastSuccesses(userId, queryVector, 'mood_analyst', 3);
  const pastSuccessText = pastSuccesses.length > 0
    ? `\n\nPAST SUCCESSFUL RECOMMENDATIONS (learn from these):\n${pastSuccesses.map(s => `- "${s.recommendation}" (effectiveness: ${s.effectiveness}/10, context: ${s.context})`).join('\n')}`
    : '';

  const systemPrompt = `You are the MoodAnalyst agent, specialized in understanding emotional patterns and mood dynamics.
Your role is to:
1. Analyze current and historical mood data
2. Identify emotional triggers and patterns
3. Consider insights from other agents (YogaCoach, CrisisDetector) when forming recommendations
4. Provide actionable mood-based recommendations
5. PRIORITIZE recommendations similar to past successes when the context is similar

Cross-agent insights available: ${otherAgentInsights.map(i => `[${i.agent}]: ${i.insight}`).join('\n')}${pastSuccessText}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Analyze this mood context and provide insights:
Context: ${JSON.stringify(context)}
Recent mood memories: ${JSON.stringify(moodData.mood_memories?.slice(0, 5))}

Respond with JSON: { "insights": ["insight1", "insight2"], "recommendations": ["rec1", "rec2"], "confidence": 0.8, "reasoning": "explanation" }` 
        },
      ],
      max_tokens: 600,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    return {
      agent: 'mood_analyst',
      status: 'error',
      insights: [],
      recommendations: [],
      confidence: 0,
      reasoning: 'Failed to generate analysis',
      wasActivated: true,
    };
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        agent: 'mood_analyst',
        status: 'success',
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || '',
        crossAgentData: { moodTrend: parsed.moodTrend, triggers: parsed.triggers },
        pastSuccesses,
        wasActivated: true,
      };
    }
  } catch (e) {
    console.error('MoodAnalyst parse error:', e);
  }

  return {
    agent: 'mood_analyst',
    status: 'success',
    insights: [content.slice(0, 200)],
    recommendations: [],
    confidence: 0.5,
    reasoning: 'Partial analysis completed',
    pastSuccesses: [],
    wasActivated: true,
  };
}

async function runYogaCoach(
  userId: string,
  context: Record<string, unknown>,
  queryVector: number[],
  crossAgentMemories: AgentMemory[],
  isActivated: boolean
): Promise<AgentResponse> {
  if (!isActivated) {
    return {
      agent: 'yoga_coach',
      status: 'skipped',
      insights: [],
      recommendations: [],
      confidence: 0,
      reasoning: 'Agent not activated by router for this query',
      wasActivated: false,
    };
  }
  
  console.log('YogaCoach: Starting analysis');

  // Get yoga/activity data
  const activityData = await searchWellnessCollections(userId, queryVector, ['therapy_sessions', 'wellness_activities']);
  
  // Consider mood insights from MoodAnalyst
  const moodInsights = crossAgentMemories.filter(m => m.agent === 'mood_analyst');
  
  // Get past successful recommendations for learning
  const pastSuccesses = await getPastSuccesses(userId, queryVector, 'yoga_coach', 3);
  const pastSuccessText = pastSuccesses.length > 0
    ? `\n\nPAST SUCCESSFUL RECOMMENDATIONS (learn from these):\n${pastSuccesses.map(s => `- "${s.recommendation}" (effectiveness: ${s.effectiveness}/10, context: ${s.context})`).join('\n')}`
    : '';

  const systemPrompt = `You are the YogaCoach agent, specialized in physical wellness and yoga practice.
Your role is to:
1. Recommend yoga poses and breathing exercises
2. Consider the user's current mood (from MoodAnalyst insights)
3. Suggest activity modifications based on energy levels
4. Track and encourage physical wellness progress
5. PRIORITIZE recommendations similar to past successes when the context is similar

MoodAnalyst insights: ${moodInsights.map(i => i.insight).join('; ')}${pastSuccessText}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Based on this context, provide yoga/wellness recommendations:
Context: ${JSON.stringify(context)}
Recent activities: ${JSON.stringify(activityData.therapy_sessions?.slice(0, 5))}

Respond with JSON: { "insights": ["insight1"], "recommendations": ["yoga pose or exercise"], "confidence": 0.8, "reasoning": "why these recommendations" }` 
        },
      ],
      max_tokens: 600,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    return {
      agent: 'yoga_coach',
      status: 'error',
      insights: [],
      recommendations: [],
      confidence: 0,
      reasoning: 'Failed to generate recommendations',
      wasActivated: true,
    };
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        agent: 'yoga_coach',
        status: 'success',
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || '',
        crossAgentData: { suggestedPoses: parsed.poses, duration: parsed.duration },
        pastSuccesses,
        wasActivated: true,
      };
    }
  } catch (e) {
    console.error('YogaCoach parse error:', e);
  }

  return {
    agent: 'yoga_coach',
    status: 'success',
    insights: [content.slice(0, 200)],
    recommendations: [],
    confidence: 0.5,
    reasoning: 'Partial recommendations generated',
    pastSuccesses: [],
    wasActivated: true,
  };
}

async function runCrisisDetector(
  userId: string,
  context: Record<string, unknown>,
  queryVector: number[],
  crossAgentMemories: AgentMemory[],
  isActivated: boolean
): Promise<AgentResponse> {
  if (!isActivated) {
    return {
      agent: 'crisis_detector',
      status: 'skipped',
      insights: [],
      recommendations: [],
      confidence: 0,
      reasoning: 'Agent not activated by router for this query',
      wasActivated: false,
    };
  }
  
  console.log('CrisisDetector: Starting analysis');

  // Search for concerning patterns
  const allData = await searchWellnessCollections(userId, queryVector);
  
  // Check mood trends from MoodAnalyst
  const moodInsights = crossAgentMemories.filter(m => m.agent === 'mood_analyst');

  const systemPrompt = `You are the CrisisDetector agent, specialized in identifying concerning emotional patterns.
Your role is to:
1. Monitor for signs of emotional distress
2. Identify rapid mood declines or isolation patterns
3. Flag concerning content in journals or voice entries
4. Recommend appropriate support resources when needed
5. Coordinate with other agents on safety concerns

Recent MoodAnalyst observations: ${moodInsights.map(i => i.insight).join('; ')}

IMPORTANT: If you detect concerning patterns, set priority to "high" in your response.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Analyze for crisis indicators:
Context: ${JSON.stringify(context)}
All wellness data: ${JSON.stringify(allData)}

Respond with JSON: { "insights": ["observation"], "recommendations": ["action"], "confidence": 0.8, "reasoning": "analysis", "priority": "low|medium|high", "riskLevel": 0.2 }` 
        },
      ],
      max_tokens: 600,
      temperature: 0.3, // Lower temperature for safety-critical analysis
    }),
  });

  if (!response.ok) {
    return {
      agent: 'crisis_detector',
      status: 'error',
      insights: [],
      recommendations: [],
      confidence: 0,
      reasoning: 'Failed to complete safety check',
      wasActivated: true,
    };
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        agent: 'crisis_detector',
        status: 'success',
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || '',
        crossAgentData: { priority: parsed.priority, riskLevel: parsed.riskLevel },
        wasActivated: true,
      };
    }
  } catch (e) {
    console.error('CrisisDetector parse error:', e);
  }

  return {
    agent: 'crisis_detector',
    status: 'success',
    insights: ['Safety check completed'],
    recommendations: [],
    confidence: 0.6,
    reasoning: 'Basic safety analysis performed',
    wasActivated: true,
  };
}

// Orchestrator: coordinates agents and builds consensus with RAG routing
async function orchestrate(
  userId: string,
  query: string,
  context: Record<string, unknown>
): Promise<CollaborativeResult> {
  console.log('Orchestrator: Starting multi-agent collaboration with RAG routing');
  
  await ensureAgentMemoryCollection();
  await ensureOutcomesCollection();

  const communicationLog: AgentMessage[] = [];
  
  // Generate query embedding
  const queryVector = await generateEmbedding(query);
  
  // RAG Router: Determine which agents to activate
  const routingDecision = await routeQuery(query, queryVector);
  
  // Log routing decision
  communicationLog.push({
    from: 'orchestrator',
    to: 'all',
    type: 'routing',
    content: routingDecision.routingReason,
    data: {
      activatedAgents: routingDecision.activatedAgents,
      scores: routingDecision.routingScores.map(s => ({
        agent: s.agent,
        score: (s.similarityScore * 100).toFixed(1) + '%',
        activated: s.shouldActivate,
      })),
    },
    confidence: 1,
    timestamp: new Date().toISOString(),
  });
  
  // Fetch existing agent memories from Qdrant
  const existingMemories = await searchAgentMemories(userId, queryVector, undefined, 20);
  
  communicationLog.push({
    from: 'orchestrator',
    to: 'all',
    type: 'query',
    content: `Processing query: "${query}"`,
    confidence: 1,
    timestamp: new Date().toISOString(),
  });

  // Run agents based on routing decision
  const moodActivated = routingDecision.activatedAgents.includes('mood_analyst');
  const yogaActivated = routingDecision.activatedAgents.includes('yoga_coach');
  const crisisActivated = routingDecision.activatedAgents.includes('crisis_detector');
  
  const [moodResponse, yogaResponse, crisisResponse] = await Promise.all([
    runMoodAnalyst(userId, context, queryVector, existingMemories, moodActivated),
    runYogaCoach(userId, context, queryVector, existingMemories, yogaActivated),
    runCrisisDetector(userId, context, queryVector, existingMemories, crisisActivated),
  ]);

  const agentResponses = [moodResponse, yogaResponse, crisisResponse];

  // Log agent communications (only for activated agents)
  for (const response of agentResponses) {
    if (response.wasActivated) {
      communicationLog.push({
        from: response.agent,
        to: 'orchestrator',
        type: 'insight',
        content: response.insights.join('; ') || 'No insights generated',
        confidence: response.confidence,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Store new insights in shared memory (only for activated agents)
  const newMemories: AgentMemory[] = [];
  for (const response of agentResponses) {
    if (response.wasActivated && response.status === 'success' && response.insights.length > 0) {
      const insightText = response.insights.join(' ');
      const embedding = await generateEmbedding(insightText);
      const pointId = await storeAgentMemory(userId, response.agent, insightText, embedding, {
        query,
        confidence: response.confidence,
        recommendations: response.recommendations,
        routing_score: routingDecision.routingScores.find(s => s.agent === response.agent)?.similarityScore,
      });
      
      newMemories.push({
        id: pointId,
        agent: response.agent,
        insight: insightText,
        metadata: { query, confidence: response.confidence },
        created_at: new Date().toISOString(),
      });
    }
  }

  // Get agent voting weights based on historical accuracy
  await ensureVotingCollection();
  const agentWeights = await getAgentVotingWeights(userId);
  
  // Build consensus recommendations with voting (only from activated agents)
  const activatedResponses = agentResponses.filter(r => r.wasActivated && r.status === 'success');
  const allRecommendations = activatedResponses.flatMap(r => 
    r.recommendations.map(rec => ({
      recommendation: rec,
      agent: r.agent,
      confidence: r.confidence,
    }))
  );

  // Collect all insights for voting context
  const allInsights: Record<AgentType, string[]> = {
    mood_analyst: moodResponse.insights,
    yoga_coach: yogaResponse.insights,
    crisis_detector: crisisResponse.insights,
    orchestrator: [],
  };

  // Have agents vote on each recommendation
  console.log(`Consensus voting: Processing ${allRecommendations.length} recommendations`);
  const consensusRecommendations: ConsensusRecommendation[] = [];
  let totalVotesCast = 0;
  let approvedCount = 0;

  for (const rec of allRecommendations) {
    const { votes, consensusStrength, verdict } = await collectAgentVotes(
      rec.recommendation,
      rec.agent,
      allInsights,
      query,
      agentWeights
    );

    // Log voting communication
    
    communicationLog.push({
      from: 'orchestrator',
      to: 'all',
      type: 'recommendation',
      content: `Voting on: "${rec.recommendation.slice(0, 50)}..." - ${verdict.toUpperCase()} (${(consensusStrength * 100).toFixed(0)}% consensus)`,
      data: {
        votes: votes.map(v => ({ agent: v.agent, vote: v.vote, confidence: v.confidence })),
        verdict,
      },
      confidence: consensusStrength,
      timestamp: new Date().toISOString(),
    });

    // Find supporting agents (those who agreed)
    const supportingAgents = votes
      .filter(v => v.vote === 'agree')
      .map(v => v.agent as AgentType);

    consensusRecommendations.push({
      recommendation: rec.recommendation,
      proposingAgent: rec.agent,
      supportingAgents: supportingAgents.length > 0 ? supportingAgents : [rec.agent],
      confidence: rec.confidence * (0.5 + consensusStrength * 0.5), // Adjust confidence by consensus
      evidence: agentResponses
        .filter(r => r.agent === rec.agent)
        .flatMap(r => r.insights),
      votes,
      consensusStrength,
      verdict,
    });

    totalVotesCast += votes.filter(v => v.vote !== 'abstain').length;
    if (verdict === 'approved') approvedCount++;

    // Store vote record for learning
    await storeVoteRecord(userId, {
      recommendation: rec.recommendation,
      proposingAgent: rec.agent,
      votes,
      consensusStrength,
      verdict,
      query,
    });
  }

  // Sort by consensus strength and verdict
  consensusRecommendations.sort((a, b) => {
    // Approved recommendations first
    if (a.verdict === 'approved' && b.verdict !== 'approved') return -1;
    if (b.verdict === 'approved' && a.verdict !== 'approved') return 1;
    // Then by consensus strength
    return b.consensusStrength - a.consensusStrength;
  });

  // Check for crisis priority
  const crisisData = crisisResponse.crossAgentData as { priority?: string; riskLevel?: number } | undefined;
  const hasCrisis = crisisData?.priority === 'high';

  // Generate orchestrator summary mentioning routing and voting
  const activatedAgentNames = routingDecision.activatedAgents.map(a => 
    a === 'mood_analyst' ? 'MoodAnalyst' : a === 'yoga_coach' ? 'YogaCoach' : 'CrisisDetector'
  ).join(', ');
  
  const consensusRate = allRecommendations.length > 0 
    ? (approvedCount / allRecommendations.length) * 100 
    : 0;
  
  const summaryPrompt = `As the orchestrator, summarize the collaborative findings. 

ROUTING: The RAG router selected ${activatedAgentNames} based on semantic query analysis.

CONSENSUS VOTING: ${allRecommendations.length} recommendations were voted on. ${approvedCount} approved (${consensusRate.toFixed(0)}% consensus rate).

${moodResponse.wasActivated ? `MoodAnalyst: ${moodResponse.reasoning}` : ''}
${yogaResponse.wasActivated ? `YogaCoach: ${yogaResponse.reasoning}` : ''}
${crisisResponse.wasActivated ? `CrisisDetector: ${crisisResponse.reasoning}` : ''}
${hasCrisis ? '\n⚠️ CRISIS PRIORITY: The CrisisDetector has flagged high-priority concerns.' : ''}

Provide a brief, cohesive summary that integrates the insights from the activated agents. Highlight recommendations that achieved strong consensus.`;

  const summaryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a wellness orchestrator that synthesizes insights from multiple AI agents and highlights consensus decisions.' },
        { role: 'user', content: summaryPrompt },
      ],
      max_tokens: 400,
      temperature: 0.5,
    }),
  });

  let orchestratorSummary = 'Multi-agent analysis complete.';
  if (summaryResponse.ok) {
    const summaryData = await summaryResponse.json();
    orchestratorSummary = summaryData.choices[0]?.message?.content || orchestratorSummary;
  }

  communicationLog.push({
    from: 'orchestrator',
    to: 'all',
    type: 'insight',
    content: orchestratorSummary,
    confidence: 0.9,
    timestamp: new Date().toISOString(),
  });

  // Get learning statistics
  const learningStats = await getLearningStats(userId);

  return {
    orchestratorSummary,
    agentResponses,
    sharedMemories: [...existingMemories.slice(0, 5), ...newMemories],
    consensusRecommendations,
    communicationLog,
    learningStats,
    routingDecision,
    votingStats: {
      totalVotesCast,
      consensusRate,
      agentWeights,
    },
  };
}

// Get agent memory statistics
async function getAgentStats(userId: string): Promise<Record<AgentType, number>> {
  const stats: Record<string, number> = {
    mood_analyst: 0,
    yoga_coach: 0,
    crisis_detector: 0,
    orchestrator: 0,
  };

  for (const agent of Object.keys(stats)) {
    try {
      const result = await qdrantRequest('/collections/agent_memories/points/count', 'POST', {
        filter: {
          must: [
            { key: 'user_id', match: { value: userId } },
            { key: 'created_by_agent', match: { value: agent } },
          ],
        },
      });
      stats[agent] = result.result?.count || 0;
    } catch {
      // Collection might not exist yet
    }
  }

  return stats as Record<AgentType, number>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, userId, query, context } = await req.json();

    console.log(`Multi-agent operation: ${operation}`);

    if (!userId) {
      throw new Error('userId is required');
    }

    let result;

    switch (operation) {
      case 'collaborate':
        if (!query) throw new Error('query is required for collaboration');
        result = await orchestrate(userId, query, context || {});
        break;

      case 'get_agent_memories':
        const queryVector = await generateEmbedding(query || 'general wellness');
        result = await searchAgentMemories(userId, queryVector, context?.agentFilter as AgentType);
        break;

      case 'get_stats':
        result = await getAgentStats(userId);
        break;

      case 'store_outcome':
        if (!context?.outcome) throw new Error('outcome is required');
        await ensureOutcomesCollection();
        result = await storeOutcome(userId, context.outcome as OutcomeRecord);
        break;

      case 'get_learning_stats':
        await ensureOutcomesCollection();
        result = await getLearningStats(userId);
        break;

      case 'validate_vote':
        // Update vote record with user feedback to improve agent weights
        if (!context?.recommendation_id || context?.was_helpful === undefined) {
          throw new Error('recommendation_id and was_helpful are required');
        }
        await ensureVotingCollection();
        
        // Search for the vote record by recommendation text
        const searchVector = await generateEmbedding(context.recommendation as string || '');
        const searchResult = await qdrantRequest('/collections/agent_votes/points/search', 'POST', {
          vector: searchVector,
          filter: {
            must: [{ key: 'user_id', match: { value: userId } }],
          },
          limit: 5,
          with_payload: true,
        });
        
        // Find matching vote record and update it
        const matchingPoint = searchResult.result?.find(
          (p: { payload: { recommendation: string } }) => 
            p.payload.recommendation === context.recommendation
        );
        
        if (matchingPoint) {
          // Update the vote record with validation
          await qdrantRequest(`/collections/agent_votes/points/payload`, 'POST', {
            payload: {
              validated: true,
              user_outcome: context.was_helpful ? 'helpful' : 'not_helpful',
              validated_at: new Date().toISOString(),
            },
            points: [matchingPoint.id],
          });
          result = { updated: true, pointId: matchingPoint.id };
        } else {
          result = { updated: false, message: 'Vote record not found' };
        }
        break;

      case 'get_voting_stats':
        await ensureVotingCollection();
        const weights = await getAgentVotingWeights(userId);
        
        // Get total vote counts
        let voteStats;
        try {
          const countResult = await qdrantRequest('/collections/agent_votes/points/count', 'POST', {
            filter: {
              must: [{ key: 'user_id', match: { value: userId } }],
            },
          });
          voteStats = {
            totalVotes: countResult.result?.count || 0,
            agentWeights: weights,
          };
        } catch {
          voteStats = { totalVotes: 0, agentWeights: weights };
        }
        result = voteStats;
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Multi-agent error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
