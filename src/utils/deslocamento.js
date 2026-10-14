// Tempo de deslocamento do motorista entre dois pontos de uma viagem:
//   - do CD até a primeira loja de uma viagem (ou até qualquer carregamento
//     independente, mesmo não sendo o primeiro do veículo no dia — ver
//     inicioDeslocamento abaixo): da entrega das notas fiscais (o momento
//     real da saída do CD — ver REGISTRAR_ENTREGA_NF em AppContext.jsx; cai
//     para `dataHora` do carregamento se a NF ainda não foi registrada) até
//     a chegada na loja.
//   - de uma loja até a próxima, DENTRO da mesma viagem (mesmo `viagemId`,
//     carregadas juntas no mesmo caminhão): da saída registrada numa loja
//     até a chegada na seguinte.
// Centralizado aqui porque é usado tanto em Motoristas (DriversPage.jsx)
// quanto no card Andamento das Entregas (AndamentoEntregasCard.jsx), e as
// duas telas precisam enxergar exatamente a mesma conta.

/**
 * Ordena as entregas de um mesmo veículo na sequência real da viagem: pela
 * posição de entrega combinada quando fazem parte do mesmo carregamento em
 * lote (ver posicaoEntrega/viagemId em LoadingProtocolForm.jsx — só vale
 * comparar posicaoEntrega entre entregas da mesma viagem), senão pelo
 * horário do carregamento (dataHora), única referência de ordem disponível
 * fora de um lote.
 */
export function ordenarEntregasDaViagem(entregas) {
  return [...entregas].sort((a, b) => {
    if (a.viagemId && a.viagemId === b.viagemId && a.posicaoEntrega != null && b.posicaoEntrega != null) {
      return a.posicaoEntrega - b.posicaoEntrega;
    }
    return new Date(a.dataHora) - new Date(b.dataHora);
  });
}

/**
 * Horário em que o motorista saiu rumo a esta entrega: a saída da loja
 * anterior, MAS só quando as duas entregas são de verdade a mesma viagem —
 * carregadas juntas no mesmo caminhão, numa viagem com várias lojas (mesmo
 * `viagemId`, ver FINALIZAR_CARREGAMENTO_MULTIPLO em AppContext.jsx).
 * `null` se a loja anterior ainda não tem saída registrada (o deslocamento
 * desta ainda nem começou).
 *
 * Fora desse caso — cada protocolo é um carregamento independente, feito de
 * novo no CD, mesmo que o veículo seja o mesmo e tenha sido logo depois do
 * anterior. Isso inclui o caso de entrega parcial: quando sobra saldo, ele
 * volta pra fila e é carregado de novo depois, gerando um protocolo novo
 * pra MESMA loja — mas é uma saída nova do CD, não uma continuação da
 * viagem anterior. Por isso aqui conta como se fosse a primeira parada de
 * uma viagem nova: a partir da entrega das notas fiscais deste próprio
 * protocolo (cai para `dataHora` do carregamento se a NF ainda não foi
 * registrada). Sem essa checagem, o saldo de uma entrega parcial acabava
 * herdando o deslocamento (e o tempo) da primeira entrega, em vez de ter o
 * seu próprio.
 */
export function inicioDeslocamento(entrega, entregaAnterior) {
  const mesmaViagem = Boolean(
    entregaAnterior && entrega.viagemId && entregaAnterior.viagemId === entrega.viagemId
  );
  if (mesmaViagem) return entregaAnterior.saidaLoja || null;
  return entrega.entregaNotasFiscais || entrega.dataHora;
}

/**
 * Tempo de deslocamento até esta entrega. `null` quando ainda não dá pra
 * calcular (loja anterior sem saída registrada). Enquanto a chegada desta
 * entrega ainda não foi registrada, usa `agoraMs` como fim provisório
 * (`emAndamento: true`) — mesma ideia já usada pra permanência na loja.
 */
export function calcularDeslocamento(entrega, entregaAnterior, agoraMs) {
  const inicio = inicioDeslocamento(entrega, entregaAnterior);
  if (!inicio) return null;
  const fimMs = entrega.chegadaLoja ? new Date(entrega.chegadaLoja).getTime() : agoraMs;
  const ms = fimMs - new Date(inicio).getTime();
  if (ms < 0) return null;
  return { ms, emAndamento: !entrega.chegadaLoja };
}

/**
 * A partir das entregas de UM veículo (já filtradas, em qualquer ordem),
 * monta um Map(protocoloId -> deslocamento) com o deslocamento de cada uma
 * até a entrega anterior na viagem (ver calcularDeslocamento acima).
 */
export function mapaDeslocamentoPorVeiculo(entregasDoVeiculo, agoraMs) {
  const ordenadas = ordenarEntregasDaViagem(entregasDoVeiculo);
  const mapa = new Map();
  ordenadas.forEach((entrega, indice) => {
    const anterior = indice > 0 ? ordenadas[indice - 1] : null;
    mapa.set(entrega.id, calcularDeslocamento(entrega, anterior, agoraMs));
  });
  return mapa;
}
