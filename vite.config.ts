import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WebCodecsUtils',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: ['mp4box', 'lamejs'],
      output: {
        globals: {
          mp4box: 'MP4Box',
          lamejs: 'lamejs',
        },
      },
    },
  },
  // Demo server configuration
  root: 'demos',
  publicDir: '../public',
  server: {
    port: 5173,
    open: true,
  },
});
