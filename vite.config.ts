import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build can be opened from any sub-path or a plain file server.
  base: './',
  server: {
    host: true, // bind 0.0.0.0 so phones/tablets on the same WiFi can connect
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    // One chunk is fine here: it is almost entirely three.js, which every frame needs.
    chunkSizeWarningLimit: 800,
  },
});
