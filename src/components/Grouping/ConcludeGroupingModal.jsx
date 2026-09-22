import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getNomeBox } from '../../utils/boxLogic';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

export default function ConcludeGroupingModal({ loja, aoFechar, aoConcluir }) {
  const { actions } = useApp();
  const [quantidade, setQuantidade] = useState(loja ? String(loja.paletesAgrupados) : '');

  if (!loja) return null;

  function enviar(e) {
    e.preventDefault();
    if (!quantidade || Number(quantidade) <= 0) return;
    actions.concluirAgrupamento({ lojaId: loja.id, quantidadePaletes: Number(quantidade) });
    // Avisa o pai (GroupingPage) que este agrupamento acabou de ser
    // concluído, pra ele abrir a tela de "Notificar equipe" em seguida —
    // ver NotifyGroupingModal.jsx. Mantém compatibilidade se algum dia este
    // modal for usado sem essa etapa (aoConcluir opcional).
    if (aoConcluir) aoConcluir(loja);
    aoFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={enviar} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Concluir Agrupamento — {loja.carga} / Loja {loja.loja}
            </h3>
            <TipoCargaBadge tipo={loja.tipoCarga} />
          </div>
          <button type="button" onClick={aoFechar} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          <strong>{getNomeBox(loja.boxNumero)}</strong> • Colaboradores: {loja.colaboradores.join(', ') || '—'}.
          Informe a quantidade de paletes efetivamente conferida ao final do agrupamento físico. Ao
          confirmar, as vagas crescentes do apontamento serão liberadas e realocadas de trás para
          frente (ordem decrescente) no mesmo box, conforme essa quantidade final.
        </p>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Quantidade de paletes (conferida)
          </label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            required
            autoFocus
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          {Number(quantidade) > 0 && Number(quantidade) !== loja.paletesAgrupados && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {Number(quantidade) < loja.paletesAgrupados
                ? `Quantidade reduzida em relação ao apontamento (${loja.paletesAgrupados} pal.).`
                : `Quantidade maior que o apontamento (${loja.paletesAgrupados} pal.).`}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Concluir Agrupamento
        </button>
      </form>
    </div>
  );
}
