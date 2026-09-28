import React, { useState } from 'react';
import { ListChecks, Target, Clock, Truck, BarChart3 } from 'lucide-react';
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
  const [abaAtiva, setAbaAtiva] = useState(RELATORIOS[0].chave);
  const relatorioAtivo = RELATORIOS.find((r) => r.chave === abaAtiva) ?? RELATORIOS[0];
  const { Componente } = relatorioAtivo;

  return (
    <div className="space-y-4">
      {/* Barra de sub-abas — uma por relatório. O `title` em cada botão
          mostra a descrição completa ao passar o mouse, pra quem já sabe
          qual quer abrir direto. */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3 dark:border-slate-700">
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

      <Componente />
    </div>
  );
}
