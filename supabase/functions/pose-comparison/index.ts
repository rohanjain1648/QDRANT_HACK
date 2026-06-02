import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const COLLECTION_NAME = 'pose_session_snapshots';
const VECTOR_SIZE = 1536;

interface StoreSnapshotRequest {
  action: 'store';
  userId: string;
  sessionId: string;
  poseId: string;
  poseName: string;
  imageData: string; // Base64 image
  accuracy: number;
  keypoints: Array<{ x: number; y: number; score: number; name: string }>;
  timestamp: number;
}

interface CompareRequest {
  action: 'compare';
  userId: string;
  poseId: string;
  currentImage: string; // Base64 of current pose attempt
  limit?: number;
}

interface GetHistoryRequest {
  action: 'history';
  userId: string;
  poseId?: string;
  limit?: number;
}

// Analyze pose image and generate semantic description
async function analyzePoseImage(imageData: string): Promise<{
  description: string;
  alignment: string;
  formQuality: string;
  keyObservations: string[];
}> {
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
          content: `You are an expert yoga instructor analyzing pose form. Provide detailed analysis focusing on:
- Body alignment and posture
- Limb positioning accuracy
- Balance and stability indicators
- Form quality assessment

Return a JSON object:
{
  "description": "Detailed pose description for embedding",
  "alignment": "Assessment of body alignment",
  "formQuality": "excellent|good|needs_improvement|poor",
  "keyObservations": ["observation1", "observation2", ...]
}`
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageData } },
            { type: 'text', text: 'Analyze this yoga pose attempt for form and alignment.' }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Image analysis failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse pose analysis:', e);
  }

  return {
    description: content,
    alignment: 'unknown',
    formQuality: 'unknown',
    keyObservations: [],
  };
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
    console.log('Created pose_session_snapshots collection');
  }
}

async function searchSimilar(vector: number[], userId: string, poseId: string, limit: number) {
  return qdrantRequest(`/collections/${COLLECTION_NAME}/points/search`, 'POST', {
    vector,
    limit,
    with_payload: true,
    score_threshold: 0.6,
    filter: {
      must: [
        { key: 'userId', match: { value: userId } },
        { key: 'poseId', match: { value: poseId } },
      ],
    },
  });
}

async function getHistory(userId: string, poseId: string | null, limit: number) {
  const filter: Record<string, unknown> = {
    must: [{ key: 'userId', match: { value: userId } }],
  };
  
  if (poseId) {
    (filter.must as unknown[]).push({ key: 'poseId', match: { value: poseId } });
  }

  return qdrantRequest(`/collections/${COLLECTION_NAME}/points/scroll`, 'POST', {
    filter,
    with_payload: true,
    limit,
    order_by: { key: 'timestamp', direction: 'desc' },
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

    if (action === 'store') {
      const { userId, sessionId, poseId, poseName, imageData, accuracy, keypoints, timestamp } = body as StoreSnapshotRequest;

      // Analyze the pose image
      const analysis = await analyzePoseImage(imageData);

      // Create rich description for embedding
      const embeddingText = `${poseName} pose attempt. ${analysis.description}. Alignment: ${analysis.alignment}. Form quality: ${analysis.formQuality}. Accuracy: ${accuracy}%. Key observations: ${analysis.keyObservations.join(', ')}`;

      // Generate embedding
      const embedding = await generateEmbedding(embeddingText);

      // Store in Qdrant
      const pointId = crypto.randomUUID();
      await qdrantRequest(`/collections/${COLLECTION_NAME}/points`, 'PUT', {
        points: [{
          id: pointId,
          vector: embedding,
          payload: {
            userId,
            sessionId,
            poseId,
            poseName,
            accuracy,
            formQuality: analysis.formQuality,
            alignment: analysis.alignment,
            observations: analysis.keyObservations,
            keypointsSummary: keypoints.length,
            timestamp,
            storedAt: new Date().toISOString(),
            // Store thumbnail reference (not full image to save space)
            hasImage: true,
          },
        }],
      });

      return new Response(
        JSON.stringify({
          success: true,
          pointId,
          analysis,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'compare') {
      const { userId, poseId, currentImage, limit = 5 } = body as CompareRequest;

      // Analyze current pose
      const currentAnalysis = await analyzePoseImage(currentImage);

      // Generate embedding for current pose
      const embeddingText = `Pose attempt. ${currentAnalysis.description}. Alignment: ${currentAnalysis.alignment}. Form: ${currentAnalysis.formQuality}. Observations: ${currentAnalysis.keyObservations.join(', ')}`;
      const embedding = await generateEmbedding(embeddingText);

      // Search for similar historical attempts
      const results = await searchSimilar(embedding, userId, poseId, limit);

      // Generate comparison insights
      const comparisons = results.result.map((r: { id: string; score: number; payload: Record<string, unknown> }) => ({
        pointId: r.id,
        similarity: Math.round(r.score * 100),
        historicalAccuracy: r.payload.accuracy,
        historicalFormQuality: r.payload.formQuality,
        historicalAlignment: r.payload.alignment,
        historicalObservations: r.payload.observations,
        timestamp: r.payload.timestamp,
        sessionId: r.payload.sessionId,
        comparison: generateComparisonInsight(currentAnalysis, r.payload),
      }));

      // Calculate improvement trend
      const historicalAccuracies = results.result.map((r: { payload: { accuracy: number } }) => r.payload.accuracy as number);
      const avgHistorical = historicalAccuracies.length > 0 
        ? historicalAccuracies.reduce((a: number, b: number) => a + b, 0) / historicalAccuracies.length 
        : 0;

      return new Response(
        JSON.stringify({
          success: true,
          currentAnalysis,
          comparisons,
          stats: {
            totalHistoricalSessions: results.result.length,
            averageHistoricalAccuracy: Math.round(avgHistorical),
            formQualityDistribution: countFormQualities(results.result),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'history') {
      const { userId, poseId, limit = 20 } = body as GetHistoryRequest;

      const results = await getHistory(userId, poseId || null, limit);

      return new Response(
        JSON.stringify({
          success: true,
          history: results.result?.points?.map((p: { id: string; payload: Record<string, unknown> }) => ({
            pointId: p.id,
            ...p.payload,
          })) || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Unknown action');
  } catch (error) {
    console.error('Pose comparison error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateComparisonInsight(
  current: { formQuality: string; alignment: string; keyObservations: string[] },
  historical: Record<string, unknown>
): string {
  const formMap: Record<string, number> = { excellent: 4, good: 3, needs_improvement: 2, poor: 1, unknown: 0 };
  const currentScore = formMap[current.formQuality] || 0;
  const historicalScore = formMap[historical.formQuality as string] || 0;

  if (currentScore > historicalScore) {
    return `Improved form compared to this session. Your ${current.formQuality} form shows progress from ${historical.formQuality}.`;
  } else if (currentScore < historicalScore) {
    return `This historical session had better form (${historical.formQuality}). Focus on: ${(historical.observations as string[])?.slice(0, 2).join(', ') || 'alignment'}.`;
  } else {
    return `Similar form quality to this session. Both attempts rated as ${current.formQuality}.`;
  }
}

function countFormQualities(results: Array<{ payload: { formQuality: unknown } }>): Record<string, number> {
  const counts: Record<string, number> = { excellent: 0, good: 0, needs_improvement: 0, poor: 0 };
  for (const r of results) {
    const quality = r.payload.formQuality as string;
    if (quality in counts) {
      counts[quality]++;
    }
  }
  return counts;
}
