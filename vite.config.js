import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls from Vite dev server (:5173) to Express (:3001)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
