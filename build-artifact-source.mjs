// Gera artifact-source.html: uma versão do app com tudo (JS + CSS) num
// único arquivo, sem as tags <!doctype>/<html>/<head>/<body> (a ferramenta
// de Artifact já embrulha o conteúdo nelas), pronta pra publicar como
// prévia visual interativa. Rodar sempre depois de `npm run build`:
//
//   BUILD_ARTIFACT_PREVIEW=true npm run build && node build-artifact-source.mjs
//
// Importante: o build usado aqui deve ser feito SEM as variáveis
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY definidas (modo demonstração,
// sem login, com dados de exemplo) — a prévia de Artifact bloqueia
// chamadas de rede externas (Supabase incluso), então a versão publicada
// só funciona em modo demo mesmo.
//
// BUILD_ARTIFACT_PREVIEW=true é obrigatório aqui: desde que as abas do app
// passaram a ser carregadas sob demanda (React.lazy, ver App.jsx e
// vite.config.js), um `npm run build` normal gera vários arquivos .js (um
// pedaço/chunk por aba) — bom pro site publicado de verdade (Vercel), mas
// incompatível com este script, que só sabe inlinar UM arquivo .js. Essa
// variável faz o Vite voltar a gerar um único arquivo, só para este build.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const distAssets = 'dist/assets';
const arquivos = readdirSync(distAssets);
const cssFile = arquivos.find((f) => f.endsWith('.css'));
const jsFile = arquivos.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('Não encontrei os arquivos de build em dist/assets — rode "npm run build" primeiro.');
  process.exit(1);
}

const titulo = 'Gestão de Docas | Separação e Carregamento';
const temaScript = `<script>
  (function () {
    try {
      var salvo = window.localStorage.getItem('doca-manager:tema');
      var escuro = salvo ? salvo === 'dark' : true;
      if (escuro) document.documentElement.classList.add('dark');
    } catch (e) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>`;

const css = readFileSync(join(distAssets, cssFile), 'utf-8');
const js = readFileSync(join(distAssets, jsFile), 'utf-8');

if (js.includes('</script')) {
  console.error('O JS de build contém a string "</script" — precisa escapar antes de inlinar.');
  process.exit(1);
}
if (css.includes('</style')) {
  console.error('O CSS de build contém a string "</style" — precisa escapar antes de inlinar.');
  process.exit(1);
}

const saida = `<title>${titulo}</title>
${temaScript}
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

writeFileSync('artifact-source.html', saida, 'utf-8');
console.log(`artifact-source.html gerado (${saida.length} bytes).`);
