import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface CrisisIndicator {
  type: 'rapid_decline' | 'isolation_pattern' | 'severity_spike' | 'anomaly_detected' | 'sustained_low';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  evidencePoints: Array<{
    id: string;
    score: number;
    timestamp: string;
    mood: string;
    content?: string;
  }>;
  suggestedActions: string[];
}

interface CrisisReport {
  userId: string;
  timestamp: string;
  overallRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  indicators: CrisisIndicator[];
  baselineDeviation: number;
  recentTrend: 'improving' | 'stable' | 'declining' | 'volatile';
  supportResources: Array<{ name: string; description: string; contact?: string }>;
}

// Distance thresholds for anomaly detection
const THRESHOLDS = {
  ANOMALY_DISTANCE: 0.85, // Points beyond this distance from baseline are anomalies
  RAPID_DECLINE_WINDOW: 3, // Days to check for rapid decline
  SUSTAINED_LOW_DAYS: 5, // Days of sustained low mood
  SEVERITY_SPIKE_DELTA: 3, // Mood score drop considered a spike
  MIN_BASELINE_POINTS: 5, // Minimum points needed for baseline
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

async function searchQdrant(
  collection: string,
  vector: number[],
  userId: string,
  limit: number = 50,
  scoreThreshold?: number
): Promise<any[]> {
  const body: any = {
    vector,
    limit,
    with_payload: true,
    filter: {
      must: [{ key: 'user_id', match: { value: userId } }],
    },
  };

  if (scoreThreshold !== undefined) {
    body.score_threshold = scoreThreshold;
  }

  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: 'POST',
    headers: {
      'api-key': QDRANT_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Qdrant search error:', text);
    return [];
  }

  const data = await response.json();
  return data.result || [];
}

async function getCollectionPoints(collection: string, userId: string, limit: number = 100): Promise<any[]> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/scroll`, {
    method: 'POST',
    headers: {
      'api-key': QDRANT_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit,
      with_payload: true,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
      },
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.result?.points || [];
}

function calculateBaselineDeviation(currentScore: number, baselineScores: number[]): number {
  if (baselineScores.length === 0) return 0;
  
  const mean = baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length;
  const variance = baselineScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / baselineScores.length;
  const stdDev = Math.sqrt(variance) || 1;
  
  return Math.abs(currentScore - mean) / stdDev;
}

function detectRapidDecline(moodHistory: Array<{ score: number; timestamp: string }>): CrisisIndicator | null {
  if (moodHistory.length < 3) return null;

  const recent = moodHistory.slice(0, THRESHOLDS.RAPID_DECLINE_WINDOW);
  const older = moodHistory.slice(THRESHOLDS.RAPID_DECLINE_WINDOW);

  if (older.length === 0) return null;

  const recentAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b.score, 0) / older.length;
  const decline = olderAvg - recentAvg;

  if (decline >= THRESHOLDS.SEVERITY_SPIKE_DELTA) {
    return {
      type: 'rapid_decline',
      severity: decline >= 4 ? 'critical' : decline >= 3 ? 'high' : 'medium',
      confidence: Math.min(0.95, 0.5 + (decline / 10)),
      description: `Mood has declined by ${decline.toFixed(1)} points over the past ${THRESHOLDS.RAPID_DECLINE_WINDOW} entries`,
      evidencePoints: recent.map((m, i) => ({
        id: `decline-${i}`,
        score: m.score,
        timestamp: m.timestamp,
        mood: m.score <= 2 ? 'very_low' : m.score <= 4 ? 'low' : 'neutral',
      })),
      suggestedActions: [
        'Consider reaching out to a mental health professional',
        'Practice grounding exercises',
        'Connect with a trusted friend or family member',
      ],
    };
  }

  return null;
}

function detectSustainedLow(moodHistory: Array<{ score: number; timestamp: string }>): CrisisIndicator | null {
  if (moodHistory.length < THRESHOLDS.SUSTAINED_LOW_DAYS) return null;

  const recentMoods = moodHistory.slice(0, THRESHOLDS.SUSTAINED_LOW_DAYS);
  const lowCount = recentMoods.filter(m => m.score <= 3).length;
  const ratio = lowCount / recentMoods.length;

  if (ratio >= 0.8) {
    return {
      type: 'sustained_low',
      severity: ratio >= 1 ? 'high' : 'medium',
      confidence: ratio,
      description: `${lowCount} out of ${recentMoods.length} recent entries show low mood levels`,
      evidencePoints: recentMoods.map((m, i) => ({
        id: `sustained-${i}`,
        score: m.score,
        timestamp: m.timestamp,
        mood: m.score <= 2 ? 'very_low' : 'low',
      })),
      suggestedActions: [
        'Consider scheduling a check-in with a counselor',
        'Try engaging in activities that previously brought joy',
        'Maintain regular sleep and exercise routines',
      ],
    };
  }

  return null;
}

function detectAnomalies(
  currentVector: number[],
  searchResults: any[],
  moodHistory: Array<{ score: number; timestamp: string }>
): CrisisIndicator | null {
  // Look for points with LOW similarity scores (high distance = anomaly)
  const anomalies = searchResults.filter(r => r.score < (1 - THRESHOLDS.ANOMALY_DISTANCE));

  if (anomalies.length === 0) return null;

  // Check if current mood is an anomaly compared to baseline
  const avgScore = searchResults.reduce((a, b) => a + b.score, 0) / searchResults.length;
  
  if (avgScore < 0.5) {
    return {
      type: 'anomaly_detected',
      severity: avgScore < 0.3 ? 'high' : 'medium',
      confidence: 1 - avgScore,
      description: 'Current emotional state significantly differs from your typical patterns',
      evidencePoints: anomalies.slice(0, 3).map((a, i) => ({
        id: a.id || `anomaly-${i}`,
        score: a.score,
        timestamp: a.payload?.created_at || new Date().toISOString(),
        mood: a.payload?.mood_level || 'unknown',
        content: a.payload?.journal_text?.substring(0, 100),
      })),
      suggestedActions: [
        'Take a moment to reflect on what might be causing this shift',
        'Consider journaling about your feelings',
        'Use breathing exercises to center yourself',
      ],
    };
  }

  return null;
}

function detectSeveritySpike(moodHistory: Array<{ score: number; timestamp: string }>): CrisisIndicator | null {
  if (moodHistory.length < 2) return null;

  const current = moodHistory[0];
  const previous = moodHistory[1];
  const spike = previous.score - current.score;

  if (spike >= THRESHOLDS.SEVERITY_SPIKE_DELTA) {
    return {
      type: 'severity_spike',
      severity: spike >= 5 ? 'critical' : spike >= 4 ? 'high' : 'medium',
      confidence: Math.min(0.9, 0.5 + (spike / 8)),
      description: `Sudden mood drop of ${spike} points detected from your previous entry`,
      evidencePoints: [
        {
          id: 'current',
          score: current.score,
          timestamp: current.timestamp,
          mood: current.score <= 2 ? 'very_low' : 'low',
        },
        {
          id: 'previous',
          score: previous.score,
          timestamp: previous.timestamp,
          mood: previous.score >= 7 ? 'great' : 'good',
        },
      ],
      suggestedActions: [
        'This sudden change may warrant immediate attention',
        'Reach out to someone you trust',
        'If you\'re in crisis, contact a helpline',
      ],
    };
  }

  return null;
}

function calculateOverallRisk(indicators: CrisisIndicator[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (indicators.length === 0) return 'none';

  const severityScores = { low: 1, medium: 2, high: 3, critical: 4 };
  const maxSeverity = Math.max(...indicators.map(i => severityScores[i.severity]));
  const avgConfidence = indicators.reduce((a, i) => a + i.confidence, 0) / indicators.length;

  if (maxSeverity >= 4 || (maxSeverity >= 3 && avgConfidence > 0.7)) return 'critical';
  if (maxSeverity >= 3 || (maxSeverity >= 2 && indicators.length >= 2)) return 'high';
  if (maxSeverity >= 2 || indicators.length >= 2) return 'medium';
  return 'low';
}

function calculateTrend(moodHistory: Array<{ score: number; timestamp: string }>): 'improving' | 'stable' | 'declining' | 'volatile' {
  if (moodHistory.length < 3) return 'stable';

  const scores = moodHistory.slice(0, 7).map(m => m.score);
  const changes = scores.slice(1).map((s, i) => s - scores[i]);
  
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const volatility = Math.sqrt(changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length);

  if (volatility > 2) return 'volatile';
  if (avgChange > 0.5) return 'improving';
  if (avgChange < -0.5) return 'declining';
  return 'stable';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Running crisis detection for user:', userId);

    // Fetch recent mood entries from Qdrant
    const moodPoints = await getCollectionPoints('mood_memories', userId, 50);
    
    // Also check voice memories for multimodal analysis
    const voicePoints = await getCollectionPoints('voice_memories', userId, 20);

    // Combine and sort by timestamp
    const allPoints = [...moodPoints, ...voicePoints]
      .filter(p => p.payload?.mood_score !== undefined || p.payload?.emotion_analysis)
      .sort((a, b) => {
        const dateA = new Date(a.payload?.created_at || 0).getTime();
        const dateB = new Date(b.payload?.created_at || 0).getTime();
        return dateB - dateA;
      });

    if (allPoints.length < 3) {
      return new Response(
        JSON.stringify({
          userId,
          timestamp: new Date().toISOString(),
          overallRisk: 'none',
          indicators: [],
          baselineDeviation: 0,
          recentTrend: 'stable',
          message: 'Insufficient data for crisis detection. Keep logging your moods.',
          supportResources: [],
        } as CrisisReport),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract mood history
    const moodHistory = allPoints.map(p => ({
      score: p.payload?.mood_score || (p.payload?.emotion_analysis?.sentiment_score * 5 + 5) / 2 || 5,
      timestamp: p.payload?.created_at || new Date().toISOString(),
    }));

    // Generate embedding for current emotional state
    const recentText = allPoints.slice(0, 3)
      .map(p => p.payload?.journal_text || p.payload?.transcription || '')
      .filter(Boolean)
      .join(' ');

    let searchResults: any[] = [];
    if (recentText) {
      const currentVector = await generateEmbedding(recentText);
      searchResults = await searchQdrant('mood_memories', currentVector, userId, 30);
    }

    // Calculate baseline from older entries
    const baselineScores = moodHistory.slice(7).map(m => m.score);
    const currentScore = moodHistory[0]?.score || 5;
    const baselineDeviation = calculateBaselineDeviation(currentScore, baselineScores);

    // Run all detection algorithms
    const indicators: CrisisIndicator[] = [];

    const rapidDecline = detectRapidDecline(moodHistory);
    if (rapidDecline) indicators.push(rapidDecline);

    const sustainedLow = detectSustainedLow(moodHistory);
    if (sustainedLow) indicators.push(sustainedLow);

    const severitySpike = detectSeveritySpike(moodHistory);
    if (severitySpike) indicators.push(severitySpike);

    if (searchResults.length > 0) {
      const anomaly = detectAnomalies([], searchResults, moodHistory);
      if (anomaly) indicators.push(anomaly);
    }

    // Check voice entries for concerning emotional patterns
    const concerningVoice = voicePoints.filter(p => {
      const emotion = p.payload?.emotion_analysis;
      return emotion?.dominant_emotion && 
        ['sadness', 'fear', 'anger', 'despair'].includes(emotion.dominant_emotion.toLowerCase()) &&
        emotion.intensity > 0.7;
    });

    if (concerningVoice.length >= 2) {
      indicators.push({
        type: 'isolation_pattern',
        severity: 'medium',
        confidence: 0.7,
        description: 'Voice entries show consistent high-intensity negative emotions',
        evidencePoints: concerningVoice.slice(0, 3).map((v, i) => ({
          id: v.id || `voice-${i}`,
          score: v.payload?.emotion_analysis?.intensity || 0.5,
          timestamp: v.payload?.created_at || new Date().toISOString(),
          mood: v.payload?.emotion_analysis?.dominant_emotion || 'unknown',
          content: v.payload?.transcription?.substring(0, 100),
        })),
        suggestedActions: [
          'Your voice recordings suggest you may be going through a difficult time',
          'Consider speaking with a mental health professional',
          'Use calming voice exercises',
        ],
      });
    }

    const overallRisk = calculateOverallRisk(indicators);
    const recentTrend = calculateTrend(moodHistory);

    const report: CrisisReport = {
      userId,
      timestamp: new Date().toISOString(),
      overallRisk,
      indicators,
      baselineDeviation,
      recentTrend,
      supportResources: overallRisk !== 'none' ? [
        {
          name: 'National Suicide Prevention Lifeline',
          description: '24/7 support for people in distress',
          contact: '988',
        },
        {
          name: 'Crisis Text Line',
          description: 'Text HOME to connect with a counselor',
          contact: 'Text HOME to 741741',
        },
        {
          name: 'SAMHSA Helpline',
          description: 'Free, confidential, 24/7 treatment referral',
          contact: '1-800-662-4357',
        },
      ] : [],
    };

    console.log('Crisis detection complete:', { overallRisk, indicatorCount: indicators.length });

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Crisis detection error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
