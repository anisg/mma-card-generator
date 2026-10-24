import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  // Served from https://anisg.github.io/mma-card-generator/ in production.
  base: command === "build" ? "/mma-card-generator/" : "/",
  plugins: [react(), tailwindcss()],
}));
