// ---------------------------------------------------------------------------
// Regras físicas dos boxes/docas e alocação de vagas.
//
// Estrutura física: lista fixa de boxes, cada um com seu próprio nome e
// número de vagas (`CONFIG_BOXES` abaixo). Os boxes "BLOCADO 1" e "BLOCADO 2"
// têm capacidades diferentes dos demais boxes numerados — o restante segue o
// padrão de 26 vagas (boxes 2 a 8) e 18 vagas (boxes 9 a 13). "Box Frios" é
// um box adicional com capacidade própria (20 vagas), no fim da sequência.
//
// Regra de alocação em duas fases:
//   1) Apontamento (crescente): o apontamento manual inicial da loja para o
//      box ocupa as vagas LIVRES de MENOR numeração disponíveis (1,2,3...),
//      já que a quantidade informada nessa etapa é apenas uma estimativa
//      rápida, feita antes da conferência física.
//   2) Agrupamento (decrescente/preenchimento reverso): ao iniciar o
//      agrupamento físico, a quantidade de paletes é reconferida (geralmente
//      menor que a estimativa do apontamento) e as vagas da loja são
//      realocadas para a regra clássica de preenchimento reverso — sempre as
//      vagas LIVRES de MAIOR numeração (do limite máximo para baixo). Ex.:
//      em um box vazio de 1 a 26, um agrupamento de 6 paletes ocupa as vagas
//      26,25,24,23,22,21, deixando as vagas 1 a 20 livres para outro
//      agrupamento no mesmo box.
// ---------------------------------------------------------------------------

// Lista fixa de boxes, na ordem em que devem aparecer nas telas. `numero` é
// a chave interna (usada em `loja.boxNumero`, alocação de vagas, etc.) e
// permanece puramente sequencial/estável; `nome` é o rótulo exibido nas
// telas. BLOCADO 2 fica sempre na sequência, logo depois do Box 13.
const CONFIG_BOXES = [
  { numero: 1, nome: 'BLOCADO 1', totalVagas: 36 },
  { numero: 2, nome: 'Box 2', totalVagas: 26 },
  { numero: 3, nome: 'Box 3', totalVagas: 26 },
  { numero: 4, nome: 'Box 4', totalVagas: 26 },
  { numero: 5, nome: 'Box 5', totalVagas: 26 },
  { numero: 6, nome: 'Box 6', totalVagas: 26 },
  { numero: 7, nome: 'Box 7', totalVagas: 26 },
  { numero: 8, nome: 'Box 8', totalVagas: 26 },
  { numero: 9, nome: 'Box 9', totalVagas: 18 },
  { numero: 10, nome: 'Box 10', totalVagas: 18 },
  { numero: 11, nome: 'Box 11', totalVagas: 18 },
  { numero: 12, nome: 'Box 12', totalVagas: 18 },
  { numero: 13, nome: 'Box 13', totalVagas: 18 },
  { numero: 14, nome: 'BLOCADO 2', totalVagas: 42 },
  { numero: 15, nome: 'Box Frios', totalVagas: 20 },
];

export const BOX_NUMBERS = CONFIG_BOXES.map((b) => b.numero);

// Boxes que recebem destaque visual diferenciado nas telas (BLOCADO 1,
// BLOCADO 2 e Box Frios não são boxes "padrão" de carga solta, então
// aparecem com uma cor própria no card, pra ficarem fáceis de identificar
// de relance no meio dos demais).
const NOMES_BOX_ESPECIAIS = new Set(['BLOCADO 1', 'BLOCADO 2', 'Box Frios']);

export function boxEhEspecial(nome) {
  return NOMES_BOX_ESPECIAIS.has(nome);
}

export function getConfigBox(boxNumero) {
  return CONFIG_BOXES.find((b) => b.numero === boxNumero) || null;
}

export function getTotalVagas(boxNumero) {
  const cfg = getConfigBox(boxNumero);
  return cfg ? cfg.totalVagas : 0;
}

export function getNomeBox(boxNumero) {
  const cfg = getConfigBox(boxNumero);
  return cfg ? cfg.nome : `Box ${boxNumero}`;
}

