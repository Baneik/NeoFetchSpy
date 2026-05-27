import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const sourcemap = process.env.SOURCE_MAP === '1' || process.env.SOURCEMAP === 'true';

export default defineConfig({
  build: {
    emptyOutDir: true,
    sourcemap,
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'options.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
