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

interface TemporalRequest {
  userId: string;
  analysisType?: 'weekly' | 'monthly' | 'seasonal' | 'all';
}

interface MoodPoint {
  id: string;
  mood_level: string;
  mood_score: number;
  journal_text: string | null;
  tags: string[] | null;
  created_at: string;
}

interface CyclicalPattern {
  cycleType: 'daily' | 'weekly' | 'monthly' | 'seasonal';
  pattern: string;
  strength: number;
  peakPeriods: string[];
  lowPeriods: string[];
  confidence: number;
  dataPoints: number;
  recommendation: string;
}

interface TemporalAnalysis {
  weeklyPattern: CyclicalPattern | null;
  monthlyPattern: CyclicalPattern | null;
  seasonalPattern: CyclicalPattern | null;
  overallTrend: 'improving' | 'declining' | 'stable' | 'cyclical';
  predictedNextWeek: { mood: string; confidence: number };
  historicalComparison: {
    currentPeriodAvg: number;
    samePeriodLastYear: number | null;
    yearOverYearChange: number | null;
  };
  aiInsight: string;
}

// Qdrant scroll with time-based filtering
async function scrollQdrantWithTimeFilter(
  collection: string,
  userId: string,
  startDate: string,
  endDate: string,
  limit: number = 100
): Promise<MoodPoint[]> {
  console.log(`Scrolling ${collection} for user ${userId} from ${startDate} to ${endDate}`);
  
  const allPoints: MoodPoint[] = [];
  let offset: string | null = null;
  let hasMore = true;
  
  while (hasMore && allPoints.length < limit) {
    const scrollBody: Record<string, unknown> = {
      filter: {
        must: [
          { key: 'user_id', match: { value: userId } },
          { 
            key: 'created_at', 
            range: { 
              gte: startDate,
              lte: endDate
            } 
          }
        ],
      },
      limit: Math.min(50, limit - allPoints.length),
      with_payload: true,
      with_vector: false,
    };
    
    if (offset) {
      scrollBody.offset = offset;
    }

    const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/scroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': QDRANT_API_KEY!,
      },
      body: JSON.stringify(scrollBody),
    });

    if (!response.ok) {
      console.error(`Qdrant scroll failed for ${collection}:`, response.status);
      break;
    }

    const data = await response.json();
    const points = data.result?.points || [];
    
    for (const point of points) {
      if (point.payload) {
        allPoints.push({
          id: String(point.id),
          mood_level: point.payload.mood_level || 'neutral',
          mood_score: point.payload.mood_score || 5,
          journal_text: point.payload.journal_text || point.payload.text || null,
          tags: point.payload.tags || [],
          created_at: point.payload.created_at || point.payload.timestamp || new Date().toISOString(),
        });
      }
    }
    
    offset = data.result?.next_page_offset || null;
    hasMore = offset !== null && points.length > 0;
  }
  
  console.log(`Retrieved ${allPoints.length} points from ${collection}`);
  return allPoints;
}

// Analyze weekly patterns (day-of-week cycles)
function analyzeWeeklyPattern(points: MoodPoint[]): CyclicalPattern | null {
  if (points.length < 14) return null; // Need at least 2 weeks of data
  
  const dayAverages: Record<number, number[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] // Sunday=0
  };
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  points.forEach(p => {
    const day = new Date(p.created_at).getDay();
    dayAverages[day].push(p.mood_score);
  });
  
  const dayMeans: Record<number, number> = {};
  let validDays = 0;
  
  for (let i = 0; i < 7; i++) {
    if (dayAverages[i].length > 0) {
      dayMeans[i] = dayAverages[i].reduce((a, b) => a + b, 0) / dayAverages[i].length;
      validDays++;
    }
  }
  
  if (validDays < 5) return null;
  
  const means = Object.values(dayMeans);
  const overallMean = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.reduce((sum, m) => sum + Math.pow(m - overallMean, 2), 0) / means.length;
  const strength = Math.min(1, Math.sqrt(variance) / 2);
  
  const sortedDays = Object.entries(dayMeans).sort((a, b) => b[1] - a[1]);
  const peakPeriods = sortedDays.slice(0, 2).map(([d]) => dayNames[parseInt(d)]);
  const lowPeriods = sortedDays.slice(-2).map(([d]) => dayNames[parseInt(d)]);
  
  return {
    cycleType: 'weekly',
    pattern: `Mood tends to be highest on ${peakPeriods.join(' and ')} and lowest on ${lowPeriods.join(' and ')}`,
    strength,
    peakPeriods,
    lowPeriods,
    confidence: Math.min(1, points.length / 50),
    dataPoints: points.length,
    recommendation: strength > 0.3 
      ? `Consider scheduling challenging tasks on ${peakPeriods[0]} when your mood is typically higher.`
      : 'Your mood is relatively stable throughout the week.',
  };
}

