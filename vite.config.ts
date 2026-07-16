import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            const isFirebase = id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/');
            if (isFirebase) {
              if (id.includes('/firestore/')) return 'firebase-firestore';
              if (id.includes('/auth/')) return 'firebase-auth';
              if (id.includes('/storage/')) return 'firebase-storage';
              return 'firebase';
            }
            if (id.includes('/react-dom/')) return 'react-dom';
            if (id.includes('/react/')) return 'react';
            if (id.includes('/date-fns/')) return 'date-fns';
            if (id.includes('/motion/')) return 'motion';
            if (id.includes('/lucide-react/')) return 'icons';
            if (id.includes('/react-window/')) return 'react-window';
            // Let Rollup decide for the rest to avoid circular chunk graphs.
            return;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        // Allow Firebase auth popups to close themselves without COOP warnings.
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
  };
});
