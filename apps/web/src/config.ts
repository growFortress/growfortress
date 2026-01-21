export const CONFIG = {
  API_URL: import.meta.env.VITE_API_URL || "/api",
  WS_URL: import.meta.env.VITE_WS_URL || "",
  TICK_RATE: 30,
  CHECKPOINT_INTERVAL: 300, // Every 300 ticks
};

// Social media links
export const SOCIAL_LINKS = {
  DISCORD: "https://discord.gg/tY87dwqE",
  TWITTER: "https://x.com/GrowFortress",
  // REDDIT: "https://reddit.com/r/growfortress", // Coming soon
};
