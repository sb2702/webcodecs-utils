import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  // Library build vs demo server
  if (command === 'build') {
    return {
      build: {
        outDir: 'dist',
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'WebCodecsUtils',
        },
        rollupOptions: {
          // Externalize dependencies that shouldn't be bundled
          external: [
            'mp4box',
            'mediabunny',
            'web-demuxer',
            'mpg123-decoder',
            // Externalize lamejs and all its internal modules
            /^lamejs/,
          ],
          output: [
            {
              // ESM build with preserved modules for optimal tree-shaking
              format: 'es',
              entryFileNames: '[name].js',
              preserveModules: true,
              preserveModulesRoot: 'src',
              exports: 'named',
            },
            {
              // CJS build as single bundle for compatibility
              format: 'cjs',
              entryFileNames: 'index.cjs',
              globals: {
                mp4box: 'MP4Box',
                lamejs: 'lamejs',
                mediabunny: 'mediabunny',
                'web-demuxer': 'WebDemuxer',
                'mpg123-decoder': 'mpg123Decoder',
              },
            },
          ],
        },
      },
    };
  }

  // Demo server configuration
  return {

    root: 'demos',
    publicDir: '../public',
    server: {
      port: 5173,
      open: true,
      allowedHosts: true
    },
  };
});