// Analyze monthly patterns (week-of-month cycles)
function analyzeMonthlyPattern(points: MoodPoint[]): CyclicalPattern | null {
  if (points.length < 60) return null; // Need ~2 months of data
  
  const weekAverages: Record<number, number[]> = {
    1: [], 2: [], 3: [], 4: [] // Week 1-4
  };
  
  points.forEach(p => {
    const date = new Date(p.created_at);
    const weekOfMonth = Math.min(4, Math.ceil(date.getDate() / 7));
    weekAverages[weekOfMonth].push(p.mood_score);
  });
  
  const weekMeans: Record<number, number> = {};
  let validWeeks = 0;
  
  for (let i = 1; i <= 4; i++) {
    if (weekAverages[i].length > 0) {
      weekMeans[i] = weekAverages[i].reduce((a, b) => a + b, 0) / weekAverages[i].length;
      validWeeks++;
    }
  }
  
  if (validWeeks < 3) return null;
  
  const means = Object.values(weekMeans);
  const overallMean = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.reduce((sum, m) => sum + Math.pow(m - overallMean, 2), 0) / means.length;
  const strength = Math.min(1, Math.sqrt(variance) / 2);
  
  const weekNames = ['', 'First week', 'Second week', 'Third week', 'Fourth week'];
  const sortedWeeks = Object.entries(weekMeans).sort((a, b) => b[1] - a[1]);
  const peakPeriods = sortedWeeks.slice(0, 1).map(([w]) => weekNames[parseInt(w)]);
  const lowPeriods = sortedWeeks.slice(-1).map(([w]) => weekNames[parseInt(w)]);
  
  return {
    cycleType: 'monthly',
    pattern: `Mood peaks during the ${peakPeriods[0].toLowerCase()} of the month and dips in the ${lowPeriods[0].toLowerCase()}`,
    strength,
    peakPeriods,
    lowPeriods,
    confidence: Math.min(1, points.length / 100),
    dataPoints: points.length,
    recommendation: strength > 0.3 
      ? `Plan self-care activities during the ${lowPeriods[0].toLowerCase()} when your mood typically dips.`
      : 'Your mood is relatively stable throughout each month.',
  };
}

// Analyze seasonal patterns (quarter-based)
function analyzeSeasonalPattern(points: MoodPoint[]): CyclicalPattern | null {
  if (points.length < 180) return null; // Need ~6 months of data
  
  const seasonAverages: Record<string, number[]> = {
    'Winter': [], 'Spring': [], 'Summer': [], 'Fall': []
  };
  
  const getSeasonFromMonth = (month: number): string => {
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  };
  
  points.forEach(p => {
    const month = new Date(p.created_at).getMonth();
    const season = getSeasonFromMonth(month);
    seasonAverages[season].push(p.mood_score);
  });
  
  const seasonMeans: Record<string, number> = {};
  let validSeasons = 0;
  
  for (const season of Object.keys(seasonAverages)) {
    if (seasonAverages[season].length > 0) {
      seasonMeans[season] = seasonAverages[season].reduce((a, b) => a + b, 0) / seasonAverages[season].length;
      validSeasons++;
    }
  }
  
  if (validSeasons < 2) return null;
  
  const means = Object.values(seasonMeans);
  const overallMean = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.reduce((sum, m) => sum + Math.pow(m - overallMean, 2), 0) / means.length;
  const strength = Math.min(1, Math.sqrt(variance) / 1.5);
  
  const sortedSeasons = Object.entries(seasonMeans).sort((a, b) => b[1] - a[1]);
  const peakPeriods = sortedSeasons.slice(0, 1).map(([s]) => s);
  const lowPeriods = sortedSeasons.slice(-1).map(([s]) => s);
  
  return {
    cycleType: 'seasonal',
    pattern: `Mood is highest in ${peakPeriods[0]} and lowest in ${lowPeriods[0]}`,
    strength,
    peakPeriods,
    lowPeriods,
    confidence: Math.min(1, points.length / 300),
    dataPoints: points.length,
    recommendation: strength > 0.3 
      ? `Consider increasing wellness activities during ${lowPeriods[0]} to counteract seasonal mood changes.`
      : 'Your mood shows minimal seasonal variation.',
  };
}

