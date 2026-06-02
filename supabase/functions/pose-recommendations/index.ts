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

interface PoseRecommendationRequest {
  userId: string;
  currentMood?: string;
  targetBenefit?: string;
  limit?: number;
}

interface PoseData {
  id: string;
  name: string;
  sanskritName: string;
  difficulty: number;
  category: string;
  benefits: string[];
}

// Yoga poses database for recommendation matching
const yogaPoses: PoseData[] = [
  { id: "mountain", name: "Mountain Pose", sanskritName: "Tadasana", difficulty: 1, category: "Standing", benefits: ["Improves posture", "Strengthens thighs", "Creates grounding", "Promotes focus"] },
  { id: "warrior2", name: "Warrior II", sanskritName: "Virabhadrasana II", difficulty: 2, category: "Standing", benefits: ["Strengthens legs", "Opens hips", "Builds focus", "Increases stamina"] },
  { id: "warrior1", name: "Warrior I", sanskritName: "Virabhadrasana I", difficulty: 2, category: "Standing", benefits: ["Strengthens legs and core", "Opens chest and lungs", "Improves balance", "Builds confidence"] },
  { id: "tree", name: "Tree Pose", sanskritName: "Vrksasana", difficulty: 2, category: "Balancing", benefits: ["Improves balance", "Strengthens ankles", "Opens hips", "Develops focus"] },
  { id: "triangle", name: "Triangle Pose", sanskritName: "Trikonasana", difficulty: 2, category: "Standing", benefits: ["Stretches legs and torso", "Opens hips and chest", "Strengthens core", "Improves digestion"] },
  { id: "child", name: "Child's Pose", sanskritName: "Balasana", difficulty: 1, category: "Restorative", benefits: ["Relieves stress", "Calms the mind", "Stretches back", "Promotes rest"] },
  { id: "downdog", name: "Downward Dog", sanskritName: "Adho Mukha Svanasana", difficulty: 2, category: "Standing", benefits: ["Full body stretch", "Builds strength", "Energizes body", "Calms brain"] },
  { id: "cobra", name: "Cobra Pose", sanskritName: "Bhujangasana", difficulty: 1, category: "Backbend", benefits: ["Strengthens spine", "Opens chest", "Firms buttocks", "Relieves stress"] },
  { id: "bridge", name: "Bridge Pose", sanskritName: "Setu Bandhasana", difficulty: 1, category: "Backbend", benefits: ["Strengthens back", "Opens chest", "Reduces anxiety", "Calms brain"] },
  { id: "corpse", name: "Corpse Pose", sanskritName: "Savasana", difficulty: 1, category: "Restorative", benefits: ["Deep relaxation", "Reduces stress", "Lowers blood pressure", "Quiets mind"] },
  { id: "seated-forward-fold", name: "Seated Forward Fold", sanskritName: "Paschimottanasana", difficulty: 2, category: "Seated", benefits: ["Stretches spine", "Calms mind", "Relieves stress", "Improves digestion"] },
  { id: "cat-cow", name: "Cat-Cow Stretch", sanskritName: "Marjaryasana-Bitilasana", difficulty: 1, category: "Kneeling", benefits: ["Warms spine", "Relieves back tension", "Massages organs", "Calms mind"] },
  { id: "pigeon", name: "Pigeon Pose", sanskritName: "Eka Pada Rajakapotasana", difficulty: 3, category: "Hip Opener", benefits: ["Deep hip stretch", "Releases tension", "Opens hips", "Emotional release"] },
  { id: "half-moon", name: "Half Moon Pose", sanskritName: "Ardha Chandrasana", difficulty: 3, category: "Balancing", benefits: ["Improves balance", "Strengthens legs", "Opens hips", "Builds focus"] },
];

// Mood to pose benefit mapping for personalization
const moodBenefitMapping: Record<string, string[]> = {
  very_low: ["Relieves stress", "Calms the mind", "Deep relaxation", "Reduces anxiety", "Promotes rest"],
  low: ["Calms mind", "Relieves stress", "Opens chest", "Emotional release", "Calms brain"],
  neutral: ["Improves balance", "Full body stretch", "Strengthens core", "Improves digestion"],
  good: ["Builds focus", "Strengthens legs", "Increases stamina", "Builds confidence"],
  great: ["Energizes body", "Builds strength", "Opens hips", "Improves balance"],
};

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
    return { result: [] };
  }

  return response.json();
}

