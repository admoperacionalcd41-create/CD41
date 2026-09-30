import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURADO } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from './useLocalStorage';
import { sincronizarBoxes, criarBoxesIniciais } from '../utils/boxLogic';
import { hojeISO } from '../utils/dateHelpers';

// ---------------------------------------------------------------------------
// OTIMIZAÇÃO (pedido do usuário — sincronização ficando lenta pra todo mundo
// conforme o dia operacional acumula dados): até aqui, o estado inteiro do
// sistema (lojas, boxes, protocolos, cadastros — tudo) vivia num único
// registro JSON (id fixo "estado-v1"). Qualquer ação de qualquer usuário
// gravava e retransmitia (via Supabase Realtime) ESSE JSON INTEIRO pra todo
// mundo conectado, mesmo quando a ação só mudava uma cobrinha de informação
// (ex.: registrar uma saída de motorista reescrevia também todos os
// cadastros, mesmo que eles não tivessem mudado). Como esse JSON só cresce
// ao longo do dia (mais lojas, mais protocolos), cada sincronização ficava
// mais pesada — exatamente a lentidão relatada.
//
// Agora o estado é dividido em "pedaços" (linhas separadas na mesma tabela
// `app_state`, cada uma com seu próprio id), e cada gravação/retransmissão
// só envia o(s) pedaço(s) que realmente mudaram:
//   - "lojas"      → state.lojas
//   - "protocolos" → state.protocolos
//   - "boxes"      → state.boxes
//   - "cadastros"  → diaAtual + colaboradores/motoristas/placas/contatos/
//                    localização das lojas (muda raramente — deixava de ser
//                    reescrito a cada apontamento/carregamento sem motivo)
// Nenhuma mudança de schema foi necessária (a tabela já aceitava qualquer
// texto como id) — só a forma como o app lê/grava é diferente.
//
// Efeito colateral bom: os campos ultimoErro/ultimoAviso (mensagens de
// erro/aviso da TELA, pensadas só pra quem fez a ação) nunca fizeram parte
// de nenhum desses pedaços — então param de ser sincronizados entre
// usuários. Antes, um erro de validação de um usuário podia aparecer
// brevemente na tela de outro; agora fica só local, como já devia ser.
//
// Migração automática: quem já tinha o sistema em produção com o formato
// antigo (registro único "estado-v1") não perde nada — na primeira vez que
// o app com este código carrega, ele detecta que os pedaços novos ainda não
// existem, lê o registro antigo uma vez, divide os dados e grava os quatro
// pedaços nesse novo formato. O registro antigo é só deixado de lado
// (inofensivo) — nada precisa ser feito manualmente no Supabase.
//
// Importante durante a migração: um navegador que ainda está com uma aba
// aberta da versão ANTERIOR do app continua funcionando normalmente com o
// formato antigo (sem erros) até a pessoa dar um refresh — só não vai ver,
// enquanto isso, as mudanças de quem já está na versão nova (e vice-versa).
// É por isso que vale pedir pra todo mundo atualizar a página uma vez depois
// de subir esta atualização.
// ---------------------------------------------------------------------------

// Id do registro único usado ANTES desta otimização — mantido só pra
// permitir a migração automática (ver acima). Não é mais gravado.
const ID_ESTADO_LEGADO = 'estado-v1';

// Ids dos quatro pedaços em que o estado é dividido agora — cada um vira uma
// linha própria na tabela `app_state`.
const BUCKETS = ['lojas', 'protocolos', 'boxes', 'cadastros'];

// Tempo de espera, depois da última mudança local, antes de gravar no
// Supabase — evita uma gravação por clique quando várias ações acontecem em
// sequência rápida (ex.: apontar várias lojas seguidas). A tela sempre
// atualiza na hora (gravação é só em segundo plano).
const ATRASO_GRAVACAO_MS = 600;

