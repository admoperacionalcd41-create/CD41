import React, { useMemo } from 'react';
import { ListChecks, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getLojasDoDia } from '../../utils/selectors';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';
import { formatarHora, formatarData } from '../../utils/dateHelpers';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

const ROTULO_TIPO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

// Situação do carregamento de UMA carga específica (um item de
// `state.lojas`) — não é só olhar o status atual, porque um envio parcial
// (fica saldo) volta o status pra "agrupada" de novo, apagando o rastro de
// que já saiu carga dela hoje. Por isso também olha os protocolos daquela
// carga: se algum for "saldo", o carregamento já começou mesmo que ainda
// não tenha fechado.
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

  // O sistema guarda um item de `state.lojas` por CARGA (uma mesma loja
  // pode receber mais de uma carga no mesmo dia — o código da loja se
  // repete, só a carga muda). Pra este relatório isso não interessa: o
  // pedido foi "28 lojas fixas, independente da carga" — o que importa é se
  // ALGUMA carga da loja já foi apontada e se ALGUMA já foi carregada, não
  // cada carga separadamente. Por isso agrupa tudo pelo código da loja
  // antes de montar as linhas, em vez de uma linha por carga.
  const linhas = useMemo(() => {
    const porCodigo = new Map();
    getLojasDoDia(state)
      .filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga))
      .forEach((loja) => {
        const protocolosDaLoja = state.protocolos.filter((p) => p.lojaId === loja.id);
        const situacao = situacaoCarregamento(loja, protocolosDaLoja);
        const carga = {
          numero: loja.carga,
          tipoCarga: loja.tipoCarga,
          apontada: loja.status !== 'pendente',
          situacao,
        };
        if (!porCodigo.has(loja.loja)) {
          porCodigo.set(loja.loja, { codigo: loja.loja, nomeLoja: loja.nomeLoja, cargas: [] });
        }
        porCodigo.get(loja.loja).cargas.push(carga);
      });

    return Array.from(porCodigo.values())
      .map((loja) => {
        const apontamentoFeito = loja.cargas.some((c) => c.apontada);
        const apontamentoContagem = loja.cargas.filter((c) => c.apontada).length;
        const carregamentoFeito = loja.cargas.some((c) => c.situacao.chave === 'completo' || c.situacao.chave === 'parcial');
        const carregamentoContagem = loja.cargas.filter(
          (c) => c.situacao.chave === 'completo' || c.situacao.chave === 'parcial'
        ).length;
        const tiposCarga = [...new Set(loja.cargas.map((c) => c.tipoCarga))];
        // "O que importa é se foi feito o processo da loja" — processo
        // completo = teve alguma carga apontada E alguma carga carregada,
        // sem exigir que TODAS as cargas do dia estejam finalizadas.
        const completo = apontamentoFeito && carregamentoFeito;
        return { ...loja, tiposCarga, apontamentoFeito, apontamentoContagem, carregamentoFeito, carregamentoContagem, completo };
      })
      .sort((a, b) => {
        // O que ainda falta (apontamento ou carregamento) aparece primeiro,
        // pra chamar atenção logo de cara.
        if (a.completo !== b.completo) return a.completo ? 1 : -1;
        return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lojas, state.protocolos, state.diaAtual, filtroTipoCarga]);

  const total = linhas.length;
  const comApontamento = linhas.filter((l) => l.apontamentoFeito).length;
  const comCarregamento = linhas.filter((l) => l.carregamentoFeito).length;
  const completas = linhas.filter((l) => l.completo).length;

  // Agrupa pelo "grupo" da loja — o campo que mostra nomes como CARUARU,
  // BELO JARDIM... (é `loja.nomeLoja`; várias lojas costumam compartilhar o
  // mesmo grupo/praça). Os grupos aparecem em ordem alfabética; dentro de
  // cada grupo, mantém a mesma ordenação de antes (pendente primeiro,
  // depois por código da loja).
  const grupos = useMemo(() => {
    const mapa = new Map();
    linhas.forEach((linha) => {
      const nomeGrupo = linha.nomeLoja || 'Sem grupo';
      if (!mapa.has(nomeGrupo)) mapa.set(nomeGrupo, []);
      mapa.get(nomeGrupo).push(linha);
    });
    return Array.from(mapa.entries())
      .map(([nome, itens]) => ({
        nome,
        itens,
        completos: itens.filter((i) => i.completo).length,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [linhas]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Processo do Dia — {rotuloTipo}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Dia operacional: <span className="font-semibold">{formatarData(state.diaAtual)}</span> — uma linha por
              loja, mesmo quando ela tem mais de uma carga hoje: o que importa é se a loja teve alguma carga apontada
              e alguma carga carregada
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold">Loja</th>
                  <th className="px-2 py-2 text-center font-semibold">Apontamento</th>
                  <th className="px-2 py-2 text-center font-semibold">Carregamento</th>
                </tr>
              </thead>
              {grupos.map((grupo) => (
                <tbody key={grupo.nome}>
                  {/* Linha de cabeçalho do grupo (praça/cidade da loja) —
                      mostra o nome e quantas lojas do grupo já concluíram o
                      processo, pra dar uma visão rápida grupo a grupo antes
                      de entrar no detalhe de cada loja. */}
                  <tr>
                    <td colSpan={3} className="bg-slate-50 px-2 py-1.5 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {grupo.nome}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            grupo.completos === grupo.itens.length
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {grupo.completos}/{grupo.itens.length} completas
                        </span>
                      </div>
                    </td>
                  </tr>
                  {grupo.itens.map((loja) => {
                    const multiplasCargas = loja.cargas.length > 1;
                    return (
                      <tr
                        key={loja.codigo}
                        className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${
                          !loja.completo ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                        }`}
                      >
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{loja.codigo}</span>
                            <span className="text-slate-500 dark:text-slate-400">{loja.nomeLoja}</span>
                            {loja.tiposCarga.map((tipo) => (
                              <TipoCargaBadge key={tipo} tipo={tipo} />
                            ))}
                          </div>
                          {/* Detalhe por carga só aparece quando a loja tem mais de
                              uma no dia — é o que justifica não confiar num status
                              único por linha (ver comentário acima do useMemo). */}
                          {multiplasCargas ? (
                            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-slate-400 dark:text-slate-500">
                              {loja.cargas.map((carga) => (
                                <span key={carga.numero} className="inline-flex items-center gap-1">
                                  Carga {carga.numero}
                                  {ICONE_CARREGAMENTO[carga.situacao.chave]}
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
