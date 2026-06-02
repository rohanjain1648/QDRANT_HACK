import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DecayConfig {
  halfLifeDays: number; // How many days until confidence halves
  minConfidence: number; // Minimum confidence before considered "forgotten"
  reinforceBoost: number; // How much to boost on reinforcement
}

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays: 14, // Confidence halves every 2 weeks
  minConfidence: 0.1, // Below 10% = nearly forgotten
  reinforceBoost: 0.15, // +15% on reinforcement
};

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

// Calculate exponential decay based on time since last reinforcement
function calculateDecay(lastReinforcedAt: string, config: DecayConfig): number {
  const now = new Date();
  const lastReinforced = new Date(lastReinforcedAt);
  const daysSinceReinforced = (now.getTime() - lastReinforced.getTime()) / (1000 * 60 * 60 * 24);
  
  // Exponential decay: decay = 0.5 ^ (days / halfLife)
  const decayFactor = Math.pow(0.5, daysSinceReinforced / config.halfLifeDays);
  return Math.max(config.minConfidence, decayFactor);
}

// Apply decay to all insights for a user
async function applyDecayToInsights(userId: string, config: DecayConfig) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get all user insights
  const { data: insights, error } = await supabase
    .from('user_insights')
    .select('id, confidence_score, decay_factor, last_reinforced_at, qdrant_point_id, created_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }

  const updates = [];
  const qdrantUpdates = [];

  for (const insight of insights || []) {
    const lastReinforced = insight.last_reinforced_at || insight.created_at;
    const newDecayFactor = calculateDecay(lastReinforced, config);
    
    // Calculate effective confidence = base confidence * decay factor
    const effectiveConfidence = (insight.confidence_score || 0.5) * newDecayFactor;
    
    updates.push({
      id: insight.id,
      decay_factor: newDecayFactor,
      // Store effective confidence for quick access
    });

    // Update Qdrant payload
    if (insight.qdrant_point_id) {
      qdrantUpdates.push({
        pointId: insight.qdrant_point_id,
        decay_factor: newDecayFactor,
        effective_confidence: effectiveConfidence,
        is_fading: effectiveConfidence < 0.3,
        is_forgotten: effectiveConfidence < config.minConfidence,
      });
    }
  }

  // Batch update Supabase
  for (const update of updates) {
    await supabase
      .from('user_insights')
      .update({ decay_factor: update.decay_factor })
      .eq('id', update.id);
  }

  // Batch update Qdrant payloads
  for (const update of qdrantUpdates) {
    try {
      await qdrantRequest(`/collections/user_insights/points/payload`, 'POST', {
        points: [update.pointId],
        payload: {
          decay_factor: update.decay_factor,
          effective_confidence: update.effective_confidence,
          is_fading: update.is_fading,
          is_forgotten: update.is_forgotten,
          last_decay_update: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.error(`Failed to update Qdrant point ${update.pointId}:`, e);
    }
  }

  return {
    processed: updates.length,
    fadingCount: qdrantUpdates.filter(u => u.is_fading).length,
    forgottenCount: qdrantUpdates.filter(u => u.is_forgotten).length,
  };
}

// Reinforce an insight (called when evidence supports it)
async function reinforceInsight(
  insightId: string, 
  evidenceType: 'mood_pattern' | 'activity_correlation' | 'user_feedback',
  config: DecayConfig
) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get current insight
  const { data: insight, error } = await supabase
    .from('user_insights')
    .select('*')
    .eq('id', insightId)
    .single();

  if (error || !insight) {
    throw new Error(`Insight not found: ${insightId}`);
  }

  // Calculate new confidence with boost
  const currentConfidence = insight.confidence_score || 0.5;
  const newConfidence = Math.min(0.99, currentConfidence + config.reinforceBoost);

  // Update in Supabase
  const { error: updateError } = await supabase
    .from('user_insights')
    .update({
      confidence_score: newConfidence,
      decay_factor: 1.0, // Reset decay on reinforcement
      last_reinforced_at: new Date().toISOString(),
    })
    .eq('id', insightId);

  if (updateError) {
    throw updateError;
  }

  // Update in Qdrant
  if (insight.qdrant_point_id) {
    await qdrantRequest(`/collections/user_insights/points/payload`, 'POST', {
      points: [insight.qdrant_point_id],
      payload: {
        confidence_score: newConfidence,
        decay_factor: 1.0,
        effective_confidence: newConfidence,
        is_fading: false,
        is_forgotten: false,
        last_reinforced_at: new Date().toISOString(),
        reinforcement_history: [
          ...(Array.isArray(insight.reinforcement_history) ? insight.reinforcement_history : []),
          { type: evidenceType, timestamp: new Date().toISOString() }
        ].slice(-10), // Keep last 10 reinforcements
      },
    });
  }

  return {
    insightId,
    previousConfidence: currentConfidence,
    newConfidence,
    evidenceType,
  };
}

// Find similar memories that could reinforce each other
async function findReinforcementCandidates(userId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get recent mood entries
  const { data: recentMoods } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get user insights that might be reinforced
  const { data: insights } = await supabase
    .from('user_insights')
    .select('*')
    .eq('user_id', userId)
    .gt('decay_factor', 0.1); // Only consider non-forgotten insights

  const reinforcementCandidates = [];

  // For each insight, check if recent mood patterns support it
  for (const insight of insights || []) {
    if (!insight.qdrant_point_id) continue;

    // Search for similar recent memories
    try {
      const searchResult = await qdrantRequest(`/collections/mood_memories/points/search`, 'POST', {
        vector: await getInsightVector(insight.qdrant_point_id),
        filter: {
          must: [{ key: 'user_id', match: { value: userId } }],
        },
        limit: 5,
        with_payload: true,
        score_threshold: 0.7, // High similarity threshold
      });

      if (searchResult.result && searchResult.result.length > 0) {
        reinforcementCandidates.push({
          insightId: insight.id,
          insightText: insight.insight_text,
          supportingMemories: searchResult.result.length,
          avgSimilarity: searchResult.result.reduce((acc: number, r: any) => acc + r.score, 0) / searchResult.result.length,
        });
      }
    } catch (e) {
      console.log(`Could not find reinforcement for insight ${insight.id}`);
    }
  }

  return reinforcementCandidates;
}

// Helper to get vector for an insight from Qdrant
async function getInsightVector(pointId: string): Promise<number[]> {
  const result = await qdrantRequest(`/collections/user_insights/points/${pointId}`, 'GET');
  return result.result?.vector || [];
}

// Get memory health status for a user
async function getMemoryHealth(userId: string, config: DecayConfig) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: insights } = await supabase
    .from('user_insights')
    .select('id, insight_text, insight_type, confidence_score, decay_factor, last_reinforced_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const health = {
    totalInsights: insights?.length || 0,
    activeInsights: 0,
    fadingInsights: 0,
    forgottenInsights: 0,
    insights: [] as any[],
  };

  for (const insight of insights || []) {
    const lastReinforced = insight.last_reinforced_at || insight.created_at;
    const decayFactor = calculateDecay(lastReinforced, config);
    const effectiveConfidence = (insight.confidence_score || 0.5) * decayFactor;

    let status: 'active' | 'fading' | 'forgotten';
    if (effectiveConfidence >= 0.3) {
      status = 'active';
      health.activeInsights++;
    } else if (effectiveConfidence >= config.minConfidence) {
      status = 'fading';
      health.fadingInsights++;
    } else {
      status = 'forgotten';
      health.forgottenInsights++;
    }

    health.insights.push({
      id: insight.id,
      text: insight.insight_text,
      type: insight.insight_type,
      baseConfidence: insight.confidence_score,
      decayFactor,
      effectiveConfidence,
      status,
      daysSinceReinforced: Math.round((new Date().getTime() - new Date(lastReinforced).getTime()) / (1000 * 60 * 60 * 24)),
    });
  }

  return health;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, userId, insightId, evidenceType, config } = await req.json();

    const decayConfig = { ...DEFAULT_DECAY_CONFIG, ...config };

    console.log(`Memory decay operation: ${operation}, userId: ${userId}`);

    let result;

    switch (operation) {
      case 'apply_decay':
        result = await applyDecayToInsights(userId, decayConfig);
        break;

      case 'reinforce':
        if (!insightId) throw new Error('insightId required for reinforce operation');
        result = await reinforceInsight(insightId, evidenceType || 'user_feedback', decayConfig);
        break;

      case 'find_reinforcements':
        result = await findReinforcementCandidates(userId);
        break;

      case 'health_check':
        result = await getMemoryHealth(userId, decayConfig);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Memory decay error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
