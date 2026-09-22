import React, { useState } from 'react';
import { LogIn, Warehouse } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

// Tela de login — único jeito de entrar no sistema (não há cadastro
// público: as contas dos ~20 usuários são criadas manualmente por quem
// administra o Supabase, com um grupo de acesso já definido). Erros de
// autenticação (senha errada, usuário inexistente) aparecem aqui; um login
// válido mas sem perfil de acesso liberado é tratado em App.jsx (depois do
// login), não nesta tela.
export default function LoginPage() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const erroLogin = await entrar(email.trim(), senha);
    setEnviando(false);
    if (erroLogin) {
      setErro(
        erroLogin.message?.includes('Invalid login credentials')
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar. Tente novamente em instantes.'
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md border-2 border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400">
            <Warehouse size={24} />
          </div>
          <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">Gestão de Docas</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500">Entre com seu e-mail e senha cadastrados</p>
        </div>

        <form onSubmit={aoEnviar} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">E-mail</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {erro && (
            <p className="rounded-md border border-current bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={16} /> {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Não tem acesso ainda? Fale com o administrador do sistema pra liberar seu login.
        </p>
      </div>
    </div>
  );
}
