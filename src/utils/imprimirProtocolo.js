import { formatarDataHora } from './dateHelpers';
import { getNomeBox } from './boxLogic';
import { imprimirHtml } from './imprimirHtml';

// Monta um documento HTML autônomo com os dados de um protocolo de
// carregamento, para imprimir dentro da própria página — mesma estratégia
// usada em LabelGenerator.jsx (ver imprimirHtml.js para o motivo de não
// usar window.open()/iframe separado nem depender só de window.print()).
//
// `outrasLojas` é a lista das demais lojas da mesma viagem em lote (quando
// houver), cada uma como { carga, loja, nomeLoja, paletesEnviados } — usada
// só para o motorista ter, no papel, a relação completa do que está sendo
// transportado naquele veículo.
function montarHtmlProtocolo(protocolo, loja, outrasLojas) {
  const estilo = `
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 24px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitulo { font-size: 12px; color: #64748b; margin: 0 0 20px; }
    .secao { margin-bottom: 16px; }
    .rotulo { font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0; }
    .valor { font-size: 14px; font-weight: 700; margin: 2px 0 0; }
    .grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th, td { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
    th { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; }
    tfoot td { font-weight: 700; border-top: 2px solid #1e293b; border-bottom: none; }
    .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
    .linha-assinatura { border-top: 1px solid #1e293b; padding-top: 6px; font-size: 11px; color: #64748b; text-align: center; }
    @media print { body { padding: 12px; } }
  `;

  const todasLojas = [
    {
      carga: loja.carga,
      loja: loja.loja,
      nomeLoja: loja.nomeLoja,
      paletesEnviados: protocolo.paletesEnviados,
      posicaoCarregamento: protocolo.posicaoCarregamento,
      posicaoEntrega: protocolo.posicaoEntrega,
    },
    ...outrasLojas,
  ];
  const totalPaletes = todasLojas.reduce((soma, l) => soma + l.paletesEnviados, 0);
  // Sequência de carregamento só faz sentido (e só existe) pra protocolo em
  // lote, com 2+ lojas no mesmo veículo — ver SequenciaCarregamentoCaminhao.
  const temSequencia = todasLojas.length > 1 && todasLojas.every((l) => l.posicaoEntrega != null);
  // Ordena a tabela impressa pela ordem de entrega (1ª entrega primeiro) —
  // é o que o motorista vai seguir na rua, mais útil no papel do que a
  // ordem de carregamento.
  const lojasParaImprimir = temSequencia
    ? [...todasLojas].sort((a, b) => a.posicaoEntrega - b.posicaoEntrega)
    : todasLojas;

  const linhasLojas = lojasParaImprimir
    .map(
      (l) => `
    <tr>
      ${temSequencia ? `<td>${l.posicaoEntrega}ª</td>` : ''}
      <td>${l.carga}</td>
      <td>${l.loja}</td>
      <td>${l.nomeLoja}</td>
      <td>${l.paletesEnviados}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Protocolo — ${protocolo.placa} — ${formatarDataHora(protocolo.dataHora)}</title>
<style>${estilo}</style>
</head>
<body>
  <h1>Protocolo de Carregamento</h1>
  <p class="subtitulo">Emitido em ${formatarDataHora(new Date().toISOString())}</p>

  <div class="grade">
    <div><p class="rotulo">Placa do veículo</p><p class="valor">${protocolo.placa}</p></div>
    <div><p class="rotulo">Motorista</p><p class="valor">${protocolo.motorista}</p></div>
    <div><p class="rotulo">Data/Hora do carregamento</p><p class="valor">${formatarDataHora(protocolo.dataHora)}</p></div>
    <div><p class="rotulo">Lacres</p><p class="valor">${protocolo.lacres.filter(Boolean).join(', ') || '—'}</p></div>
    <div><p class="rotulo">Status de envio</p><p class="valor">${protocolo.statusEnvio === 'completo' ? 'Completo' : 'Saldo (envio parcial)'}</p></div>
    <div><p class="rotulo">Box de origem</p><p class="valor">${getNomeBox(loja.boxNumero)}</p></div>
  </div>

  <div class="secao">
    <p class="rotulo">${todasLojas.length > 1 ? `Lojas neste veículo (${todasLojas.length})` : 'Loja'}</p>
    ${temSequencia ? '<p class="rotulo" style="margin-top:-2px;margin-bottom:8px;">Ordenado pela sequência de entrega combinada (1ª entrega primeiro)</p>' : ''}
    <table>
      <thead>
        <tr>
          ${temSequencia ? '<th>Entrega</th>' : ''}
          <th>Carga</th><th>Loja</th><th>Nome da Loja</th><th>Paletes</th>
        </tr>
      </thead>
      <tbody>${linhasLojas}</tbody>
      ${todasLojas.length > 1 ? `<tfoot><tr><td colspan="${temSequencia ? 4 : 3}">Total</td><td>${totalPaletes}</td></tr></tfoot>` : ''}
    </table>
  </div>

  <div class="assinaturas">
    <div class="linha-assinatura">Assinatura do Motorista</div>
    <div class="linha-assinatura">Assinatura do Conferente</div>
  </div>
</body>
</html>`;
}

// Monta o documento do protocolo e prepara a impressão dentro da própria
// página (ver imprimirHtml.js) — evita tanto o bloqueio de pop-up quanto o
// bloqueio de window.print() via script que o sandbox da pré-visualização
// de um Artifact aplica.
export function imprimirProtocolo(protocolo, loja, outrasLojas = []) {
  return imprimirHtml(montarHtmlProtocolo(protocolo, loja, outrasLojas));
}
