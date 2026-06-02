import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface InsightRequest {
  type: 'mood_analysis' | 'pattern_detection' | 'recommendation' | 'session_summary';
  context: {
    moodHistory?: Array<{ mood_level: string; mood_score: number; journal_text?: string; created_at: string }>;
    activities?: Array<{ activity_type: string; activity_name: string; metrics?: Record<string, unknown> }>;
    currentMood?: { mood_level: string; mood_score: number; journal_text?: string };
    retrievedMemories?: Array<{ payload: Record<string, unknown>; score: number }>;
    sessionData?: Record<string, unknown>;
  };
}

const systemPrompts: Record<string, string> = {
  mood_analysis: `You are a compassionate mental health AI assistant. Analyze the user's mood entry and provide:
1. A brief, empathetic acknowledgment of their feelings
2. Identification of potential triggers or patterns if visible
3. One gentle, actionable suggestion for their wellbeing

Keep your response warm, supportive, and under 150 words. Never diagnose or provide medical advice.`,

  pattern_detection: `You are an insightful wellness pattern analyzer. Based on the provided mood and activity history:
1. Identify 2-3 notable patterns or correlations
2. Highlight positive trends to reinforce
3. Gently note areas that might benefit from attention

Be encouraging and evidence-based. Reference specific data points. Keep response under 200 words.`,

  recommendation: `You are a personalized wellness recommendation engine. Based on the user's current state and history:
1. Suggest 2-3 specific activities from their toolkit (breathing, yoga, games, journaling)
2. Explain briefly why each might help right now
3. Provide one encouraging message

Ground recommendations in their past successful activities when possible. Keep response under 150 words.`,

  session_summary: `You are a supportive session summarizer. For the completed wellness activity:
1. Acknowledge their effort and participation
2. Highlight key metrics or achievements
3. Note any mood improvements
4. Suggest a natural next step

Be positive and reinforcing. Keep response under 100 words.`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, context } = await req.json() as InsightRequest;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = systemPrompts[type];
    if (!systemPrompt) {
      throw new Error(`Unknown insight type: ${type}`);
    }

    // Build context message
    let contextMessage = '';
    
    if (context.currentMood) {
      contextMessage += `Current mood: ${context.currentMood.mood_level} (score: ${context.currentMood.mood_score}/10)\n`;
      if (context.currentMood.journal_text) {
        contextMessage += `Journal entry: "${context.currentMood.journal_text}"\n`;
      }
    }

    if (context.moodHistory && context.moodHistory.length > 0) {
      contextMessage += `\nRecent mood history (last ${context.moodHistory.length} entries):\n`;
      context.moodHistory.forEach((entry, i) => {
        contextMessage += `- ${new Date(entry.created_at).toLocaleDateString()}: ${entry.mood_level} (${entry.mood_score}/10)${entry.journal_text ? ` - "${entry.journal_text.slice(0, 50)}..."` : ''}\n`;
      });
    }

    if (context.activities && context.activities.length > 0) {
      contextMessage += `\nRecent activities:\n`;
      context.activities.forEach(activity => {
        contextMessage += `- ${activity.activity_type}: ${activity.activity_name}\n`;
      });
    }

    if (context.retrievedMemories && context.retrievedMemories.length > 0) {
      contextMessage += `\nRelevant past experiences (similarity-matched):\n`;
      context.retrievedMemories.forEach((memory, i) => {
        contextMessage += `- ${JSON.stringify(memory.payload).slice(0, 100)}... (relevance: ${(memory.score * 100).toFixed(0)}%)\n`;
      });
    }

    if (context.sessionData) {
      contextMessage += `\nSession data: ${JSON.stringify(context.sessionData)}\n`;
    }

    console.log(`AI Insights request - Type: ${type}, Context length: ${contextMessage.length}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextMessage },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const insight = data.choices[0]?.message?.content || 'Unable to generate insight';

    return new Response(JSON.stringify({ success: true, insight, type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI insights error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
