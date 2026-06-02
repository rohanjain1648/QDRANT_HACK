import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useQdrantMemory } from '@/hooks/useQdrantMemory';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, Wind, Gamepad2, Dumbbell, Brain, 
  ThumbsUp, ThumbsDown, RefreshCw, Loader2, 
  ArrowRight, Star, Heart 
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Recommendation {
  id: string;
  type: 'breathing' | 'game' | 'yoga' | 'mood';
  title: string;
  description: string;
  link: string;
  icon: typeof Wind;
  reason: string;
  confidence: number;
}

const activityIcons = {
  breathing: Wind,
  game: Gamepad2,
  yoga: Dumbbell,
  mood: Brain,
};

const activityLinks = {
  breathing: '/games/breathing',
  game: '/games',
  yoga: '/yoga',
  mood: '/mindflow',
};

export function RecommendationEngine() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { searchMemories, getAIInsight } = useQdrantMemory();
  const { toast } = useToast();

  const generateRecommendations = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Fetch recent mood entries
      const { data: moodEntries } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent activities
      const { data: activities } = await supabase
        .from('therapy_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Search for similar past situations that helped
      let relevantMemories: Array<{ id: string; payload: Record<string, unknown>; score: number; reasoning: string }> = [];
      
      if (moodEntries && moodEntries.length > 0) {
        const currentMood = moodEntries[0];
        const searchQuery = `Feeling ${currentMood.mood_level}. Looking for activities that helped in similar situations.`;
        
        try {
          relevantMemories = await searchMemories(
            searchQuery,
            user.id,
            'therapy_sessions',
            5
          );
        } catch (e) {
          console.log('No therapy session memories yet');
        }
      }

      // Get AI recommendations
      const insight = await getAIInsight('recommendation', {
        moodHistory: moodEntries?.map(e => ({
          mood_level: e.mood_level,
          mood_score: e.mood_score,
          journal_text: e.journal_text || undefined,
          created_at: e.created_at,
        })) || [],
        activities: activities?.map(a => ({
          activity_type: a.session_type,
          activity_name: a.activity_name,
          metrics: a.metrics as Record<string, unknown> || {},
        })) || [],
        currentMood: moodEntries?.[0] ? {
          mood_level: moodEntries[0].mood_level,
          mood_score: moodEntries[0].mood_score,
          journal_text: moodEntries[0].journal_text || undefined,
        } : undefined,
        retrievedMemories: relevantMemories,
      });

      setAiReasoning(insight);

      // Generate activity recommendations based on context
      const newRecommendations: Recommendation[] = [];
      const currentMoodScore = moodEntries?.[0]?.mood_score || 5;

      if (currentMoodScore <= 4) {
        // Lower mood - suggest calming activities
        newRecommendations.push({
          id: 'breathing-1',
          type: 'breathing',
          title: 'Breathing Exercise',
          description: 'A gentle 4-7-8 breathing pattern to calm your mind',
          link: '/games/breathing',
          icon: Wind,
          reason: 'Recommended for stress relief based on your current mood',
          confidence: 0.9,
        });
        newRecommendations.push({
          id: 'yoga-1',
          type: 'yoga',
          title: 'Restorative Yoga',
          description: 'Gentle poses to release tension and restore balance',
          link: '/yoga',
          icon: Dumbbell,
          reason: 'Yoga has helped users with similar mood patterns',
          confidence: 0.85,
        });
      } else {
        // Higher mood - suggest engaging activities
        newRecommendations.push({
          id: 'game-1',
          type: 'game',
          title: 'Memory Match',
          description: 'Train your brain with this fun memory game',
          link: '/games/memory',
          icon: Gamepad2,
          reason: 'Great for maintaining positive momentum',
          confidence: 0.8,
        });
        newRecommendations.push({
          id: 'yoga-2',
          type: 'yoga',
          title: 'Energizing Flow',
          description: 'Build strength and energy with dynamic poses',
          link: '/yoga/flow',
          icon: Dumbbell,
          reason: 'Matches your current energy level',
          confidence: 0.75,
        });
      }

      // Always suggest mood tracking
      newRecommendations.push({
        id: 'mood-1',
        type: 'mood',
        title: 'Log Your Mood',
        description: 'Track how you feel to build your wellness memory',
        link: '/mindflow',
        icon: Brain,
        reason: 'Regular tracking improves AI recommendations',
        confidence: 0.95,
      });

      setRecommendations(newRecommendations);
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate recommendations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, searchMemories, getAIInsight, toast]);

  useEffect(() => {
    if (user) {
      generateRecommendations();
    }
  }, [user, generateRecommendations]);

  const handleFeedback = async (recId: string, wasHelpful: boolean) => {
    if (!user) return;
    
    try {
      const rec = recommendations.find(r => r.id === recId);
      if (!rec) return;

      await supabase.from('recommendations').insert({
        user_id: user.id,
        recommendation_type: rec.type,
        content: { title: rec.title, description: rec.description },
        context_summary: aiReasoning,
        was_helpful: wasHelpful,
      });

      toast({
        title: wasHelpful ? 'Thanks! 💚' : 'Noted!',
        description: wasHelpful 
          ? "We'll show more like this" 
          : "We'll adjust future recommendations",
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  };

  if (!user) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4" />
          <p className="text-muted-foreground">Sign in to get personalized wellness recommendations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Personalized For You
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={generateRecommendations}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {recommendations.map((rec, index) => {
                  const Icon = rec.icon;
                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-primary/10">
                              <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{rec.title}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(rec.confidence * 100)}% match
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                              <p className="text-xs text-primary/80 flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {rec.reason}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Link to={rec.link}>
                                <Button size="sm" className="btn-wellness">
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleFeedback(rec.id, true)}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleFeedback(rec.id, false)}
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Reasoning */}
      {aiReasoning && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              Why These Recommendations?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{aiReasoning}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
