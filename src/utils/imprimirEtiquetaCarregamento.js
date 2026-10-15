import { getNomeBox } from './boxLogic';
import { imprimirHtml } from './imprimirHtml';

// Etiqueta de carregamento — impressa ao finalizar o protocolo (loja única
// ou lote), ANTES de abrir a tela de notificar a equipe por WhatsApp (ver
// LoadingProtocolForm.jsx, função `enviar`). Pedido do usuário: identificar
// fisicamente o que está saindo no veículo (motorista, placa) junto com a
// loja/paletes/box/agrupadores de cada carga, no mesmo tamanho físico já
// calibrado para a etiqueta de palete (ver
// LARGURA_ETIQUETA_MM/ALTURA_ETIQUETA_MM em LabelGenerator.jsx — repetido
// aqui porque são módulos de impressão independentes, mas o valor tem que
// ser o mesmo).
//
// Pedido do usuário (revisão): UMA ÚNICA etiqueta por protocolo, mesmo em
// lote com várias lojas — não mais uma etiqueta separada por loja. Cada
// loja vira uma seção dentro dessa etiqueta única, numerada pela ORDEM DE
// CARREGAMENTO (`posicaoCarregamento` — a ordem combinada no desenho do
// caminhão, ver SequenciaCarregamentoCaminhao.jsx: "1º CARREGAR" é a
// primeira loja a entrar no baú), não pela ordem de entrega — é essa ordem
// que interessa a quem está carregando o caminhão fisicamente.
const LARGURA_ETIQUETA_MM = 100;
const ALTURA_ETIQUETA_MM = 50;

function ordenarPorSequenciaDeCarregamento(itens) {
  const temSequencia = itens.length > 1 && itens.every((item) => item.posicaoCarregamento != null);
  if (!temSequencia) return itens;
  return [...itens].sort((a, b) => a.posicaoCarregamento - b.posicaoCarregamento);
}

// Bug reportado pelo usuário: com 3+ lojas no mesmo protocolo, o texto
// "Agrupadores" das lojas a partir da 2ª simplesmente não saía na
// impressão — a etiqueta inteira é uma área FIXA de 50mm de altura (não dá
// pra rolar nem crescer, é o tamanho físico real da etiqueta), e com
// tamanhos de fonte fixos, 3+ seções de loja empilhadas não cabiam mais
// nesse espaço: o conteúdo que passava da altura ficava cortado (mesmo
// escondido, não "sumia" dos dados — só não aparecia no papel).
//
// Correção: o tamanho da fonte se adapta à quantidade de lojas no
// protocolo — mesma ideia já usada em tamanhoFonteLojaPt (LabelGenerator.jsx)
// pra o código da loja não estourar a etiqueta. Com 1-2 lojas (o caso mais
// comum) sobra bastante espaço, então a fonte fica BEM maior que antes
// (pedido do usuário: "a formatação ficou boa, consegue aumentar mais um
// pouco?"); com mais lojas no mesmo veículo, a fonte diminui o suficiente
// pra todas as seções (incluindo Agrupadores) sempre caberem no papel.
function obterTamanhos(qtdLojas) {
  if (qtdLojas <= 2) {
    return {
      cabecalhoValor: 14,
      sequencia: 9,
      lojaValor: 19,
      campoValor: 15,
      agrupadores: 8.5,
      totalRodape: 13,
      gapLojas: 1.4,
      paddingSecao: 1,
    };
  }
  if (qtdLojas === 3) {
    return {
      cabecalhoValor: 11,
      sequencia: 7.5,
      lojaValor: 15,
      campoValor: 11,
      agrupadores: 7.5,
      totalRodape: 10,
      gapLojas: 0.8,
      paddingSecao: 0.6,
    };
  }
  if (qtdLojas === 4) {
    return {
      cabecalhoValor: 9.5,
      sequencia: 6.5,
      lojaValor: 12.5,
      campoValor: 9,
      agrupadores: 6.5,
      totalRodape: 8.5,
      gapLojas: 0.5,
      paddingSecao: 0.4,
    };
  }
  // 5+ lojas no mesmo veículo — tamanho mínimo legível, prioriza caber
  // tudo no papel em vez de ficar maior e cortar o conteúdo.
  return {
    cabecalhoValor: 8,
    sequencia: 5.5,
    lojaValor: 10.5,
    campoValor: 7.5,
    agrupadores: 5.5,
    totalRodape: 7.5,
    gapLojas: 0.35,
    paddingSecao: 0.3,
  };
}

