import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /**
   * Where the recruiter portal is mounted.
   *
   * It lives on its own origin — its own port on the server today, a separate
   * host or a Vercel project later — so the default is the root. Set
   * RECRUITER_BASE=/somewhere/ at build time to mount it under a path instead.
   * React Router reads the same value through import.meta.env.BASE_URL, so the
   * two can never disagree.
   */
  base: process.env.RECRUITER_BASE || '/',
  server: {
    port: 5175,
    // In development the API runs on its own port; proxying keeps the browser
    // on one origin so the session cookies behave exactly as they do in
    // production instead of needing CORS and SameSite exceptions.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
