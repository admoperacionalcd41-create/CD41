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
        // Sobrescreve só os tons mais escuros da paleta "slate" (usada em
        // praticamente todo fundo/borda em modo escuro no app inteiro) por
        // um grafite mais fechado e com um leve tom de azul-marinho — é o
        // que dá a "cara de painel de operação" ao tema escuro, em vez do
        // cinza neutro padrão do Tailwind. Os tons mais claros (50–600,
        // usados sobretudo em texto e no modo claro) permanecem os
        // originais do Tailwind, então o modo claro muda muito pouco.
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#1e2a42',
          800: '#111c2f',
          900: '#0b1220',
          950: '#060a12',
        },
      },
    },
  },
  plugins: [],
};
