import { getNomeBox } from './boxLogic';
import { imprimirHtml } from './imprimirHtml';

// Etiqueta de carregamento — impressa ao finalizar o protocolo (loja única
// ou lote), ANTES de abrir a tela de notificar a equipe por WhatsApp (ver
// LoadingProtocolForm.jsx, função `enviar`). Pedido do usuário: identificar
// fisicamente o que está saindo no veículo (motorista, placa) junto com a
// loja/paletes/box de cada carga, no mesmo tamanho físico já calibrado para
// a etiqueta de palete (ver LARGURA_ETIQUETA_MM/ALTURA_ETIQUETA_MM em
// LabelGenerator.jsx — repetido aqui porque são módulos de impressão
// independentes, mas o valor tem que ser o mesmo).
const LARGURA_ETIQUETA_MM = 100;
const ALTURA_ETIQUETA_MM = 50;

// Num protocolo em lote (2+ lojas no mesmo veículo), uma etiqueta sai para
// CADA loja — pedido do usuário: "faça usando a mesma sequência usada no
// registro do protocolo de carregamento, a primeira loja que entra é a
// última que sai". A sequência de registro é a ordem de ENTREGA combinada
// (`posicaoEntrega`, calculada em FINALIZAR_CARREGAMENTO_MULTIPLO a partir
// da ordem de carregamento no desenho do caminhão — ver
// SequenciaCarregamentoCaminhao.jsx: quem carrega por último é entregue
// primeiro, por isso a inversão), a mesma usada na tabela do protocolo
// impresso (ver imprimirProtocolo.js, `temSequencia`/`lojasParaImprimir`) e
// na mensagem de WhatsApp pra equipe (ver notificacoes.js, tag "Nª
// entrega"). Aqui ordenamos as etiquetas da mesma forma: 1ª entrega
// primeiro.
function ordenarPorSequenciaDeEntrega(itens) {
  const temSequencia = itens.length > 1 && itens.every((item) => item.posicaoEntrega != null);
  if (!temSequencia) return itens;
  return [...itens].sort((a, b) => a.posicaoEntrega - b.posicaoEntrega);
}

function montarHtmlEtiquetasCarregamento(itens) {
  const itensOrdenados = ordenarPorSequenciaDeEntrega(itens);
  const temSequencia = itensOrdenados.length > 1 && itensOrdenados.every((item) => item.posicaoEntrega != null);

  const estilo = `
    * { box-sizing: border-box; }
    @page { size: ${LARGURA_ETIQUETA_MM}mm ${ALTURA_ETIQUETA_MM}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; }
    .etiqueta {
      width: ${LARGURA_ETIQUETA_MM}mm;
      height: ${ALTURA_ETIQUETA_MM}mm;
      padding: 2mm 4mm;
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
    /* Mesma decisão já tomada nas etiquetas de palete (ver LabelGenerator.jsx):
       nada de caixinha preenchida (sai "apagado" na impressora ribbon do
       usuário) — só texto preto em negrito, igual ao resto da etiqueta. */
    .sequencia { font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #000; }

    .motorista-placa { display: flex; flex-direction: column; gap: 1.2mm; margin: 1mm 0; }
    .campo-largo .rotulo { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; color: #000; margin: 0; }
    .campo-largo .valor { font-size: 14pt; font-weight: 900; color: #000; margin: 0.3mm 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Pedido do usuário: identificar também quem agrupou a(s) loja(s) —
       mesmo campo "Colaboradores" já exibido na etiqueta de palete (ver
       LabelGenerator.jsx), em fonte menor que Motorista/Placa pois é só
       informativo, não precisa ser lido de longe. */
    .campo-largo.agrupado .valor { font-size: 9.5pt; font-weight: 700; }

    .rodape-campos { display: flex; align-items: flex-end; gap: 3mm; border-top: 1pt solid #000; padding-top: 1.5mm; }
    .rodape-campo { min-width: 0; }
    .rodape-campo.destaque { flex: 1.3; }
    .rodape-rotulo { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; color: #000; margin: 0; }
    /* Loja é o dado mais checado pra separar a carga no box/caminhão —
       mesmo destaque dado a ela nas etiquetas de palete. */
    .rodape-valor-loja { font-size: 22pt; font-weight: 900; line-height: 1; color: #000; margin: 0.3mm 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rodape-valor { font-size: 13pt; font-weight: 800; color: #000; margin: 0.3mm 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `;

  const corpo = itensOrdenados
    .map((item) => {
      const sequencia = temSequencia ? `<span class="sequencia">${item.posicaoEntrega}ª ENTREGA</span>` : '';
      return `
    <div class="etiqueta">
      <div class="cabecalho">
        <span class="titulo">Etiqueta de Carregamento</span>
        ${sequencia}
      </div>
      <div class="motorista-placa">
        <div class="campo-largo"><p class="rotulo">Motorista</p><p class="valor">${item.motorista || '—'}</p></div>
        <div class="campo-largo"><p class="rotulo">Placa</p><p class="valor">${item.placa || '—'}</p></div>
        <div class="campo-largo agrupado"><p class="rotulo">Agrupado por</p><p class="valor">${
          (item.colaboradores && item.colaboradores.filter(Boolean).join(', ')) || '—'
        }</p></div>
      </div>
      <div class="rodape-campos">
        <div class="rodape-campo destaque"><p class="rodape-rotulo">Loja</p><p class="rodape-valor-loja">${item.loja}</p></div>
        <div class="rodape-campo"><p class="rodape-rotulo">Paletes</p><p class="rodape-valor">${item.paletesEnviados}</p></div>
        <div class="rodape-campo"><p class="rodape-rotulo">Box</p><p class="rodape-valor">${getNomeBox(item.boxNumero)}</p></div>
      </div>
    </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Etiqueta de Carregamento — ${itensOrdenados[0]?.placa || ''}</title>
<style>${estilo}</style>
</head>
<body>
${corpo}
</body>
</html>`;
}

// Imprime uma etiqueta de carregamento (100mm x 50mm) para cada item de
// `itens` — um item por loja. Protocolo de loja única: array com 1 item,
// sem indicação de sequência. Protocolo em lote (2+ lojas no mesmo
// veículo): um item por loja, cada um com `posicaoEntrega` (1 = entregue
// primeiro) — as etiquetas saem ordenadas por essa sequência de entrega,
// não pela ordem em que as lojas foram selecionadas na tela.
//
// Cada item: { motorista, placa, loja, paletesEnviados, boxNumero,
// colaboradores?, posicaoEntrega? }. `colaboradores` é a lista de quem
// agrupou aquela loja (ver loja.colaboradores em AppContext.jsx) — pedido
// do usuário para constar na etiqueta também.
export function imprimirEtiquetasCarregamento(itens) {
  if (!itens || itens.length === 0) return false;
  return imprimirHtml(montarHtmlEtiquetasCarregamento(itens));
}
