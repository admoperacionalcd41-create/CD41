import React, { useState } from 'react';
import { DollarSign, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

// Cadastro de valores usados em cálculos do sistema — hoje só o valor pago
// por palete agrupado (usado no relatório de Produtividade pra calcular
// quanto cada colaborador "gerou" no período), mas a mesma estrutura serve
// pra outros valores que futuramente precisem ser configuráveis sem mexer
// em código (ex.: reajuste anual).
export default function ValoresConfigCard() {
  const { state, actions } = useApp();
  const valorAtual = Number(state.valorPaletesAgrupamento) || 0.58;
  // Texto editável em formato livre (aceita vírgula, como o operador
  // digitaria "0,58") — convertido pra número só ao salvar.
  const [valorDigitado, setValorDigitado] = useState(() => String(valorAtual).replace('.', ','));
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  function salvar(e) {
    e.preventDefault();
    const numero = Number(valorDigitado.replace(',', '.').trim());
    if (!Number.isFinite(numero) || numero < 0) {
      setErro('Informe um valor válido (ex.: 0,58).');
      return;
    }
    actions.definirValorPaleteAgrupamento(numero);
    setValorDigitado(String(numero).replace('.', ','));
    setErro('');
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <DollarSign size={16} className="text-brand-600 dark:text-brand-400" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Valores</h2>
      </div>

      <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
        Usado no relatório de <strong>Produtividade</strong> para calcular o valor gerado por cada
        colaborador (total de paletes agrupados × valor por palete). Altere aqui quando houver reajuste —
        não precisa mexer em código.
      </p>

      <form onSubmit={salvar} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Agrupamento por Palete (R$)
          </label>
          <input
            value={valorDigitado}
            onChange={(e) => {
              setValorDigitado(e.target.value);
              setErro('');
            }}
            inputMode="decimal"
            placeholder="0,58"
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
        <button
          type="submit"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Check size={14} /> Salvar
        </button>
      </form>
      {erro && <p className="mt-2 text-xs font-medium text-red-500">{erro}</p>}
      {salvo && <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">Valor salvo!</p>}
    </div>
  );
}
