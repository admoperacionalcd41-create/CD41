import React, { useMemo } from 'react';
import { Target, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getCodigosEntreguesNaData, getCodigosLojaNoPeriodo, getEntregaCodigoLojaNaData } from '../../utils/selectors';
import { getDiasUteisSemanaAtual, formatarDiaSemanaCurto, formatarData, hojeISO } from '../../utils/dateHelpers';

// Meta operacional: todas as 28 lojas devem sair do CD em cada dia útil.
// Um envio parcial (fica saldo, aguardando novo carregamento) já conta como
// "atendida no dia" — o que importa aqui é ter saído carga naquele dia,
// mesmo que não tenha fechado a loja inteira de uma vez. Pensado para ser
// um resumo simples e visual, fácil de olhar rápido ou enviar print pra
// diretoria — sem termos técnicos do sistema, só o que importa: meta x
// realizado. O relatório respeita o filtro Seca/Resfriada do cabeçalho:
// mostra os números do tipo selecionado (ou dos dois tipos somados, com
// "Todos").
const META_DIARIA = 28;

const ROTULO_TIPO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

function corPorPercentual(pct) {
  if (pct >= 100) {
    return {
      barra: 'bg-emerald-500',
      texto: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-50 text-emerald-700 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }
  if (pct >= 60) {
    return {
      barra: 'bg-amber-500',
      texto: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-50 text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300',
    };
  }
  return {
    barra: 'bg-red-500',
    texto: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-50 text-red-700 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300',
  };
}

export default function DailyGoalReport() {
  const { state, filtroTipoCarga } = useApp();
  const hoje = hojeISO();
  // "todos" vira `undefined` pros seletores — eles já tratam ausência de
  // tipo como "considera os dois tipos juntos".
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;
  const rotuloTipo = ROTULO_TIPO[filtroTipoCarga] || ROTULO_TIPO.todos;

  const dias = useMemo(() => {
    return getDiasUteisSemanaAtual().map((dataISO) => {
      // Conta lojas distintas com QUALQUER protocolo naquele dia (completo
      // ou parcial/saldo) — um envio parcial já é considerado "atendido"
      // no dia, mesmo que a loja continue com saldo pendente.
      const entregues = getCodigosEntreguesNaData(state, dataISO, tipo);
      const pct = Math.min(100, Math.round((entregues / META_DIARIA) * 100));
      return { dataISO, entregues, pct, hoje: dataISO === hoje, futuro: dataISO > hoje };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hoje, tipo]);

  const diaDeHoje = dias.find((d) => d.hoje);
  // Só entram na média da semana os dias que já passaram (ou hoje) — os dias
  // futuros ainda não têm como ter entregas, então não devem "puxar pra
  // baixo" o aproveitamento mostrado à diretoria antes da semana terminar.
  const diasDecorridos = dias.filter((d) => !d.futuro);
  const totalDecorrido = diasDecorridos.reduce((soma, d) => soma + d.entregues, 0);
  const metaDecorrida = META_DIARIA * diasDecorridos.length;
  const pctSemana = metaDecorrida > 0 ? Math.min(100, Math.round((totalDecorrido / metaDecorrida) * 100)) : 0;
  const metaSemanaCompleta = META_DIARIA * dias.length;

  // Análise individual: a meta não é só bater 28 entregas por dia — é as
  // MESMAS 28 lojas saindo TODOS os dias em que estavam programadas. Por
  // isso, em vez de contar "dias que bateram a meta", olhamos loja a loja:
  // em quantos dias úteis em que ela tinha carga programada ela realmente
  // teve ALGUM carregamento registrado (completo OU parcial/saldo — um
  // envio parcial já conta como "entregou no dia", mesmo que a loja
  // continue com saldo pendente pra outro dia) — e, nos dias entregues,
  // quantos paletes efetivamente saíram. Um dia sem nenhuma atividade
  // daquela loja (ainda não importada, e sem protocolo naquele dia) não
  // conta nem a favor nem contra — não dá pra cobrar entrega de algo que
  // nem chegou a ser programado.
  const diasISO = dias.map((d) => d.dataISO);
  const analisePorLoja = useMemo(() => {
    const codigos = getCodigosLojaNoPeriodo(state, diasISO, tipo);
    return codigos
      .map(({ codigo, nomeLoja }) => {
        const porDia = dias.map((d) => {
          if (d.futuro) return { dataISO: d.dataISO, status: 'futuro' };
          const { temAtividade, entregue, paletes, parcial } = getEntregaCodigoLojaNaData(state, codigo, d.dataISO, tipo);
          if (!temAtividade) return { dataISO: d.dataISO, status: 'sem_dado' };
          if (entregue) return { dataISO: d.dataISO, status: 'entregue', paletes, parcial };
          return { dataISO: d.dataISO, status: 'faltou' };
        });
        const diasEntregues = porDia.filter((p) => p.status === 'entregue').length;
        const diasAvaliados = porDia.filter((p) => p.status === 'entregue' || p.status === 'faltou').length;
        const completo = diasAvaliados > 0 && diasEntregues === diasAvaliados;
        return { codigo, nomeLoja, porDia, diasEntregues, diasAvaliados, completo };
      })
      .sort((a, b) => {
        // Lojas com mais faltas aparecem primeiro, pra chamar atenção logo de cara.
        const faltasA = a.diasAvaliados - a.diasEntregues;
        const faltasB = b.diasAvaliados - b.diasEntregues;
        if (faltasA !== faltasB) return faltasB - faltasA;
        return a.codigo.localeCompare(b.codigo);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, diasISO.join(','), tipo]);

  const lojasComEntregaCompleta = analisePorLoja.filter((l) => l.completo).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Meta de Entrega — {rotuloTipo}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Meta: {META_DIARIA} lojas entregues por dia útil (segunda a sexta) — filtro do cabeçalho: {rotuloTipo}
            </p>
          </div>
        </div>
        {diaDeHoje && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${corPorPercentual(diaDeHoje.pct).badge}`}>
            Hoje: {diaDeHoje.entregues}/{META_DIARIA} ({diaDeHoje.pct}%)
          </span>
        )}
      </div>

      {diaDeHoje ? (
        <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50/60 p-5 text-center dark:border-slate-700 dark:bg-slate-900/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Hoje — {formatarData(hoje)}
          </p>
          <p className={`mt-1 text-5xl font-black ${corPorPercentual(diaDeHoje.pct).texto}`}>
            {diaDeHoje.entregues}
            <span className="text-2xl text-slate-300 dark:text-slate-600">/{META_DIARIA}</span>
          </p>
          <div className="mx-auto mt-3 h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={`h-full rounded-full ${corPorPercentual(diaDeHoje.pct).barra}`}
              style={{ width: `${diaDeHoje.pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {diaDeHoje.entregues >= META_DIARIA
              ? 'Meta do dia batida!'
              : `Faltam ${META_DIARIA - diaDeHoje.entregues} loja${
                  META_DIARIA - diaDeHoje.entregues !== 1 ? 's' : ''
                } para bater a meta de hoje.`}
          </p>
        </div>
      ) : (
        <div className="mb-5 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-500">
          Hoje é fim de semana — a meta diária vale de segunda a sexta.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {dias.map((d) => {
          const cor = corPorPercentual(d.pct);
          return (
            <div
              key={d.dataISO}
              className={`rounded-lg border p-3 text-center ${
                d.hoje
                  ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/10'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {formatarDiaSemanaCurto(d.dataISO)}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatarData(d.dataISO)}</p>
              <p className={`mt-1.5 text-2xl font-black ${d.futuro ? 'text-slate-300 dark:text-slate-600' : cor.texto}`}>
                {d.entregues}
                <span className="text-xs font-semibold text-slate-300 dark:text-slate-600">/{META_DIARIA}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full ${d.futuro ? 'bg-slate-200 dark:bg-slate-600' : cor.barra}`}
                  style={{ width: `${d.futuro ? 0 : d.pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex h-3.5 items-center justify-center">
                {!d.futuro && d.entregues >= META_DIARIA && (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 dark:border-slate-700 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Entregue até agora na semana</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {totalDecorrido} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {metaDecorrida}</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Aproveitamento da semana</p>
          <p className={`mt-0.5 text-xl font-bold ${corPorPercentual(pctSemana).texto}`}>{pctSemana}%</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Lojas com entrega completa</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {lojasComEntregaCompleta}{' '}
            <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {analisePorLoja.length}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-300 dark:text-slate-600">
        Meta da semana completa (seg a sex): {metaSemanaCompleta} lojas
      </p>

      <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-700">
        <h3 className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">Análise por Loja — Semana Atual</h3>
        <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
          Cada loja precisa sair do CD todos os dias úteis. O número é a quantidade de paletes entregues no dia (em{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-400">âmbar com *</span> quando o envio foi
          parcial e ficou saldo); um X vermelho marca falta. As linhas com falta aparecem primeiro.
        </p>

        {analisePorLoja.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma loja de {rotuloTipo.toLowerCase()} registrada nesta semana ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold">Loja</th>
                  {dias.map((d) => (
                    <th key={d.dataISO} className="px-2 py-2 text-center font-semibold">
                      {formatarDiaSemanaCurto(d.dataISO)}
                    </th>
                  ))}
                  <th className="py-2 pl-3 text-right font-semibold">Semana</th>
                </tr>
              </thead>
              <tbody>
                {analisePorLoja.map((l) => (
                  <tr
                    key={l.codigo}
                    className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${
                      !l.completo && l.diasAvaliados > 0 ? 'bg-red-50/40 dark:bg-red-950/10' : ''
                    }`}
                  >
                    <td className="py-2 pr-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{l.codigo}</span>{' '}
                      <span className="text-slate-400 dark:text-slate-500">{l.nomeLoja}</span>
                    </td>
                    {l.porDia.map((p) => (
                      <td
                        key={p.dataISO}
                        className="px-2 py-2 text-center"
                        title={
                          p.status === 'sem_dado'
                            ? 'Sem carga programada nesse dia'
                            : p.status === 'entregue'
                              ? `${p.paletes} palete${p.paletes !== 1 ? 's' : ''} entregues${
                                  p.parcial ? ' — envio parcial, ficou saldo' : ''
                                }`
                              : undefined
                        }
                      >
                        {p.status === 'entregue' && (
                          <span
                            className={`font-bold ${
                              p.parcial ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {p.paletes}
                            {p.parcial && <span className="align-super text-[9px]">*</span>}
                          </span>
                        )}
                        {p.status === 'faltou' && <XCircle size={14} className="mx-auto text-red-500" />}
                        {(p.status === 'futuro' || p.status === 'sem_dado') && (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2 pl-3 text-right font-semibold">
                      <span className={l.completo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {l.diasEntregues}/{l.diasAvaliados}
                      </span>
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
