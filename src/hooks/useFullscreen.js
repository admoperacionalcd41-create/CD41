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

  // Pedido do usuário: no celular, o app deve "já vir expandido" (em tela
  // cheia), sem precisar tocar no botão de expandir manualmente toda vez
  // que abre. Nenhum navegador permite pedir tela cheia sozinho assim que a
  // página carrega — a Fullscreen API só aceita o pedido como resposta
  // DIRETA a um gesto do usuário (toque/clique), por segurança, senão
  // qualquer site poderia forçar tela cheia sem o usuário querer. Por isso,
  // em telas de celular, tentamos entrar em tela cheia a cada toque do
  // usuário (enquanto ainda não estiver em tela cheia) — na prática o app
  // "abre expandido", já que isso acontece bem no início do uso, antes de
  // qualquer ação de verdade. O botão manual (ver Header.jsx) continua
  // existindo, tanto pra quem está no desktop (onde este efeito nem roda)
  // quanto como alternativa caso esse toque automático não funcione por
  // algum motivo (ex.: iPhone — o Safari no iOS não suporta a Fullscreen
  // API nenhuma, então nem o botão manual aparece lá).
  //
  // Histórico de duas tentativas anteriores que não bastaram sozinhas:
  //   1) Só em "pointerdown": alguns navegadores/WebViews de Android negam
  //      o pedido feito ainda durante o toque (dedo na tela) — precisa ser
  //      num gesto já concluído.
  //   2) Só em "click", só uma vez ("once: true"): resolve o caso acima,
  //      mas o PRIMEIRO toque do usuário na tela nem sempre é um clique de
  //      verdade — pode ser o início de uma rolagem (arrastar o dedo pra
  //      ver a lista), que nunca dispara "click" nenhum. Com uma trava de
  //      "só tenta uma vez" presa a esse evento, o app ficava esperando um
  //      clique que podia demorar a acontecer (ou nunca acontecer, se o
  //      usuário só rolar a tela e tocar em botões que navegam sem
  //      disparar o "click" do jeito esperado).
  //
  // Solução: tenta em TRÊS eventos (pointerdown, touchend e click) — cobre
  // tanto o início quanto o fim de um toque/rolagem, além de cliques de
  // mouse — e cada tentativa checa `document.fullscreenElement` na hora,
  // em vez de uma trava fixa de "só tenta uma vez": um pedido negado (ex.:
  // o de pointerdown) simplesmente não trava nada, e o próximo evento do
  // mesmo toque (touchend) ou do próximo toque tenta de novo. Uma vez que
  // a tela cheia é concedida, a checagem no topo já sai de imediato (sem
  // custo) em qualquer novo evento.
  useEffect(() => {
    if (!suportado) return;
    const ehCelular = window.matchMedia('(max-width: 768px)').matches;
    if (!ehCelular) return;

    function aoTocar() {
      if (document.fullscreenElement) return;
      document.documentElement.requestFullscreen?.().catch(() => {
        // Esse evento específico não foi aceito pelo navegador — sem
        // travar nada, o próximo evento (do mesmo toque ou do próximo)
        // tenta de novo.
      });
    }
    document.addEventListener('pointerdown', aoTocar);
    document.addEventListener('touchend', aoTocar);
    document.addEventListener('click', aoTocar);
    return () => {
      document.removeEventListener('pointerdown', aoTocar);
      document.removeEventListener('touchend', aoTocar);
      document.removeEventListener('click', aoTocar);
    };
  }, [suportado]);

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
