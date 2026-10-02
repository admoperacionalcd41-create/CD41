import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURADO } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from './useLocalStorage';
import { sincronizarBoxes, criarBoxesIniciais } from '../utils/boxLogic';
import { hojeISO } from '../utils/dateHelpers';
import { mesclarEstadoSincronizado } from '../utils/mesclarEstadoSincronizado';

// Id fixo da única linha compartilhada da tabela `app_state` — o estado
// inteiro do sistema (lojas, boxes, motoristas, carregamentos etc.) vive
// num único registro JSON ali, replicado em tempo real pra todo mundo
// logado via Supabase Realtime (ver supabase/schema.sql).
const ID_ESTADO_COMPARTILHADO = 'estado-v1';

// Tempo de espera, depois da última mudança local, antes de gravar no
// Supabase — evita uma gravação por clique quando várias ações acontecem
// em sequência rápida (ex.: apontar várias lojas seguidas). A tela sempre
// atualiza na hora (gravação é só em segundo plano).
//
// Reduzido de 600ms pra 200ms (mitigação do problema relatado pelo usuário
// — ver mesclarEstadoSincronizado.js): quanto menor essa janela, menor a
// chance de a atualização de OUTRO usuário chegar via Realtime bem no meio
// dela, que é a situação que a mesclagem abaixo existe pra tratar quando
// acontece mesmo assim.
const ATRASO_GRAVACAO_MS = 200;

// Garante que qualquer estado vindo de fora (do Supabase — outra pessoa
// pode estar numa versão ligeiramente diferente do app, ou a linha
// compartilhada pode ter sido criada antes de algum campo existir) tenha
// todos os campos que o app espera, com o mesmo valor "vazio" que o
// reducer usa (ver SINCRONIZAR_BOXES/SINCRONIZAR_CADASTROS em
// AppContext.jsx). Sem isso, um campo ausente (ex.: contatosNotificacao)
// quebra a tela com "Cannot read properties of undefined".
function normalizarEstadoRecebido(dados) {
  if (!dados || typeof dados !== 'object') return dados;
  const placasBrutas = Array.isArray(dados.placasCadastradas) ? dados.placasCadastradas : [];
  return {
    ...dados,
    lojas: Array.isArray(dados.lojas) ? dados.lojas : [],
    protocolos: Array.isArray(dados.protocolos) ? dados.protocolos : [],
    boxes: sincronizarBoxes(Array.isArray(dados.boxes) ? dados.boxes : criarBoxesIniciais()),
    diaAtual: dados.diaAtual || hojeISO(),
    colaboradoresCadastrados: Array.isArray(dados.colaboradoresCadastrados) ? dados.colaboradoresCadastrados : [],
    motoristasCadastrados: Array.isArray(dados.motoristasCadastrados) ? dados.motoristasCadastrados : [],
    placasCadastradas: placasBrutas.map((p) => (typeof p === 'string' ? { placa: p, possuiPlataforma: false } : p)),
    contatosNotificacao: Array.isArray(dados.contatosNotificacao) ? dados.contatosNotificacao : [],
    localizacaoLojas: Array.isArray(dados.localizacaoLojas) ? dados.localizacaoLojas : [],
    // Valor pago por palete agrupado (ver ValoresConfigCard.jsx) — mesmo
    // padrão de 0,58 usado em SINCRONIZAR_CADASTROS/mockData.js, pro caso de
    // chegar aqui um estado compartilhado salvo antes desse campo existir.
    valorPaletesAgrupamento: typeof dados.valorPaletesAgrupamento === 'number' ? dados.valorPaletesAgrupamento : 0.58,
  };
}