export function criarBoxesIniciais() {
  return CONFIG_BOXES.map(({ numero, nome, totalVagas }) => ({
    numero,
    nome,
    totalVagas,
    vagas: Array.from({ length: totalVagas }, (_, i) => ({
      numero: i + 1,
      ocupada: false,
      lojaId: null,
    })),
  }));
}

/**
 * Reconcilia os boxes salvos (ex.: em localStorage, de uma sessão anterior)
 * com `CONFIG_BOXES` atual. Necessário porque o estado da aplicação é
 * persistido no navegador — se `CONFIG_BOXES` mudar (um box for renomeado,
 * tiver a capacidade alterada, ou um novo box for adicionado), uma sessão já
 * salva continuaria com o formato antigo (sem `nome`, contagem de boxes
 * desatualizada, etc.) até esta função rodar. Preserva as vagas já ocupadas
 * de cada box sempre que possível.
 */
export function sincronizarBoxes(boxesAtuais) {
  const porNumero = new Map((boxesAtuais || []).map((b) => [b.numero, b]));

  return CONFIG_BOXES.map(({ numero, nome, totalVagas }) => {
    const existente = porNumero.get(numero);

    if (!existente) {
      return {
        numero,
        nome,
        totalVagas,
        vagas: Array.from({ length: totalVagas }, (_, i) => ({ numero: i + 1, ocupada: false, lojaId: null })),
      };
    }

    const vagasExistentes = existente.vagas || [];
    let vagas;

    if (vagasExistentes.length === totalVagas) {
      vagas = vagasExistentes;
    } else if (vagasExistentes.length < totalVagas) {
      // Box cresceu (ex.: BLOCADO 1 de 26 para 36 vagas): mantém as vagas
      // existentes (com sua ocupação) e completa com vagas livres novas.
      const extras = Array.from({ length: totalVagas - vagasExistentes.length }, (_, i) => ({
        numero: vagasExistentes.length + i + 1,
        ocupada: false,
        lojaId: null,
      }));
      vagas = [...vagasExistentes, ...extras];
    } else {
      // Box encolheu: preserva todas as vagas ocupadas (para não perder
      // paletes já alocados), descartando apenas vagas livres excedentes.
      const ocupadas = vagasExistentes.filter((v) => v.ocupada);
      const livres = vagasExistentes
        .filter((v) => !v.ocupada)
        .slice(0, Math.max(0, totalVagas - ocupadas.length));
      vagas = [...ocupadas, ...livres].sort((a, b) => a.numero - b.numero);
    }

    return { numero, nome, totalVagas, vagas };
  });
}

export function getVagasDisponiveis(box) {
  return box.vagas.filter((v) => !v.ocupada);
}

export function getVagasDisponiveisCount(box) {
  return getVagasDisponiveis(box).length;
}

/**
 * Núcleo comum de alocação: ocupa `quantidade` vagas livres de `box` para
 * `lojaId`, escolhendo-as a partir de `disponiveis` (já ordenadas na direção
 * desejada pelo chamador). Retorna { sucesso, box, vagasAlocadas } ou
 * { sucesso:false, erro }.
 */
function alocarDaLista(box, quantidade, lojaId, disponiveisOrdenadas) {
  if (!quantidade || quantidade <= 0) {
    return { sucesso: false, erro: 'Informe uma quantidade de paletes válida.' };
  }

  if (disponiveisOrdenadas.length < quantidade) {
    return {
      sucesso: false,
      erro: `${box.nome || `Box ${box.numero}`} possui apenas ${disponiveisOrdenadas.length} vaga(s) disponível(is) — necessário: ${quantidade}.`,
    };
  }

  const selecionadas = disponiveisOrdenadas.slice(0, quantidade);
  const numerosSelecionados = new Set(selecionadas.map((v) => v.numero));

  const novoBox = {
    ...box,
    vagas: box.vagas.map((v) =>
      numerosSelecionados.has(v.numero) ? { ...v, ocupada: true, lojaId } : v
    ),
  };

  return {
    sucesso: true,
    box: novoBox,
    vagasAlocadas: [...numerosSelecionados].sort((a, b) => a - b),
  };
}

/**
 * Etapa 1 — Apontamento: aloca `quantidade` vagas para `lojaId` em ordem
 * CRESCENTE (sempre a partir das vagas livres de MENOR numeração). Usada no
 * apontamento manual inicial da loja para o box.
 */
