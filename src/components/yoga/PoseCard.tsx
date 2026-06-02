import { motion } from "framer-motion";
import { Clock, Star, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PoseCardProps {
  name: string;
  sanskritName: string;
  duration: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  benefits: string[];
  imageUrl?: string;
  onClick?: () => void;
  delay?: number;
}

export const PoseCard = ({
  name,
  sanskritName,
  duration,
  difficulty,
  benefits,
  imageUrl,
  onClick,
  delay = 0,
}: PoseCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.5 }}
      className="pose-card cursor-pointer group"
      onClick={onClick}
    >
      {/* Image placeholder */}
      <div className="aspect-[4/3] bg-gradient-to-br from-wellness-sage/30 to-wellness-mint/20 flex items-center justify-center relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-6xl opacity-50">🧘</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-display text-lg font-semibold mb-1">{name}</h3>
        <p className="text-sm text-muted-foreground italic mb-3">{sanskritName}</p>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {duration}
          </div>
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-3 h-3",
                  i < difficulty ? "text-primary fill-primary" : "text-muted"
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {benefits.slice(0, 2).map((benefit, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
            >
              {benefit}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
