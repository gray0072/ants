import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  root: '.',
  base: '/ants/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main:   'index.html',
        mobile: 'mobile.html',
        learn:  'learn.html',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
