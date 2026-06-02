import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Brain, Flower2, Heart, Sparkles, ArrowRight, Database, Cpu, Network } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import heroImage from "@/assets/hero-wellness.jpg";
import qdrantArchitecture from "@/assets/qdrant-architecture.jpg";

const features = [
  {
    icon: Brain,
    title: "Mind Games",
    description: "Engaging cognitive exercises designed to improve focus, memory, and mental clarity.",
    color: "from-wellness-teal/20 to-wellness-teal/5",
  },
  {
    icon: Flower2,
    title: "Yoga Practice",
    description: "Guided yoga sessions with visual demonstrations and voice instructions.",
    color: "from-wellness-lavender/20 to-wellness-lavender/5",
  },
  {
    icon: Heart,
    title: "Breathing Exercises",
    description: "Calming breathing techniques to reduce anxiety and promote relaxation.",
    color: "from-wellness-peach/20 to-wellness-peach/5",
  },
];

const Index = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Wellness background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>

        {/* Floating elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-20 left-[15%] w-20 h-20 rounded-full bg-wellness-teal/20 blur-2xl"
            animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <motion.div
            className="absolute top-40 right-[20%] w-32 h-32 rounded-full bg-wellness-lavender/30 blur-3xl"
            animate={{ y: [0, 20, 0], scale: [1, 0.9, 1] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-40 left-[30%] w-24 h-24 rounded-full bg-wellness-sage/30 blur-2xl"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Your journey to wellness starts here</span>
            </motion.div>

            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Find Your{" "}
              <span className="gradient-text">Inner Peace</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Discover a sanctuary for your mind. Engage in therapeutic games, 
              practice yoga, and master breathing techniques designed to nurture 
              your mental well-being.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/games">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-wellness flex items-center gap-2"
                >
                  Start Your Journey
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </Link>
              <Link to="/yoga">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-wellness-outline"
                >
                  Explore Yoga
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-to-b from-background to-secondary/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Your Wellness Toolkit
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Evidence-based tools designed to support your mental health journey
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className={`glass-card rounded-3xl p-8 bg-gradient-to-br ${feature.color}`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/50 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Technology Section */}
      <section className="py-24 bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wellness-teal/10 text-wellness-teal mb-4">
              <Cpu className="w-4 h-4" />
              <span className="text-sm font-medium">Powered by AI</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Intelligent Memory Architecture
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our advanced Qdrant-powered system learns from your wellness journey, 
              creating personalized recommendations through semantic understanding of your patterns.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Architecture Diagram */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="glass-card rounded-3xl p-4 overflow-hidden">
                <img
                  src={qdrantArchitecture}
                  alt="Qdrant Vector Database Architecture"
                  className="w-full h-auto rounded-2xl"
                />
              </div>
              <motion.div
                className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-wellness-lavender/20 blur-2xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            </motion.div>

            {/* Features List */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-wellness-teal/10 to-transparent">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-wellness-teal/20 flex items-center justify-center flex-shrink-0">
                    <Database className="w-6 h-6 text-wellness-teal" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold mb-2">Vector Memory Storage</h3>
                    <p className="text-muted-foreground text-sm">
                      Your moods, sessions, and activities are embedded as vectors, enabling semantic search 
                      across your entire wellness history.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-wellness-lavender/10 to-transparent">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-wellness-lavender/20 flex items-center justify-center flex-shrink-0">
                    <Network className="w-6 h-6 text-wellness-lavender" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold mb-2">Multi-Agent Intelligence</h3>
                    <p className="text-muted-foreground text-sm">
                      Specialized AI agents (Mood Analyst, Yoga Coach, Crisis Detector) collaborate 
                      through shared memory to provide holistic wellness insights.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-wellness-sage/10 to-transparent">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-wellness-sage/20 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-6 h-6 text-wellness-sage" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold mb-2">Adaptive Learning</h3>
                    <p className="text-muted-foreground text-sm">
                      Memory decay and reinforcement mechanisms ensure recommendations stay relevant, 
                      prioritizing recent patterns while retaining important long-term insights.
                    </p>
                  </div>
                </div>
              </div>

              <Link to="/mindflow">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-wellness-outline w-full flex items-center justify-center gap-2 mt-4"
                >
                  Explore MindFlow Dashboard
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card rounded-3xl p-12 md:p-16 text-center bg-gradient-to-br from-primary/5 to-wellness-lavender/10"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready to Begin?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              Take the first step towards a calmer, more focused mind. 
              Your mental wellness journey awaits.
            </p>
            <Link to="/games">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-wellness"
              >
                Get Started Free
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>Made with 💚 for your mental wellness</p>
        </div>
      </footer>
    </Layout>
  );
};

export default Index;
