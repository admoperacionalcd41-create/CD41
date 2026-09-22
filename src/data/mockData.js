import { gerarId } from '../utils/idGenerator';
import {
  criarBoxesIniciais,
  alocarVagasCrescente,
  realocarParaAgrupamento,
  liberarTodasVagas,
} from '../utils/boxLogic';
import { hojeISO, somarDias } from '../utils/dateHelpers';

// Cadastros auxiliares (Colaboradores, Motoristas, Placas de Veículo)
// publicados vazios de propósito — a tela de Cadastros começa em branco na
// versão publicada, para ser preenchida com os dados reais da operação, sem
// nenhum nome de exemplo pré-cadastrado. Os colaboradores/motorista/placa
// já atribuídos às lojas de demonstração abaixo (agrupamentos e protocolo
// de exemplo) não dependem dessas listas — são apenas texto livre gravado
// em cada loja/protocolo, então continuam aparecendo normalmente mesmo com
// os cadastros vazios.
export const COLABORADORES_CADASTRADOS = [];

export const MOTORISTAS_CADASTRADOS = [];

export const PLACAS_CADASTRADAS = [];

const NOMES_LOJAS = [
  'Shopping Center', 'Centro', 'Zona Norte', 'Zona Sul', 'Zona Leste', 'Zona Oeste',
  'Rodoviária', 'Praça da Matriz', 'Bairro Industrial', 'Vila Nova', 'Jardim América',
  'Vila Rica', 'Boa Vista', 'Parque das Flores', 'Alto da Serra', 'Porto', 'Marina',
  'Terminal', 'Distrito', 'Setor Comercial', 'Vale Verde', 'Colina', 'Recanto',
  'Nova Esperança', 'Bela Vista', 'Santa Cruz', 'São José', 'Bom Retiro',
];

// Depósitos/CDs de origem e usuários do sistema de origem, usados apenas
// para simular os campos que chegam pela importação real (Depósito,
// Peso, Volume, Usuário que gerou).
const DEPOSITOS = ['CD Regional Sul', 'CD Regional Norte', 'CD Central'];
const USUARIOS_SISTEMA = ['j.almeida', 'r.nunes', 'sistema.wms'];

function novaLoja({
  carga,
  loja,
  nomeLoja,
  paletes,
  diaReferencia,
  deposito = '',
  peso = null,
  volume = null,
  usuarioGeracao = '',
  dataGeracaoISO = null,
  tipoCarga = 'seca',
}) {
  return {
    id: gerarId('loja'),
    carga,
    loja,
    nomeLoja,
    regiao: '',
    deposito,
    peso,
    volume,
    usuarioGeracao,
    dataGeracaoISO,
    tipoCarga,
    dataGeracaoBruta: null,
    // A quantidade de paletes não vem da planilha de origem (Peso/Volume são
    // medidas físicas) — aqui simulamos o valor que o operador definiria
    // manualmente na tela de Agrupamento, só para a demonstração.
    paletesPlanejados: paletes,
    paletesAgrupados: 0,
    paletesNoAgrupamento: 0,
    status: 'pendente',
    boxNumero: null,
    vagasOcupadas: [],
    colaboradores: [],
    protocolos: [],
    dataImportacao: new Date().toISOString(),
    dataApontamento: null,
    dataConferencia: null,
    dataInicioAgrupamento: null,
    dataAgrupamento: null,
    dataCarregamento: null,
    diaReferencia,
  };
}

/**
 * Monta um conjunto de dados de demonstração consistente: 28 lojas
 * planejadas para "hoje", 3 lojas de saldo do dia anterior, e alguns
 * agrupamentos/carregamentos já em andamento para ilustrar todas as telas
 * assim que o app é aberto pela primeira vez.
 */
