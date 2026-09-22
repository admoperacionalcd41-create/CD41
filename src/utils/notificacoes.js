import { getNomeBox } from './boxLogic';

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

// Ao registrar um protocolo de carregamento (veículo liberado) — placa e
// motorista do veículo, e a lista de lojas/cargas que saíram nele (uma ou
// várias, no caso de protocolo em lote), com a quantidade de paletes
// enviada de cada uma e se saiu completo ou com saldo.
export function montarMensagemProtocolo({ placa, motorista, itens }) {
  // Protocolo em lote (2+ lojas) traz a posição de entrega prevista de cada
  // uma (ver LoadingProtocolForm -> SequenciaCarregamentoCaminhao) — mostra
  // isso na mensagem pra equipe já saber a ordem de entrega combinada.
  const temSequencia = itens.length > 1 && itens.every((item) => item.posicaoEntrega != null);
  const linhasLojas = itens.map((item) => {
    const status = item.statusEnvio === 'saldo' ? ' (saldo — envio parcial)' : '';
    const sequencia = temSequencia ? ` [${item.posicaoEntrega}ª entrega]` : '';
    return `${item.carga} — Loja ${item.loja} (${item.nomeLoja}): ${item.paletesEnviados} pal.${status}${sequencia}`;
  });

  return ['Carregamento liberado:', `Placa: ${placa}`, `Motorista: ${motorista}`, ...linhasLojas].join('\n');
}
