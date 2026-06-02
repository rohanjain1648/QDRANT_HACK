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

interface JournalSearchRequest {
  query: string;
  userId: string;
  limit?: number;
  moodFilter?: string;
  dateRange?: { start: string; end: string };
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

async function searchQdrantJournals(vector: number[], userId: string, limit: number, moodFilter?: string) {
  const mustConditions: Array<Record<string, unknown>> = [
    { key: 'user_id', match: { value: userId } },
    { key: 'has_journal', match: { value: true } },
  ];

  if (moodFilter) {
    mustConditions.push({ key: 'mood_level', match: { value: moodFilter } });
  }

  const response = await fetch(`${QDRANT_URL}/collections/mood_memories/points/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      vector,
      limit,
      filter: { must: mustConditions },
      with_payload: true,
    }),
  });

  if (!response.ok) {
    console.error('Qdrant search failed:', response.status);
    return { result: [] };
  }

  return response.json();
}

async function generateSearchSummary(query: string, results: Array<{ payload: Record<string, unknown>; score: number }>) {
  if (results.length === 0) return null;

  const journalExcerpts = results.slice(0, 5).map((r, i) => ({
    excerpt: (r.payload.text_preview as string)?.slice(0, 150),
    mood: r.payload.mood_level,
    date: r.payload.created_at,
    relevance: `${(r.score * 100).toFixed(0)}%`,
  }));

  const prompt = `Based on this semantic search through a user's mood journal, provide a brief, empathetic summary.

SEARCH QUERY: "${query}"

RELEVANT JOURNAL ENTRIES FOUND:
${JSON.stringify(journalExcerpts, null, 2)}

Provide a 2-3 sentence summary that:
1. Identifies common themes across matching entries
2. Notes any patterns in mood or context
3. Offers a supportive observation

Keep it warm and insightful. Respond with just the summary text.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'You are a supportive wellness companion analyzing journal entries.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error('AI summary failed:', response.status);
    return null;
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userId, limit = 20, moodFilter, dateRange } = await req.json() as JournalSearchRequest;

    if (!query || !userId) {
      throw new Error('Missing required fields: query, userId');
    }

    console.log(`Journal search - Query: "${query.slice(0, 50)}...", User: ${userId}`);

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Search Qdrant for semantically similar journal entries
    const qdrantResults = await searchQdrantJournals(queryEmbedding, userId, limit, moodFilter);

    // Also fetch from Supabase for complete journal data
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    let supabaseQuery = supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .not('journal_text', 'is', null)
      .order('created_at', { ascending: false });

    if (dateRange?.start) {
      supabaseQuery = supabaseQuery.gte('created_at', dateRange.start);
    }
    if (dateRange?.end) {
      supabaseQuery = supabaseQuery.lte('created_at', dateRange.end);
    }
    if (moodFilter) {
      supabaseQuery = supabaseQuery.eq('mood_level', moodFilter);
    }

    const { data: allJournals } = await supabaseQuery.limit(100);

    // Merge Qdrant semantic results with full Supabase data
    const qdrantIds = new Set(qdrantResults.result?.map((r: { payload: { record_id: string } }) => r.payload.record_id) || []);
    const qdrantScores = new Map(
      qdrantResults.result?.map((r: { payload: { record_id: string }; score: number }) => [r.payload.record_id, r.score]) || []
    );

    // Prioritize Qdrant results but include all matching journals
    const semanticResults = (allJournals || [])
      .filter(j => qdrantIds.has(j.id))
      .map(j => ({
        ...j,
        semanticScore: qdrantScores.get(j.id) || 0,
        isSemanticMatch: true,
      }))
      .sort((a, b) => b.semanticScore - a.semanticScore);

    // Generate AI summary of search results
    const summary = await generateSearchSummary(query, qdrantResults.result || []);

    console.log(`Found ${semanticResults.length} semantic matches, ${qdrantResults.result?.length || 0} Qdrant results`);

    return new Response(JSON.stringify({
      success: true,
      results: semanticResults,
      totalQdrantMatches: qdrantResults.result?.length || 0,
      summary,
      query,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Journal search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
