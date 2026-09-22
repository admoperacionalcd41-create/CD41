import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getNomeBox } from '../../utils/boxLogic';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

const CAMPOS_COLABORADORES = [0, 1, 2, 3];

export default function StartGroupingModal({ loja, aoFechar }) {
  const { state, actions } = useApp();
  const [colaboradores, setColaboradores] = useState(['', '', '', '']);

  if (!loja) return null;

  function atualizarColaborador(indice, valor) {
    setColaboradores((prev) => prev.map((c, i) => (i === indice ? valor : c)));
  }

  function enviar(e) {
    e.preventDefault();
    actions.iniciarAgrupamento({
      lojaId: loja.id,
      colaboradores: colaboradores.filter((c) => c.trim() !== ''),
    });
    aoFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={enviar} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Iniciar Agrupamento — {loja.carga} / Loja {loja.loja}
            </h3>
            <TipoCargaBadge tipo={loja.tipoCarga} />
          </div>
          <button type="button" onClick={aoFechar} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          <strong>{getNomeBox(loja.boxNumero)}</strong> • Vagas atuais (crescentes) {loja.vagasOcupadas.join(', ') || '—'}.
          Informe os colaboradores que estarão montando fisicamente o agrupamento nesse box. A
          quantidade de paletes só será reconfirmada ao concluir o agrupamento.
        </p>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Colaboradores responsáveis (até 4)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CAMPOS_COLABORADORES.map((i) => (
              <input
                key={i}
                list="lista-colaboradores-agrupamento"
                value={colaboradores[i]}
                onChange={(e) => atualizarColaborador(i, e.target.value)}
                placeholder={`Colaborador ${i + 1}`}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            ))}
          </div>
          <datalist id="lista-colaboradores-agrupamento">
            {state.colaboradoresCadastrados.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </div>

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Iniciar Agrupamento
        </button>
      </form>
    </div>
  );
}
