import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Rede de segurança contra tela branca: sem isso, qualquer erro de
// JavaScript não tratado durante a renderização (em qualquer tela do app)
// faz o React desmontar TUDO, deixando a página em branco sem nenhuma pista
// do que aconteceu — foi exatamente isso que causou a tela branca relatada
// depois de uma atualização anterior. Com este componente envolvendo o app
// inteiro (ver main.jsx), o mesmo tipo de erro passa a mostrar uma tela de
// aviso com botão de recarregar, em vez de nada — e os detalhes técnicos
// aqui embaixo (expansíveis) dão a mensagem exata do erro, o que ajuda a
// diagnosticar de verdade se acontecer de novo, em vez de ficar só
// adivinhando.
//
// Error boundary só existe como componente de CLASSE em React (não tem
// equivalente em hooks) — é a única exceção nesse padrão no projeto.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    // eslint-disable-next-line no-console
    console.error('Erro não tratado capturado pelo ErrorBoundary:', erro, info?.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/60 dark:bg-slate-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle size={24} />
          </div>
          <h1 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">
            Algo deu errado nesta tela
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Recarregar a página costuma resolver. Se continuar acontecendo, avise o suporte com o
            detalhe técnico abaixo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <RefreshCw size={14} />
            Recarregar página
          </button>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
              Detalhe técnico
            </summary>
            <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              {String(this.state.erro?.stack || this.state.erro?.message || this.state.erro)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
