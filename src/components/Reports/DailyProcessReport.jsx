import React, { useMemo } from 'react';
import { ListChecks, CheckCircle2, XCircle, ArrowUpDown } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getLinhasProcessoDoDia } from '../../utils/selectors';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

const ROTULO_TIPO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

// Selo de status (Geração de Carga / Cargas no Box / Carregamento) dentro
// da tabela — pedido do usuário: validar só pela LOJA (feito/pendente),
// sem mostrar nada de carga (antes, uma loja com mais de uma carga no dia
// mostrava a contagem "(2/3)" e o status de cada carga separadamente).
// `rotuloFeito`/`rotuloPendente` permitem reaproveitar o mesmo selo com um
// texto diferente na coluna "Cargas no Box" (ver abaixo).
function Selo({ feito, rotuloFeito = 'Feito', rotuloPendente = 'Pendente' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        feito
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-400 dark:bg-slate-900/40 dark:text-slate-500'
      }`}
    >
      {feito ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {feito ? rotuloFeito : rotuloPendente}
    </span>
  );
}

export default function DailyProcessReport() {
  const {
    state,
    actions,
    filtroTipoCarga,
    modoSequenciaProcessoDia: modoSequencia,
    setModoSequenciaProcessoDia: setModoSequencia,
  } = useApp();
  const rotuloTipo = ROTULO_TIPO[filtroTipoCarga] || ROTULO_TIPO.todos;

  // Pedido do usuário: "opção pra permitir o sequenciamento das lojas" —
  // um modo à parte, opcional (não substitui o agrupamento padrão
  // pendente/completo, que continua sendo a visão default ao abrir a aba).
  // O estado em si (modoSequenciaProcessoDia) mora no AppProvider, não aqui
  // como useState local — pedido do usuário: precisa continuar ativo ao
  // trocar de aba e voltar, e esse componente é desmontado nesse momento
  // (ver AppContext.jsx).

  // A lógica de montar essa lista (uma linha por código de loja, sempre com
  // as lojas fixas do histórico, geração de carga/carregamento validados só pra
  // hoje de verdade) mora em getLinhasProcessoDoDia (selectors.js) — foi
  // extraída de lá pra poder ser reaproveitada também no card de resumo
  // operacional da aba Box / Frota, sem duplicar essa regra em dois
  // lugares.
  const linhas = useMemo(
    () => getLinhasProcessoDoDia(state, filtroTipoCarga),
    [state.lojas, state.protocolos, state.diaAtual, filtroTipoCarga]
  );

  const total = linhas.length;
  const comApontamento = linhas.filter((l) => l.apontamentoFeito).length;
  const comCargaNoBox = linhas.filter((l) => l.cargaNoBox).length;
  const comCarregamento = linhas.filter((l) => l.carregamentoFeito).length;
  const completas = linhas.filter((l) => l.completo).length;

  // Não agrupa mais por praça/cidade (`nomeLoja`) — o pedido foi tirar essa
  // organização. Em vez disso, separa só em duas faixas visuais (o que
  // ainda falta x o que já foi concluído), já que `linhas` vem ordenada
  // assim (pendente primeiro — ver sort no useMemo acima): uma cabeceira de
  // seção com contagem marca a virada entre as duas faixas, o suficiente
  // pra escanear rápido uma lista longa sem reintroduzir agrupamento por
  // localização.
  const pendentes = linhas.filter((l) => !l.completo);
  const concluidas = linhas.filter((l) => l.completo);

  // Modo sequência: lista única (sem a separação pendente/completo),
  // ordenada primeiro pela ordem salva em state.sequenciaLojas — lojas
  // ainda não sequenciadas (nunca arrastadas, ou novas desde a última vez)
  // entram depois, na ordem padrão de `linhas`.
  const linhasSequenciadas = useMemo(() => {
    if (!modoSequencia) return [];
    const porCodigo = new Map(linhas.map((l) => [l.codigo, l]));
    const ordem = (state.sequenciaLojas || []).filter((codigo) => porCodigo.has(codigo));
    const sequenciadas = ordem.map((codigo) => porCodigo.get(codigo));
    const restantes = linhas.filter((l) => !ordem.includes(l.codigo));
    return [...sequenciadas, ...restantes];
  }, [modoSequencia, linhas, state.sequenciaLojas]);

  function moverSequencia(indiceAtual, indiceNovo) {
    if (indiceNovo < 0 || indiceNovo >= linhasSequenciadas.length || indiceNovo === indiceAtual) return;
    const novaOrdem = linhasSequenciadas.map((l) => l.codigo);
    const [codigo] = novaOrdem.splice(indiceAtual, 1);
    novaOrdem.splice(indiceNovo, 0, codigo);
    actions.definirSequenciaLojas(novaOrdem);
  }

  // Pedido do usuário: trocar o arrastar-e-soltar por um campo de número —
  // com muitas lojas (31+), arrastar de uma ponta à outra da lista ficou
  // lento; digitar a posição desejada resolve isso num passo só. `indice`
  // é a posição atual (base 0) da linha sendo editada; `valorDigitado` é o
  // texto bruto do campo (1-based, como mostrado pro usuário).
  function aplicarPosicaoDigitada(indice, valorDigitado) {
    const numero = parseInt(valorDigitado, 10);
    if (!Number.isFinite(numero)) return;
    const indiceNovo = Math.min(Math.max(numero, 1), linhasSequenciadas.length) - 1;
    moverSequencia(indice, indiceNovo);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-totvs-600 dark:text-whatsapp-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Processo do Dia — {rotuloTipo}</h2>
            {/* Pedido do usuário: "Dia operacional: DD/MM/AAAA" ocultado em
                todas as abas (inclusive aqui, que tinha essa mesma data no
                início da legenda) — o resto da explicação continua, só
                reescrita pra começar sozinha com letra maiúscula. */}
            <p className="text-xs text-slate-400 dark:text-slate-500">
              A coluna Loja traz sempre as lojas fixas (todo código já visto em alguma importação), mesmo sem carga
              hoje; as colunas Geração de Carga e Carregamento validam só o que foi feito hoje de verdade (registros de
              dias anteriores não contam). Cargas no Box é diferente: mostra se tem carga ocupando o box AGORA, mesmo
              que tenha entrado lá num dia anterior e ainda não tenha sido carregada
            </p>
          </div>
        </div>

        {/* Pedido do usuário: opção pra sequenciar as lojas — modo à parte,
            opcional; não substitui a separação padrão pendente/completo,
            que continua sendo a visão default. Era por arrastar e soltar,
            trocado por campo de número a pedido do usuário (arrastar ficou
            lento com a lista grande). */}
        <button
          type="button"
          onClick={() => setModoSequencia((v) => !v)}
          title={
            modoSequencia
              ? 'Voltar pra visão padrão (pendente / completo)'
              : 'Organizar a ordem das lojas digitando a posição de cada uma'
          }
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            modoSequencia
              ? 'border-totvs-300 bg-totvs-50 text-totvs-700 dark:border-whatsapp-600 dark:bg-whatsapp-500/10 dark:text-whatsapp-300'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700/40'
          }`}
        >
          <ArrowUpDown size={14} />
          {modoSequencia ? 'Modo sequência (ativo)' : 'Sequenciar lojas'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Geração de carga feita</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {comApontamento} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {total}</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Com carga no box</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {comCargaNoBox} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {total}</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Carregamento feito</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">
            {comCarregamento}{' '}
            <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {total}</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/30">
          <p className="text-xs text-slate-400 dark:text-slate-500">Processo completo</p>
          <p
            className={`mt-0.5 text-xl font-bold ${
              total > 0 && completas === total ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {completas} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {total}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-700">
        {total === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhuma loja de {rotuloTipo.toLowerCase()} programada para o dia operacional atual ainda. Importe os dados na
            aba Importar Dados.
          </p>
        ) : modoSequencia ? (
          // Modo sequência (opcional, à parte): lista única (sem separar
          // pendente/completo) em que cada linha tem um campo de posição
          // (número). Pedido do usuário: era por arrastar-e-soltar, mas com
          // 31+ lojas arrastar de uma ponta à outra da lista ficou lento —
          // trocado por digitar a posição desejada, que resolve isso num
          // passo só (ver aplicarPosicaoDigitada acima). A ordem fica salva
          // em state.sequenciaLojas e é reaplicada nos próximos dias.
          <div>
            <p className="mb-3 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
              Digite a posição desejada (1 a {linhasSequenciadas.length}) e pressione Enter ou clique fora do campo. A
              ordem é salva automaticamente e vale pros próximos dias também — lojas novas entram no fim da lista até
              serem organizadas.
            </p>
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="w-16 py-2.5 pl-3 pr-1 font-semibold">Posição</th>
                    <th className="py-2.5 pr-3 font-semibold">Loja</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Geração de Carga</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Cargas no Box</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Carregamento</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasSequenciadas.map((loja, indice) => (
                    <tr
                      key={loja.codigo}
                      className={`border-b border-slate-50 last:border-0 dark:border-slate-700/60 ${
                        indice % 2 === 1
                          ? 'bg-slate-50/60 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      <td className="py-2 pl-3 pr-1">
                        {/* key com o índice força o campo a remontar (e
                            mostrar o valor atualizado) depois de qualquer
                            reordenação — sem isso, um input não-controlado
                            ficaria com o número antigo na tela. */}
                        <input
                          key={`${loja.codigo}-${indice}`}
                          type="number"
                          min={1}
                          max={linhasSequenciadas.length}
                          defaultValue={indice + 1}
                          onBlur={(e) => aplicarPosicaoDigitada(indice, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                          className="w-14 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-center text-xs font-bold text-slate-700 focus:border-totvs-400 focus:outline-none focus:ring-1 focus:ring-totvs-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-whatsapp-500 dark:focus:ring-whatsapp-500"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{loja.codigo}</span>
                          <span className="text-slate-500 dark:text-slate-400">{loja.nomeLoja}</span>
                          {loja.tiposCarga.map((tipo) => (
                            <TipoCargaBadge key={tipo} tipo={tipo} />
                          ))}
                          {loja.cargas.length === 0 && (
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                              Sem carga hoje
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Selo feito={loja.apontamentoFeito} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Selo feito={loja.cargaNoBox} rotuloFeito="No box" rotuloPendente="Vazio" />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Selo feito={loja.carregamentoFeito} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Pedido do usuário: melhor visualização, validando só pela LOJA
          // (sem mostrar nada de carga), em formato de tabela — chegou a
          // virar um grid de cartões, mas o pedido seguinte foi voltar pra
          // tabela; o que ficou da passagem pelos cards foi tirar de vez o
          // detalhe por carga (número de carga, contagem "(2/3)", status
          // individual de cada carga), que não volta aqui.
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-100 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              {/* Cabeçalho fixo (sticky) — com uma lista de 28+ lojas rolando
                  dentro do card, vale sempre poder ver o nome das colunas
                  sem precisar voltar pro topo. */}
              <thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 pl-3 pr-3 font-semibold">Loja</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Geração de Carga</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Cargas no Box</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Carregamento</th>
                </tr>
              </thead>
              {[
                { chave: 'pendentes', rotulo: 'Ainda pendente', itens: pendentes },
                { chave: 'concluidas', rotulo: 'Processo completo', itens: concluidas },
              ]
                .filter((secao) => secao.itens.length > 0)
                .map((secao) => (
                  <tbody key={secao.chave}>
                    {/* Sem mais agrupamento por praça/cidade — só essa
                        cabeceira de seção (pendente x completo) pra separar
                        visualmente o que precisa de atenção do que já foi
                        resolvido, já que a lista inteira normalmente não
                        cabe numa tela só. */}
                    <tr>
                      <td
                        colSpan={4}
                        className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                          secao.chave === 'pendentes'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        }`}
                      >
                        {secao.rotulo} ({secao.itens.length})
                      </td>
                    </tr>
                    {secao.itens.map((loja, indice) => (
                      <tr
                        key={loja.codigo}
                        className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-700/30 ${
                          indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-900/20' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-3 pr-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{loja.codigo}</span>
                            <span className="text-slate-500 dark:text-slate-400">{loja.nomeLoja}</span>
                            {loja.tiposCarga.map((tipo) => (
                              <TipoCargaBadge key={tipo} tipo={tipo} />
                            ))}
                            {/* Um aviso de "sem carga hoje" ainda é
                                informação da LOJA (não de uma carga
                                específica), então continua aqui — só a
                                numeração/contagem de carga é que não
                                aparece mais. */}
                            {loja.cargas.length === 0 && (
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                Sem carga hoje
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Selo feito={loja.apontamentoFeito} />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Selo feito={loja.cargaNoBox} rotuloFeito="No box" rotuloPendente="Vazio" />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Selo feito={loja.carregamentoFeito} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
