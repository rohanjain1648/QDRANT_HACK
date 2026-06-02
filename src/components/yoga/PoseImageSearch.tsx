import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  Sparkles, 
  ArrowRight,
  X,
  Loader2,
  Star,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { yogaPosesData } from '@/data/yogaPoses';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface SearchResult {
  poseId: string;
  poseName: string;
  sanskritName: string;
  category: string;
  difficulty: number;
  benefits: string[];
  score: number;
  matchReason: string;
}

export const PoseImageSearch = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchMode, setSearchMode] = useState<'text' | 'image'>('text');
  const [textQuery, setTextQuery] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Index all poses on first use
  const indexAllPoses = useCallback(async () => {
    setIsIndexing(true);
    try {
      const poses = yogaPosesData.map(pose => ({
        poseId: pose.id,
        poseName: pose.name,
        sanskritName: pose.sanskritName,
        category: pose.category,
        difficulty: pose.difficulty,
        benefits: pose.benefits,
        description: `${pose.name} (${pose.sanskritName}) is a ${pose.category.toLowerCase()} yoga pose. ${pose.benefits.join('. ')}. Difficulty level ${pose.difficulty} out of 5.`,
      }));

      const { data, error } = await supabase.functions.invoke('pose-image-search', {
        body: { action: 'index-all', poses },
      });

      if (error) throw error;
      toast.success(`Indexed ${data.indexed} yoga poses for visual search`);
    } catch (error) {
      console.error('Index error:', error);
      toast.error('Failed to index poses');
    } finally {
      setIsIndexing(false);
    }
  }, []);

  // Text-based search
  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    
    setIsSearching(true);
    setSearchQuery(textQuery);
    
    try {
      const { data, error } = await supabase.functions.invoke('pose-image-search', {
        body: { action: 'search', mode: 'text', text: textQuery, limit: 6 },
      });

      if (error) throw error;
      setResults(data.results || []);
      
      if (data.results?.length === 0) {
        toast.info('No matching poses found. Try indexing the pose library first.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Make sure poses are indexed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Image upload handler
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // Image-based search
  const handleImageSearch = async () => {
    if (!uploadedImage) return;
    
    setIsSearching(true);
    setSearchQuery('Uploaded image analysis');
    
    try {
      const { data, error } = await supabase.functions.invoke('pose-image-search', {
        body: { action: 'search', mode: 'upload', image: uploadedImage, limit: 6 },
      });

      if (error) throw error;
      setResults(data.results || []);
      setSearchQuery(data.query || 'Visual analysis');
      
      if (data.results?.length === 0) {
        toast.info('No matching poses found. The image may not contain a recognizable yoga pose.');
      }
    } catch (error) {
      console.error('Image search error:', error);
      toast.error('Image search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const clearImage = () => {
    setUploadedImage(null);
    setResults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Visual Pose Search</h3>
              <p className="text-sm text-muted-foreground font-normal">
                Find poses using images or natural language
              </p>
            </div>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={indexAllPoses}
            disabled={isIndexing}
          >
            {isIndexing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Indexing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Index Library
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'text' | 'image')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Text Search
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Image Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Describe a pose... (e.g., 'standing balance with arms overhead')"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSearch()}
                className="flex-1"
              />
              <Button onClick={handleTextSearch} disabled={isSearching || !textQuery.trim()}>
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <p className="text-xs text-muted-foreground w-full">Try:</p>
              {['standing balance pose', 'deep stretch for hamstrings', 'relaxing restorative pose', 'core strengthening'].map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => {
                    setTextQuery(suggestion);
                  }}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="image" className="mt-4 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {!uploadedImage ? (
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm font-medium">Upload a yoga pose image</p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, or WebP up to 5MB
                </p>
              </motion.div>
            ) : (
              <div className="relative">
                <div className="aspect-video rounded-xl overflow-hidden bg-muted">
                  <img
                    src={uploadedImage}
                    alt="Uploaded pose"
                    className="w-full h-full object-contain"
                  />
                </div>
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={clearImage}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  className="w-full mt-4"
                  onClick={handleImageSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing pose...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Find Similar Poses
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Results */}
        <AnimatePresence mode="wait">
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Results for: <span className="text-primary">{searchQuery}</span>
                </h4>
                <Badge variant="secondary">{results.length} matches</Badge>
              </div>

              <div className="grid gap-3">
                {results.map((result, index) => (
                  <motion.div
                    key={result.poseId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-md transition-all group"
                      onClick={() => navigate(`/yoga/${result.poseId}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">🧘</span>
                              <h5 className="font-medium">{result.poseName}</h5>
                              <Badge variant="outline" className="text-xs">
                                {result.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground italic mb-2">
                              {result.sanskritName}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${i < result.difficulty ? 'text-primary fill-primary' : 'text-muted'}`}
                                  />
                                ))}
                              </span>
                              <span>{result.matchReason}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-primary">
                                {Math.round(result.score * 100)}%
                              </div>
                              <p className="text-xs text-muted-foreground">match</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!isSearching && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Search for poses using text descriptions or upload an image
            </p>
            <p className="text-xs mt-1">
              Click "Index Library" first to enable searching
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
