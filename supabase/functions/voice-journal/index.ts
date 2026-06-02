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

interface VoiceJournalRequest {
  audioBase64: string;
  userId: string;
  moodLevel?: string;
  moodScore?: number;
  duration: number;
}

interface EmotionAnalysis {
  dominantEmotion: string;
  emotions: Record<string, number>;
  sentiment: 'positive' | 'negative' | 'neutral';
  intensity: number;
  voiceCharacteristics: {
    pace: 'slow' | 'normal' | 'fast';
    energy: 'low' | 'medium' | 'high';
    stability: 'stable' | 'variable';
  };
}

// Transcribe audio using Lovable AI
async function transcribeAudio(audioBase64: string): Promise<string> {
  console.log('Transcribing audio...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/whisper-1',
      file: audioBase64,
      response_format: 'json',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Transcription error:', errorText);
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('Transcription complete:', data.text?.slice(0, 100));
  return data.text || '';
}

// Analyze emotions from transcribed text
async function analyzeEmotions(text: string, duration: number): Promise<EmotionAnalysis> {
  console.log('Analyzing emotions from text...');
  
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
          content: `You are an emotion analysis expert. Analyze the emotional content of voice journal entries.
Return a JSON object with:
- dominantEmotion: the primary emotion (joy, sadness, anger, fear, surprise, disgust, neutral, anxious, peaceful, hopeful)
- emotions: object with emotion names as keys and confidence scores (0-1) as values
- sentiment: overall sentiment (positive, negative, neutral)
- intensity: emotional intensity from 0-1
- voiceCharacteristics: {pace: slow/normal/fast, energy: low/medium/high, stability: stable/variable}

Consider the duration (${duration}s) - shorter entries may indicate more intense emotions.`
        },
        {
          role: 'user',
          content: `Analyze the emotions in this voice journal entry:\n\n"${text}"`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    console.error('Emotion analysis failed');
    return {
      dominantEmotion: 'neutral',
      emotions: { neutral: 0.5 },
      sentiment: 'neutral',
      intensity: 0.5,
      voiceCharacteristics: { pace: 'normal', energy: 'medium', stability: 'stable' }
    };
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  try {
    return JSON.parse(content);
  } catch {
    console.error('Failed to parse emotion analysis');
    return {
      dominantEmotion: 'neutral',
      emotions: { neutral: 0.5 },
      sentiment: 'neutral',
      intensity: 0.5,
      voiceCharacteristics: { pace: 'normal', energy: 'medium', stability: 'stable' }
    };
  }
}

// Generate text embedding
async function generateTextEmbedding(text: string): Promise<number[]> {
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
    throw new Error(`Text embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Ensure Qdrant collection exists with multimodal support
async function ensureVoiceCollection() {
  const collectionName = 'voice_memories';
  
  try {
    const checkResponse = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
      method: 'GET',
      headers: { 'api-key': QDRANT_API_KEY! },
    });
    
    if (checkResponse.ok) {
      console.log(`Collection ${collectionName} exists`);
      return;
    }
  } catch {
    // Collection doesn't exist
  }

  console.log(`Creating collection ${collectionName}`);
  
  // Create collection with text embeddings (1536 dims for text-embedding-3-small)
  await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
    }),
  });
}

// Store voice memory in Qdrant
async function storeVoiceMemory(
  pointId: string,
  embedding: number[],
  payload: Record<string, unknown>
) {
  const response = await fetch(`${QDRANT_URL}/collections/voice_memories/points`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      points: [{
        id: pointId,
        vector: embedding,
        payload,
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Qdrant upsert error:', errorText);
    throw new Error(`Qdrant upsert failed: ${response.status}`);
  }
}

// Also store in mood_memories for unified search
async function storeInMoodMemories(
  pointId: string,
  embedding: number[],
  payload: Record<string, unknown>
) {
  // Ensure mood_memories collection exists
  try {
    await fetch(`${QDRANT_URL}/collections/mood_memories`, {
      method: 'GET',
      headers: { 'api-key': QDRANT_API_KEY! },
    });
  } catch {
    await fetch(`${QDRANT_URL}/collections/mood_memories`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'api-key': QDRANT_API_KEY!,
      },
      body: JSON.stringify({
        vectors: { size: 1536, distance: 'Cosine' },
      }),
    });
  }

  await fetch(`${QDRANT_URL}/collections/mood_memories/points`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      points: [{
        id: `voice_${pointId}`,
        vector: embedding,
        payload: {
          ...payload,
          entry_type: 'voice',
        },
      }],
    }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, userId, moodLevel, moodScore, duration } = await req.json() as VoiceJournalRequest;

    if (!audioBase64 || !userId) {
      throw new Error('Missing required fields: audioBase64, userId');
    }

    console.log(`Processing voice journal - User: ${userId}, Duration: ${duration}s`);

    // Step 1: Transcribe audio
    const transcription = await transcribeAudio(audioBase64);
    
    if (!transcription) {
      throw new Error('Transcription returned empty');
    }

    // Step 2: Analyze emotions from transcription
    const emotionAnalysis = await analyzeEmotions(transcription, duration);

    // Step 3: Generate text embedding for semantic search
    const textEmbedding = await generateTextEmbedding(transcription);

    // Step 4: Save to Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Determine mood from emotion analysis if not provided
    const detectedMood = moodLevel || mapEmotionToMood(emotionAnalysis.dominantEmotion);
    const detectedScore = moodScore || Math.round(emotionAnalysis.intensity * 10);

    const { data: entry, error: dbError } = await supabase
      .from('mood_entries')
      .insert([{
        user_id: userId,
        journal_text: transcription,
        mood_level: detectedMood,
        mood_score: detectedScore,
        tags: ['voice'],
        context: {
          source: 'voice_journal',
          duration,
          emotion_analysis: emotionAnalysis,
          has_audio: true,
        },
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Step 5: Store in Qdrant
    await ensureVoiceCollection();

    const qdrantPayload = {
      user_id: userId,
      record_id: entry.id,
      transcription_preview: transcription.slice(0, 300),
      full_transcription: transcription,
      duration,
      dominant_emotion: emotionAnalysis.dominantEmotion,
      emotions: emotionAnalysis.emotions,
      sentiment: emotionAnalysis.sentiment,
      intensity: emotionAnalysis.intensity,
      voice_characteristics: emotionAnalysis.voiceCharacteristics,
      mood_level: detectedMood,
      mood_score: detectedScore,
      entry_type: 'voice',
      created_at: new Date().toISOString(),
    };

    // Store in voice_memories collection
    await storeVoiceMemory(entry.id, textEmbedding, qdrantPayload);
    
    // Also store in mood_memories for unified multimodal search
    await storeInMoodMemories(entry.id, textEmbedding, qdrantPayload);

    console.log(`Voice journal stored successfully: ${entry.id}`);

    return new Response(JSON.stringify({
      success: true,
      entry: {
        id: entry.id,
        transcription,
        emotionAnalysis,
        moodLevel: detectedMood,
        moodScore: detectedScore,
      },
      qdrant: {
        voiceCollection: 'voice_memories',
        moodCollection: 'mood_memories',
        pointId: entry.id,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Voice journal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapEmotionToMood(emotion: string): string {
  const emotionMoodMap: Record<string, string> = {
    joy: 'great',
    hopeful: 'good',
    peaceful: 'good',
    surprise: 'good',
    neutral: 'neutral',
    anxious: 'low',
    fear: 'low',
    sadness: 'low',
    anger: 'very_low',
    disgust: 'very_low',
  };
  return emotionMoodMap[emotion] || 'neutral';
}