async function getAIRecommendation(context: {
  moodHistory: Array<{ mood_level: string; created_at: string }>;
  yogaSessions: Array<{ activity_name: string; mood_before?: string; mood_after?: string }>;
  currentMood?: string;
  targetBenefit?: string;
  moodMemories: Array<{ payload: Record<string, unknown>; score: number }>;
  sessionMemories: Array<{ payload: Record<string, unknown>; score: number }>;
}): Promise<{ recommendations: Array<{ poseId: string; reason: string; confidence: number }>; reasoning: string }> {
  const prompt = `You are a yoga recommendation AI. Based on the user's mood history, past yoga sessions, and retrieved memories, recommend the best yoga poses.

Context:
- Current mood: ${context.currentMood || 'unknown'}
- Target benefit: ${context.targetBenefit || 'general wellness'}
- Recent mood history: ${JSON.stringify(context.moodHistory.slice(0, 5))}
- Past yoga sessions: ${JSON.stringify(context.yogaSessions.slice(0, 5))}
- Relevant mood memories (Qdrant): ${JSON.stringify(context.moodMemories.slice(0, 3).map(m => ({ payload: m.payload, score: m.score })))}
- Past session patterns (Qdrant): ${JSON.stringify(context.sessionMemories.slice(0, 3).map(m => ({ payload: m.payload, score: m.score })))}

Available poses: mountain, warrior2, warrior1, tree, triangle, child, downdog, cobra, bridge, corpse, seated-forward-fold, cat-cow, pigeon, half-moon

Recommend 3-5 poses that would be most beneficial. Consider:
1. Poses that helped improve mood in similar past situations
2. Poses matching the user's current energy level
3. Poses that provide the benefits they need most right now
4. Progressive difficulty based on session history`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'You are a yoga wellness expert. Provide personalized pose recommendations.' },
        { role: 'user', content: prompt },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'recommend_poses',
            description: 'Recommend yoga poses based on user context',
            parameters: {
              type: 'object',
              properties: {
                recommendations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      poseId: { type: 'string', description: 'The pose ID from available poses' },
                      reason: { type: 'string', description: 'Why this pose is recommended' },
                      confidence: { type: 'number', description: 'Confidence score 0-1' },
                    },
                    required: ['poseId', 'reason', 'confidence'],
                  },
                },
                reasoning: { type: 'string', description: 'Overall reasoning for these recommendations' },
              },
              required: ['recommendations', 'reasoning'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'recommend_poses' } },
    }),
  });

  if (!response.ok) {
    console.error('AI recommendation failed:', response.status);
    // Fallback to rule-based recommendations
    return getFallbackRecommendations(context.currentMood, context.targetBenefit);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      return getFallbackRecommendations(context.currentMood, context.targetBenefit);
    }
  }

  return getFallbackRecommendations(context.currentMood, context.targetBenefit);
}

