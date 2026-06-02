import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MoodTracker } from '@/components/mood/MoodTracker';
import { PatternDetection } from '@/components/mood/PatternDetection';
import { TemporalPatterns } from '@/components/mood/TemporalPatterns';
import { MoodJournal } from '@/components/journal/MoodJournal';
import { VoiceJournal } from '@/components/journal/VoiceJournal';
import { RecommendationEngine } from '@/components/recommendations/RecommendationEngine';
import { MemoryHealth } from '@/components/memory/MemoryHealth';
import { EvidenceTrail } from '@/components/evidence/EvidenceTrail';
import { CrisisDetection } from '@/components/crisis/CrisisDetection';
import { ContextChains } from '@/components/memory/ContextChains';
import { ContradictionDetection } from '@/components/memory/ContradictionDetection';
import { MultiAgentWellness } from '@/components/agents/MultiAgentWellness';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, Heart, Sparkles, TrendingUp, Calendar,
  Activity, Zap, LogIn, User, BarChart3, BookOpen, Database, Mic, Shield, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalMoodEntries: number;
  totalSessions: number;
  currentStreak: number;
  avgMoodScore: number;
}

export default function MindFlowPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalMoodEntries: 0,
    totalSessions: 0,
    currentStreak: 0,
    avgMoodScore: 0,
  });
  
  const { user, signOut, loading } = useAuth();

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Fetch mood entries count and average
      const { data: moodData, count: moodCount } = await supabase
        .from('mood_entries')
        .select('mood_score', { count: 'exact' })
        .eq('user_id', user.id);

      // Fetch therapy sessions count
      const { count: sessionCount } = await supabase
        .from('therapy_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Calculate streak (simplified - count consecutive days)
      const { data: recentMoods } = await supabase
        .from('mood_entries')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      let streak = 0;
      if (recentMoods && recentMoods.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < recentMoods.length; i++) {
          const entryDate = new Date(recentMoods[i].created_at);
          entryDate.setHours(0, 0, 0, 0);
          const expectedDate = new Date(today);
          expectedDate.setDate(expectedDate.getDate() - i);
          
          if (entryDate.getTime() === expectedDate.getTime()) {
            streak++;
          } else if (i === 0 && entryDate.getTime() === expectedDate.getTime() - 86400000) {
            // Allow for yesterday if no entry today
            streak++;
          } else {
            break;
          }
        }
      }

      const avgScore = moodData && moodData.length > 0
        ? moodData.reduce((acc, m) => acc + m.mood_score, 0) / moodData.length
        : 0;

      setStats({
        totalMoodEntries: moodCount || 0,
        totalSessions: sessionCount || 0,
        currentStreak: streak,
        avgMoodScore: avgScore,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="flex items-center justify-center gap-3">
              <Brain className="h-10 w-10 text-primary" />
              <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">
                MindFlow
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your AI-powered wellness companion with long-term memory
            </p>

            {/* Auth Section */}
            <div className="flex items-center justify-center gap-4 pt-4">
              {loading ? (
                <div className="h-10 w-32 bg-muted animate-pulse rounded-full" />
              ) : user ? (
                <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-full">
                  <User className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{user.email}</span>
                  <Button variant="ghost" size="sm" onClick={signOut}>
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setAuthModalOpen(true)} className="btn-wellness">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In to Start
                </Button>
              )}
            </div>
          </motion.div>

          {/* Stats Cards */}
          {user && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <Card className="glass-card">
                <CardContent className="p-4 text-center">
                  <Calendar className="h-6 w-6 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold">{stats.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Day Streak</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4 text-center">
                  <Heart className="h-6 w-6 mx-auto text-wellness-lavender mb-2" />
                  <p className="text-2xl font-bold">{stats.totalMoodEntries}</p>
                  <p className="text-xs text-muted-foreground">Mood Logs</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4 text-center">
                  <Activity className="h-6 w-6 mx-auto text-wellness-sage mb-2" />
                  <p className="text-2xl font-bold">{stats.totalSessions}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto text-wellness-sky mb-2" />
                  <p className="text-2xl font-bold">{stats.avgMoodScore.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Avg Mood</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Tabs defaultValue="mood" className="space-y-6">
              <TabsList className="grid w-full max-w-5xl mx-auto grid-cols-8 glass-card">
                <TabsTrigger value="mood" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Heart className="h-4 w-4" />
                  <span className="hidden sm:inline">Mood</span>
                </TabsTrigger>
                <TabsTrigger value="journal" className="flex items-center gap-1 text-xs sm:text-sm">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Journal</span>
                </TabsTrigger>
                <TabsTrigger value="voice" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Mic className="h-4 w-4" />
                  <span className="hidden sm:inline">Voice</span>
                </TabsTrigger>
                <TabsTrigger value="patterns" className="flex items-center gap-1 text-xs sm:text-sm">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Patterns</span>
                </TabsTrigger>
                <TabsTrigger value="crisis" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Safety</span>
                </TabsTrigger>
                <TabsTrigger value="agents" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Agents</span>
                </TabsTrigger>
                <TabsTrigger value="memory" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline">Memory</span>
                </TabsTrigger>
                <TabsTrigger value="recommendations" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">For You</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mood" className="mt-6">
                <MoodTracker />
              </TabsContent>

              <TabsContent value="journal" className="mt-6">
                <MoodJournal />
              </TabsContent>

              <TabsContent value="voice" className="mt-6">
                <VoiceJournal />
              </TabsContent>

              <TabsContent value="patterns" className="mt-6 space-y-6">
                <PatternDetection />
                <TemporalPatterns />
              </TabsContent>

              <TabsContent value="crisis" className="mt-6">
                <CrisisDetection />
              </TabsContent>

              <TabsContent value="agents" className="mt-6">
                <MultiAgentWellness />
              </TabsContent>

              <TabsContent value="memory" className="mt-6 space-y-6">
                <ContradictionDetection />
                <ContextChains />
                <MemoryHealth />
                <EvidenceTrail />
              </TabsContent>

              <TabsContent value="recommendations" className="mt-6">
                <RecommendationEngine />
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link to="/games/breathing">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                      <span className="text-2xl">🫁</span>
                      <span className="text-sm">Breathe</span>
                    </Button>
                  </Link>
                  <Link to="/yoga">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                      <span className="text-2xl">🧘</span>
                      <span className="text-sm">Yoga</span>
                    </Button>
                  </Link>
                  <Link to="/games">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                      <span className="text-2xl">🎮</span>
                      <span className="text-sm">Games</span>
                    </Button>
                  </Link>
                  <Link to="/games/mood">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                      <span className="text-2xl">🎨</span>
                      <span className="text-sm">Colors</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Qdrant Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card bg-gradient-to-r from-primary/5 to-wellness-lavender/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Brain className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-lg mb-2">
                      Powered by Qdrant Vector Search
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      MindFlow uses semantic memory to understand your wellness journey over time. 
                      Every mood entry, activity, and insight is embedded and stored for intelligent retrieval.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Semantic Search
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Voice + Text Multimodal
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Emotion Detection
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Memory Decay
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Crisis Detection
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Evidence-based AI
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </Layout>
  );
}
