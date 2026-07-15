import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __DEV_TOOLS__: JSON.stringify(mode === "development" || mode === "qa"),
  },
  build: {
    outDir: mode === "qa" ? "dist-qa" : "dist",
  },
}));
