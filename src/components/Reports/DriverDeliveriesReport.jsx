import React, { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getEntregasPorMotorista } from '../../utils/selectors';
import { eHoje, eEsteMes } from '../../utils/dateHelpers';

// Quantas lojas cada motorista entregou — conta protocolos completos e
// parciais/saldo (se ele levou parte da carga pra loja, ela conta como
// entregue por ele), sem contar a mesma loja duas vezes pro mesmo
// motorista.
export default function DriverDeliveriesReport() {
  const { state, filtroTipoCarga } = useApp();
  const [periodo, setPeriodo] = useState('mes'); // 'mes' | 'hoje'
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;

  const entregasPorMotorista = useMemo(() => {
    const filtroData = periodo === 'hoje' ? (dataHora) => eHoje(dataHora) : (dataHora) => eEsteMes(dataHora);
    return getEntregasPorMotorista(state, tipo, filtroData);
  }, [state, tipo, periodo]);

  const maiorValor = Math.max(1, ...entregasPorMotorista.map((m) => m.lojasEntregues));
  const totalLojas = entregasPorMotorista.reduce((soma, m) => soma + m.lojasEntregues, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Lojas Entregues por Motorista</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Total de {totalLojas} loja{totalLojas !== 1 ? 's' : ''} entregue{totalLojas !== 1 ? 's' : ''} por{' '}
              {entregasPorMotorista.length} motorista{entregasPorMotorista.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-600">
          {[
            { chave: 'hoje', rotulo: 'Hoje' },
            { chave: 'mes', rotulo: 'Este mês' },
          ].map((opcao) => (
            <button
              key={opcao.chave}
              onClick={() => setPeriodo(opcao.chave)}
              className={`px-3 py-1.5 font-medium ${
                periodo === opcao.chave
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {opcao.rotulo}
            </button>
          ))}
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
