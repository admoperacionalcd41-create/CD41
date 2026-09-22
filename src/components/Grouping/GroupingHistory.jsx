import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Tags, ArrowRightLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { formatarDataHora } from '../../utils/dateHelpers';
import { getStatusLoja } from '../../utils/statusStyles';
import { getNomeBox } from '../../utils/boxLogic';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';

const STATUS_HISTORICO = ['carregando', 'finalizada'];

export default function GroupingHistory({ aoGerarEtiquetas, aoMoverBox }) {
  const { state, filtroTipoCarga } = useApp();
  const [aberto, setAberto] = useState(false);

  const lojas = useMemo(
    () =>
      state.lojas
        .filter((l) => STATUS_HISTORICO.includes(l.status) && lojaPassaFiltroTipoCarga(l, filtroTipoCarga))
        .sort((a, b) => new Date(b.dataAgrupamento || 0) - new Date(a.dataAgrupamento || 0)),
    [state.lojas, filtroTipoCarga]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Já em carregamento / finalizadas
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            {lojas.length}
          </span>
        </span>
        {aberto ? (
          <ChevronUp size={16} className="text-slate-400 dark:text-slate-500" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
        )}
      </button>

      {aberto && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-3 dark:border-slate-700">
          {lojas.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma loja nessas etapas ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="py-2 pr-3 font-semibold">Carga / Loja</th>
                    <th className="py-2 pr-3 font-semibold">Tipo</th>
                    <th className="py-2 pr-3 font-semibold">Box</th>
                    <th className="py-2 pr-3 font-semibold">Paletes</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Agrupada em</th>
                    <th className="py-2 pr-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lojas.map((loja) => {
                    const status = getStatusLoja(loja.status);
                    return (
                      <tr key={loja.id} className="border-b border-slate-50 last:border-0 dark:border-slate-700/60">
                        <td className="py-2 pr-3">
                          <p className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${status.corPonto}`} />
                            {loja.carga}
                          </p>
                          <p className="text-slate-400 dark:text-slate-500">{loja.loja} — {loja.nomeLoja}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <TipoCargaBadge tipo={loja.tipoCarga} />
                        </td>
                        <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">{getNomeBox(loja.boxNumero)}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">{loja.paletesAgrupados}</td>
                        <td className="py-2 pr-3">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${status.corBadge}`}>{status.texto}</span>
                        </td>
                        <td className="py-2 pr-3 text-slate-400 dark:text-slate-500">{formatarDataHora(loja.dataAgrupamento)}</td>
                        <td className="py-2 pr-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {loja.status === 'carregando' && aoMoverBox && (
                              <button
                                onClick={() => aoMoverBox(loja)}
                                title="Mover esta loja para outro box"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                              >
                                <ArrowRightLeft size={13} /> Mover
                              </button>
                            )}
                            <button
                              onClick={() => aoGerarEtiquetas(loja)}
                              title="Gerar etiquetas"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <Tags size={13} /> Etiquetas
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
