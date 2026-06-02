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

interface StoreMemoryRequest {
  collection: 'mood_memories' | 'therapy_sessions' | 'wellness_activities' | 'user_insights';
  text: string;
  metadata: Record<string, unknown>;
  userId: string;
  recordId: string;
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

async function ensureCollection(name: string, vectorSize: number = 1536) {
  try {
    await fetch(`${QDRANT_URL}/collections/${name}`, {
      method: 'GET',
      headers: { 'api-key': QDRANT_API_KEY! },
    });
    console.log(`Collection ${name} exists`);
  } catch {
    console.log(`Creating collection ${name}`);
    await fetch(`${QDRANT_URL}/collections/${name}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'api-key': QDRANT_API_KEY!,
      },
      body: JSON.stringify({
        vectors: { size: vectorSize, distance: 'Cosine' },
      }),
    });
  }
}

async function upsertPoint(collection: string, id: string, vector: number[], payload: Record<string, unknown>) {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      points: [{ id, vector, payload }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Qdrant upsert error:', response.status, errorText);
    throw new Error(`Qdrant upsert failed: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { collection, text, metadata, userId, recordId } = await req.json() as StoreMemoryRequest;

    if (!collection || !text || !userId || !recordId) {
      throw new Error('Missing required fields: collection, text, userId, recordId');
    }

    console.log(`Storing memory - Collection: ${collection}, Record: ${recordId}, Text: "${text.slice(0, 50)}..."`);

    // Ensure collection exists
    await ensureCollection(collection);

    // Generate embedding
    const embedding = await generateEmbedding(text);

    // Build payload with all metadata plus user_id
    const payload = {
      ...metadata,
      user_id: userId,
      record_id: recordId,
      text_preview: text.slice(0, 200),
      stored_at: new Date().toISOString(),
    };

    // Store in Qdrant
    await upsertPoint(collection, recordId, embedding, payload);

    // Update the database record with the Qdrant point ID
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Determine which table to update based on collection
    const tableMap: Record<string, string> = {
      mood_memories: 'mood_entries',
      therapy_sessions: 'therapy_sessions',
      wellness_activities: 'wellness_activities',
      user_insights: 'user_insights',
    };

    const tableName = tableMap[collection];
    if (tableName) {
      await supabase
        .from(tableName)
        .update({ qdrant_point_id: recordId })
        .eq('id', recordId);
    }

    console.log(`Memory stored successfully: ${recordId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      pointId: recordId,
      collection,
      embeddingSize: embedding.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Store memory error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