function montarHtmlEtiquetaCarregamento(itens) {
  const itensOrdenados = ordenarPorSequenciaDeCarregamento(itens);
  const temSequencia = itensOrdenados.length > 1 && itensOrdenados.every((item) => item.posicaoCarregamento != null);
  const [primeiro] = itensOrdenados;
  const t = obterTamanhos(itensOrdenados.length);

  const estilo = `
    * { box-sizing: border-box; }
    @page { size: ${LARGURA_ETIQUETA_MM}mm ${ALTURA_ETIQUETA_MM}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; }
    .etiqueta {
      width: ${LARGURA_ETIQUETA_MM}mm;
      height: ${ALTURA_ETIQUETA_MM}mm;
      padding: 1.8mm 3.5mm;
      display: flex;
      flex-direction: column;
      gap: 1mm;
      overflow: hidden;
    }
    .cabecalho {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 3mm;
      border-bottom: 1pt solid #000;
      padding-bottom: 1mm;
      flex-shrink: 0;
    }
    /* Mesma decisão já tomada nas etiquetas de palete (ver
       LabelGenerator.jsx): nada de caixinha preenchida (sai "apagado" na
       impressora ribbon do usuário) — só texto preto em negrito. */
    .campo-cabecalho { display: flex; align-items: baseline; gap: 1.2mm; min-width: 0; }
    .campo-cabecalho .rotulo { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5pt; color: #000; white-space: nowrap; }
    .campo-cabecalho .valor { font-size: ${t.cabecalhoValor}pt; font-weight: 900; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Lista de lojas — cada uma é uma seção compacta. Com só uma loja
       (protocolo de loja única), a seção some e sobra só os campos. O
       tamanho de tudo aqui dentro vem de obterTamanhos(), calibrado pela
       quantidade de lojas pra NUNCA estourar os 50mm fixos da etiqueta. */
    .lojas { flex: 1; display: flex; flex-direction: column; gap: ${t.gapLojas}mm; min-height: 0; overflow: hidden; justify-content: center; }
    .secao-loja { border-top: 0.5pt solid #000; padding-top: ${t.paddingSecao}mm; }
    .secao-loja:first-child { border-top: none; padding-top: 0; }
    .sequencia {
      display: block;
      font-size: ${t.sequencia}pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #000;
      margin: 0 0 0.3mm;
    }
    .campos-loja { display: flex; align-items: baseline; gap: 3mm; flex-wrap: wrap; }
    .campo-loja { display: flex; align-items: baseline; gap: 1mm; min-width: 0; }
    .campo-loja .rotulo { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #000; white-space: nowrap; }
    .campo-loja .valor { font-size: ${t.campoValor}pt; font-weight: 900; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .campo-loja.loja .valor { font-size: ${t.lojaValor}pt; }
    .agrupadores { margin: 0.3mm 0 0; font-size: ${t.agrupadores}pt; font-weight: 700; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .agrupadores .rotulo { font-weight: 800; text-transform: uppercase; }

    /* Pedido do usuário: total de paletes (soma de todas as lojas) no
       rodapé da etiqueta — útil pra conferência rápida de quantos paletes
       devem estar no caminhão ao todo. */
    .rodape-total {
      flex-shrink: 0;
      margin: 0;
      padding-top: 0.8mm;
      border-top: 1pt solid #000;
      font-size: ${t.totalRodape}pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #000;
      text-align: right;
    }
  `;

  const secoesLojas = itensOrdenados
    .map((item) => {
      const sequencia = temSequencia
        ? `<span class="sequencia">${item.posicaoCarregamento}º CARREGAR</span>`
        : '';
      const agrupadores = (item.colaboradores && item.colaboradores.filter(Boolean).join(', ')) || '—';
      return `
      <div class="secao-loja">
        ${sequencia}
        <div class="campos-loja">
          <span class="campo-loja loja"><span class="rotulo">Loja:</span> <span class="valor">${item.loja}</span></span>
          <span class="campo-loja"><span class="rotulo">Paletes:</span> <span class="valor">${item.paletesEnviados}</span></span>
          <span class="campo-loja"><span class="rotulo">Box:</span> <span class="valor">${getNomeBox(item.boxNumero)}</span></span>
        </div>
        <p class="agrupadores"><span class="rotulo">Agrupadores:</span> ${agrupadores}</p>
      </div>`;
    })
    .join('');

  const totalPaletes = itensOrdenados.reduce((soma, item) => soma + (Number(item.paletesEnviados) || 0), 0);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Etiqueta de Carregamento — ${primeiro?.placa || ''}</title>
<style>${estilo}</style>
</head>
<body>
  <div class="etiqueta">
    <div class="cabecalho">
      <span class="campo-cabecalho"><span class="rotulo">Motorista:</span> <span class="valor">${primeiro?.motorista || '—'}</span></span>
      <span class="campo-cabecalho"><span class="rotulo">Placa:</span> <span class="valor">${primeiro?.placa || '—'}</span></span>
    </div>
    <div class="lojas">${secoesLojas}</div>
    <p class="rodape-total">Total ${totalPaletes} paletes</p>
  </div>
</body>
</html>`;
}

// Imprime UMA ÚNICA etiqueta de carregamento (100mm x 50mm) para o
// protocolo inteiro — no cabeçalho, Motorista e Placa; abaixo, uma seção
// por loja (Loja/Paletes/Box/Agrupadores); no rodapé, o total de paletes
// (soma de todas as lojas). Protocolo de loja única: array com 1 item, sem
// numeração de sequência. Protocolo em lote (2+ lojas no mesmo veículo): um
// item por loja, cada um com `posicaoCarregamento` (1 = primeira a entrar
// no baú do caminhão) — as seções saem ordenadas por essa sequência de
// carregamento ("1º CARREGAR", "2º CARREGAR", ...), a mesma usada no
// desenho do caminhão ao registrar o protocolo (ver
// SequenciaCarregamentoCaminhao.jsx). O tamanho da fonte se adapta à
// quantidade de lojas (ver obterTamanhos) pra nenhuma seção ficar cortada
// pelos 50mm fixos da etiqueta.
//
// Cada item: { motorista, placa, loja, paletesEnviados, boxNumero,
// colaboradores?, posicaoCarregamento? }. `colaboradores` é a lista de quem
// agrupou aquela loja (ver loja.colaboradores em AppContext.jsx).
export function imprimirEtiquetaCarregamento(itens) {
  if (!itens || itens.length === 0) return false;
  return imprimirHtml(montarHtmlEtiquetaCarregamento(itens));
}
