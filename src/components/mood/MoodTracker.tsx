import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useQdrantMemory } from '@/hooks/useQdrantMemory';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Smile, Meh, Frown, ThumbsUp, Sun, Moon, Cloud, 
  Loader2, Sparkles, Brain, TrendingUp, History 
} from 'lucide-react';

const moodLevels = [
  { value: 'great', score: 9, icon: Sun, label: 'Great', color: 'bg-wellness-mint text-green-700' },
  { value: 'good', score: 7, icon: Smile, label: 'Good', color: 'bg-wellness-sky text-blue-700' },
  { value: 'neutral', score: 5, icon: Meh, label: 'Okay', color: 'bg-wellness-peach text-orange-700' },
  { value: 'low', score: 3, icon: Cloud, label: 'Low', color: 'bg-wellness-lavender text-purple-700' },
  { value: 'very_low', score: 1, icon: Frown, label: 'Struggling', color: 'bg-destructive/20 text-destructive' },
] as const;

const contextTags = [
  'Work', 'Relationships', 'Health', 'Sleep', 'Exercise', 
  'Anxiety', 'Gratitude', 'Achievement', 'Stress', 'Peace'
];

interface MoodEntry {
  id: string;
  mood_level: string;
  mood_score: number;
  journal_text: string | null;
  tags: string[];
  created_at: string;
}

export function MoodTracker() {
  const [selectedMood, setSelectedMood] = useState<typeof moodLevels[number] | null>(null);
  const [journalText, setJournalText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [recentEntries, setRecentEntries] = useState<MoodEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const { user } = useAuth();
  const { storeMemory, getAIInsight } = useQdrantMemory();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchRecentEntries();
    }
  }, [user]);

  const fetchRecentEntries = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(7);
    
    if (!error && data) {
      setRecentEntries(data as MoodEntry[]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMood || !user) return;
    
    setIsSubmitting(true);
    
    try {
      // Insert mood entry to database
      const { data: entry, error } = await supabase
        .from('mood_entries')
        .insert({
          user_id: user.id,
          mood_level: selectedMood.value,
          mood_score: selectedMood.score,
          journal_text: journalText || null,
          tags: selectedTags,
          context: { tags: selectedTags },
        })
        .select()
        .single();

      if (error) throw error;

      // Store in Qdrant for semantic search
      const textForEmbedding = `Mood: ${selectedMood.label}. ${journalText ? `Thoughts: ${journalText}` : ''} ${selectedTags.length > 0 ? `Context: ${selectedTags.join(', ')}` : ''}`;
      
      await storeMemory(
        'mood_memories',
        textForEmbedding,
        {
          mood_level: selectedMood.value,
          mood_score: selectedMood.score,
          tags: selectedTags,
          created_at: entry.created_at,
        },
        user.id,
        entry.id
      );

      // Get AI insight
      const insight = await getAIInsight('mood_analysis', {
        currentMood: {
          mood_level: selectedMood.value,
          mood_score: selectedMood.score,
          journal_text: journalText,
        },
        moodHistory: recentEntries.map(e => ({
          mood_level: e.mood_level,
          mood_score: e.mood_score,
          journal_text: e.journal_text || undefined,
          created_at: e.created_at,
        })),
      });

      setAiInsight(insight);
      
      toast({
        title: 'Mood recorded 💚',
        description: 'Your entry has been saved and analyzed.',
      });

      // Reset form
      setSelectedMood(null);
      setJournalText('');
      setSelectedTags([]);
      fetchRecentEntries();
      
    } catch (error) {
      console.error('Error saving mood:', error);
      toast({
        title: 'Error',
        description: 'Failed to save mood entry. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  if (!user) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center">
          <Brain className="h-12 w-12 mx-auto text-primary/50 mb-4" />
          <p className="text-muted-foreground">Sign in to start tracking your mood and build your wellness memory.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            How are you feeling right now?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mood Selection */}
          <div className="flex flex-wrap justify-center gap-3">
            {moodLevels.map((mood) => {
              const Icon = mood.icon;
              return (
                <motion.button
                  key={mood.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedMood(mood)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                    selectedMood?.value === mood.value
                      ? `${mood.color} ring-2 ring-primary shadow-lg`
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <Icon className="h-8 w-8" />
                  <span className="text-sm font-medium">{mood.label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Journal Entry */}
          <AnimatePresence>
            {selectedMood && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <Textarea
                  placeholder="What's on your mind? (optional but helps AI understand you better)"
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                  className="min-h-[100px] resize-none"
                />

                {/* Context Tags */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Add context (optional):</p>
                  <div className="flex flex-wrap gap-2">
                    {contextTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer transition-all hover:scale-105"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting}
                  className="w-full btn-wellness"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Save & Analyze
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* AI Insight */}
      <AnimatePresence>
        {aiInsight && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Insight
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{aiInsight}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent History */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Recent Mood
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide' : 'Show All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {recentEntries.slice(0, showHistory ? undefined : 5).map((entry) => {
              const mood = moodLevels.find(m => m.value === entry.mood_level);
              const Icon = mood?.icon || Meh;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl ${mood?.color || 'bg-muted'} min-w-[70px]`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">
                    {new Date(entry.created_at).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </motion.div>
              );
            })}
          </div>
          {recentEntries.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Average mood score: {(recentEntries.reduce((acc, e) => acc + e.mood_score, 0) / recentEntries.length).toFixed(1)}/10
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
