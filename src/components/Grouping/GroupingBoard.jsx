import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import GroupingCard from './GroupingCard.jsx';
import { STATUS_LOJA } from '../../utils/statusStyles';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';

const COLUNAS = [
  { chave: 'apontada', titulo: 'Em Execução', ajuda: 'Box reservado, aguardando finalizar a conferência' },
  { chave: 'conferencia_finalizada', titulo: 'Conferência Finalizada', ajuda: 'Conferência concluída, aguardando início do agrupamento' },
  { chave: 'em_agrupamento', titulo: 'Agrupando', ajuda: 'Colaboradores montando a carga fisicamente' },
  { chave: 'agrupada', titulo: 'Agrupada', ajuda: 'Pronta para etiquetas e carregamento' },
];

function dataMaisRecente(loja) {
  return (
    loja.dataInicioAgrupamento || loja.dataAgrupamento || loja.dataConferencia || loja.dataApontamento || 0
  );
}

export default function GroupingBoard({ aoGerarEtiquetas, aoIniciarAgrupamento, aoConcluirAgrupamento, aoMoverBox }) {
  const { state, actions, filtroTipoCarga } = useApp();

  const porStatus = useMemo(() => {
    const mapa = { apontada: [], conferencia_finalizada: [], em_agrupamento: [], agrupada: [] };
    state.lojas.forEach((l) => {
      if (mapa[l.status] && lojaPassaFiltroTipoCarga(l, filtroTipoCarga)) mapa[l.status].push(l);
    });
    Object.keys(mapa).forEach((chave) => {
      mapa[chave].sort((a, b) => new Date(dataMaisRecente(b)) - new Date(dataMaisRecente(a)));
    });
    return mapa;
  }, [state.lojas, filtroTipoCarga]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {COLUNAS.map((coluna) => {
        const lojas = porStatus[coluna.chave];
        const status = STATUS_LOJA[coluna.chave];
        return (
          <div
            key={coluna.chave}
            className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
              <div className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${status.corPonto}`} />
                  {coluna.titulo}
                </span>
                <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{coluna.ajuda}</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                {lojas.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 p-3">
              {lojas.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">Nenhuma loja nesta etapa.</p>
              ) : (
                lojas.map((loja) => (
                  <GroupingCard
                    key={loja.id}
                    loja={loja}
                    aoConcluirConferencia={actions.concluirConferencia}
                    aoIniciarAgrupamento={aoIniciarAgrupamento}
                    aoConcluirAgrupamento={aoConcluirAgrupamento}
                    aoGerarEtiquetas={aoGerarEtiquetas}
                    aoCancelar={actions.cancelarAgrupamento}
                    aoMoverBox={aoMoverBox}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
