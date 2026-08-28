import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import esbuild from 'esbuild';

function buildExtensionScriptsPlugin(): Plugin {
  return {
    name: 'build-extension-scripts',
    async closeBundle() {
      // Build content-script as a standalone IIFE bundle (no ESM imports allowed in Chrome content scripts)
      await esbuild.build({
        entryPoints: [resolve(__dirname, 'src/content/index.ts')],
        outfile: resolve(__dirname, 'dist/content-script.js'),
        bundle: true,
        target: 'es2022',
        minify: true,
        legalComments: 'none',
        drop: ['debugger'],
        format: 'iife',
      });

      // Build background service-worker as a standalone IIFE bundle (clean, fast, and self-contained)
      await esbuild.build({
        entryPoints: [resolve(__dirname, 'src/background/service-worker.ts')],
        outfile: resolve(__dirname, 'dist/service-worker.js'),
        bundle: true,
        target: 'es2022',
        minify: true,
        legalComments: 'none',
        drop: ['debugger'],
        format: 'iife',
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), buildExtensionScriptsPlugin()],
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    cssMinify: true,
    minify: 'esbuild',
    modulePreload: false,
    rollupOptions: {
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: false
      },
      input: {
        popup: resolve(__dirname, 'src/popup/index.html')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});

