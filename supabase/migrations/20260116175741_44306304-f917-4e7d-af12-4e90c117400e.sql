-- Create enum for mood levels
CREATE TYPE mood_level AS ENUM ('very_low', 'low', 'neutral', 'good', 'great');

-- Create enum for activity types
CREATE TYPE activity_type AS ENUM ('breathing', 'yoga', 'game', 'mood_entry', 'therapy_session', 'laughter');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mood_entries table for emotional timeline
CREATE TABLE public.mood_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_level mood_level NOT NULL,
  mood_score INTEGER NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
  journal_text TEXT,
  context JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  qdrant_point_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create therapy_sessions table for multimodal session memory
CREATE TABLE public.therapy_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type activity_type NOT NULL,
  activity_name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  mood_before mood_level,
  mood_after mood_level,
  metrics JSONB DEFAULT '{}',
  notes TEXT,
  qdrant_point_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wellness_activities table for cross-modal activity tracking
CREATE TABLE public.wellness_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  activity_id TEXT NOT NULL,
  accuracy_score DECIMAL(5,2),
  completion_status TEXT DEFAULT 'completed',
  feedback TEXT,
  metadata JSONB DEFAULT '{}',
  qdrant_point_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_insights table for evolving knowledge graph
CREATE TABLE public.user_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.50,
  evidence_ids UUID[] DEFAULT '{}',
  decay_factor DECIMAL(3,2) DEFAULT 1.00,
  last_reinforced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  qdrant_point_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recommendations table for learning loop
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  content JSONB NOT NULL,
  context_summary TEXT,
  was_accepted BOOLEAN,
  was_helpful BOOLEAN,
  user_feedback TEXT,
  qdrant_point_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for mood_entries
CREATE POLICY "Users can view their own mood entries" ON public.mood_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own mood entries" ON public.mood_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own mood entries" ON public.mood_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own mood entries" ON public.mood_entries FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for therapy_sessions
CREATE POLICY "Users can view their own therapy sessions" ON public.therapy_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own therapy sessions" ON public.therapy_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own therapy sessions" ON public.therapy_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own therapy sessions" ON public.therapy_sessions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for wellness_activities
CREATE POLICY "Users can view their own wellness activities" ON public.wellness_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own wellness activities" ON public.wellness_activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own wellness activities" ON public.wellness_activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own wellness activities" ON public.wellness_activities FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_insights
CREATE POLICY "Users can view their own insights" ON public.user_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own insights" ON public.user_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own insights" ON public.user_insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own insights" ON public.user_insights FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for recommendations
CREATE POLICY "Users can view their own recommendations" ON public.recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own recommendations" ON public.recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recommendations" ON public.recommendations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recommendations" ON public.recommendations FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_insights_updated_at BEFORE UPDATE ON public.user_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Note: The trigger on auth.users is created differently since we can't directly attach triggers to auth schema
-- This will need to be handled via a database webhook or edge function