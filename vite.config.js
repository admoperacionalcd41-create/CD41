console.log('[DEBUG] VITE_SUPABASE_URL:', JSON.stringify(process.env.VITE_SUPABASE_URL));
console.log('[DEBUG] VITE_SUPABASE_ANON_KEY existe?', typeof process.env.VITE_SUPABASE_ANON_KEY);
console.log('[DEBUG] Todas as chaves VITE_ encontradas:', Object.keys(process.env).filter(k => k.startsWith('VITE_')));

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    assetsInlineLimit: 100000,
  },
});


