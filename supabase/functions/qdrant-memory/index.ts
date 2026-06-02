import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface SearchRequest {
  collection: string;
  vector: number[];
  limit?: number;
  filter?: Record<string, unknown>;
  with_payload?: boolean;
}

interface UpsertRequest {
  collection: string;
  points: QdrantPoint[];
}

interface DeleteRequest {
  collection: string;
  ids: string[];
}

interface HybridSearchRequest {
  collection: string;
  vector: number[];
  limit?: number;
  filter?: Record<string, unknown>;
  score_threshold?: number;
}

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');

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
    throw new Error(`Qdrant request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function ensureCollection(name: string, vectorSize: number = 768) {
  try {
    // Check if collection exists
    await qdrantRequest(`/collections/${name}`, 'GET');
    console.log(`Collection ${name} already exists`);
  } catch {
    // Create collection if it doesn't exist
    console.log(`Creating collection ${name}`);
    await qdrantRequest('/collections/' + name, 'PUT', {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    });
  }
}

async function searchPoints(request: SearchRequest) {
  return qdrantRequest(`/collections/${request.collection}/points/search`, 'POST', {
    vector: request.vector,
    limit: request.limit || 10,
    filter: request.filter,
    with_payload: request.with_payload ?? true,
  });
}

async function hybridSearch(request: HybridSearchRequest) {
  // Qdrant hybrid search with filtering
  return qdrantRequest(`/collections/${request.collection}/points/search`, 'POST', {
    vector: request.vector,
    limit: request.limit || 10,
    filter: request.filter,
    with_payload: true,
    score_threshold: request.score_threshold || 0.5,
  });
}

async function upsertPoints(request: UpsertRequest) {
  return qdrantRequest(`/collections/${request.collection}/points`, 'PUT', {
    points: request.points,
  });
}

async function deletePoints(request: DeleteRequest) {
  return qdrantRequest(`/collections/${request.collection}/points/delete`, 'POST', {
    points: request.ids,
  });
}

async function updatePayload(collection: string, pointId: string, payload: Record<string, unknown>) {
  return qdrantRequest(`/collections/${collection}/points/payload`, 'POST', {
    points: [pointId],
    payload,
  });
}

async function getCollectionInfo(collection: string) {
  return qdrantRequest(`/collections/${collection}`, 'GET');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, ...params } = await req.json();

    console.log(`Qdrant operation: ${operation}`, JSON.stringify(params).slice(0, 200));

    let result;

    switch (operation) {
      case 'ensure_collection':
        result = await ensureCollection(params.collection, params.vectorSize);
        break;

      case 'search':
        result = await searchPoints(params as SearchRequest);
        break;

      case 'hybrid_search':
        result = await hybridSearch(params as HybridSearchRequest);
        break;

      case 'upsert':
        result = await upsertPoints(params as UpsertRequest);
        break;

      case 'delete':
        result = await deletePoints(params as DeleteRequest);
        break;

      case 'update_payload':
        result = await updatePayload(params.collection, params.pointId, params.payload);
        break;

      case 'collection_info':
        result = await getCollectionInfo(params.collection);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Qdrant memory error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
