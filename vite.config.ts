import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base must match the GitHub Pages repo path: https://aomarco.github.io/Roll30/
export default defineConfig({
  base: "/Roll30/",
  plugins: [react(), tailwindcss()],
});
