import React, { useMemo, useState } from 'react';
import { PlayCircle, FileSignature, Truck, Printer, Ban, AlertTriangle, Info, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getLojasProntasParaCarregar, getLojasEmCarregamento } from '../../utils/selectors';
import { formatarDataHora } from '../../utils/dateHelpers';
import { getStatusLoja } from '../../utils/statusStyles';
import { getNomeBox } from '../../utils/boxLogic';
import { imprimirProtocolo } from '../../utils/imprimirProtocolo';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';

export default function LoadingList({ aoAbrirProtocolo }) {
  const { state, actions, filtroTipoCarga } = useApp();
  // ids das lojas marcadas em "Em Carregamento" para sair juntas no mesmo
  // veículo (ver botão "Registrar Protocolo em Lote" abaixo da lista).
  const [selecionadas, setSelecionadas] = useState([]);
  // id do protocolo com o "Cancelar?" em confirmação na tabela abaixo.
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(null);
  // id da loja com o "Cancelar carregamento?" em confirmação na lista "Em
  // Carregamento" (desfaz o "Iniciar Carregamento", volta pra Agrupada).
  const [confirmandoCancelamentoInicio, setConfirmandoCancelamentoInicio] = useState(null);
  // null = nada a mostrar; 'ok' = impressão preparada (mostra dica de Ctrl+P);
  // 'erro' = falha real ao preparar o conteúdo para impressão.
  const [statusImpressao, setStatusImpressao] = useState(null);

  const prontas = useMemo(
    () => getLojasProntasParaCarregar(state).filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga)),
    [state, filtroTipoCarga]
  );
  // Agrupadas por região para o operador conseguir despachar veículos
  // cobrindo uma região de cada vez, em vez de pular entre regiões
  // diferentes. Usa o campo `nomeLoja` (Nome da Loja da planilha) como
  // região — é ali que a operação registra o nome da zona/região (ex.:
  // "Zona Sul", "Zona Leste"), não no campo `regiao` separado. Lojas sem
  // nome cadastrado caem num grupo "Sem região" ao final.
  const prontasPorRegiao = useMemo(() => {
    const mapa = new Map();
    prontas.forEach((loja) => {
      const chave = (loja.nomeLoja || '').trim() || 'Sem região';
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(loja);
    });
    return [...mapa.entries()].sort(([a], [b]) => {
      if (a === 'Sem região') return 1;
      if (b === 'Sem região') return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [prontas]);
  const emCarregamento = useMemo(
    () => getLojasEmCarregamento(state).filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga)),
    [state, filtroTipoCarga]
  );
  const ultimosProtocolos = useMemo(
    () =>
      state.protocolos
        .filter((p) => lojaPassaFiltroTipoCarga(state.lojas.find((l) => l.id === p.lojaId), filtroTipoCarga))
        .slice()
        .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))
        .slice(0, 8),
    [state.protocolos, state.lojas, filtroTipoCarga]
  );

  // Conta quantos protocolos de cada viagem em lote existem, para indicar
  // na tabela "Últimos Protocolos Registrados" que aquela linha faz parte
  // de um carregamento conjunto (mais de uma loja no mesmo veículo).
  const contagemPorViagem = useMemo(() => {
    const contagem = {};
    state.protocolos.forEach((p) => {
      if (!p.viagemId) return;
      contagem[p.viagemId] = (contagem[p.viagemId] || 0) + 1;
    });
    return contagem;
  }, [state.protocolos]);

  function alternarSelecao(lojaId) {
    setSelecionadas((prev) =>
      prev.includes(lojaId) ? prev.filter((id) => id !== lojaId) : [...prev, lojaId]
    );
  }

  function abrirProtocoloEmLote() {
    const lojasSelecionadas = emCarregamento.filter((l) => selecionadas.includes(l.id));
    if (lojasSelecionadas.length < 2) return;
    aoAbrirProtocolo(lojasSelecionadas);
    setSelecionadas([]);
  }

  function aoImprimir(protocolo) {
    const loja = state.lojas.find((l) => l.id === protocolo.lojaId);
    if (!loja) return;
    const outrasLojas = protocolo.viagemId
      ? state.protocolos
          .filter((p) => p.viagemId === protocolo.viagemId && p.id !== protocolo.id)
          .map((p) => {
            const l = state.lojas.find((x) => x.id === p.lojaId);
            return l
              ? {
                  carga: l.carga,
                  loja: l.loja,
                  nomeLoja: l.nomeLoja,
                  paletesEnviados: p.paletesEnviados,
                  posicaoCarregamento: p.posicaoCarregamento,
                  posicaoEntrega: p.posicaoEntrega,
                }
              : null;
          })
          .filter(Boolean)
      : [];
    const abriu = imprimirProtocolo(protocolo, loja, outrasLojas);
    setStatusImpressao(abriu ? 'ok' : 'erro');
  }

  function aoCancelar(protocoloId) {
    actions.cancelarProtocolo(protocoloId);
    setConfirmandoCancelamento(null);
  }

  function aoCancelarInicioCarregamento(lojaId) {
    actions.cancelarInicioCarregamento(lojaId);
    setConfirmandoCancelamentoInicio(null);
    setSelecionadas((prev) => prev.filter((id) => id !== lojaId));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Prontas para Carregar ({prontas.length})</h2>
        {prontas.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma loja aguardando início de carregamento.</p>
        ) : (
          <div className="space-y-4">
            {prontasPorRegiao.map(([regiao, lojasDaRegiao]) => (
              <div key={regiao}>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <MapPin size={12} /> {regiao} ({lojasDaRegiao.length})
                </p>
                <div className="space-y-2">
                  {lojasDaRegiao.map((loja) => (
                    <div key={loja.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                      <div className="text-sm">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${getStatusLoja(loja.status).corPonto}`} />
                          {loja.carga} — Loja {loja.loja}
                          <TipoCargaBadge tipo={loja.tipoCarga} />
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {getNomeBox(loja.boxNumero)} • {loja.paletesAgrupados} paletes
                        </p>
                      </div>
                      <button
                        onClick={() => actions.iniciarCarregamento(loja.id)}
                        className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
                      >
                        <PlayCircle size={14} /> Iniciar Carregamento
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Em Carregamento ({emCarregamento.length})</h2>
          {emCarregamento.length >= 2 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Marque duas ou mais lojas para registrar um único protocolo (mesmo veículo).
            </p>
          )}
        </div>
        {emCarregamento.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma carga em carregamento no momento.</p>
        ) : (
          <div className="space-y-2">
            {emCarregamento.map((loja) => (
              <div
                key={loja.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-100 bg-purple-50/40 p-3 dark:border-purple-900/40 dark:bg-purple-950/20"
              >
                <div className="flex items-center gap-3 text-sm">
                  {emCarregamento.length >= 2 && (
                    <input
                      type="checkbox"
                      checked={selecionadas.includes(loja.id)}
                      onChange={() => alternarSelecao(loja.id)}
                      aria-label={`Selecionar loja ${loja.loja} para carregamento em lote`}
                      className="h-4 w-4 flex-shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                    />
                  )}
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${getStatusLoja(loja.status).corPonto}`} />
                      {loja.carga} — Loja {loja.loja}
                      <TipoCargaBadge tipo={loja.tipoCarga} />
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {loja.nomeLoja} • {getNomeBox(loja.boxNumero)} • {loja.paletesAgrupados} paletes • {loja.colaboradores.join(', ') || 'sem colaboradores'}
                    </p>
                  </div>
                </div>
                {confirmandoCancelamentoInicio === loja.id ? (
                  <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-900/40">
                    <span className="text-amber-700 dark:text-amber-300">Cancelar carregamento?</span>
                    <button
                      type="button"
                      onClick={() => aoCancelarInicioCarregamento(loja.id)}
                      className="rounded bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoCancelamentoInicio(null)}
                      className="rounded px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmandoCancelamentoInicio(loja.id)}
                      title="Cancelar o início do carregamento — a loja volta para Agrupada"
                      className="flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Ban size={14} /> Cancelar
                    </button>
                    <button
                      onClick={() => aoAbrirProtocolo([loja])}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <FileSignature size={14} /> Registrar Protocolo
                    </button>
                  </div>
                )}
              </div>
            ))}

            {selecionadas.length >= 2 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-500 bg-brand-50 p-3 text-xs dark:border-brand-400 dark:bg-brand-500/10">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {selecionadas.length} lojas selecionadas para o mesmo veículo
                </span>
                <button
                  onClick={abrirProtocoloEmLote}
                  className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                >
                  <Truck size={14} /> Registrar Protocolo em Lote
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Últimos Protocolos Registrados</h2>
        {statusImpressao === 'ok' && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:border dark:border-current dark:bg-blue-500/10 dark:text-blue-300">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Protocolo pronto para impressão. Se a caixa de impressão não abrir automaticamente, pressione{' '}
              <strong>Ctrl+P</strong> (ou <strong>Cmd+P</strong> no Mac).
            </span>
          </div>
        )}
        {statusImpressao === 'erro' && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>Não foi possível preparar a impressão do protocolo. Tente novamente.</span>
          </div>
        )}
        {ultimosProtocolos.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum protocolo registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold">Loja</th>
                  <th className="py-2 pr-3 font-semibold">Tipo</th>
                  <th className="py-2 pr-3 font-semibold">Placa</th>
                  <th className="py-2 pr-3 font-semibold">Motorista</th>
                  <th className="py-2 pr-3 font-semibold">Lacres</th>
                  <th className="py-2 pr-3 font-semibold">Paletes</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Data/Hora</th>
                  <th className="py-2 pr-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ultimosProtocolos.map((p) => {
                  const loja = state.lojas.find((l) => l.id === p.lojaId);
                  const podeCancelar = p.boxNumero != null && !!p.vagasLiberadas;
                  return (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 dark:border-slate-700/60">
                      <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
                        {loja ? `${loja.carga} / ${loja.loja}` : '—'}
                        {p.viagemId && contagemPorViagem[p.viagemId] > 1 && (
                          <span
                            title="Carregado junto com outras lojas no mesmo veículo"
                            className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                          >
                            <Truck size={10} /> +{contagemPorViagem[p.viagemId] - 1}
                          </span>
                        )}
                        {p.viagemId && contagemPorViagem[p.viagemId] > 1 && p.posicaoEntrega != null && (
                          <span
                            title="Posição na sequência de entrega combinada ao registrar o protocolo em lote"
                            className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                          >
                            {p.posicaoEntrega}ª entrega
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <TipoCargaBadge tipo={loja?.tipoCarga} />
                      </td>
                      <td className="py-2 pr-3 font-mono font-semibold text-slate-700 dark:text-slate-200">{p.placa}</td>
                      <td className="py-2 pr-3">{p.motorista}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.lacres.filter(Boolean).join(', ') || '—'}</td>
                      <td className="py-2 pr-3">{p.paletesEnviados}</td>
                      <td className="py-2 pr-3">
                        <span
                          title={
                            p.statusEnvio === 'saldo' && p.lotesRestantesDescricao?.length
                              ? `Palete(s) ${p.lotesRestantesDescricao.join(', ')} ficaram no box`
                              : undefined
                          }
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            p.statusEnvio === 'completo' ? 'bg-emerald-50 text-emerald-600 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-600 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300'
                          }`}
                        >
                          {p.statusEnvio === 'completo' ? 'Completo' : 'Saldo'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-400 dark:text-slate-500">{formatarDataHora(p.dataHora)}</td>
                      <td className="py-2 pr-3">
                        {confirmandoCancelamento === p.id ? (
                          <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 dark:border-amber-700 dark:bg-amber-900/40">
                            <span className="text-amber-700 dark:text-amber-300">Cancelar protocolo?</span>
                            <button
                              type="button"
                              onClick={() => aoCancelar(p.id)}
                              className="rounded bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoCancelamento(null)}
                              className="rounded px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => aoImprimir(p)}
                              title="Imprimir protocolo"
                              className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <Printer size={12} /> Imprimir
                            </button>
                            <button
                              type="button"
                              onClick={() => podeCancelar && setConfirmandoCancelamento(p.id)}
                              disabled={!podeCancelar}
                              title={
                                podeCancelar
                                  ? 'Cancelar protocolo — a loja volta para Em Carregamento'
                                  : 'Este protocolo é antigo demais e não pode ser cancelado'
                              }
                              className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:disabled:border-slate-700 dark:disabled:text-slate-600"
                            >
                              <Ban size={12} /> Cancelar
                            </button>
                          </div>
                        )}
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
