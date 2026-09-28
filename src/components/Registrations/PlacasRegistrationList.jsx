import React, { useMemo, useState } from 'react';
import { Car, Plus, Trash2, Pencil, Check, X, Search } from 'lucide-react';
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
  const [busca, setBusca] = useState('');
  // Placa (string) em edição no momento — null quando nenhuma linha está
  // sendo editada.
  const [editando, setEditando] = useState(null);
  const [placaEditada, setPlacaEditada] = useState('');
  const [plataformaEditada, setPlataformaEditada] = useState(false);
  const [erroEdicao, setErroEdicao] = useState('');

  const lista = state.placasCadastradas || [];
  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((p) => p.placa.toLowerCase().includes(termo));
  }, [lista, busca]);

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

  function iniciarEdicao(item) {
    setEditando(item.placa);
    setPlacaEditada(item.placa);
    setPlataformaEditada(item.possuiPlataforma);
    setErroEdicao('');
  }

  function cancelarEdicao() {
    setEditando(null);
    setPlacaEditada('');
    setErroEdicao('');
  }

  function salvarEdicao(e) {
    e.preventDefault();
    const placaNovaLimpa = placaEditada.trim().toUpperCase();
    if (!placaNovaLimpa) {
      setErroEdicao('Informe uma placa.');
      return;
    }
    if (placaNovaLimpa !== editando && lista.some((p) => p.placa === placaNovaLimpa)) {
      setErroEdicao('Já existe outra placa cadastrada com este valor.');
      return;
    }
    actions.editarItem('placasCadastradas', editando, { placa: placaNovaLimpa, possuiPlataforma: plataformaEditada });
    cancelarEdicao();
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

      {lista.length > 5 && (
        <div className="relative mt-2">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${lista.length} placas...`}
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        {lista.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Nenhuma placa cadastrada ainda.</p>
        ) : listaFiltrada.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            Nenhuma placa encontrada para "{busca}".
          </p>
        ) : (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {listaFiltrada.map((item) =>
              editando === item.placa ? (
                <li key={item.placa}>
                  <form onSubmit={salvarEdicao} className="space-y-1.5 rounded-md bg-slate-50 p-2 dark:bg-slate-900/40">
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={placaEditada}
                        onChange={(e) => {
                          setPlacaEditada(e.target.value);
                          setErroEdicao('');
                        }}
                        className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-2 py-1 text-sm uppercase text-slate-700 focus:border-brand-500 focus:outline-none dark:border-brand-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      <button
                        type="submit"
                        title="Salvar"
                        className="flex-shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicao}
                        title="Cancelar"
                        className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-700"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium">Possui plataforma?</span>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`possui-plataforma-editar-${item.placa}`}
                          checked={plataformaEditada === true}
                          onChange={() => setPlataformaEditada(true)}
                        />
                        Sim
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`possui-plataforma-editar-${item.placa}`}
                          checked={plataformaEditada === false}
                          onChange={() => setPlataformaEditada(false)}
                        />
                        Não
                      </label>
                    </div>
                  </form>
                  {erroEdicao && <p className="mt-1 px-2 text-xs font-medium text-red-500">{erroEdicao}</p>}
                </li>
              ) : (
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
                  <span className="flex flex-shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => iniciarEdicao(item)}
                      title={`Editar ${item.placa}`}
                      className="rounded p-1 text-slate-300 hover:text-brand-600 dark:text-slate-600 dark:hover:text-brand-400"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => actions.removerItem('placasCadastradas', item.placa)}
                      title={`Remover ${item.placa}`}
                      className="rounded p-1 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
