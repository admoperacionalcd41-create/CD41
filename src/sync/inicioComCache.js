// ---------------------------------------------------------------------------
// Abrir o app SEM baixar o documento inteiro.
//
// O consumo de egress que sobrou depois da correção do laço de gravações era
// a carga inicial: toda vez que alguém abria ou recarregava o app (celular
// que "dorme", atualização automática, troca de aba), o aparelho baixava o
// estado completo do servidor. Aqui o aparelho guarda no próprio navegador a
// última versão confirmada pelo servidor (`base` + número da versão) e, ao
// abrir, só pergunta "qual é a versão agora?" (alguns bytes) e busca no diário
// o que mudou desde então (alguns kB). O documento inteiro só é baixado se o
// cache não existir, estiver velho demais (o diário guarda ~1000 versões) ou
// não bater com o servidor (ex.: banco restaurado).
//
// Segurança: o cache é só a `base` de uma sincronização — as alterações
// locais ainda não gravadas continuam sendo calculadas contra ela e enviadas
// como patches, exatamente como depois de uma carga completa.
// ---------------------------------------------------------------------------

export const CHAVE_SNAPSHOT = 'doca-manager:base-sincronizada-v1';

export function lerSnapshot(storage) {
  try {
    const bruto = storage.getItem(CHAVE_SNAPSHOT);
    if (!bruto) return null;
    const s = JSON.parse(bruto);
    if (!s || typeof s.versao !== 'number' || !Number.isFinite(s.versao) || !s.dados || typeof s.dados !== 'object') {
      return null;
    }
    return { versao: s.versao, dados: s.dados };
  } catch (e) {
    return null;
  }
}

export function salvarSnapshot(storage, versao, dados) {
  try {
    storage.setItem(CHAVE_SNAPSHOT, JSON.stringify({ versao, dados }));
    return true;
  } catch (e) {
    // Cota cheia ou armazenamento bloqueado: segue sem cache (carga completa).
    try {
      storage.removeItem(CHAVE_SNAPSHOT);
    } catch (e2) {
      /* nada a fazer */
    }
    return false;
  }
}

/**
 * Grava a base no armazenamento no máximo uma vez a cada `esperaMs` (a base
 * muda a cada gravação de qualquer usuário; não vale serializar ~centenas de
 * kB a cada uma). Devolve { agendar(versao, dados), forcar() }.
 */
export function criarGravadorDeSnapshot(storage, esperaMs = 3000, agendarFn = setTimeout, cancelarFn = clearTimeout) {
  let pendente = null;
  let timer = null;
  const gravar = () => {
    timer = null;
    if (!pendente) return;
    const { versao, dados } = pendente;
    pendente = null;
    salvarSnapshot(storage, versao, dados);
  };
  return {
    agendar(versao, dados) {
      pendente = { versao, dados };
      if (!timer) timer = agendarFn(gravar, esperaMs);
    },
    forcar() {
      if (timer) cancelarFn(timer);
      gravar();
    },
  };
}

/**
 * Tenta iniciar o motor pelo cache. Devolve true se iniciou (o motor já
 * está "carregado" e começou a se atualizar pelo diário); false se o chamador
 * deve fazer a carga completa de sempre.
 *
 * @param {object} p
 * @param {{versao:number,dados:object}|null} p.snapshot
 * @param {() => Promise<number|null>} p.lerVersaoServidor  só o número da versão
 * @param {object} p.motor
 */
export async function iniciarComSnapshot({ snapshot, lerVersaoServidor, motor }) {
  if (!snapshot) return false;
  let versaoServidor;
  try {
    versaoServidor = await lerVersaoServidor();
  } catch (e) {
    return false;
  }
  // Sem resposta, ou o servidor está ATRÁS do cache (banco restaurado/zerado):
  // o cache não vale — carga completa.
  if (versaoServidor == null || !Number.isFinite(Number(versaoServidor)) || Number(versaoServidor) < snapshot.versao) {
    return false;
  }
  motor.carregarInicial({ versao: snapshot.versao, dados: snapshot.dados });
  // Busca só o que mudou (ou, se o diário não cobrir, o documento inteiro).
  motor.atualizarDoServidor();
  return true;
}