// Calculate overall trend
function calculateOverallTrend(points: MoodPoint[]): 'improving' | 'declining' | 'stable' | 'cyclical' {
  if (points.length < 7) return 'stable';
  
  const sorted = [...points].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const halfPoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, halfPoint);
  const secondHalf = sorted.slice(halfPoint);
  
  const firstAvg = firstHalf.reduce((sum, p) => sum + p.mood_score, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.mood_score, 0) / secondHalf.length;
  
  const diff = secondAvg - firstAvg;
  
  // Check for cyclical pattern
  const variance = sorted.reduce((sum, p) => sum + Math.pow(p.mood_score - ((firstAvg + secondAvg) / 2), 2), 0) / sorted.length;
  if (variance > 4 && Math.abs(diff) < 1) {
    return 'cyclical';
  }
  
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

// Generate AI insight from temporal patterns
async function generateTemporalInsight(
  weeklyPattern: CyclicalPattern | null,
  monthlyPattern: CyclicalPattern | null,
  seasonalPattern: CyclicalPattern | null,
  overallTrend: string,
  recentMood: number
): Promise<string> {
  const patterns = [];
  if (weeklyPattern && weeklyPattern.strength > 0.2) {
    patterns.push(`Weekly: ${weeklyPattern.pattern}`);
  }
  if (monthlyPattern && monthlyPattern.strength > 0.2) {
    patterns.push(`Monthly: ${monthlyPattern.pattern}`);
  }
  if (seasonalPattern && seasonalPattern.strength > 0.2) {
    patterns.push(`Seasonal: ${seasonalPattern.pattern}`);
  }

  const prompt = `Based on temporal mood analysis:

DETECTED CYCLICAL PATTERNS:
${patterns.length > 0 ? patterns.join('\n') : 'No significant cyclical patterns detected'}

OVERALL TREND: ${overallTrend}
CURRENT AVERAGE MOOD: ${recentMood.toFixed(1)}/10

Provide a brief (2-3 sentences) personalized insight about the user's temporal mood patterns and one actionable suggestion. Be empathetic and constructive.`;

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
          content: 'You are a compassionate wellness analyst specializing in temporal mood patterns. Keep responses concise and actionable.' 
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    return 'Unable to generate temporal insight at this time.';
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Continue tracking to reveal more patterns.';
}

// Predict next week's mood based on patterns
function predictNextWeek(
  weeklyPattern: CyclicalPattern | null,
  monthlyPattern: CyclicalPattern | null,
  recentAvg: number
): { mood: string; confidence: number } {
  let predictedScore = recentAvg;
  let confidence = 0.3;
  
  const today = new Date();
  const nextWeekDay = (today.getDay() + 7) % 7;
  const nextWeekOfMonth = Math.min(4, Math.ceil((today.getDate() + 7) / 7));
  
  if (weeklyPattern && weeklyPattern.strength > 0.3) {
    if (weeklyPattern.peakPeriods.some(p => p.toLowerCase() === getDayName(nextWeekDay).toLowerCase())) {
      predictedScore += 0.5;
    }
    if (weeklyPattern.lowPeriods.some(p => p.toLowerCase() === getDayName(nextWeekDay).toLowerCase())) {
      predictedScore -= 0.5;
    }
    confidence += weeklyPattern.strength * 0.2;
  }
  
  if (monthlyPattern && monthlyPattern.strength > 0.3) {
    const weekName = ['', 'First week', 'Second week', 'Third week', 'Fourth week'][nextWeekOfMonth];
    if (monthlyPattern.peakPeriods.includes(weekName)) {
      predictedScore += 0.3;
    }
    if (monthlyPattern.lowPeriods.includes(weekName)) {
      predictedScore -= 0.3;
    }
    confidence += monthlyPattern.strength * 0.1;
  }
  
  predictedScore = Math.max(1, Math.min(10, predictedScore));
  confidence = Math.min(0.9, confidence);
  
  let mood = 'neutral';
  if (predictedScore >= 7) mood = 'good';
  if (predictedScore >= 8) mood = 'great';
  if (predictedScore <= 4) mood = 'low';
  if (predictedScore <= 2) mood = 'very_low';
  
  return { mood, confidence };
}

