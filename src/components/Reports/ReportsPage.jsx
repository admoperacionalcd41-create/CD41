import React, { useState } from 'react';
import { ListChecks, Target, Clock, Truck, BarChart3, FileSpreadsheet, Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { exportarRelatoriosParaExcel } from '../../utils/exportExcel';
import { imprimirRelatorioAtivo } from '../../utils/imprimirRelatorio';
import DailyProcessReport from './DailyProcessReport.jsx';
import DailyGoalReport from './DailyGoalReport.jsx';
import DwellTimeReport from './DwellTimeReport.jsx';
import DriverDeliveriesReport from './DriverDeliveriesReport.jsx';
import ProductivityReport from './ProductivityReport.jsx';

// Cada relatório agora é uma sub-aba (antes ficavam todos empilhados numa
// lista longa, precisando rolar bastante pra achar o que interessa). A
// `descricao` aparece em dois lugares — como tooltip do botão da aba e, de
// forma mais visível, na faixa de contexto logo abaixo da barra de abas —
// pra deixar claro o que cada relatório mostra antes mesmo de abrir.
const RELATORIOS = [
  {
    chave: 'processo',
    rotulo: 'Processo do Dia',
    Icone: ListChecks,
    descricao: 'Mostra, loja por loja, se o apontamento pro box e o carregamento já foram feitos hoje.',
    Componente: DailyProcessReport,
  },
  {
    chave: 'meta',
    rotulo: 'Meta de Entrega',
    Icone: Target,
    descricao: 'Compara quantas lojas já saíram do CD hoje com a meta diária de 28 lojas.',
    Componente: DailyGoalReport,
  },
  {
    chave: 'permanencia',
    rotulo: 'Tempo de Permanência',
    Icone: Clock,
    descricao: 'Quanto tempo cada motorista fica parado em cada loja, do registro de chegada até o de saída.',
    Componente: DwellTimeReport,
  },
  {
    chave: 'motoristas',
    rotulo: 'Entregas por Motorista',
    Icone: Truck,
    descricao: 'Quantas lojas cada motorista já entregou, hoje ou no mês.',
    Componente: DriverDeliveriesReport,
  },
  {
    chave: 'produtividade',
    rotulo: 'Produtividade',
    Icone: BarChart3,
    descricao: 'Quantos paletes cada colaborador agrupou, hoje ou no mês.',
    Componente: ProductivityReport,
  },
];

export default function ReportsPage() {
  const { state, filtroTipoCarga } = useApp();
  const [abaAtiva, setAbaAtiva] = useState(RELATORIOS[0].chave);
  const [exportando, setExportando] = useState(false);
  const relatorioAtivo = RELATORIOS.find((r) => r.chave === abaAtiva) ?? RELATORIOS[0];
  const { Componente } = relatorioAtivo;

  async function aoExportarExcel() {
    setExportando(true);
    try {
      await exportarRelatoriosParaExcel(state, filtroTipoCarga);
    } finally {
      setExportando(false);
    }
  }

  function aoImprimir() {
    imprimirRelatorioAtivo(relatorioAtivo.rotulo, relatorioAtivo.descricao);
  }

  return (
    <div className="space-y-4">
      {/* Barra de sub-abas — uma por relatório. O `title` em cada botão
          mostra a descrição completa ao passar o mouse, pra quem já sabe
          qual quer abrir direto. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex flex-wrap gap-1.5">
          {RELATORIOS.map(({ chave, rotulo, Icone, descricao }) => (
            <button
              key={chave}
              onClick={() => setAbaAtiva(chave)}
              title={descricao}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                abaAtiva === chave
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
              }`}
            >
              <Icone size={14} />
              {rotulo}
            </button>
          ))}
        </div>

        {/* Exportar sai como uma única planilha .xlsx com todos os
            relatórios (uma aba por relatório) — reaproveita a mesma função
            já usada em Importar Dados, só que agora também acessível direto
            daqui, que é onde um usuário procurando "exportar relatório"
            naturalmente olharia primeiro. Imprimir gera só o relatório
            atualmente aberto na tela. */}
        <div className="flex flex-shrink-0 gap-1.5">
          <button
            onClick={aoExportarExcel}
            disabled={exportando}
            title="Baixar todos os relatórios em uma planilha Excel (.xlsx)"
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <FileSpreadsheet size={14} />
            {exportando ? 'Gerando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={aoImprimir}
            title="Imprimir este relatório (ou use Ctrl+P / Cmd+P)"
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Printer size={14} />
            Imprimir
          </button>
        </div>
      </div>

      {/* Faixa de contexto: repete o nome e a descrição do relatório aberto
          no momento, sempre visível acima do conteúdo — não depende de
          passar o mouse na aba (útil em telas de toque, onde não existe
          hover). */}
      <div className="flex items-start gap-2 rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2 text-xs text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
        <relatorioAtivo.Icone size={14} className="mt-px flex-shrink-0" />
        <p>
          <span className="font-bold">{relatorioAtivo.rotulo}:</span> {relatorioAtivo.descricao}
        </p>
      </div>

      {/* Alvo da impressão (ver imprimirRelatorio.js) — só o conteúdo do
          relatório ativo entra no papel, sem a barra de abas nem a faixa de
          contexto acima. */}
      <div id="area-impressao-relatorio">
        <Componente />
      </div>
    </div>
  );
}
