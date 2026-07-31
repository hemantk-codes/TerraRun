import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Uncomment if you want Vite to proxy /api to the backend during dev
    // instead of setting VITE_API_BASE_URL. Left off by default so the two
    // servers stay explicitly decoupled (matches "platform-agnostic backend"
    // goal — a future mobile client won't have this proxy at all).
    // proxy: {
    //   '/api': 'http://localhost:5000',
    // },
  },
})
