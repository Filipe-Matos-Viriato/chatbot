import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs', // Point to the .cjs file
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5174,      // Explicitly set the port to 5174
    allowedHosts: ['.ngrok-free.app'],
  },
});