import React from 'react';
import { ClipboardCheck, PlayCircle, CheckCircle, Tags, XCircle, Package, Users, ArrowRightLeft } from 'lucide-react';
import { getStatusLoja } from '../../utils/statusStyles';
import { getNomeBox } from '../../utils/boxLogic';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

export default function GroupingCard({
  loja,
  aoConcluirConferencia,
  aoIniciarAgrupamento,
  aoConcluirAgrupamento,
  aoGerarEtiquetas,
  aoCancelar,
  aoMoverBox,
}) {
  const status = getStatusLoja(loja.status);
  const estimado = ['apontada', 'conferencia_finalizada', 'em_agrupamento'].includes(loja.status);
  const podeCancelar = ['apontada', 'conferencia_finalizada', 'em_agrupamento', 'agrupada'].includes(loja.status);
  const podeGerarEtiquetas = ['agrupada', 'carregando', 'finalizada'].includes(loja.status);

  // "Cancelar" volta a loja para a etapa anterior do processo — o texto do
  // botão/dica muda conforme a etapa atual, para deixar claro pra onde ela
  // vai voltar (ver CANCELAR_AGRUPAMENTO em AppContext.jsx).
  const TITULO_CANCELAR = {
    apontada: 'Cancelar apontamento e liberar as vagas — a loja volta para Pendente',
    conferencia_finalizada: 'Desfazer a conferência finalizada — a loja volta para Em Execução',
    em_agrupamento: 'Desfazer o início do agrupamento — a loja volta para Conferência Finalizada',
    agrupada: 'Desfazer a conclusão do agrupamento — a loja volta para Agrupando',
  };

  return (
    <div
      className={`rounded-lg border-l-4 border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800 ${status.corBorda}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">{loja.carga}</p>
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{loja.loja} — {loja.nomeLoja}</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {getNomeBox(loja.boxNumero)}
          </span>
          <TipoCargaBadge tipo={loja.tipoCarga} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Package size={12} className="flex-shrink-0" />
          {loja.paletesAgrupados} pal.
          {estimado && <span className="text-slate-400 dark:text-slate-500"> (estimado)</span>}
        </span>
        {loja.colaboradores.length > 0 && (
          <span className="flex min-w-0 items-center gap-1">
            <Users size={12} className="flex-shrink-0" />
            <span className="truncate">{loja.colaboradores.join(', ')}</span>
          </span>
        )}
      </div>
      {loja.deposito && (
        <p className="mb-3 -mt-2 text-[11px] text-slate-300 dark:text-slate-600">Depósito: {loja.deposito}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {loja.status === 'apontada' && (
          <button
            onClick={() => aoConcluirConferencia(loja.id)}
            title="Marcar a conferência física da carga como finalizada"
            className="flex items-center gap-1 rounded-md border border-teal-200 px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:border-teal-900/60 dark:text-teal-300 dark:hover:bg-teal-950/40"
          >
            <ClipboardCheck size={13} /> Finalizar Conferência
          </button>
        )}
        {loja.status === 'conferencia_finalizada' && (
          <button
            onClick={() => aoIniciarAgrupamento(loja)}
            title="Sinalizar colaboradores e iniciar o agrupamento"
            className="flex items-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          >
            <PlayCircle size={13} /> Iniciar Agrupamento
          </button>
        )}
        {loja.status === 'em_agrupamento' && (
          <button
            onClick={() => aoConcluirAgrupamento(loja)}
            title="Informar a quantidade final de paletes e concluir o agrupamento"
            className="flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            <CheckCircle size={13} /> Concluir Agrupamento
          </button>
        )}
        {podeGerarEtiquetas && (
          <button
            onClick={() => aoGerarEtiquetas(loja)}
            title="Gerar etiquetas"
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Tags size={13} /> Etiquetas
          </button>
        )}
        {aoMoverBox && (
          <button
            onClick={() => aoMoverBox(loja)}
            title="Mover esta loja para outro box"
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowRightLeft size={13} /> Mover
          </button>
        )}
        {podeCancelar && (
          <button
            onClick={() => aoCancelar(loja.id)}
            title={TITULO_CANCELAR[loja.status]}
            className="ml-auto flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <XCircle size={13} /> Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
