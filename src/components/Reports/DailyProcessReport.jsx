import React, { useMemo } from 'react';
import { ListChecks, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getLojasDoDia } from '../../utils/selectors';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';
import { getStatusLoja } from '../../utils/statusStyles';
import { formatarHora, formatarData } from '../../utils/dateHelpers';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

const ROTULO_TIPO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

// Situação do carregamento de uma loja HOJE (dia operacional em que ela foi
// importada) — não é só olhar o status atual, porque um envio parcial
// (fica saldo) volta o status pra "agrupada" de novo, apagando o rastro de
// que já saiu carga dela hoje. Por isso também olha os protocolos da loja:
// se algum for "saldo", o carregamento já começou mesmo que ainda não
// tenha fechado.
function situacaoCarregamento(loja, protocolosDaLoja) {
  if (loja.status === 'finalizada') {
    return {
      chave: 'completo',
      texto: `Finalizado às ${formatarHora(loja.dataCarregamento)}`,
    };
  }
  if (protocolosDaLoja.some((p) => p.statusEnvio === 'saldo')) {
    return { chave: 'parcial', texto: 'Saiu parcial — aguardando saldo' };
  }
  if (loja.status === 'carregando') {
    return { chave: 'em_andamento', texto: 'Carregando agora' };
  }
  return { chave: 'pendente', texto: 'Aguardando' };
}

const ICONE_CARREGAMENTO = {
  completo: <CheckCircle2 size={14} className="text-emerald-500" />,
  parcial: <Clock size={14} className="text-amber-500" />,
  em_andamento: <Loader2 size={14} className="animate-spin text-purple-500" />,
  pendente: <XCircle size={14} className="text-slate-300 dark:text-slate-600" />,
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

  const linhas = useMemo(() => {
    return getLojasDoDia(state)
      .filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga))
      .map((loja) => {
        const protocolosDaLoja = state.protocolos.filter((p) => p.lojaId === loja.id);
        const apontamentoFeito = loja.status !== 'pendente';
        const carregamento = situacaoCarregamento(loja, protocolosDaLoja);
        const completo = apontamentoFeito && carregamento.chave === 'completo';
        return { loja, apontamentoFeito, carregamento, completo };
      })
      .sort((a, b) => {
        // O que ainda falta (apontamento ou carregamento) aparece primeiro,
        // pra chamar atenção logo de cara — igual ao relatório de meta.
        if (a.completo !== b.completo) return a.completo ? 1 : -1;
        // Ordenado pela LOJA (código físico da loja), não pela carga — é
        // por loja que o supervisor procura na lista, e é o código de loja
        // que se repete de forma previsível dia a dia (a carga muda a cada
        // importação).
        return a.loja.loja.localeCompare(b.loja.loja, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lojas, state.protocolos, state.diaAtual, filtroTipoCarga]);

  const total = linhas.length;
  const comApontamento = linhas.filter((l) => l.apontamentoFeito).length;
  const comCarregamentoCompleto = linhas.filter((l) => l.carregamento.chave === 'completo').length;
  const completas = linhas.filter((l) => l.completo).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Processo do Dia — {rotuloTipo}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Dia operacional: <span className="font-semibold">{formatarData(state.diaAtual)}</span> — apontamento e
              carregamento de cada loja programada para hoje
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
          <p className="text-xs text-slate-400 dark:text-slate-500">Carregamento finalizado</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {comCarregamentoCompleto}{' '}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold">Loja</th>
                  <th className="px-2 py-2 font-semibold">Status atual</th>
                  <th className="px-2 py-2 text-center font-semibold">Apontamento</th>
                  <th className="px-2 py-2 text-center font-semibold">Carregamento</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ loja, apontamentoFeito, carregamento, completo }) => {
                  const status = getStatusLoja(loja.status);
                  return (
                    <tr
                      key={loja.id}
                      className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${
                        !completo ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{loja.loja}</span>
                          <span className="text-slate-500 dark:text-slate-400">{loja.nomeLoja}</span>
                          <TipoCargaBadge tipo={loja.tipoCarga} />
                        </div>
                        <div className="text-slate-400 dark:text-slate-500">Carga {loja.carga}</div>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.corBadge}`}>
                          {status.texto}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {apontamentoFeito ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-slate-300 dark:text-slate-600" />
                          )}
                          <span
                            className={
                              apontamentoFeito
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {apontamentoFeito ? formatarHora(loja.dataApontamento) : 'Pendente'}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {ICONE_CARREGAMENTO[carregamento.chave]}
                          <span className={COR_TEXTO_CARREGAMENTO[carregamento.chave]}>{carregamento.texto}</span>
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
    </div>
  );
}