export function gerarDadosIniciais() {
  let boxes = criarBoxesIniciais();
  const hoje = hojeISO();
  const ontem = somarDias(hoje, -1);

  const lojasHoje = NOMES_LOJAS.map((nome, i) => {
    const paletesEstimados = 3 + (i % 8); // varia entre 3 e 10 paletes
    return novaLoja({
      carga: `CG-${1000 + i}`,
      loja: String(400 + i).padStart(4, '0'),
      nomeLoja: `Loja ${nome}`,
      paletes: paletesEstimados,
      diaReferencia: hoje,
      deposito: DEPOSITOS[i % DEPOSITOS.length],
      peso: Number((paletesEstimados * 372.4 + (i % 5) * 18).toFixed(1)),
      volume: Number((paletesEstimados * 1.82 + (i % 3) * 0.4).toFixed(2)),
      usuarioGeracao: USUARIOS_SISTEMA[i % USUARIOS_SISTEMA.length],
      dataGeracaoISO: new Date(Date.now() - (i + 1) * 6 * 60 * 1000).toISOString(),
      // Maioria seca; uma a cada 6 lojas entra como resfriada, só para a
      // demonstração já nascer com os dois tipos representados nas telas.
      tipoCarga: i % 6 === 5 ? 'resfriada' : 'seca',
    });
  });

  const saldoAnterior = [0, 1, 2].map((i) => {
    const paletesEstimados = 4 + i;
    return novaLoja({
      carga: `CG-${900 + i}`,
      loja: String(300 + i).padStart(4, '0'),
      nomeLoja: `Loja Pendência ${i + 1}`,
      paletes: paletesEstimados,
      diaReferencia: ontem,
      deposito: DEPOSITOS[i % DEPOSITOS.length],
      peso: Number((paletesEstimados * 360).toFixed(1)),
      volume: Number((paletesEstimados * 1.75).toFixed(2)),
      usuarioGeracao: USUARIOS_SISTEMA[i % USUARIOS_SISTEMA.length],
      dataGeracaoISO: new Date(Date.now() - 86400000 - i * 6 * 60 * 1000).toISOString(),
    });
  });

  let lojas = [...saldoAnterior, ...lojasHoje];

  function indexPorLoja(codigoLoja) {
    return lojas.findIndex((l) => l.loja === codigoLoja);
  }

  // Etapa 1 — Apontamento: reserva as vagas físicas em ordem CRESCENTE e
  // marca a loja como "em execução", ainda sem colaboradores definidos.
  function apontar(codigoLoja, boxNumero) {
    const idx = indexPorLoja(codigoLoja);
    const loja = lojas[idx];
    const box = boxes.find((b) => b.numero === boxNumero);
    const resultado = alocarVagasCrescente(box, loja.paletesPlanejados, loja.id);
    if (!resultado.sucesso) return idx;
    boxes = boxes.map((b) => (b.numero === boxNumero ? resultado.box : b));
    lojas = lojas.map((l, i) =>
      i === idx
        ? {
            ...l,
            status: 'apontada',
            boxNumero,
            vagasOcupadas: resultado.vagasAlocadas,
            paletesAgrupados: l.paletesPlanejados,
            paletesNoAgrupamento: l.paletesPlanejados,
            dataApontamento: new Date().toISOString(),
          }
        : l
    );
    return idx;
  }

  // Etapa 2 — Conferência Finalizada: marca que a conferência física da
  // carga apontada no box foi concluída, antes de sinalizar os
  // colaboradores e iniciar o agrupamento propriamente dito.
  function finalizarConferencia(codigoLoja) {
    const idx = indexPorLoja(codigoLoja);
    lojas = lojas.map((l, i) =>
      i === idx ? { ...l, status: 'conferencia_finalizada', dataConferencia: new Date().toISOString() } : l
    );
    return idx;
  }

  // Etapa 3 — Início do Agrupamento: sinaliza apenas os colaboradores. As
  // vagas permanecem como estão (crescentes, do apontamento) — a
  // quantidade só é reconfirmada ao concluir o agrupamento.
  function iniciarAgrup(codigoLoja, colaboradores) {
    const idx = indexPorLoja(codigoLoja);
    lojas = lojas.map((l, i) =>
      i === idx
        ? { ...l, status: 'em_agrupamento', colaboradores, dataInicioAgrupamento: new Date().toISOString() }
        : l
    );
    return idx;
  }

  // Etapa 4 — Conclusão: reconfirma a quantidade de paletes (geralmente
  // menor, após a conferência física), realoca as vagas em ordem
  // DECRESCENTE (preenchimento reverso) e deixa a loja pronta para
  // etiquetas/carregamento. `quantidadeFinal` é opcional — quando
  // informado, simula a redução de paletes que costuma acontecer entre o
  // apontamento e a conferência física do agrupamento.
  function concluirAgrup(codigoLoja, quantidadeFinal) {
    const idx = indexPorLoja(codigoLoja);
    const loja = lojas[idx];
    const box = boxes.find((b) => b.numero === loja.boxNumero);
    const quantidade = quantidadeFinal ?? loja.paletesAgrupados;
    const resultado = realocarParaAgrupamento(box, loja.id, quantidade);
    if (!resultado.sucesso) return idx;
    boxes = boxes.map((b) => (b.numero === loja.boxNumero ? resultado.box : b));
    lojas = lojas.map((l, i) =>
      i === idx
        ? {
            ...l,
            status: 'agrupada',
            vagasOcupadas: resultado.vagasAlocadas,
            paletesAgrupados: quantidade,
            paletesNoAgrupamento: quantidade,
            dataAgrupamento: new Date().toISOString(),
          }
        : l
    );
    return idx;
  }

  // Atalho para lojas de demonstração que já devem aparecer totalmente
  // agrupadas (percorre as quatro etapas de uma vez).
  function agrupar(codigoLoja, boxNumero, colaboradores, quantidadeFinal) {
    apontar(codigoLoja, boxNumero);
    finalizarConferencia(codigoLoja);
    iniciarAgrup(codigoLoja, colaboradores);
    return concluirAgrup(codigoLoja, quantidadeFinal);
  }

  // Algumas lojas já agrupadas em boxes, para demonstrar a ocupação de vagas.
  agrupar('0403', 1, ['Carlos Silva', 'Fernanda Souza']);
  agrupar('0404', 1, ['João Pereira']);
  // Exemplo de redução: apontada com a estimativa original, mas o
  // agrupamento confirma uma quantidade menor de paletes.
  agrupar('0405', 3, ['Mariana Costa', 'Rafael Lima', 'Patrícia Alves'], 6);
  const idxCarregando = agrupar('0406', 9, ['Bruno Santos']);
  if (idxCarregando !== undefined && idxCarregando >= 0) {
    lojas[idxCarregando] = { ...lojas[idxCarregando], status: 'carregando' };
  }

  // Uma loja apenas apontada (em execução, vagas crescentes, aguardando a
  // finalização da conferência).
  apontar('0408', 2);

  // Uma loja com a conferência já finalizada, aguardando a sinalização dos
  // colaboradores para iniciar o agrupamento.
  apontar('0410', 6);
  finalizarConferencia('0410');

  // Uma loja com agrupamento em andamento (vagas ainda crescentes, do
  // apontamento; colaboradores já sinalizados — a realocação decrescente só
  // acontece ao concluir o agrupamento).
  apontar('0409', 2);
  finalizarConferencia('0409');
  iniciarAgrup('0409', ['Juliana Martins']);

  // Uma loja finalizada (histórico mantido no registro; vagas já liberadas no box).
  const idxFinalizada = agrupar('0407', 5, ['Diego Rocha', 'Camila Ferreira']);
  const boxFinalizada = boxes.find((b) => b.numero === 5);
  // Guardado antes de liberar, para que o protocolo de exemplo também
  // suporte cancelamento (ver CANCELAR_PROTOCOLO em AppContext.jsx).
  const vagasLiberadasDemo = boxFinalizada.vagas
    .filter((v) => v.ocupada && v.lojaId === lojas[idxFinalizada].id)
    .map((v) => v.numero);
  const protocoloDemo = {
    id: gerarId('proto'),
    lojaId: lojas[idxFinalizada].id,
    placa: 'ABC-1D23',
    motorista: 'José Almeida',
    lacres: ['112233', '112234', ''],
    statusEnvio: 'completo',
    paletesEnviados: lojas[idxFinalizada].paletesAgrupados,
    dataHora: new Date().toISOString(),
    boxNumero: 5,
    vagasLiberadas: vagasLiberadasDemo,
  };
  boxes = boxes.map((b) =>
    b.numero === 5 ? liberarTodasVagas(boxFinalizada, lojas[idxFinalizada].id) : b
  );
  lojas[idxFinalizada] = {
    ...lojas[idxFinalizada],
    status: 'finalizada',
    dataCarregamento: new Date().toISOString(),
    protocolos: [protocoloDemo],
  };

  return {
    lojas,
    boxes,
    protocolos: [protocoloDemo],
    diaAtual: hoje,
    colaboradoresCadastrados: COLABORADORES_CADASTRADOS,
    motoristasCadastrados: MOTORISTAS_CADASTRADOS,
    placasCadastradas: PLACAS_CADASTRADAS,
    contatosNotificacao: [],
    localizacaoLojas: [],
    ultimoErro: null,
  };
}
