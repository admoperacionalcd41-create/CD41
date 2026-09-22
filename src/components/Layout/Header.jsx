import React, { useEffect, useRef, useState } from 'react';
import { Menu, RotateCcw, Trash2, CalendarClock, X, CheckCircle2, AlertTriangle, Sun, Moon, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useDarkMode } from '../../hooks/useDarkMode.js';
import { formatarData } from '../../utils/dateHelpers';
import { TIPOS_CARGA } from '../../utils/tipoCarga';

const CONFIRMACOES = {
  restaurar: {
    pergunta: 'Restaurar exemplo?',
    executar: (actions) => actions.restaurarDadosExemplo(),
  },
  zerar: {
    pergunta: 'Zerar tudo?',
    executar: (actions) => actions.limparTudo(),
  },
};

// Senha extra exigida pra confirmar "Restaurar Exemplo" e "Zerar Tudo" — são
// ações que apagam dados de verdade, então além do "Sim/Não" pedimos essa
// senha como uma segunda trava. Configurável via variável de ambiente
// (VITE_SENHA_CONFIRMACAO_RESET, no .env local ou nas variáveis de ambiente
// do Vercel) sem precisar mexer no código; se não for configurada, usa um
// valor padrão pra não travar o preview/desenvolvimento local.
const SENHA_CONFIRMACAO = import.meta.env.VITE_SENHA_CONFIRMACAO_RESET || '9516';

export default function Header({ tituloAba, abaAtiva, onAbrirMenu }) {
  const { state, actions, filtroTipoCarga, setFiltroTipoCarga } = useApp();
  const { escuro, alternarTema } = useDarkMode();
  const [confirmando, setConfirmando] = useState(null); // null | 'restaurar' | 'zerar'
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [senhaErrada, setSenhaErrada] = useState(false);
  const inputSenhaRef = useRef(null);

  function cancelarConfirmacao() {
    setConfirmando(null);
    setSenhaDigitada('');
    setSenhaErrada(false);
  }

  function confirmarComSenha(evento) {
    evento.preventDefault();
    if (senhaDigitada !== SENHA_CONFIRMACAO) {
      setSenhaErrada(true);
      setSenhaDigitada('');
      inputSenhaRef.current?.focus();
      return;
    }
    CONFIRMACOES[confirmando].executar(actions);
    cancelarConfirmacao();
  }

  useEffect(() => {
    if (!state.ultimoAviso && !state.ultimoErro) return;
    const timer = setTimeout(() => actions.limparMensagens(), 5000);
    return () => clearTimeout(timer);
  }, [state.ultimoAviso, state.ultimoErro, actions]);

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onAbrirMenu}
            aria-label="Abrir menu"
            title="Abrir menu"
            className="flex flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            <Menu size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{tituloAba}</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Dia operacional:{' '}
              <span className="font-semibold text-slate-600 dark:text-slate-300">{formatarData(state.diaAtual)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {abaAtiva !== 'cadastros' && (
            <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-600">
              <button
                type="button"
                onClick={() => setFiltroTipoCarga('todos')}
                title="Mostrar lojas de carga Seca e Resfriada"
                className={`px-2.5 py-1.5 font-medium ${
                  filtroTipoCarga === 'todos'
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
                }`}
              >
                Todos
              </button>
              {TIPOS_CARGA.map((t) => (
                <button
                  key={t.chave}
                  type="button"
                  onClick={() => setFiltroTipoCarga(t.chave)}
                  title={`Mostrar só lojas de carga ${t.texto}`}
                  className={`px-2.5 py-1.5 font-medium ${
                    filtroTipoCarga === t.chave
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
                  }`}
                >
                  {t.texto}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={alternarTema}
            title={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            {escuro ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {abaAtiva === 'importar' && (
            <>
              <button
                onClick={() => actions.encerrarDia()}
                title="Avança o dia operacional; lojas não finalizadas viram saldo do dia anterior"
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                <CalendarClock size={14} />
                Encerrar Dia
              </button>

              {!confirmando ? (
                <>
                  <button
                    onClick={() => setConfirmando('restaurar')}
                    title="Substitui os dados atuais pelo conjunto de exemplo (28 lojas, boxes e carregamentos de demonstração)"
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  >
                    <RotateCcw size={14} />
                    Restaurar Exemplo
                  </button>
                  <button
                    onClick={() => setConfirmando('zerar')}
                    title="Remove todas as lojas, boxes ocupados e protocolos — começa um teste do zero"
                    className="flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={14} />
                    Zerar Tudo
                  </button>
                </>
              ) : (
                <form
                  onSubmit={confirmarComSenha}
                  className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-900/40"
                >
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <Lock size={12} />
                    {CONFIRMACOES[confirmando].pergunta} Digite a senha:
                  </span>
                  <input
                    ref={inputSenhaRef}
                    type="password"
                    autoFocus
                    value={senhaDigitada}
                    onChange={(e) => {
                      setSenhaDigitada(e.target.value);
                      setSenhaErrada(false);
                    }}
                    placeholder="Senha"
                    className={`w-24 rounded border px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-slate-800 dark:text-slate-100 ${
                      senhaErrada ? 'border-red-400 dark:border-red-500' : 'border-amber-300 dark:border-amber-700'
                    }`}
                  />
                  <button
                    type="submit"
                    className="rounded bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={cancelarConfirmacao}
                    className="rounded px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  {senhaErrada && <span className="font-medium text-red-600 dark:text-red-400">Senha incorreta.</span>}
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {(state.ultimoAviso || state.ultimoErro) && (
        <div
          className={`flex items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6 ${
            state.ultimoErro
              ? 'bg-red-50 text-red-700 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300'
              : 'bg-emerald-50 text-emerald-700 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {state.ultimoErro ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {state.ultimoErro || state.ultimoAviso}
          </span>
          <button onClick={() => actions.limparMensagens()} className="opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </header>
  );
}
