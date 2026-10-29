import React, { useMemo, useRef, useState } from 'react';
import { ListChecks, CheckCircle2, XCircle, Camera, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getLinhasProcessoDoDia, getEntregaCodigoLojaNaData, getVolumeExpedicaoHoje } from '../../utils/selectors';
import { getDiasUteisSemana, formatarDiaSemanaCurto, hojeISO } from '../../utils/dateHelpers';
import { getStatusLoja } from '../../utils/statusStyles';
import { getNomeBox } from '../../utils/boxLogic';

const ROTULO_TIPO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

// Formata peso/volume no padrão pt-BR (vírgula decimal, sem casas
// desnecessárias) — mesma regra usada nos cards do Dashboard e no resumo da
// aba Box / Frota.
function formatarNumeroBR(valor) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

// Selo de status (Cargas em Andamento / Carregamento de Hoje) dentro da
// tabela — pedido do usuário: validar só pela LOJA (feito/pendente), sem
// mostrar nada de carga (antes, uma loja com mais de uma carga no dia
// mostrava a contagem "(2/3)" e o status de cada carga separadamente).
// `rotuloFeito`/`rotuloPendente` permitem reaproveitar o mesmo selo com um
// texto diferente em cada coluna. Os nomes internos (apontamentoFeito,
// "Geração de Carga" em selectors.js) continuam os mesmos por baixo — só o
// TERMO exibido pro usuário mudou pra "Expedição de Hoje"/"Carregamento de
// Hoje" (pedido do usuário), mesma lógica já usada em
// ResumoProcessoCard.jsx pra não mexer em dado já persistido.
//
// Pedido do usuário (ship seguinte): na coluna "Cargas em Andamento",
// `rotuloFeito` passou a ser o NOME do box em que a loja está (via
// getNomeBox(loja.boxAtual) — selectors.js), em vez do texto fixo "Em
// andamento" — mostra em qual box procurar a carga, não só que ela está em
// algum lugar.
// Rótulo da coluna "Cargas em Andamento": nome do box e, quando a carga já
// foi agrupada, a quantidade de paletes (ex.: "Box 9 (blocado) · 12 pal.").
function rotuloCargaNoBox(loja) {
  const nome = getNomeBox(loja.boxAtual);
  return loja.paletesNoBox ? `${nome} · ${loja.paletesNoBox} pal.` : nome;
}

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

// Selo da coluna Expedição de Hoje: mostra o status REAL da loja no momento
// (ex.: "Em Execução", "Conferência Finalizada", "Agrupando", "Agrupada") —
// mesmo texto/cor já usados em todo o app pra esse status (ver STATUS_LOJA
// em statusStyles.js). `statusExpedicaoHoje` (selectors.js) já resolve pra
// 'pendente' quando a loja ainda não teve nenhuma carga apontada hoje.
//
// Pedido do usuário (ship seguinte): "tire esses círculos, deixe o mais
// simples possível" — essa coluna tinha muita informação visual (uma
// etiqueta arredondada colorida por linha, igual um badge). Simplificado pra
// só o texto, na cor do status (sem fundo/contorno/formato de pílula) —
// pega só as classes `text-*`/`dark:text-*` de STATUS_LOJA, descartando
// bg-*/border/rounded.
function SeloStatusExpedicao({ status }) {
  const info = getStatusLoja(status);
  const corTexto = info.corBadge
    .split(' ')
    .filter((classe) => classe.startsWith('text-') || classe.startsWith('dark:text-'))
    .join(' ');
  return <span className={`text-[11px] font-semibold ${corTexto}`}>{info.texto}</span>;
}

