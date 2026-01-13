import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  base: "/portal/",
  build: {
    outDir: path.resolve(__dirname, "../dist/portal"),
    emptyOutDir: true,
  },
  publicDir: path.resolve(__dirname, "public"),
});
