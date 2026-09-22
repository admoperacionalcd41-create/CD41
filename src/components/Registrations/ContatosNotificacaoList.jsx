import React, { useState } from 'react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

// Cadastro dos contatos que recebem, por WhatsApp, a notificação disparada
// ao concluir o agrupamento de uma carga (ver NotifyGroupingModal.jsx). Cada
// item carrega nome + telefone — outro caso à parte de RegistrationList.jsx
// pelo mesmo motivo de Placas de Veículo (dois campos em vez de um).
export default function ContatosNotificacaoList() {
  const { state, actions } = useApp();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erroLocal, setErroLocal] = useState('');

  const lista = state.contatosNotificacao || [];

  function aoAdicionar(e) {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      setErroLocal('Informe nome e telefone.');
      return;
    }
    actions.cadastrarItem('contatosNotificacao', { nome, telefone });
    setNome('');
    setTelefone('');
    setErroLocal('');
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle size={16} className="text-brand-600 dark:text-brand-400" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Notificação (WhatsApp)</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          {lista.length}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
        Quem cadastrar aqui aparece na tela de "Notificar equipe" logo depois de concluir um
        agrupamento, com um botão pra enviar (pelo WhatsApp) um aviso da loja/carga/box pra essa
        pessoa.
      </p>

      <form onSubmit={aoAdicionar} className="space-y-2">
        <input
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErroLocal('');
          }}
          placeholder="Nome"
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
        <input
          value={telefone}
          onChange={(e) => {
            setTelefone(e.target.value);
            setErroLocal('');
          }}
          placeholder="Telefone com DDD, ex: (11) 98765-4321"
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
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
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Nenhum contato cadastrado ainda.</p>
        ) : (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {lista.map((item) => (
              <li
                key={item.telefone}
                className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.nome}</span>
                  <span className="block truncate text-xs text-slate-400 dark:text-slate-500">+{item.telefone}</span>
                </span>
                <button
                  onClick={() => actions.removerItem('contatosNotificacao', item.telefone)}
                  title={`Remover ${item.nome}`}
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
