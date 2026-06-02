import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Collection = 'mood_memories' | 'therapy_sessions' | 'wellness_activities' | 'user_insights';

interface SearchFilter {
  mood_level?: string;
  activity_type?: string;
  date_range?: { start: string; end: string };
}

interface MemoryResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
  reasoning: string;
}

export function useQdrantMemory() {
  const storeMemory = useCallback(async (
    collection: Collection,
    text: string,
    metadata: Record<string, unknown>,
    userId: string,
    recordId: string
  ) => {
    const { data, error } = await supabase.functions.invoke('store-memory', {
      body: { collection, text, metadata, userId, recordId },
    });

    if (error) {
      console.error('Store memory error:', error);
      throw error;
    }

    return data;
  }, []);

  const searchMemories = useCallback(async (
    query: string,
    userId: string,
    collection: Collection,
    limit: number = 10,
    filter?: SearchFilter
  ): Promise<MemoryResult[]> => {
    const { data, error } = await supabase.functions.invoke('memory-search', {
      body: { query, userId, collection, limit, filter },
    });

    if (error) {
      console.error('Search memory error:', error);
      throw error;
    }

    return data.results || [];
  }, []);

  const getAIInsight = useCallback(async (
    type: 'mood_analysis' | 'pattern_detection' | 'recommendation' | 'session_summary',
    context: {
      moodHistory?: Array<{ mood_level: string; mood_score: number; journal_text?: string; created_at: string }>;
      activities?: Array<{ activity_type: string; activity_name: string; metrics?: Record<string, unknown> }>;
      currentMood?: { mood_level: string; mood_score: number; journal_text?: string };
      retrievedMemories?: MemoryResult[];
      sessionData?: Record<string, unknown>;
    }
  ) => {
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: { type, context },
    });

    if (error) {
      console.error('AI insight error:', error);
      throw error;
    }

    return data.insight;
  }, []);

  return {
    storeMemory,
    searchMemories,
    getAIInsight,
  };
}
