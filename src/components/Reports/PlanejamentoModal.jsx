import React, { useMemo } from 'react';
import { X, Target, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getPlanejamentoDoDia, ROTULO_ETAPA, NIVEIS } from '../../utils/planejamentoDia';
import { getNomeBox } from '../../utils/boxLogic';
import { formatarData, formatarDiaSemanaCurto } from '../../utils/dateHelpers';

const ESTILO_NIVEL = {
  critica: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  atencao: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  no_prazo: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};
const FUNDO_LINHA = {
  critica: 'bg-red-50/70 dark:bg-red-500/10',
  alta: 'bg-orange-50/60 dark:bg-orange-500/10',
  atencao: '',
  no_prazo: '',
  concluida: 'opacity-60',
};

function Selo({ children, className }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

function SeloSimNao({ valor, rotuloParcial = 'Parcial' }) {
  if (valor === 'sim') return <Selo className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Sim</Selo>;
  if (valor === 'parcial') return <Selo className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{rotuloParcial}</Selo>;
  return <Selo className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">Não</Selo>;
}

// PLANEJAMENTO (aba Processo do Dia): análise para decidir onde focar e
// entregar todas as lojas — ver planejamentoDia.js para as regras.
export default function PlanejamentoModal({ aoFechar }) {
  const { state, filtroTipoCarga } = useApp();
  const plano = useMemo(
    () => getPlanejamentoDoDia(state, filtroTipoCarga),
    [state.lojas, state.protocolos, state.diaAtual, state.sequenciaLojas, filtroTipoCarga]
  );
  const { linhas, diasAnteriores } = plano;

  const periodoAnterior =
    diasAnteriores.length === 1
      ? `${formatarDiaSemanaCurto(diasAnteriores[0])} ${formatarData(diasAnteriores[0])}`
      : `${formatarDiaSemanaCurto(diasAnteriores[0])} ${formatarData(diasAnteriores[0])} a ${formatarDiaSemanaCurto(
          diasAnteriores[diasAnteriores.length - 1]
        )} ${formatarData(diasAnteriores[diasAnteriores.length - 1])}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6" role="dialog" aria-label="Planejamento">
      <div className="w-full max-w-6xl rounded-lg bg-white p-4 shadow-xl dark:bg-slate-800 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <Target size={18} /> Planejamento do dia
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Meta: entregar todas as lojas. “Entregue ontem” considera {periodoAnterior}. Lojas na mesma ordem de posição do Processo do Dia.
            </p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {/* Tabela na ordem de posição */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700">
          <table className="w-full text-left text-xs" data-testid="planejamento-tabela">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-2 py-2 font-semibold">Pos.</th>
                <th className="px-2 py-2 font-semibold">Loja</th>
                <th className="px-2 py-2 font-semibold">Carga agora</th>
                <th className="px-2 py-2 font-semibold">Carregada hoje</th>
                <th className="px-2 py-2 font-semibold">Entregue ontem</th>
                <th className="px-2 py-2 font-semibold">Prioridade</th>
                <th className="px-2 py-2 font-semibold">Ação sugerida</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo} className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${FUNDO_LINHA[l.nivel]}`} data-nivel={l.nivel}>
                  <td className="px-2 py-1.5 font-semibold text-slate-500 dark:text-slate-400">{l.posicao}</td>
                  <td className="px-2 py-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{l.codigo}</span>
                    {l.nomeLoja && <span className="ml-1.5 text-slate-400 dark:text-slate-500">{l.nomeLoja}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                    {l.andamento ? (
                      <>
                        <span className="font-medium">{ROTULO_ETAPA[l.andamento.etapa]}</span>
                        <span className="ml-1 text-slate-400 dark:text-slate-500">
                          {getNomeBox(l.andamento.boxNumero)}
                          {l.andamento.paletes ? ` · ${l.andamento.paletes} pal.` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">Sem carga no box</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5"><SeloSimNao valor={l.carregadaHoje} rotuloParcial="Parcial (saldo)" /></td>
                  <td className="px-2 py-1.5"><SeloSimNao valor={l.ontem} rotuloParcial="Parcial" /></td>
                  <td className="px-2 py-1.5"><Selo className={ESTILO_NIVEL[l.nivel]}>{NIVEIS[l.nivel].rotulo}</Selo></td>
                  <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                    <span className="font-medium">{l.acao}</span>
                    {l.motivo && <span className="block text-[11px] text-slate-400 dark:text-slate-500">{l.motivo}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          <CheckCircle2 size={11} className="mr-1 inline" />
          Crítica: não entregue ontem e sem carga hoje · Alta: não entregue ontem (ou saldo pendente) com carga em andamento · Atenção: entregue ontem, mas sem carga hoje · No prazo: entregue ontem e com carga em andamento.
        </p>
      </div>
    </div>
  );
}
