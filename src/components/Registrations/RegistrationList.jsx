import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

// Cartão de cadastro genérico: input + botão "Adicionar" e uma lista com
// botão de remover por item. Usado para Colaboradores, Motoristas e Placas
// de Veículo — a mesma UI serve às três listas, mudando apenas `entidade`
// (a chave em `state`) e os textos/ícone.
export default function RegistrationList({ titulo, icone: Icone, entidade, placeholder, aoTransformar }) {
  const { state, actions } = useApp();
  const [valor, setValor] = useState('');
  const [erroLocal, setErroLocal] = useState('');

  const lista = state[entidade] || [];

  function aoAdicionar(e) {
    e.preventDefault();
    const valorFinal = aoTransformar ? aoTransformar(valor) : valor;
    if (!valorFinal.trim()) {
      setErroLocal('Informe um valor.');
      return;
    }
    if (lista.some((v) => v.toLowerCase() === valorFinal.trim().toLowerCase())) {
      setErroLocal('Este item já está cadastrado.');
      return;
    }
    actions.cadastrarItem(entidade, valorFinal);
    setValor('');
    setErroLocal('');
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <Icone size={16} className="text-brand-600 dark:text-brand-400" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{titulo}</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          {lista.length}
        </span>
      </div>

      <form onSubmit={aoAdicionar} className="mb-1 flex gap-2">
        <input
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setErroLocal('');
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
        <button
          type="submit"
          className="flex flex-shrink-0 items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={14} /> Adicionar
        </button>
      </form>
      {erroLocal && <p className="mb-2 text-xs font-medium text-red-500">{erroLocal}</p>}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        {lista.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Nenhum cadastro ainda.</p>
        ) : (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {lista.map((item) => (
              <li
                key={item}
                className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              >
                <span className="truncate">{item}</span>
                <button
                  onClick={() => actions.removerItem(entidade, item)}
                  title={`Remover ${item}`}
                  className="flex-shrink-0 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
