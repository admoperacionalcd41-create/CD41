import React, { useState } from 'react';
import { Printer, X, AlertTriangle, Info } from 'lucide-react';
import { formatarDataHora } from '../../utils/dateHelpers';
import { getNomeBox } from '../../utils/boxLogic';
import { imprimirHtml } from '../../utils/imprimirHtml';
import { getTipoCarga } from '../../utils/tipoCarga';
import TipoCargaBadge from '../Shared/TipoCargaBadge.jsx';

// Pré-visualização em tela (dentro do modal) — usa a mesma hierarquia visual
// da etiqueta impressa (Loja em destaque bem maior que o resto), só que com
// classes Tailwind em vez do CSS de impressão de montarHtmlImpressao.
function Etiqueta({ loja, indice, total }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border-2 border-slate-800 p-3 text-slate-900">
      <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1.5">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">PALETE {indice}/{total}</span>
        <div className="flex items-center gap-1.5">
          <TipoCargaBadge tipo={loja.tipoCarga} />
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-white">{getNomeBox(loja.boxNumero).toUpperCase()}</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">Loja</p>
        <p className="text-5xl font-black leading-none">{loja.loja}</p>
      </div>
      <div className="flex items-end justify-between gap-2 text-xs">
        <div className="min-w-0">
          <p className="text-[9px] uppercase text-slate-400">Carga</p>
          <p className="truncate font-bold">{loja.carga}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase text-slate-400">Nome da Loja</p>
          <p className="truncate font-bold">{loja.nomeLoja}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] uppercase text-slate-400">Paletes</p>
          <p className="font-bold">{total}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 text-[10px] text-slate-500">
        <p className="min-w-0 truncate font-semibold">{loja.colaboradores.join(', ') || '—'}</p>
        <p className="flex-shrink-0 text-slate-400">Agrupado em {formatarDataHora(loja.dataAgrupamento)}</p>
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
function montarHtmlImpressao(loja, total) {
  const etiquetas = Array.from({ length: total }, (_, i) => i + 1);
  const tipoCfg = getTipoCarga(loja.tipoCarga);
  // Cores sólidas equivalentes às usadas em tela (laranja para Seca, ciano
  // para Resfriada) — aqui em hex porque a impressão é um documento HTML
  // isolado, sem acesso às classes Tailwind do app.
  const corTipo = tipoCfg.chave === 'resfriada' ? '#0891b2' : '#c2410c';
  const estilo = `
    * { box-sizing: border-box; }
    @page { size: ${LARGURA_ETIQUETA_MM}mm ${ALTURA_ETIQUETA_MM}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; }
    .etiqueta {
      width: ${LARGURA_ETIQUETA_MM}mm;
      height: ${ALTURA_ETIQUETA_MM}mm;
      padding: 2.5mm 4mm;
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
    .cabecalho { display: flex; align-items: center; justify-content: space-between; border-bottom: 1pt solid #1e293b; padding-bottom: 1.5mm; }
    .titulo { font-size: 9pt; font-weight: 800; letter-spacing: 0.5pt; color: #64748b; text-transform: uppercase; }
    .caixa-box { background: #1e293b; color: #fff; font-size: 8pt; font-weight: 700; padding: 0.8mm 2.5mm; border-radius: 1mm; }
    .caixa-tipo { background: ${corTipo}; color: #fff; font-size: 8pt; font-weight: 700; padding: 0.8mm 2.5mm; border-radius: 1mm; margin-right: 1.5mm; }
    .grupo-badges { display: flex; align-items: center; }

    .loja-destaque { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .loja-rotulo { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt; color: #64748b; margin: 0; }
    .loja-valor { font-size: 44pt; font-weight: 900; line-height: 1; color: #0f172a; margin: 0.5mm 0 0; }

    .rodape-campos { display: flex; align-items: flex-end; gap: 3mm; }
    .rodape-campo { min-width: 0; }
    .rodape-campo.destaque { flex: 1; }
    .rodape-rotulo { font-size: 6pt; text-transform: uppercase; color: #94a3b8; margin: 0; }
    .rodape-valor { font-size: 8.5pt; font-weight: 700; margin: 0.3mm 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .segunda-linha { display: flex; align-items: flex-end; justify-content: space-between; gap: 3mm; margin-top: 1mm; }
    .colaboradores { font-size: 7.5pt; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data-agrupamento { flex-shrink: 0; font-size: 6pt; color: #94a3b8; white-space: nowrap; }
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
      </div>
      <div>
        <div class="rodape-campos">
          <div class="rodape-campo"><p class="rodape-rotulo">Carga</p><p class="rodape-valor">${loja.carga}</p></div>
          <div class="rodape-campo destaque"><p class="rodape-rotulo">Nome da Loja</p><p class="rodape-valor">${loja.nomeLoja}</p></div>
          <div class="rodape-campo"><p class="rodape-rotulo">Paletes</p><p class="rodape-valor">${total}</p></div>
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
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
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
