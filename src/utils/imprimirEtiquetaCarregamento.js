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
// "Agrupadores" das lojas a partir da 2ª não cabia mais na impressão — a
// etiqueta é uma área FIXA de 50mm de altura (não dá pra rolar nem crescer,
// é o tamanho físico real da etiqueta).
//
// Pedido do usuário (revisão): reduzir ainda mais a etiqueta pra caber a
// informação COMPLETA dos agrupadores de TODAS as lojas, sem cortar nomes.
//
// Uma tabela fixa de "tamanho por quantidade de lojas" (a correção
// anterior) não é suficiente: o que decide se o conteúdo cabe não é só
// quantas lojas tem no protocolo, é quanto TEXTO entra no total — 3 lojas
// com listas de agrupadores longas (3-4 nomes cada) podem ocupar mais
// altura do que 5 lojas com listas curtas. Por isso, em vez de adivinhar um
// tamanho pela contagem de lojas, a etiqueta agora é montada e MEDIDA de
// verdade (getBoundingClientRect, num container invisível fora da tela) —
// e o tamanho de fonte vai encolhendo, passo a passo, até o conteúdo
// inteiro caber dentro dos 50mm fixos. Isso cobre qualquer combinação de
// quantidade de lojas x tamanho da lista de agrupadores, incluindo listas
// que quebram em várias linhas.
const TAMANHO_MAXIMO = {
  cabecalhoValor: 14,
  sequencia: 9,
  lojaValor: 18,
  campoValor: 14,
  agrupadores: 8.5,
  totalRodape: 12.5,
  gapLojas: 1.2,
  paddingSecao: 0.9,
};

// Piso: o menor tamanho ainda assim impresso por completo (nada de
// display:none ou largura zero) — a partir daqui, mais lojas/mais nomes de
// agrupadores do que isso cabe só numa etiqueta física maior, que não é o
// caso aqui (tamanho fixo, calibrado pela impressora de etiquetas do
// usuário). Mesmo no piso, o texto continua at least presente e legível em
// letra pequena — nunca invisível.
const TAMANHO_MINIMO = {
  cabecalhoValor: 5,
  sequencia: 3.4,
  lojaValor: 5.6,
  campoValor: 3.9,
  agrupadores: 3.4,
  totalRodape: 3.9,
  gapLojas: 0.04,
  paddingSecao: 0.02,
};

// Granularidade da busca pelo "maior tamanho que ainda cabe" — passos
// pequenos o bastante pra não desperdiçar espaço (reduzir mais do que
// precisa deixaria a etiqueta menor do que o necessário), sem exigir tantas
// medições que o encolhimento fique perceptível na hora de imprimir.
const PASSOS_REDUCAO = 24;

function interpolarTamanho(t) {
  const tamanho = {};
  for (const chave of Object.keys(TAMANHO_MAXIMO)) {
    tamanho[chave] = TAMANHO_MAXIMO[chave] + (TAMANHO_MINIMO[chave] - TAMANHO_MAXIMO[chave]) * t;
  }
  return tamanho;
}

