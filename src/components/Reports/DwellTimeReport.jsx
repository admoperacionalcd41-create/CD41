import React, { useMemo } from 'react';
import { Clock, AlertTriangle, MessageSquareWarning, TrendingDown } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getPermanenciasRegistradas, consolidarPermanenciaPorLoja } from '../../utils/selectors';
import { formatarHora, formatarData, formatarDuracao, getIntervaloSemana } from '../../utils/dateHelpers';
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

// `periodoRelatorio` vem de ReportsPage (hook usePeriodoRelatorio
// compartilhado pelos três relatórios com filtro de período) — assim o
// mesmo período selecionado (Hoje/Este mês/Escolher mês) vale tanto para o
// que aparece na tela quanto para o botão Exportar Excel/Imprimir, que
// ficam no nível de ReportsPage (ver ReportsPage.jsx e exportExcel.js).
export default function DwellTimeReport({ periodoRelatorio }) {
  const { state, filtroTipoCarga } = useApp();
  const { periodo, mesEscolhido, passaPeriodo, semanasAtras = 0 } = periodoRelatorio;
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;

  const permanencias = useMemo(() => {
    let lista = getPermanenciasRegistradas(state, tipo);
    lista = lista.filter((p) => passaPeriodo(p.saidaLoja));
    // Ordenado por data de entrega (saída da loja) — da mais recente pra
    // mais antiga. Em caso de empate na mesma data/hora, a maior
    // permanência aparece primeiro, como critério de desempate.
    return lista.sort(
      (a, b) => new Date(b.saidaLoja) - new Date(a.saidaLoja) || b.permanenciaMs - a.permanenciaMs
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tipo, periodo, mesEscolhido, semanasAtras]);

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
  // Visão "Semana": consolidado por loja (menor, maior e média), da pior
  // média pra melhor — pedido do usuário, pra identificar as lojas que mais
  // seguram os motoristas.
  const consolidadoPorLoja = useMemo(
    () => (periodo === 'semana' ? consolidarPermanenciaPorLoja(permanencias) : []),
    [periodo, permanencias]
  );
  const maiorMedia = consolidadoPorLoja.length ? consolidadoPorLoja[0].mediaMs : 0;
  const semana = getIntervaloSemana(semanasAtras);
  // Acima de 1h de permanência costuma chamar atenção — usado só pra
  // destacar visualmente as linhas mais demoradas na tabela.
  const LIMITE_ATENCAO_MS = 60 * 60 * 1000;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center gap-2">
        <Clock size={18} className="text-totvs-600 dark:text-whatsapp-400" />
        <div>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Tempo de Permanência do Motorista na Loja</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Do registro de chegada até o registro de saída, feitos na aba Motoristas
          </p>
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

      {periodo === 'semana' && permanencias.length > 0 && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800" data-testid="consolidado-semana">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-500 dark:text-red-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Consolidado da semana por loja</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {formatarData(semana.inicio)} a {formatarData(semana.fim)} — ordenado da PIOR média de permanência para a melhor
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Loja</th>
                  <th className="py-2 pr-3 font-semibold text-right">Entregas</th>
                  <th className="py-2 pr-3 font-semibold text-right">Menor tempo</th>
                  <th className="py-2 pr-3 font-semibold text-right">Maior tempo</th>
                  <th className="py-2 pr-3 font-semibold">Média de tempo</th>
                </tr>
              </thead>
              <tbody>
                {consolidadoPorLoja.map((l, i) => {
                  const acimaLimite = l.mediaMs >= LIMITE_ATENCAO_MS;
                  const piorTres = i < 3;
                  const acimaDaMedia = l.mediaMs > mediaMs;
                  const cor = acimaLimite
                    ? 'text-red-600 dark:text-red-400'
                    : acimaDaMedia
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-700 dark:text-slate-200';
                  return (
                    <tr
                      key={l.codigo}
                      data-testid={`linha-loja-${l.codigo}`}
                      className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${
                        acimaLimite ? 'bg-red-50/50 dark:bg-red-950/15' : piorTres ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-2 pr-3 text-slate-400 dark:text-slate-500">{i + 1}º</td>
                      <td className="py-2 pr-3">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                          {l.codigo}{l.nome ? ` — ${l.nome}` : ''}
                          <TipoCargaBadge tipo={l.tipoCarga} />
                          {piorTres && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300">
                              {i + 1}ª pior média
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{l.entregas}</td>
                      <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{formatarDuracao(l.menorMs)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-700 dark:text-slate-200">{formatarDuracao(l.maiorMs)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 flex-shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                            <div
                              className={`h-full rounded-full ${acimaLimite ? 'bg-red-500' : acimaDaMedia ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${maiorMedia > 0 ? (l.mediaMs / maiorMedia) * 100 : 0}%` }}
                            />
                          </div>
                          <span className={`inline-flex items-center gap-1 font-bold ${cor}`}>
                            {acimaLimite && <AlertTriangle size={12} />}
                            {formatarDuracao(l.mediaMs)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
            Vermelho: média de 1h ou mais. Âmbar: acima da média geral da semana ({formatarDuracao(mediaMs)}). As 3 lojas com pior média ganham a etiqueta "pior média".
          </p>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {periodo === 'semana' && permanencias.length > 0 && (
          <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Entregas da semana, uma a uma</h3>
        )}
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
                        {/* Observação opcional deixada pelo motorista ao registrar a
                            saída (ver DriversPage.jsx) — normalmente é o motivo de uma
                            permanência mais longa (fila, recusa de carga, atraso etc.). */}
                        {p.observacaoSaida && (
                          <p className="mt-1 flex items-start gap-1 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                            <MessageSquareWarning size={12} className="mt-px flex-shrink-0" />
                            <span>{p.observacaoSaida}</span>
                          </p>
                        )}
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
