import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, Vite proxies API + websocket calls to Express so cookies stay same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
