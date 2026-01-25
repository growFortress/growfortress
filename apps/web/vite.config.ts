import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "path";

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_CDN_URL || "/",
  plugins: [preact()],
  // Remove console.log and debugger statements in production
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
  // Enable JSON imports for translation files
  json: {
    namedExports: true,
    stringify: false,
  },
  server: {
    port: 5173,
    hmr: {
      overlay: true,
      timeout: 30000, // Increased timeout to prevent reconnection spam
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: false, // Disabled in production to reduce bundle size (~30-40%)
    // Remove console.log and debugger in production builds
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate locale files into their own chunks
          if (id.includes("/locales/")) {
            const match = id.match(/\/locales\/(en|pl)\//);
            if (match) return `locale-${match[1]}`;
          }
          if (!id.includes("node_modules")) return undefined;
          // i18next in its own chunk
          if (id.includes("i18next")) {
            return "i18n";
          }
          if (
            id.includes("pixi.js") ||
            id.includes("pixi-filters") ||
            id.includes("@pixi/particle-emitter")
          ) {
            return "pixi";
          }
          if (id.includes("preact") || id.includes("@preact/signals")) {
            return "preact";
          }
          if (id.includes("@fontsource")) {
            return "fonts";
          }
          return "vendor";
        },
      },
    },
  },
}));
