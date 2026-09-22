import { eHoje } from './dateHelpers';

/** Lojas cujo dia de referência é o dia operacional atual (state.diaAtual). */
export function getLojasDoDia(state) {
  return state.lojas.filter((l) => l.diaReferencia === state.diaAtual);
}

/** Lojas pendentes (ainda não agrupadas) criadas hoje. */
export function getPendentesHoje(state) {
  return getLojasDoDia(state).filter((l) => l.status === 'pendente');
}

/**
 * Saldo acumulado: lojas de dias anteriores (diaReferencia < diaAtual) que
 * ainda não foram finalizadas — continuam pendentes/em processo.
 */
export function getSaldoAnterior(state) {
  return state.lojas.filter(
    (l) => l.diaReferencia !== state.diaAtual && l.status !== 'finalizada'
  );
}

/** Total de lojas pendentes = pendentes de hoje + saldo acumulado de dias anteriores. */
export function getTotalPendentes(state) {
  return getPendentesHoje(state).length + getSaldoAnterior(state).length;
}

/** Lojas com carregamento em andamento (protocolo iniciado, aguardando finalização). */
export function getLojasEmCarregamento(state) {
  return state.lojas.filter((l) => l.status === 'carregando');
}

/** Lojas prontas para iniciar carregamento (já agrupadas em um box). */
export function getLojasProntasParaCarregar(state) {
  return state.lojas.filter((l) => l.status === 'agrupada');
}

/** Lojas finalizadas cujo carregamento ocorreu no dia real de hoje (relógio). */
export function getFinalizadasHoje(state) {
  return state.lojas.filter((l) => l.status === 'finalizada' && eHoje(l.dataCarregamento));
}

/**
 * Protocolos de carregamento (COMPLETOS ou parciais/saldo — os dois contam
 * como "saiu do CD") de lojas com um código específico, opcionalmente
 * filtrados por tipo de carga. Um envio parcial não muda o status da loja
 * para "finalizada" (ela volta pra fila com o saldo restante), mas os
 * paletes daquele protocolo já saíram de verdade — por isso o relatório de
 * meta usa os protocolos como fonte, não o status da loja.
 */
function getProtocolosDoCodigoLoja(state, codigo, tipoCarga) {
  const idsLojaDoCodigo = new Set(
    state.lojas.filter((l) => l.loja === codigo && (!tipoCarga || l.tipoCarga === tipoCarga)).map((l) => l.id)
  );
  return state.protocolos.filter((p) => idsLojaDoCodigo.has(p.lojaId));
}

/**
 * Quantidade de códigos de loja distintos que tiveram qualquer protocolo de
 * carregamento (completo ou parcial/saldo) registrado em uma data
 * específica (YYYY-MM-DD, relógio real), opcionalmente filtrada por tipo
 * de carga. Usado nos números gerais do relatório de meta diária.
 */
export function getCodigosEntreguesNaData(state, dataISO, tipoCarga) {
  const codigos = new Set();
  state.protocolos.forEach((p) => {
    if (!p.dataHora || p.dataHora.slice(0, 10) !== dataISO) return;
    const loja = state.lojas.find((l) => l.id === p.lojaId);
    if (!loja) return;
    if (tipoCarga && loja.tipoCarga !== tipoCarga) return;
    codigos.add(loja.loja);
  });
  return codigos.size;
}

/**
 * Códigos de loja (ex.: "0403") distintos que tiveram alguma referência
 * dentro do período informado (normalmente os dias úteis da semana atual),
 * opcionalmente filtrados por tipo de carga ('seca'/'resfriada' — omitido
 * ou nulo considera os dois tipos). Usado para montar a análise individual
 * por loja no relatório de meta diária (cada código é a mesma loja física,
 * mesmo que uma nova "carga"/registro seja importado a cada dia).
 */
