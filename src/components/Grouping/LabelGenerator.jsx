import React, { useState } from 'react';
import { Printer, X, AlertTriangle, Info } from 'lucide-react';
import { formatarDataHora } from '../../utils/dateHelpers';
import { getNomeBox } from '../../utils/boxLogic';
import { imprimirHtml } from '../../utils/imprimirHtml';
import { getTipoCarga } from '../../utils/tipoCarga';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

// Classe de tamanho do número da Loja na pré-visualização — mesma lógica
// adaptativa por comprimento do código usada na impressão (ver
// tamanhoFonteLojaPt mais abaixo), só que com classes Tailwind.
function tamanhoTailwindLoja(codigo) {
  const tamanho = String(codigo || '').length;
  if (tamanho <= 4) return 'text-6xl';
  if (tamanho <= 6) return 'text-5xl';
  if (tamanho <= 8) return 'text-4xl';
  return 'text-3xl';
}

// Pré-visualização em tela (dentro do modal) — usa a mesma hierarquia visual
// da etiqueta impressa (Loja em destaque bem maior que o resto), só que com
// classes Tailwind em vez do CSS de impressão de montarHtmlImpressao.
function Etiqueta({ loja, indice, total }) {
  // Composição do palete (quando os agrupadores juntaram lotes diferentes
  // nele — ver ConcludeGroupingModal), ex.: "2 + 5".
  const composicao = (loja.composicaoPaletes || [])[indice - 1];
  return (
    // bg-white fixo: a etiqueta é sempre "papel branco", mesmo com o app no
    // tema escuro (ver comentário no container que envolve esta grade, mais
    // abaixo) — sem isso, o card ficava sem fundo próprio e herdava o fundo
    // escuro da página, deixando o texto escuro ilegível na pré-visualização.
    <div className="flex flex-col gap-1.5 rounded-lg border-2 border-slate-800 bg-white p-3 text-slate-900">
      <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1.5">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">PALETE {indice}/{total}</span>
        <div className="flex items-center gap-1.5">
          {/* Na impressão (ribbon) essas duas caixinhas saem em preto sólido
              — ver .caixa-tipo/.caixa-box em montarHtmlImpressao — porque o
              preenchimento colorido saía "apagado". A pré-visualização em
              tela usa o mesmo preto só na caixinha de Box (a de Tipo mantém
              a cor do TipoCargaBadge padrão do app, usado em várias outras
              telas, só aqui na etiqueta impressa que vira preto). */}
          <TipoCargaBadge tipo={loja.tipoCarga} />
          <span className="rounded bg-black px-2 py-0.5 text-xs font-bold text-white">{getNomeBox(loja.boxNumero).toUpperCase()}</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">Loja</p>
        {/* Número da Loja = "nome principal" da etiqueta — pedido do
            usuário pra dar o máximo de ênfase possível, de forma a dar pra
            ler de longe. Tamanho adapta pelo comprimento do código (ver
            tamanhoTailwindLoja acima / tamanhoFonteLojaPt na impressão,
            abaixo), pra não estourar a etiqueta com códigos mais longos. */}
        <p className={`${tamanhoTailwindLoja(loja.loja)} font-black leading-none`}>{loja.loja}</p>
        {composicao && <p className="text-[10px] font-semibold text-slate-500">Lotes: {composicao}</p>}
      </div>
      <div className="flex items-end justify-between gap-2 text-xs">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase text-slate-700">Carga</p>
          <p className="truncate font-bold">{loja.carga}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase text-slate-700">Nome da Loja</p>
          <p className="truncate font-bold">{loja.nomeLoja}</p>
        </div>
        <div className="min-w-0">
          {/* Pedido do usuário: aumentar mais o rótulo e a quantidade de
              Paletes também — mesmo destaque que o Nome da Loja já tinha
              (ver .rodape-valor-paletes em montarHtmlImpressao). */}
          <p className="text-[10px] font-extrabold uppercase text-slate-700">Paletes</p>
          <p className="text-xl font-black leading-tight">{total}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 text-[10px]">
        <p className="min-w-0 truncate font-bold">{loja.colaboradores.join(', ') || '—'}</p>
        <p className="flex-shrink-0 font-bold text-slate-600">Agrupado em {formatarDataHora(loja.dataAgrupamento)}</p>
      </div>
    </div>
  );
}

