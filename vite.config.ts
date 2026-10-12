import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Keep React in its own long-cacheable chunk; the lazy game
        // windows (Pacman/Solitaire) already split automatically via
        // React.lazy in Desktop.tsx.
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
