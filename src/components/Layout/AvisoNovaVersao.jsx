import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useAtualizacaoAutomatica } from '../../hooks/useAtualizacaoAutomatica';

// Faixa que aparece por alguns segundos quando há uma versão nova publicada;
// o app recarrega sozinho ao fim da contagem (ver useAtualizacaoAutomatica.js).
export default function AvisoNovaVersao() {
  const { segundosRestantes, atualizarAgora } = useAtualizacaoAutomatica();
  if (segundosRestantes === null) return null;
  return (
    <div
      role="status"
      data-testid="aviso-nova-versao"
      className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
      <span>Nova versão disponível — atualizando em {Math.max(segundosRestantes, 0)} s</span>
      <button
        type="button"
        onClick={atualizarAgora}
        className="rounded-md bg-white px-3 py-1 text-blue-700 hover:bg-blue-50"
      >
        Atualizar agora
      </button>
    </div>
  );
}
