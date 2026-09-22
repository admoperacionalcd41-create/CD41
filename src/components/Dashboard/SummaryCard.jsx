import React from 'react';

const CORES = {
  blue: 'bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/40',
  emerald:
    'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/40',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/40',
  purple:
    'bg-purple-50 text-purple-600 ring-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/40',
};

// Formata peso/volume no padrão pt-BR (vírgula decimal), sem casas decimais
// desnecessárias — ex.: 1234.5 -> "1.234,5".
function formatarNumeroBR(valor) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

export default function SummaryCard({ titulo, valor, subtitulo, icone: Icone, cor = 'blue', onClick, pesoVolume }) {
  const Componente = onClick ? 'button' : 'div';
  return (
    <Componente
      onClick={onClick}
      className={`flex items-start justify-between rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-800 ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{titulo}</p>
        <p className="mt-1 text-3xl font-bold text-slate-800 dark:text-slate-100">{valor}</p>
        {subtitulo && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{subtitulo}</p>}
        {pesoVolume?.tem && (
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {formatarNumeroBR(pesoVolume.peso)} kg • {formatarNumeroBR(pesoVolume.volume)} m³
          </p>
        )}
      </div>
      <div className={`rounded-lg p-3 ring-1 ring-inset ${CORES[cor]}`}>
        <Icone size={22} />
      </div>
    </Componente>
  );
}
