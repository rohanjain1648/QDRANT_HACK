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

interface MemorySearchRequest {
  query: string;
  userId: string;
  collection: 'mood_memories' | 'therapy_sessions' | 'wellness_activities' | 'user_insights';
  limit?: number;
  filter?: {
    mood_level?: string;
    activity_type?: string;
    date_range?: { start: string; end: string };
  };
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

async function searchQdrant(collection: string, vector: number[], limit: number, filter?: Record<string, unknown>) {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      vector,
      limit,
      filter,
      with_payload: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Qdrant search error:', response.status, errorText);
    throw new Error(`Qdrant search failed: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userId, collection, limit = 10, filter } = await req.json() as MemorySearchRequest;

    if (!query || !userId || !collection) {
      throw new Error('Missing required fields: query, userId, collection');
    }

    console.log(`Memory search - Collection: ${collection}, Query: "${query.slice(0, 50)}...", User: ${userId}`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Build Qdrant filter
    const qdrantFilter: Record<string, unknown> = {
      must: [
        { key: 'user_id', match: { value: userId } },
      ],
    };

    if (filter?.mood_level) {
      (qdrantFilter.must as unknown[]).push({
        key: 'mood_level',
        match: { value: filter.mood_level },
      });
    }

    if (filter?.activity_type) {
      (qdrantFilter.must as unknown[]).push({
        key: 'activity_type',
        match: { value: filter.activity_type },
      });
    }

    // Search Qdrant
    const searchResult = await searchQdrant(collection, queryEmbedding, limit, qdrantFilter);

    // Format results with traceable reasoning
    const results = searchResult.result.map((point: { id: string; score: number; payload: Record<string, unknown> }) => ({
      id: point.id,
      score: point.score,
      payload: point.payload,
      reasoning: `Matched with ${(point.score * 100).toFixed(1)}% relevance based on semantic similarity`,
    }));

    console.log(`Found ${results.length} relevant memories`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      query,
      collection,
      total: results.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Memory search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
