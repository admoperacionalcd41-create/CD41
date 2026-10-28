// ---------------------------------------------------------------------------
// Pedido do usuário ("com 3 usuários já tá dando problema, imagina com 15
// motoristas"): a mitigação anterior (gravação condicional + mesclagem só
// quando colide — ver histórico do git) reduz a chance de uma ação apagar a
// outra, mas não reduz quanto a gravação colide — ela ainda manda o
// documento JSON INTEIRO pro servidor a cada gravação. Com várias pessoas
// gravando ações diferentes quase ao mesmo tempo, cada uma dessas gravações
// "cegas" tem chance de colidir com a de outra, e cada colisão custa uma
// viagem extra ao banco (buscar o estado atual, mesclar, tentar de novo) —
// quanto mais gente usando ao mesmo tempo, mais colisões, mais lentidão.
//
// Esse arquivo resolve a causa, não só o sintoma: em vez de mandar o
// documento inteiro, calcula só os PEDAÇOS que realmente mudaram desde a
// última vez que sincronizamos (ver `base` em useSyncedAppState.js) e manda
// como uma lista de "patches" pequenos e específicos — "a loja X agora está
// assim", "a vaga Y do box Z agora está assim". O servidor aplica essa
// lista inteira numa função SQL (app_state_aplicar_patches, ver
// supabase/schema.sql) que só toca EXATAMENTE esses pedaços, dentro de uma
// transação com trava de linha — então duas pessoas mexendo em
// registros DIFERENTES (o caso comum: cada motorista cuida da própria
// carga) nunca mais colidem entre si, e nenhuma delas precisa saber da
// outra ou tentar de novo. Só sobra a mesma limitação de sempre (resolvida
// no servidor, não mais no cliente) quando as duas mudam o MESMÍSSIMO
// registro ao mesmo tempo — aí quem gravar por último nessa trava
// "vence" nesse registro específico, sem afetar nada mais.
//
// Reaproveita a mesma lista de coleções/campos que mesclarEstadoSincronizado
// já usa (CHAVE_COLECAO, COLECOES_SIMPLES, MAPAS_OBJETO, CAMPOS_ESCALARES) —
// pra nunca ficar com os dois arquivos descrevendo formatos diferentes do
// estado.
import {
  CHAVE_COLECAO,
  COLECOES_SIMPLES,
  MAPAS_OBJETO,
  CAMPOS_ESCALARES,
  iguais,
} from './mesclarEstadoSincronizado';

// `boxes` tem tratamento especial (ver mais abaixo, calcularPatchesBoxes):
// é a única coleção onde a sub-estrutura (vagas) é o que de fato muda por
// ação do usuário — `nome`/`totalVagas` vêm sempre de CONFIG_BOXES
// (boxLogic.js), reconstruídos identicamente em qualquer cliente, nunca uma
// edição de usuário. Por isso ela NÃO entra no loop genérico de
// CHAVE_COLECAO abaixo (que faria upsert do box inteiro, perdendo vagas
// alocadas por outra pessoa entre o momento em que este cliente leu o
// estado e o momento em que grava).
const CHAVE_COLECAO_SEM_BOXES = Object.fromEntries(
  Object.entries(CHAVE_COLECAO).filter(([colecao]) => colecao !== 'boxes')
);

function paraMapa(colecao, chave) {
  const mapa = new Map();
  (Array.isArray(colecao) ? colecao : []).forEach((item) => {
    if (item && item[chave] != null) mapa.set(item[chave], item);
  });
  return mapa;
}

// Pedido do usuário ("estamos perdendo muita atualização"): antes, um item
// que mudou (ex.: uma loja) ia pro servidor INTEIRO (upsert_item) — se duas
// pessoas mexiam em campos DIFERENTES da mesma loja quase ao mesmo tempo
// (ex.: o faturamento registrando a NF e o box mudando o status da mesma
// loja), a gravação que chegasse por último no banco sobrescrevia a loja
// inteira com a cópia dela, apagando o campo que a outra pessoa tinha
// acabado de mudar. Reproduzido na simulação com vários usuários contra o
// Postgres real (ver test-sincronizacao-multiusuario). Agora, pra um item
// que já existia, manda só os CAMPOS que mudaram (op `mesclar_item` — o
// servidor aplica `item || campos`, sem tocar nos outros campos); o item
// inteiro só vai quando ele é novo (não há o que mesclar).
//
// `granularidadeCampo: false` volta pro comportamento antigo (item inteiro)
// — usado só como contingência automática se o banco ainda não tiver a
// op `mesclar_item` (migração não rodada), ver motorSincronizacao.js.
function diferencaDeCampos(emBase, item) {
  const campos = {};
  const removidos = [];
  Object.keys(item).forEach((campo) => {
    if (item[campo] === undefined) {
      if (emBase[campo] !== undefined) removidos.push(campo);
    } else if (!iguais(emBase[campo], item[campo])) {
      campos[campo] = item[campo];
    }
  });
  Object.keys(emBase).forEach((campo) => {
    if (!(campo in item) && emBase[campo] !== undefined) removidos.push(campo);
  });
  return { campos, removidos };
}

