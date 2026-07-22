// Viv meter tiers — color/threshold data driving the VivCard's visual state.

export const VIV_TIERS = [
  {
    title: "Dormant",
    subtitle: "Viv 0",
    min: 0,
    max: 0,
    accent: "#6b7280",
    fill: "rgba(107,114,128,0.18)",
    glow: "rgba(107,114,128,0.35)",
  },
  {
    title: "Kindled",
    subtitle: "Viv 1-2",
    min: 1,
    max: 2,
    accent: "#3b82f6",
    fill: "rgba(59,130,246,0.16)",
    glow: "rgba(59,130,246,0.4)",
  },
  {
    title: "Surging",
    subtitle: "Viv 3-5",
    min: 3,
    max: 5,
    accent: "#14b8a6",
    fill: "rgba(20,184,166,0.18)",
    glow: "rgba(20,184,166,0.4)",
  },
  {
    title: "Radiant",
    subtitle: "Viv 6-10",
    min: 6,
    max: 10,
    accent: "#f97316",
    fill: "rgba(249,115,22,0.16)",
    glow: "rgba(249,115,22,0.35)",
  },
  {
    title: "Flare",
    subtitle: "Viv 11+",
    min: 11,
    max: Number.POSITIVE_INFINITY,
    accent: "#e11d48",
    fill: "rgba(225,29,72,0.16)",
    glow: "rgba(225,29,72,0.45)",
  },
] as const;

export const VIV_CYCLE = 12;
