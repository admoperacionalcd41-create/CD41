import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
  },
  build: {
    rollupOptions: {
      output: {
        // As abas do app agora são carregadas sob demanda com React.lazy
        // (ver App.jsx), o que faz o Vite gerar um arquivo .js separado
        // (chunk) para cada uma — ótimo para o site publicado de verdade
        // (Vercel), que serve cada arquivo por HTTP normalmente e só baixa
        // o chunk quando o usuário abre aquela aba, reduzindo o
        // carregamento inicial. Só a prévia de Artifact (ver
        // build-artifact-source.mjs) não pode ter chunks separados — ela
        // vira um único arquivo HTML autônomo, sem servidor por trás para
        // buscar pedaços extras — então SÓ nesse build específico (rodado
        // com BUILD_ARTIFACT_PREVIEW=true) tudo volta a ser inlinado num
        // arquivo .js só.
        inlineDynamicImports: process.env.BUILD_ARTIFACT_PREVIEW === 'true',
      },
    },
    assetsInlineLimit: 100000,
  },
});


