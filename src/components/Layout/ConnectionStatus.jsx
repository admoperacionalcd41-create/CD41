import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useApp } from '../../context/AppContext.jsx';
import { SUPABASE_CONFIGURADO } from '../../lib/supabaseClient';

// Pedido do usuário ("ainda tá sobrepondo atualização de outros
// usuários"): a gravação otimizada (que evita sobreposição entre
// usuários — ver app_state_aplicar_patches em supabase/schema.sql) está
// falhando na prática, e cada falha cai pro caminho antigo (grava o
// documento inteiro), que é o que causa a sobreposição relatada. Faltava
// um jeito de ver o erro EXATO sem pedir print do painel do Supabase
// (processo lento, já rendeu print do projeto errado uma vez). Este
// aviso mostra o erro reportado pelo próprio Supabase, com um botão de
// copiar, direto onde o usuário já olha pra saber se está "Sincronizado".
function AvisoPatches({ aviso }) {
  const [copiado, setCopiado] = useState(false);

  const textoCompleto = [
    `Gravação otimizada falhou às ${aviso.em}`,
    aviso.codigo ? `Código: ${aviso.codigo}` : null,
    `Mensagem: ${aviso.mensagem}`,
    aviso.detalhes ? `Detalhes: ${aviso.detalhes}` : null,
    aviso.hint ? `Dica: ${aviso.hint}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCompleto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de clipboard (raro) — o texto já está visível na
      // tela, o usuário pode selecionar manualmente.
    }
  };

  return (
    <div className="mt-1 flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">Gravação otimizada indisponível (dados ainda estão sendo salvos, mas sem a proteção contra sobreposição entre usuários)</p>
        <p className="mt-0.5 break-words font-mono">{aviso.mensagem}{aviso.codigo ? ` (código ${aviso.codigo})` : ''}</p>
        <p className="mt-0.5 opacity-75">às {aviso.em} — envie este texto pro suporte:</p>
      </div>
      <button
        type="button"
        onClick={copiar}
        className="flex flex-shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-semibold underline decoration-dotted underline-offset-2 hover:bg-amber-100 dark:hover:bg-amber-900/40"
      >
        {copiado ? <Check size={11} /> : <Copy size={11} />} {copiado ? 'copiado!' : 'copiar'}
      </button>
    </div>
  );
}

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

  // Pedido do usuário: a gravação otimizada pode estar falhando por baixo
  // dos panos (cai pro caminho antigo, que SALVA mas sobrepõe outros
  // usuários — ver avisoPatches em useSyncedAppState.js) mesmo quando o
  // indicador abaixo mostra "Salvando..." ou "Sincronizado" (porque, do
  // ponto de vista de "a ação foi perdida ou não", ela realmente não foi).
  // Por isso o aviso aparece JUNTO de qualquer um dos badges abaixo, não
  // substituindo nenhum deles.
  const aviso = statusSincronizacao.avisoPatches ? <AvisoPatches aviso={statusSincronizacao.avisoPatches} /> : null;

  if (statusSincronizacao.status === 'salvando') {
    return (
      <div>
        <div className="flex items-center gap-1.5" title="Salvando as últimas alterações...">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Salvando...</span>
        </div>
        {aviso}
      </div>
    );
  }

  if (statusSincronizacao.status === 'erro') {
    return (
      <div>
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
        {aviso}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5" title="Tudo salvo — última alteração sincronizada com o servidor.">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Sincronizado</span>
      </div>
      {aviso}
    </div>
  );
}
