import {
  Compass,
  Flame,
  Rocket,
  Star,
  Sunrise,
  Target,
  TrendingUp,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  flame: Flame,
  trophy: Trophy,
  star: Star,
  "trending-up": TrendingUp,
  wrench: Wrench,
  compass: Compass,
  target: Target,
  sunrise: Sunrise,
};

export function achievementIcon(key: string): LucideIcon {
  return ACHIEVEMENT_ICONS[key] ?? Star;
}
