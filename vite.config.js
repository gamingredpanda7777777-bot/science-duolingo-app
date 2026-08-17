import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드하면 Vercel·Netlify·GitHub Pages 어디에 올려도 동작한다.
  base: "./",
});
