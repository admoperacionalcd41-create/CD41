import { useCallback, useEffect, useState } from 'react';

// Alguns operadores mantêm o Doca Manager aberto numa TV/monitor dedicado no
// pátio, onde a barra de endereço e as abas do navegador só atrapalham — a
// tecla F11 resolve, mas é fácil não saber que ela existe (ou não funcionar
// em alguns navegadores/tablets). Este hook dá o mesmo resultado por um
// botão na tela, usando a Fullscreen API do próprio navegador (sem
// depender de nenhuma extensão ou permissão especial do sistema).
export function useFullscreen() {
  const [emTelaCheia, setEmTelaCheia] = useState(() => Boolean(document.fullscreenElement));
  // Alguns contextos (ex.: um <iframe> sem o atributo "allow=fullscreen",
  // como a pré-visualização de um Artifact no claude.ai) bloqueiam a API de
  // tela cheia por completo — o botão então nem aparece, em vez de aparecer
  // e não fazer nada ao ser clicado.
  const suportado = typeof document !== 'undefined' && document.fullscreenEnabled;

  useEffect(() => {
    function aoMudar() {
      setEmTelaCheia(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  const alternarTelaCheia = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Pedido negado pelo navegador (ex.: sandbox sem "allow-fullscreen")
        // — sem travar a tela, o usuário continua podendo usar o F11 normal.
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  return { emTelaCheia, alternarTelaCheia, suportado };
}
