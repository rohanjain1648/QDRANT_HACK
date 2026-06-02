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

interface Insight {
  id: string;
  insight_text: string;
  insight_type: string;
  confidence_score: number;
  decay_factor: number;
  created_at: string;
}

interface Contradiction {
  insight1: {
    id: string;
    text: string;
    type: string;
    confidence: number;
  };
  insight2: {
    id: string;
    text: string;
    type: string;
    confidence: number;
  };
  contradictionScore: number;
  explanation: string;
  resolution: string;
}

interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Used for potential future text-based contradiction detection
void generateEmbedding;

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
    throw new Error(`Qdrant request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function getInsightVector(insightId: string): Promise<number[] | null> {
  try {
    const result = await qdrantRequest('/collections/user_insights/points/scroll', 'POST', {
      filter: {
        must: [
          { key: 'insight_id', match: { value: insightId } }
        ]
      },
      with_vectors: true,
      limit: 1,
    });

    if (result.result?.points?.length > 0) {
      return result.result.points[0].vector;
    }
    return null;
  } catch (error) {
    console.error('Error getting insight vector:', error);
    return null;
  }
}

async function findNegativelySimilarInsights(
  vector: number[],
  userId: string,
  excludeId: string,
  limit: number = 5
): Promise<QdrantSearchResult[]> {
  // To find contradictions, we look for insights that are semantically distant
  // by inverting the vector (multiplying by -1) to find opposite meanings
  const invertedVector = vector.map(v => -v);

  try {
    const result = await qdrantRequest('/collections/user_insights/points/search', 'POST', {
      vector: invertedVector,
      limit,
      with_payload: true,
      filter: {
        must: [
          { key: 'user_id', match: { value: userId } }
        ],
        must_not: [
          { key: 'insight_id', match: { value: excludeId } }
        ]
      },
    });

    return result.result || [];
  } catch (error) {
    console.error('Error searching for negative similarity:', error);
    return [];
  }
}

async function findLowSimilarityInsights(
  vector: number[],
  userId: string,
  excludeId: string,
  limit: number = 10
): Promise<QdrantSearchResult[]> {
  // Also find insights with low similarity scores (near 0) which may indicate
  // unrelated or potentially contradictory content
  try {
    const result = await qdrantRequest('/collections/user_insights/points/search', 'POST', {
      vector,
      limit,
      with_payload: true,
      score_threshold: -0.3, // Look for low/negative cosine similarity
      filter: {
        must: [
          { key: 'user_id', match: { value: userId } }
        ],
        must_not: [
          { key: 'insight_id', match: { value: excludeId } }
        ]
      },
    });

    // Filter to only get low similarity scores (potential contradictions)
    return (result.result || []).filter((r: QdrantSearchResult) => r.score < 0.3);
  } catch (error) {
    console.error('Error searching for low similarity:', error);
    return [];
  }
}

async function analyzeContradiction(
  insight1: Insight,
  insight2: Insight,
  similarityScore: number
): Promise<{ isContradiction: boolean; explanation: string; resolution: string; confidence: number }> {
  const prompt = `Analyze if these two mental wellness insights contradict each other:

INSIGHT 1 (${insight1.insight_type}):
"${insight1.insight_text}"

INSIGHT 2 (${insight2.insight_type}):
"${insight2.insight_text}"

Vector similarity score: ${similarityScore.toFixed(3)} (negative = opposite direction in semantic space)

Determine if these insights:
1. Directly contradict each other (e.g., "Exercise improves mood" vs "Exercise has no effect on mood")
2. Are contextually conflicting (e.g., different conclusions from similar situations)
3. Are simply unrelated (not a contradiction)

Respond with a JSON object:
{
  "isContradiction": boolean,
  "confidence": number between 0-1,
  "contradictionType": "direct" | "contextual" | "none",
  "explanation": "Brief explanation of the contradiction or why they don't contradict",
  "resolution": "Suggestion for how to resolve or understand this contradiction"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing mental wellness patterns and detecting contradictions in user insights. Respond only with valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    return {
      isContradiction: result.isContradiction || false,
      explanation: result.explanation || 'Unable to analyze',
      resolution: result.resolution || 'Review both insights manually',
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error('Error analyzing contradiction:', error);
    return {
      isContradiction: false,
      explanation: 'Analysis failed',
      resolution: 'Manual review required',
      confidence: 0,
    };
  }
}

async function detectContradictions(userId: string): Promise<Contradiction[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch all active insights for the user
  const { data: insights, error } = await supabase
    .from('user_insights')
    .select('*')
    .eq('user_id', userId)
    .gte('decay_factor', 0.3) // Only check non-forgotten insights
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }

  if (!insights || insights.length < 2) {
    console.log('Not enough insights to detect contradictions');
    return [];
  }

  console.log(`Analyzing ${insights.length} insights for contradictions`);

  const contradictions: Contradiction[] = [];
  const checkedPairs = new Set<string>();

  // For each insight, find potentially contradicting insights using negative similarity
  for (const insight of insights.slice(0, 10)) { // Limit to top 10 most recent
    const vector = await getInsightVector(insight.id);
    if (!vector) continue;

    // Find insights with negative/low similarity (potential contradictions)
    const [negativeResults, lowSimilarityResults] = await Promise.all([
      findNegativelySimilarInsights(vector, userId, insight.id, 3),
      findLowSimilarityInsights(vector, userId, insight.id, 5),
    ]);

    const candidates = [...negativeResults, ...lowSimilarityResults];

    for (const candidate of candidates) {
      const candidateId = candidate.payload?.insight_id as string;
      if (!candidateId) continue;

      // Avoid checking the same pair twice
      const pairKey = [insight.id, candidateId].sort().join('-');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Find the candidate insight in our fetched data
      const candidateInsight = insights.find(i => i.id === candidateId);
      if (!candidateInsight) continue;

      // Analyze if this is a real contradiction
      const analysis = await analyzeContradiction(insight, candidateInsight, candidate.score);

      if (analysis.isContradiction && analysis.confidence > 0.6) {
        contradictions.push({
          insight1: {
            id: insight.id,
            text: insight.insight_text,
            type: insight.insight_type,
            confidence: insight.confidence_score || 0.5,
          },
          insight2: {
            id: candidateId,
            text: candidateInsight.insight_text,
            type: candidateInsight.insight_type,
            confidence: candidateInsight.confidence_score || 0.5,
          },
          contradictionScore: analysis.confidence,
          explanation: analysis.explanation,
          resolution: analysis.resolution,
        });
      }
    }
  }

  // Sort by contradiction score (most likely contradictions first)
  return contradictions.sort((a, b) => b.contradictionScore - a.contradictionScore);
}

