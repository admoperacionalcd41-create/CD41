// Tempo de deslocamento do motorista entre dois pontos de uma viagem:
//   - do CD até a primeira loja: da entrega das notas fiscais (o momento
//     real da saída do CD — ver REGISTRAR_ENTREGA_NF em AppContext.jsx; cai
//     para `dataHora` do carregamento se a NF ainda não foi registrada) até
//     a chegada na loja.
//   - de uma loja até a próxima, na mesma viagem: da saída registrada numa
//     loja até a chegada na seguinte.
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
 * anterior na mesma viagem (`null` se a loja anterior ainda não tem saída
 * registrada — o deslocamento desta ainda nem começou), ou — se for a
 * primeira parada da viagem — a entrega das notas fiscais (cai para
 * `dataHora` do carregamento se ainda não houver NF registrada).
 */
export function inicioDeslocamento(entrega, entregaAnterior) {
  if (entregaAnterior) return entregaAnterior.saidaLoja || null;
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
