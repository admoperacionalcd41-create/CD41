import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

// Cartão de cadastro genérico: input + botão "Adicionar" e uma lista com
// busca, edição inline e remoção por item. Usado para Colaboradores e
// Motoristas — a mesma UI serve às duas listas, mudando apenas `entidade`
// (a chave em `state`) e os textos/ícone.
export default function RegistrationList({ titulo, icone: Icone, entidade, placeholder, aoTransformar }) {
  const { state, actions } = useApp();
  const [valor, setValor] = useState('');
  const [erroLocal, setErroLocal] = useState('');
  const [busca, setBusca] = useState('');
  // Item (string) cuja edição está aberta no momento, e o texto digitado
  // nela — null quando nenhuma linha está em edição.
  const [editando, setEditando] = useState(null);
  const [valorEditado, setValorEditado] = useState('');
  const [erroEdicao, setErroEdicao] = useState('');

  const lista = state[entidade] || [];
  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((item) => item.toLowerCase().includes(termo));
  }, [lista, busca]);

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

  function iniciarEdicao(item) {
    setEditando(item);
    setValorEditado(item);
    setErroEdicao('');
  }

  function cancelarEdicao() {
    setEditando(null);
    setValorEditado('');
    setErroEdicao('');
  }

  function salvarEdicao(e) {
    e.preventDefault();
    const novoValor = aoTransformar ? aoTransformar(valorEditado) : valorEditado;
    if (!novoValor.trim()) {
      setErroEdicao('Informe um valor.');
      return;
    }
    if (
      novoValor.trim().toLowerCase() !== editando.toLowerCase() &&
      lista.some((v) => v.toLowerCase() === novoValor.trim().toLowerCase())
    ) {
      setErroEdicao('Já existe outro item com este valor.');
      return;
    }
    actions.editarItem(entidade, editando, novoValor);
    cancelarEdicao();
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

      {/* Busca só aparece quando a lista já tem itens suficientes pra valer
          a pena filtrar — evita poluir o card enquanto está vazio ou com
          poucos itens. */}
      {lista.length > 5 && (
        <div className="relative mt-2">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${lista.length} cadastros...`}
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        {lista.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Nenhum cadastro ainda.</p>
        ) : listaFiltrada.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            Nenhum cadastro encontrado para "{busca}".
          </p>
        ) : (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {listaFiltrada.map((item) =>
              editando === item ? (
                <li key={item}>
                  <form onSubmit={salvarEdicao} className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-900/40">
                    <input
                      autoFocus
                      value={valorEditado}
                      onChange={(e) => {
                        setValorEditado(e.target.value);
                        setErroEdicao('');
                      }}
                      className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-brand-500 focus:outline-none dark:border-brand-700 dark:bg-slate-800 dark:text-slate-200"
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
                  </form>
                  {erroEdicao && <p className="mt-1 px-2 text-xs font-medium text-red-500">{erroEdicao}</p>}
                </li>
              ) : (
                <li
                  key={item}
                  className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
                >
                  <span className="truncate">{item}</span>
                  {/* Sempre visíveis (não só no hover) — em tablet/celular
                      não existe hover, e essas ações precisam ser tocáveis
                      diretamente. */}
                  <span className="flex flex-shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => iniciarEdicao(item)}
                      title={`Editar ${item}`}
                      className="rounded p-1 text-slate-300 hover:text-brand-600 dark:text-slate-600 dark:hover:text-brand-400"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => actions.removerItem(entidade, item)}
                      title={`Remover ${item}`}
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
