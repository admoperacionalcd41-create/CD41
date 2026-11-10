import React, { useState } from 'react';
import { X, Ban } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { boxVisivelNoFiltro } from '../../utils/boxLogic';
import { planoDevolucaoPaletes } from '../../utils/selectors';

// Cancelamento de protocolo de carregamento (a loja recusou a carga, por
// exemplo): pergunta pra qual box os paletes devem voltar. O box de origem
// muitas vezes já foi reaproveitado e não tem vagas — aqui cada box mostra
// quantas vagas livres tem e os que não comportam a carga ficam desabilitados.
export default function CancelarProtocoloModal({ protocolo, loja, aoFechar }) {
  const { state, actions, filtroTipoCarga } = useApp();

  const opcoes = state.boxes
    .filter((b) => b.numero === protocolo.boxNumero || boxVisivelNoFiltro(b, filtroTipoCarga))
    .map((b) => ({ box: b, ...planoDevolucaoPaletes(protocolo, loja, state.boxes, b.numero) }));

  const original = opcoes.find((o) => o.box.numero === protocolo.boxNumero);
  const originalServe = original && original.disponiveis >= original.necessario;
  const [destino, setDestino] = useState(originalServe ? String(protocolo.boxNumero) : '');
  const [erroLocal, setErroLocal] = useState('');

  const enviados = protocolo.paletesEnviados;

  function confirmar() {
    if (!destino) {
      setErroLocal('Selecione o box para onde os paletes vão voltar.');
      return;
    }
    const escolhido = opcoes.find((o) => o.box.numero === Number(destino));
    if (!escolhido || escolhido.disponiveis < escolhido.necessario) {
      setErroLocal(`${escolhido?.box.nome || 'Esse box'} não tem vagas livres suficientes.`);
      return;
    }
    actions.cancelarProtocolo(protocolo.id, Number(destino));
    aoFechar();
  }

  const escolhido = opcoes.find((o) => String(o.box.numero) === destino);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-label="Cancelar protocolo"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Ban size={16} /> Cancelar protocolo
          </h3>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Loja <strong>{loja.loja}</strong> — {loja.nomeLoja}. Os <strong>{enviados} palete{enviados !== 1 ? 's' : ''}</strong>{' '}
          voltam para <strong>Em Carregamento</strong>. Para qual box eles devem retornar?
        </p>

        <label htmlFor="box-devolucao" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Box de retorno dos paletes
        </label>
        <select
          id="box-devolucao"
          value={destino}
          onChange={(e) => {
            setDestino(e.target.value);
            setErroLocal('');
          }}
          className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        >
          <option value="">Selecione...</option>
          {opcoes.map((o) => {
            const insuficiente = o.disponiveis < o.necessario;
            return (
              <option key={o.box.numero} value={o.box.numero} disabled={insuficiente}>
                {o.box.nome}
                {o.box.numero === protocolo.boxNumero ? ' (original)' : ''} — {o.disponiveis} vaga
                {o.disponiveis !== 1 ? 's' : ''} livre{o.disponiveis !== 1 ? 's' : ''}
                {insuficiente ? ' (insuficiente)' : ''}
              </option>
            );
          })}
        </select>

        {!originalServe && original && (
          <p className="mb-1 text-xs text-amber-600 dark:text-amber-400">
            O {original.box.nome} (de origem) não tem vagas livres suficientes ({original.disponiveis} de {original.necessario}).
          </p>
        )}
        {escolhido?.mudaDeBox && escolhido.necessario > enviados && (
          <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
            Como a loja ainda tem {escolhido.necessario - enviados} palete(s) no box atual, ela inteira muda para o{' '}
            {escolhido.box.nome} ({escolhido.necessario} no total).
          </p>
        )}
        {erroLocal && <p className="mb-2 text-xs font-medium text-red-500">{erroLocal}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={confirmar}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Cancelar protocolo
          </button>
        </div>
      </div>
    </div>
  );
}
