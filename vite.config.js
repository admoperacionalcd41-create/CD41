import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Instalável como app (ícone na tela inicial, abre em tela cheia) mantendo
// o mesmo link/site de sempre — sem loja de apps, sem gerar um pacote à
// parte: o próprio navegador (Chrome/Edge/Android direto; Safari/iOS via
// "Adicionar à Tela de Início") oferece a instalação quando o site tem um
// manifest.webmanifest + um service worker registrado, que é só o que esse
// plugin gera no build.
//
// Importante pro jeito que esse app funciona (tudo ao vivo via Supabase):
// NÃO tem `runtimeCaching` configurado aqui de propósito — isso faria o
// service worker cachear respostas de rede (ex.: chamadas ao Supabase) e
// servir dados antigos/offline, o que seria perigoso pra um app de operação
// em tempo real com mais de um usuário editando junto (ver
// mesclarEstadoSincronizado.js). O cache do Workbox cobre só os arquivos
// estáticos do próprio app (JS/CSS/ícones) — os dados continuam sempre
// buscados da rede, nunca do cache. `registerType: 'autoUpdate'` +
// skipWaiting/clientsClaim fazem o app instalado trocar pra versão nova
// sozinho no próximo carregamento, sem o usuário ficar preso numa versão
// antiga em cache.
const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
  },
  manifest: {
    name: 'Gestão de Docas — Doca Manager',
    short_name: 'Doca Manager',
    description: 'Separação e carregamento — gestão de boxes, agrupamento, carregamento e entregas.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#0b1220',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
});

export default defineConfig({
  // O preview de Artifact (ver build-artifact-source.mjs) vira um único
  // arquivo HTML autônomo embutido no claude.ai — não é o site publicado de
  // verdade, não tem domínio/escopo próprio pra um service worker valer a
  // pena, e registrar um ali seria só ruído (ou erro) dentro do sandbox do
  // preview. Por isso o plugin de PWA entra só no build normal (o que vira
  // o site do Vercel), nunca em BUILD_ARTIFACT_PREVIEW=true.
  plugins: [react(), ...(process.env.BUILD_ARTIFACT_PREVIEW === 'true' ? [] : [pwaPlugin])],
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


