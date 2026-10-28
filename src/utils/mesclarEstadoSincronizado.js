// ---------------------------------------------------------------------------
// Mitigação do problema de sincronização relatado pelo usuário: dois
// operadores mexendo na aba Expedição / Processos quase ao mesmo tempo —
// um fazendo apontamento/conferência, o outro fazendo o resto — e a ação de
// um "voltava" quando o outro salvava, sem precisar dar refresh.
//
// Causa raiz (ver useSyncedAppState.js): o app guarda TODO o estado como um
// único "pacote" (uma linha na tabela `app_state`), e sempre que alguém
// salva, o pacote inteiro substitui o que estava lá — não existe mesclagem
// nenhuma. Pior: como a gravação local é adiada alguns milissegundos (pra
// não gravar a cada clique), se a atualização de OUTRO usuário chegar via
// Realtime bem nessa janela, o app até então jogava fora a ação local ainda
// não salva e aplicava direto o que chegou de fora — perdendo a ação sem
// nem tentar salvá-la.
//
// Esse arquivo resolve a parte que dá pra resolver sem reestruturar o banco
// (isso seria a correção definitiva — tabelas separadas por tipo de
// registro — mas é uma migração grande, fora do escopo dessa mitigação):
// uma mesclagem de três pontas (base / local / remoto) coleção por coleção,
// usando a identidade de cada registro (id da loja, id do protocolo, número
// do box etc.). Registros que só mudaram de um lado desde a última vez que
// sincronizamos com o servidor (`base`) ficam como esse lado deixou —
// cobre exatamente o caso do usuário, dois operadores mexendo em LOJAS/
// PROTOCOLOS diferentes ao mesmo tempo. Só quando os dois mudam o MESMO
// registro na mesma janela (bem mais raro) é que sobra uma escolha: fica
// com a versão local, por ser a ação que acabou de acontecer nessa tela e
// ainda não foi salva — é exatamente essa perda silenciosa que essa
// mesclagem existe para evitar.
//
// Limite importante (avisado ao usuário): isso reduz MUITO a frequência do
// problema pro padrão de uso relatado (operadores mexendo em registros
// diferentes), mas não é uma solução perfeita — uma colisão no MESMO
// registro, no mesmíssimo instante, ainda tem que escolher um lado.
//
// Atualização (pedido do usuário, motoristas/operadores começando a usar o
// sistema junto: carga de BOX não pode dar conflito): como um box é
// ocupado/liberado por quase toda ação do sistema, "o MESMO registro"
// acontecia com muito mais frequência na coleção `boxes` do que nas outras
// — então essa coleção tem um tratamento extra (ver `mesclarBox` abaixo):
// a colisão não escolhe um lado pro box inteiro, mescla vaga por vaga. Só
// sobra a limitação de cima (escolhe um lado) quando as duas pessoas
// ocupam/liberam a MESMÍSSIMA vaga no mesmíssimo instante — bem mais raro.

// Coleções identificadas por uma chave própria em cada item.
//
// Exportado (junto com as constantes abaixo) pra ser reaproveitado por
// calcularPatchesEstado.js — a gravação no Supabase agora manda só o PEDAÇO
// que mudou (ver useSyncedAppState.js), e precisa saber exatamente as
// mesmas coleções/campos que esta mesclagem conhece, pra não haver
// divergência entre "o que é mesclado na recepção" e "o que é calculado como
// patch na gravação".
export const CHAVE_COLECAO = {
  lojas: 'id',
  protocolos: 'id',
  boxes: 'numero',
  placasCadastradas: 'placa',
  contatosNotificacao: 'telefone',
  localizacaoLojas: 'codigo',
};

// Coleções de strings simples (nomes cadastrados), sem identidade própria.
export const COLECOES_SIMPLES = ['colaboradoresCadastrados', 'motoristasCadastrados'];

// Mapas objeto { chave: valor } sem identidade por item (não são arrays) —
// hoje só observacoesLoja ({ código da loja: texto }, ver AppContext.jsx).
// Mesma lógica de 3 pontas de mesclarColecaoPorChave, mas usando as
// próprias chaves do objeto em vez de um campo `chave` dentro de cada item.
export const MAPAS_OBJETO = ['observacoesLoja'];

// Campos escalares onde uma edição local concorrente deve prevalecer sobre
// o remoto (mesmo critério das coleções: a ação local mais recente, ainda
// não salva, não deve sumir sem alguém tentar gravá-la). sequenciaLojas
// entra aqui (não em COLECOES_SIMPLES) porque é um array onde a ORDEM é o
// próprio conteúdo que importa — uma mesclagem por Set (como as coleções
// simples fazem) preservaria os itens mas destruiria a ordem arrastada.
export const CAMPOS_ESCALARES = ['diaAtual', 'valorPaletesAgrupamento', 'sequenciaLojas'];

