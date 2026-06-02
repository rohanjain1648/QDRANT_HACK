import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface PatternRequest {
  userId: string;
  timeRange?: 'week' | 'month' | 'quarter';
}

interface MoodEntry {
  id: string;
  mood_level: string;
  mood_score: number;
  journal_text: string | null;
  context: Record<string, unknown> | null;
  tags: string[] | null;
  created_at: string;
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
    const errorText = await response.text();
    console.error('Embedding API error:', response.status, errorText);
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchQdrantPatterns(collection: string, vector: number[], userId: string, limit: number = 20) {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      vector,
      limit,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
      },
      with_payload: true,
    }),
  });

  if (!response.ok) {
    console.error('Qdrant search failed:', response.status);
    return { result: [] };
  }

  return response.json();
}

async function searchSimilarPatterns(collection: string, vector: number[], userId: string, limit: number = 5) {
  // Search for historically similar mood patterns in user_insights collection
  const response = await fetch(`${QDRANT_URL}/collections/user_insights/points/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      vector,
      limit,
      filter: {
        must: [
          { key: 'user_id', match: { value: userId } },
          { key: 'insight_type', match: { value: 'pattern' } },
        ],
      },
      with_payload: true,
    }),
  });

  if (!response.ok) {
    return { result: [] };
  }

  return response.json();
}

async function storePatternInQdrant(patternId: string, embedding: number[], payload: Record<string, unknown>) {
  // Ensure collection exists
  try {
    const checkResponse = await fetch(`${QDRANT_URL}/collections/user_insights`, {
      method: 'GET',
      headers: { 'api-key': QDRANT_API_KEY! },
    });
    
    if (!checkResponse.ok) {
      await fetch(`${QDRANT_URL}/collections/user_insights`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'api-key': QDRANT_API_KEY!,
        },
        body: JSON.stringify({
          vectors: { size: 1536, distance: 'Cosine' },
        }),
      });
    }
  } catch (e) {
    console.log('Collection check error, attempting creation:', e);
  }

  const response = await fetch(`${QDRANT_URL}/collections/user_insights/points`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      points: [{ id: patternId, vector: embedding, payload }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to store pattern in Qdrant:', errorText);
  }

  return response.ok;
}

async function generatePatternInsight(
  moodEntries: MoodEntry[],
  historicalPatterns: Array<{ payload: Record<string, unknown>; score: number }>,
  therapySessions: Array<{ payload: Record<string, unknown>; score: number }>
): Promise<{ insight: string; recommendations: string[]; patternType: string; confidence: number }> {
  
  const moodSummary = moodEntries.map(e => ({
    level: e.mood_level,
    score: e.mood_score,
    text: e.journal_text?.slice(0, 100),
    tags: e.tags,
    date: e.created_at,
  }));

  const historicalContext = historicalPatterns.map(p => ({
    pattern: p.payload.pattern_summary,
    similarity: p.score,
    outcome: p.payload.outcome,
  }));

  const activityContext = therapySessions.map(s => ({
    activity: s.payload.activity_name,
    type: s.payload.session_type,
    moodChange: s.payload.mood_change,
    similarity: s.score,
  }));

  const prompt = `Analyze this user's mood patterns and provide personalized insights.

CURRENT WEEK'S MOOD DATA:
${JSON.stringify(moodSummary, null, 2)}

SIMILAR HISTORICAL PATTERNS (from Qdrant semantic search):
${JSON.stringify(historicalContext, null, 2)}

RELATED THERAPY ACTIVITIES THAT HELPED:
${JSON.stringify(activityContext, null, 2)}

Based on semantic similarity matching of past patterns and activities, provide:
1. A concise pattern analysis (2-3 sentences) identifying trends
2. 3 specific, actionable recommendations based on what worked before
3. Pattern type classification (improving, declining, stable, fluctuating)
4. Confidence score (0.0-1.0) based on data quality and pattern clarity

Respond in JSON format:
{
  "insight": "pattern analysis text",
  "recommendations": ["rec1", "rec2", "rec3"],
  "patternType": "type",
  "confidence": 0.8
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { 
          role: 'system', 
          content: 'You are an empathetic mental wellness analyst. Use the Qdrant-retrieved historical patterns to ground your insights in the user\'s actual history. Always be supportive and actionable.' 
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    console.error('AI insight generation failed:', response.status);
    return {
      insight: 'Unable to generate pattern insight at this time.',
      recommendations: ['Continue tracking your mood daily', 'Try a breathing exercise', 'Consider journaling'],
      patternType: 'unknown',
      confidence: 0.0,
    };
  }

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      insight: data.choices[0].message.content,
      recommendations: ['Continue your wellness journey'],
      patternType: 'stable',
      confidence: 0.5,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, timeRange = 'week' } = await req.json() as PatternRequest;

    if (!userId) {
      throw new Error('Missing required field: userId');
    }

    console.log(`Pattern detection - User: ${userId}, Range: ${timeRange}`);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Calculate date range
    const now = new Date();
    const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Fetch mood entries from Supabase
    const { data: moodEntries, error: moodError } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (moodError) {
      console.error('Failed to fetch mood entries:', moodError);
      throw new Error('Failed to fetch mood data');
    }

    if (!moodEntries || moodEntries.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        pattern: {
          insight: 'Start tracking your mood to see patterns emerge over time.',
          recommendations: ['Log your first mood entry', 'Try a breathing exercise', 'Explore yoga poses'],
          patternType: 'insufficient_data',
          confidence: 0,
          weeklyStats: null,
          qdrantMatches: 0,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a summary embedding for the current period's mood pattern
    const patternSummary = `User mood pattern over ${timeRange}: ${moodEntries.map(e => 
      `${e.mood_level} (${e.mood_score}/10) - ${e.journal_text?.slice(0, 50) || 'no notes'}`
    ).join('; ')}`;
    
    console.log('Generating pattern embedding for Qdrant search...');
    const patternEmbedding = await generateEmbedding(patternSummary);

    // Search Qdrant for similar historical patterns
    console.log('Searching Qdrant for similar historical patterns...');
    const historicalPatterns = await searchSimilarPatterns('user_insights', patternEmbedding, userId, 5);
    
    // Search Qdrant for related therapy sessions that helped
    console.log('Searching Qdrant for related therapy sessions...');
    const relatedSessions = await searchQdrantPatterns('therapy_sessions', patternEmbedding, userId, 10);

    // Search Qdrant for mood memories with similar emotional context
    console.log('Searching Qdrant for similar mood contexts...');
    const similarMoods = await searchQdrantPatterns('mood_memories', patternEmbedding, userId, 15);

    // Calculate weekly statistics
    const moodScores = moodEntries.map(e => e.mood_score);
    const avgMood = moodScores.reduce((a, b) => a + b, 0) / moodScores.length;
    const moodTrend = moodScores.length > 1 
      ? (moodScores[0] - moodScores[moodScores.length - 1]) 
      : 0;
    
    const moodLevelCounts: Record<string, number> = {};
    moodEntries.forEach(e => {
      moodLevelCounts[e.mood_level] = (moodLevelCounts[e.mood_level] || 0) + 1;
    });
    const dominantMood = Object.entries(moodLevelCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    // Tag frequency analysis
    const tagCounts: Record<string, number> = {};
    moodEntries.forEach(e => {
      e.tags?.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    // Generate AI insight using all Qdrant-retrieved context
    console.log('Generating AI insight with Qdrant context...');
    const aiInsight = await generatePatternInsight(
      moodEntries as MoodEntry[],
      historicalPatterns.result || [],
      relatedSessions.result || []
    );

    // Store this pattern insight in Qdrant for future retrieval
    const patternId = crypto.randomUUID();
    const patternPayload = {
      user_id: userId,
      insight_type: 'pattern',
      pattern_summary: aiInsight.insight,
      pattern_type: aiInsight.patternType,
      confidence: aiInsight.confidence,
      recommendations: aiInsight.recommendations,
      weekly_avg: avgMood,
      mood_trend: moodTrend,
      dominant_mood: dominantMood,
      top_tags: topTags,
      entries_analyzed: moodEntries.length,
      time_range: timeRange,
      created_at: new Date().toISOString(),
      outcome: null, // Will be updated when we see if recommendations helped
    };

    console.log('Storing pattern insight in Qdrant for future learning...');
    await storePatternInQdrant(patternId, patternEmbedding, patternPayload);

    // Also store in Supabase for relational queries
    await supabase.from('user_insights').insert([{
      user_id: userId,
      insight_type: 'weekly_pattern',
      insight_text: aiInsight.insight,
      confidence_score: aiInsight.confidence,
      qdrant_point_id: patternId,
      evidence_ids: moodEntries.map(e => e.id),
    }]);

    const totalQdrantMatches = 
      (historicalPatterns.result?.length || 0) + 
      (relatedSessions.result?.length || 0) + 
      (similarMoods.result?.length || 0);

    console.log(`Pattern detection complete. Qdrant matches: ${totalQdrantMatches}`);

    return new Response(JSON.stringify({
      success: true,
      pattern: {
        ...aiInsight,
        weeklyStats: {
          averageMood: Math.round(avgMood * 10) / 10,
          moodTrend: moodTrend > 0 ? 'improving' : moodTrend < 0 ? 'declining' : 'stable',
          trendValue: Math.round(moodTrend * 10) / 10,
          dominantMood,
          entriesCount: moodEntries.length,
          topTags,
          moodDistribution: moodLevelCounts,
        },
        qdrantContext: {
          historicalPatternsFound: historicalPatterns.result?.length || 0,
          relatedSessionsFound: relatedSessions.result?.length || 0,
          similarMoodsFound: similarMoods.result?.length || 0,
          totalMatches: totalQdrantMatches,
        },
        patternId,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Pattern detection error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
