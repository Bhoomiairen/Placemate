import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development, /api calls go to the Node server so no CORS setup is needed.
    proxy: { '/api': process.env.VITE_API_PROXY || 'http://localhost:5000' },
  },
});
