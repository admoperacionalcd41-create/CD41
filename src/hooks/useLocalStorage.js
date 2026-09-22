import { useEffect, useState } from 'react';

/**
 * Hook simples de persistência em localStorage. Usado para manter o estado
 * da aplicação salvo entre recarregamentos de página, sem necessidade de
 * um backend — ideal para testes imediatos.
 */
export function useLocalStorage(chave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const salvo = window.localStorage.getItem(chave);
      if (salvo) return JSON.parse(salvo);
      return typeof valorInicial === 'function' ? valorInicial() : valorInicial;
    } catch (erro) {
      console.warn(`Não foi possível ler "${chave}" do localStorage:`, erro);
      return typeof valorInicial === 'function' ? valorInicial() : valorInicial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(chave, JSON.stringify(valor));
    } catch (erro) {
      console.warn(`Não foi possível salvar "${chave}" no localStorage:`, erro);
    }
  }, [chave, valor]);

  return [valor, setValor];
}
