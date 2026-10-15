import React, { useMemo, useState } from 'react';
import { ClipboardList, Scale, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import {
  getLinhasProcessoDoDia,
  getLojasSemApontamentoHoje,
  calcularPesoVolume,
  getResumoStatusDoDia,
} from '../../utils/selectors';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';
import { STATUS_LOJA } from '../../utils/statusStyles';
import { montarMensagemStatusDoDia } from '../../utils/notificacoes';
import StatusOperacaoModal from '../Shared/StatusOperacaoModal.jsx';

// Legenda das cores usadas nos números das vagas dentro de cada box (ver
// BoxCard.jsx, que colore a vaga pelo status da loja que a ocupa — mesmo
// `corPonto` de statusStyles.js). Só os status que de fato podem estar
// segurando uma vaga nesse momento: "Pendente" ainda não tem box/vaga
// alocada, e "Finalizada" já liberou a vaga (carga 100% enviada — ver
// liberarTodasVagas em boxLogic.js), então os dois ficam de fora da
// legenda.
const LEGENDA_STATUS_VAGA = ['apontada', 'conferencia_finalizada', 'em_agrupamento', 'agrupada', 'carregando'].map(
  (chave) => ({ chave, ...STATUS_LOJA[chave] })
);

// Formata peso/volume no padrão pt-BR (vírgula decimal, sem casas
// desnecessárias) — mesma regra usada nos cards do Dashboard.
function formatarNumeroBR(valor) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

// Card pequeno pedido pelo usuário pra aba Box / Frota, juntando duas
// informações que hoje só existem em outras abas: a "Geração de carga feita"
// do relatório Processo do Dia (Relatórios) e o peso/volume no estilo dos
// cards do Dashboard — mas aqui só o peso/volume do que AINDA FALTA
// gerar carga hoje (pedido específico do usuário), não os quatro totais do
// Dashboard inteiro. Reaproveita os mesmos seletores usados nessas telas
// (getLinhasProcessoDoDia, calcularPesoVolume) em vez de duplicar a lógica.
// Os nomes internos (getLojasSemApontamentoHoje, apontamentoFeito, status
// "apontada" etc.) continuam os mesmos por baixo — só o TERMO exibido pro
// usuário mudou de "Apontamento" para "Geração de Carga" (pedido do
// usuário), pra não alterar dado já persistido em produção (Supabase).
export default function ResumoProcessoCard({ irPara }) {
  const { state, filtroTipoCarga } = useApp();

  const { total, comApontamento } = useMemo(() => {
    const linhas = getLinhasProcessoDoDia(state, filtroTipoCarga);
    return { total: linhas.length, comApontamento: linhas.filter((l) => l.apontamentoFeito).length };
  }, [state, filtroTipoCarga]);

  const pesoVolumePendente = useMemo(() => {
    const lojas = getLojasSemApontamentoHoje(state).filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga));
    return calcularPesoVolume(lojas);
  }, [state, filtroTipoCarga]);

  const completo = total > 0 && comApontamento === total;

  // Mensagem de "Status da operação" pro botão de WhatsApp abaixo (ver
  // getResumoStatusDoDia em selectors.js e montarMensagemStatusDoDia em
  // notificacoes.js) — pedido do usuário: mandar pro WhatsApp o que foi
  // gerado, entregue e o % de volume concluído x pendente, direto da tela
  // em que ele já trabalha o dia inteiro (Box / Frota é a aba inicial do
  // app — o Dashboard que tinha esses mesmos números fica oculto do menu).
  // Respeita o mesmo filtro global de Tipo de Carga usado no resto da tela
  // (ver `lojaPassaFiltroTipoCarga` logo abaixo).
  const resumoStatusDoDia = useMemo(() => {
    const stateFiltrado = { ...state, lojas: state.lojas.filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga)) };
    return getResumoStatusDoDia(stateFiltrado);
  }, [state, filtroTipoCarga]);
  const mensagensStatusDoDia = useMemo(
    () => ({
      enxuta: montarMensagemStatusDoDia(resumoStatusDoDia, { detalhado: false }),
      detalhada: montarMensagemStatusDoDia(resumoStatusDoDia, { detalhado: true }),
    }),
    [resumoStatusDoDia]
  );
  const [mostrarStatusModal, setMostrarStatusModal] = useState(false);

  return (
    <div className="flex flex-shrink-0 flex-col gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          // "Processo do Dia" é a primeira sub-aba de Relatórios (ver
          // ReportsPage.jsx) — já abre nela por padrão.
          onClick={() => irPara && irPara('relatorios')}
          title="Ver relatório completo em Relatórios — Processo do Dia"
          className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-left transition-colors hover:opacity-80"
        >
          <span className="flex items-center gap-2">
            <ClipboardList size={16} className="flex-shrink-0 text-totvs-600 dark:text-whatsapp-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Geração de carga feita</span>
            <span
              className={`text-sm font-bold ${
                completo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {comApontamento}
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">/{total}</span>
            </span>
          </span>

          <span className="hidden h-4 w-px flex-shrink-0 bg-slate-200 dark:bg-slate-600 sm:block" />

          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <Scale size={16} className="flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Peso/volume pendente de geração de carga</span>
            {pesoVolumePendente.tem ? (
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {formatarNumeroBR(pesoVolumePendente.peso)} kg{' '}
                <span className="text-slate-300 dark:text-slate-600">•</span>{' '}
                {formatarNumeroBR(pesoVolumePendente.volume)} m³
              </span>
            ) : (
              <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMostrarStatusModal(true)}
          title="Montar mensagem de status da operação para enviar no WhatsApp"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
        >
          <MessageCircle size={13} /> Status por WhatsApp
        </button>
      </div>

      {/* Legenda de cores das vagas, lado a lado numa linha só (pedido do
          usuário) — mesmas cores usadas nos números das vagas dentro de
          cada box logo abaixo (ver BoxCard.jsx / statusStyles.js). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-1.5 dark:border-slate-700">
        {LEGENDA_STATUS_VAGA.map(({ chave, texto, corPonto }) => (
          <span key={chave} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${corPonto}`} />
            {texto}
          </span>
        ))}
      </div>

      {mostrarStatusModal && (
        <StatusOperacaoModal
          mensagemEnxuta={mensagensStatusDoDia.enxuta}
          mensagemDetalhada={mensagensStatusDoDia.detalhada}
          aoFechar={() => setMostrarStatusModal(false)}
        />
      )}
    </div>
  );
}
