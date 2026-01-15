export const CONFIG = {
  API_URL: import.meta.env.VITE_API_URL || "/api",
  WS_URL: import.meta.env.VITE_WS_URL || "",
  TICK_RATE: 30,
  CHECKPOINT_INTERVAL: 300, // Every 300 ticks
};
