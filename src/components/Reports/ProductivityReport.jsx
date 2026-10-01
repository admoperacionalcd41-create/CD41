import React, { useMemo } from 'react';
import { BarChart3, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getLojasAgrupadasOuAlem } from '../../utils/selectors';
import { lojaPassaFiltroTipoCarga } from '../../utils/tipoCarga';

// Formata contagem de paletes no padrão pt-BR, com até 1 casa decimal —
// necessário porque, ao dividir os paletes de uma loja entre os
// colaboradores que a agruparam, o resultado por pessoa costuma ser
// fracionário (ex.: 10 paletes ÷ 2 agrupadores = 5, mas 10 ÷ 3 = 3,3).
function formatarPaletes(valor) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// `periodoRelatorio` vem de ReportsPage (hook usePeriodoRelatorio
// compartilhado pelos três relatórios com filtro de período) — assim o
// mesmo período selecionado vale tanto pra tela quanto pra Exportar
// Excel/Imprimir (ver ReportsPage.jsx e exportExcel.js).
export default function ProductivityReport({ periodoRelatorio }) {
  // O filtro Seca/Resfriada é global agora (seletor no cabeçalho — ver
  // Header.jsx), válido em todas as abas.
  const { state, filtroTipoCarga } = useApp();
  const { periodo, mesEscolhido, passaPeriodo } = periodoRelatorio;
  // Valor pago por palete agrupado, cadastrado na aba Cadastros (ver
  // ValoresConfigCard.jsx) — com um padrão de segurança caso o estado ainda
  // não tenha esse campo (estado salvo antes dele existir).
  const valorPorPalete = Number(state.valorPaletesAgrupamento) || 0.58;

  const lojasConsideradas = useMemo(() => {
    let base = getLojasAgrupadasOuAlem(state);
    base = base.filter((l) => passaPeriodo(l.dataAgrupamento || l.dataInicioAgrupamento));
    base = base.filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, periodo, mesEscolhido, filtroTipoCarga]);

  const estatisticasPorColaborador = useMemo(() => {
    const mapa = new Map();
    lojasConsideradas.forEach((loja) => {
      const paletes = loja.paletesNoAgrupamento || loja.paletesAgrupados || 0;
      const colaboradoresDaLoja = loja.colaboradores.filter(Boolean);
      if (colaboradoresDaLoja.length === 0) return;
      // Os paletes da loja são divididos igualmente entre todos os
      // colaboradores que participaram do agrupamento — ex.: 10 paletes com
      // 2 agrupadores conta 5 paletes para cada um, não 10 para cada.
      const paletesPorColaborador = paletes / colaboradoresDaLoja.length;
      colaboradoresDaLoja.forEach((nome) => {
        const atual = mapa.get(nome) || { nome, lojas: 0, paletes: 0 };
        atual.lojas += 1;
        atual.paletes += paletesPorColaborador;
        mapa.set(nome, atual);
      });
    });
    return [...mapa.values()].sort((a, b) => b.paletes - a.paletes);
  }, [lojasConsideradas]);

  const maiorValor = Math.max(1, ...estatisticasPorColaborador.map((c) => c.paletes));
  const totalLojasAgrupadas = lojasConsideradas.length;
  const totalPaletes = estatisticasPorColaborador.reduce((soma, c) => soma + c.paletes, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-brand-600 dark:text-brand-400" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Produtividade por Colaborador</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Lojas agrupadas consideradas</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{totalLojasAgrupadas}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Colaboradores envolvidos</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{estatisticasPorColaborador.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total de paletes agrupados (créditos)</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{formatarPaletes(totalPaletes)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <Users size={16} className="text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Ranking de Paletes por Colaborador</h3>
        </div>

        {estatisticasPorColaborador.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum dado de produtividade no período selecionado.</p>
        ) : (
          <div className="space-y-3">
            {estatisticasPorColaborador.map((c) => (
              <div key={c.nome} className="flex items-center gap-3">
                <span className="w-32 flex-shrink-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {c.nome}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(c.paletes / maiorValor) * 100}%` }}
                  />
                </div>
                <span className="w-28 flex-shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                  {formatarPaletes(c.paletes)} pal. • {c.lojas} loja{c.lojas !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Detalhamento</h3>
          {/* Observação "Valor por palete agrupado: R$ 0,58" ocultada a
              pedido — o valor (cadastrado na aba Cadastros, ver
              ValoresConfigCard.jsx) continua sendo usado no cálculo da
              coluna "Valor" da tabela abaixo, só não aparece mais aqui. */}
        </div>
        {estatisticasPorColaborador.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados para exibir.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold">Colaborador</th>
                  <th className="py-2 pr-3 font-semibold">Lojas Atendidas</th>
                  <th className="py-2 pr-3 font-semibold">Total de Paletes</th>
                  <th className="py-2 pr-3 font-semibold">Média Paletes/Loja</th>
                  <th className="py-2 pr-3 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {estatisticasPorColaborador.map((c) => (
                  <tr key={c.nome} className="border-b border-slate-50 last:border-0 dark:border-slate-700/60">
                    <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">{c.nome}</td>
                    <td className="py-2 pr-3">{c.lojas}</td>
                    <td className="py-2 pr-3">{formatarPaletes(c.paletes)}</td>
                    <td className="py-2 pr-3">{formatarPaletes(c.paletes / c.lojas)}</td>
                    <td className="py-2 pr-3 font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatarMoeda(c.paletes * valorPorPalete)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
