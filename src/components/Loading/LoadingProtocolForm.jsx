import React, { useState } from 'react';
import { X, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getNomeBox } from '../../utils/boxLogic';
import { montarMensagemProtocolo } from '../../utils/notificacoes';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import SequenciaCarregamentoCaminhao from './SequenciaCarregamentoCaminhao.jsx';

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
  const [paletesEnviados, setPaletesEnviados] = useState(lojas?.[0]?.paletesAgrupados ?? 0);
  // Fluxo em lote: status ('completo' | 'saldo') e quantidade por loja,
  // inicializados como envio completo (todos os paletes) para cada uma.
  const [statusPorLoja, setStatusPorLoja] = useState(() =>
    Object.fromEntries((lojas || []).map((l) => [l.id, 'completo']))
  );
  const [quantidadesPorLoja, setQuantidadesPorLoja] = useState(() =>
    Object.fromEntries((lojas || []).map((l) => [l.id, l.paletesAgrupados]))
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

  function quantidadeEfetiva(l) {
    if (statusPorLoja[l.id] === 'saldo') {
      return Math.min(Math.max(Number(quantidadesPorLoja[l.id]) || 0, 0), l.paletesAgrupados);
    }
    return l.paletesAgrupados;
  }

  const totalAEnviarLote = lojas.reduce((soma, l) => soma + quantidadeEfetiva(l), 0);
  const totalPaletesLote = lojas.reduce((soma, l) => soma + l.paletesAgrupados, 0);

  function atualizarLacre(indice, valor) {
    setLacres((prev) => prev.map((l, i) => (i === indice ? valor : l)));
  }

  function alterarStatusLoja(lojaId, novoStatus) {
    setStatusPorLoja((prev) => ({ ...prev, [lojaId]: novoStatus }));
    if (novoStatus === 'completo') {
      const l = lojas.find((x) => x.id === lojaId);
      if (l) setQuantidadesPorLoja((prev) => ({ ...prev, [lojaId]: l.paletesAgrupados }));
    }
  }

  function enviar(e) {
    e.preventDefault();

    if (emLote) {
      const quantidades = Object.fromEntries(lojas.map((l) => [l.id, quantidadeEfetiva(l)]));
      if (Object.values(quantidades).some((q) => q <= 0)) return;
      const placaFinal = placa.toUpperCase();
      actions.finalizarCarregamentoMultiplo({
        lojaIds: lojas.map((l) => l.id),
        placa: placaFinal,
        motorista,
        lacres,
        quantidades,
        ordemCarregamento,
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

    const quantidade =
      statusEnvio === 'completo' ? loja.paletesAgrupados : Math.min(Number(paletesEnviados) || 0, loja.paletesAgrupados);

    if (quantidade <= 0) return;

    const placaFinal = placa.toUpperCase();
    actions.finalizarCarregamento({
      lojaId: loja.id,
      placa: placaFinal,
      motorista,
      lacres,
      statusEnvio,
      paletesEnviados: quantidade,
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
                  const quantidade = quantidadeEfetiva(l);
                  return (
                    <div key={l.id} className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                          <span className="truncate">{l.carga} — Loja {l.loja} ({l.nomeLoja})</span>
                          <TipoCargaBadge tipo={l.tipoCarga} />
                        </span>
                        <span className="flex-shrink-0 text-slate-400 dark:text-slate-500">de {l.paletesAgrupados} paletes</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <select
                          value={statusLoja}
                          onChange={(e) => alterarStatusLoja(l.id, e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="completo">Todos os paletes</option>
                          <option value="saldo">Editar saldo</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={l.paletesAgrupados}
                          value={quantidade}
                          disabled={statusLoja === 'completo'}
                          onChange={(e) =>
                            setQuantidadesPorLoja((prev) => ({ ...prev, [l.id]: e.target.value }))
                          }
                          className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                        />
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">paletes enviados</span>
                      </div>
                      {statusLoja === 'saldo' && (
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                          Saldo de {l.paletesAgrupados - quantidade} palete(s) permanece no {getNomeBox(l.boxNumero)}.
                        </p>
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
                    if (e.target.value === 'completo') setPaletesEnviados(loja.paletesAgrupados);
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="completo">Todos os paletes enviados</option>
                  <option value="saldo">Ficou saldo (envio parcial)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Paletes enviados (de {loja.paletesAgrupados})
                </label>
                <input
                  type="number"
                  min={1}
                  max={loja.paletesAgrupados}
                  value={paletesEnviados}
                  disabled={statusEnvio === 'completo'}
                  onChange={(e) => setPaletesEnviados(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                />
              </div>
            </div>
          )}

          {!emLote && statusEnvio === 'saldo' && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
              O saldo de {loja.paletesAgrupados - (Number(paletesEnviados) || 0)} palete(s) permanecerá
              alocado no {getNomeBox(loja.boxNumero)}, aguardando um novo carregamento.
            </p>
          )}
        </div>

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {emLote ? `Finalizar Protocolo de ${lojas.length} Lojas` : 'Finalizar Protocolo e Liberar'}
        </button>
      </form>
    </div>
  );
}
