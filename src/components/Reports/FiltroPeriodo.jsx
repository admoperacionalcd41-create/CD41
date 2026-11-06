import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mesAtualISO, getIntervaloSemana, formatarData } from '../../utils/dateHelpers';

// Controles de período (Hoje / Este mês / Escolher mês) usados nos
// relatórios de Permanência, Entregas por Motorista e Produtividade — ver
// usePeriodoRelatorio.js. "Escolher mês" revela um seletor de mês/ano, pra
// enxergar dados de meses anteriores (não só hoje ou o mês atual). O
// seletor tem como teto o mês corrente — não faz sentido escolher um mês
// futuro, que nunca teria dados.
export default function FiltroPeriodo({ periodo, setPeriodo, mesEscolhido, setMesEscolhido, semanasAtras = 0, setSemanasAtras }) {
  const semana = getIntervaloSemana(semanasAtras);
  const curto = (d) => formatarData(d).slice(0, 5);
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-600">
        {[
          { chave: 'hoje', rotulo: 'Hoje' },
          { chave: 'semana', rotulo: 'Semana' },
          { chave: 'mes', rotulo: 'Este mês' },
          { chave: 'escolher', rotulo: 'Escolher mês' },
        ].map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            onClick={() => setPeriodo(opcao.chave)}
            className={`px-3 py-1.5 font-medium ${
              periodo === opcao.chave
                ? 'bg-totvs-600 dark:bg-whatsapp-600 text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      {periodo === 'semana' && setSemanasAtras && (
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setSemanasAtras(semanasAtras + 1)}
            aria-label="Semana anterior"
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[8.5rem] text-center font-medium" data-testid="intervalo-semana">
            {semanasAtras === 0 ? 'Esta semana' : semanasAtras === 1 ? 'Semana passada' : `${semanasAtras} semanas atrás`}
            <span className="block text-[10px] font-normal text-slate-400 dark:text-slate-500">
              {curto(semana.inicio)} a {curto(semana.fim)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSemanasAtras(Math.max(0, semanasAtras - 1))}
            disabled={semanasAtras === 0}
            aria-label="Próxima semana"
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      {periodo === 'escolher' && (
        <input
          type="month"
          value={mesEscolhido}
          max={mesAtualISO()}
          onChange={(e) => setMesEscolhido(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-totvs-500 dark:focus:border-whatsapp-500 focus:outline-none focus:ring-1 focus:ring-totvs-500 dark:focus:ring-whatsapp-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      )}
    </div>
  );
}
