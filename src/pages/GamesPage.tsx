import { motion } from "framer-motion";
import { Brain, Wind, Palette, MessageCircle, Target } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { GameCard } from "@/components/games/GameCard";

const games = [
  {
    title: "Breathing Ball",
    description: "Calming breathing exercises with visual guidance to reduce anxiety and stress.",
    icon: Wind,
    href: "/games/breathing",
    color: "teal" as const,
  },
  {
    title: "Memory Match",
    description: "Enhance your memory and pattern recognition with beautiful nature-themed cards.",
    icon: Brain,
    href: "/games/memory",
    color: "lavender" as const,
  },
  {
    title: "Find the Ball",
    description: "Improve focus and visual tracking with this classic shell game.",
    icon: Target,
    href: "/games/shell",
    color: "sage" as const,
  },
  {
    title: "Mood Colors",
    description: "Develop emotional awareness through color psychology exploration.",
    icon: Palette,
    href: "/games/mood",
    color: "peach" as const,
  },
  {
    title: "Word Flow",
    description: "Build cognitive flexibility with creative word associations.",
    icon: MessageCircle,
    href: "/games/words",
    color: "sky" as const,
  },
];

const GamesPage = () => {
  return (
    <Layout>
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Brain className="w-4 h-4" />
              <span className="text-sm font-medium">Mind Games</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Train Your Mind
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Engaging games designed to improve cognitive function, reduce stress, 
              and promote mental well-being through play.
            </p>
          </motion.div>

          {/* Games Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {games.map((game, index) => (
              <GameCard
                key={game.title}
                {...game}
                delay={index}
              />
            ))}
          </div>

          {/* Benefits section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 glass-card rounded-3xl p-8 md:p-12 max-w-4xl mx-auto"
          >
            <h2 className="font-display text-2xl font-semibold mb-6 text-center">
              Benefits of Mind Games
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: "Improved Focus", desc: "Strengthen your attention span and concentration" },
                { title: "Better Memory", desc: "Enhance short-term and working memory capacity" },
                { title: "Stress Relief", desc: "Reduce anxiety through mindful engagement" },
                { title: "Cognitive Flexibility", desc: "Build mental adaptability and problem-solving skills" },
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium mb-1">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default GamesPage;
