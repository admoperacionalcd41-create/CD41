import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

// Mostrado quando o login funcionou, mas não existe (ou não foi
// encontrado) um perfil de acesso liberado pra essa conta — por exemplo, um
// usuário criado no Supabase Auth sem a linha correspondente na tabela
// `profiles` (grupo não definido).
export default function AcessoNegado({ mensagem }) {
  const { sair } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md border dark:border-current dark:bg-amber-500/10 border-amber-400 text-amber-500 dark:text-amber-300">
          <ShieldAlert size={22} />
        </div>
        <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">Acesso não liberado</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{mensagem}</p>
        <button
          onClick={sair}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <LogOut size={15} /> Sair e tentar com outra conta
        </button>
      </div>
    </div>
  );
}
