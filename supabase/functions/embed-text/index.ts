import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

async function generateEmbedding(text: string): Promise<number[]> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  // Use Gemini for text embedding via the Lovable AI gateway
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

async function generateMultipleEmbeddings(texts: string[]): Promise<number[][]> {
  // Generate embeddings in parallel for efficiency
  const embeddings = await Promise.all(texts.map(text => generateEmbedding(text)));
  return embeddings;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, texts } = await req.json();

    if (texts && Array.isArray(texts)) {
      // Batch embedding
      console.log(`Generating embeddings for ${texts.length} texts`);
      const embeddings = await generateMultipleEmbeddings(texts);
      return new Response(JSON.stringify({ success: true, embeddings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (text) {
      // Single embedding
      console.log(`Generating embedding for text: ${text.slice(0, 100)}...`);
      const embedding = await generateEmbedding(text);
      return new Response(JSON.stringify({ success: true, embedding }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error('No text or texts provided');
    }
  } catch (error) {
    console.error('Embed text error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