function getFallbackRecommendations(currentMood?: string, targetBenefit?: string) {
  const mood = currentMood || 'neutral';
  const benefitsToSeek = moodBenefitMapping[mood] || moodBenefitMapping.neutral;
  
  const scoredPoses = yogaPoses.map(pose => {
    let score = 0;
    pose.benefits.forEach(benefit => {
      if (benefitsToSeek.some(b => benefit.toLowerCase().includes(b.toLowerCase()))) {
        score += 0.3;
      }
      if (targetBenefit && benefit.toLowerCase().includes(targetBenefit.toLowerCase())) {
        score += 0.5;
      }
    });
    // Favor easier poses for low moods
    if ((mood === 'very_low' || mood === 'low') && pose.difficulty === 1) {
      score += 0.2;
    }
    return { pose, score };
  });

  const topPoses = scoredPoses
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return {
    recommendations: topPoses.map(({ pose, score }) => ({
      poseId: pose.id,
      reason: `Recommended for ${mood} mood - ${pose.benefits[0]}`,
      confidence: Math.min(0.9, score + 0.5),
    })),
    reasoning: `Based on your ${mood} mood, we selected poses that focus on ${benefitsToSeek.slice(0, 2).join(' and ')}.`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, currentMood, targetBenefit, limit = 5 } = await req.json() as PoseRecommendationRequest;

    if (!userId) {
      throw new Error('Missing required field: userId');
    }

    console.log(`Pose recommendations - User: ${userId}, Mood: ${currentMood || 'unknown'}`);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch recent mood entries from Supabase
    const { data: moodEntries } = await supabase
      .from('mood_entries')
      .select('mood_level, mood_score, journal_text, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch past yoga sessions from Supabase
    const { data: yogaSessions } = await supabase
      .from('therapy_sessions')
      .select('activity_name, session_type, mood_before, mood_after, duration_seconds, created_at')
      .eq('user_id', userId)
      .eq('session_type', 'yoga')
      .order('created_at', { ascending: false })
      .limit(20);

    // Determine effective current mood
    const effectiveMood = currentMood || moodEntries?.[0]?.mood_level || 'neutral';
    const benefitsNeeded = moodBenefitMapping[effectiveMood] || [];

    // Build hybrid search query combining mood context and target benefits
    const searchQuery = `User feeling ${effectiveMood}. Looking for yoga poses that provide: ${benefitsNeeded.join(', ')}. ${targetBenefit ? `Specifically interested in: ${targetBenefit}` : ''}`;

    // Parallel Qdrant searches across mood_memories and therapy_sessions
    let moodMemories: Array<{ payload: Record<string, unknown>; score: number }> = [];
    let sessionMemories: Array<{ payload: Record<string, unknown>; score: number }> = [];

    try {
      const queryEmbedding = await generateEmbedding(searchQuery);

      const userFilter = {
        must: [{ key: 'user_id', match: { value: userId } }],
      };

      const [moodResult, sessionResult] = await Promise.all([
        searchQdrant('mood_memories', queryEmbedding, 5, userFilter),
        searchQdrant('therapy_sessions', queryEmbedding, 10, userFilter),
      ]);

      moodMemories = (moodResult.result || []).map((p: { payload: Record<string, unknown>; score: number }) => ({
        payload: p.payload,
        score: p.score,
      }));

      sessionMemories = (sessionResult.result || []).map((p: { payload: Record<string, unknown>; score: number }) => ({
        payload: p.payload,
        score: p.score,
      }));

      console.log(`Retrieved ${moodMemories.length} mood memories, ${sessionMemories.length} session memories from Qdrant`);
    } catch (qdrantError) {
      console.log('Qdrant search failed, using Supabase data only:', qdrantError);
    }

    // Analyze past successful sessions (mood improved after yoga)
    const successfulSessions = (yogaSessions || []).filter(
      s => s.mood_after && s.mood_before && 
      getMoodScore(s.mood_after) > getMoodScore(s.mood_before)
    );

    // Get AI-powered recommendations
    const aiResult = await getAIRecommendation({
      moodHistory: (moodEntries || []).map(e => ({ mood_level: e.mood_level, created_at: e.created_at })),
      yogaSessions: (yogaSessions || []).map(s => ({
        activity_name: s.activity_name,
        mood_before: s.mood_before || undefined,
        mood_after: s.mood_after || undefined,
      })),
      currentMood: effectiveMood,
      targetBenefit,
      moodMemories,
      sessionMemories,
    });

    // Enrich recommendations with full pose data
    const enrichedRecommendations = aiResult.recommendations
      .slice(0, limit)
      .map(rec => {
        const pose = yogaPoses.find(p => p.id === rec.poseId);
        if (!pose) return null;
        
        // Check if this pose was successful in the past
        const pastSuccess = successfulSessions.find(s => 
          s.activity_name.toLowerCase().includes(pose.name.toLowerCase())
        );

        return {
          ...rec,
          pose: {
            id: pose.id,
            name: pose.name,
            sanskritName: pose.sanskritName,
            difficulty: pose.difficulty,
            category: pose.category,
            benefits: pose.benefits,
          },
          personalHistory: pastSuccess ? {
            usedBefore: true,
            moodImprovement: `${pastSuccess.mood_before} → ${pastSuccess.mood_after}`,
          } : { usedBefore: false },
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify({
      success: true,
      recommendations: enrichedRecommendations,
      reasoning: aiResult.reasoning,
      context: {
        currentMood: effectiveMood,
        targetBenefit,
        moodMemoriesUsed: moodMemories.length,
        sessionMemoriesUsed: sessionMemories.length,
        successfulPastSessions: successfulSessions.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Pose recommendation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getMoodScore(mood: string): number {
  const scores: Record<string, number> = {
    very_low: 1,
    low: 2,
    neutral: 3,
    good: 4,
    great: 5,
  };
  return scores[mood] || 3;
}