// Pedido do usuário: depois da coluna Carregamento de Hoje, as mesmas
// colunas Segunda a Sexta + Semana do relatório Meta de Entrega (ver
// DailyGoalReport.jsx — mesma apresentação de célula: número em negrito
// (âmbar com * para envio parcial, verde para completo), X vermelho para
// falta, traço para sem dado/futuro). Componente à parte porque as duas
// tabelas de Processo do Dia (padrão e modo sequência) usam exatamente a
// mesma coluna de células, uma ao lado da outra.
function CelulasSemana({ codigo, porCodigoSemana }) {
  const info = porCodigoSemana.get(codigo);
  if (!info) return null;
  const { porDia, diasEntreguesSemana, diasAvaliadosSemana, semanaCompleta } = info;
  return (
    <>
      {porDia.map((p) => (
        <td
          key={p.dataISO}
          className="px-2 py-1.5 text-center"
          title={
            p.status === 'sem_dado'
              ? 'Sem carga programada nesse dia'
              : p.status === 'entregue'
                ? `${p.paletes} palete${p.paletes !== 1 ? 's' : ''} entregues${p.parcial ? ' — envio parcial, ficou saldo' : ''}`
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
      <td className="py-1.5 pl-3 pr-3 text-right font-semibold">
        {diasAvaliadosSemana > 0 ? (
          <span className={semanaCompleta ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            {diasEntreguesSemana}/{diasAvaliadosSemana}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>
    </>
  );
}

export default function DailyProcessReport() {
  const { state, actions, filtroTipoCarga } = useApp();
  // Pedido do usuário: o "Sequenciar lojas" deixou de ser um modo que se
  // liga e desliga — a lista fica SEMPRE sequenciada (campo de posição em
  // cada loja), sem botão pra desligar e sem a visão separada em
  // pendente/completo. O ramo da visão padrão abaixo ficou sem uso (só
  // alcançável se isto voltar a ser `false`).
  const modoSequencia = true;
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
  // Pedido do usuário: os totalizadores que antes ficavam em cards separados
  // acima da tabela (um pra cada coluna, mais um "Processo completo") foram
  // pro lado do nome de cada coluna correspondente — ver os <th> de
  // Expedição de Hoje e Carregamento de Hoje abaixo. A coluna Cargas em
  // Andamento ficou de fora de propósito (pedido do usuário) e o
  // "Processo completo" foi removido (já aparece na cabeceira de seção da
  // tabela, "Processo completo (N)", então o card isolado ficaria
  // redundante).
  const comApontamento = linhas.filter((l) => l.apontamentoFeito).length;
  const comCarregamento = linhas.filter((l) => l.carregamentoFeito).length;

  // Pedido do usuário: o totalizador do cabeçalho de Expedição de Hoje
  // passou a puxar o volume cúbico (m³) das cargas de hoje — feito x total
  // — em vez da contagem de lojas acima (comApontamento/total). Só por
  // CARGA mesmo (não por código de loja), ver getVolumeExpedicaoHoje em
  // selectors.js. Quando o lote importado não traz volume (temVolume
  // false), cai de volta pra contagem de lojas, pra não mostrar "0/0".
  const volumeExpedicao = useMemo(
    () => getVolumeExpedicaoHoje(state, filtroTipoCarga),
    [state.lojas, state.diaAtual, filtroTipoCarga]
  );

  // Pedido do usuário: card único de resumo no topo, com Expedição de Hoje
  // e Carregamento de Hoje em % — usa a MESMA base de cada totalizador que
  // já aparece no cabeçalho da coluna correspondente (volume em m³ feito x
  // total pra Expedição quando o lote importado traz essa informação, senão
  // cai pra contagem de lojas; sempre contagem de lojas pra Carregamento),
  // só que expressa como percentual em vez de "feito/total".
  const pctExpedicao = volumeExpedicao.temVolume
    ? volumeExpedicao.volumeTotal > 0
      ? Math.round((volumeExpedicao.volumeFeito / volumeExpedicao.volumeTotal) * 100)
      : 0
    : total > 0
    ? Math.round((comApontamento / total) * 100)
    : 0;
  const pctCarregamento = total > 0 ? Math.round((comCarregamento / total) * 100) : 0;

  // Pedido do usuário: botão pra copiar a tela como imagem (área de
  // transferência), só do card de resumo pra baixo — por isso o botão em
  // si fica FORA do elemento referenciado por capturaRef (ver JSX abaixo),
  // senão ele apareceria na própria imagem copiada. html2canvas é
  // carregado sob demanda (import dinâmico) pra não pesar o bundle
  // principal com uma lib que só é usada quando o botão é clicado.
  const capturaRef = useRef(null);
  const [statusCopia, setStatusCopia] = useState('ocioso'); // ocioso | copiando | copiado | baixado | erro

  async function aoCopiarComoImagem() {
    if (!capturaRef.current || statusCopia === 'copiando') return;
    setStatusCopia('copiando');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const temaEscuro = document.documentElement.classList.contains('dark');
      const canvas = await html2canvas(capturaRef.current, {
        backgroundColor: temaEscuro ? '#1e293b' : '#ffffff',
        // Pedido do usuário: aumentar a resolução da imagem copiada — o
        // fator anterior (no máximo 2x, e só 1x na maioria dos monitores
        // comuns, que têm devicePixelRatio 1) saía com texto borrado ao dar
        // zoom ou imprimir a imagem copiada. Agora usa pelo menos 3x
        // sempre, e mais que isso em telas de densidade mais alta (ex.:
        // celulares com devicePixelRatio 3+) — a tabela tem muita linha e
        // coluna, então vale a pena gastar mais memória/tempo aqui pra
        // ganhar nitidez.
        scale: Math.max(3, window.devicePixelRatio || 1),
        useCORS: true,
        // Pedido do usuário (print ruim reportado): o modo padrão de
        // renderização do html2canvas (via <canvas>, redesenhando cada
        // elemento "na mão") não reconhece certos ícones SVG embutidos
        // (confirmado com o XCircle de "faltou" em CelulasSemana abaixo —
        // saía como um glifo vermelho quebrado em vez do X dentro do
        // círculo). `foreignObjectRendering: true` manda o próprio
        // navegador rasterizar o conteúdo via <foreignObject> do SVG, bem
        // suportado no Chrome/Chromium, e resolve esse tipo de ícone sem
        // precisar reescrever cada um à mão.
        foreignObjectRendering: true,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Não foi possível gerar a imagem.');
      if (navigator.clipboard && typeof window.ClipboardItem === 'function') {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        setStatusCopia('copiado');
      } else {
        // Navegador sem suporte a copiar imagem pra área de transferência
        // (ex.: Firefox) — baixa o arquivo em vez de falhar calado.
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `processo-do-dia-${hojeISO()}.png`;
        link.click();
        URL.revokeObjectURL(url);
        setStatusCopia('baixado');
      }
    } catch (erro) {
      console.error('Erro ao copiar Processo do Dia como imagem:', erro);
      setStatusCopia('erro');
    } finally {
      setTimeout(() => setStatusCopia('ocioso'), 2500);
    }
  }

  // Pedido do usuário: depois da coluna Carregamento de Hoje, mostrar o
  // mesmo relatório de Meta de Entrega (DailyGoalReport.jsx) — as colunas de
  // Segunda a Sexta da semana atual, mais uma coluna Semana (dias
  // entregues / dias avaliados), lado a lado com as colunas já existentes
  // aqui. Reaproveita o mesmo seletor usado lá (getEntregaCodigoLojaNaData)
  // em vez de duplicar a lógica de "entregue/faltou/sem dado" — só a
  // apresentação em colunas extras é nova. Diferente de DailyGoalReport
  // (que só lista lojas com carga programada na semana), aqui aparece TODA
  // loja já conhecida (mesma base de `linhas`), então uma loja sem nenhuma
  // atividade na semana mostra "—" em vez de contar como falta (ver
  // diasAvaliadosSemana === 0 abaixo).
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;
  const hoje = hojeISO();
  const diasSemanaAtual = useMemo(() => getDiasUteisSemana(0), []);
  const porCodigoSemana = useMemo(() => {
    const mapa = new Map();
    linhas.forEach((l) => {
      const porDia = diasSemanaAtual.map((dataISO) => {
        const futuro = dataISO > hoje;
        if (futuro) return { dataISO, status: 'futuro' };
        const { temAtividade, entregue, paletes, parcial } = getEntregaCodigoLojaNaData(state, l.codigo, dataISO, tipo);
        if (!temAtividade) return { dataISO, status: 'sem_dado' };
        if (entregue) return { dataISO, status: 'entregue', paletes, parcial };
        return { dataISO, status: 'faltou' };
      });
      const diasEntreguesSemana = porDia.filter((p) => p.status === 'entregue').length;
      const diasAvaliadosSemana = porDia.filter((p) => p.status === 'entregue' || p.status === 'faltou').length;
      const semanaCompleta = diasAvaliadosSemana > 0 && diasEntreguesSemana === diasAvaliadosSemana;
      mapa.set(l.codigo, { porDia, diasEntreguesSemana, diasAvaliadosSemana, semanaCompleta });
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tipo, diasSemanaAtual.join(','), linhas]);

  // Pedido do usuário: totalizador no cabeçalho de cada coluna de dia da
  // semana (Seg a Sex), no mesmo formato "feito/total" das outras colunas —
  // ex.: "Seg 1/28". Conta quantas lojas entregaram naquele dia específico
  // (porDia[].status === 'entregue', já calculado acima em
  // porCodigoSemana), sobre o total de lojas conhecidas (mesmo `total` =
  // linhas.length usado nos outros cabeçalhos), não só as que tinham
  // atividade programada naquele dia.
  const totaisPorDia = useMemo(() => {
    const mapa = new Map();
    diasSemanaAtual.forEach((dataISO) => {
      let entregues = 0;
      porCodigoSemana.forEach((info) => {
        const dia = info.porDia.find((p) => p.dataISO === dataISO);
        if (dia?.status === 'entregue') entregues += 1;
      });
      mapa.set(dataISO, entregues);
    });
    return mapa;
  }, [porCodigoSemana, diasSemanaAtual]);

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

  // Pedido do usuário: texto do botão de copiar como imagem muda conforme
  // o resultado (copiando / copiado / baixado, quando o navegador não
  // suporta copiar imagem direto / erro) — volta pro texto padrão sozinho
  // depois de alguns segundos (ver setTimeout em aoCopiarComoImagem).
  const TEXTO_BOTAO_COPIA = {
    ocioso: 'Copiar como imagem',
    copiando: 'Copiando…',
    copiado: 'Copiado!',
    baixado: 'Imagem baixada',
    erro: 'Erro ao copiar — tente de novo',
  };

  return (
    <>
      {/* Pedido do usuário: botão que copia a tela (do card de resumo pra
          baixo) como imagem pra área de transferência. Fica FORA do
          elemento referenciado por capturaRef de propósito — se estivesse
          dentro, o próprio botão apareceria na imagem copiada. `print:hidden`
          pelo mesmo motivo do lado da impressão (ver imprimirRelatorio.js):
          o botão em si não deve aparecer no papel. */}
      <div className="mb-3 flex justify-end print:hidden">
        <button
          type="button"
          onClick={aoCopiarComoImagem}
          disabled={statusCopia === 'copiando'}
          title="Copia o resumo e a tabela abaixo como uma imagem, pronta pra colar no WhatsApp ou e-mail"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            statusCopia === 'copiado' || statusCopia === 'baixado'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
              : statusCopia === 'erro'
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-500/10 dark:text-red-300'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700/40'
          }`}
        >
          {statusCopia === 'copiando' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : statusCopia === 'copiado' || statusCopia === 'baixado' ? (
            <CheckCircle2 size={14} />
          ) : (
            <Camera size={14} />
          )}
          {TEXTO_BOTAO_COPIA[statusCopia]}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {/* Pedido do usuário: título/explicação/botão "Sequenciar lojas"
            ficam ACIMA do card de resumo agora — e por isso saem tanto da
            imagem copiada quanto do papel (`print:hidden`), já que os
            pedidos anteriores foram "só do card resumo pra baixo" pros dois
            (copiar como imagem e imprimir). O título do relatório já
            aparece de qualquer forma no cabeçalho que imprimirRelatorio.js
            monta por fora (ver ReportsPage.jsx), então não duplica no
            papel. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
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
                hoje; as colunas Expedição de Hoje e Carregamento de Hoje validam só o que foi feito hoje de verdade
                (registros de dias anteriores não contam). Cargas em Andamento é diferente: mostra se tem carga
                ocupando o box AGORA, incluindo cargas de ontem que ainda não foram carregadas. As colunas de Segunda a
                Sexta e Semana são o mesmo acompanhamento do relatório Meta de Entrega, só que lado a lado com o resto
              </p>
            </div>
          </div>

        </div>

        <div ref={capturaRef}>
          {/* Pedido do usuário: card único logo abaixo da barra de título/
              Sequenciar lojas, com o resumo do dia em % — Expedição de Hoje
              (% gerado) e Carregamento de Hoje (% feito). Mesma base de
              cálculo dos totalizadores que já aparecem no cabeçalho de cada
              coluna (ver pctExpedicao/pctCarregamento acima), só que em
              percentual em vez de "feito/total". */}
          <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
              Resumo do Dia — {rotuloTipo}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white p-4 text-center dark:bg-slate-800">
                <p className="text-base font-semibold text-slate-500 dark:text-slate-400">Expedição de Hoje</p>
                <p className="mt-1 text-6xl font-extrabold leading-none text-totvs-600 dark:text-whatsapp-400 sm:text-7xl">{pctExpedicao}%</p>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">gerado</p>
                {/* Pedido do usuário: além da porcentagem, mostrar o volume
                    total / volume feito (mesma base do pctExpedicao acima —
                    m³ quando o lote traz essa informação, senão contagem de
                    lojas). */}
                <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-200">
                  {volumeExpedicao.temVolume
                    ? `${formatarNumeroBR(volumeExpedicao.volumeTotal)} / ${formatarNumeroBR(volumeExpedicao.volumeFeito)} m³`
                    : `${total} / ${comApontamento} lojas`}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 text-center dark:bg-slate-800">
                <p className="text-base font-semibold text-slate-500 dark:text-slate-400">Carregamento de Hoje</p>
                <p className="mt-1 text-6xl font-extrabold leading-none text-totvs-600 dark:text-whatsapp-400 sm:text-7xl">{pctCarregamento}%</p>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">feito</p>
                {/* Pedido do usuário: além da porcentagem, mostrar total /
                    feito (mesma base do pctCarregamento acima — contagem de
                    lojas). */}
                <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-200">
                  {total} / {comCarregamento} lojas
                </p>
              </div>
            </div>
          </div>

          <div className="mt-1 border-t border-slate-100 pt-4 dark:border-slate-700">
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
            {/* Pedido do usuário: o `max-h-[70vh] overflow-auto` que existia
                aqui criava uma SEGUNDA barra de rolagem (a tabela rolava
                dentro de si mesma, além da rolagem normal da página) — além
                de atrapalhar a visão, isso cortava a tabela na captura de
                "copiar como imagem" (html2canvas só pega o que está visível
                dentro da área com scroll) e exigia a gambiarra separada
                `print:max-h-none` pra impressão. Removido: a tabela agora só
                flui com o resto da página (uma rolagem só). O cabeçalho
                continua "sticky" (ver thead abaixo), só que agora gruda no
                topo da área de rolagem da página inteira, não mais só
                dentro desses 70vh. */}
            <div className="rounded-lg border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="w-16 py-1.5 pl-3 pr-1 font-semibold">Posição</th>
                    {/* Pedido do usuário: "Cargas em Andamento" antes da
                        coluna Loja. */}
                    <th className="px-2 py-1.5 text-center font-semibold">
                      Cargas em Andamento
                      <br />
                      <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                        (incluindo cargas de ontem)
                      </span>
                    </th>
                    <th className="py-1.5 pr-3 font-semibold">Loja</th>
                    <th className="px-2 py-1.5 text-center font-semibold">
                      Expedição de Hoje
                      <br />
                      <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                        {volumeExpedicao.temVolume
                          ? `${formatarNumeroBR(volumeExpedicao.volumeFeito)}/${formatarNumeroBR(volumeExpedicao.volumeTotal)} m³`
                          : `${comApontamento}/${total}`}
                      </span>
                    </th>
                    <th className="px-2 py-1.5 text-center font-semibold">
                      Carregamento de Hoje
                      <br />
                      <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                        {comCarregamento}/{total}
                      </span>
                    </th>
                    {diasSemanaAtual.map((dataISO) => (
                      <th key={dataISO} className="px-2 py-1.5 text-center font-semibold">
                        {formatarDiaSemanaCurto(dataISO)}
                        <br />
                        <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                          {totaisPorDia.get(dataISO) ?? 0}/{total}
                        </span>
                      </th>
                    ))}
                    <th className="py-1.5 pl-3 pr-3 text-right font-semibold">Semana</th>
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
                      <td className="py-1 pl-3 pr-1">
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
                      <td className="px-2 py-1.5 text-center">
                        <Selo
                          feito={loja.cargaNoBox}
                          rotuloFeito={rotuloCargaNoBox(loja)}
                          rotuloPendente="Vazio"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{loja.codigo}</span>
                          <span className="text-slate-500 dark:text-slate-400">{loja.nomeLoja}</span>
                          {loja.cargas.length === 0 && (
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                              Sem carga hoje
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {/* Pedido do usuário: em vez de um "Feito"/"Pendente"
                            genérico, mostra o status real da loja no box
                            nesse momento (Em Execução, Conferência
                            Finalizada, Agrupando, Agrupada etc.). */}
                        <SeloStatusExpedicao status={loja.statusExpedicaoHoje} />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Selo feito={loja.carregamentoFeito} />
                      </td>
                      <CelulasSemana codigo={loja.codigo} porCodigoSemana={porCodigoSemana} />
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
          //
          // Pedido do usuário: removido o `max-h-[70vh] overflow-auto` que
          // existia aqui — criava uma segunda barra de rolagem (além da
          // rolagem normal da página) e cortava a tabela tanto na captura de
          // "copiar como imagem" (html2canvas só pega o que está visível
          // dentro de uma área com scroll) quanto exigia a gambiarra
          // separada `print:max-h-none` pra impressão. Agora a tabela só
          // flui com o resto da página.
          <div className="rounded-lg border border-slate-100 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              {/* Cabeçalho fixo (sticky) — gruda no topo da área de rolagem
                  da PÁGINA (não mais só dentro de um box de 70vh — ver
                  comentário acima), útil com uma lista de 28+ lojas. */}
              <thead className="sticky top-0 z-10 bg-white text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {/* Pedido do usuário: "Cargas em Andamento" antes da
                      coluna Loja (mesma ordem da outra tabela, modo
                      sequência, acima). */}
                  <th className="px-2 py-1.5 text-center font-semibold">
                    Cargas em Andamento
                    <br />
                    <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                      (incluindo cargas de ontem)
                    </span>
                  </th>
                  <th className="py-1.5 pl-3 pr-3 font-semibold">Loja</th>
                  <th className="px-2 py-1.5 text-center font-semibold">
                    Expedição de Hoje
                    <br />
                    <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                      {volumeExpedicao.temVolume
                        ? `${formatarNumeroBR(volumeExpedicao.volumeFeito)}/${formatarNumeroBR(volumeExpedicao.volumeTotal)} m³`
                        : `${comApontamento}/${total}`}
                    </span>
                  </th>
                  <th className="px-2 py-1.5 text-center font-semibold">
                    Carregamento de Hoje
                    <br />
                    <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                      {comCarregamento}/{total}
                    </span>
                  </th>
                  {diasSemanaAtual.map((dataISO) => (
                    <th key={dataISO} className="px-2 py-1.5 text-center font-semibold">
                      {formatarDiaSemanaCurto(dataISO)}
                      <br />
                      <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                        {totaisPorDia.get(dataISO) ?? 0}/{total}
                      </span>
                    </th>
                  ))}
                  <th className="py-1.5 pl-3 pr-3 text-right font-semibold">Semana</th>
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
                        colSpan={10}
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
                        <td className="px-2 py-1.5 text-center">
                          <Selo
                            feito={loja.cargaNoBox}
                            rotuloFeito={rotuloCargaNoBox(loja)}
                            rotuloPendente="Vazio"
                          />
                        </td>
                        <td className="py-1.5 pl-3 pr-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{loja.codigo}</span>
                            <span className="text-slate-500 dark:text-slate-400">{loja.nomeLoja}</span>
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
                        <td className="px-2 py-1.5 text-center">
                          {/* Pedido do usuário: ver comentário na outra
                              tabela, modo sequência, acima. */}
                          <SeloStatusExpedicao status={loja.statusExpedicaoHoje} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Selo feito={loja.carregamentoFeito} />
                        </td>
                        <CelulasSemana codigo={loja.codigo} porCodigoSemana={porCodigoSemana} />
                      </tr>
                    ))}
                  </tbody>
                ))}
            </table>
          </div>
        )}
      </div>
        </div>
      </div>
    </>
  );
}
