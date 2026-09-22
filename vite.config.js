import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // O app é publicado como um único arquivo HTML autônomo (ver o
    // processo de montagem do Artifact), então o build precisa gerar um
    // único arquivo JS — sem code-splitting automático (que algumas
    // dependências, como jsPDF, podem disparar via import dinâmico interno).
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    // Imagens importadas (ex.: src/assets/caminhao-vista-cima.png) viram
    // base64 embutido no JS em vez de um arquivo .png separado — necessário
    // porque o artifact-source.html final é um único arquivo autônomo, sem
    // nenhum outro arquivo estático junto pra servir a imagem. 100kb cobre
    // com folga os ícones/imagens pequenos usados no app.
    assetsInlineLimit: 100000,
  },
});
