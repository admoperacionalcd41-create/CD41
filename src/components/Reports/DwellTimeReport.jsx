import React, { useMemo, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getPermanenciasRegistradas } from '../../utils/selectors';
import { formatarHora, formatarData, formatarDuracao, eHoje, eEsteMes } from '../../utils/dateHelpers';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

// Tempo de permanência = intervalo entre o motorista registrar chegada e
// saída na loja (aba Motoristas). Ajuda a enxergar lojas/motoristas com
// paradas muito longas, que costumam significar fila de descarga, atraso na
// operação da loja, ou algum problema no percurso.
function formatarPermanenciaMedia(msArray) {
  if (msArray.length === 0) return '—';
  const media = msArray.reduce((soma, ms) => soma + ms, 0) / msArray.length;
  return formatarDuracao(media);
}

export default function DwellTimeReport() {
  const { state, filtroTipoCarga } = useApp();
  const [periodo, setPeriodo] = useState('mes'); // 'mes' | 'hoje'
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;

  const permanencias = useMemo(() => {
    let lista = getPermanenciasRegistradas(state, tipo);
    if (periodo === 'hoje') {
      lista = lista.filter((p) => eHoje(p.saidaLoja));
    } else {
      lista = lista.filter((p) => eEsteMes(p.saidaLoja));
    }
    // Ordenado por data de entrega (saída da loja) — da mais recente pra
    // mais antiga. Em caso de empate na mesma data/hora, a maior
    // permanência aparece primeiro, como critério de desempate.
    return lista.sort(
      (a, b) => new Date(b.saidaLoja) - new Date(a.saidaLoja) || b.permanenciaMs - a.permanenciaMs
    );
  }, [state, tipo, periodo]);

  const mediaMs = useMemo(() => {
    if (permanencias.length === 0) return 0;
    return permanencias.reduce((soma, p) => soma + p.permanenciaMs, 0) / permanencias.length;
  }, [permanencias]);

  // A tabela agora é ordenada por data de entrega, não mais por duração —
  // então a maior permanência precisa ser calculada à parte (não é mais
  // necessariamente a primeira linha da lista).
  const maiorPermanencia = useMemo(() => {
    if (permanencias.length === 0) return null;
    return permanencias.reduce((maior, p) => (p.permanenciaMs > maior.permanenciaMs ? p : maior), permanencias[0]);
  }, [permanencias]);
  // Acima de 1h de permanência costuma chamar atenção — usado só pra
  // destacar visualmente as linhas mais demoradas na tabela.
  const LIMITE_ATENCAO_MS = 60 * 60 * 1000;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Tempo de Permanência do Motorista na Loja</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Do registro de chegada até o registro de saída, feitos na aba Motoristas
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Entregas com tempo registrado</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{permanencias.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Permanência média</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{formatarPermanenciaMedia(permanencias.map((p) => p.permanenciaMs))}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Maior permanência</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
            {maiorPermanencia ? formatarDuracao(maiorPermanencia.permanenciaMs) : '—'}
          </p>
          {maiorPermanencia && (
            <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
              {maiorPermanencia.loja.loja} — {maiorPermanencia.loja.nomeLoja}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {permanencias.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhuma entrega com chegada e saída registradas no período selecionado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold">Loja</th>
                  <th className="py-2 pr-3 font-semibold">Motorista</th>
                  <th className="py-2 pr-3 font-semibold">Placa</th>
                  <th className="py-2 pr-3 font-semibold">Chegada</th>
                  <th className="py-2 pr-3 font-semibold">Saída</th>
                  <th className="py-2 pr-3 font-semibold text-right">Permanência</th>
                </tr>
              </thead>
              <tbody>
                {permanencias.map((p) => {
                  const longa = p.permanenciaMs >= LIMITE_ATENCAO_MS;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${
                        longa ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                          {p.loja.loja} — {p.loja.nomeLoja}
                          <TipoCargaBadge tipo={p.loja.tipoCarga} />
                        </p>
                        <p className="text-slate-400 dark:text-slate-500">{formatarData(p.saidaLoja.slice(0, 10))}</p>
                      </td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{p.motorista}</td>
                      <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-300">{p.placa}</td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{formatarHora(p.chegadaLoja)}</td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{formatarHora(p.saidaLoja)}</td>
                      <td className="py-2 pr-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            longa ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {longa && <AlertTriangle size={12} />}
                          {formatarDuracao(p.permanenciaMs)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
