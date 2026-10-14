import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getNomeBox } from '../../utils/boxLogic';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';
import SeletorCadastro from '../Shared/SeletorCadastro.jsx';

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
            <Users size={18} className="text-totvs-600 dark:text-whatsapp-400" />
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
              <SeletorCadastro
                key={i}
                opcoes={state.colaboradoresCadastrados}
                valor={colaboradores[i]}
                onSelecionar={(valor) => atualizarColaborador(i, valor)}
                placeholder={`Colaborador ${i + 1}`}
                permiteVazio
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-totvs-600 dark:bg-whatsapp-600 py-2.5 text-sm font-semibold text-white hover:bg-totvs-700 dark:hover:bg-whatsapp-700"
        >
          Iniciar Agrupamento
        </button>
      </form>
    </div>
  );
}
