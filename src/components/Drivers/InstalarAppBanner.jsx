import React, { useState } from 'react';
import { Smartphone, Download, Share, X } from 'lucide-react';
import { useInstalarApp } from '../../hooks/useInstalarApp';

const CHAVE_DISPENSADO = 'doca-manager:instalar-app-dispensado';

const EH_IOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

// Pedido do usuário: a tela "ideal" no celular (sem barra do navegador,
// maior) só aparecia ao tocar manualmente no botão de expandir. O
// navegador nunca permite entrar em tela cheia sozinho sem um toque (ver
// useFullscreen.js) — mas instalar o app na tela inicial resolve isso de
// vez, porque aí ele sempre abre direto nessa tela cheia, automaticamente,
// todo santo dia (ver useInstalarApp.js). Este banner oferece essa
// instalação pros motoristas (leigos, no celular) — some sozinho depois de
// instalado ou se a pessoa tocar em "Agora não" (lembrado por aparelho).
export default function InstalarAppBanner() {
  const { instalado, disponivel, instalar } = useInstalarApp();
  const [dispensado, setDispensado] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_DISPENSADO) === 'true';
    } catch {
      return false;
    }
  });

  function dispensar() {
    setDispensado(true);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, 'true');
    } catch {
      // Armazenamento bloqueado (ex.: navegação anônima) — só não lembra a
      // escolha na próxima visita, sem travar nada.
    }
  }

  if (instalado || dispensado) return null;
  // Fora do Android/Chrome e fora do iOS não há nada de útil a oferecer
  // aqui (ex.: desktop, onde a tela cheia normal já basta).
  if (!disponivel && !EH_IOS) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-totvs-200 bg-totvs-50 p-4 text-totvs-800 dark:border-whatsapp-700/60 dark:bg-whatsapp-500/10 dark:text-whatsapp-200">
      <Smartphone size={22} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Adicione à tela inicial do celular</p>
        {EH_IOS ? (
          <p className="mt-1 text-sm">
            Toque no ícone <Share size={14} className="-mt-0.5 inline" /> de compartilhar do navegador e depois em
            "Adicionar à Tela de Início". Assim o app sempre abre em tela cheia, sem a barra do navegador — igual
            um aplicativo.
          </p>
        ) : (
          <p className="mt-1 text-sm">
            Assim o app sempre abre em tela cheia, sem a barra do navegador — igual um aplicativo, sem precisar
            tocar em "Expandir" toda vez.
          </p>
        )}
        <div className="mt-2.5 flex items-center gap-3">
          {!EH_IOS && (
            <button
              type="button"
              onClick={instalar}
              className="flex items-center gap-1.5 rounded-md bg-totvs-600 dark:bg-whatsapp-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-totvs-700 dark:hover:bg-whatsapp-700"
            >
              <Download size={15} /> Instalar
            </button>
          )}
          <button
            type="button"
            onClick={dispensar}
            className="text-sm font-medium text-totvs-700 hover:underline dark:text-whatsapp-300"
          >
            Agora não
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dispensar}
        aria-label="Fechar"
        className="flex-shrink-0 text-totvs-400 hover:text-totvs-600 dark:text-whatsapp-500 dark:hover:text-whatsapp-300"
      >
        <X size={16} />
      </button>
    </div>
  );
}