function calcularPatchesColecao(colecao, chave, base, atual, granularidadeCampo) {
  const baseMapa = paraMapa(base, chave);
  const atualMapa = paraMapa(atual, chave);
  const patches = [];

  atualMapa.forEach((item, id) => {
    const emBase = baseMapa.get(id);
    if (!emBase) {
      patches.push({ op: 'upsert_item', colecao, chave, valorChave: String(id), item });
    } else if (!iguais(emBase, item)) {
      if (!granularidadeCampo) {
        patches.push({ op: 'upsert_item', colecao, chave, valorChave: String(id), item });
        return;
      }
      const { campos, removidos } = diferencaDeCampos(emBase, item);
      if (Object.keys(campos).length === 0 && removidos.length === 0) return;
      const patch = { op: 'mesclar_item', colecao, chave, valorChave: String(id), campos };
      if (removidos.length > 0) patch.removidos = removidos;
      patches.push(patch);
    }
  });

  baseMapa.forEach((_item, id) => {
    if (!atualMapa.has(id)) {
      patches.push({ op: 'remover_item', colecao, chave, valorChave: String(id) });
    }
  });

  return patches;
}

// Pedido do usuário (ver boxLogic.js e mesclarBox em mesclarEstadoSincronizado.js):
// um box é um recurso COMPARTILHADO — vários motoristas/operadores ocupam
// vagas diferentes do MESMO box o tempo todo. Por isso a gravação não manda
// o box inteiro (isso apagaria a vaga que outra pessoa acabou de ocupar,
// caso o estado local deste cliente ainda não tivesse recebido aquela
// mudança via Realtime) — manda só as VAGAS que de fato mudaram, uma por
// uma, cada uma como um patch independente que o servidor aplica sem tocar
// nas outras vagas daquele box.
function calcularPatchesBoxes(baseBoxes, atualBoxes) {
  const baseMapa = paraMapa(baseBoxes, 'numero');
  const patches = [];

  (Array.isArray(atualBoxes) ? atualBoxes : []).forEach((box) => {
    if (!box || box.numero == null) return;
    const boxBase = baseMapa.get(box.numero);
    const vagasBase = paraMapa(boxBase?.vagas, 'numero');

    (Array.isArray(box.vagas) ? box.vagas : []).forEach((vaga) => {
      if (!vaga || vaga.numero == null) return;
      const vagaBase = vagasBase.get(vaga.numero);
      if (!vagaBase || !iguais(vagaBase, vaga)) {
        patches.push({ op: 'upsert_vaga', numeroBox: box.numero, vaga });
      }
    });
  });

  return patches;
}

function calcularPatchesColecaoSimples(campo, base, atual) {
  const baseSet = new Set(Array.isArray(base) ? base : []);
  const atualSet = new Set(Array.isArray(atual) ? atual : []);
  const patches = [];

  atualSet.forEach((valor) => {
    if (!baseSet.has(valor)) patches.push({ op: 'adicionar_simples', campo, valor });
  });
  baseSet.forEach((valor) => {
    if (!atualSet.has(valor)) patches.push({ op: 'remover_simples', campo, valor });
  });

  return patches;
}

function calcularPatchesMapaObjeto(campo, base, atual) {
  const baseObj = base && typeof base === 'object' ? base : {};
  const atualObj = atual && typeof atual === 'object' ? atual : {};
  const patches = [];

  Object.entries(atualObj).forEach(([chave, valor]) => {
    if (!iguais(baseObj[chave], valor)) patches.push({ op: 'definir_mapa', campo, chave, valor });
  });
  Object.keys(baseObj).forEach((chave) => {
    if (!(chave in atualObj)) patches.push({ op: 'remover_mapa', campo, chave });
  });

  return patches;
}

/**
 * Calcula a lista de patches que leva o estado de `base` pra `atual` — só
 * os pedaços que realmente mudaram, prontos pra mandar pra
 * app_state_aplicar_patches (ver supabase/schema.sql). `base` é o último
 * estado que sabemos que já está refletido no servidor (ver baseServidorRef
 * em useSyncedAppState.js); `atual` é o estado local agora, já com a ação
 * do usuário aplicada.
 *
 * Retorna [] quando não há nada pra gravar (ex.: um reagendamento de
 * gravação que não muda nada de fato) — quem chama deve pular a viagem ao
 * banco nesse caso.
 */
export function calcularPatchesEstado(base, atual, { granularidadeCampo = true } = {}) {
  if (!base || !atual) return null; // sem base conhecida: quem chama deve cair pro fallback (gravação completa)

  const patches = [];

  Object.entries(CHAVE_COLECAO_SEM_BOXES).forEach(([colecao, chave]) => {
    patches.push(...calcularPatchesColecao(colecao, chave, base[colecao], atual[colecao], granularidadeCampo));
  });

  patches.push(...calcularPatchesBoxes(base.boxes, atual.boxes));

  COLECOES_SIMPLES.forEach((campo) => {
    patches.push(...calcularPatchesColecaoSimples(campo, base[campo], atual[campo]));
  });

  MAPAS_OBJETO.forEach((campo) => {
    patches.push(...calcularPatchesMapaObjeto(campo, base[campo], atual[campo]));
  });

  CAMPOS_ESCALARES.forEach((campo) => {
    if (!iguais(atual[campo], base[campo])) {
      patches.push({ op: 'definir_escalar', campo, valor: atual[campo] ?? null });
    }
  });

  return patches;
}