async function resolveContradiction(
  userId: string,
  insight1Id: string,
  insight2Id: string,
  resolution: 'keep_both' | 'keep_first' | 'keep_second' | 'merge'
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  switch (resolution) {
    case 'keep_first':
      // Reduce confidence of second insight significantly
      await supabase
        .from('user_insights')
        .update({ 
          confidence_score: 0.1, 
          decay_factor: 0.2,
          updated_at: new Date().toISOString()
        })
        .eq('id', insight2Id)
        .eq('user_id', userId);
      return { success: true, message: 'Kept first insight, demoted second' };

    case 'keep_second':
      // Reduce confidence of first insight significantly
      await supabase
        .from('user_insights')
        .update({ 
          confidence_score: 0.1, 
          decay_factor: 0.2,
          updated_at: new Date().toISOString()
        })
        .eq('id', insight1Id)
        .eq('user_id', userId);
      return { success: true, message: 'Kept second insight, demoted first' };

    case 'keep_both':
      // Mark both as reviewed but potentially contextual
      // Just acknowledge the contradiction exists
      return { success: true, message: 'Both insights kept - contradiction noted' };

    case 'merge':
      // Fetch both insights and create a merged version
      const { data: insights } = await supabase
        .from('user_insights')
        .select('*')
        .in('id', [insight1Id, insight2Id])
        .eq('user_id', userId);

      if (insights && insights.length === 2) {
        // Generate merged insight using AI
        const mergePrompt = `Merge these two contradicting insights into a more nuanced understanding:

Insight 1: "${insights[0].insight_text}"
Insight 2: "${insights[1].insight_text}"

Create a single insight that acknowledges both perspectives and provides a more complete understanding.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a mental wellness expert. Provide a single, concise merged insight.' },
              { role: 'user', content: mergePrompt }
            ],
            temperature: 0.4,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const mergedText = data.choices?.[0]?.message?.content;

          if (mergedText) {
            // Create new merged insight
            await supabase.from('user_insights').insert({
              user_id: userId,
              insight_type: 'merged_insight',
              insight_text: mergedText,
              confidence_score: Math.max(insights[0].confidence_score || 0.5, insights[1].confidence_score || 0.5),
              decay_factor: 1.0,
              evidence_ids: [...(insights[0].evidence_ids || []), ...(insights[1].evidence_ids || [])],
            });

            // Demote original insights
            await supabase
              .from('user_insights')
              .update({ confidence_score: 0.2, decay_factor: 0.3 })
              .in('id', [insight1Id, insight2Id])
              .eq('user_id', userId);

            return { success: true, message: 'Created merged insight from both perspectives' };
          }
        }
      }
      return { success: false, message: 'Failed to merge insights' };

    default:
      return { success: false, message: 'Unknown resolution type' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, userId, insight1Id, insight2Id, resolution } = await req.json();

    console.log(`Contradiction detection: ${operation} for user ${userId}`);

    let result;

    switch (operation) {
      case 'detect':
        result = await detectContradictions(userId);
        break;

      case 'resolve':
        if (!insight1Id || !insight2Id || !resolution) {
          throw new Error('Missing required parameters for resolution');
        }
        result = await resolveContradiction(userId, insight1Id, insight2Id, resolution);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Contradiction detection error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