export function alocarVagasCrescente(box, quantidade, lojaId) {
  const disponiveis = getVagasDisponiveis(box)
    .slice()
    .sort((a, b) => a.numero - b.numero);
  return alocarDaLista(box, quantidade, lojaId, disponiveis);
}

/**
 * Etapa 2 — Agrupamento: aloca `quantidade` vagas para `lojaId` em ordem
 * DECRESCENTE (preenchimento reverso clássico — sempre a partir das vagas
 * livres de MAIOR numeração). Usada ao iniciar o agrupamento físico.
 */
export function alocarVagasDecrescente(box, quantidade, lojaId) {
  const disponiveis = getVagasDisponiveis(box)
    .slice()
    .sort((a, b) => b.numero - a.numero);
  return alocarDaLista(box, quantidade, lojaId, disponiveis);
}

/**
 * Transição Apontamento -> Agrupamento: libera as vagas crescentes que a
 * loja ocupava (alocadas no apontamento) e realoca `novaQuantidade` —
 * normalmente menor, após a conferência física dos paletes — em ordem
 * decrescente, seguindo a regra clássica de preenchimento reverso.
 */
export function realocarParaAgrupamento(box, lojaId, novaQuantidade) {
  const boxLiberado = liberarTodasVagas(box, lojaId);
  return alocarVagasDecrescente(boxLiberado, novaQuantidade, lojaId);
}

/**
 * Libera todas as vagas ocupadas por uma loja em um box (carga 100% enviada).
 */
export function liberarTodasVagas(box, lojaId) {
  return {
    ...box,
    vagas: box.vagas.map((v) =>
      v.lojaId === lojaId ? { numero: v.numero, ocupada: false, lojaId: null } : v
    ),
  };
}

/**
 * Libera apenas `quantidade` vagas de uma loja (usado quando o carregamento
 * sai com saldo parcial). Libera primeiro as vagas de menor numeração
 * ocupadas por aquela loja, mantendo o restante alocado até o próximo envio.
 */
export function liberarVagasParciais(box, lojaId, quantidade) {
  const ocupadasPelaLoja = box.vagas
    .filter((v) => v.ocupada && v.lojaId === lojaId)
    .sort((a, b) => a.numero - b.numero);

  const aLiberar = new Set(ocupadasPelaLoja.slice(0, quantidade).map((v) => v.numero));

  const novoBox = {
    ...box,
    vagas: box.vagas.map((v) =>
      aLiberar.has(v.numero) ? { numero: v.numero, ocupada: false, lojaId: null } : v
    ),
  };

  const vagasRestantes = ocupadasPelaLoja
    .filter((v) => !aLiberar.has(v.numero))
    .map((v) => v.numero)
    .sort((a, b) => a - b);

  return {
    box: novoBox,
    vagasLiberadas: [...aLiberar].sort((a, b) => a - b),
    vagasRestantes,
  };
}

/**
 * Reocupa vagas específicas (por número) para `lojaId` — usado ao cancelar
 * um protocolo de carregamento já registrado, devolvendo a(s) vaga(s) que
 * haviam sido liberadas para a loja original. O chamador deve checar
 * `vagasIndisponiveisParaReocupar` antes de chamar esta função, para não
 * sobrescrever silenciosamente uma ocupação de outra loja.
 */
export function reocuparVagas(box, numerosVagas, lojaId) {
  const numeros = new Set(numerosVagas);
  return {
    ...box,
    vagas: box.vagas.map((v) => (numeros.has(v.numero) ? { numero: v.numero, ocupada: true, lojaId } : v)),
  };
}

/**
 * Retorna os números de vaga, dentre `numerosVagas`, que já não estão mais
 * livres (foram reaproveitados por outra loja desde então) — usado para
 * bloquear o cancelamento de um protocolo quando as vagas que ele liberou já
 * foram reutilizadas por um novo apontamento/agrupamento.
 */
export function vagasIndisponiveisParaReocupar(box, numerosVagas) {
  const numeros = new Set(numerosVagas);
  return box.vagas.filter((v) => numeros.has(v.numero) && v.ocupada).map((v) => v.numero);
}

