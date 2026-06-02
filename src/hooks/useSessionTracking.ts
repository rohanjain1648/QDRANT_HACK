import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQdrantMemory } from './useQdrantMemory';
import type { Json } from '@/integrations/supabase/types';

type ActivityType = 'breathing' | 'yoga' | 'game' | 'mood_entry' | 'therapy_session' | 'laughter';
type MoodLevel = 'very_low' | 'low' | 'neutral' | 'good' | 'great';

interface SessionData {
  activityType: ActivityType;
  activityName: string;
  durationSeconds: number;
  moodBefore?: MoodLevel;
  moodAfter?: MoodLevel;
  metrics?: Record<string, unknown>;
  notes?: string;
}

interface ActivityData {
  activityType: ActivityType;
  activityId: string;
  accuracyScore?: number;
  completionStatus?: string;
  feedback?: string;
  metadata?: Record<string, unknown>;
}

export function useSessionTracking() {
  const { storeMemory, getAIInsight } = useQdrantMemory();

  const startSession = useCallback(async (
    userId: string,
    activityType: ActivityType,
    activityName: string
  ) => {
    const startTime = Date.now();
    
    return {
      startTime,
      activityType,
      activityName,
      userId,
    };
  }, []);

  const endSession = useCallback(async (
    session: { startTime: number; activityType: ActivityType; activityName: string; userId: string },
    options: {
      moodBefore?: MoodLevel;
      moodAfter?: MoodLevel;
      metrics?: Record<string, unknown>;
      notes?: string;
    } = {}
  ) => {
    const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);

    const { data: therapySession, error } = await supabase
      .from('therapy_sessions')
      .insert([{
        user_id: session.userId,
        session_type: session.activityType,
        activity_name: session.activityName,
        duration_seconds: durationSeconds,
        mood_before: options.moodBefore,
        mood_after: options.moodAfter,
        metrics: (options.metrics || {}) as Json,
        notes: options.notes,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving session:', error);
      throw error;
    }

    // Store in Qdrant for semantic search
    const textForEmbedding = `${session.activityType} session: ${session.activityName}. Duration: ${durationSeconds} seconds. ${
      options.moodBefore && options.moodAfter 
        ? `Mood changed from ${options.moodBefore} to ${options.moodAfter}.` 
        : ''
    } ${options.notes || ''}`;

    await storeMemory(
      'therapy_sessions',
      textForEmbedding,
      {
        session_type: session.activityType,
        activity_name: session.activityName,
        duration_seconds: durationSeconds,
        mood_before: options.moodBefore,
        mood_after: options.moodAfter,
        created_at: therapySession.created_at,
      },
      session.userId,
      therapySession.id
    );

    // Get session summary insight
    let sessionSummary: string | null = null;
    try {
      sessionSummary = await getAIInsight('session_summary', {
        sessionData: {
          activityType: session.activityType,
          activityName: session.activityName,
          durationSeconds,
          moodBefore: options.moodBefore,
          moodAfter: options.moodAfter,
          metrics: options.metrics,
        },
      });
    } catch (e) {
      console.log('Could not generate session summary');
    }

    return {
      session: therapySession,
      summary: sessionSummary,
    };
  }, [storeMemory, getAIInsight]);

  const trackActivity = useCallback(async (
    userId: string,
    data: ActivityData
  ) => {
    const { data: activity, error } = await supabase
      .from('wellness_activities')
      .insert([{
        user_id: userId,
        activity_type: data.activityType,
        activity_id: data.activityId,
        accuracy_score: data.accuracyScore,
        completion_status: data.completionStatus || 'completed',
        feedback: data.feedback,
        metadata: (data.metadata || {}) as Json,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error tracking activity:', error);
      throw error;
    }

    // Store in Qdrant
    const textForEmbedding = `${data.activityType} activity: ${data.activityId}. ${
      data.accuracyScore ? `Accuracy: ${data.accuracyScore}%.` : ''
    } ${data.feedback || ''}`;

    await storeMemory(
      'wellness_activities',
      textForEmbedding,
      {
        activity_type: data.activityType,
        activity_id: data.activityId,
        accuracy_score: data.accuracyScore,
        completion_status: data.completionStatus,
        created_at: activity.created_at,
      },
      userId,
      activity.id
    );

    return activity;
  }, [storeMemory]);

  const createInsight = useCallback(async (
    userId: string,
    insightType: string,
    insightText: string,
    evidenceIds: string[] = []
  ) => {
    const { data: insight, error } = await supabase
      .from('user_insights')
      .insert([{
        user_id: userId,
        insight_type: insightType,
        insight_text: insightText,
        evidence_ids: evidenceIds,
        confidence_score: 0.5,
        decay_factor: 1.0,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating insight:', error);
      throw error;
    }

    // Store in Qdrant
    await storeMemory(
      'user_insights',
      insightText,
      {
        insight_type: insightType,
        confidence_score: 0.5,
        evidence_count: evidenceIds.length,
        created_at: insight.created_at,
      },
      userId,
      insight.id
    );

    return insight;
  }, [storeMemory]);

  const reinforceInsight = useCallback(async (insightId: string) => {
    // Increase confidence and reset decay
    const { data: current } = await supabase
      .from('user_insights')
      .select('confidence_score')
      .eq('id', insightId)
      .single();

    const newScore = Math.min(0.99, (Number(current?.confidence_score) || 0.5) + 0.1);

    const { error } = await supabase
      .from('user_insights')
      .update({
        confidence_score: newScore,
        decay_factor: 1.0,
        last_reinforced_at: new Date().toISOString(),
      })
      .eq('id', insightId);

    if (error) {
      console.error('Error reinforcing insight:', error);
      throw error;
    }
  }, []);

  return {
    startSession,
    endSession,
    trackActivity,
    createInsight,
    reinforceInsight,
  };
}
