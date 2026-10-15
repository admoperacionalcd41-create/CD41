import { useCallback, useEffect, useState } from 'react';

// Captura o evento 'beforeinstallprompt' (Chrome/Android — quando o
// navegador decide que o site pode ser instalado como app) assim que ele
// disparar. Isso é feito aqui, no escopo do módulo (fora de qualquer
// componente), e não dentro de um useEffect de uma tela — o navegador só
// dispara esse evento UMA vez por carregamento de página, então se
// ninguém estiver ouvindo no instante certo a chance se perde pro resto da
// sessão. Como a aba Motoristas (que usa este hook) só é baixada sob
// demanda (React.lazy — ver App.jsx), ela pode nem estar carregada ainda
// quando o evento dispara; por isso este arquivo é importado também, só
// pelo efeito colateral do registro do listener, logo no início do app
// (ver main.jsx) — garantindo que o evento nunca é perdido, não importa em
// qual aba o motorista estiver quando ele disparar.
let eventoInstalacaoCapturado = null;
const ouvintes = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    eventoInstalacaoCapturado = evento;
    ouvintes.forEach((cb) => cb());
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalacaoCapturado = null;
    ouvintes.forEach((cb) => cb());
  });
}

function estaInstalado() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // Safari/iOS não tem display-mode, usa esta propriedade própria.
  );
}

// Pedido do usuário: o app deve abrir "já expandido" (sem barra de
// endereço do navegador) no celular. A Fullscreen API (ver
// useFullscreen.js) só funciona enquanto o app está aberto numa aba comum
// do navegador e exige um toque do usuário pra ser autorizada — por isso
// nem sempre "pega" de primeira, dependendo do navegador/aparelho.
// Instalar o app na tela inicial resolve de vez: a partir daí ele sempre
// abre sem nenhuma barra de navegador (o manifest.webmanifest já define
// display: 'standalone'), automaticamente, sempre, sem depender de nenhum
// truque — é o mesmo efeito visual do botão "Expandir", só que de cara,
// em todo novo acesso, sem precisar tocar em nada.
export function useInstalarApp() {
  const [instalado, setInstalado] = useState(estaInstalado);
  const [disponivel, setDisponivel] = useState(() => Boolean(eventoInstalacaoCapturado));

  useEffect(() => {
    function atualizar() {
      setDisponivel(Boolean(eventoInstalacaoCapturado));
      setInstalado(estaInstalado());
    }
    ouvintes.add(atualizar);
    atualizar();
    return () => ouvintes.delete(atualizar);
  }, []);

  const instalar = useCallback(async () => {
    if (!eventoInstalacaoCapturado) return false;
    eventoInstalacaoCapturado.prompt();
    const resultado = await eventoInstalacaoCapturado.userChoice;
    eventoInstalacaoCapturado = null;
    setDisponivel(false);
    return resultado.outcome === 'accepted';
  }, []);

  return { instalado, disponivel, instalar };
}
