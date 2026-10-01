import React from 'react';
import { mesAtualISO } from '../../utils/dateHelpers';

// Controles de período (Hoje / Este mês / Escolher mês) usados nos
// relatórios de Permanência, Entregas por Motorista e Produtividade — ver
// usePeriodoRelatorio.js. "Escolher mês" revela um seletor de mês/ano, pra
// enxergar dados de meses anteriores (não só hoje ou o mês atual). O
// seletor tem como teto o mês corrente — não faz sentido escolher um mês
// futuro, que nunca teria dados.
export default function FiltroPeriodo({ periodo, setPeriodo, mesEscolhido, setMesEscolhido }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-600">
        {[
          { chave: 'hoje', rotulo: 'Hoje' },
          { chave: 'mes', rotulo: 'Este mês' },
          { chave: 'escolher', rotulo: 'Escolher mês' },
        ].map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            onClick={() => setPeriodo(opcao.chave)}
            className={`px-3 py-1.5 font-medium ${
              periodo === opcao.chave
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      {periodo === 'escolher' && (
        <input
          type="month"
          value={mesEscolhido}
          max={mesAtualISO()}
          onChange={(e) => setMesEscolhido(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      )}
    </div>
  );
}
