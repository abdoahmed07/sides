import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works under any GitHub Pages subpath (e.g. /sides/kent/).
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
})