export function getCodigosLojaNoPeriodo(state, diasISO, tipoCarga) {
  const mapa = new Map();
  const diasSet = new Set(diasISO);

  // Lojas cujo dia de referência (data em que a carga foi importada) cai
  // dentro do período.
  state.lojas.forEach((l) => {
    if (tipoCarga && l.tipoCarga !== tipoCarga) return;
    if (!diasSet.has(l.diaReferencia)) return;
    mapa.set(l.loja, l.nomeLoja);
  });

  // Lojas que tiveram algum protocolo de carregamento (completo ou
  // parcial/saldo) registrado dentro do período, mesmo que o diaReferencia
  // da loja seja de uma semana anterior — ex.: saldo de sexta-feira que só
  // foi carregado na segunda-feira da semana seguinte. Sem isso, assim que
  // a semana civil vira, a loja "some" da análise por loja mesmo tendo uma
  // entrega de verdade registrada nesta semana.
  state.protocolos.forEach((p) => {
    if (!p.dataHora || !diasSet.has(p.dataHora.slice(0, 10))) return;
    const loja = state.lojas.find((l) => l.id === p.lojaId);
    if (!loja) return;
    if (tipoCarga && loja.tipoCarga !== tipoCarga) return;
    if (!mapa.has(loja.loja)) mapa.set(loja.loja, loja.nomeLoja);
  });

  return [...mapa.entries()]
    .map(([codigo, nomeLoja]) => ({ codigo, nomeLoja }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/**
 * Situação de um código de loja em uma data específica, pra análise por
 * loja do relatório de meta: se ela tinha algo programado nesse dia
 * (`temAtividade`), se realmente saiu carga (`entregue` — completo OU
 * parcial/saldo já contam) e a soma de paletes que efetivamente saiu
 * (`paletes`). Uma loja com envio parcial fica com saldo (status volta pra
 * "agrupada"), mas o que já saiu do CD nesse dia precisa aparecer aqui —
 * por isso a origem da verdade são os protocolos, não o status da loja.
 */
export function getEntregaCodigoLojaNaData(state, codigo, dataISO, tipoCarga) {
  const protocolosNoDia = getProtocolosDoCodigoLoja(state, codigo, tipoCarga).filter(
    (p) => p.dataHora && p.dataHora.slice(0, 10) === dataISO
  );
  const paletes = protocolosNoDia.reduce((soma, p) => soma + (Number(p.paletesEnviados) || 0), 0);
  // Se algum dos protocolos do dia ficou com saldo (envio parcial), marca
  // como parcial — mesmo que outro protocolo do mesmo dia tenha fechado o
  // restante, é informação relevante pra diretoria ver que não saiu tudo
  // de uma vez só.
  const parcial = protocolosNoDia.some((p) => p.statusEnvio === 'saldo');

  // "Programada nesse dia" cobre tanto o dia em que a loja foi importada
  // (diaReferencia) quanto qualquer dia posterior em que um saldo dela
  // acabou sendo carregado (a loja continua com o diaReferencia original,
  // mas o protocolo do saldo tem a data real do novo carregamento).
  const importadaNoDia = state.lojas.some(
    (l) => l.loja === codigo && (!tipoCarga || l.tipoCarga === tipoCarga) && l.diaReferencia === dataISO
  );
  const temAtividade = importadaNoDia || protocolosNoDia.length > 0;

  return { temAtividade, entregue: protocolosNoDia.length > 0, paletes, parcial };
}

export function getResumoDashboard(state) {
  return {
    planejadasHoje: getLojasDoDia(state).length,
    finalizadas: getFinalizadasHoje(state).length,
    pendentes: getTotalPendentes(state),
    pendentesHoje: getPendentesHoje(state).length,
    saldoAnterior: getSaldoAnterior(state).length,
    emCarregamento: getLojasEmCarregamento(state).length,
  };
}

export function getLojaPorId(state, lojaId) {
  return state.lojas.find((l) => l.id === lojaId) || null;
}

export function getBoxPorNumero(state, numero) {
  return state.boxes.find((b) => b.numero === numero) || null;
}

/**
 * Lojas que já têm colaboradores sinalizados no agrupamento (a partir do
 * início do agrupamento em diante) — usadas no relatório de produtividade.
 * Não inclui 'apontada', pois nessa etapa ainda não há colaboradores
 * definidos (apenas o box foi reservado).
 */
export function getLojasAgrupadasOuAlem(state) {
  return state.lojas.filter((l) =>
    ['em_agrupamento', 'agrupada', 'carregando', 'finalizada'].includes(l.status)
  );
}

/**
 * Protocolos com chegada E saída já registradas pelo motorista na loja (ver
 * aba Motoristas), já com os dados da loja anexados e a permanência
 * calculada em milissegundos — usado no relatório de tempo de permanência.
 * Um protocolo sem essas duas marcações (motorista ainda não passou pela
 * loja, ou ainda está lá) não entra, porque a permanência não dá pra
 * calcular ainda. Opcionalmente filtrado por tipo de carga.
 */
export function getPermanenciasRegistradas(state, tipoCarga) {
  return state.protocolos
    .filter((p) => p.chegadaLoja && p.saidaLoja)
    .map((p) => ({ protocolo: p, loja: state.lojas.find((l) => l.id === p.lojaId) }))
    .filter(({ loja }) => loja && (!tipoCarga || loja.tipoCarga === tipoCarga))
    .map(({ protocolo, loja }) => ({
      id: protocolo.id,
      loja,
      placa: protocolo.placa,
      motorista: protocolo.motorista,
      chegadaLoja: protocolo.chegadaLoja,
      saidaLoja: protocolo.saidaLoja,
      permanenciaMs: new Date(protocolo.saidaLoja) - new Date(protocolo.chegadaLoja),
    }));
}

/**
 * Quantidade de lojas distintas entregues por motorista — considera
 * qualquer protocolo de carregamento (completo ou parcial/saldo: se o
 * motorista levou parte da carga pra loja, ela conta como entregue por
 * ele), contando cada código de loja uma única vez por motorista mesmo que
 * tenha mais de um protocolo pra ela (ex.: uma entrega parcial seguida do
 * saldo, ambas no mesmo veículo). Opcionalmente filtrado por tipo de carga
 * e por uma função de filtro de data (recebe `protocolo.dataHora`).
 */
export function getEntregasPorMotorista(state, tipoCarga, filtroData) {
  const porMotorista = new Map(); // nome do motorista -> Set de códigos de loja

  state.protocolos.forEach((p) => {
    const nomeMotorista = (p.motorista || '').trim();
    if (!nomeMotorista) return;
    if (filtroData && !filtroData(p.dataHora)) return;
    const loja = state.lojas.find((l) => l.id === p.lojaId);
    if (!loja) return;
    if (tipoCarga && loja.tipoCarga !== tipoCarga) return;

    if (!porMotorista.has(nomeMotorista)) porMotorista.set(nomeMotorista, new Set());
    porMotorista.get(nomeMotorista).add(loja.loja);
  });

  return [...porMotorista.entries()]
    .map(([motorista, codigos]) => ({ motorista, lojasEntregues: codigos.size }))
    .sort((a, b) => b.lojasEntregues - a.lojasEntregues || a.motorista.localeCompare(b.motorista));
}
