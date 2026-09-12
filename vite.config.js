import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Locally the API runs as its own process (npm run dev:api).
    proxy: { '/api': 'http://localhost:3001' },
  },
})
