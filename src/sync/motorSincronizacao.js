// ---------------------------------------------------------------------------
// Motor de sincronização do estado compartilhado (app_state) — JS puro, sem
// React, pra poder ser testado de verdade com vários "usuários" simulados
// contra o Postgres real (ver test-sincronizacao-multiusuario.mjs). O hook
// useSyncedAppState.js só liga este motor ao React (tela) e ao Supabase
// (rede + Realtime).
//
// Pedido do usuário ("estamos perdendo muita atualização e confusão na
// operação"): a versão anterior desta lógica (dentro do hook) foi
// reproduzida numa simulação com 5 usuários mexendo em campos diferentes
// dos mesmos registros — perdia ~80 de ~110 atualizações. Três defeitos
// independentes, todos corrigidos aqui:
//
// 1) Depois de gravar, a "base" (último estado conhecido do servidor)
//    passava a ser o documento devolvido pelo banco — que já trazia as
//    mudanças de OUTRAS pessoas aplicadas antes da nossa — mas a TELA (o
//    estado local) não recebia essas mudanças. Na gravação seguinte, o
//    diff "base → tela" via a mudança da outra pessoa como algo que esta
//    tela tinha DESFEITO, e mandava desfazer no banco. Agora a resposta da
//    gravação é mesclada na tela (3 pontas: o que enviamos / a tela agora /
//    o que o banco devolveu).
//
// 2) Uma atualização que chegava pelo Realtime enquanto a NOSSA gravação
//    ainda estava a caminho do servidor substituía a tela inteira (a ação
//    que acabou de ser feita "sumia" da tela) — a janela de proteção só
//    cobria os 200ms de espera antes de enviar, não a viagem de rede. Agora
//    toda atualização recebida é sempre mesclada com o que a tela tem de
//    ainda não confirmado.
//
// 3) Duas gravações deste mesmo aparelho podiam estar no ar ao mesmo tempo
//    (cliques seguidos com rede lenta), cada uma calculada sobre uma base
//    velha. Agora só uma por vez: a próxima sai quando a anterior volta,
//    já calculada sobre a base nova.
//
// Mais duas proteções:
//
// 4) Nenhuma gravação sai antes de carregar o estado do servidor. Antes,
//    uma ação feita logo ao abrir o app (rede lenta) gravava o documento
//    INTEIRO a partir do que estava salvo no navegador — possivelmente de
//    horas/dias atrás — por cima de tudo. Agora as ações feitas antes da
//    carga ficam numa fila e são reaplicadas sobre os dados reais assim
//    que eles chegam.
//
// 5) Se a gravação por patches der erro, primeiro recarrega o estado do
//    servidor, mescla e tenta de novo (resolve, por ex., um box que mudou
//    de numeração); só se falhar de novo é que grava o documento inteiro
//    (último recurso, pra nunca perder a ação).
// ---------------------------------------------------------------------------
import { mesclarEstadoSincronizado } from '../utils/mesclarEstadoSincronizado';
import { calcularPatchesEstado } from '../utils/calcularPatchesEstado';

const identidade = (d) => d;
const extrairLinha = (data) => (Array.isArray(data) ? data[0] : data) || {};

/**
 * @param {object} opcoes
 * @param {object} opcoes.transporte
 *   aplicarPatches(patches) => Promise<{ data, error }>   (RPC app_state_aplicar_patches)
 *   gravarCompleto(dados)   => Promise<{ data, error }>   (RPC app_state_gravar_completo)
 *   lerEstado()             => Promise<{ data: { versao, dados } | null, error }>
 * @param {object} opcoes.estadoInicial   estado local de partida (o salvo no navegador)
 * @param {(d: object) => object} [opcoes.normalizar]
 * @param {(estado: object) => void} [opcoes.aoMudarEstado]   tela deve passar a mostrar `estado`
 * @param {(s: {status, mensagem, tentativas}) => void} [opcoes.aoMudarStatus]
 * @param {(aviso: object|null) => void} [opcoes.aoAvisoPatches]
 */
