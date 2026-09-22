import React, { useMemo, useState } from 'react';
import { PackagePlus, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getVagasDisponiveisCount, BOX_NUMBERS, getTotalVagas, getNomeBox } from '../../utils/boxLogic';
import { getTipoCarga, lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

export default function GroupingForm() {
  const { state, actions, filtroTipoCarga } = useApp();
  const [lojaId, setLojaId] = useState('');
  const [boxNumero, setBoxNumero] = useState('');
  const [quantidade, setQuantidade] = useState('');

  const lojasPendentes = useMemo(
    () => state.lojas.filter((l) => l.status === 'pendente' && lojaPassaFiltroTipoCarga(l, filtroTipoCarga)),
    [state.lojas, filtroTipoCarga]
  );

  const lojaSelecionada = state.lojas.find((l) => l.id === lojaId) || null;

  function selecionarLoja(id) {
    setLojaId(id);
    const loja = state.lojas.find((l) => l.id === id);
    setQuantidade(loja && loja.paletesPlanejados > 0 ? String(loja.paletesPlanejados) : '');
  }

  function limparFormulario() {
    setLojaId('');
    setBoxNumero('');
    setQuantidade('');
  }

  function enviar(e) {
    e.preventDefault();
    if (!lojaId || !boxNumero || !quantidade) return;
    actions.apontarBox({
      lojaId,
      boxNumero: Number(boxNumero),
      quantidadePaletes: Number(quantidade),
    });
    limparFormulario();
  }

  const qtdNum = Number(quantidade) || 0;

  return (
    <form
      onSubmit={enviar}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <PackagePlus size={16} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Apontamento de Box</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Etapa 1 — reserva rápida das vagas antes da conferência física</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] lg:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Carga / Loja pendente</label>
          <select
            value={lojaId}
            onChange={(e) => selecionarLoja(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Selecione...</option>
            {lojasPendentes.map((l) => (
              <option key={l.id} value={l.id}>
                [{getTipoCarga(l.tipoCarga).texto}] {l.carga} • Loja {l.loja} — {l.nomeLoja}
                {l.paletesPlanejados > 0
                  ? ` (${l.paletesPlanejados} pal.)`
                  : l.peso != null
                    ? ` (${l.peso}kg / ${l.volume ?? '?'}m³)`
                    : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Paletes (estimado)</label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Box</label>
          <select
            value={boxNumero}
            onChange={(e) => setBoxNumero(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Selecione...</option>
            {BOX_NUMBERS.map((n) => {
              const box = state.boxes.find((b) => b.numero === n);
              const disponiveis = getVagasDisponiveisCount(box);
              const insuficiente = qtdNum > 0 && disponiveis < qtdNum;
              return (
                <option key={n} value={n} disabled={insuficiente}>
                  {getNomeBox(n)} — {disponiveis}/{getTotalVagas(n)} livres{insuficiente ? ' (insuficiente)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <button
          type="submit"
          disabled={!lojaId || !boxNumero || !quantidade}
          className="flex items-center justify-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
        >
          <PackagePlus size={15} />
          Apontar Box
        </button>
      </div>

      {lojasPendentes.length === 0 && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">Nenhuma loja pendente. Importe dados primeiro.</p>
      )}

      {lojaSelecionada && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-700/40 dark:text-slate-400">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <div className="space-y-1">
            <TipoCargaBadge tipo={lojaSelecionada.tipoCarga} />
            {(lojaSelecionada.deposito || lojaSelecionada.peso != null || lojaSelecionada.volume != null) && (
              <p>
                {lojaSelecionada.deposito && <>Depósito: <strong>{lojaSelecionada.deposito}</strong> • </>}
                {lojaSelecionada.peso != null && <>Peso: <strong>{lojaSelecionada.peso} kg</strong> • </>}
                {lojaSelecionada.volume != null && <>Volume: <strong>{lojaSelecionada.volume} m³</strong></>}
              </p>
            )}
            <p>
              As vagas serão ocupadas em ordem crescente (1, 2, 3...). No início do agrupamento você
              informa apenas os colaboradores; a quantidade só é reconferida (geralmente menor) ao
              concluir, quando as vagas são realocadas de trás para frente no mesmo box.
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