/**
 * Substituto de useLocalStorage que, com o Supabase configurado (site
 * publicado), mantém o estado inteiro do app sincronizado em tempo real
 * entre todos os usuários logados: guarda tudo numa única linha da tabela
 * `app_state` e escuta mudanças via Supabase Realtime — qualquer ação de
 * um usuário aparece na tela dos outros em segundos, sem precisar
 * recarregar a página. Sem Supabase configurado (preview local/demo),
 * funciona exatamente como antes: só localStorage, sem rede.
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
  const ultimoTimestampAplicadoRef = useRef(null);
  const timeoutGravacaoRef = useRef(null);
  const idUsuarioRef = useRef(idUsuario);
  // Último estado que sabemos que o SERVIDOR tinha — atualizado sempre que
  // aplicamos algo vindo do Supabase (carga inicial, Realtime) ou depois de
  // uma gravação nossa dar certo. É a "base" usada por
  // mesclarEstadoSincronizado pra saber o que mudou de cada lado desde a
  // última vez que os dois bateram (ver comentário ali e no
  // ATRASO_GRAVACAO_MS acima).
  const baseServidorRef = useRef(null);

  useEffect(() => {
    estadoRef.current = estadoLocal;
  }, [estadoLocal]);

  useEffect(() => {
    idUsuarioRef.current = idUsuario;
  }, [idUsuario]);

  const gravarNoSupabase = useCallback((dados) => {
    const agora = new Date().toISOString();
    ultimoTimestampAplicadoRef.current = agora;
    const dadosNormalizados = normalizarEstadoRecebido(dados);
    supabase
      .from('app_state')
      .upsert(
        {
          id: ID_ESTADO_COMPARTILHADO,
          dados: dadosNormalizados,
          atualizado_em: agora,
          atualizado_por: idUsuarioRef.current,
        },
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('Não foi possível sincronizar o estado com o Supabase:', error.message);
          return;
        }
        // Gravação confirmada: isso é, a partir de agora, o que o servidor
        // tem — vira a nova base pra próxima mesclagem (ver
        // mesclarEstadoSincronizado.js).
        baseServidorRef.current = dadosNormalizados;
      });
  }, []);

  // Só busca/escuta o estado compartilhado depois de haver login — antes
  // disso (tela de login) não há sessão autenticada e as regras de acesso
  // do Supabase (RLS) bloqueiam a leitura mesmo.
  useEffect(() => {
    if (!idUsuario) return undefined;
    let ativo = true;

    supabase
      .from('app_state')
      .select('dados, atualizado_em')
      .eq('id', ID_ESTADO_COMPARTILHADO)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('Não foi possível carregar o estado compartilhado do Supabase:', error.message);
          return;
        }
        if (data) {
          ultimoTimestampAplicadoRef.current = data.atualizado_em;
          const dadosNormalizados = normalizarEstadoRecebido(data.dados);
          baseServidorRef.current = dadosNormalizados;
          setEstadoLocal(dadosNormalizados);
        } else {
          // Primeira vez que o sistema roda com Supabase: publica o estado
          // atual (o que já estava salvo localmente) como ponto de partida
          // compartilhado, pra quem entrar depois já ver o mesmo.
          gravarNoSupabase(estadoRef.current);
        }
      });

    const canal = supabase
      .channel('app_state_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${ID_ESTADO_COMPARTILHADO}` },
        (payload) => {
          const novo = payload.new;
          if (!novo || !novo.dados) return;
          // Ignora o eco da própria gravação (mesmo timestamp que acabamos
          // de enviar) e eventos atrasados/fora de ordem.
          if (
            ultimoTimestampAplicadoRef.current &&
            novo.atualizado_em <= ultimoTimestampAplicadoRef.current
          ) {
            return;
          }
          ultimoTimestampAplicadoRef.current = novo.atualizado_em;
          const dadosRemotos = normalizarEstadoRecebido(novo.dados);

          // Se há uma gravação local pendente (usuário acabou de fazer algo
          // aqui e ainda não terminou de salvar — ver ATRASO_GRAVACAO_MS),
          // NÃO substitui o estado local direto pelo que chegou: isso jogaria
          // fora a ação local antes mesmo dela ser salva (era exatamente o
          // problema relatado). Em vez disso, mescla os dois lados usando a
          // última base conhecida do servidor (ver mesclarEstadoSincronizado.js)
          // e deixa a gravação pendente seguir seu curso — ela vai salvar o
          // resultado já mesclado, com a ação local preservada.
          const dadosParaAplicar = timeoutGravacaoRef.current
            ? mesclarEstadoSincronizado(baseServidorRef.current, estadoRef.current, dadosRemotos)
            : dadosRemotos;

          baseServidorRef.current = dadosRemotos;
          setEstadoLocal(dadosParaAplicar);
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [idUsuario, setEstadoLocal, gravarNoSupabase]);

  // setEstado "público": aplica local na hora (tela sempre responde
  // instantaneamente) e agenda a gravação remota em segundo plano.
  const setEstadoSincronizado = useCallback(
    (atualizacao) => {
      setEstadoLocal((prev) => {
        const proximo = typeof atualizacao === 'function' ? atualizacao(prev) : atualizacao;
        // Só agenda gravação remota se houver sessão — sem isso as regras
        // de acesso do Supabase (RLS) rejeitariam a escrita mesmo.
        if (idUsuarioRef.current) {
          if (timeoutGravacaoRef.current) clearTimeout(timeoutGravacaoRef.current);
          timeoutGravacaoRef.current = setTimeout(() => {
            // Zera ANTES de gravar — é o sinal (ver handler do Realtime
            // acima) de que não há mais edição local pendente a partir
            // daqui, então uma atualização remota que chegue depois disso
            // pode ser aplicada direto, sem precisar mesclar.
            timeoutGravacaoRef.current = null;
            gravarNoSupabase(estadoRef.current);
          }, ATRASO_GRAVACAO_MS);
        }
        return proximo;
      });
    },
    [setEstadoLocal, gravarNoSupabase]
  );

  return [estadoLocal, setEstadoSincronizado];
}
