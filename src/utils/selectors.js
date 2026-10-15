import { eHoje } from './dateHelpers';
import { lojaPassaFiltroTipoCarga } from './tipoCarga';

/**
 * "Dia de referência" de um protocolo de carregamento para os relatórios
 * que agrupam/filtram por data (Meta de Entrega, Entregas por Motorista, e
 * a data usada na Exportação de Excel desses dois). Normalmente é o dia
 * real em que o carregamento foi registrado (`protocolo.dataHora`), mas o
 * operador pode sobrescrever isso informando `diaEntregaReferencia`
 * (YYYY-MM-DD) na hora de finalizar o carregamento — pedido do usuário:
 * carregamento feito num dia que só sai (ou só chega na loja) em outro dia,
 * sem uma regra fixa de "sempre o dia seguinte" (ex.: carregado sexta à
 * tarde, mas só sai no sábado, ou só na segunda — varia). `dataHora` em si
 * NUNCA é alterado por isso — continua sendo sempre o horário real do
 * registro, preservado como auditoria; só a CONTAGEM nos relatórios por
 * data muda. Funciona com os helpers existentes em dateHelpers.js (eHoje,
 * eEsteMes, eNoMes, slice(0, N)) porque tanto um datetime ISO completo
 * quanto uma data "YYYY-MM-DD" pura respondem igual a esses recortes.
 */
export function diaReferenciaProtocolo(protocolo) {
  return protocolo.diaEntregaReferencia || protocolo.dataHora;
}

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
    if (!p.dataHora || diaReferenciaProtocolo(p).slice(0, 10) !== dataISO) return;
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
    if (!p.dataHora || !diasSet.has(diaReferenciaProtocolo(p).slice(0, 10))) return;
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
    (p) => p.dataHora && diaReferenciaProtocolo(p).slice(0, 10) === dataISO
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

/**
 * Soma peso/volume de um conjunto de lojas. Alguns registros importados
 * podem não ter peso/volume informado (formato simplificado) — nesse caso o
 * campo fica null e é ignorado na soma; `tem` decide se o dado deve aparecer
 * na tela (para não mostrar "0 kg" quando ninguém informou esse dado).
 * Compartilhado pelo Dashboard e pelo card de resumo operacional da aba
 * Box / Frota, pra não ter duas implementações que podem divergir.
 */
export function calcularPesoVolume(lojas) {
  const peso = lojas.reduce((soma, l) => soma + (l.peso ?? 0), 0);
  const volume = lojas.reduce((soma, l) => soma + (l.volume ?? 0), 0);
  const tem = lojas.some((l) => l.peso != null || l.volume != null);
  return { peso, volume, tem };
}

/**
 * Lista de todas as lojas já conhecidas pelo sistema — todo código já visto
 * em alguma importação, em qualquer dia (não existe cadastro à parte com as
 * lojas fixas, então o histórico de `state.lojas` faz esse papel; mesma
 * base usada em getLinhasProcessoDoDia logo abaixo). Cada item é só
 * `{ codigo, nomeLoja }` (o nome mais recente visto pra esse código) — sem
 * nenhuma informação de apontamento/carregamento/dia.
 *
 * Usada no modal de Observações das Lojas (ver ObservacoesLojaModal.jsx)
 * pra listar TODAS as lojas conhecidas, não só as importadas hoje — pedido
 * do usuário: permitir anotar uma loja mesmo sem carga hoje, já que a
 * observação agora é da loja (ver DEFINIR_OBSERVACAO_LOJA em
 * AppContext.jsx), não de uma carga específica.
 */
