import React, { useMemo } from 'react';
import { Store, CheckCircle2, Clock, Truck, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import {
  getResumoDashboard,
  getLojasDoDia,
  getFinalizadasHoje,
  getPendentesHoje,
  getSaldoAnterior,
  getLojasEmCarregamento,
} from '../../utils/selectors';
import SummaryCard from './SummaryCard.jsx';
import AndamentoEntregasCard from './AndamentoEntregasCard.jsx';
import { getResumoBox, getStatusBox, boxEhEspecial } from '../../utils/boxLogic';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';

// Soma peso/volume de um conjunto de lojas. Alguns registros importados
// podem não ter peso/volume informado (formato simplificado) — nesse caso
// o campo fica null e é ignorado na soma; `tem` decide se o dado aparece
// no card (para não mostrar "0 kg" quando ninguém informou esse dado).
function calcularPesoVolume(lojas) {
  const peso = lojas.reduce((soma, l) => soma + (l.peso ?? 0), 0);
  const volume = lojas.reduce((soma, l) => soma + (l.volume ?? 0), 0);
  const tem = lojas.some((l) => l.peso != null || l.volume != null);
  return { peso, volume, tem };
}

const ORDEM_STATUS_BOX = [
  { chave: 'ocupado', texto: 'Ocupados', corPonto: 'bg-red-500' },
  { chave: 'lotado', texto: 'Lotados', corPonto: 'bg-red-500' },
  { chave: 'em_uso', texto: 'Em uso', corPonto: 'bg-amber-500' },
  { chave: 'disponivel', texto: 'Disponíveis', corPonto: 'bg-emerald-500' },
];

export default function Dashboard({ irPara }) {
  const { state, filtroTipoCarga } = useApp();
  // Filtro global de Tipo de Carga (ver Header.jsx): aplica-se a todos os
  // números/listas de lojas do Dashboard. A ocupação física dos boxes
  // (vagas ocupadas/livres, status Ocupado/Lotado/etc.) continua contando
  // TODAS as lojas, já que isso reflete o espaço físico real — só a lista
  // de lojas exibida em cada box e nas entregas é filtrada.
  const stateFiltrado = useMemo(
    () => ({ ...state, lojas: state.lojas.filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga)) }),
    [state, filtroTipoCarga]
  );
  const resumo = useMemo(() => getResumoDashboard(stateFiltrado), [stateFiltrado]);

  // Tempo-limite (em minutos) para permanência na loja, configurável pelo
  // usuário; lojas com chegada registrada há mais tempo que isso (ou que
  // levaram mais que isso até a saída) aparecem em vermelho. Guardado como
  // texto para permitir o campo temporariamente vazio enquanto o usuário
  // digita, sem forçar um valor numérico a cada tecla.
  // Mapa completo (sem filtro) — usado para o status físico dos boxes
  // (getStatusBox precisa saber de TODAS as lojas, mesmo as filtradas fora,
  // para não mostrar um box "Disponível" que na verdade está ocupado por
  // uma carga do outro tipo).
  const lojasPorId = useMemo(() => {
    const mapa = {};
    state.lojas.forEach((l) => {
      mapa[l.id] = l;
    });
    return mapa;
  }, [state.lojas]);

  const ocupacaoBoxes = useMemo(
    () =>
      state.boxes.map((box) => {
        const resumoBox = getResumoBox(box, lojasPorId);
        const lojas = resumoBox.lojasIds
          .map((id) => lojasPorId[id])
          .filter(Boolean)
          .filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga));
        return {
          numero: box.numero,
          nome: box.nome,
          ...resumoBox,
          status: getStatusBox(box, lojasPorId),
          lojas,
        };
      }),
    [state.boxes, lojasPorId, filtroTipoCarga]
  );

  // Peso/volume cúbico agregados para cada card de resumo no topo do
  // Dashboard (planejadas hoje, finalizadas, pendentes, em carregamento).
  const pesoVolumePlanejadasHoje = useMemo(() => calcularPesoVolume(getLojasDoDia(stateFiltrado)), [stateFiltrado]);
  const pesoVolumeFinalizadas = useMemo(() => calcularPesoVolume(getFinalizadasHoje(stateFiltrado)), [stateFiltrado]);
  const pesoVolumePendentes = useMemo(
    () => calcularPesoVolume([...getPendentesHoje(stateFiltrado), ...getSaldoAnterior(stateFiltrado)]),
    [stateFiltrado]
  );
  const pesoVolumeEmCarregamento = useMemo(() => calcularPesoVolume(getLojasEmCarregamento(stateFiltrado)), [stateFiltrado]);

  const distribuicaoStatus = useMemo(() => {
    const contagem = { ocupado: 0, lotado: 0, em_uso: 0, disponivel: 0 };
    ocupacaoBoxes.forEach((box) => {
      contagem[box.status.chave] += 1;
    });
    return contagem;
  }, [ocupacaoBoxes]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          titulo="Lojas planejadas hoje"
          valor={resumo.planejadasHoje}
          subtitulo="Importadas para o dia operacional atual"
          icone={Store}
          cor="blue"
          onClick={() => irPara('importar')}
          pesoVolume={pesoVolumePlanejadasHoje}
        />
        <SummaryCard
          titulo="Lojas finalizadas"
          valor={resumo.finalizadas}
          subtitulo="Carregamentos concluídos hoje"
          icone={CheckCircle2}
          cor="emerald"
          onClick={() => irPara('carregamento')}
          pesoVolume={pesoVolumeFinalizadas}
        />
        <SummaryCard
          titulo="Lojas pendentes"
          valor={resumo.pendentes}
          subtitulo={`${resumo.pendentesHoje} hoje + ${resumo.saldoAnterior} saldo do dia anterior`}
          icone={Clock}
          cor="amber"
          onClick={() => irPara('agrupamento')}
          pesoVolume={pesoVolumePendentes}
        />
        <SummaryCard
          titulo="Cargas em carregamento"
          valor={resumo.emCarregamento}
          subtitulo="Aguardando protocolo de liberação"
          icone={Truck}
          cor="purple"
          onClick={() => irPara('carregamento')}
          pesoVolume={pesoVolumeEmCarregamento}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Ocupação dos {ocupacaoBoxes.length} Boxes
          </h2>
          <button
            onClick={() => irPara('boxes')}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Ver detalhes <ArrowRight size={14} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-100 pb-4 text-xs dark:border-slate-700">
          {ORDEM_STATUS_BOX.map((s) => (
            <span key={s.chave} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${s.corPonto}`} />
              <strong className="text-slate-800 dark:text-slate-100">{distribuicaoStatus[s.chave]}</strong> {s.texto}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {ocupacaoBoxes.map((box) => {
            const percentual = box.totalVagas > 0 ? Math.round((box.ocupadas / box.totalVagas) * 100) : 0;
            const tituloLojas = box.lojas.length
              ? box.lojas.map((l) => `${l.loja} — ${l.nomeLoja}`).join('\n')
              : 'Sem lojas alocadas';
            // Mostra até 3 lojas como chips; o restante vira um "+N" para
            // manter a altura do card previsível mesmo quando um box tem
            // muitas lojas alocadas (evitando que a grade volte a rolar).
            const chipsVisiveis = box.lojas.slice(0, 3);
            const chipsRestantes = box.lojas.length - chipsVisiveis.length;
            const especial = boxEhEspecial(box.nome);
            return (
              <button
                key={box.numero}
                onClick={() => irPara('boxes')}
                title={`${box.nome} (${box.status.texto})\n${tituloLojas}`}
                className={`flex flex-col rounded-lg border p-3.5 text-left transition-colors ${
                  especial
                    ? 'border-rose-200 bg-rose-50/60 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20 dark:hover:border-rose-800 dark:hover:bg-rose-950/30'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <p
                    className={`truncate text-sm font-semibold ${
                      especial ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {box.nome}
                  </p>
                  <span
                    className={`h-3 w-3 flex-shrink-0 rounded-full ${box.status.corSolida}`}
                    aria-label={box.status.texto}
                  />
                </div>

                <p className="mt-2 text-xl font-bold leading-none text-slate-800 dark:text-slate-100">
                  {box.ocupadas}
                  <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/{box.totalVagas}</span>
                </p>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className={`h-full rounded-full ${box.status.corBarra}`} style={{ width: `${percentual}%` }} />
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {box.lojas.length === 0 ? (
                    <span className="text-[11px] text-slate-300 dark:text-slate-600">Sem lojas</span>
                  ) : (
                    <>
                      {chipsVisiveis.map((loja) => (
                        <span
                          key={loja.id}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        >
                          {loja.loja}
                        </span>
                      ))}
                      {chipsRestantes > 0 && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                          +{chipsRestantes}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <AndamentoEntregasCard irPara={irPara} />
    </div>
  );
}
