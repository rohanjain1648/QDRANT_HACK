import { motion } from "framer-motion";
import { Flower2, Search, Volume2, Play, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PoseCard } from "@/components/yoga/PoseCard";
import { PoseImageSearch } from "@/components/yoga/PoseImageSearch";
import { PersonalizedPoseRecommendations } from "@/components/yoga/PersonalizedPoseRecommendations";
import { cn } from "@/lib/utils";
import { yogaPosesData } from "@/data/yogaPoses";

const categories = ["All", "Standing", "Seated", "Kneeling", "Balancing", "Restorative", "Backbend", "Core", "Arm Balance"];

// Convert yogaPosesData to the format expected by the page
const poses = yogaPosesData.map((pose) => ({
  id: pose.id,
  name: pose.name,
  sanskritName: pose.sanskritName,
  duration: pose.duration,
  difficulty: pose.difficulty,
  benefits: pose.benefits,
  category: pose.category,
}));

const YogaPage = () => {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const filteredPoses = poses.filter((pose) => {
    const matchesCategory = selectedCategory === "All" || pose.category === selectedCategory;
    const matchesSearch = pose.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pose.sanskritName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Layout>
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wellness-lavender/50 text-accent-foreground mb-4">
              <Flower2 className="w-4 h-4" />
              <span className="text-sm font-medium">Yoga & Wellness</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Yoga Pose Library
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto mb-4">
              Explore our collection of yoga poses with detailed instructions, 
              benefits, and guided practice sessions.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm">
              <Volume2 className="w-4 h-4" />
              Click any pose for voice-guided instructions
            </div>
          </motion.div>

          {/* Personalized Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="max-w-4xl mx-auto mb-8"
          >
            <PersonalizedPoseRecommendations />
          </motion.div>

          {/* Visual Pose Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="max-w-4xl mx-auto mb-8"
          >
            <PoseImageSearch />
          </motion.div>

          {/* Flow Sequences Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-4xl mx-auto mb-8"
          >
            <Link
              to="/yoga/flow"
              className="block glass-card rounded-2xl p-6 hover:scale-[1.01] transition-all duration-300 group bg-gradient-to-r from-primary/5 to-wellness-lavender/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-wellness-teal flex items-center justify-center">
                    <Play className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors">
                      Yoga Flow Sequences
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Watch animated transitions between poses • 6 pre-built flows
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </motion.div>

          {/* Search and filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="max-w-4xl mx-auto mb-8"
          >
            {/* Search bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search poses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-full border border-border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Category filters */}
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Poses grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {filteredPoses.map((pose, index) => (
              <PoseCard
                key={pose.id}
                {...pose}
                delay={index}
                onClick={() => navigate(`/yoga/${pose.id}`)}
              />
            ))}
          </div>

          {filteredPoses.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-muted-foreground">No poses found. Try a different search.</p>
            </motion.div>
          )}

          {/* Features section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 glass-card rounded-3xl p-8 md:p-12 max-w-4xl mx-auto text-center"
          >
            <h2 className="font-display text-2xl font-semibold mb-4">
              Voice-Guided Sessions
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Each pose includes detailed voice guidance with breathing cues, 
              step-by-step instructions, and customizable voice settings.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Voice Instructions", "Breathing Cues", "Adjustable Speed", "Multiple Voices"].map((feature) => (
                <span
                  key={feature}
                  className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  {feature}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default YogaPage;
