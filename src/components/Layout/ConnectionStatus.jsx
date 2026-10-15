import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useApp } from '../../context/AppContext.jsx';
import { SUPABASE_CONFIGURADO } from '../../lib/supabaseClient';

// Indicador de status mostrado no canto inferior esquerdo da tela.
//
// Antes, isso só refletia `navigator.onLine` — se o CELULAR tinha internet,
// mostrava "Online", mesmo que a última gravação no Supabase tivesse
// FALHADO silenciosamente (só um aviso no console, invisível pra quem está
// usando o app). Era possível finalizar um carregamento, a tela mostrar
// "Online" o tempo todo, e aquela ação nunca ter sido salva de verdade —
// só percebida depois, quando sumia ou nunca aparecia pra outro operador.
//
// Agora, com Supabase configurado, o indicador reflete o status REAL da
// sincronização (ver useSyncedAppState.js): "Sincronizado" (gravação
// confirmada no servidor), "Salvando..." (gravação em andamento) ou "Falha
// ao salvar" (gravação não confirmada — o app continua tentando sozinho,
// com espera crescente, mas também dá pra forçar uma nova tentativa na
// hora). Sem Supabase (modo local/demo), continua mostrando só
// online/offline do navegador, que é tudo que existe pra mostrar nesse caso
// (localStorage não depende de rede).
export default function ConnectionStatus() {
  const online = useOnlineStatus();
  // useApp() exige um <AppProvider> — sempre existe aqui, pois
  // ConnectionStatus só é renderizado dentro da área logada do app (ver
  // App.jsx), que já está dentro do Provider (ver main.jsx).
  const { statusSincronizacao } = useApp();

  // Sem internet no aparelho, nada mais importa — nenhuma gravação consegue
  // sair mesmo, então esse é sempre o status mais relevante pra mostrar.
  if (!online) {
    return (
      <div className="flex items-center gap-1.5" title="Sem conexão com a internet — as ações feitas agora serão salvas quando a conexão voltar.">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">Sem conexão</span>
      </div>
    );
  }

  if (!SUPABASE_CONFIGURADO) {
    return (
      <div className="flex items-center gap-1.5" title="Conectado à internet">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Online</span>
      </div>
    );
  }

  if (statusSincronizacao.status === 'salvando') {
    return (
      <div className="flex items-center gap-1.5" title="Salvando as últimas alterações...">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Salvando...</span>
      </div>
    );
  }

  if (statusSincronizacao.status === 'erro') {
    return (
      <div
        className="flex items-center gap-1.5"
        title={`${statusSincronizacao.mensagem || 'Não foi possível salvar.'} (tentativa ${statusSincronizacao.tentativas}) — tentando de novo automaticamente, ou clique para tentar agora.`}
      >
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">Falha ao salvar</span>
        <button
          type="button"
          onClick={statusSincronizacao.tentarNovamente}
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-semibold text-red-700 underline decoration-dotted underline-offset-2 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          <RefreshCw size={10} /> tentar agora
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" title="Tudo salvo — última alteração sincronizada com o servidor.">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Sincronizado</span>
    </div>
  );
}
