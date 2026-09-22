import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

// Indicador simples de status de conexão — mostrado no rodapé da barra
// lateral (canto inferior esquerdo da tela). Ponto verde pulsando quando o
// navegador está online, ponto vermelho parado quando fica sem conexão.
export default function ConnectionStatus() {
  const online = useOnlineStatus();

  return (
    <div className="flex items-center gap-1.5" title={online ? 'Conectado à internet' : 'Sem conexão com a internet'}>
      <span className="relative flex h-2 w-2 flex-shrink-0">
        {online && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`}
        />
      </span>
      <span
        className={`text-xs font-semibold ${
          online ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {online ? 'Online' : 'Sem conexão'}
      </span>
    </div>
  );
}
