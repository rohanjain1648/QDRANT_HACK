import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface EvidencePoint {
  id: string;
  collection: string;
  score: number;
  payload: Record<string, unknown>;
  relevanceExplanation?: string;
}

interface ReasoningStep {
  step: number;
  action: string;
  collection?: string;
  query?: string;
  resultsCount?: number;
  topScore?: number;
}

interface EvidenceTrail {
  query: string;
  evidencePoints: EvidencePoint[];
  reasoningSteps: ReasoningStep[];
  finalOutput: string;
  confidence: number;
  groundedIn: string[];
}

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
    throw new Error(`Embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchWithEvidence(
  query: string,
  userId: string,
  collections: string[],
  limit: number = 5
): Promise<{ evidencePoints: EvidencePoint[]; reasoningSteps: ReasoningStep[] }> {
  const reasoningSteps: ReasoningStep[] = [];
  const evidencePoints: EvidencePoint[] = [];

  // Step 1: Generate query embedding
  reasoningSteps.push({
    step: 1,
    action: 'generate_embedding',
    query: query.slice(0, 100) + (query.length > 100 ? '...' : ''),
  });

  const queryVector = await generateEmbedding(query);

  // Step 2: Search each collection
  let stepNum = 2;
  for (const collection of collections) {
    reasoningSteps.push({
      step: stepNum,
      action: 'search_collection',
      collection,
    });

    try {
      const searchResult = await qdrantRequest(`/collections/${collection}/points/search`, 'POST', {
        vector: queryVector,
        filter: {
          must: [{ key: 'user_id', match: { value: userId } }],
        },
        limit,
        with_payload: true,
        score_threshold: 0.3,
      });

      const results = searchResult.result || [];
      
      reasoningSteps[reasoningSteps.length - 1].resultsCount = results.length;
      reasoningSteps[reasoningSteps.length - 1].topScore = results[0]?.score;

      for (const result of results) {
        evidencePoints.push({
          id: result.id,
          collection,
          score: result.score,
          payload: result.payload,
        });
      }
    } catch (e) {
      console.error(`Failed to search ${collection}:`, e);
      reasoningSteps[reasoningSteps.length - 1].resultsCount = 0;
    }

    stepNum++;
  }

  // Sort by score
  evidencePoints.sort((a, b) => b.score - a.score);

  return { evidencePoints, reasoningSteps };
}

async function generateGroundedResponse(
  query: string,
  evidencePoints: EvidencePoint[],
  responseType: 'recommendation' | 'analysis' | 'insight'
): Promise<{ output: string; confidence: number; groundedIn: string[]; explanations: Map<string, string> }> {
  
  const systemPrompts = {
    recommendation: `You are a wellness recommendation AI. Generate personalized recommendations ONLY based on the provided evidence. For each recommendation, cite which evidence point supports it using [Evidence #N]. Never make claims not supported by evidence.`,
    analysis: `You are a mood analysis AI. Analyze patterns ONLY based on the provided evidence. Cite specific evidence points using [Evidence #N] for each observation. Be precise about what the data shows.`,
    insight: `You are a wellness insight AI. Generate insights ONLY from the provided evidence. Each insight must reference specific evidence using [Evidence #N]. Avoid generalizations not supported by data.`,
  };

  // Format evidence for the prompt
  const evidenceContext = evidencePoints.slice(0, 10).map((ep, i) => 
    `[Evidence #${i + 1}] (${ep.collection}, relevance: ${(ep.score * 100).toFixed(0)}%): ${JSON.stringify(ep.payload).slice(0, 300)}`
  ).join('\n\n');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompts[responseType] },
        { 
          role: 'user', 
          content: `Query: ${query}\n\nAvailable Evidence:\n${evidenceContext}\n\nGenerate a ${responseType} grounded in this evidence. Cite evidence points.` 
        },
      ],
      max_tokens: 800,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI generation failed: ${response.status}`);
  }

  const data = await response.json();
  const output = data.choices[0]?.message?.content || '';

  // Extract which evidence points were cited
  const citedEvidence = new Set<string>();
  const citationRegex = /\[Evidence #(\d+)\]/g;
  let match;
  while ((match = citationRegex.exec(output)) !== null) {
    const idx = parseInt(match[1]) - 1;
    if (idx >= 0 && idx < evidencePoints.length) {
      citedEvidence.add(evidencePoints[idx].id);
    }
  }

  // Calculate confidence based on evidence quality
  const avgScore = evidencePoints.slice(0, 5).reduce((acc, ep) => acc + ep.score, 0) / Math.min(5, evidencePoints.length);
  const citationRate = citedEvidence.size / Math.min(5, evidencePoints.length);
  const confidence = (avgScore * 0.6) + (citationRate * 0.4);

  // Generate explanations for each evidence point
  const explanations = new Map<string, string>();
  evidencePoints.slice(0, 5).forEach((ep, i) => {
    if (ep.payload.text_preview || ep.payload.journal_text || ep.payload.insight_text) {
      const text = (ep.payload.text_preview || ep.payload.journal_text || ep.payload.insight_text) as string;
      explanations.set(ep.id, `This ${ep.collection.replace('_', ' ')} from ${ep.payload.created_at || 'unknown date'} relates because: "${text.slice(0, 100)}..."`);
    } else {
      explanations.set(ep.id, `Retrieved from ${ep.collection} with ${(ep.score * 100).toFixed(0)}% relevance`);
    }
  });

  return {
    output,
    confidence,
    groundedIn: Array.from(citedEvidence),
    explanations,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, query, userId, responseType, collections } = await req.json();

    console.log(`Evidence trail operation: ${operation}, query: ${query?.slice(0, 50)}`);

    if (operation === 'search_with_trail') {
      // Full evidence trail: search + grounded response
      const collectionsToSearch = collections || ['mood_memories', 'therapy_sessions', 'user_insights', 'wellness_activities'];
      
      const { evidencePoints, reasoningSteps } = await searchWithEvidence(
        query,
        userId,
        collectionsToSearch
      );

      if (evidencePoints.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            query,
            evidencePoints: [],
            reasoningSteps,
            finalOutput: 'No relevant memories found to base a response on.',
            confidence: 0,
            groundedIn: [],
          } as EvidenceTrail,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { output, confidence, groundedIn, explanations } = await generateGroundedResponse(
        query,
        evidencePoints,
        responseType || 'insight'
      );

      // Add relevance explanations to evidence points
      evidencePoints.forEach(ep => {
        ep.relevanceExplanation = explanations.get(ep.id);
      });

      reasoningSteps.push({
        step: reasoningSteps.length + 1,
        action: 'generate_grounded_response',
        resultsCount: groundedIn.length,
      });

      const trail: EvidenceTrail = {
        query,
        evidencePoints: evidencePoints.slice(0, 10),
        reasoningSteps,
        finalOutput: output,
        confidence,
        groundedIn,
      };

      return new Response(JSON.stringify({ success: true, data: trail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (operation === 'explain_evidence') {
      // Just explain how a specific evidence point relates
      const { evidenceId, collection } = await req.json();
      
      const result = await qdrantRequest(`/collections/${collection}/points/${evidenceId}`, 'GET');
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: evidenceId,
          collection,
          payload: result.result?.payload,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('Evidence trail error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
