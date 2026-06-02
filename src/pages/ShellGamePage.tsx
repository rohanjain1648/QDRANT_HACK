import { Layout } from "@/components/layout/Layout";
import { ShellGame } from "@/components/games/ShellGame";
import { motion } from "framer-motion";
import { Target, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const ShellGamePage = () => {
  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link
              to="/games"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-wellness-sage/50 flex items-center justify-center">
                <Target className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold">Find the Ball</h1>
                <p className="text-muted-foreground text-sm">
                  Track the ball and improve your focus
                </p>
              </div>
            </div>
          </motion.div>

          <ShellGame />
        </div>
      </div>
    </Layout>
  );
};

export default ShellGamePage;
