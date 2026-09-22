import React, { useState } from 'react';
import { Car, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

// Cartão de cadastro de Placas de Veículo. É um caso à parte de
// RegistrationList.jsx porque cada placa carrega um dado extra — se o
// veículo possui plataforma (Sim/Não) — em vez de ser só uma string simples
// como Colaboradores/Motoristas.
export default function PlacasRegistrationList() {
  const { state, actions } = useApp();
  const [placa, setPlaca] = useState('');
  const [possuiPlataforma, setPossuiPlataforma] = useState(false);
  const [erroLocal, setErroLocal] = useState('');

  const lista = state.placasCadastradas || [];

  function aoAdicionar(e) {
    e.preventDefault();
    const placaLimpa = placa.trim().toUpperCase();
    if (!placaLimpa) {
      setErroLocal('Informe uma placa.');
      return;
    }
    if (lista.some((p) => p.placa === placaLimpa)) {
      setErroLocal('Esta placa já está cadastrada.');
      return;
    }
    actions.cadastrarItem('placasCadastradas', { placa: placaLimpa, possuiPlataforma });
    setPlaca('');
    setPossuiPlataforma(false);
    setErroLocal('');
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <Car size={16} className="text-brand-600 dark:text-brand-400" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Placas de Veículo</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          {lista.length}
        </span>
      </div>

      <form onSubmit={aoAdicionar} className="space-y-2">
        <input
          value={placa}
          onChange={(e) => {
            setPlaca(e.target.value);
            setErroLocal('');
          }}
          placeholder="ABC-1D23"
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm uppercase text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />

        <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs dark:bg-slate-700/40">
          <span className="font-medium text-slate-600 dark:text-slate-300">Possui plataforma?</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <input
                type="radio"
                name="possui-plataforma-cadastro"
                checked={possuiPlataforma === true}
                onChange={() => setPossuiPlataforma(true)}
              />
              Sim
            </label>
            <label className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <input
                type="radio"
                name="possui-plataforma-cadastro"
                checked={possuiPlataforma === false}
                onChange={() => setPossuiPlataforma(false)}
              />
              Não
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={14} /> Adicionar
        </button>
      </form>
      {erroLocal && <p className="mt-2 text-xs font-medium text-red-500">{erroLocal}</p>}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        {lista.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Nenhuma placa cadastrada ainda.</p>
        ) : (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {lista.map((item) => (
              <li
                key={item.placa}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono font-medium">{item.placa}</span>
                  <span
                    className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      item.possuiPlataforma
                        ? 'bg-emerald-50 text-emerald-600 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {item.possuiPlataforma ? 'Com plataforma' : 'Sem plataforma'}
                  </span>
                </span>
                <button
                  onClick={() => actions.removerItem('placasCadastradas', item.placa)}
                  title={`Remover ${item.placa}`}
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
