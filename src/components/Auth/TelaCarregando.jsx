import React from 'react';
import { Loader2 } from 'lucide-react';

export default function TelaCarregando({ texto = 'Carregando...' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm font-medium">{texto}</p>
      </div>
    </div>
  );
}
