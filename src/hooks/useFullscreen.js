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
  // em telas de celular, assim que o usuário toca em QUALQUER lugar da tela
  // pela primeira vez, entramos em tela cheia automaticamente — na prática
  // o app "abre expandido", já que isso acontece no primeiríssimo toque,
  // antes de qualquer outra ação dele. O botão manual (ver Header.jsx)
  // continua existindo, tanto pra quem está no desktop (onde este efeito
  // nem roda) quanto como alternativa caso esse primeiro toque automático
  // não funcione por algum motivo (ex.: iPhone — o Safari no iOS não
  // suporta a Fullscreen API nenhuma, então nem o botão manual aparece lá).
  //
  // Importante: só no evento "click" (nunca em "pointerdown"/"touchstart").
  // A primeira versão disso escutava os dois ao mesmo tempo, pra reagir o
  // quanto antes — mas vários navegadores/WebViews de Android (confirmado
  // no celular do usuário) não concedem a permissão de tela cheia ainda
  // durante o toque (dedo ainda na tela), só depois que o toque é
  // concluído. Como as duas tentativas compartilhavam a mesma trava (só
  // tenta uma vez), o pedido feito cedo demais no "pointerdown" já
  // "gastava" essa trava mesmo sendo negado pelo navegador, e o "click"
  // seguinte (que teria funcionado) nunca chegava a tentar — por isso o app
  // ficava preso na versão não-expandida até o toque manual no botão, que
  // só usa "click" e por isso sempre funcionava. Usando só "click" aqui,
  // igual ao botão manual (ver alternarTelaCheia abaixo), o primeiro toque
  // do usuário passa a expandir de verdade.
  useEffect(() => {
    if (!suportado) return;
    const ehCelular = window.matchMedia('(max-width: 768px)').matches;
    if (!ehCelular || document.fullscreenElement) return;

    function aoPrimeiroToque() {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Pedido negado pelo navegador — sem travar nada, o app continua
        // funcionando normalmente, só sem entrar em tela cheia sozinho.
      });
    }
    document.addEventListener('click', aoPrimeiroToque, { once: true });
    return () => {
      document.removeEventListener('click', aoPrimeiroToque);
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
