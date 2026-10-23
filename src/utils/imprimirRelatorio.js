import { imprimirHtml } from './imprimirHtml';

// Imprime o relatório atualmente aberto na aba Relatórios — usa a mesma
// técnica de LabelGenerator.jsx/imprimirProtocolo.js (ver imprimirHtml.js
// para o motivo: window.print() via script é bloqueado silenciosamente
// dentro do sandbox do preview do Artifact, então o conteúdo é preparado na
// própria página e o usuário aciona a impressão via Ctrl+P/Cmd+P quando o
// disparo automático não funcionar).
const ID_AREA_RELATORIO = 'area-impressao-relatorio';

// Aproximação de pixels por milímetro a 96dpi (padrão CSS: 1in = 96px =
// 25,4mm) — usada só pra estimar a área útil de uma folha A4 na hora de
// calcular o fator de escala de `achatarEmUmaFolha` abaixo. É uma
// aproximação razoável pra esse fim (não precisa ser exata: o objetivo é
// garantir que o conteúdo caiba, não acertar o tamanho exato no papel).
const PX_POR_MM = 96 / 25.4;

/**
 * Imprime o relatório atualmente aberto na aba Relatórios.
 *
 * `opcoes.paisagem` (pedido do usuário, Processo do Dia): imprime em
 * orientação paisagem em vez do padrão do navegador (retrato) — útil pra
 * relatórios com muitas colunas lado a lado.
 *
 * `opcoes.achatarEmUmaFolha` (pedido do usuário, Processo do Dia): mede o
 * tamanho natural (sem cortes) do conteúdo ANTES de montar a impressão e
 * calcula um fator de escala (nunca maior que 1) pra caber na área útil
 * aproximada de uma folha A4, aplicado via CSS transform numa dupla de
 * divs — a de fora reserva o espaço já na proporção final (senão o
 * navegador reservaria o espaço do tamanho ORIGINAL, não do encolhido, e o
 * conteúdo não ficaria garantido numa página só), a de dentro aplica o
 * transform propriamente dito. Quanto mais linhas o relatório tiver no
 * dia, menor o texto sai impresso — é o preço de garantir uma folha só
 * mesmo com uma lista que varia de tamanho dia a dia.
 */
