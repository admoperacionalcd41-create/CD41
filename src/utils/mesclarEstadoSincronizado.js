// ---------------------------------------------------------------------------
// Mitigação do problema de sincronização relatado pelo usuário: dois
// operadores mexendo na aba Agrupamento & Etiquetas quase ao mesmo tempo —
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

// Coleções identificadas por uma chave própria em cada item.
const CHAVE_COLECAO = {
  lojas: 'id',
  protocolos: 'id',
  boxes: 'numero',
  placasCadastradas: 'placa',
  contatosNotificacao: 'telefone',
  localizacaoLojas: 'codigo',
};

// Coleções de strings simples (nomes cadastrados), sem identidade própria.
const COLECOES_SIMPLES = ['colaboradoresCadastrados', 'motoristasCadastrados'];

// Campos escalares onde uma edição local concorrente deve prevalecer sobre
// o remoto (mesmo critério das coleções: a ação local mais recente, ainda
// não salva, não deve sumir sem alguém tentar gravá-la).
const CAMPOS_ESCALARES = ['diaAtual', 'valorPaletesAgrupamento'];

function paraMapa(colecao, chave) {
  const mapa = new Map();
  (Array.isArray(colecao) ? colecao : []).forEach((item) => {
    if (item && item[chave] != null) mapa.set(item[chave], item);
  });
  return mapa;
}

function iguais(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function mesclarColecaoPorChave(chave, base, local, remoto) {
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
    else if (localMudou && remotoMudou) resultado.push(emLocal); // colisão real — ver comentário acima
    else resultado.push(emRemoto); // nenhum dos dois mudou
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
    resultado[campo] = mesclarColecaoPorChave(chave, base[campo], local[campo], remoto[campo]);
  });

  COLECOES_SIMPLES.forEach((campo) => {
    resultado[campo] = mesclarColecaoSimples(base[campo], local[campo], remoto[campo]);
  });

  CAMPOS_ESCALARES.forEach((campo) => {
    if (!iguais(local[campo], base[campo])) resultado[campo] = local[campo];
  });

  return resultado;
}