export function iguais(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function paraMapa(colecao, chave) {
  const mapa = new Map();
  (Array.isArray(colecao) ? colecao : []).forEach((item) => {
    if (item && item[chave] != null) mapa.set(item[chave], item);
  });
  return mapa;
}

function mesclarColecaoPorChave(chave, base, local, remoto, resolverColisao) {
  const baseMapa = paraMapa(base, chave);
  const localMapa = paraMapa(local, chave);
  const remotoMapa = paraMapa(remoto, chave);

  const todasAsChaves = new Set([...baseMapa.keys(), ...localMapa.keys(), ...remotoMapa.keys()]);
  const resultado = [];

  todasAsChaves.forEach((id) => {
    const emBase = baseMapa.get(id);
    const emLocal = localMapa.get(id);
    const emRemoto = remotoMapa.get(id);

    if (!emLocal && !emRemoto) return; // excluído dos dois lados

    const localMudou = !iguais(emLocal, emBase);
    const remotoMudou = !iguais(emRemoto, emBase);

    if (!emLocal) {
      // Não existe mais localmente: foi excluído aqui, ou nunca existiu
      // localmente — de qualquer forma, respeita o que tiver no remoto.
      if (emRemoto) resultado.push(emRemoto);
      return;
    }
    if (!emRemoto) {
      // Existe só local: se é um registro novo (sem base), é uma criação
      // local recente — mantém. Se já existia na base e sumiu do remoto,
      // foi excluído por outra pessoa — respeita a exclusão, não readiciona.
      if (!emBase) resultado.push(emLocal);
      return;
    }

    if (localMudou && !remotoMudou) resultado.push(emLocal);
    else if (!localMudou && remotoMudou) resultado.push(emRemoto);
    else if (localMudou && remotoMudou) {
      // Colisão real: os dois lados mudaram esse registro desde a última
      // base conhecida — mescla campo por campo (ver mesclarItemPorCampo
      // abaixo), ou com o resolvedor específico da coleção (boxes: vaga
      // por vaga), em vez de descartar o lado remoto inteiro.
      resultado.push((resolverColisao || mesclarItemPorCampo)(emBase, emLocal, emRemoto));
    } else resultado.push(emRemoto); // nenhum dos dois mudou
  });

  return resultado;
}

// ---------------------------------------------------------------------------
// Pedido do usuário (quando os motoristas/operadores começarem a usar o
// sistema ao mesmo tempo, a carga dos BOXES não pode entrar em conflito):
// diferente de `lojas`/`protocolos` (cada registro pertence a uma única
// operação), um BOX é um recurso COMPARTILHADO — quase toda ação do sistema
// (apontamento, agrupamento, carregamento, cancelamento) ocupa ou libera
// vagas de algum box. Isso faz dois operadores mexerem no MESMO número de
// box (ex.: "Box 9") o tempo todo, mesmo quando cada um está ocupando vagas
// DIFERENTES dele — e a regra geral de colisão acima ("fica com a local")
// trataria o box inteiro como perdido pra quem não "venceu", apagando a
// alocação de vaga de uma das duas pessoas sem aviso.
//
// Por isso, uma colisão num box não descarta o lado remoto inteiro: mescla
// vaga por vaga (mesma lógica de 3 pontas, usando o número da vaga como
// identidade — ver CHAVE_COLECAO.boxes acima). Assim, duas pessoas ocupando
// vagas diferentes do mesmo box (o caso comum, e exatamente o cenário dos
// motoristas usando o box ao mesmo tempo) nunca se apagam uma à outra — só
// uma colisão na MESMÍSSIMA vaga, no mesmíssimo instante, ainda precisa
// escolher um lado (fica com a local, mesmo critério de sempre).
function mesclarBox(baseBox, localBox, remotoBox) {
  if (!baseBox || !localBox || !remotoBox) return remotoBox || localBox || baseBox;
  return {
    ...mesclarItemPorCampo(baseBox, localBox, remotoBox),
    vagas: mesclarColecaoPorChave('numero', baseBox.vagas, localBox.vagas, remotoBox.vagas).sort(
      (a, b) => a.numero - b.numero
    ),
  };
}

// Pedido do usuário ("estamos perdendo muita atualização"): a colisão num
// item que NÃO é box (loja, protocolo...) ficava com a versão local INTEIRA
// e jogava fora a remota inteira — mas na operação real as três frentes
// (faturamento registrando NF/protocolo, box mudando status, motorista
// registrando entrega) mexem em CAMPOS diferentes dos MESMOS registros o
// tempo todo, então "o mesmo registro ao mesmo tempo" não era raro como o
// comentário do topo supunha. Agora a colisão mescla campo por campo (mesma
// lógica de 3 pontas): só uma colisão no MESMÍSSIMO campo, no mesmo
// instante, ainda escolhe um lado (fica com a local).
function mesclarItemPorCampo(base, local, remoto) {
  if (!local || !remoto) return remoto || local || base;
  // Sem base = o item foi CRIADO nesta tela e a gravação dele já voltou do
  // servidor, enquanto a tela seguia mudando campos dele (ex.: criou um
  // protocolo e já registrou a entrega) — mescla campo a campo contra uma
  // base vazia, em vez de ficar só com o remoto (que perderia esses campos).
  const baseItem = base || {};
  const resultado = {};
  new Set([...Object.keys(baseItem), ...Object.keys(local), ...Object.keys(remoto)]).forEach((campo) => {
    const emBase = baseItem[campo];
    const emLocal = local[campo];
    const emRemoto = remoto[campo];
    const localMudou = !iguais(emLocal, emBase);
    // A local mudou (sozinha, ou colisão real no MESMO campo): fica a local;
    // senão fica a remota (mudou ou não). `undefined` = campo removido
    // daquele lado.
    const valor = localMudou ? emLocal : emRemoto;
    if (valor !== undefined) resultado[campo] = valor;
  });
  return resultado;
}

// Resolvedores de colisão por coleção — `boxes` mescla vaga por vaga (ver
// mesclarBox); todas as outras mesclam campo por campo (mesclarItemPorCampo,
// usado como padrão em mesclarColecaoPorChave).
const RESOLVEDOR_COLISAO_POR_COLECAO = { boxes: mesclarBox };

function mesclarMapaObjeto(base, local, remoto) {
  const baseObj = base && typeof base === 'object' ? base : {};
  const localObj = local && typeof local === 'object' ? local : {};
  const remotoObj = remoto && typeof remoto === 'object' ? remoto : {};

  const todasAsChaves = new Set([...Object.keys(baseObj), ...Object.keys(localObj), ...Object.keys(remotoObj)]);
  const resultado = {};

  todasAsChaves.forEach((chave) => {
    const emBase = baseObj[chave];
    const emLocal = localObj[chave];
    const emRemoto = remotoObj[chave];

    if (emLocal == null && emRemoto == null) return; // removido/ausente dos dois lados

    const localMudou = !iguais(emLocal, emBase);
    const remotoMudou = !iguais(emRemoto, emBase);

    if (emLocal == null) {
      if (emRemoto != null) resultado[chave] = emRemoto;
      return;
    }
    if (emRemoto == null) {
      if (emBase == null) resultado[chave] = emLocal; // criado só local (nunca existiu na base)
      return;
    }

    if (localMudou && !remotoMudou) resultado[chave] = emLocal;
    else if (!localMudou && remotoMudou) resultado[chave] = emRemoto;
    else if (localMudou && remotoMudou) resultado[chave] = emLocal; // colisão real — ver comentário acima
    else resultado[chave] = emRemoto; // nenhum dos dois mudou
  });

  return resultado;
}

function mesclarColecaoSimples(base, local, remoto) {
  const baseSet = new Set(Array.isArray(base) ? base : []);
  const localSet = new Set(Array.isArray(local) ? local : []);
  const remotoSet = new Set(Array.isArray(remoto) ? remoto : []);

  const resultado = new Set();
  new Set([...localSet, ...remotoSet]).forEach((item) => {
    const excluidoLocal = baseSet.has(item) && !localSet.has(item);
    const excluidoRemoto = baseSet.has(item) && !remotoSet.has(item);
    if (excluidoLocal || excluidoRemoto) return; // respeita exclusão de qualquer lado
    resultado.add(item);
  });
  return [...resultado];
}

/**
 * Mescla uma atualização remota (recém-chegada via Supabase Realtime) com o
 * estado local, usando `base` como o último estado que sabíamos que o
 * servidor tinha ANTES da edição local em curso — assim uma ação local
 * feita depois desse `base` e ainda não salva não é apagada quando o
 * remoto chega (ver useSyncedAppState.js, que chama isso só quando há uma
 * gravação local pendente).
 */
export function mesclarEstadoSincronizado(base, local, remoto) {
  if (!base || !local || !remoto) return remoto;

  const resultado = { ...remoto };

  Object.entries(CHAVE_COLECAO).forEach(([campo, chave]) => {
    resultado[campo] = mesclarColecaoPorChave(
      chave,
      base[campo],
      local[campo],
      remoto[campo],
      RESOLVEDOR_COLISAO_POR_COLECAO[campo]
    );
  });

  COLECOES_SIMPLES.forEach((campo) => {
    resultado[campo] = mesclarColecaoSimples(base[campo], local[campo], remoto[campo]);
  });

  MAPAS_OBJETO.forEach((campo) => {
    resultado[campo] = mesclarMapaObjeto(base[campo], local[campo], remoto[campo]);
  });

  CAMPOS_ESCALARES.forEach((campo) => {
    if (!iguais(local[campo], base[campo])) resultado[campo] = local[campo];
  });

  return resultado;
}
