import React, { useMemo } from 'react';
import { Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getEntregasPorMotorista } from '../../utils/selectors';

// Quantas lojas cada motorista entregou — conta protocolos completos e
// parciais/saldo (se ele levou parte da carga pra loja, ela conta como
// entregue por ele), sem contar a mesma loja duas vezes pro mesmo
// motorista.
//
// `periodoRelatorio` vem de ReportsPage (hook usePeriodoRelatorio
// compartilhado pelos três relatórios com filtro de período) — assim o
// mesmo período selecionado vale tanto pra tela quanto pra Exportar
// Excel/Imprimir (ver ReportsPage.jsx e exportExcel.js).
export default function DriverDeliveriesReport({ periodoRelatorio }) {
  const { state, filtroTipoCarga } = useApp();
  const { periodo, mesEscolhido, passaPeriodo } = periodoRelatorio;
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;

  const entregasPorMotorista = useMemo(() => {
    return getEntregasPorMotorista(state, tipo, passaPeriodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tipo, periodo, mesEscolhido]);

  const maiorValor = Math.max(1, ...entregasPorMotorista.map((m) => m.lojasEntregues));
  const totalLojas = entregasPorMotorista.reduce((soma, m) => soma + m.lojasEntregues, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center gap-2">
        <Truck size={18} className="text-brand-600 dark:text-brand-400" />
        <div>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Lojas Entregues por Motorista</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Total de {totalLojas} loja{totalLojas !== 1 ? 's' : ''} entregue{totalLojas !== 1 ? 's' : ''} por{' '}
            {entregasPorMotorista.length} motorista{entregasPorMotorista.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {entregasPorMotorista.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma entrega registrada no período selecionado.</p>
      ) : (
        <div className="space-y-3">
          {entregasPorMotorista.map((m) => (
            <div key={m.motorista} className="flex items-center gap-3">
              <span className="w-32 flex-shrink-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {m.motorista}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(m.lojasEntregues / maiorValor) * 100}%` }}
                />
              </div>
              <span className="w-24 flex-shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                {m.lojasEntregues} loja{m.lojasEntregues !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
