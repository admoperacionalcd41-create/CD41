import { getNomeBox } from './boxLogic';
import { hojeISO, formatarData } from './dateHelpers';

// Mensagens padrão enviadas por WhatsApp (ver NotifyWhatsappModal.jsx),
// centralizadas aqui para as duas situações que disparam notificação hoje:
// concluir um agrupamento e registrar um protocolo de carregamento.

// Ao concluir um agrupamento — só Loja, Carga e Box, por escolha do usuário
// (a mensagem deixa paletes/colaboradores/horário de fora de propósito).
export function montarMensagemAgrupamento(loja) {
  return [
    'Carga agrupada:',
    `Loja ${loja.loja} — ${loja.nomeLoja}`,
    `Carga: ${loja.carga}`,
    `Box: ${getNomeBox(loja.boxNumero)}`,
  ].join('\n');
}

// Ao registrar um protocolo de carregamento (veículo liberado) — tipo da
// carga (Seca/Resfriada), dia da entrega, motorista e placa do veículo, e a
// lista de lojas/cargas que saíram nele (uma ou várias, no caso de protocolo
// em lote), com a quantidade de paletes enviada de cada uma e se saiu
// completo ou com saldo.
//
// Formato pedido pelo usuário (cada loja agrupada sob a sua posição de
// entrega, na ordem em que o motorista vai entregar):
//   Carregamento liberado: Seca
//   Entrega: 29/10/2026
//   Motorista: Antonio
//   Placa: PDG-7863
//
//   [1ª entrega]
//   LOJA15 (ARCOVERDE) 11 paletes
//   CARGA: 103994
//
//   [2ª entrega]
//   LOJA33 (AECOVERDE) 4 paletes
//   CARGA: 103454
//
// Protocolo de uma loja só não tem posição de entrega (não há ordem a
// combinar), então sai sem o título "[Nª entrega]". Quando parte dos
// paletes ficou no box (envio com saldo), a linha da loja ganha o sufixo
// "— LOTE(s) 10, 11 ficou(aram)".
//
// `diaEntregaReferencia` (opcional, YYYY-MM-DD) vem do mesmo ajuste feito
// na hora de finalizar o carregamento (ver LoadingProtocolForm.jsx e
// diaReferenciaProtocolo em selectors.js) — carregamento feito hoje que só
// sai (ou só chega na loja) em outro dia. Pedido do usuário: mostrar
// também essa data na mensagem pra equipe, não só nos relatórios — sem
// informar nada, assume hoje (comportamento normal, sem ajuste).
const ROTULO_TIPO_CARGA = { seca: 'Seca', resfriada: 'Resfriada' };

function textoPaletes(qtd) {
  return `${qtd} ${Number(qtd) === 1 ? 'palete' : 'paletes'}`;
}

export function montarMensagemProtocolo({ placa, motorista, diaEntregaReferencia, itens }) {
  // Protocolo em lote (2+ lojas) traz a posição de entrega prevista de cada
  // uma (ver LoadingProtocolForm -> SequenciaCarregamentoCaminhao) — mostra
  // isso na mensagem pra equipe já saber a ordem de entrega combinada.
  const temSequencia = itens.length > 1 && itens.every((item) => item.posicaoEntrega != null);
  const itensOrdenados = temSequencia
    ? [...itens].sort((a, b) => a.posicaoEntrega - b.posicaoEntrega)
    : itens;

  // Tipo da carga do veículo: um protocolo nunca mistura seca com resfriada
  // (ver filtroTipoCarga), mas se algum dia misturar, lista os dois.
  const tipos = [...new Set(itens.map((item) => ROTULO_TIPO_CARGA[item.tipoCarga || 'seca'] || 'Seca'))];

  const blocosLojas = itensOrdenados.map((item) => {
    // Paletes (números das etiquetas, com a composição de lotes quando
    // houver — ex.: "2 (lotes 2 + 5)") que o operador marcou como tendo
    // ficado no box — só existe em envio parcial (ver LoadingProtocolForm).
    const lotes =
      item.statusEnvio === 'saldo' && item.lotesRestantesDescricao && item.lotesRestantesDescricao.length > 0
        ? ` — LOTE(s) ${item.lotesRestantesDescricao.join(', ')} ficou(aram)`
        : '';
    const linhas = [
      `${item.loja} (${item.nomeLoja}) ${textoPaletes(item.paletesEnviados)}${lotes}`,
      `CARGA: ${item.carga}`,
    ];
    return temSequencia ? [`[${item.posicaoEntrega}ª entrega]`, ...linhas].join('\n') : linhas.join('\n');
  });

  return [
    [
      `Carregamento liberado: ${tipos.join(' / ')}`,
      `Entrega: ${formatarData(diaEntregaReferencia || hojeISO())}`,
      `Motorista: ${motorista}`,
      `Placa: ${placa}`,
    ].join('\n'),
    ...blocosLojas,
  ].join('\n\n');
}

function pluralLoja(qtd) {
  return `${qtd} loja${qtd !== 1 ? 's' : ''}`;
}

// Mensagem de "Status da operação" (ver botão em Dashboard.jsx e
// getResumoStatusDoDia em selectors.js) — pedido do usuário: poder mandar
// pro WhatsApp o que foi gerado, o que já foi entregue e o % de volume
// concluído x pendente, pra atualizar quem está acompanhando sem precisar
// abrir o sistema. Duas versões, escolhidas na hora pelo usuário (toggle no
// modal): "enxuta" (só os totais) e "detalhada" (com a quebra por etapa).
export function montarMensagemStatusDoDia(resumo, { detalhado = false } = {}) {
  const cabecalho = `Status da operação — ${formatarData(resumo.data)}`;
  const lojasPendentes = resumo.lojasGeradas - resumo.lojasEntregues;

  if (!detalhado) {
    return [
      cabecalho,
      `Gerado: ${pluralLoja(resumo.lojasGeradas)} / ${resumo.paletesGerados} paletes`,
      `Entregue: ${pluralLoja(resumo.lojasEntregues)} / ${resumo.paletesEntregues} paletes`,
      `Pendente: ${pluralLoja(lojasPendentes)} / ${resumo.paletesPendentes} paletes`,
      `Volume concluído: ${resumo.percentualConcluido}%`,
    ].join('\n');
  }

  const percentualPendente = 100 - resumo.percentualConcluido;
  return [
    cabecalho,
    'GERADO',
    `${pluralLoja(resumo.lojasGeradas)} / ${resumo.paletesGerados} paletes`,
    'POR ETAPA',
    `Pendente: ${pluralLoja(resumo.porEtapa.pendente)}`,
    `Em agrupamento: ${pluralLoja(resumo.porEtapa.emAgrupamento)}`,
    `Prontas p/ carregar: ${pluralLoja(resumo.porEtapa.prontasParaCarregar)}`,
    `Em carregamento: ${pluralLoja(resumo.porEtapa.emCarregamento)}`,
    `Entregues: ${pluralLoja(resumo.porEtapa.entregues)}`,
    'ENTREGUE',
    `${resumo.paletesEntregues} paletes enviados (${resumo.percentualConcluido}% do volume gerado)`,
    `Pendente: ${resumo.paletesPendentes} paletes (${percentualPendente}%)`,
  ].join('\n');
}