// Extrai de um estado completo só os campos que pertencem a um pedaço
// (bucket) específico — usado tanto pra gravar quanto pra comparar com a
// última versão já enviada (e decidir se aquele pedaço precisa ser
// regravado). Note que ultimoErro/ultimoAviso nunca aparecem aqui de
// propósito (ver comentário no topo do arquivo).
function extrairBucket(chave, estado) {
  switch (chave) {
    case 'lojas':
      return { lojas: estado.lojas };
    case 'protocolos':
      return { protocolos: estado.protocolos };
    case 'boxes':
      return { boxes: estado.boxes };
    case 'cadastros':
      return {
        diaAtual: estado.diaAtual,
        colaboradoresCadastrados: estado.colaboradoresCadastrados,
        motoristasCadastrados: estado.motoristasCadastrados,
        placasCadastradas: estado.placasCadastradas,
        contatosNotificacao: estado.contatosNotificacao,
        localizacaoLojas: estado.localizacaoLojas,
      };
    default:
      return {};
  }
}

// Garante que os dados de um pedaço vindos de fora (Supabase — outra pessoa
// pode estar numa versão ligeiramente diferente do app) tenham o mesmo
// formato "vazio" que o reducer usa, com o mesmo valor padrão de antes (ver
// SINCRONIZAR_BOXES/SINCRONIZAR_CADASTROS em AppContext.jsx). Sem isso, um
// campo ausente quebra a tela com "Cannot read properties of undefined".
function normalizarBucket(chave, dados) {
  if (!dados || typeof dados !== 'object') return {};
  switch (chave) {
    case 'lojas':
      return { lojas: Array.isArray(dados.lojas) ? dados.lojas : [] };
    case 'protocolos':
      return { protocolos: Array.isArray(dados.protocolos) ? dados.protocolos : [] };
    case 'boxes':
      return { boxes: sincronizarBoxes(Array.isArray(dados.boxes) ? dados.boxes : criarBoxesIniciais()) };
    case 'cadastros': {
      const placasBrutas = Array.isArray(dados.placasCadastradas) ? dados.placasCadastradas : [];
      return {
        diaAtual: dados.diaAtual || hojeISO(),
        colaboradoresCadastrados: Array.isArray(dados.colaboradoresCadastrados) ? dados.colaboradoresCadastrados : [],
        motoristasCadastrados: Array.isArray(dados.motoristasCadastrados) ? dados.motoristasCadastrados : [],
        placasCadastradas: placasBrutas.map((p) => (typeof p === 'string' ? { placa: p, possuiPlataforma: false } : p)),
        contatosNotificacao: Array.isArray(dados.contatosNotificacao) ? dados.contatosNotificacao : [],
        localizacaoLojas: Array.isArray(dados.localizacaoLojas) ? dados.localizacaoLojas : [],
      };
    }
    default:
      return {};
  }
}

// Normaliza um registro completo no formato ANTIGO (um JSON só, com tudo
// junto) — usado apenas na migração automática de quem ainda tem dados
// nesse formato (ver ID_ESTADO_LEGADO acima).
function normalizarEstadoLegado(dados) {
  let normalizado = {};
  BUCKETS.forEach((chave) => {
    normalizado = { ...normalizado, ...normalizarBucket(chave, dados) };
  });
  return normalizado;
}

/**
 * Substituto de useLocalStorage que, com o Supabase configurado (site
 * publicado), mantém o estado inteiro do app sincronizado em tempo real
 * entre todos os usuários logados: guarda os dados divididos em pedaços
 * (ver BUCKETS acima) na tabela `app_state` e escuta mudanças via Supabase
 * Realtime — qualquer ação de um usuário aparece na tela dos outros em
 * segundos, sem precisar recarregar a página, e sem reenviar o que não
 * mudou. Sem Supabase configurado (preview local/demo), funciona
 * exatamente como antes: só localStorage, sem rede.
 *
 * API idêntica a useLocalStorage: retorna [estado, setEstado].
 */
export function useSyncedAppState(chaveLocal, gerarValorInicial) {
  const [estadoLocal, setEstadoLocal] = useLocalStorage(chaveLocal, gerarValorInicial);

  if (!SUPABASE_CONFIGURADO) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useEstadoSomenteLocal(estadoLocal, setEstadoLocal);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useEstadoSincronizado(estadoLocal, setEstadoLocal);
}

