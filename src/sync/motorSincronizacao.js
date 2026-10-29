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
//
// Sincronização LEVE (pedido do usuário: "atingindo o limite do Supabase"):
// antes, cada ação fazia o Supabase mandar o documento inteiro (~300 kB) pra
// cada aparelho conectado, e de volta pra quem gravou — ~41 GB/mês contra os
// 5 GB do plano gratuito. Agora:
//
// 6) A gravação devolve só o número da versão. O que chega aos outros
//    aparelhos (e a nós mesmos, como "eco") é a lista de patches daquela
//    versão (tabela app_state_log), aplicada sobre a `base`. Só se aplica a
//    versão SEGUINTE à que já temos (ultimaVersao + 1): se faltar alguma
//    (evento perdido), a gente se atualiza pelo diário ou, em último caso,
//    relê o documento (atualizarDoServidor).
//
// 7) Depois de gravar, esperamos o eco da nossa versão antes de gravar de
//    novo: só então a `base` já contém a nossa mudança (sem isso, o diff
//    base→tela ainda veria a mudança como pendente e a mandaria outra vez).
//    Se o eco não chegar em poucos segundos, o motor busca no servidor.
// ---------------------------------------------------------------------------
import { mesclarEstadoSincronizado } from '../utils/mesclarEstadoSincronizado';
import { calcularPatchesEstado } from '../utils/calcularPatchesEstado';
import { aplicarPatchesEstado } from '../utils/aplicarPatchesEstado';

