import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { eHoje, formatarHora, formatarDuracao } from '../../utils/dateHelpers';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';

// Chave usada para lembrar o tempo-limite configurado (fica salvo no
// navegador, como o restante do estado do app) — compartilhada entre o
// Dashboard e a aba Boxes & Vagas, já que é o mesmo card nas duas telas.
const CHAVE_TEMPO_LIMITE = 'doca-manager:tempo-limite-loja-min';

// Estágios da entrega de uma loja, a partir do protocolo registrado no
// carregamento (placa/motorista) e dos horários de chegada/saída na loja
// de destino informados na aba Motoristas. As variantes "_atrasada" só
// entram em jogo quando um tempo-limite é configurado e ultrapassado.
const STATUS_ENTREGA = {
  aguardando: {
    texto: 'A caminho',
    corBadge: 'bg-slate-100 text-slate-500 dark:border dark:border-slate-600 dark:bg-transparent dark:text-slate-400',
  },
  na_loja: {
    texto: 'Na loja',
    corBadge: 'bg-amber-50 text-amber-600 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300',
  },
  na_loja_atrasada: {
    texto: 'Na loja (atrasada)',
    corBadge: 'bg-red-50 text-red-600 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300',
  },
  concluida: {
    texto: 'Entregue',
    corBadge: 'bg-emerald-50 text-emerald-600 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  concluida_atrasada: {
    texto: 'Entregue',
    corBadge: 'bg-red-50 text-red-600 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300',
  },
};

// `agoraMs` é o "agora" corrente (atualizado periodicamente, ver useEffect
// com setInterval) — necessário para saber se uma entrega ainda em
// andamento (sem saída) já ultrapassou o tempo-limite, já que essa duração
// cresce mesmo sem nenhuma ação do usuário. `limiteMs` é `null` quando
// nenhum tempo-limite válido está configurado (campo vazio/zero).
function getStatusEntrega(protocolo, agoraMs, limiteMs) {
  if (protocolo.saidaLoja) {
    if (limiteMs != null && protocolo.chegadaLoja) {
      const permanencia = new Date(protocolo.saidaLoja) - new Date(protocolo.chegadaLoja);
      if (permanencia > limiteMs) return 'concluida_atrasada';
    }
    return 'concluida';
  }
  if (protocolo.chegadaLoja) {
    if (limiteMs != null) {
      const decorrido = agoraMs - new Date(protocolo.chegadaLoja).getTime();
      if (decorrido > limiteMs) return 'na_loja_atrasada';
    }
    return 'na_loja';
  }
  return 'aguardando';
}

/**
 * Card "Andamento das Entregas" — usado tanto no Dashboard quanto na aba
 * Boxes & Vagas (mesmos dados e mesma lógica, só o visual muda). `irPara`
 * navega para outra aba (Motoristas). `compacto` deixa o card mais enxuto
 * (menos respiro, tipografia menor e a lista de veículos com altura
 * limitada e rolagem própria) — pensado pra caber ao lado da grade de
 * boxes sem que a página inteira precise rolar, mesmo em monitores baixos
 * (ex.: 1080x720); nesse modo, se houver muitos veículos ao mesmo tempo, só
 * a lista de veículos (não a tela) ganha uma rolagem interna.
 */