// SUPABASE_CONFIGURADO é fixo durante toda a vida do app (definido no
// build), então esse desvio nunca muda de resultado entre renderizações de
// uma mesma instância — o único jeito de useEstadoSincronizado chamar hooks
// em número/ordem diferente seria SUPABASE_CONFIGURADO mudar em tempo de
// execução, o que não acontece.
function useEstadoSomenteLocal(estadoLocal, setEstadoLocal) {
  return [estadoLocal, setEstadoLocal];
}

function useEstadoSincronizado(estadoLocal, setEstadoLocal) {
  const { usuario } = useAuth();
  const idUsuario = usuario?.id ?? null;

  const estadoRef = useRef(estadoLocal);
  // Último timestamp de gravação aplicado, POR PEDAÇO — usado pra ignorar o
  // eco da própria gravação e eventos atrasados/fora de ordem daquele
  // pedaço especificamente (antes era um só timestamp pra tudo).
  const ultimoTimestampPorBucketRef = useRef({});
  // Última versão (serializada) de cada pedaço que já está sincronizada com
  // o Supabase (seja porque nós gravamos, seja porque recebemos ela de
  // outra pessoa) — usada pra só gravar/retransmitir o pedaço que
  // realmente mudou desde então, em vez do estado inteiro a cada ação.
  const ultimoEnviadoPorBucketRef = useRef({});
  const timeoutGravacaoRef = useRef(null);
  const idUsuarioRef = useRef(idUsuario);

  useEffect(() => {
    estadoRef.current = estadoLocal;
  }, [estadoLocal]);

  useEffect(() => {
    idUsuarioRef.current = idUsuario;
  }, [idUsuario]);

  // Grava no Supabase só os pedaços passados em `chaves` (pode ser 1, 2, 3
  // ou os 4) — sempre numa única chamada (upsert com várias linhas de uma
  // vez), pra continuar sendo uma única ida-e-volta de rede mesmo quando
  // mais de um pedaço mudou junto (ex.: registrar uma saída de motorista
  // mexe em "lojas" e "protocolos" ao mesmo tempo).
  const gravarBuckets = useCallback((estadoCompleto, chaves) => {
    if (!chaves || chaves.length === 0) return;
    const agora = new Date().toISOString();
    const linhas = chaves.map((chave) => {
      const dadosBucket = extrairBucket(chave, estadoCompleto);
      ultimoTimestampPorBucketRef.current[chave] = agora;
      ultimoEnviadoPorBucketRef.current[chave] = JSON.stringify(dadosBucket);
      return {
        id: chave,
        dados: dadosBucket,
        atualizado_em: agora,
        atualizado_por: idUsuarioRef.current,
      };
    });
    supabase
      .from('app_state')
      .upsert(linhas, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('Não foi possível sincronizar o estado com o Supabase:', error.message);
        }
      });
  }, []);

  // Só busca/escuta o estado compartilhado depois de haver login — antes
  // disso (tela de login) não há sessão autenticada e as regras de acesso
  // do Supabase (RLS) bloqueiam a leitura mesmo.
  useEffect(() => {
    if (!idUsuario) return undefined;
    let ativo = true;

    async function carregarEstadoInicial() {
      const { data: linhasBucket, error: erroBuckets } = await supabase
        .from('app_state')
        .select('id, dados, atualizado_em')
        .in('id', BUCKETS);
      if (!ativo) return;
      if (erroBuckets) {
        // eslint-disable-next-line no-console
        console.warn('Não foi possível carregar o estado compartilhado do Supabase:', erroBuckets.message);
        return;
      }

      if (linhasBucket && linhasBucket.length > 0) {
        // Já está no formato novo (algum outro navegador/sessão já passou
        // por aqui antes) — só juntar os pedaços encontrados.
        let mesclado = estadoRef.current;
        linhasBucket.forEach((linha) => {
          ultimoTimestampPorBucketRef.current[linha.id] = linha.atualizado_em;
          ultimoEnviadoPorBucketRef.current[linha.id] = JSON.stringify(linha.dados || {});
          mesclado = { ...mesclado, ...normalizarBucket(linha.id, linha.dados) };
        });
        setEstadoLocal(mesclado);
        return;
      }

      // Ainda não migrado pro formato em pedaços — procura o registro único
      // antigo (formato usado antes desta otimização) pra migrar sem
      // perder nada do que já está em produção.
      const { data: linhaLegado, error: erroLegado } = await supabase
        .from('app_state')
        .select('dados, atualizado_em')
        .eq('id', ID_ESTADO_LEGADO)
        .maybeSingle();
      if (!ativo) return;
      if (erroLegado) {
        // eslint-disable-next-line no-console
        console.warn('Não foi possível carregar o estado compartilhado do Supabase:', erroLegado.message);
        return;
      }

      if (linhaLegado?.dados) {
        const estadoMigrado = { ...estadoRef.current, ...normalizarEstadoLegado(linhaLegado.dados) };
        setEstadoLocal(estadoMigrado);
        gravarBuckets(estadoMigrado, BUCKETS);
      } else {
        // Primeira vez que o sistema roda com Supabase (nunca existiu nem o
        // registro antigo): publica o estado atual (o que já estava salvo
        // localmente) como ponto de partida compartilhado, pra quem entrar
        // depois já ver o mesmo.
        gravarBuckets(estadoRef.current, BUCKETS);
      }
    }

    carregarEstadoInicial();

    const canal = supabase
      .channel('app_state_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state' },
        (payload) => {
          const novo = payload.new;
          // Ignora linhas que não são um dos quatro pedaços conhecidos —
          // cobre o registro antigo "estado-v1" (que pode continuar
          // recebendo eco de navegadores ainda não atualizados) e qualquer
          // id inesperado.
          if (!novo || !novo.dados || !BUCKETS.includes(novo.id)) return;
          // Ignora o eco da própria gravação (mesmo timestamp que acabamos
          // de enviar) e eventos atrasados/fora de ordem, checando só o
          // timestamp DAQUELE pedaço.
          if (
            ultimoTimestampPorBucketRef.current[novo.id] &&
            novo.atualizado_em <= ultimoTimestampPorBucketRef.current[novo.id]
          ) {
            return;
          }
          ultimoTimestampPorBucketRef.current[novo.id] = novo.atualizado_em;
          ultimoEnviadoPorBucketRef.current[novo.id] = JSON.stringify(novo.dados);
          // Mescla só o pedaço que mudou — os outros campos do estado local
          // mantêm a mesma referência de antes (ajuda o React a não
          // recalcular telas que não dependem do que mudou).
          setEstadoLocal((prev) => ({ ...prev, ...normalizarBucket(novo.id, novo.dados) }));
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [idUsuario, setEstadoLocal, gravarBuckets]);

  // setEstado "público": aplica local na hora (tela sempre responde
  // instantaneamente) e agenda a gravação remota em segundo plano — só dos
  // pedaços que realmente mudaram desde a última sincronização.
  const setEstadoSincronizado = useCallback(
    (atualizacao) => {
      setEstadoLocal((prev) => {
        const proximo = typeof atualizacao === 'function' ? atualizacao(prev) : atualizacao;
        // Só agenda gravação remota se houver sessão — sem isso as regras
        // de acesso do Supabase (RLS) rejeitariam a escrita mesmo.
        if (idUsuarioRef.current) {
          if (timeoutGravacaoRef.current) clearTimeout(timeoutGravacaoRef.current);
          timeoutGravacaoRef.current = setTimeout(() => {
            const estadoAtual = estadoRef.current;
            const chavesAlteradas = BUCKETS.filter((chave) => {
              const serializado = JSON.stringify(extrairBucket(chave, estadoAtual));
              return serializado !== ultimoEnviadoPorBucketRef.current[chave];
            });
            gravarBuckets(estadoAtual, chavesAlteradas);
          }, ATRASO_GRAVACAO_MS);
        }
        return proximo;
      });
    },
    [setEstadoLocal, gravarBuckets]
  );

  return [estadoLocal, setEstadoSincronizado];
}
