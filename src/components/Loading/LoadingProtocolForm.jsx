import React, { useState } from 'react';
import { X, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getNomeBox } from '../../utils/boxLogic';
import { montarMensagemProtocolo } from '../../utils/notificacoes';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import SequenciaCarregamentoCaminhao from './SequenciaCarregamentoCaminhao.jsx';

// Descreve um número de palete junto com sua composição, quando os
// agrupadores juntaram lotes diferentes nele (ex.: "2 (lotes 2 + 5)") —
// ver ConcludeGroupingModal, onde essa composição é informada. Sem
// composição registrada, mostra só o número.
function descricaoPalete(l, numero) {
  const composicao = (l.composicaoPaletes || [])[numero - 1];
  return composicao && composicao.trim() ? `${numero} (lotes ${composicao.trim()})` : `${numero}`;
}

// Aceita `lojas` (array): 1 item usa o fluxo tradicional de protocolo único,
// com suporte a envio parcial/saldo; 2+ itens registram um único protocolo
// (mesma placa/motorista/lacres) cobrindo todas as lojas selecionadas, que
// saem juntas no mesmo veículo — nesse caso cada loja tem sua própria opção
// de sair completa ou com saldo (parcial), igual ao fluxo de loja única.
//
// `aoRegistrar` (opcional) é chamado com a mensagem de notificação pronta
// assim que o protocolo é registrado com sucesso — o pai (LoadingPage) usa
// isso para abrir a tela de "Notificar equipe" por WhatsApp em seguida.
export default function LoadingProtocolForm({ lojas, aoFechar, aoRegistrar }) {
  const { state, actions } = useApp();
  const [placa, setPlaca] = useState('');
  const [motorista, setMotorista] = useState('');
  const [lacres, setLacres] = useState(['', '', '']);
  const [statusEnvio, setStatusEnvio] = useState('completo');
  // Números dos paletes (os mesmos impressos nas etiquetas — ver
  // LabelGenerator, "PALETE n/total") que o operador marca como "ficando"
  // no box quando o envio é parcial — em vez de só informar uma
  // quantidade, ele diz exatamente qual(is) palete(s) permanece(m), pra
  // essa numeração ir na mensagem de WhatsApp pra equipe.
  const [loteRestante, setLoteRestante] = useState([]);
  // Quantidade de paletes enviados (loja única) — campo sempre em branco,
  // preenchido manualmente pelo operador (não é mais derivado da marcação
  // de paletes que ficaram de saldo).
  const [paletesEnviadosInput, setPaletesEnviadosInput] = useState('');
  // Fluxo em lote: status ('completo' | 'saldo') e paletes marcados como
  // restantes por loja, inicializados como envio completo para cada uma.
  const [statusPorLoja, setStatusPorLoja] = useState(() =>
    Object.fromEntries((lojas || []).map((l) => [l.id, 'completo']))
  );
  const [lotesRestantesPorLoja, setLotesRestantesPorLoja] = useState(() =>
    Object.fromEntries((lojas || []).map((l) => [l.id, []]))
  );
  // Quantidade de paletes enviados por loja (fluxo em lote) — também em
  // branco por padrão, informada manualmente pelo operador para cada loja.
  const [quantidadesInformadasPorLoja, setQuantidadesInformadasPorLoja] = useState(() =>
    Object.fromEntries((lojas || []).map((l) => [l.id, '']))
  );
  // Ordem de carregamento no lote (array de ids de loja; posição 0 = primeira
  // carregada). Começa na mesma ordem em que as lojas foram selecionadas na
  // lista — o operador ajusta arrastando no desenho do caminhão, se precisar.
  const [ordemCarregamento, setOrdemCarregamento] = useState(() => (lojas || []).map((l) => l.id));

  if (!lojas || lojas.length === 0) return null;
  const emLote = lojas.length > 1;
  const loja = lojas[0]; // usado apenas no fluxo de loja única

  const placaCadastrada = (state.placasCadastradas || []).find(
    (p) => p.placa === placa.trim().toUpperCase()
  );

  // A quantidade enviada de cada loja (fluxo em lote) vem sempre do que o
  // operador digitou — não é mais calculada a partir de quantos paletes
  // foram marcados como "ficando" no box.
  function quantidadeEfetiva(l) {
    return Number(quantidadesInformadasPorLoja[l.id]) || 0;
  }

  const totalAEnviarLote = lojas.reduce((soma, l) => soma + quantidadeEfetiva(l), 0);
  const totalPaletesLote = lojas.reduce((soma, l) => soma + l.paletesAgrupados, 0);

  function atualizarLacre(indice, valor) {
    setLacres((prev) => prev.map((l, i) => (i === indice ? valor : l)));
  }

  function alterarStatusLoja(lojaId, novoStatus) {
    setStatusPorLoja((prev) => ({ ...prev, [lojaId]: novoStatus }));
    setLotesRestantesPorLoja((prev) => ({ ...prev, [lojaId]: [] }));
    setQuantidadesInformadasPorLoja((prev) => ({ ...prev, [lojaId]: '' }));
  }

  function atualizarQuantidadeLoja(lojaId, valor) {
    setQuantidadesInformadasPorLoja((prev) => ({ ...prev, [lojaId]: valor }));
  }

  function alternarLoteRestante(numero) {
    setLoteRestante((prev) =>
      prev.includes(numero) ? prev.filter((n) => n !== numero) : [...prev, numero].sort((a, b) => a - b)
    );
  }

  function alternarLoteRestantePorLoja(lojaId, numero) {
    setLotesRestantesPorLoja((prev) => {
      const atual = prev[lojaId] || [];
      const proximo = atual.includes(numero) ? atual.filter((n) => n !== numero) : [...atual, numero].sort((a, b) => a - b);
      return { ...prev, [lojaId]: proximo };
    });
  }

  function enviar(e) {
    e.preventDefault();

    if (emLote) {
      // Envio parcial exige marcar pelo menos um palete como "ficando" —
      // senão não tem como saber o que realmente ficou de saldo.
      if (lojas.some((l) => statusPorLoja[l.id] === 'saldo' && (lotesRestantesPorLoja[l.id] || []).length === 0)) {
        return;
      }
      const quantidades = Object.fromEntries(lojas.map((l) => [l.id, quantidadeEfetiva(l)]));
      if (lojas.some((l) => quantidades[l.id] <= 0 || quantidades[l.id] > l.paletesAgrupados)) return;
      const placaFinal = placa.toUpperCase();
      actions.finalizarCarregamentoMultiplo({
        lojaIds: lojas.map((l) => l.id),
        placa: placaFinal,
        motorista,
        lacres,
        quantidades,
        ordemCarregamento,
        lotesRestantesPorLoja,
      });
      if (aoRegistrar) {
        const totalLote = ordemCarregamento.length;
        aoRegistrar(
          montarMensagemProtocolo({
            placa: placaFinal,
            motorista,
            itens: lojas.map((l) => {
              const posicaoCarregamento = ordemCarregamento.indexOf(l.id) + 1;
              return {
                carga: l.carga,
                loja: l.loja,
                nomeLoja: l.nomeLoja,
                paletesEnviados: quantidades[l.id],
                statusEnvio: statusPorLoja[l.id],
                lotesRestantesDescricao:
                  statusPorLoja[l.id] === 'saldo'
                    ? (lotesRestantesPorLoja[l.id] || []).map((n) => descricaoPalete(l, n))
                    : [],
                posicaoCarregamento,
                posicaoEntrega: totalLote - posicaoCarregamento + 1,
              };
            }),
          })
        );
      }
      aoFechar();
      return;
    }

    // Envio parcial exige marcar pelo menos um palete como "ficando".
    if (statusEnvio === 'saldo' && loteRestante.length === 0) return;

    const quantidade = Number(paletesEnviadosInput) || 0;

    if (quantidade <= 0 || quantidade > loja.paletesAgrupados) return;

    const placaFinal = placa.toUpperCase();
    actions.finalizarCarregamento({
      lojaId: loja.id,
      placa: placaFinal,
      motorista,
      lacres,
      statusEnvio,
      paletesEnviados: quantidade,
      lotesRestantes: statusEnvio === 'saldo' ? loteRestante : [],
    });
    if (aoRegistrar) {
      aoRegistrar(
        montarMensagemProtocolo({
          placa: placaFinal,
          motorista,
          itens: [
            {
              carga: loja.carga,
              loja: loja.loja,
              nomeLoja: loja.nomeLoja,
              paletesEnviados: quantidade,
              statusEnvio,
              lotesRestantesDescricao: statusEnvio === 'saldo' ? loteRestante.map((n) => descricaoPalete(loja, n)) : [],
            },
          ],
        })
      );
    }
    aoFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={enviar}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-2xl dark:bg-slate-800"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {emLote
                ? `Protocolo de Carregamento — ${lojas.length} lojas no mesmo veículo`
                : `Protocolo de Carregamento — ${loja.carga} / Loja ${loja.loja}`}
            </h3>
            {!emLote && <TipoCargaBadge tipo={loja.tipoCarga} />}
          </div>
          <button type="button" onClick={aoFechar} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {emLote && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40">
              <p className="mb-2 font-semibold text-slate-600 dark:text-slate-300">Lojas nesta viagem:</p>
              <div className="space-y-2.5">
                {lojas.map((l) => {
                  const statusLoja = statusPorLoja[l.id] || 'completo';
                  const restantesLoja = lotesRestantesPorLoja[l.id] || [];
                  return (
                    <div key={l.id} className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                          <span className="truncate">{l.carga} — Loja {l.loja} ({l.nomeLoja})</span>
                          <TipoCargaBadge tipo={l.tipoCarga} />
                        </span>
                        <span className="flex-shrink-0 text-slate-400 dark:text-slate-500">{l.paletesAgrupados} paletes agrupados</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <select
                          value={statusLoja}
                          onChange={(e) => alterarStatusLoja(l.id, e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="completo">Todos os paletes</option>
                          <option value="saldo">Ficou saldo</option>
                        </select>
                        <label className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Paletes enviados:
                          <input
                            type="number"
                            min={1}
                            max={l.paletesAgrupados}
                            value={quantidadesInformadasPorLoja[l.id] || ''}
                            onChange={(e) => atualizarQuantidadeLoja(l.id, e.target.value)}
                            required
                            placeholder={`${l.paletesAgrupados}`}
                            className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>
                      </div>
                      {statusLoja === 'saldo' && (
                        <div className="mt-2">
                          <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Marque o(s) palete(s) (número da etiqueta) que fica(m) no {getNomeBox(l.boxNumero)}:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: l.paletesAgrupados }, (_, i) => i + 1).map((numero) => {
                              const marcado = restantesLoja.includes(numero);
                              return (
                                <button
                                  type="button"
                                  key={numero}
                                  onClick={() => alternarLoteRestantePorLoja(l.id, numero)}
                                  title={descricaoPalete(l, numero)}
                                  className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold transition-colors ${
                                    marcado
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  {numero}
                                </button>
                              );
                            })}
                          </div>
                          {restantesLoja.length === 0 ? (
                            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Marque pelo menos um palete.</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                              Palete(s) {restantesLoja.map((n) => descricaoPalete(l, n)).join(', ')} permanece(m) no{' '}
                              {getNomeBox(l.boxNumero)}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 border-t border-slate-200 pt-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Total a enviar: {totalAEnviarLote} de {totalPaletesLote} paletes
              </p>
            </div>
          )}

          {emLote && (
            <SequenciaCarregamentoCaminhao
              lojas={lojas}
              ordem={ordemCarregamento}
              aoAlterarOrdem={setOrdemCarregamento}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Placa do veículo</label>
              <input
                list="lista-placas-carregamento"
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                required
                placeholder="ABC-1D23"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <datalist id="lista-placas-carregamento">
                {(state.placasCadastradas || []).map((p) => (
                  <option key={p.placa} value={p.placa} />
                ))}
              </datalist>
              {placaCadastrada && (
                <p
                  className={`mt-1 text-[11px] font-medium ${
                    placaCadastrada.possuiPlataforma
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {placaCadastrada.possuiPlataforma ? 'Este veículo possui plataforma.' : 'Este veículo não possui plataforma.'}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Motorista</label>
              <input
                list="lista-motoristas-carregamento"
                value={motorista}
                onChange={(e) => setMotorista(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <datalist id="lista-motoristas-carregamento">
                {(state.motoristasCadastrados || []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Lacres (até 3) — apenas o primeiro é obrigatório
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  value={lacres[i]}
                  onChange={(e) => atualizarLacre(i, e.target.value)}
                  required={i === 0}
                  placeholder={i === 0 ? 'Lacre 1' : `Lacre ${i + 1} (opcional)`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              ))}
            </div>
          </div>

          {!emLote && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Status de envio</label>
                <select
                  value={statusEnvio}
                  onChange={(e) => {
                    setStatusEnvio(e.target.value);
                    setLoteRestante([]);
                    setPaletesEnviadosInput('');
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="completo">Todos os paletes enviados</option>
                  <option value="saldo">Ficou saldo (envio parcial)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Paletes enviados</label>
                <input
                  type="number"
                  min={1}
                  max={loja.paletesAgrupados}
                  value={paletesEnviadosInput}
                  onChange={(e) => setPaletesEnviadosInput(e.target.value)}
                  required
                  placeholder={`de ${loja.paletesAgrupados}`}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {!emLote && statusEnvio === 'saldo' && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Marque o(s) palete(s) (número da etiqueta) que fica(m) no {getNomeBox(loja.boxNumero)}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: loja.paletesAgrupados }, (_, i) => i + 1).map((numero) => {
                  const marcado = loteRestante.includes(numero);
                  return (
                    <button
                      type="button"
                      key={numero}
                      onClick={() => alternarLoteRestante(numero)}
                      title={descricaoPalete(loja, numero)}
                      className={`flex h-7 w-7 items-center justify-center rounded text-xs font-semibold transition-colors ${
                        marcado
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      {numero}
                    </button>
                  );
                })}
              </div>
              {loteRestante.length === 0 ? (
                <p className="mt-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
                  Marque pelo menos um palete que vai ficar.
                </p>
              ) : (
                <p className="mt-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
                  Palete(s) {loteRestante.map((n) => descricaoPalete(loja, n)).join(', ')} permanece(m) alocado(s) no{' '}
                  {getNomeBox(loja.boxNumero)}, aguardando um novo carregamento.
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={
            emLote
              ? lojas.some((l) => statusPorLoja[l.id] === 'saldo' && (lotesRestantesPorLoja[l.id] || []).length === 0) ||
                lojas.some((l) => {
                  const q = Number(quantidadesInformadasPorLoja[l.id]) || 0;
                  return q <= 0 || q > l.paletesAgrupados;
                })
              : (statusEnvio === 'saldo' && loteRestante.length === 0) ||
                (() => {
                  const q = Number(paletesEnviadosInput) || 0;
                  return q <= 0 || q > loja.paletesAgrupados;
                })()
          }
          className="mt-5 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
        >
          {emLote ? `Finalizar Protocolo de ${lojas.length} Lojas` : 'Finalizar Protocolo e Liberar'}
        </button>
      </form>
    </div>
  );
}