// Quanto esperar o "eco" da nossa própria gravação (ver esperarEco) antes de
// se atualizar por conta própria.
const ESPERA_ECO_MS = 4000;

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

  // Sincronização leve (ver tópicos 6 e 7 no topo).
  let aguardandoEco = null; // versão da nossa gravação cujo eco ainda não chegou
  let timerEco = null;
  let atualizando = false;
  let repetirAtualizacao = false;
  let precisaReler = false; // evento recebido antes da carga inicial terminar

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
    // O eco da nossa gravação chegou (ou o servidor já passou dela): a `base`
    // agora contém a nossa mudança — pode gravar de novo.
    if (aguardandoEco != null && ultimaVersao != null && ultimaVersao >= aguardandoEco) liberarEco();
    return true;
  };

  function liberarEco() {
    aguardandoEco = null;
    if (timerEco) clearTimeout(timerEco);
    timerEco = null;
    gravando = false;
  }

  // Depois de absorver uma atualização do servidor: se a gravação estava
  // parada esperando o eco (ou há algo novo pra gravar), segue o fluxo.
  const aposAbsorver = () => {
    if (gravando) return;
    if (temAlteracaoPendente()) agendarGravacao();
    else atualizarStatusOcioso();
  };

  const esperarEco = (versaoEscrita, minhaGeracao) => {
    if (ultimaVersao != null && ultimaVersao >= versaoEscrita) {
      aoTerminarGravacao(); // o eco chegou antes da resposta
      return;
    }
    aguardandoEco = versaoEscrita;
    if (timerEco) clearTimeout(timerEco);
    timerEco = setTimeout(() => {
      timerEco = null;
      if (minhaGeracao !== geracao || aguardandoEco == null) return;
      atualizarDoServidor().then(() => {
        if (minhaGeracao !== geracao || aguardandoEco == null) return;
        // Nem assim ficou em dia (rede?): não trava a gravação. No pior
        // caso a mesma mudança é enviada de novo (os patches são idempotentes).
        liberarEco();
        aoTerminarGravacao();
      });
    }, ESPERA_ECO_MS);
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
      if (!linha.dados) {
        // Resposta leve: só o número da versão (ver tópico 6 no topo).
        const versaoEscrita = typeof data === 'number' ? data : Number(linha.versao);
        if (Number.isFinite(versaoEscrita)) {
          esperarEco(versaoEscrita, minhaGeracao);
          return;
        }
      }
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

  // Aplica no `base` uma lista contígua de versões do diário. Devolve true se
  // aplicou tudo; false se faltou algo / veio versão "completa" (aí quem
  // chama relê o documento).
  function aplicarVersoesDoDiario(linhas) {
    let esperado = ultimaVersao + 1;
    for (const linha of linhas) {
      const v = Number(linha.versao);
      if (v < esperado) continue; // já absorvida
      if (v !== esperado || linha.completo || !Array.isArray(linha.patches)) return false;
      let dados;
      try {
        dados = aplicarPatchesEstado(base, linha.patches);
      } catch (e) {
        return false;
      }
      absorverServidor(v, dados, base);
      esperado = v + 1;
    }
    return true;
  }

  // Se atualiza com o servidor gastando o mínimo: confere só o número da
  // versão (alguns bytes); se houver novidade, busca só as linhas novas do
  // diário (alguns kB); só relê o documento inteiro se o diário não bastar.
  async function passoAtualizar(minhaGeracao) {
    if (transporte.lerVersao && transporte.lerLogDesde && ultimaVersao != null) {
      const { data: versaoServidor, error } = await transporte.lerVersao();
      if (minhaGeracao !== geracao) return;
      if (!error && versaoServidor != null) {
        if (Number(versaoServidor) <= ultimaVersao) return; // nada novo
        const { data: linhas, error: erroLog } = await transporte.lerLogDesde(ultimaVersao);
        if (minhaGeracao !== geracao) return;
        if (!erroLog && Array.isArray(linhas) && linhas.length > 0) {
          const ordenadas = [...linhas].sort((a, b) => Number(a.versao) - Number(b.versao));
          if (aplicarVersoesDoDiario(ordenadas) && ultimaVersao >= Number(versaoServidor)) return;
        }
      }
    }
    const { data, error } = await transporte.lerEstado();
    if (minhaGeracao !== geracao) return;
    if (error || !data) return;
    absorverServidor(data.versao, data.dados, base);
  }

  async function atualizarDoServidor() {
    if (!carregado) return;
    if (atualizando) {
      repetirAtualizacao = true;
      return;
    }
    atualizando = true;
    const minhaGeracao = geracao;
    try {
      do {
        repetirAtualizacao = false;
        // eslint-disable-next-line no-await-in-loop
        await passoAtualizar(minhaGeracao);
        if (minhaGeracao !== geracao) return;
      } while (repetirAtualizacao);
    } finally {
      if (minhaGeracao === geracao) atualizando = false;
    }
    aposAbsorver();
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
    if (precisaReler) {
      precisaReler = false;
      atualizarDoServidor();
    }
  }

  function receberRemoto(linha) {
    if (!linha || !linha.dados) return;
    if (!carregado) {
      carregarInicial(linha);
      return;
    }
    absorverServidor(linha.versao, linha.dados, base);
    if (!gravando && temAlteracaoPendente()) agendarGravacao();
    else aposAbsorver();
  }

  /**
   * Mudança publicada no diário (Realtime leve): { versao, patches, completo }.
   * Só aplica a versão seguinte à que já temos; qualquer buraco, versão
   * "completa" ou patch que não aplique → se atualiza pelo servidor.
   */
  function receberLog(linha) {
    if (!linha) return;
    if (!carregado) {
      precisaReler = true; // a carga inicial pode ter lido antes desta versão
      return;
    }
    const versao = Number(linha.versao);
    if (ultimaVersao != null && versao <= ultimaVersao) return; // eco / já absorvida
    if (ultimaVersao == null || versao !== ultimaVersao + 1 || linha.completo || !Array.isArray(linha.patches)) {
      atualizarDoServidor();
      return;
    }
    let dados;
    try {
      dados = aplicarPatchesEstado(base, linha.patches);
    } catch (e) {
      atualizarDoServidor();
      return;
    }
    absorverServidor(versao, dados, base);
    aposAbsorver();
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
    aguardandoEco = null;
    if (timerEco) clearTimeout(timerEco);
    timerEco = null;
    atualizando = false;
    repetirAtualizacao = false;
    precisaReler = false;
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

    /** Mudança do diário (Realtime leve): aplica patches ou se atualiza. */
    receberLog,

    /** Confere o servidor (volta ao app, reconexão): barato se nada mudou. */
    atualizarDoServidor,

    tentarNovamente() {
      tentativas = 0;
      gravarAgora();
    },

    /** Troca de usuário/logout: descarta tudo que estava em andamento. */
    reiniciar,
    destruir: reiniciar,
  };
}