export function getLojasConhecidas(state) {
  const lojasConhecidas = new Map();
  state.lojas.forEach((l) => {
    const atual = lojasConhecidas.get(l.loja);
    // Guarda a dataImportacao junto (não só o nome) pra essa comparação
    // realmente conseguir decidir qual ocorrência é a mais recente.
    if (!atual || new Date(l.dataImportacao) >= new Date(atual.dataImportacao)) {
      lojasConhecidas.set(l.loja, { nomeLoja: l.nomeLoja, dataImportacao: l.dataImportacao });
    }
  });
  return Array.from(lojasConhecidas.entries())
    .map(([codigo, info]) => ({ codigo, nomeLoja: info.nomeLoja }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' }));
}

/**
 * Uma linha por CÓDIGO de loja (não por carga — ver comentário em
 * DailyProcessReport.jsx) com o apontamento/carregamento feitos hoje. Base
 * do relatório "Processo do Dia" — extraído pra selectors.js pra poder ser
 * reaproveitado também no card de resumo operacional da aba Box / Frota,
 * sem duplicar essa lógica (e sem os dois lugares divergindo com o tempo).
 *
 * A COLUNA LOJA sempre traz as lojas fixas (todo código já visto em alguma
 * importação anterior, não só hoje — não existe cadastro à parte com as
 * lojas fixas, então o histórico faz esse papel), mesmo sem carga
 * importada hoje; apontamento/carregamento só validam o que foi feito hoje
 * de verdade (relógio real, ver eHoje — não o dia operacional, que só
 * avança ao clicar em "Encerrar Dia" e pode ficar parado por mais de um
 * dia).
 */
export function getLinhasProcessoDoDia(state, filtroTipoCarga) {
  const lojasConhecidas = new Map();
  state.lojas.forEach((l) => {
    const atual = lojasConhecidas.get(l.loja);
    if (!atual || new Date(l.dataImportacao) >= new Date(atual.dataImportacao)) {
      lojasConhecidas.set(l.loja, { nomeLoja: l.nomeLoja, tipoCarga: l.tipoCarga || 'seca' });
    }
  });

  const cargasHojePorCodigo = new Map();
  getLojasDoDia(state).forEach((loja) => {
    const protocolosDaLoja = state.protocolos.filter((p) => p.lojaId === loja.id);
    // Pedido do usuário: "os relatórios devem considerar o dia da entrega,
    // não o dia que carregou o veículo" — vale também aqui (Processo do
    // Dia e o card de Andamento das Entregas, que reaproveita esta mesma
    // função). Em vez de `loja.dataCarregamento`/`p.dataHora` (dia real do
    // registro), usa diaReferenciaProtocolo (dia real, OU o dia informado
    // em diaEntregaReferencia quando o carregamento foi marcado pra contar
    // em outro dia — ver LoadingProtocolForm.jsx). Um carregamento marcado
    // assim só aparece como "Feito" aqui no dia de entrega, não no dia em
    // que o caminhão saiu de verdade do CD.
    const protocoloCompletoMaisRecente = protocolosDaLoja
      .filter((p) => p.statusEnvio === 'completo')
      .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))[0];
    const diaCompletoRef = protocoloCompletoMaisRecente
      ? diaReferenciaProtocolo(protocoloCompletoMaisRecente)
      : loja.dataCarregamento;
    const situacaoChave =
      loja.status === 'finalizada' && eHoje(diaCompletoRef)
        ? 'completo'
        : protocolosDaLoja.some((p) => p.statusEnvio === 'saldo' && eHoje(diaReferenciaProtocolo(p)))
        ? 'parcial'
        : loja.status === 'carregando'
        ? 'em_andamento'
        : 'pendente';
    const carga = {
      numero: loja.carga,
      tipoCarga: loja.tipoCarga,
      apontada: loja.status !== 'pendente' && eHoje(loja.dataApontamento),
      situacaoChave,
    };
    if (!cargasHojePorCodigo.has(loja.loja)) cargasHojePorCodigo.set(loja.loja, []);
    cargasHojePorCodigo.get(loja.loja).push(carga);
  });

  return Array.from(lojasConhecidas.entries())
    .map(([codigo, info]) => {
      const cargas = cargasHojePorCodigo.get(codigo) || [];
      const tiposCarga = cargas.length > 0 ? [...new Set(cargas.map((c) => c.tipoCarga))] : [info.tipoCarga];
      const apontamentoFeito = cargas.some((c) => c.apontada);
      const apontamentoContagem = cargas.filter((c) => c.apontada).length;
      const carregamentoFeito = cargas.some((c) => c.situacaoChave === 'completo' || c.situacaoChave === 'parcial');
      const carregamentoContagem = cargas.filter(
        (c) => c.situacaoChave === 'completo' || c.situacaoChave === 'parcial'
      ).length;
      const completo = apontamentoFeito && carregamentoFeito;
      return {
        codigo,
        nomeLoja: info.nomeLoja,
        cargas,
        tiposCarga,
        apontamentoFeito,
        apontamentoContagem,
        carregamentoFeito,
        carregamentoContagem,
        completo,
      };
    })
    .filter((loja) => loja.tiposCarga.some((tipo) => lojaPassaFiltroTipoCarga({ tipoCarga: tipo }, filtroTipoCarga)))
    .sort((a, b) => {
      if (a.completo !== b.completo) return a.completo ? 1 : -1;
      return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
}

/**
 * Cargas IMPORTADAS hoje de verdade (dataImportacao no calendário real, via
 * eHoje — não o dia operacional/diaReferencia, que só avança quando alguém
 * aciona "avançar dia" e por isso pode misturar cargas importadas ontem
 * ainda dentro do mesmo ciclo operacional) que AINDA NÃO tiveram apontamento
 * feito hoje. Usada pro peso/volume "pendente de apontamento" no card de
 * resumo operacional da aba Box / Frota — pedido do usuário pra validar
 * só as cargas realmente importadas hoje, e não o saldo de dias anteriores
 * que porventura ainda esteja no mesmo dia operacional.
 */
export function getLojasSemApontamentoHoje(state) {
  return state.lojas
    .filter((l) => eHoje(l.dataImportacao))
    .filter((l) => !(l.status !== 'pendente' && eHoje(l.dataApontamento)));
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

/**
 * Resumo do status operacional do dia — base da mensagem de WhatsApp
 * "Status da operação" (ver montarMensagemStatusDoDia em notificacoes.js e
 * o botão em Dashboard.jsx). Usa o mesmo recorte de "hoje" do resto do
 * Dashboard (getLojasDoDia — dia operacional, state.diaAtual).
 *
 * "Gerado" é o volume total informado/planejado para essas lojas
 * (paletesPlanejados, o valor trazido na importação); cai para o valor mais
 * recente conhecido (apontado, depois agrupado) só em registros antigos que
 * não tragam paletesPlanejados preenchido.
 *
 * "Entregue" soma paletesEnviados de TODOS os protocolos dessas lojas,
 * completos OU parciais/saldo — pedido do usuário: um envio parcial já
 * tirou aquele volume do CD de verdade, então precisa contar no "entregue"
 * mesmo que a loja em si ainda não esteja com status "finalizada" (ela volta
 * para "agrupada" com o saldo restante enquanto isso).
 *
 * A quebra "por etapa" é por CONTAGEM DE LOJAS (não paletes), pelo status
 * atual de cada uma — "apontada"/"conferência finalizada" entram em
 * "pendente" porque ainda não começaram o agrupamento.
 */
export function getResumoStatusDoDia(state) {
  const lojasHoje = getLojasDoDia(state);
  const idsHoje = new Set(lojasHoje.map((l) => l.id));

  const paletesReferencia = (l) => {
    if (l.paletesPlanejados > 0) return l.paletesPlanejados;
    if (l.paletesApontados > 0) return l.paletesApontados;
    if (l.paletesAgrupados > 0) return l.paletesAgrupados;
    return l.paletesNoAgrupamento || 0;
  };

  const paletesGerados = lojasHoje.reduce((soma, l) => soma + paletesReferencia(l), 0);

  const paletesEntregues = state.protocolos
    .filter((p) => idsHoje.has(p.lojaId))
    .reduce((soma, p) => soma + (Number(p.paletesEnviados) || 0), 0);

  const paletesPendentes = Math.max(0, paletesGerados - paletesEntregues);
  const percentualConcluido = paletesGerados > 0 ? Math.round((paletesEntregues / paletesGerados) * 100) : 0;

  const porEtapa = {
    pendente: 0,
    emAgrupamento: 0,
    prontasParaCarregar: 0,
    emCarregamento: 0,
    entregues: 0,
  };
  lojasHoje.forEach((l) => {
    if (l.status === 'pendente' || l.status === 'apontada' || l.status === 'conferencia_finalizada') {
      porEtapa.pendente += 1;
    } else if (l.status === 'em_agrupamento') {
      porEtapa.emAgrupamento += 1;
    } else if (l.status === 'agrupada') {
      porEtapa.prontasParaCarregar += 1;
    } else if (l.status === 'carregando') {
      porEtapa.emCarregamento += 1;
    } else if (l.status === 'finalizada') {
      porEtapa.entregues += 1;
    }
  });

  return {
    data: state.diaAtual,
    lojasGeradas: lojasHoje.length,
    paletesGerados,
    lojasEntregues: porEtapa.entregues,
    paletesEntregues,
    paletesPendentes,
    percentualConcluido,
    porEtapa,
  };
}

export function getLojaPorId(state, lojaId) {
  return state.lojas.find((l) => l.id === lojaId) || null;
}

export function getBoxPorNumero(state, numero) {
  return state.boxes.find((b) => b.numero === numero) || null;
}

/**
 * Lojas com o agrupamento já CONCLUÍDO (a partir de 'agrupada' em diante) —
 * usadas no relatório de produtividade. Não inclui 'apontada' (ainda sem
 * colaboradores definidos, só o box reservado) nem 'em_agrupamento' (os
 * colaboradores já foram sinalizados no início, mas a produtividade só deve
 * contar depois que o agrupamento realmente termina — ver Conclusão do
 * Agrupamento, que é quando `paletesAgrupados`/`dataAgrupamento` ficam com
 * os valores finais; contar antes disso credita paletes que ainda podem
 * mudar, ou nem serem confirmados).
 */
export function getLojasAgrupadasOuAlem(state) {
  return state.lojas.filter((l) => ['agrupada', 'carregando', 'finalizada'].includes(l.status));
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
      observacaoSaida: protocolo.observacaoSaida || null,
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
 * e por uma função de filtro de data (recebe o dia de referência do
 * protocolo — ver diaReferenciaProtocolo acima, que já leva em conta um
 * carregamento marcado pra contar em outro dia).
 */
export function getEntregasPorMotorista(state, tipoCarga, filtroData) {
  const porMotorista = new Map(); // nome do motorista -> Set de códigos de loja

  state.protocolos.forEach((p) => {
    const nomeMotorista = (p.motorista || '').trim();
    if (!nomeMotorista) return;
    if (filtroData && !filtroData(diaReferenciaProtocolo(p))) return;
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
