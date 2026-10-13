/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Pedido do usuário: "no tema claro use essa paleta", com um print
        // do TOTVS Varejo (tela de Agendamento) — o azul usado lá no botão
        // principal e no cabeçalho do calendário (#3498db) virou a cor de
        // ação do tema claro no lugar do ciano/petróleo de antes. Essa cor
        // vivia num token só ("brand") compartilhado pelos dois temas; para
        // trocar só o claro sem mexer no escuro (que tinha acabado de virar
        // verde-WhatsApp, ver "whatsapp" abaixo), cada uso sem prefixo
        // `dark:` foi migrado de `brand-N` pra `totvs-N`, e onde não havia
        // ainda uma variante `dark:` própria, foi adicionada apontando pro
        // "whatsapp" (mesmo tom), pra o escuro continuar exatamente como
        // estava. O token "brand" ficou sem nenhum uso no app — removido.
        totvs: {
          50: '#eaf4fc',
          100: '#d4e9f8',
          200: '#a9d3f1',
          300: '#7ebce9',
          400: '#53a6e2',
          500: '#3498db',
          600: '#2f89c7',
          700: '#2980b9',
          800: '#20658f',
          900: '#1a5275',
        },
        // Pedido do usuário: "como ficaria o tema escuro com preto e
        // cinza" → testamos um cinza neutro primeiro, mas o pedido final
        // foi "deixe parecido com o design do Vercel" — ou seja, o preto
        // bem mais "puro" (quase #000) que o dashboard da Vercel usa, com
        // painéis um degrau acima e bordas finas e discretas, em vez do
        // cinza-grafite médio da tentativa anterior. Os tons 700/800/900/950
        // (os únicos que este projeto sobrescreve; 50–600 continuam o cinza
        // padrão do Tailwind, usado sobretudo em texto e no modo claro,
        // então o modo claro não muda) agora são:
        //   900 = #000000 — fundo principal (a tela toda), preto puro, a
        //         marca registrada do visual da Vercel. Usado em
        //         bg-slate-900 (fundo da página).
        //   800 = #111111 — painel/cabeçalho/cards (um degrau acima do
        //         preto puro, pra diferenciar do fundo), usado em
        //         bg-slate-800 (cards, modais).
        //   700 = #333333 — borda/hover/superfície elevada (bem mais clara
        //         que o painel, pra servir de linha fina visível sobre o
        //         preto — como as bordas sutis da Vercel), usado em
        //         border-slate-700, bg-slate-700 etc.
        //   950 = #000000 — mesmo preto puro do 900, pra sombra/overlay
        //         mais profundo (não tem como ficar mais escuro que preto).
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#333333',
          800: '#111111',
          900: '#000000',
          950: '#000000',
        },
        // Pedido do usuário: depois de ver o fundo preto puro, "não gostei
        // do cinza, mantenha o preto e me sugira outra cor que combine e
        // fique atual" — testamos 4 opções (indigo, azul, verde-esmeralda,
        // âmbar) lado a lado e o azul elétrico foi o escolhido: tom vivo e
        // sóbrio que ecoa o azul já usado no tema claro (TOTVS), dando uma
        // ligação visual entre os dois temas. É a cor de "destaque" do tema
        // escuro — ícones ativos, links, foco, botões — e o par exclusivo
        // do modo escuro pra cada uso de "totvs" (azul, tema claro) acima.
        // Toda classe de ação/destaque no app tem as duas variantes lado a
        // lado (ex.: `bg-totvs-600 dark:bg-whatsapp-600`), então trocar a
        // paleta de um tema nunca muda o outro. O nome do token
        // ("whatsapp") ficou do pedido original que criou essa separação,
        // mas a cor em si não tem mais nada a ver com o WhatsApp.
        whatsapp: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Pedido do usuário: o tema claro estava "muito claro" — quase todo
        // card/painel/input do app usa `bg-white` (branco puro, #ffffff)
        // sobre o fundo `bg-slate-100` da página, o que no total deixava a
        // tela muito brilhante. Em vez de editar `bg-white` em dezenas de
        // arquivos, sobrescrevemos aqui o próprio branco do Tailwind por um
        // "branco gelo" — um branco levemente acinzentado/azulado, mais
        // suave que o puro #ffffff mas ainda claramente mais claro que o
        // fundo da página, então os cards continuam se destacando bem. Afeta
        // só o modo claro (o modo escuro não usa `white` em lugar nenhum).
        white: '#f6f8fa',
      },
    },
  },
  plugins: [],
};
