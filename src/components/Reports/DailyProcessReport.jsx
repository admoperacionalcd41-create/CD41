import React, { useMemo } from 'react';
import { ListChecks, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getLinhasProcessoDoDia } from '../../utils/selectors';
import { formatarData } from '../../utils/dateHelpers';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

const ROTULO_TIPO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

const ICONE_CARREGAMENTO = {
  completo: <CheckCircle2 size={12} className="text-emerald-500" />,
  parcial: <Clock size={12} className="text-amber-500" />,
  em_andamento: <Loader2 size={12} className="animate-spin text-purple-500" />,
  pendente: <XCircle size={12} className="text-slate-300 dark:text-slate-600" />,
};

const COR_TEXTO_CARREGAMENTO = {
  completo: 'text-emerald-600 dark:text-emerald-400',
  parcial: 'text-amber-600 dark:text-amber-400',
  em_andamento: 'text-purple-600 dark:text-purple-400',
  pendente: 'text-slate-400 dark:text-slate-500',
};

export default function DailyProcessReport() {
  const { state, filtroTipoCarga } = useApp();
  const rotuloTipo = ROTULO_TIPO[filtroTipoCarga] || ROTULO_TIPO.todos;

  // A lógica de montar essa lista (uma linha por código de loja, sempre com
  // as lojas fixas do histórico, apontamento/carregamento validados só pra
  // hoje de verdade) mora em getLinhasProcessoDoDia (selectors.js) — foi
  // extraída de lá pra poder ser reaproveitada também no card de resumo
  // operacional da aba Boxes & Vagas, sem duplicar essa regra em dois
  // lugares.
  const linhas = useMemo(
    () => getLinhasProcessoDoDia(state, filtroTipoCarga),
    [state.lojas, state.protocolos, state.diaAtual, filtroTipoCarga]
  );

  const total = linhas.length;
  const comApontamento = linhas.filter((l) => l.apontamentoFeito).length;
  const comCarregamento = linhas.filter((l) => l.carregamentoFeito).length;
  const completas = linhas.filter((l) => l.completo).length;

  // Não agrupa mais por praça/cidade (`nomeLoja`) — o pedido foi tirar essa
  // organização. Em vez disso, separa só em duas faixas visuais (o que
  // ainda falta x o que já foi concluído), já que `linhas` vem ordenada
  // assim (pendente primeiro — ver sort no useMemo acima): uma cabeceira de
  // seção com contagem marca a virada entre as duas faixas, o suficiente
  // pra escanear rápido uma lista longa sem reintroduzir agrupamento por
  // localização.
  const pendentes = linhas.filter((l) => !l.completo);
  const concluidas = linhas.filter((l) => l.completo);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Processo do Dia — {rotuloTipo}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Dia operacional: <span className="font-semibold">{formatarData(state.diaAtual)}</span> — a coluna Loja
              traz sempre as lojas fixas (todo código já visto em alguma importação), mesmo sem carga hoje; as
              colunas Apontamento e Carregamento validam só o que foi feito hoje de verdade (registros de dias
              anteriores não contam)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Apontamento feito</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {comApontamento} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {total}</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Carregamento feito</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {comCarregamento}{' '}
            <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {total}</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Processo completo</p>
          <p
            className={`mt-0.5 text-xl font-bold ${
              total > 0 && completas === total ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {completas} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {total}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-700">
        {total === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhuma loja de {rotuloTipo.toLowerCase()} programada para o dia operacional atual ainda. Importe os dados na
            aba Importar Dados.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-100 dark:border-slate-700">
            <table className="w-full text-left text-xs">
              {/* Cabeçalho fixo (sticky) — com uma lista de 28+ lojas rolando
                  dentro do card, vale sempre poder ver o nome das colunas
                  sem precisar voltar pro topo. */}
              <thead className="sticky top-0 z-10 bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pl-3 pr-3 font-semibold">Loja</th>
                  <th className="px-2 py-2 text-center font-semibold">Apontamento</th>
                  <th className="px-2 py-2 text-center font-semibold">Carregamento</th>
                </tr>
              </thead>
              {[
                { chave: 'pendentes', rotulo: 'Ainda pendente', itens: pendentes },
                { chave: 'concluidas', rotulo: 'Processo completo', itens: concluidas },
              ]
                .filter((secao) => secao.itens.length > 0)
                .map((secao) => (
                  <tbody key={secao.chave}>
                    {/* Sem mais agrupamento por praça/cidade — só essa
                        cabeceira de seção (pendente x completo) pra separar
                        visualmente o que precisa de atenção do que já foi
                        resolvido, já que a lista inteira normalmente não
                        cabe numa tela só. */}
                    <tr>
                      <td
                        colSpan={3}
                        className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                          secao.chave === 'pendentes'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        }`}
                      >
                        {secao.rotulo} ({secao.itens.length})
                      </td>
                    </tr>
                    {secao.itens.map((loja, indice) => {
                      const multiplasCargas = loja.cargas.length > 1;
                      return (
                        <tr
                          key={loja.codigo}
                          className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${
                            indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-900/20' : ''
                          }`}
                        >
                          <td className="py-2 pl-3 pr-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{loja.codigo}</span>
                              <span className="text-slate-500 dark:text-slate-400">{loja.nomeLoja}</span>
                              {loja.tiposCarga.map((tipo) => (
                                <TipoCargaBadge key={tipo} tipo={tipo} />
                              ))}
                            </div>
                            {/* Detalhe por carga só aparece quando a loja tem mais de
                                uma no dia — é o que justifica não confiar num status
                                único por linha (ver comentário acima do useMemo). Uma
                                loja fixa sem nenhuma carga importada hoje (ver useMemo)
                                mostra um aviso em vez de "Carga undefined". */}
                            {loja.cargas.length === 0 ? (
                              <div className="font-medium text-amber-600 dark:text-amber-400">
                                Nenhuma carga importada hoje
                              </div>
                            ) : multiplasCargas ? (
                              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-slate-400 dark:text-slate-500">
                                {loja.cargas.map((carga) => (
                                  <span key={carga.numero} className="inline-flex items-center gap-1">
                                    Carga {carga.numero}
                                    {ICONE_CARREGAMENTO[carga.situacaoChave]}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="text-slate-400 dark:text-slate-500">Carga {loja.cargas[0]?.numero}</div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {loja.apontamentoFeito ? (
                                <CheckCircle2 size={14} className="text-emerald-500" />
                              ) : (
                                <XCircle size={14} className="text-slate-300 dark:text-slate-600" />
                              )}
                              <span
                                className={
                                  loja.apontamentoFeito
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }
                              >
                                {loja.apontamentoFeito ? 'Sim' : 'Pendente'}
                                {multiplasCargas && ` (${loja.apontamentoContagem}/${loja.cargas.length})`}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {ICONE_CARREGAMENTO[loja.carregamentoFeito ? 'completo' : 'pendente']}
                              <span
                                className={
                                  COR_TEXTO_CARREGAMENTO[loja.carregamentoFeito ? 'completo' : 'pendente']
                                }
                              >
                                {loja.carregamentoFeito ? 'Sim' : 'Pendente'}
                                {multiplasCargas && ` (${loja.carregamentoContagem}/${loja.cargas.length})`}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