export function criarMotorSincronizacao({
  transporte,
  estadoInicial,
  normalizar = identidade,
  aoMudarEstado = () => {},
  aoMudarStatus = () => {},
  aoAvisoPatches = () => {},
  atrasoGravacaoMs = 200,
}) {
  let local = estadoInicial;
  let base = null; // último estado sabidamente refletido no servidor
  let ultimaVersao = null;
  let carregado = false;
  let filaAntesDaCarga = [];

  let timerGravacao = null;
  let timerNovaTentativa = null;
  let gravando = false;
  let tentativas = 0;
  let errosPatchSeguidos = 0;
  let granularidadeCampo = true;
  // Toda resposta de rede carrega o número da "geração" em que foi pedida —
  // se o motor foi reiniciado no meio (troca de usuário/logout), a resposta
  // velha é ignorada.
  let geracao = 0;

  let statusAtual = { status: 'sincronizado', mensagem: null, tentativas: 0 };
  const status = (novo) => {
    statusAtual = novo;
    aoMudarStatus(novo);
  };

  const definirLocal = (novo) => {
    local = novo;
    aoMudarEstado(novo);
  };

  const temAlteracaoPendente = () => {
    if (!carregado || !base) return false;
    const patches = calcularPatchesEstado(base, normalizar(local), { granularidadeCampo });
    return patches === null || patches.length > 0;
  };

  const atualizarStatusOcioso = () => {
    if (!gravando && !timerGravacao && !timerNovaTentativa) {
      status({ status: 'sincronizado', mensagem: null, tentativas: 0 });
    }
  };

  const agendarGravacao = () => {
    if (!carregado) return;
    if (timerGravacao) clearTimeout(timerGravacao);
    if (statusAtual.status !== 'erro') status({ status: 'salvando', mensagem: null, tentativas });
    timerGravacao = setTimeout(() => {
      timerGravacao = null;
      gravarAgora();
    }, atrasoGravacaoMs);
  };

  const agendarNovaTentativa = (mensagem) => {
    tentativas += 1;
    status({ status: 'erro', mensagem, tentativas });
    if (timerNovaTentativa) clearTimeout(timerNovaTentativa);
    const espera = Math.min(5000 * 2 ** Math.min(tentativas - 1, 4), 60000);
    timerNovaTentativa = setTimeout(() => {
      timerNovaTentativa = null;
      gravarAgora();
    }, espera);
  };

  // Aplica uma versão do servidor (vinda do Realtime, de uma leitura, ou da
  // resposta da nossa própria gravação) SEM perder o que a tela tem de
  // ainda não confirmado. Invariante: tela = `base` + mudanças locais ainda
  // não confirmadas; por isso a mescla de 3 pontas usa sempre a `base`
  // atual como ponto de partida.
  const absorverServidor = (versao, dadosServidor, baseDaMescla) => {
    if (typeof versao === 'number' && ultimaVersao != null && versao <= ultimaVersao) return false;
    if (typeof versao === 'number') ultimaVersao = versao;
    const remoto = normalizar(dadosServidor);
    const mesclado = baseDaMescla ? mesclarEstadoSincronizado(baseDaMescla, local, remoto) : remoto;
    base = remoto;
    definirLocal(mesclado);
    return true;
  };

  const aoTerminarGravacao = () => {
    gravando = false;
    if (temAlteracaoPendente()) agendarGravacao();
    else atualizarStatusOcioso();
  };

  const gravarCompleto = (minhaGeracao) => {
    const enviado = normalizar(local);
    gravando = true;
    transporte.gravarCompleto(enviado).then(({ data, error }) => {
      if (minhaGeracao !== geracao) return;
      if (error) {
        gravando = false;
        // eslint-disable-next-line no-console
        console.warn('Não foi possível sincronizar o estado com o Supabase:', error.message);
        agendarNovaTentativa(error.message);
        return;
      }
      tentativas = 0;
      errosPatchSeguidos = 0;
      const linha = extrairLinha(data);
      absorverServidor(linha.versao, linha.dados ?? enviado, base ?? enviado);
      aoTerminarGravacao();
    });
  };

  const recarregarEDepoisGravar = (minhaGeracao) => {
    gravando = true;
    transporte.lerEstado().then(({ data, error }) => {
      if (minhaGeracao !== geracao) return;
      gravando = false;
      if (error) {
        agendarNovaTentativa(error.message);
        return;
      }
      if (data) absorverServidor(data.versao, data.dados, base);
      gravarAgora();
    });
  };

  function gravarAgora() {
    if (!carregado) return;
    if (gravando) return; // aoTerminarGravacao reagenda se ainda houver algo pendente
    if (timerGravacao) {
      clearTimeout(timerGravacao);
      timerGravacao = null;
    }
    if (timerNovaTentativa) {
      clearTimeout(timerNovaTentativa);
      timerNovaTentativa = null;
    }
    const minhaGeracao = geracao;
    const enviado = normalizar(local);
    const patches = calcularPatchesEstado(base, enviado, { granularidadeCampo });

    if (patches === null) {
      gravarCompleto(minhaGeracao);
      return;
    }
    if (patches.length === 0) {
      atualizarStatusOcioso();
      return;
    }

    gravando = true;
    status({ status: 'salvando', mensagem: null, tentativas });
    transporte.aplicarPatches(patches).then(({ data, error }) => {
      if (minhaGeracao !== geracao) return;
      if (error) {
        gravando = false;
        const mensagem = error.message || 'erro desconhecido';
        // eslint-disable-next-line no-console
        console.warn('Gravação por patches falhou:', mensagem, error);
        aoAvisoPatches({
          mensagem,
          codigo: error.code || null,
          detalhes: error.details || null,
          hint: error.hint || null,
          em: new Date().toLocaleString('pt-BR'),
        });
        // Banco ainda sem a op `mesclar_item` (migração não rodada): volta
        // pro item inteiro nesta sessão e tenta de novo na hora.
        if (granularidadeCampo && /mesclar_item/.test(mensagem)) {
          granularidadeCampo = false;
          gravarAgora();
          return;
        }
        if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|timed? ?out/i.test(mensagem)) {
          agendarNovaTentativa(mensagem); // rede: só tenta de novo, sem mudar de estratégia
          return;
        }
        errosPatchSeguidos += 1;
        if (errosPatchSeguidos === 1) recarregarEDepoisGravar(minhaGeracao);
        else gravarCompleto(minhaGeracao); // último recurso: nunca perder a ação
        return;
      }
      tentativas = 0;
      errosPatchSeguidos = 0;
      aoAvisoPatches(null);
      const linha = extrairLinha(data);
      // Defeito 1 (ver topo): a resposta traz as mudanças de outras pessoas
      // já aplicadas no banco — mescla na tela, não só na base. A base da
      // mescla é a `base` ATUAL (não o que enviamos): a tela é sempre
      // "base + o que ainda não foi confirmado", inclusive depois de
      // absorver atualizações que chegaram pelo Realtime enquanto esta
      // gravação estava no ar — usar o que enviamos faria essas
      // atualizações parecerem edições desta tela e serem desfeitas.
      if (linha.dados) absorverServidor(linha.versao, linha.dados, base);
      aoTerminarGravacao();
    });
  }

  function carregarInicial(linha) {
    const fila = filaAntesDaCarga;
    filaAntesDaCarga = [];
    carregado = true;
    if (!linha) {
      gravarCompleto(geracao);
      return;
    }
    ultimaVersao = typeof linha.versao === 'number' ? linha.versao : 0;
    base = normalizar(linha.dados);
    let estado = base;
    fila.forEach((fn) => {
      estado = fn(estado);
    });
    definirLocal(estado);
    if (temAlteracaoPendente()) agendarGravacao();
    else atualizarStatusOcioso();
  }

  function receberRemoto(linha) {
    if (!linha || !linha.dados) return;
    if (!carregado) {
      carregarInicial(linha);
      return;
    }
    absorverServidor(linha.versao, linha.dados, base);
    if (!gravando && temAlteracaoPendente()) agendarGravacao();
  }

  function reiniciar() {
    geracao += 1;
    if (timerGravacao) clearTimeout(timerGravacao);
    if (timerNovaTentativa) clearTimeout(timerNovaTentativa);
    timerGravacao = null;
    timerNovaTentativa = null;
    gravando = false;
    carregado = false;
    base = null;
    ultimaVersao = null;
    filaAntesDaCarga = [];
    tentativas = 0;
    errosPatchSeguidos = 0;
  }

  return {
    estadoLocal: () => local,
    status: () => statusAtual,
    carregado: () => carregado,
    ocioso: () => !gravando && !timerGravacao && !timerNovaTentativa,

    /** Ação do usuário: aplica na tela na hora e agenda a gravação. */
    aplicarLocal(atualizacao) {
      const proximo = typeof atualizacao === 'function' ? atualizacao(local) : atualizacao;
      if (!carregado && typeof atualizacao === 'function') filaAntesDaCarga.push(atualizacao);
      definirLocal(proximo);
      agendarGravacao();
    },

    /**
     * Estado inicial do servidor (`linha` = { versao, dados }, ou null se a
     * linha ainda não existe). Reaplica sobre ele as ações feitas antes.
     */
    carregarInicial,

    /** Atualização recebida (Realtime ou releitura): sempre mescla. */
    receberRemoto,

    tentarNovamente() {
      tentativas = 0;
      gravarAgora();
    },

    /** Troca de usuário/logout: descarta tudo que estava em andamento. */
    reiniciar,
    destruir: reiniciar,
  };
}