export function imprimirRelatorioAtivo(titulo, subtitulo, opcoes = {}) {
  const { paisagem = false, achatarEmUmaFolha = false } = opcoes;
  const area = document.getElementById(ID_AREA_RELATORIO);
  if (!area) return false;

  // Mede o tamanho natural ANTES de montar o HTML de impressão — `area`
  // ainda é o elemento AO VIVO na tela aqui, então `scrollWidth`/
  // `scrollHeight` pegam o conteúdo inteiro mesmo que uma parte dele esteja
  // visualmente cortada/com scroll nesse momento.
  const larguraNatural = area.scrollWidth;
  // A altura, porém, PRECISA descontar o que tem `print:hidden` (ex.: a
  // barra de título/"Sequenciar lojas" e o botão de copiar como imagem do
  // Processo do Dia) — na TELA esses elementos ainda estão visíveis
  // normalmente (o `display:none` só entra em @media print), então contam
  // no scrollHeight medido aqui, mas não vão ocupar espaço nenhum no papel.
  // Sem descontar isso, o fator de escala calculado abaixo sai menor do que
  // precisava (encolhe mais do que o necessário).
  let alturaNatural = area.scrollHeight;
  area.querySelectorAll('.print\\:hidden').forEach((elementoOculto) => {
    const altura = elementoOculto.getBoundingClientRect().height;
    const estilo = window.getComputedStyle(elementoOculto);
    const margemVertical = parseFloat(estilo.marginTop || '0') + parseFloat(estilo.marginBottom || '0');
    alturaNatural -= altura + margemVertical;
  });

  // O relatório usa classes Tailwind "dark:..." — como a cópia impressa é
  // injetada dentro do próprio <html>, se o modo escuro estiver ativo ela
  // herdaria as cores escuras (texto claro sobre fundo transparente), o que
  // fica ilegível no papel. Por isso desativa o modo escuro só durante a
  // impressão e restaura assim que ela termina (evento "afterprint" — com
  // um limite de segurança caso o navegador não dispare esse evento, por
  // exemplo se o usuário cancelar sem chegar a imprimir).
  const raiz = document.documentElement;
  const estavaEscuro = raiz.classList.contains('dark');
  if (estavaEscuro) {
    raiz.classList.remove('dark');
    const restaurar = () => {
      raiz.classList.add('dark');
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    setTimeout(restaurar, 60000);
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // A regra @page de orientação (paisagem/retrato) é aplicada por
  // imprimirHtml() direto num <style> próprio no <head> (ver
  // definirOrientacaoDePagina em imprimirHtml.js) — não aqui embutida no
  // HTML do corpo copiado pra dentro da área de impressão. Tentativa
  // anterior fazia isso (um <style> dentro do próprio <body> impresso) e
  // não demonstrou aplicar a orientação de forma confiável no preview de
  // impressão do navegador.

  // Fator de escala pra caber numa folha só (ver comentário do JSDoc acima)
  // — a área útil aqui já desconta o padding de 12px do wrapper e o
  // cabeçalho (título/subtítulo/data) que entra ANTES do conteúdo
  // escalado, então o espaço disponível pro conteúdo em si é um pouco
  // menor que a folha inteira; ~28mm de folga cobre esse cabeçalho com
  // margem confortável pra a maioria dos casos.
  let aberturaEscala = '';
  let fechamentoEscala = '';
  if (achatarEmUmaFolha && larguraNatural > 0 && alturaNatural > 0) {
    const [larguraPaginaMm, alturaPaginaMm] = paisagem ? [277, 190] : [190, 277];
    const larguraMaxPx = larguraPaginaMm * PX_POR_MM;
    const alturaMaxPx = (alturaPaginaMm - 28) * PX_POR_MM;
    const fator = Math.min(1, larguraMaxPx / larguraNatural, alturaMaxPx / alturaNatural);
    // IMPORTANTE: a div de FORA precisa reservar o espaço já no tamanho
    // ESCALADO (largura E altura) — reservar só a altura escalada mas
    // deixar a largura no tamanho ORIGINAL (bug de uma versão anterior
    // desta função) faz o navegador enxergar um bloco bem mais largo que a
    // folha, e muitos navegadores reagem a isso aplicando um "encolher pra
    // caber" PRÓPRIO deles por cima do nosso — encolhendo tudo de novo,
    // bem mais do que o necessário, e empurrando o conteúdo pro canto
    // superior esquerdo da folha.
    const larguraEscaladaPx = Math.round(larguraNatural * fator);
    const alturaEscaladaPx = Math.round(alturaNatural * fator);
    aberturaEscala = `<div style="width:${larguraEscaladaPx}px;height:${alturaEscaladaPx}px;overflow:hidden;"><div style="width:${larguraNatural}px;transform:scale(${fator.toFixed(
      3
    )});transform-origin:top left;">`;
    fechamentoEscala = '</div></div>';
  }

  const html = `<!DOCTYPE html><html><body>
    <div style="padding:12px;background:#ffffff;color:#1e293b;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:2px solid #1e293b;padding-bottom:8px;margin-bottom:16px;">
        <div>
          <h1 style="font-size:16px;margin:0;font-weight:800;">${titulo}</h1>
          ${subtitulo ? `<p style="font-size:11px;color:#64748b;margin:2px 0 0;">${subtitulo}</p>` : ''}
        </div>
        <p style="font-size:10px;color:#94a3b8;margin:0;white-space:nowrap;">Doca Manager — ${dataHoje} às ${horaAgora}</p>
      </div>
      ${aberturaEscala}${area.innerHTML}${fechamentoEscala}
    </div>
  </body></html>`;

  return imprimirHtml(html, { paisagem });
}