export default function AndamentoEntregasCard({ irPara, compacto = false }) {
  const { state, filtroTipoCarga } = useApp();

  const [tempoLimiteTexto, setTempoLimiteTexto] = useLocalStorage(CHAVE_TEMPO_LIMITE, '60');
  const tempoLimiteMin = Number(tempoLimiteTexto);
  const limiteMs = tempoLimiteTexto !== '' && Number.isFinite(tempoLimiteMin) && tempoLimiteMin > 0
    ? tempoLimiteMin * 60000
    : null;

  // "Agora" atualizado a cada 30s para que uma entrega em andamento (sem
  // saída registrada) passe a vermelho sozinha, assim que ultrapassar o
  // tempo-limite — sem precisar de nenhuma ação do usuário na tela.
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  useEffect(() => {
    const intervalo = setInterval(() => setAgoraMs(Date.now()), 30000);
    return () => clearInterval(intervalo);
  }, []);

  const lojasPorId = useMemo(() => {
    const mapa = {};
    state.lojas.forEach((l) => {
      mapa[l.id] = l;
    });
    return mapa;
  }, [state.lojas]);

  // Agrupa os protocolos de carregamento finalizados hoje por placa +
  // motorista, para mostrar o andamento da entrega (a caminho / na loja /
  // entregue) de cada veículo — alimentado pelos registros de chegada e
  // saída feitos na aba Motoristas.
  const entregasPorVeiculo = useMemo(() => {
    const grupos = {};
    state.protocolos
      .filter((p) => eHoje(p.dataHora))
      .forEach((p) => {
        const loja = lojasPorId[p.lojaId];
        if (!loja || !lojaPassaFiltroTipoCarga(loja, filtroTipoCarga)) return;
        const chave = `${p.placa}|${p.motorista}`;
        if (!grupos[chave]) grupos[chave] = { placa: p.placa, motorista: p.motorista, entregas: [] };
        grupos[chave].entregas.push({ ...p, loja });
      });
    return Object.values(grupos)
      .map((g) => ({
        ...g,
        entregas: g.entregas.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora)),
      }))
      .sort((a, b) => {
        // Veículos com alguma entrega ainda não concluída aparecem primeiro.
        const aPendente = a.entregas.some((e) => !e.saidaLoja);
        const bPendente = b.entregas.some((e) => !e.saidaLoja);
        if (aPendente !== bPendente) return aPendente ? -1 : 1;
        return a.placa.localeCompare(b.placa, 'pt-BR');
      });
  }, [state.protocolos, lojasPorId, filtroTipoCarga]);

  // Resumo geral das entregas de hoje (todos os veículos somados), pra dar
  // uma visão rápida do andamento sem precisar escanear card por card —
  // quantas ainda não chegaram, quantas estão na loja agora e quantas já
  // foram concluídas, além de quantas estão em atraso. O aviso de atraso só
  // conta quem ainda está parado na loja agora (precisa de ação); uma
  // entrega que já foi concluída não entra mais nesse aviso, mesmo que a
  // permanência dela tenha passado do tempo-limite — isso já é só histórico,
  // não algo que precise da atenção de quem está olhando agora.
  const resumoEntregas = useMemo(() => {
    const contagem = { aguardando: 0, naLoja: 0, concluida: 0, atrasadas: 0, total: 0 };
    entregasPorVeiculo.forEach((veiculo) => {
      veiculo.entregas.forEach((entrega) => {
        const statusChave = getStatusEntrega(entrega, agoraMs, limiteMs);
        contagem.total += 1;
        if (statusChave === 'aguardando') contagem.aguardando += 1;
        else if (statusChave === 'na_loja' || statusChave === 'na_loja_atrasada') contagem.naLoja += 1;
        else contagem.concluida += 1;
        if (statusChave === 'na_loja_atrasada') contagem.atrasadas += 1;
      });
    });
    return contagem;
  }, [entregasPorVeiculo, agoraMs, limiteMs]);

  const padCard = compacto ? 'p-3' : 'p-5';
  const mbHeader = compacto ? 'mb-2' : 'mb-4';
  const padStat = compacto ? 'p-1.5' : 'p-3';
  const textStat = compacto ? 'text-base' : 'text-lg';
  const gapStats = compacto ? 'gap-2' : 'gap-3';
  const padVeiculo = compacto ? 'p-2' : 'p-3.5';

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white ${padCard} shadow-sm dark:border-slate-700 dark:bg-slate-800 ${
        compacto ? 'flex h-full flex-col' : ''
      }`}
    >
      <div className={`flex flex-shrink-0 flex-wrap items-center justify-between gap-3 ${mbHeader}`}>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Andamento das Entregas</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {compacto ? 'Alerta após' : 'Alertar em vermelho se ficar na loja mais de'}
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={tempoLimiteTexto}
              onChange={(evento) => setTempoLimiteTexto(evento.target.value)}
              className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            min
          </label>
          {irPara && (
            <button
              onClick={() => irPara('motoristas')}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Ir para Motoristas <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {resumoEntregas.total > 0 && (
        <div className={`flex-shrink-0 ${compacto ? 'mb-2 pb-2' : 'mb-4 pb-4'} border-b border-slate-100 dark:border-slate-700`}>
          <div className={`grid grid-cols-2 ${gapStats} sm:grid-cols-4`}>
            <div className={`rounded-lg border border-slate-100 ${padStat} dark:border-slate-700`}>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Total hoje</p>
              <p className={`mt-0.5 ${textStat} font-bold text-slate-800 dark:text-slate-100`}>{resumoEntregas.total}</p>
            </div>
            <div className={`rounded-lg border border-slate-100 ${padStat} dark:border-slate-700`}>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">A caminho</p>
              <p className={`mt-0.5 ${textStat} font-bold text-slate-600 dark:text-slate-300`}>{resumoEntregas.aguardando}</p>
            </div>
            <div className={`rounded-lg border border-slate-100 ${padStat} dark:border-slate-700`}>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Na loja</p>
              <p className={`mt-0.5 ${textStat} font-bold text-amber-600 dark:text-amber-400`}>{resumoEntregas.naLoja}</p>
            </div>
            <div className={`rounded-lg border border-slate-100 ${padStat} dark:border-slate-700`}>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Entregues</p>
              <p className={`mt-0.5 ${textStat} font-bold text-emerald-600 dark:text-emerald-400`}>{resumoEntregas.concluida}</p>
            </div>
          </div>

          <div className={`${compacto ? 'mt-2' : 'mt-3'} flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700`}>
            {resumoEntregas.aguardando > 0 && (
              <div
                className="h-full bg-slate-300 dark:bg-slate-500"
                style={{ width: `${(resumoEntregas.aguardando / resumoEntregas.total) * 100}%` }}
                title={`${resumoEntregas.aguardando} a caminho`}
              />
            )}
            {resumoEntregas.naLoja > 0 && (
              <div
                className="h-full bg-amber-400"
                style={{ width: `${(resumoEntregas.naLoja / resumoEntregas.total) * 100}%` }}
                title={`${resumoEntregas.naLoja} na loja`}
              />
            )}
            {resumoEntregas.concluida > 0 && (
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${(resumoEntregas.concluida / resumoEntregas.total) * 100}%` }}
                title={`${resumoEntregas.concluida} entregues`}
              />
            )}
          </div>

          {resumoEntregas.atrasadas > 0 && (
            <div className={`${compacto ? 'mt-2' : 'mt-3'} flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-400`}>
              <AlertTriangle size={14} />
              {resumoEntregas.atrasadas} entrega{resumoEntregas.atrasadas !== 1 ? 's' : ''} atrasada
              {resumoEntregas.atrasadas !== 1 ? 's' : ''} — mais de {tempoLimiteMin} min na loja
            </div>
          )}
        </div>
      )}

      {entregasPorVeiculo.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Nenhum carregamento finalizado hoje ainda — as entregas aparecem aqui assim que um protocolo for
          registrado na aba Carregamento.
        </p>
      ) : (
        <div
          className={
            // No modo compacto o card ocupa a altura que sobrar na tela (ver
            // `h-full flex flex-col` acima) e só esta lista de veículos, a
            // parte que pode crescer bastante, ganha rolagem própria dentro
            // desse espaço — min-h-0 é o que permite um filho flex encolher
            // abaixo do seu conteúdo e realmente respeitar o `overflow-y-auto`
            // em vez de estourar o card. Assim a página nunca precisa rolar:
            // quem rola, quando há muitos veículos, é só essa lista.
            compacto
              ? 'grid flex-1 min-h-0 auto-rows-min grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'
          }
        >
          {entregasPorVeiculo.map((veiculo) => (
            <div
              key={`${veiculo.placa}|${veiculo.motorista}`}
              className={`rounded-lg border border-slate-100 ${padVeiculo} dark:border-slate-700`}
            >
              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100" title={veiculo.motorista}>
                {veiculo.motorista}
              </p>
              <p className="font-mono text-xs text-slate-400 dark:text-slate-500">{veiculo.placa}</p>

              <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-700">
                {veiculo.entregas.map((entrega) => {
                  const statusChave = getStatusEntrega(entrega, agoraMs, limiteMs);
                  const status = STATUS_ENTREGA[statusChave];
                  const emAndamento = entrega.chegadaLoja && !entrega.saidaLoja;
                  const permanenciaMs = entrega.chegadaLoja
                    ? (entrega.saidaLoja ? new Date(entrega.saidaLoja) : agoraMs) - new Date(entrega.chegadaLoja)
                    : null;
                  return (
                    <div key={entrega.id} className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className="truncate text-slate-600 dark:text-slate-300"
                        title={`${entrega.loja.loja} — ${entrega.loja.nomeLoja}`}
                      >
                        {entrega.loja.loja}
                        {permanenciaMs != null && (
                          <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                            ({formatarDuracao(permanenciaMs)})
                          </span>
                        )}
                        {emAndamento && (
                          <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                            desde {formatarHora(entrega.chegadaLoja)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.corBadge}`}
                      >
                        {status.texto}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
