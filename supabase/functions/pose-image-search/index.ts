import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const COLLECTION_NAME = 'yoga_pose_images';
const VECTOR_SIZE = 1536;

interface SearchRequest {
  mode: 'upload' | 'text' | 'similar';
  image?: string; // Base64 image for upload search
  text?: string; // Text description for text-to-image search
  poseId?: string; // For finding similar poses
  limit?: number;
}

interface IndexRequest {
  poseId: string;
  poseName: string;
  sanskritName: string;
  category: string;
  difficulty: number;
  benefits: string[];
  imageData?: string; // Optional image
  description: string;
}

// Generate embedding from text
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const result = await response.json();
  return result.data?.[0]?.embedding || [];
}

// Analyze image and generate semantic description
async function analyzeImage(imageData: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `Analyze this yoga pose image and describe it for semantic matching. Focus on:
- Body position and posture type (standing, seated, balancing, inversion, backbend, twist, forward fold)
- Limb positions (arms raised, legs apart, etc.)
- Spine alignment (straight, arched, twisted)
- Balance and weight distribution
- Key visual characteristics
Provide a comprehensive description in 2-3 sentences.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageData }
            },
            {
              type: 'text',
              text: 'Describe this yoga pose for similarity matching.'
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Image analysis failed: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

// Qdrant operations
async function qdrantRequest(path: string, method: string, body?: unknown) {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qdrant request failed: ${response.status} - ${text}`);
  }

  return response.json();
}

async function ensureCollection() {
  try {
    await qdrantRequest(`/collections/${COLLECTION_NAME}`, 'GET');
  } catch {
    await qdrantRequest('/collections/' + COLLECTION_NAME, 'PUT', {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
    });
    console.log('Created yoga_pose_images collection');
  }
}

async function searchSimilar(vector: number[], limit: number, filter?: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    vector,
    limit,
    with_payload: true,
    score_threshold: 0.5,
  };

  if (filter) {
    body.filter = filter;
  }

  return qdrantRequest(`/collections/${COLLECTION_NAME}/points/search`, 'POST', body);
}

async function upsertPoint(id: string, vector: number[], payload: Record<string, unknown>) {
  return qdrantRequest(`/collections/${COLLECTION_NAME}/points`, 'PUT', {
    points: [
      {
        id,
        vector,
        payload,
      },
    ],
  });
}

async function getPointsByPoseId(poseId: string) {
  return qdrantRequest(`/collections/${COLLECTION_NAME}/points/scroll`, 'POST', {
    filter: {
      must: [{ key: 'poseId', match: { value: poseId } }],
    },
    with_payload: true,
    with_vector: true,
    limit: 1,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!QDRANT_URL || !QDRANT_API_KEY || !LOVABLE_API_KEY) {
      throw new Error('Required environment variables not configured');
    }

    const body = await req.json();
    const { action } = body;

    await ensureCollection();

    if (action === 'index') {
      // Index a yoga pose with its description
      const { poseId, poseName, sanskritName, category, difficulty, benefits, imageData, description } = body as IndexRequest;

      let semanticDescription = description;
      
      // If image is provided, analyze it for additional context
      if (imageData) {
        const imageAnalysis = await analyzeImage(imageData);
        semanticDescription = `${description} Visual: ${imageAnalysis}`;
      }

      // Generate embedding
      const embedding = await generateEmbedding(semanticDescription);

      // Store in Qdrant
      await upsertPoint(poseId, embedding, {
        poseId,
        poseName,
        sanskritName,
        category,
        difficulty,
        benefits,
        description: semanticDescription,
        hasImage: !!imageData,
        indexedAt: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, poseId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'search') {
      const { mode, image, text, poseId, limit = 5 } = body as SearchRequest;

      let searchVector: number[];
      let searchDescription = '';

      if (mode === 'upload' && image) {
        // Analyze uploaded image and search
        searchDescription = await analyzeImage(image);
        searchVector = await generateEmbedding(searchDescription);
      } else if (mode === 'text' && text) {
        // Text-based search
        searchDescription = text;
        searchVector = await generateEmbedding(text);
      } else if (mode === 'similar' && poseId) {
        // Find poses similar to a specific pose
        const existing = await getPointsByPoseId(poseId);
        if (!existing.result?.points?.length) {
          throw new Error('Pose not found in index');
        }
        searchVector = existing.result.points[0].vector;
        searchDescription = existing.result.points[0].payload.description;
      } else {
        throw new Error('Invalid search parameters');
      }

      // Search Qdrant
      const results = await searchSimilar(searchVector, limit);

      return new Response(
        JSON.stringify({
          success: true,
          query: searchDescription,
          results: results.result.map((r: { id: string; score: number; payload: Record<string, unknown> }) => ({
            poseId: r.payload.poseId,
            poseName: r.payload.poseName,
            sanskritName: r.payload.sanskritName,
            category: r.payload.category,
            difficulty: r.payload.difficulty,
            benefits: r.payload.benefits,
            score: r.score,
            matchReason: `${Math.round(r.score * 100)}% visual/semantic similarity`,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'index-all') {
      // Batch index all provided poses
      const { poses } = body as { poses: IndexRequest[] };
      const results = [];

      for (const pose of poses) {
        const embedding = await generateEmbedding(pose.description);
        await upsertPoint(pose.poseId, embedding, {
          poseId: pose.poseId,
          poseName: pose.poseName,
          sanskritName: pose.sanskritName,
          category: pose.category,
          difficulty: pose.difficulty,
          benefits: pose.benefits,
          description: pose.description,
          hasImage: false,
          indexedAt: new Date().toISOString(),
        });
        results.push({ poseId: pose.poseId, success: true });
      }

      return new Response(
        JSON.stringify({ success: true, indexed: results.length, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Unknown action');
  } catch (error) {
    console.error('Pose image search error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
