import bronzeEmblemUrl from "../assets/ranks/bronze-emblem.svg";
import silverEmblemUrl from "../assets/ranks/silver-emblem.svg";
import goldEmblemUrl from "../assets/ranks/gold-emblem.svg";
import consultantEmblemUrl from "../assets/ranks/consultant-emblem.svg";

export type BrainRankLevel = "BRONZE" | "SILVER" | "GOLD" | "CONSULTANT";

export function normalizeRankLevel(raw?: string | null): BrainRankLevel {
  const clean = (raw || "").trim().toUpperCase();
  if (clean.includes("GOLD") || clean.includes("MASTER") || clean.includes("GRANDMASTER")) {
    return "GOLD";
  }
  if (clean.includes("SILVER") || clean.includes("EXPERT")) {
    return "SILVER";
  }
  if (clean.includes("CONSULTANT") || clean.includes("PLATINUM") || clean.includes("ELITE")) {
    return "CONSULTANT";
  }
  return "BRONZE";
}

export const RANK_METADATA: Record<
  BrainRankLevel,
  {
    level: BrainRankLevel;
    title: string;
    badgeLabel: string;
    subtitle: string;
    tierOrder: number;
    nextLevel: string;
    svgUrl: string;
    accentHex: string;
  }
> = {
  BRONZE: {
    level: "BRONZE",
    title: "WorldQuant Bronze Rank",
    badgeLabel: "BRONZE LEVEL",
    subtitle: "Verified Quantitative Researcher · Active Competition Standing",
    tierOrder: 1,
    nextLevel: "SILVER LEVEL",
    svgUrl: bronzeEmblemUrl,
    accentHex: "#CD7F32",
  },
  SILVER: {
    level: "SILVER",
    title: "WorldQuant Silver Rank",
    badgeLabel: "SILVER LEVEL",
    subtitle: "Advanced Quantitative Researcher · Multi-Factor Production Track",
    tierOrder: 2,
    nextLevel: "GOLD LEVEL",
    svgUrl: silverEmblemUrl,
    accentHex: "#94A3B8",
  },
  GOLD: {
    level: "GOLD",
    title: "WorldQuant Gold Rank",
    badgeLabel: "GOLD LEVEL",
    subtitle: "Elite Quantitative Researcher · Top-Decile Alpha Portfolio",
    tierOrder: 3,
    nextLevel: "CONSULTANT",
    svgUrl: goldEmblemUrl,
    accentHex: "#EAB308",
  },
  CONSULTANT: {
    level: "CONSULTANT",
    title: "WorldQuant Research Consultant",
    badgeLabel: "CONSULTANT",
    subtitle: "Institutional Alpha Producer · Orthogonal Production Authority",
    tierOrder: 4,
    nextLevel: "MAX TIER",
    svgUrl: consultantEmblemUrl,
    accentHex: "#34D399",
  },
};

export function RankEmblem({
  level,
  size = 64,
  className = "",
}: {
  level?: string | null;
  size?: number;
  className?: string;
}) {
  const normalized = normalizeRankLevel(level);
  const meta = RANK_METADATA[normalized];

  return (
    <div
      className={`rank-emblem-wrap rank-${normalized.toLowerCase()} ${className}`.trim()}
      style={{ width: size, height: size }}
      title={`${meta.title} (${meta.badgeLabel})`}
    >
      <img
        src={meta.svgUrl}
        alt={meta.title}
        width={size}
        height={size}
        className="rank-emblem-svg"
        draggable={false}
      />
    </div>
  );
}