/**
 * Status operacional do box (não confundir com o status da loja): decide o
 * selo/cor exibido nas telas de Boxes e Vagas e no Dashboard, na mesma
 * ordem de prioridade em ambas — para que os dois lugares sempre concordem
 * sobre o que é um box "Ocupado".
 *   1) Ocupado — tem alguma loja "em execução" (apontada), mesmo que ainda
 *      sobrem vagas livres para outros apontamentos.
 *   2) Lotado — nenhuma vaga livre (mas sem loja em execução).
 *   3) Em uso — tem ao menos uma vaga ocupada, mas ainda há vagas livres.
 *   4) Disponível — nenhuma vaga ocupada.
 */
export function getStatusBox(box, lojasPorId) {
  const resumo = getResumoBox(box);
  const temLojaEmExecucao = resumo.lojasIds.some((id) => lojasPorId?.[id]?.status === 'apontada');

  if (temLojaEmExecucao) {
    return {
      chave: 'ocupado',
      texto: 'Ocupado',
      corBadge: 'bg-red-50 text-red-600 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300',
      corSolida: 'bg-red-500',
      corBarra: 'bg-red-400',
    };
  }
  if (resumo.disponiveis === 0) {
    return {
      chave: 'lotado',
      texto: 'Lotado',
      corBadge: 'bg-red-50 text-red-600 dark:border dark:border-current dark:bg-red-500/10 dark:text-red-300',
      corSolida: 'bg-red-500',
      corBarra: 'bg-red-400',
    };
  }
  if (resumo.ocupadas > 0) {
    return {
      chave: 'em_uso',
      texto: 'Em uso',
      corBadge: 'bg-amber-50 text-amber-600 dark:border dark:border-current dark:bg-amber-500/10 dark:text-amber-300',
      corSolida: 'bg-amber-500',
      corBarra: 'bg-amber-400',
    };
  }
  return {
    chave: 'disponivel',
    texto: 'Disponível',
    corBadge: 'bg-emerald-50 text-emerald-600 dark:border dark:border-current dark:bg-emerald-500/10 dark:text-emerald-300',
    corSolida: 'bg-emerald-500',
    corBarra: 'bg-emerald-400',
  };
}

// Ordem de exibição das lojas dentro de um box (telas de Boxes & Vagas e
// Dashboard): segue a mesma ordem do fluxo operacional, que também é a
// ordem física real de ocupação das vagas —
//   Em Execução, Conferência Finalizada e Agrupando ocupam as PRIMEIRAS
//   vagas do box (numeração crescente, ver alocarVagasApontamento acima);
//   Agrupada e Em Carregamento ocupam as ÚLTIMAS vagas (numeração
//   decrescente, ver alocarVagasAgrupamento acima).
// Uma loja "Finalizada" já liberou suas vagas, então não aparece mais aqui.
const ORDEM_STATUS_NO_BOX = {
  apontada: 0,
  conferencia_finalizada: 1,
  em_agrupamento: 2,
  agrupada: 3,
  carregando: 4,
};

// Ordena os ids de loja de um box pela ordem acima e, dentro do mesmo
// status, sempre pela carga/loja (numérico, ex.: "0403" antes de "0410") —
// pedido explícito do usuário pra manter a lista sempre previsível.
function ordenarLojasDoBox(lojasIds, lojasPorId) {
  return [...lojasIds].sort((idA, idB) => {
    const lojaA = lojasPorId?.[idA];
    const lojaB = lojasPorId?.[idB];
    const ordemA = ORDEM_STATUS_NO_BOX[lojaA?.status] ?? 99;
    const ordemB = ORDEM_STATUS_NO_BOX[lojaB?.status] ?? 99;
    if (ordemA !== ordemB) return ordemA - ordemB;
    const opcoes = { numeric: true, sensitivity: 'base' };
    const cargaA = lojaA?.carga || '';
    const cargaB = lojaB?.carga || '';
    if (cargaA !== cargaB) return cargaA.localeCompare(cargaB, 'pt-BR', opcoes);
    return (lojaA?.loja || '').localeCompare(lojaB?.loja || '', 'pt-BR', opcoes);
  });
}

