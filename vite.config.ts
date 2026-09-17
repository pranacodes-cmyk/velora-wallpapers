import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // PWA disabled — service workers were causing stale cache issues
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Keep function names through minification so the Long Animation Frame API
  // can report a readable culprit function in production builds.
  esbuild: {
    keepNames: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Keep slow-changing, expensive libraries in independently cached
        // chunks. Feature chunks can then change without invalidating them.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("posthog-js")) return "vendor-analytics";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@supabase") || id.includes("realtime-js")) return "vendor-backend";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("@capacitor")) return "vendor-capacitor";
          return undefined;
        },
      },
    },
  },
}));