// Tamanho físico de cada etiqueta na impressora do usuário: 10cm de largura
// por 5cm de altura (paisagem). Cada etiqueta sai em sua própria folha —
// ajuste estas duas constantes se o tamanho do rolo/etiqueta mudar.
const LARGURA_ETIQUETA_MM = 100;
const ALTURA_ETIQUETA_MM = 50;

// Monta um documento HTML autônomo (sem depender do CSS/DOM do app) com
// todas as etiquetas, impresso dentro da própria página (ver imprimirHtml.js).
// A regra @page define o tamanho exato de folha da impressora de etiquetas,
// e cada .etiqueta ocupa uma folha inteira (page-break-after), então cada
// palete sai impresso em sua própria etiqueta física.
//
// O número da loja é o elemento mais importante da etiqueta na hora de
// separar as cargas no box/caminhão, então ele ocupa a maior parte da
// etiqueta, em fonte bem grande — o resto das informações fica compacto
// nas bordas.
// Tamanho do número da Loja (o "nome principal" da etiqueta, pedido do
// usuário pra aumentar bastante — precisa dar pra ler de longe) se adapta
// ao comprimento do código: a maioria dos códigos é curta (3-4 caracteres,
// ex. "0406") e aproveita o tamanho máximo; já um código mais longo (ex.
// "LOJA44") usa uma fonte um pouco menor, só o suficiente pra não estourar
// a largura/altura fixa da etiqueta (100mm x 50mm) — sem isso, um código
// longo em fonte gigante ficaria cortado pela borda da etiqueta.
function tamanhoFonteLojaPt(codigo) {
  // Valores calibrados medindo a largura/altura REAL renderizada (fonte em
  // peso 900, bem mais larga por caractere que um peso normal) contra o
  // espaço disponível na etiqueta de verdade — cada um é o maior tamanho
  // que ainda sobra uma margem de segurança sem cortar nem invadir o
  // rodapé, pra funcionar de forma confiável em impressoras reais (não só
  // no preview do navegador).
  const tamanho = String(codigo || '').length;
  if (tamanho <= 4) return 64;
  if (tamanho <= 6) return 60;
  if (tamanho <= 8) return 46;
  return 36;
}