export function getResumoBox(box, lojasPorId) {
  const ocupadas = box.vagas.filter((v) => v.ocupada);
  const lojasIds = ordenarLojasDoBox([...new Set(ocupadas.map((v) => v.lojaId))], lojasPorId);
  return {
    totalVagas: box.totalVagas,
    ocupadas: ocupadas.length,
    disponiveis: box.totalVagas - ocupadas.length,
    lojasIds,
  };
}

// Mesmos dois grupos de ORDEM_STATUS_NO_BOX acima, usados por compactarBox
// pra saber de que lado do box (crescente a partir da vaga 1, ou
// decrescente a partir da última) cada loja deve ocupar.
const STATUS_CRESCENTE_NO_BOX = new Set(['apontada', 'conferencia_finalizada', 'em_agrupamento']);
const STATUS_DECRESCENTE_NO_BOX = new Set(['agrupada', 'carregando']);

/**
 * Reempacota as vagas ocupadas de um box, fechando os "buracos" que sobram
 * quando uma loja no meio da fila termina e libera vagas: as lojas que
 * ficam continuam plantadas exatamente nos números que tinham antes, ainda
 * que agora sobre um vão livre entre elas e a borda do box, deixando a
 * ocupação visualmente fora de ordem mesmo com cada loja numa quantidade de
 * vagas correta.
 *
 * Preserva sempre a QUANTIDADE de vagas de cada loja (nunca muda quantos
 * paletes uma loja está ocupando) — só reorganiza as posições, seguindo a
 * mesma regra de preenchimento de sempre e a mesma ordem de exibição de
 * `ordenarLojasDoBox`: Em Execução, Conferência Finalizada e Agrupando a
 * partir da vaga 1 pra cima; Agrupada e Em Carregamento a partir da última
 * vaga pra baixo. Idempotente — um box já compacto (sem vãos) sai
 * exatamente igual, então pode ser chamada depois de qualquer ação sem
 * custo quando nada mudou.
 *
 * Por segurança, se alguma loja ocupando vaga estiver em um status que não
 * é nem um dos "crescentes" nem um dos "decrescentes" acima (não deveria
 * acontecer — só essas cinco etapas ocupam vaga), não mexe em nada no box.
 */
export function compactarBox(box, lojasPorId) {
  const contagemPorLoja = new Map();
  for (const v of box.vagas) {
    if (v.ocupada && v.lojaId) {
      contagemPorLoja.set(v.lojaId, (contagemPorLoja.get(v.lojaId) || 0) + 1);
    }
  }
  if (contagemPorLoja.size === 0) return box;

  const lojasIds = [...contagemPorLoja.keys()];
  const statusDesconhecido = lojasIds.some((id) => {
    const status = lojasPorId?.[id]?.status;
    return !STATUS_CRESCENTE_NO_BOX.has(status) && !STATUS_DECRESCENTE_NO_BOX.has(status);
  });
  if (statusDesconhecido) return box;

  const ordenadas = ordenarLojasDoBox(lojasIds, lojasPorId);
  const crescentes = ordenadas.filter((id) => STATUS_CRESCENTE_NO_BOX.has(lojasPorId[id].status));
  const decrescentes = ordenadas.filter((id) => STATUS_DECRESCENTE_NO_BOX.has(lojasPorId[id].status));

  const novaVagaPorLoja = new Map();
  let cursorBaixo = 1;
  for (const id of crescentes) {
    const quantidade = contagemPorLoja.get(id);
    for (let i = 0; i < quantidade; i += 1) {
      novaVagaPorLoja.set(cursorBaixo, id);
      cursorBaixo += 1;
    }
  }
  let cursorAlto = box.totalVagas;
  for (const id of decrescentes) {
    const quantidade = contagemPorLoja.get(id);
    for (let i = 0; i < quantidade; i += 1) {
      novaVagaPorLoja.set(cursorAlto, id);
      cursorAlto -= 1;
    }
  }

  const inalterado = box.vagas.every((v) => (novaVagaPorLoja.get(v.numero) || null) === (v.lojaId || null));
  if (inalterado) return box;

  return {
    ...box,
    vagas: box.vagas.map((v) => {
      const lojaId = novaVagaPorLoja.get(v.numero) || null;
      return lojaId ? { numero: v.numero, ocupada: true, lojaId } : { numero: v.numero, ocupada: false, lojaId: null };
    }),
  };
}
