import React, { useState } from 'react';
import { X, Truck, MessageSquareText, Check, CalendarClock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getNomeBox } from '../../utils/boxLogic';
import { montarMensagemProtocolo } from '../../utils/notificacoes';
import { hojeISO, somarDias } from '../../utils/dateHelpers';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import SequenciaCarregamentoCaminhao from './SequenciaCarregamentoCaminhao.jsx';
import SeletorCadastro from '../Shared/SeletorCadastro.jsx';

// Descreve um número de palete junto com sua composição, quando os
// agrupadores juntaram lotes diferentes nele (ex.: "2 (lotes 2 + 5)") —
// ver ConcludeGroupingModal, onde essa composição é informada. Sem
// composição registrada, mostra só o número.
function descricaoPalete(l, numero) {
  const composicao = (l.composicaoPaletes || [])[numero - 1];
  return composicao && composicao.trim() ? `${numero} (lotes ${composicao.trim()})` : `${numero}`;
}

// Quantos números de palete mostrar na marcação de saldo: sempre a
// quantidade ESTIMADA no Apontamento (Etapa 1 — reserva rápida das vagas,
// antes da conferência física), não a quantidade final reconfirmada na
// Conclusão do Agrupamento (`paletesAgrupados`, que normalmente é menor,
// já que os agrupadores costumam juntar lotes num palete só). O saldo é
// sempre descrito pela numeração original do apontamento (ver
// AppContext.jsx, campo `paletesApontados`). O fallback cobre lojas
// salvas antes desse campo existir.
function numerosParaMarcarSaldo(l) {
  return l.paletesApontados > 0 ? l.paletesApontados : l.paletesAgrupados;
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

  // Lembrete de observação da loja (ver ObservacoesLojaModal.jsx) — captura
  // as lojas com observação UMA VEZ, na abertura do formulário (useState
  // lazy, não reativo), pra não sumir da tela assim que o operador clica
  // "Sim" (que já apaga a observação de verdade em state.observacoesLoja —
  // se esse cálculo fosse refeito a cada render, o item desapareceria antes
  // de mostrar a confirmação "Atendida").
  const [lojasComObservacao] = useState(() =>
    (lojas || [])
      .map((l) => ({ ...l, observacaoLoja: state.observacoesLoja?.[l.loja] || null }))
      .filter((l) => l.observacaoLoja)
  );
  // Resposta do operador pra cada loja com observação nesta tela —
  // { código da loja: 'sim' | 'nao' }. Pedido do usuário: um botão Sim/Não
  // pra informar se o pedido da loja está sendo atendido nesta carga. "Sim"
  // apaga a observação (não aparece mais — ver marcarObservacaoAtendida
  // abaixo); "Não" não muda nada no estado — a observação já fica
  // registrada por padrão (ver AppContext.jsx), então simplesmente
  // continua lá e aparece de novo na próxima carga dessa loja.
  const [respostaObservacao, setRespostaObservacao] = useState({});

  // Pedido do usuário: às vezes o carregamento é feito hoje mas só sai (ou
  // só chega na loja) em outro dia — sem regra fixa de "sempre amanhã"
  // (ex.: carregado sexta à tarde, mas só sai no sábado, ou só na segunda).
  // Por padrão desligado (continua contando no dia real do registro, como
  // sempre foi); quando ligado, revela um campo de data livre (qualquer
  // dia a partir de hoje) pra informar em qual dia esse carregamento deve
  // CONTAR nos relatórios de entrega (ver diaEntregaReferencia no
  // protocolo, AppContext.jsx). Começa sugerindo amanhã (o caso mais
  // comum), mas o operador pode trocar pra qualquer outra data.
  const [contarEmOutroDia, setContarEmOutroDia] = useState(false);
  const [diaEntregaReferencia, setDiaEntregaReferencia] = useState(() => somarDias(hojeISO(), 1));

  if (!lojas || lojas.length === 0) return null;
  const emLote = lojas.length > 1;
  const loja = lojas[0]; // usado apenas no fluxo de loja única

  const placaCadastrada = (state.placasCadastradas || []).find(
    (p) => p.placa === placa.trim().toUpperCase()
  );

  // Pedido do usuário: no menu de Placa/Motorista do protocolo, mostrar só
  // quem está DISPONÍVEL — ou seja, excluir placas/motoristas que ainda
  // estão em viagem (têm algum protocolo sem a saída da loja registrada,
  // `saidaLoja`). Um veículo/motorista só volta a aparecer na lista quando
  // a última entrega pendente dele for fechada. Considera qualquer
  // protocolo pendente (não só o de hoje), igual ao card "Andamento das
  // Entregas" do Dashboard — ver AndamentoEntregasCard.jsx.
  const placasEmUso = new Set((state.protocolos || []).filter((p) => !p.saidaLoja).map((p) => p.placa));
  const motoristasEmUso = new Set((state.protocolos || []).filter((p) => !p.saidaLoja).map((p) => p.motorista));
  const placasDisponiveis = (state.placasCadastradas || []).filter((p) => !placasEmUso.has(p.placa));
  const motoristasDisponiveis = (state.motoristasCadastrados || []).filter((m) => !motoristasEmUso.has(m));

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

  // "Sim, atendida" — apaga a observação de verdade (mesma ação usada no
  // modal de Observações das Lojas pra limpar o texto), então ela some
  // também do indicador do cabeçalho e não aparece mais em nenhuma carga
  // futura dessa loja.
  function marcarObservacaoAtendida(codigoLoja) {
    actions.definirObservacaoLoja(codigoLoja, '');
    setRespostaObservacao((prev) => ({ ...prev, [codigoLoja]: 'sim' }));
  }

  // "Não, não atendida" — só registra a resposta NESTA tela (pra trocar o
  // botão por uma confirmação); não mexe em state.observacoesLoja, então a
  // observação continua exatamente como estava e aparece de novo na
  // próxima carga dessa loja, sem precisar de nenhuma ação extra aqui.
  function marcarObservacaoNaoAtendida(codigoLoja) {
    setRespostaObservacao((prev) => ({ ...prev, [codigoLoja]: 'nao' }));
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
      // Sem mais teto em `l.paletesAgrupados` aqui — só exige quantidade
      // positiva. Digitar mais do que foi agrupado é permitido de propósito
      // (palete extra colocado manualmente na hora de carregar).
      if (lojas.some((l) => quantidades[l.id] <= 0)) return;
      const placaFinal = placa.toUpperCase();
      actions.finalizarCarregamentoMultiplo({
        lojaIds: lojas.map((l) => l.id),
        placa: placaFinal,
        motorista,
        lacres,
        quantidades,
        ordemCarregamento,
        lotesRestantesPorLoja,
        diaEntregaReferencia: contarEmOutroDia ? diaEntregaReferencia : null,
      });

      if (aoRegistrar) {
        const totalLote = ordemCarregamento.length;
        aoRegistrar(
          montarMensagemProtocolo({
            placa: placaFinal,
            motorista,
            diaEntregaReferencia: contarEmOutroDia ? diaEntregaReferencia : null,
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

    // Sem mais teto em `loja.paletesAgrupados` — digitar mais do que foi
    // agrupado é permitido de propósito (palete extra colocado manualmente
    // na hora de carregar).
    if (quantidade <= 0) return;

    const placaFinal = placa.toUpperCase();
    actions.finalizarCarregamento({
      lojaId: loja.id,
      placa: placaFinal,
      motorista,
      lacres,
      statusEnvio,
      paletesEnviados: quantidade,
      lotesRestantes: statusEnvio === 'saldo' ? loteRestante : [],
      diaEntregaReferencia: contarEmOutroDia ? diaEntregaReferencia : null,
    });

    if (aoRegistrar) {
      aoRegistrar(
        montarMensagemProtocolo({
          placa: placaFinal,
          motorista,
          diaEntregaReferencia: contarEmOutroDia ? diaEntregaReferencia : null,
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
            <Truck size={18} className="text-totvs-600 dark:text-whatsapp-400" />
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

        {/* Lembrete de pedidos da loja (ex.: "colocar bag", "material extra
            por fora") anotados a qualquer momento — ver botão "Observações
            das Lojas" no cabeçalho (Header.jsx) e ObservacoesLojaModal.jsx.
            A observação é da loja (state.observacoesLoja, por código — ver
            AppContext.jsx), não de uma carga específica, então vale pra
            qualquer carga dela, inclusive essa. Só aparece quando existe
            observação, pra não virar ruído em toda entrega.

            Pedido do usuário: um botão Sim/Não pra informar se o pedido da
            loja está sendo atendido nesta carga — "Sim" apaga a observação
            (não aparece mais em nenhuma carga futura); "Não" mantém, pra
            aparecer de novo na próxima carga dessa loja (ver
            marcarObservacaoAtendida/marcarObservacaoNaoAtendida acima). */}
        {lojasComObservacao.length > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
            <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
              <MessageSquareText size={13} />
              {lojasComObservacao.length > 1
                ? 'Observações registradas para estas lojas:'
                : 'Observação registrada para esta loja:'}
            </p>
            <ul className="space-y-2">
              {lojasComObservacao.map((l) => {
                const resposta = respostaObservacao[l.loja];
                return (
                  <li key={l.id}>
                    <div>
                      {emLote && <span className="font-medium">Loja {l.loja}: </span>}
                      {l.observacaoLoja}
                    </div>
                    {resposta === 'sim' ? (
                      <p className="mt-0.5 flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <Check size={12} /> Atendida nesta carga — removida, não aparece mais.
                      </p>
                    ) : resposta === 'nao' ? (
                      <p className="mt-0.5 text-amber-700/80 dark:text-amber-300/80">
                        Não atendida agora — continua registrada, aparece de novo na próxima carga desta loja.
                      </p>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Atendida nesta carga?</span>
                        <button
                          type="button"
                          onClick={() => marcarObservacaoAtendida(l.loja)}
                          className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => marcarObservacaoNaoAtendida(l.loja)}
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Não
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="completo">Todos os paletes</option>
                          <option value="saldo">Ficou saldo</option>
                        </select>
                        <label className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Paletes enviados:
                          <input
                            type="number"
                            min={1}
                            /* Sem `max` no agrupado — pode digitar mais do que
                               foi agrupado quando sobra algum palete extra,
                               colocado manualmente na hora de carregar. */
                            value={quantidadesInformadasPorLoja[l.id] || ''}
                            onChange={(e) => atualizarQuantidadeLoja(l.id, e.target.value)}
                            required
                            placeholder={`${l.paletesAgrupados}`}
                            className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>
                      </div>
                      {Number(quantidadesInformadasPorLoja[l.id]) > l.paletesAgrupados && (
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                          {Number(quantidadesInformadasPorLoja[l.id]) - l.paletesAgrupados} palete(s) a mais do que
                          foi agrupado ({l.paletesAgrupados}).
                        </p>
                      )}
                      {statusLoja === 'saldo' && (
                        <div className="mt-2">
                          <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Marque o(s) palete(s) (número da etiqueta) que fica(m) no {getNomeBox(l.boxNumero)}:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: numerosParaMarcarSaldo(l) }, (_, i) => i + 1).map((numero) => {
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
              <SeletorCadastro
                opcoes={placasDisponiveis.map((p) => ({
                  valor: p.placa,
                  rotulo: p.placa,
                  extra: p.possuiPlataforma ? 'c/ plataforma' : null,
                }))}
                valor={placa}
                onSelecionar={setPlaca}
                placeholder="Selecione a placa"
                mensagemVazia="Nenhuma placa disponível — todas em viagem ou nada cadastrado."
              />
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
              <SeletorCadastro
                opcoes={motoristasDisponiveis}
                valor={motorista}
                onSelecionar={setMotorista}
                placeholder="Selecione o motorista"
                mensagemVazia="Nenhum motorista disponível — todos em viagem ou nada cadastrado."
              />
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
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              ))}
            </div>
          </div>

          {/* Pedido do usuário: carregamento feito hoje que só sai (ou só
              chega na loja) em outro dia, sem regra fixa de "sempre
              amanhã" — ex.: carregado sexta à tarde, mas só sai no sábado,
              ou só na segunda. Desligado por padrão: conta no dia real do
              registro, como sempre. `dataHora` do protocolo nunca muda por
              causa disso — só a data usada nos relatórios de entrega (Meta
              de Entrega, Entregas por Motorista, Exportar Excel). */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-900/40">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={contarEmOutroDia}
                onChange={(e) => setContarEmOutroDia(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-totvs-600 focus:ring-totvs-500 dark:border-slate-600 dark:text-whatsapp-500 dark:focus:ring-whatsapp-500"
              />
              <CalendarClock size={13} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
              Esse carregamento só sai (ou só chega) em outro dia
            </label>
            {contarEmOutroDia && (
              <div className="mt-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Contar nos relatórios de entrega como se fosse do dia:
                </label>
                <input
                  type="date"
                  value={diaEntregaReferencia}
                  min={hojeISO()}
                  onChange={(e) => setDiaEntregaReferencia(e.target.value)}
                  required
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  O horário real do carregamento continua registrado normalmente — só a contagem nos relatórios muda
                  pra essa data.
                </p>
              </div>
            )}
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
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
                  /* Sem `max` no agrupado — pode digitar mais do que foi
                     agrupado quando sobra algum palete extra, colocado
                     manualmente na hora de carregar (ver enviar(), que não
                     rejeita mais esse caso). */
                  value={paletesEnviadosInput}
                  onChange={(e) => setPaletesEnviadosInput(e.target.value)}
                  required
                  placeholder={`de ${loja.paletesAgrupados}`}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                {Number(paletesEnviadosInput) > loja.paletesAgrupados && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    {Number(paletesEnviadosInput) - loja.paletesAgrupados} palete(s) a mais do que foi agrupado
                    ({loja.paletesAgrupados}).
                  </p>
                )}
              </div>
            </div>
          )}

          {!emLote && statusEnvio === 'saldo' && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Marque o(s) palete(s) (número da etiqueta) que fica(m) no {getNomeBox(loja.boxNumero)}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: numerosParaMarcarSaldo(loja) }, (_, i) => i + 1).map((numero) => {
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
            // Placa e motorista agora vêm de um menu suspenso (SeletorCadastro)
            // em vez de um <input required> nativo — a validação de obrigatório
            // precisa ser feita aqui, já que um <button> não participa da
            // validação nativa do formulário.
            !placa ||
            !motorista ||
            (emLote
              ? lojas.some((l) => statusPorLoja[l.id] === 'saldo' && (lotesRestantesPorLoja[l.id] || []).length === 0) ||
                // Sem mais teto em `l.paletesAgrupados` — só exige quantidade
                // positiva (ver mesma decisão em enviar()).
                lojas.some((l) => (Number(quantidadesInformadasPorLoja[l.id]) || 0) <= 0)
              : (statusEnvio === 'saldo' && loteRestante.length === 0) || (Number(paletesEnviadosInput) || 0) <= 0)
          }
          className="mt-5 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
        >
          {emLote ? `Finalizar Protocolo de ${lojas.length} Lojas` : 'Finalizar Protocolo e Liberar'}
        </button>
      </form>
    </div>
  );
}
