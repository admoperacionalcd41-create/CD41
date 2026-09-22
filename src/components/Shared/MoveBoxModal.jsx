import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getNomeBox, getVagasDisponiveisCount } from '../../utils/boxLogic';
import TipoCargaBadge from './TipoCargaBadge.jsx';

// Modal genérico de movimentação de box, reutilizado nas telas de Boxes e
// Vagas e de Agrupamento e Etiquetas: lista os demais boxes com a
// quantidade de vagas livres, desabilitando os que não comportam a
// quantidade de paletes atual da loja.
export default function MoveBoxModal({ loja, aoFechar }) {
  const { state, actions } = useApp();
  const [boxDestino, setBoxDestino] = useState('');
  const [erroLocal, setErroLocal] = useState('');

  const quantidade = loja.paletesAgrupados;

  const opcoes = state.boxes
    .filter((b) => b.numero !== loja.boxNumero)
    .map((b) => ({ numero: b.numero, nome: b.nome, disponiveis: getVagasDisponiveisCount(b) }));

  function aoConfirmar() {
    if (!boxDestino) {
      setErroLocal('Selecione o box de destino.');
      return;
    }
    const box = opcoes.find((b) => b.numero === Number(boxDestino));
    if (box && box.disponiveis < quantidade) {
      setErroLocal(
        `${box.nome} possui apenas ${box.disponiveis} vaga(s) disponível(is) — necessário: ${quantidade}.`
      );
      return;
    }
    actions.moverBox({ lojaId: loja.id, boxNumeroDestino: Number(boxDestino) });
    aoFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <ArrowRightLeft size={16} /> Mover de Box
            <TipoCargaBadge tipo={loja.tipoCarga} />
          </h3>
          <button
            onClick={aoFechar}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Loja <strong>{loja.loja}</strong> — {loja.nomeLoja} — atualmente no{' '}
          <strong>{getNomeBox(loja.boxNumero)}</strong> ({quantidade} palete{quantidade !== 1 ? 's' : ''}).
        </p>

        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Box de destino
        </label>
        <select
          value={boxDestino}
          onChange={(e) => {
            setBoxDestino(e.target.value);
            setErroLocal('');
          }}
          className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        >
          <option value="">Selecione...</option>
          {opcoes.map((b) => (
            <option key={b.numero} value={b.numero} disabled={b.disponiveis < quantidade}>
              {b.nome} — {b.disponiveis} vaga{b.disponiveis !== 1 ? 's' : ''} livre
              {b.disponiveis !== 1 ? 's' : ''}
              {b.disponiveis < quantidade ? ' (insuficiente)' : ''}
            </option>
          ))}
        </select>

        {erroLocal && <p className="mb-2 text-xs font-medium text-red-500">{erroLocal}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={aoFechar}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={aoConfirmar}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Mover
          </button>
        </div>
      </div>
    </div>
  );
}
