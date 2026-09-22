import React, { useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, CheckCircle2, LocateFixed, MapPinOff, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { formatarHora, formatarDuracao, paraDataHoraLocalInput, deDataHoraLocalInput } from '../../utils/dateHelpers';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';
import { calcularDistanciaMetros, formatarDistancia, RAIO_GEOFENCE_METROS } from '../../utils/geo';

// Tela simples para uso dos motoristas: digitam o próprio nome e veem as
// lojas de entrega dos carregamentos feitos por eles, com um botão grande
// para registrar a chegada e, depois, a saída — o tempo de permanência na
// loja é calculado automaticamente a partir desses dois horários. Pensada
// para toque em celular/tablet, sem formulários ou campos extras.
//
// Chegada assistida por GPS: quando há alguma entrega sem chegada
// registrada e a loja tem coordenada cadastrada (Cadastros > Localização
// das Lojas), a página acompanha a posição do celular e destaca o botão
// "Registrar Chegada" quando o motorista está dentro do raio da loja — mas
// o registro continua exigindo o toque de confirmação (nunca automático
// silencioso), pra evitar um GPS impreciso registrando chegada errada.
export default function DriversPage() {
  const { state, actions, filtroTipoCarga } = useApp();
  const [motoristaDigitado, setMotoristaDigitado] = useState('');
  const [motoristaBuscado, setMotoristaBuscado] = useState(null);
  const [posicaoAtual, setPosicaoAtual] = useState(null);
  // 'inativo' | 'buscando' | 'ativo' | 'negado' | 'indisponivel'
  const [statusLocalizacao, setStatusLocalizacao] = useState('inativo');

  // Controla o formulário de registro manual de chegada/saída (chave
  // `${entregaId}-chegada` ou `${entregaId}-saida`) — usado quando o
  // motorista esquece de tocar no botão na hora certa e alguém precisa
  // lançar o horário real depois.
  const [manualAberto, setManualAberto] = useState({});
  const [valorManual, setValorManual] = useState({});

  function alternarManual(chave) {
    setManualAberto((atual) => ({ ...atual, [chave]: !atual[chave] }));
    setValorManual((atual) => (atual[chave] ? atual : { ...atual, [chave]: paraDataHoraLocalInput() }));
  }

  function confirmarManual(chave, aoConfirmar) {
    aoConfirmar(deDataHoraLocalInput(valorManual[chave]));
    setManualAberto((atual) => ({ ...atual, [chave]: false }));
  }

  const lojasPorId = useMemo(() => {
    const mapa = {};
    state.lojas.forEach((l) => {
      mapa[l.id] = l;
    });
    return mapa;
  }, [state.lojas]);

  const localizacaoPorCodigo = useMemo(() => {
    const mapa = {};
    (state.localizacaoLojas || []).forEach((l) => {
      mapa[l.codigo] = l;
    });
    return mapa;
  }, [state.localizacaoLojas]);

  const entregas = useMemo(() => {
    if (!motoristaBuscado) return [];
    return state.protocolos
      .filter((p) => (p.motorista || '').trim().toLowerCase() === motoristaBuscado.toLowerCase())
      .map((p) => ({ ...p, loja: lojasPorId[p.lojaId] }))
      .filter((p) => p.loja && lojaPassaFiltroTipoCarga(p.loja, filtroTipoCarga))
      .sort((a, b) => {
        // Entregas pendentes (sem saída registrada) aparecem primeiro;
        // dentro de cada grupo, a mais recente primeiro.
        const aPendente = !a.saidaLoja;
        const bPendente = !b.saidaLoja;
        if (aPendente !== bPendente) return aPendente ? -1 : 1;
        return new Date(b.dataHora) - new Date(a.dataHora);
      });
  }, [state.protocolos, lojasPorId, motoristaBuscado, filtroTipoCarga]);

  // Só vale a pena ligar o GPS quando existe pelo menos uma entrega ainda
  // sem chegada registrada E com coordenada cadastrada — caso contrário não
  // há nada pra comparar a posição do motorista.
  const temPendenteComLocalizacao = useMemo(
    () => entregas.some((e) => !e.chegadaLoja && !e.saidaLoja && localizacaoPorCodigo[e.loja.loja]),
    [entregas, localizacaoPorCodigo]
  );

  useEffect(() => {
    if (!temPendenteComLocalizacao) {
      setStatusLocalizacao('inativo');
      return undefined;
    }
    if (!navigator.geolocation) {
      setStatusLocalizacao('indisponivel');
      return undefined;
    }
    setStatusLocalizacao((atual) => (atual === 'ativo' ? atual : 'buscando'));
    const watchId = navigator.geolocation.watchPosition(
      (posicao) => {
        setPosicaoAtual({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude });
        setStatusLocalizacao('ativo');
      },
      (erro) => {
        setStatusLocalizacao(erro.code === erro.PERMISSION_DENIED ? 'negado' : 'indisponivel');
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [temPendenteComLocalizacao]);

  function aoBuscar(evento) {
    evento.preventDefault();
    const limpo = motoristaDigitado.trim();
    setMotoristaBuscado(limpo || null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">Registro de Chegada e Saída</h2>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          Digite o nome do motorista para ver as lojas das cargas dele e registrar a chegada e a saída em cada uma.
        </p>

        <form onSubmit={aoBuscar} className="mt-4 flex gap-2">
          <input
            list="lista-motoristas-motoristas"
            value={motoristaDigitado}
            onChange={(evento) => setMotoristaDigitado(evento.target.value)}
            placeholder="Nome do motorista"
            autoFocus
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <datalist id="lista-motoristas-motoristas">
            {(state.motoristasCadastrados || []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <button
            type="submit"
            className="flex-shrink-0 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Buscar
          </button>
        </form>
      </div>

      {motoristaBuscado && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {motoristaBuscado} — {entregas.length} {entregas.length === 1 ? 'entrega encontrada' : 'entregas encontradas'}
            </p>
            {statusLocalizacao === 'ativo' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <LocateFixed size={12} /> Localização ativa — detectando chegada
              </span>
            )}
            {statusLocalizacao === 'buscando' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                <LocateFixed size={12} className="animate-pulse" /> Buscando localização...
              </span>
            )}
            {statusLocalizacao === 'negado' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <MapPinOff size={12} /> Ative a localização do navegador pra detectar a chegada automaticamente
              </span>
            )}
          </div>

          {entregas.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
              Nenhuma entrega encontrada para este motorista.
            </div>
          )}

          {entregas.map((entrega) => {
            const permanenciaMs =
              entrega.chegadaLoja && entrega.saidaLoja
                ? new Date(entrega.saidaLoja) - new Date(entrega.chegadaLoja)
                : null;
            const concluida = Boolean(entrega.saidaLoja);

            const localizacaoLoja = localizacaoPorCodigo[entrega.loja.loja];
            const distanciaMetros =
              !entrega.chegadaLoja && localizacaoLoja && posicaoAtual
                ? calcularDistanciaMetros(
                    posicaoAtual.latitude,
                    posicaoAtual.longitude,
                    localizacaoLoja.latitude,
                    localizacaoLoja.longitude
                  )
                : null;
            const pertoDaLoja = distanciaMetros != null && distanciaMetros <= RAIO_GEOFENCE_METROS;

            return (
              <div
                key={entrega.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex flex-wrap items-center gap-1.5 text-base font-bold text-slate-800 dark:text-slate-100">
                      <span className="font-mono">{entrega.loja.loja}</span> — {entrega.loja.nomeLoja}
                      <TipoCargaBadge tipo={entrega.loja.tipoCarga} />
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Placa <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">{entrega.placa}</span> — Saiu do CD às {formatarHora(entrega.dataHora)}
                    </p>
                  </div>
                  {concluida && (
                    <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300">
                      <CheckCircle2 size={14} /> Concluída
                    </span>
                  )}
                </div>

                {(entrega.chegadaLoja || entrega.saidaLoja) && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {entrega.chegadaLoja && (
                      <span>
                        Chegada:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">{formatarHora(entrega.chegadaLoja)}</strong>
                      </span>
                    )}
                    {entrega.saidaLoja && (
                      <span>
                        Saída:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">{formatarHora(entrega.saidaLoja)}</strong>
                      </span>
                    )}
                    {permanenciaMs != null && (
                      <span>
                        Permanência:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">{formatarDuracao(permanenciaMs)}</strong>
                      </span>
                    )}
                  </div>
                )}

                {!concluida && (
                  <div className="mt-3">
                    {!entrega.chegadaLoja ? (
                      <>
                        {pertoDaLoja && (
                          <p className="mb-1.5 flex items-center justify-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <LocateFixed size={13} /> Você está na loja ({formatarDistancia(distanciaMetros)}) — confirme a chegada
                          </p>
                        )}
                        <button
                          onClick={() => actions.registrarChegadaLoja(entrega.id)}
                          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-base font-semibold text-white transition-colors ${
                            pertoDaLoja
                              ? 'animate-pulse bg-emerald-600 ring-4 ring-emerald-300 hover:bg-emerald-700 active:bg-emerald-800 dark:ring-emerald-700/60'
                              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                          }`}
                        >
                          <LogIn size={20} /> Registrar Chegada na Loja
                        </button>
                        {!pertoDaLoja && distanciaMetros != null && (
                          <p className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
                            Você está a {formatarDistancia(distanciaMetros)} da loja
                          </p>
                        )}
                        <RegistroManual
                          chave={`${entrega.id}-chegada`}
                          aberto={Boolean(manualAberto[`${entrega.id}-chegada`])}
                          valor={valorManual[`${entrega.id}-chegada`]}
                          aoAlternar={alternarManual}
                          aoMudarValor={(chave, valor) => setValorManual((atual) => ({ ...atual, [chave]: valor }))}
                          aoConfirmar={(chave) => confirmarManual(chave, (dataHora) => actions.registrarChegadaLoja(entrega.id, dataHora))}
                          rotulo="Motorista esqueceu de registrar a chegada? Informar horário manualmente"
                        />
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => actions.registrarSaidaLoja(entrega.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-amber-700 active:bg-amber-800"
                        >
                          <LogOut size={20} /> Registrar Saída da Loja
                        </button>
                        <RegistroManual
                          chave={`${entrega.id}-saida`}
                          aberto={Boolean(manualAberto[`${entrega.id}-saida`])}
                          valor={valorManual[`${entrega.id}-saida`]}
                          aoAlternar={alternarManual}
                          aoMudarValor={(chave, valor) => setValorManual((atual) => ({ ...atual, [chave]: valor }))}
                          aoConfirmar={(chave) => confirmarManual(chave, (dataHora) => actions.registrarSaidaLoja(entrega.id, dataHora))}
                          rotulo="Motorista esqueceu de registrar a saída? Informar horário manualmente"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Link discreto que abre um pequeno formulário com um <input
// type="datetime-local"> — cobre o caso de o motorista esquecer de tocar
// no botão de chegada/saída na hora certa: alguém (o próprio motorista
// depois, ou a portaria) informa o horário real e registra retroativamente.
function RegistroManual({ chave, aberto, valor, aoAlternar, aoMudarValor, aoConfirmar, rotulo }) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => aoAlternar(chave)}
        className="flex w-full items-center justify-center gap-1 py-1 text-center text-[11px] font-medium text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <Clock size={11} /> {aberto ? 'Cancelar registro manual' : rotulo}
      </button>
      {aberto && (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-900/40">
          <input
            type="datetime-local"
            value={valor || ''}
            onChange={(evento) => aoMudarValor(chave, evento.target.value)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          <button
            type="button"
            disabled={!valor}
            onClick={() => aoConfirmar(chave)}
            className="flex-shrink-0 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-600 dark:hover:bg-slate-500"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}
