import { imprimirHtml } from './imprimirHtml';

// Imprime o relatório atualmente aberto na aba Relatórios — usa a mesma
// técnica de LabelGenerator.jsx/imprimirProtocolo.js (ver imprimirHtml.js
// para o motivo: window.print() via script é bloqueado silenciosamente
// dentro do sandbox do preview do Artifact, então o conteúdo é preparado na
// própria página e o usuário aciona a impressão via Ctrl+P/Cmd+P quando o
// disparo automático não funcionar).
const ID_AREA_RELATORIO = 'area-impressao-relatorio';

export function imprimirRelatorioAtivo(titulo, subtitulo) {
  const area = document.getElementById(ID_AREA_RELATORIO);
  if (!area) return false;

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

  const html = `<!DOCTYPE html><html><body>
    <div style="padding:12px;background:#ffffff;color:#1e293b;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:2px solid #1e293b;padding-bottom:8px;margin-bottom:16px;">
        <div>
          <h1 style="font-size:16px;margin:0;font-weight:800;">${titulo}</h1>
          ${subtitulo ? `<p style="font-size:11px;color:#64748b;margin:2px 0 0;">${subtitulo}</p>` : ''}
        </div>
        <p style="font-size:10px;color:#94a3b8;margin:0;white-space:nowrap;">Doca Manager — ${dataHoje} às ${horaAgora}</p>
      </div>
      ${area.innerHTML}
    </div>
  </body></html>`;

  return imprimirHtml(html);
}
