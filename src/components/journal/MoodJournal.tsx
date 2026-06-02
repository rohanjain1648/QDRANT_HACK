import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQdrantMemory } from '@/hooks/useQdrantMemory';
import { 
  Search, 
  BookOpen, 
  Plus, 
  Calendar,
  Sparkles,
  Database,
  Bold,
  Italic,
  List,
  Quote,
  Save,
  X,
  Heart,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface JournalEntry {
  id: string;
  journal_text: string;
  mood_level: string;
  mood_score: number;
  tags: string[] | null;
  created_at: string;
  semanticScore?: number;
  isSemanticMatch?: boolean;
}

const moodColors: Record<string, string> = {
  very_low: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  low: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
  neutral: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  good: 'bg-lime-500/20 text-lime-700 dark:text-lime-300 border-lime-500/30',
  great: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
};

const moodEmojis: Record<string, string> = {
  very_low: '😢',
  low: '😔',
  neutral: '😐',
  good: '🙂',
  great: '😊',
};

const moodLabels: Record<string, string> = {
  very_low: 'Very Low',
  low: 'Low',
  neutral: 'Neutral',
  good: 'Good',
  great: 'Great',
};

type MoodLevel = 'very_low' | 'low' | 'neutral' | 'good' | 'great';

export function MoodJournal() {
  const { user } = useAuth();
  const { storeMemory } = useQdrantMemory();
  const [activeTab, setActiveTab] = useState<'browse' | 'write' | 'search'>('browse');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchResults, setSearchResults] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [totalQdrantMatches, setTotalQdrantMatches] = useState(0);

  // New entry state
  const [newMood, setNewMood] = useState<MoodLevel>('neutral');
  const [newMoodScore, setNewMoodScore] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', user.id)
        .not('journal_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (moodFilter !== 'all') {
        query = query.eq('mood_level', moodFilter as MoodLevel);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error('Error fetching journal entries:', err);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, [user, moodFilter]);

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user, moodFilter, fetchEntries]);

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) return;

    setIsSearching(true);
    setSearchSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke('journal-search', {
        body: {
          query: searchQuery,
          userId: user.id,
          limit: 20,
          moodFilter: moodFilter !== 'all' ? moodFilter : undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        setSearchResults(data.results);
        setSearchSummary(data.summary);
        setTotalQdrantMatches(data.totalQdrantMatches);
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const applyFormatting = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const saveEntry = async () => {
    if (!user || !editorRef.current) return;

    const content = editorRef.current.innerHTML;
    const plainText = editorRef.current.innerText;

    if (!plainText.trim()) {
      toast.error('Please write something in your journal');
      return;
    }

    setIsSaving(true);
    try {
      // Save to Supabase
      const { data: entry, error } = await supabase
        .from('mood_entries')
        .insert([{
          user_id: user.id,
          journal_text: content,
          mood_level: newMood,
          mood_score: newMoodScore,
          tags: [],
          context: { source: 'journal' },
        }])
        .select()
        .single();

      if (error) throw error;

      // Store in Qdrant for semantic search
      await storeMemory(
        'mood_memories',
        plainText,
        {
          mood_level: newMood,
          mood_score: newMoodScore,
          has_journal: true,
          created_at: new Date().toISOString(),
        },
        user.id,
        entry.id
      );

      toast.success('Journal entry saved!');
      
      // Clear editor and refresh entries
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      setNewMood('neutral');
      setNewMoodScore(5);
      setActiveTab('browse');
      fetchEntries();
    } catch (err) {
      console.error('Error saving entry:', err);
      toast.error('Failed to save journal entry');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to access your journal</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Mood Journal
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse" className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="write" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Write
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-1">
              <Search className="w-4 h-4" />
              Search
            </TabsTrigger>
          </TabsList>

          {/* Browse Tab */}
          <TabsContent value="browse" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Select value={moodFilter} onValueChange={setMoodFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by mood" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Moods</SelectItem>
                  <SelectItem value="great">😊 Great</SelectItem>
                  <SelectItem value="good">🙂 Good</SelectItem>
                  <SelectItem value="neutral">😐 Neutral</SelectItem>
                  <SelectItem value="low">😔 Low</SelectItem>
                  <SelectItem value="very_low">😢 Very Low</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {entries.length} entries
              </span>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              <AnimatePresence>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8"
                  >
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No journal entries yet</p>
                    <Button 
                      variant="link" 
                      onClick={() => setActiveTab('write')}
                      className="mt-2"
                    >
                      Write your first entry
                    </Button>
                  </motion.div>
                ) : (
                  entries.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className={moodColors[entry.mood_level]}>
                          {moodEmojis[entry.mood_level]} {moodLabels[entry.mood_level]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div 
                        className="text-sm text-muted-foreground line-clamp-3 prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: entry.journal_text || '' }}
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* Write Tab */}
          <TabsContent value="write" className="mt-4 space-y-4">
            {/* Mood Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">How are you feeling?</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(moodEmojis).map(([mood, emoji]) => (
                  <Button
                    key={mood}
                    variant={newMood === mood ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setNewMood(mood as MoodLevel);
                      const scores: Record<string, number> = {
                        very_low: 2, low: 4, neutral: 5, good: 7, great: 9
                      };
                      setNewMoodScore(scores[mood]);
                    }}
                    className={newMood === mood ? '' : moodColors[mood]}
                  >
                    {emoji} {moodLabels[mood]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Rich Text Editor */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyFormatting('bold')}
                  className="h-8 w-8 p-0"
                >
                  <Bold className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyFormatting('italic')}
                  className="h-8 w-8 p-0"
                >
                  <Italic className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyFormatting('insertUnorderedList')}
                  className="h-8 w-8 p-0"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    document.execCommand('formatBlock', false, 'blockquote');
                    editorRef.current?.focus();
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Quote className="w-4 h-4" />
                </Button>
              </div>

              <div
                ref={editorRef}
                contentEditable
                className="min-h-[200px] p-4 rounded-lg border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20 prose prose-sm dark:prose-invert max-w-none empty:before:content-['Write_about_your_day,_thoughts,_or_feelings...'] empty:before:text-muted-foreground empty:before:pointer-events-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (editorRef.current) editorRef.current.innerHTML = '';
                  setNewMood('neutral');
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
              <Button onClick={saveEntry} disabled={isSaving}>
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Save Entry
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search your journal entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Database className="w-4 h-4 animate-pulse" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Brain className="w-3 h-3" />
              <span>Powered by Qdrant semantic search</span>
            </div>

            {/* AI Summary */}
            <AnimatePresence>
              {searchSummary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-lg bg-primary/5 border border-primary/10"
                >
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-primary mb-1">AI Summary</p>
                      <p className="text-sm text-muted-foreground">{searchSummary}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Qdrant Stats */}
            {searchResults.length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <Database className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  Found <strong className="text-foreground">{totalQdrantMatches}</strong> semantic matches
                </span>
              </div>
            )}

            {/* Search Results */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
              <AnimatePresence>
                {isSearching ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : searchResults.length === 0 && searchQuery ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8"
                  >
                    <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No matching entries found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try different keywords</p>
                  </motion.div>
                ) : (
                  searchResults.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-primary/20"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={moodColors[entry.mood_level]}>
                            {moodEmojis[entry.mood_level]} {moodLabels[entry.mood_level]}
                          </Badge>
                          {entry.semanticScore && (
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(entry.semanticScore * 100)}% match
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div 
                        className="text-sm text-muted-foreground line-clamp-3 prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: entry.journal_text || '' }}
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
