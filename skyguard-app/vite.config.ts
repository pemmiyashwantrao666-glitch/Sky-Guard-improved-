import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'path'

// Base path used for asset URLs in the production build:
//   • Vercel free domain (*.vercel.app) → "/" (default, no env var needed)
//   • GitHub Pages (served under a repo sub-path) → set VITE_BASE_PATH=/Sky-Guard-improved-/
//     (already configured in .github/workflows/deploy.yml)
const base = (process.env.VITE_BASE_PATH ?? "/").trim() || "/"

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