function getDayName(day: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, analysisType = 'all' } = await req.json() as TemporalRequest;

    if (!userId) {
      throw new Error('Missing required field: userId');
    }

    console.log(`Temporal pattern analysis - User: ${userId}, Type: ${analysisType}`);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const now = new Date();
    
    // Define time ranges for different analyses
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Scroll Qdrant for mood data with time filtering
    console.log('Scrolling Qdrant mood_memories with time filters...');
    
    let allMoodPoints: MoodPoint[] = [];
    
    // Try Qdrant first
    const qdrantPoints = await scrollQdrantWithTimeFilter(
      'mood_memories',
      userId,
      oneYearAgo,
      now.toISOString(),
      500
    );
    
    if (qdrantPoints.length > 0) {
      allMoodPoints = qdrantPoints;
      console.log(`Found ${allMoodPoints.length} points in Qdrant`);
    }
    
    // Fallback to Supabase if Qdrant has insufficient data
    if (allMoodPoints.length < 30) {
      console.log('Falling back to Supabase for mood data...');
      const { data: supabaseMoods } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', oneYearAgo)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (supabaseMoods && supabaseMoods.length > allMoodPoints.length) {
        allMoodPoints = supabaseMoods.map(m => ({
          id: m.id,
          mood_level: m.mood_level,
          mood_score: m.mood_score,
          journal_text: m.journal_text,
          tags: m.tags,
          created_at: m.created_at,
        }));
        console.log(`Using ${allMoodPoints.length} points from Supabase`);
      }
    }

    if (allMoodPoints.length < 7) {
      return new Response(JSON.stringify({
        success: true,
        analysis: {
          weeklyPattern: null,
          monthlyPattern: null,
          seasonalPattern: null,
          overallTrend: 'stable',
          predictedNextWeek: { mood: 'neutral', confidence: 0 },
          historicalComparison: {
            currentPeriodAvg: 0,
            samePeriodLastYear: null,
            yearOverYearChange: null,
          },
          aiInsight: 'Keep tracking your mood to reveal temporal patterns. We need at least a week of data.',
          dataPoints: allMoodPoints.length,
          message: 'Insufficient data for temporal analysis',
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sort by date
    allMoodPoints.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Analyze patterns
    console.log('Analyzing weekly patterns...');
    const weeklyPattern = analysisType === 'all' || analysisType === 'weekly' 
      ? analyzeWeeklyPattern(allMoodPoints) 
      : null;

    console.log('Analyzing monthly patterns...');
    const monthlyPattern = analysisType === 'all' || analysisType === 'monthly' 
      ? analyzeMonthlyPattern(allMoodPoints) 
      : null;

    console.log('Analyzing seasonal patterns...');
    const seasonalPattern = analysisType === 'all' || analysisType === 'seasonal' 
      ? analyzeSeasonalPattern(allMoodPoints) 
      : null;

    // Calculate overall trend
    const overallTrend = calculateOverallTrend(allMoodPoints);

    // Calculate recent average (last 30 days)
    const recentPoints = allMoodPoints.filter(p => 
      new Date(p.created_at).getTime() > new Date(oneMonthAgo).getTime()
    );
    const recentAvg = recentPoints.length > 0 
      ? recentPoints.reduce((sum, p) => sum + p.mood_score, 0) / recentPoints.length 
      : 5;

    // Historical comparison (same period last year)
    const lastYearStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const lastYearEnd = new Date(lastYearStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    const lastYearPoints = allMoodPoints.filter(p => {
      const date = new Date(p.created_at);
      return date >= lastYearStart && date <= lastYearEnd;
    });
    const samePeriodLastYear = lastYearPoints.length > 0 
      ? lastYearPoints.reduce((sum, p) => sum + p.mood_score, 0) / lastYearPoints.length 
      : null;

    // Predict next week
    const prediction = predictNextWeek(weeklyPattern, monthlyPattern, recentAvg);

    // Generate AI insight
    console.log('Generating AI temporal insight...');
    const aiInsight = await generateTemporalInsight(
      weeklyPattern,
      monthlyPattern,
      seasonalPattern,
      overallTrend,
      recentAvg
    );

    // Store temporal analysis in user_insights
    await supabase.from('user_insights').insert([{
      user_id: userId,
      insight_type: 'temporal_analysis',
      insight_text: aiInsight,
      confidence_score: Math.max(
        weeklyPattern?.confidence || 0,
        monthlyPattern?.confidence || 0,
        seasonalPattern?.confidence || 0
      ),
    }]).select();

    console.log('Temporal pattern analysis complete');

    return new Response(JSON.stringify({
      success: true,
      analysis: {
        weeklyPattern,
        monthlyPattern,
        seasonalPattern,
        overallTrend,
        predictedNextWeek: prediction,
        historicalComparison: {
          currentPeriodAvg: Math.round(recentAvg * 10) / 10,
          samePeriodLastYear: samePeriodLastYear ? Math.round(samePeriodLastYear * 10) / 10 : null,
          yearOverYearChange: samePeriodLastYear 
            ? Math.round((recentAvg - samePeriodLastYear) * 10) / 10 
            : null,
        },
        aiInsight,
        dataPoints: allMoodPoints.length,
        dateRange: {
          start: allMoodPoints[0]?.created_at,
          end: allMoodPoints[allMoodPoints.length - 1]?.created_at,
        },
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Temporal pattern analysis error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
