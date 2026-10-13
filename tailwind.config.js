/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Ciano/petróleo técnico — substitui o azul genérico de antes.
        // Funciona como cor sólida de ação (botões, foco, links) tanto no
        // claro (tons 600/700, com bom contraste em fundo branco) quanto no
        // escuro (tons 400/500, que "acendem" sobre o fundo grafite).
        brand: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // Pedido do usuário: "o tema escuro, deixe a paleta igual o
        // WhatsApp" — os tons 700/800/900/950 (os únicos que este projeto
        // sobrescreve; 50–600 continuam o cinza padrão do Tailwind, usado
        // sobretudo em texto e no modo claro, então o modo claro não muda)
        // agora usam os cinza-grafite reais do tema escuro do WhatsApp em
        // vez do grafite azul-marinho de antes:
        //   900 = #0b141a — fundo principal (a "tela de conversa"), o mais
        //         escuro, usado em bg-slate-900 (fundo da página toda).
        //   800 = #111b21 — painel/cabeçalho (um degrau mais claro), usado
        //         em bg-slate-800 (cards, modais).
        //   700 = #202c33 — superfície elevada/hover/input (a mais clara
        //         das três), usado em border-slate-700, bg-slate-700 etc.
        //   950 = ainda mais escuro que o 900, pra sombra/overlay mais
        //         profundo, mantendo a mesma proporção de antes.
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#202c33',
          800: '#111b21',
          900: '#0b141a',
          950: '#060b0e',
        },
        // Verde-petróleo do WhatsApp (cor de destaque do tema escuro dele —
        // ícones ativos, links, foco) — usado só nas classes `dark:` que já
        // destacavam ações/links com a cor "brand" (ciano) em vez de um
        // cinza neutro. O "brand" ciano em si não foi tocado (ele ainda
        // aparece sem o prefixo `dark:` em botões e outros elementos
        // visíveis nos dois temas), então o tema claro continua ciano —
        // só o destaque do tema escuro virou verde, como pedido.
        whatsapp: {
          50: '#e6f7f1',
          100: '#c0ecdc',
          200: '#8edcc0',
          300: '#53c89f',
          400: '#00a884',
          500: '#02906f',
          600: '#057a5e',
          700: '#0a6350',
          800: '#0f4d40',
          900: '#0c3a30',
          950: '#062420',
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