function montarHtmlImpressao(loja, total) {
  const etiquetas = Array.from({ length: total }, (_, i) => i + 1);
  const composicaoPaletes = loja.composicaoPaletes || [];
  const tipoCfg = getTipoCarga(loja.tipoCarga);
  const tamanhoFonteLoja = tamanhoFonteLojaPt(loja.loja);
  const estilo = `
    * { box-sizing: border-box; }
    @page { size: ${LARGURA_ETIQUETA_MM}mm ${ALTURA_ETIQUETA_MM}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; }
    .etiqueta {
      width: ${LARGURA_ETIQUETA_MM}mm;
      height: ${ALTURA_ETIQUETA_MM}mm;
      /* Padding um pouco mais enxuto que antes (era 2.5mm/4mm) — pedido do
         usuário pra dar mais ênfase/tamanho ao número da Loja, então esse
         espaço sobrando foi realocado pro número em vez de ficar de
         margem. */
      padding: 1.8mm 3.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
    }
    .etiqueta:last-child { page-break-after: auto; break-after: auto; }
    .cabecalho { display: flex; align-items: center; justify-content: space-between; border-bottom: 1pt solid #000; padding-bottom: 1mm; }
    .titulo { font-size: 9pt; font-weight: 800; letter-spacing: 0.5pt; color: #000; text-transform: uppercase; }
    /* Pedido do usuário: numa impressora ribbon, as duas caixinhas
       (Seca/Resfriada e Box) saíam "apagadas" — o preenchimento colorido
       (laranja/ciano/azul-marinho) depende da impressora converter a cor
       pra cinza, e isso costuma sair fraco/desigual no ribbon. Trocado por
       preto sólido puro (#000) nas duas, sem depender de conversão de
       cor nenhuma — sai sempre com o máximo de contraste possível. */
    .caixa-box { background: #000; color: #fff; font-size: 8pt; font-weight: 800; padding: 0.8mm 2.5mm; border-radius: 1mm; }
    .caixa-tipo { background: #000; color: #fff; font-size: 8pt; font-weight: 800; padding: 0.8mm 2.5mm; border-radius: 1mm; margin-right: 1.5mm; }
    .grupo-badges { display: flex; align-items: center; }

    .loja-destaque { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
    .loja-rotulo { font-size: 6pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt; color: #000; margin: 0; }
    /* Número da Loja é o "nome principal" da etiqueta — pedido do usuário
       pra dar o máximo de ênfase possível, pra dar pra ler de longe com
       facilidade. Tamanho calculado em tamanhoFonteLojaPt (acima), que
       adapta pelo comprimento do código pra nunca estourar a etiqueta. */
    .loja-valor { font-size: ${tamanhoFonteLoja}pt; font-weight: 900; line-height: 1; color: #000; margin: 0.4mm 0 0; white-space: nowrap; }

    .rodape-campos { display: flex; align-items: flex-end; gap: 3mm; }
    .rodape-campo { min-width: 0; }
    .rodape-campo.destaque { flex: 1; }
    /* Pedido do usuário: impressora ribbon (térmica por transferência) —
       todo o resto do texto (além do número grande da Loja) em preto e
       negrito, pra sair bem legível na impressão, inclusive os rótulos
       pequenos (ex.: "CARGA", "NOME DA LOJA") que antes ficavam em peso
       normal. */
    .rodape-rotulo { font-size: 6pt; font-weight: 700; text-transform: uppercase; color: #000; margin: 0; }
    .rodape-valor { font-size: 8.5pt; font-weight: 700; color: #000; margin: 0.3mm 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Nome da Loja é o campo de destaque do rodapé (maior espaço, ver
       .rodape-campo.destaque) — já tinha sido aumentado antes, bem além do
       tamanho de Carga/Paletes. */
    .rodape-valor-loja { font-size: 13pt; font-weight: 800; color: #000; margin: 0.3mm 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Pedido do usuário: aumentar mais o rótulo e a quantidade de Paletes
       também — é um dos dados mais checados na hora de bater a carga, por
       isso ganha mais destaque que Carga (mas um pouco menos que o número
       da Loja acima, que é a prioridade máxima agora pedida pelo usuário —
       precisa sobrar altura suficiente pra ele). */
    .rodape-rotulo-paletes { font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000; margin: 0; }
    .rodape-valor-paletes { font-size: 15pt; font-weight: 900; line-height: 1.1; color: #000; margin: 0.2mm 0 0; }

    .segunda-linha { display: flex; align-items: flex-end; justify-content: space-between; gap: 3mm; margin-top: 0.8mm; }
    .colaboradores { font-size: 8.5pt; font-weight: 700; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data-agrupamento { flex-shrink: 0; font-size: 5.5pt; font-weight: 700; color: #000; white-space: nowrap; }
  `;

  const corpo = etiquetas
    .map(
      (n) => `
    <div class="etiqueta">
      <div class="cabecalho">
        <span class="titulo">PALETE ${n}/${total}</span>
        <span class="grupo-badges">
          <span class="caixa-tipo">${tipoCfg.texto.toUpperCase()}</span>
          <span class="caixa-box">${getNomeBox(loja.boxNumero).toUpperCase()}</span>
        </span>
      </div>
      <div class="loja-destaque">
        <p class="loja-rotulo">Loja</p>
        <p class="loja-valor">${loja.loja}</p>
        ${composicaoPaletes[n - 1] ? `<p style="margin:0.5mm 0 0;font-size:7pt;font-weight:700;color:#000;">Lotes: ${composicaoPaletes[n - 1]}</p>` : ''}
      </div>
      <div>
        <div class="rodape-campos">
          <div class="rodape-campo"><p class="rodape-rotulo">Carga</p><p class="rodape-valor">${loja.carga}</p></div>
          <div class="rodape-campo destaque"><p class="rodape-rotulo">Nome da Loja</p><p class="rodape-valor-loja">${loja.nomeLoja}</p></div>
          <div class="rodape-campo"><p class="rodape-rotulo-paletes">Paletes</p><p class="rodape-valor-paletes">${total}</p></div>
        </div>
        <div class="segunda-linha">
          <span class="colaboradores">${loja.colaboradores.join(', ') || '—'}</span>
          <span class="data-agrupamento">Agrupado em ${formatarDataHora(loja.dataAgrupamento)}</span>
        </div>
      </div>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Etiquetas — ${loja.carga}</title>
<style>${estilo}</style>
</head>
<body>
${corpo}
</body>
</html>`;
}

export default function LabelGenerator({ loja, aoFechar }) {
  // null = nada a mostrar; 'ok' = impressão preparada (mostra dica de Ctrl+P);
  // 'erro' = falha real ao preparar o conteúdo para impressão.
  const [statusImpressao, setStatusImpressao] = useState(null);

  if (!loja) return null;
  const total = loja.paletesAgrupados || 1;
  const etiquetas = Array.from({ length: total }, (_, i) => i + 1);

  function aoImprimir() {
    const sucesso = imprimirHtml(montarHtmlImpressao(loja, total));
    setStatusImpressao(sucesso ? 'ok' : 'erro');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Etiquetas — {loja.carga} / Loja {loja.loja}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Cada palete sai em uma etiqueta separada, no tamanho {LARGURA_ETIQUETA_MM / 10}cm x {ALTURA_ETIQUETA_MM / 10}cm.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={aoImprimir}
              className="flex items-center gap-1.5 rounded-md bg-totvs-600 dark:bg-whatsapp-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-totvs-700 dark:hover:bg-whatsapp-700"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={aoFechar} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
              <X size={20} />
            </button>
          </div>
        </div>

        {statusImpressao === 'ok' && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:border dark:border-current dark:bg-blue-500/10 dark:text-blue-300">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Etiquetas prontas para impressão. Se a caixa de impressão não abrir automaticamente, pressione{' '}
              <strong>Ctrl+P</strong> (ou <strong>Cmd+P</strong> no Mac). Se as etiquetas não saírem separadas, confira
              se o tamanho do papel escolhido na caixa de impressão é <strong>100mm x 50mm</strong> e a escala está em{' '}
              <strong>100%</strong>.
            </span>
          </div>
        )}
        {statusImpressao === 'erro' && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>Não foi possível preparar a impressão das etiquetas. Tente novamente.</span>
          </div>
        )}

        {/* Fundo levemente diferenciado para que as etiquetas (sempre em
            papel branco, mesmo no tema escuro, pois são feitas para
            impressão) fiquem visualmente destacadas como "folhas". A
            impressão em si acontece dentro da própria página, escondida até
            o momento de imprimir (ver aoImprimir e imprimirHtml.js) — esta
            grade aqui é só a pré-visualização em tela. */}
        <div className="overflow-y-auto p-4 dark:bg-slate-900/40">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {etiquetas.map((n) => (
              <Etiqueta key={n} loja={loja} indice={n} total={total} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
