import { useEffect, useState } from 'react';

const CHAVE_STORAGE = 'doca-manager:tema';

function preferenciaInicial() {
  try {
    const salvo = window.localStorage.getItem(CHAVE_STORAGE);
    if (salvo === 'dark' || salvo === 'light') return salvo;
  } catch {
    // localStorage indisponível — segue para o padrão do app
  }
  // O visual "painel de operação" do Doca Manager foi desenhado pro modo
  // escuro — é o tema padrão na primeira visita, em vez de seguir a
  // preferência do sistema. O usuário pode trocar pro claro a qualquer
  // momento no botão de sol/lua do cabeçalho, e a escolha fica salva.
  return 'dark';
}

/**
 * Controla o tema claro/escuro da aplicação. Começa pela preferência salva
 * ou, na ausência dela, pela preferência do sistema operacional; aplica a
 * classe "dark" na raiz do documento (estratégia `darkMode: 'class'` do
 * Tailwind) e persiste a escolha do usuário.
 */
export function useDarkMode() {
  const [tema, setTema] = useState(preferenciaInicial);

  useEffect(() => {
    const raiz = window.document.documentElement;
    raiz.classList.toggle('dark', tema === 'dark');
    try {
      window.localStorage.setItem(CHAVE_STORAGE, tema);
    } catch {
      // sem persistência disponível — tema continua funcionando na sessão atual
    }
  }, [tema]);

  function alternarTema() {
    setTema((atual) => (atual === 'dark' ? 'light' : 'dark'));
  }

  return { tema, alternarTema, escuro: tema === 'dark' };
}
