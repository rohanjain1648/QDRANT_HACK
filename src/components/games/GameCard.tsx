import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface GameCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: "teal" | "lavender" | "sage" | "peach" | "sky";
  delay?: number;
}

const colorClasses = {
  teal: "from-wellness-teal/20 to-wellness-teal/5 hover:from-wellness-teal/30",
  lavender: "from-wellness-lavender/30 to-wellness-lavender/10 hover:from-wellness-lavender/40",
  sage: "from-wellness-sage/30 to-wellness-sage/10 hover:from-wellness-sage/40",
  peach: "from-wellness-peach/40 to-wellness-peach/20 hover:from-wellness-peach/50",
  sky: "from-wellness-sky/40 to-wellness-sky/20 hover:from-wellness-sky/50",
};

const iconColorClasses = {
  teal: "text-primary",
  lavender: "text-accent-foreground",
  sage: "text-secondary-foreground",
  peach: "text-orange-600",
  sky: "text-blue-500",
};

export const GameCard = ({
  title,
  description,
  icon: Icon,
  href,
  color,
  delay = 0,
}: GameCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.5 }}
    >
      <Link to={href}>
        <div
          className={`game-card bg-gradient-to-br ${colorClasses[color]} group cursor-pointer`}
        >
          <div
            className={`w-14 h-14 rounded-2xl bg-white/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${iconColorClasses[color]}`}
          >
            <Icon className="w-7 h-7" />
          </div>
          <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
};
