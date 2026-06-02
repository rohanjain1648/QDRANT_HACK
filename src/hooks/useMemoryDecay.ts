import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DecayConfig {
  halfLifeDays?: number;
  minConfidence?: number;
  reinforceBoost?: number;
}

interface MemoryHealthData {
  totalInsights: number;
  activeInsights: number;
  fadingInsights: number;
  forgottenInsights: number;
  insights: Array<{
    id: string;
    text: string;
    type: string;
    baseConfidence: number;
    decayFactor: number;
    effectiveConfidence: number;
    status: 'active' | 'fading' | 'forgotten';
    daysSinceReinforced: number;
  }>;
}

interface ReinforcementCandidate {
  insightId: string;
  insightText: string;
  supportingMemories: number;
  avgSimilarity: number;
}

export function useMemoryDecay() {
  // Apply natural decay to all insights
  const applyDecay = useCallback(async (userId: string, config?: DecayConfig) => {
    const { data, error } = await supabase.functions.invoke('memory-decay', {
      body: { operation: 'apply_decay', userId, config },
    });

    if (error) {
      console.error('Apply decay error:', error);
      throw error;
    }

    return data.data as {
      processed: number;
      fadingCount: number;
      forgottenCount: number;
    };
  }, []);

  // Reinforce a specific insight
  const reinforceInsight = useCallback(async (
    userId: string,
    insightId: string,
    evidenceType: 'mood_pattern' | 'activity_correlation' | 'user_feedback' = 'user_feedback'
  ) => {
    const { data, error } = await supabase.functions.invoke('memory-decay', {
      body: { operation: 'reinforce', userId, insightId, evidenceType },
    });

    if (error) {
      console.error('Reinforce insight error:', error);
      throw error;
    }

    return data.data as {
      insightId: string;
      previousConfidence: number;
      newConfidence: number;
      evidenceType: string;
    };
  }, []);

  // Find insights that could be reinforced by recent activity
  const findReinforcementCandidates = useCallback(async (userId: string): Promise<ReinforcementCandidate[]> => {
    const { data, error } = await supabase.functions.invoke('memory-decay', {
      body: { operation: 'find_reinforcements', userId },
    });

    if (error) {
      console.error('Find reinforcements error:', error);
      throw error;
    }

    return data.data || [];
  }, []);

  // Get overall memory health status
  const getMemoryHealth = useCallback(async (userId: string, config?: DecayConfig): Promise<MemoryHealthData> => {
    const { data, error } = await supabase.functions.invoke('memory-decay', {
      body: { operation: 'health_check', userId, config },
    });

    if (error) {
      console.error('Memory health error:', error);
      throw error;
    }

    return data.data;
  }, []);

  // Auto-reinforce based on similarity matching
  const autoReinforce = useCallback(async (userId: string) => {
    // Find candidates that should be reinforced
    const candidates = await findReinforcementCandidates(userId);
    
    // Reinforce those with high similarity (> 75%)
    const reinforced = [];
    for (const candidate of candidates) {
      if (candidate.avgSimilarity > 0.75) {
        try {
          await reinforceInsight(userId, candidate.insightId, 'mood_pattern');
          reinforced.push(candidate);
        } catch (e) {
          console.error(`Failed to auto-reinforce ${candidate.insightId}:`, e);
        }
      }
    }

    return reinforced;
  }, [findReinforcementCandidates, reinforceInsight]);

  return {
    applyDecay,
    reinforceInsight,
    findReinforcementCandidates,
    getMemoryHealth,
    autoReinforce,
  };
}