function montarHtmlEtiquetaCarregamento(itens, tamanho = TAMANHO_MAXIMO, centralizar = true) {
  const itensOrdenados = ordenarPorSequenciaDeCarregamento(itens);
  const temSequencia = itensOrdenados.length > 1 && itensOrdenados.every((item) => item.posicaoCarregamento != null);
  const [primeiro] = itensOrdenados;
  const t = tamanho;

  const estilo = `
    * { box-sizing: border-box; }
    @page { size: ${LARGURA_ETIQUETA_MM}mm ${ALTURA_ETIQUETA_MM}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; }
    .etiqueta {
      width: ${LARGURA_ETIQUETA_MM}mm;
      height: ${ALTURA_ETIQUETA_MM}mm;
      padding: 1.6mm 3.5mm;
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
      overflow: hidden;
      /* Centraliza o grupo (cabeçalho + lojas + total) quando sobra
         espaço (1-2 lojas, o caso mais comum) — ver nota em .lojas
         abaixo pra entender por que a centralização tem que acontecer
         AQUI, no nível de fora, e não dentro de .lojas.

         "centralizar" só é true quando imprimirEtiquetaCarregamento já
         confirmou, por medição, que o conteúdo cabe inteiro — nesse caso
         center só distribui espaço vazio (sempre seguro). No caso raro
         em que nem no tamanho mínimo tudo cabe (ver PASSOS_REDUCAO),
         "centralizar" vem false: aí o grupo fica grudado no topo
         (flex-start), pra NUNCA cortar o cabeçalho (motorista/placa) —
         só o fim da última seção, que é a informação menos crítica,
         fica sujeita a ficar de fora dos 50mm físicos. */
      justify-content: ${centralizar ? 'center' : 'flex-start'};
    }
    .cabecalho {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 3mm;
      border-bottom: 1pt solid #000;
      padding-bottom: 0.8mm;
      flex-shrink: 0;
    }
    /* Mesma decisão já tomada nas etiquetas de palete (ver
       LabelGenerator.jsx): nada de caixinha preenchida (sai "apagado" na
       impressora ribbon do usuário) — só texto preto em negrito. */
    .campo-cabecalho { display: flex; align-items: baseline; gap: 1.2mm; min-width: 0; flex-wrap: wrap; }
    .campo-cabecalho .rotulo { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5pt; color: #000; white-space: nowrap; }
    /* Pedido do usuário vale também aqui: NUNCA cortar informação
       silenciosamente. Nome de motorista/placa comprido quebra pra uma
       2ª linha (igual ao campo de agrupadores) em vez de truncar com
       "..." — nome de motorista é informação importante demais pra sumir
       de propósito, mesmo que raramente precise de 2 linhas na prática. */
    .campo-cabecalho .valor { font-size: ${t.cabecalhoValor}pt; font-weight: 900; color: #000; white-space: normal; overflow-wrap: break-word; }

    /* Lista de lojas — cada uma é uma seção compacta. Com só uma loja
       (protocolo de loja única), a seção some e sobra só os campos. O
       tamanho de tudo aqui dentro vem do "tamanho" escolhido por
       imprimirEtiquetaCarregamento (shrink-to-fit medido), calibrado pra
       NUNCA estourar os 50mm fixos da etiqueta.

       IMPORTANTE: SEM "flex: 1" e SEM "min-height: 0" aqui — .lojas
       precisa ocupar exatamente a altura do seu próprio conteúdo, nunca
       mais nem menos. Uma versão anterior usava "flex: 1; min-height: 0;
       justify-content: center" pra centralizar o conteúdo verticalmente,
       mas isso deixa o flexbox ENCOLHER .lojas abaixo da altura real do
       seu conteúdo quando o espaço é apertado — e o conteúdo (que não
       encolhe, é texto) passa a vazar pra FORA da caixa já encolhida de
       .lojas, pra cima E pra baixo ao mesmo tempo (efeito do
       justify-content: center), sobrepondo o .cabecalho (vizinho de
       cima) e o .rodape-total (vizinho de baixo) — e isso acontecia
       mesmo com TODOS os elementos individualmente ainda "dentro" dos
       limites do .etiqueta como um todo (a soma cabia, só não cabia
       dividida do jeito que o layout tentava dividir), então nenhuma
       medição de "elemento X não passa da borda do .etiqueta" pega esse
       tipo de sobreposição ENTRE VIZINHOS. A centralização vertical do
       conteúdo (quando sobra espaço) é feita no nível de fora, com
       justify-content: center no .etiqueta — ali é seguro, porque
       .cabecalho, .lojas e .rodape-total nunca são forçados a ficar
       menores que o próprio conteúdo. */
    .lojas { display: flex; flex-direction: column; gap: ${t.gapLojas}mm; }
    .secao-loja { border-top: 0.5pt solid #000; padding-top: ${t.paddingSecao}mm; }
    .secao-loja:first-child { border-top: none; padding-top: 0; }
    /* A numeração de sequência de carregamento entra na MESMA linha de
       Loja/Paletes/Box (barra vertical separando, igual ao padrão já
       usado em LabelGenerator.jsx pra Seca/Resfriada + Box) em vez de
       linha própria — economiza uma linha inteira por seção. */
    .campos-loja { display: flex; align-items: baseline; gap: 2.5mm; flex-wrap: wrap; }
    .sequencia {
      font-size: ${t.sequencia}pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      color: #000;
      padding-right: 2.5mm;
      border-right: 1pt solid #000;
      white-space: nowrap;
    }
    .campo-loja { display: flex; align-items: baseline; gap: 1mm; min-width: 0; }
    .campo-loja .rotulo { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #000; white-space: nowrap; }
    .campo-loja .valor { font-size: ${t.campoValor}pt; font-weight: 900; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .campo-loja.loja .valor { font-size: ${t.lojaValor}pt; }
    /* Pedido do usuário: NUNCA cortar os nomes dos agrupadores — ao
       contrário dos outros campos (valores curtos, cabem numa linha), a
       lista de colaboradores pode ser longa, então aqui quebra em quantas
       linhas precisar (sem nowrap/ellipsis) em vez de truncar com "...". É
       exatamente essa quebra em mais linhas que faz o conteúdo variar de
       altura de forma imprevisível pela contagem de lojas sozinha — por
       isso o tamanho final é decidido por medição real, não por tabela. */
    .agrupadores {
      margin: 0.2mm 0 0;
      font-size: ${t.agrupadores}pt;
      font-weight: 700;
      line-height: 1.15;
      color: #000;
      white-space: normal;
      overflow-wrap: break-word;
    }
    .agrupadores .rotulo { font-weight: 800; text-transform: uppercase; }

    /* Pedido do usuário: total de paletes (soma de todas as lojas) no
       rodapé da etiqueta — útil pra conferência rápida de quantos paletes
       devem estar no caminhão ao todo. */
    .rodape-total {
      flex-shrink: 0;
      margin: 0;
      padding-top: 0.6mm;
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
        <div class="campos-loja">
          ${sequencia}
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

// ---- Medição real ("shrink-to-fit") ----
//
// Monta o HTML candidato num container fora da tela (position: fixed,
// bem à esquerda do viewport — nunca visível, mas com layout real, ao
// contrário de display:none, que zera tudo) e compara, com
// getBoundingClientRect, os limites de cada seção/linha contra os limites
// do próprio `.etiqueta`. Só assim dá pra saber se o conteúdo de verdade
// cabe nos 50mm físicos — checar se o texto está presente na string HTML
// NÃO prova isso, porque `overflow: hidden` esconde visualmente sem tirar
// nada do HTML.
const ID_CONTAINER_MEDICAO = 'doca-manager-medicao-etiqueta-carregamento';

function medirSeCabeNaEtiqueta(html) {
  // Fora de um navegador (ex.: algum uso futuro em ambiente sem DOM) não há
  // como medir — assume que cabe, pra não travar quem chamar; quem roda no
  // app (sempre no navegador) sempre mede de verdade.
  if (typeof document === 'undefined') return true;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const estiloDocumento = doc.querySelector('style')?.textContent || '';
  const corpoDocumento = doc.body ? doc.body.innerHTML : '';

  let container = document.getElementById(ID_CONTAINER_MEDICAO);
  if (!container) {
    container = document.createElement('div');
    container.id = ID_CONTAINER_MEDICAO;
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }
  container.innerHTML = `<style>${estiloDocumento}</style>${corpoDocumento}`;

  const etiqueta = container.querySelector('.etiqueta');
  if (!etiqueta) return true;
  const limite = etiqueta.getBoundingClientRect();
  const EPS = 0.5; // tolera arredondamento de subpixel, não recorte real
  const elementos = container.querySelectorAll('.secao-loja, .agrupadores, .rodape-total, .cabecalho');
  for (const elemento of elementos) {
    const r = elemento.getBoundingClientRect();
    // Checa os 4 lados — não só embaixo/direita. Ver nota em `.lojas`
    // acima: um `justify-content: center` já causou conteúdo vazando por
    // CIMA (sobrepondo o cabeçalho) que essa checagem, antes só de
    // bottom/right, deixava passar como "cabe". Mantido mesmo com
    // flex-start no CSS, como segunda camada de proteção.
    if (
      r.bottom > limite.bottom + EPS ||
      r.right > limite.right + EPS ||
      r.top < limite.top - EPS ||
      r.left < limite.left - EPS
    ) {
      return false;
    }
  }
  return true;
}

function limparContainerMedicao() {
  const container = typeof document !== 'undefined' && document.getElementById(ID_CONTAINER_MEDICAO);
  if (container) container.remove();
}

// Imprime UMA ÚNICA etiqueta de carregamento (100mm x 50mm) para o
// protocolo inteiro — no cabeçalho, Motorista e Placa; abaixo, uma seção
// por loja (sequência + Loja/Paletes/Box numa linha, Agrupadores logo
// abaixo, quebrando em mais de uma linha se precisar); no rodapé, o total
// de paletes (soma de todas as lojas). Protocolo de loja única: array com 1
// item, sem numeração de sequência. Protocolo em lote (2+ lojas no mesmo
// veículo): um item por loja, cada um com `posicaoCarregamento` (1 =
// primeira a entrar no baú do caminhão) — as seções saem ordenadas por essa
// sequência de carregamento ("1º CARREGAR", "2º CARREGAR", ...), a mesma
// usada no desenho do caminhão ao registrar o protocolo (ver
// SequenciaCarregamentoCaminhao.jsx). O tamanho da fonte é escolhido por
// medição real (ver medirSeCabeNaEtiqueta) — o maior tamanho que ainda
// cabe inteiro nos 50mm fixos — e a lista de agrupadores nunca é cortada:
// quebra em mais linhas em vez de truncar.
//
// Cada item: { motorista, placa, loja, paletesEnviados, boxNumero,
// colaboradores?, posicaoCarregamento? }. `colaboradores` é a lista de quem
// agrupou aquela loja (ver loja.colaboradores em AppContext.jsx).
export function imprimirEtiquetaCarregamento(itens) {
  if (!itens || itens.length === 0) return false;

  let t = 0;
  let html = montarHtmlEtiquetaCarregamento(itens, interpolarTamanho(t));
  let coube = medirSeCabeNaEtiqueta(html);
  while (!coube && t < 1) {
    t = Math.min(1, t + 1 / PASSOS_REDUCAO);
    html = montarHtmlEtiquetaCarregamento(itens, interpolarTamanho(t));
    coube = medirSeCabeNaEtiqueta(html);
  }

  // Caso extremo (ver TAMANHO_MINIMO): mesmo no tamanho mínimo ainda
  // legível, não coube tudo — última tentativa, sem centralizar
  // verticalmente (ver "centralizar" em montarHtmlEtiquetaCarregamento),
  // pra garantir que SÓ o fim da última seção fica de fora dos 50mm
  // físicos, nunca o cabeçalho (motorista/placa).
  if (!coube) {
    html = montarHtmlEtiquetaCarregamento(itens, interpolarTamanho(1), false);
  }

  limparContainerMedicao();

  return imprimirHtml(html);
}

// Exportados só para teste automatizado (Playwright) poder renderizar o
// HTML gerado isoladamente, em qualquer tamanho, e medir com
// getBoundingClientRect se cada seção cabe dentro dos 50mm fixos da
// etiqueta — sem precisar simular a impressão de verdade. Não são usados
// por nenhum componente do app.
export { montarHtmlEtiquetaCarregamento, interpolarTamanho, medirSeCabeNaEtiqueta };
