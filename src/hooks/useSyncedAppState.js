import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURADO } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from './useLocalStorage';
import { sincronizarBoxes, criarBoxesIniciais } from '../utils/boxLogic';
import { hojeISO } from '../utils/dateHelpers';
import { criarMotorSincronizacao } from '../sync/motorSincronizacao';

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
    // Observações das lojas (ver AppContext.jsx, DEFINIR_OBSERVACAO_LOJA) —
    // mapa { código da loja: texto }, não um array; mesmo cuidado de
    // normalização dos campos acima, pro caso de chegar aqui uma linha
    // compartilhada salva antes desse campo existir.
    observacoesLoja:
      dados.observacoesLoja && typeof dados.observacoesLoja === 'object' && !Array.isArray(dados.observacoesLoja)
        ? dados.observacoesLoja
        : {},
    // Ordem customizada das lojas (Modo sequência, ver DailyProcessReport.jsx)
    // — mesmo cuidado: estado compartilhado salvo antes desse campo existir
    // não tem essa chave.
    sequenciaLojas: Array.isArray(dados.sequenciaLojas) ? dados.sequenciaLojas : [],
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
//
// `status: 'local'` (terceiro item do retorno) sinaliza pra quem consome
// (ver ConnectionStatus.jsx) que não existe sincronização remota aqui —
// só localStorage, que "sempre dá certo" (não depende de rede), então não
// há nada além de online/offline do navegador pra mostrar.
function useEstadoSomenteLocal(estadoLocal, setEstadoLocal) {
  return [estadoLocal, setEstadoLocal, { status: 'local' }];
}

function useEstadoSincronizado(estadoLocal, setEstadoLocal) {
  const { usuario } = useAuth();
  const idUsuario = usuario?.id ?? null;
  const idUsuarioRef = useRef(idUsuario);

  // Status visível no indicador de sincronização (ver ConnectionStatus.jsx):
  //   status: 'sincronizado' | 'salvando' | 'erro'
  //   mensagem: texto do erro mais recente (só relevante quando status é 'erro')
  //   tentativas: quantas vezes seguidas a gravação falhou até agora
  const [statusSincronizacao, setStatusSincronizacao] = useState({
    status: 'sincronizado',
    mensagem: null,
    tentativas: 0,
  });
  // Erro exato da última gravação por patches que falhou (ver AvisoPatches
  // em ConnectionStatus.jsx) — null quando a gravação por patches está ok.
  const [avisoPatches, setAvisoPatches] = useState(null);

  useEffect(() => {
    idUsuarioRef.current = idUsuario;
  }, [idUsuario]);

  // Toda a lógica de sincronização (gravar só o que mudou, mesclar o que
  // chega dos outros, nunca gravar antes de carregar, uma gravação por vez)
  // mora em src/sync/motorSincronizacao.js — JS puro, testado com vários
  // usuários simulados contra o Postgres real (test-sincronizacao-
  // multiusuario). Este hook só liga o motor à tela e ao Supabase.
  const motorRef = useRef(null);
  // Sincronização leve (ver motorSincronizacao.js, tópicos 6 e 7): usada
  // quando o banco já tem a tabela app_state_log e as funções "_leve"
  // (supabase/migracao-sincronizacao-leve.sql). Decidido ao iniciar a
  // sessão; sem a migração, o app segue no modo antigo (documento inteiro).
  const modoLeveRef = useRef(Promise.resolve(false));
  if (motorRef.current === null) {
    motorRef.current = criarMotorSincronizacao({
      estadoInicial: estadoLocal,
      normalizar: normalizarEstadoRecebido,
      atrasoGravacaoMs: ATRASO_GRAVACAO_MS,
      aoMudarEstado: setEstadoLocal,
      aoMudarStatus: setStatusSincronizacao,
      aoAvisoPatches: setAvisoPatches,
      transporte: {
        aplicarPatches: (patches) =>
          modoLeveRef.current.then((leve) =>
            supabase.rpc(leve ? 'app_state_aplicar_patches_leve' : 'app_state_aplicar_patches', {
              p_patches: patches,
              p_usuario: idUsuarioRef.current,
            })
          ),
        gravarCompleto: (dados) =>
          supabase.rpc('app_state_gravar_completo', { p_dados: dados, p_usuario: idUsuarioRef.current }),
        lerEstado: () =>
          supabase.from('app_state').select('dados, versao').eq('id', ID_ESTADO_COMPARTILHADO).maybeSingle(),
        // Só o número da versão (alguns bytes) e as linhas novas do diário
        // (alguns kB): é como o aparelho se atualiza sem baixar o documento.
        lerVersao: () =>
          modoLeveRef.current.then(async (leve) => {
            if (!leve) return { data: null, error: { message: 'modo antigo' } };
            const { data, error } = await supabase
              .from('app_state')
              .select('versao')
              .eq('id', ID_ESTADO_COMPARTILHADO)
              .maybeSingle();
            return { data: data ? Number(data.versao) : null, error };
          }),
        lerLogDesde: (versao) =>
          supabase
            .from('app_state_log')
            .select('versao, patches, completo')
            .gt('versao', versao)
            .order('versao', { ascending: true })
            .limit(300),
      },
    });
  }
  const motor = motorRef.current;

  // Só busca/escuta o estado compartilhado depois de haver login — antes
  // disso (tela de login) não há sessão autenticada e as regras de acesso
  // do Supabase (RLS) bloqueiam a leitura mesmo.
  useEffect(() => {
    if (!idUsuario) return undefined;
    let ativo = true;
    let inscrito = false;
    motor.reiniciar();

    // Descobre se o banco já tem o diário (migração rodada). Falha = modo
    // antigo (documento inteiro), como antes.
    const modoLeve = Promise.resolve(supabase.from('app_state_log').select('versao').limit(1))
      .then(({ error }) => !error)
      .catch(() => false);
    modoLeveRef.current = modoLeve;

    const carregar = () =>
      supabase
        .from('app_state')
        .select('dados, versao')
        .eq('id', ID_ESTADO_COMPARTILHADO)
        .maybeSingle();

    carregar().then(({ data, error }) => {
      if (!ativo) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Não foi possível carregar o estado compartilhado do Supabase:', error.message);
        setStatusSincronizacao({
          status: 'erro',
          mensagem: 'Não foi possível carregar os dados mais recentes. Recarregue a página.',
          tentativas: 1,
        });
        return;
      }
      // data null = primeira vez que o sistema roda com Supabase: o motor
      // publica o estado atual como ponto de partida compartilhado.
      motor.carregarInicial(data ? { versao: data.versao, dados: data.dados } : null);
      // Mudanças ocorridas entre a leitura e a inscrição no Realtime.
      if (inscrito) reler();
    });

    // Reler o servidor quando o canal em tempo real (re)conecta, o app
    // volta ao primeiro plano ou a internet volta: eventos perdidos nesse
    // meio tempo (celular dormindo, sinal fraco) deixariam a tela
    // desatualizada até a próxima mudança de alguém.
    //
    // No modo leve isso custa alguns bytes (confere só o número da versão e
    // busca só o que mudou); no modo antigo relê o documento inteiro.
    function reler() {
      if (!motor.carregado()) return;
      modoLeve.then((leve) => {
        if (!ativo) return;
        if (leve) {
          motor.atualizarDoServidor();
          return;
        }
        carregar().then(({ data }) => {
          if (ativo && data) motor.receberRemoto({ versao: data.versao, dados: data.dados });
        });
      });
    }
    const aoVoltarAoPrimeiroPlano = () => {
      if (document.visibilityState === 'visible') reler();
    };
    document.addEventListener('visibilitychange', aoVoltarAoPrimeiroPlano);
    window.addEventListener('online', reler);

    // Escuta o diário (modo leve: só os patches de cada gravação) ou, no modo
    // antigo, a linha inteira do documento.
    const canal = supabase.channel('app_state_sync');
    modoLeve.then((leve) => {
      if (!ativo) return;
      if (leve) {
        canal.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'app_state_log' },
          (payload) => {
            const novo = payload.new;
            if (!novo) return;
            // O motor aplica só a versão seguinte à que já tem (ou se
            // atualiza sozinho se faltar alguma) — nunca depende do relógio
            // do aparelho.
            motor.receberLog({ versao: novo.versao, patches: novo.patches, completo: novo.completo });
          }
        );
      } else {
        canal.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${ID_ESTADO_COMPARTILHADO}` },
          (payload) => {
            const novo = payload.new;
            if (!novo || !novo.dados) return;
            // O motor ignora o que já conhece (por `versao`, contador que só
            // o servidor incrementa — nunca o relógio do aparelho) e mescla
            // o resto com o que a tela ainda não confirmou.
            motor.receberRemoto({ versao: novo.versao, dados: novo.dados });
          }
        );
      }
      canal.subscribe((statusCanal) => {
        if (statusCanal === 'SUBSCRIBED') {
          inscrito = true;
          reler();
        }
      });
    });

    // Rede de segurança: com o app aberto, confere de tempos em tempos se o
    // servidor tem versão mais nova (alguns bytes) — cobre um Realtime que
    // caiu sem avisar.
    const conferencia = setInterval(() => {
      if (document.visibilityState === 'visible') reler();
    }, 120000);

    return () => {
      ativo = false;
      clearInterval(conferencia);
      document.removeEventListener('visibilitychange', aoVoltarAoPrimeiroPlano);
      window.removeEventListener('online', reler);
      supabase.removeChannel(canal);
      motor.reiniciar();
    };
  }, [idUsuario, motor]);

  // setEstado "público": aplica local na hora (tela sempre responde
  // instantaneamente) e agenda a gravação remota em segundo plano.
  const setEstadoSincronizado = useCallback((atualizacao) => motor.aplicarLocal(atualizacao), [motor]);

  const tentarNovamente = useCallback(() => motor.tentarNovamente(), [motor]);

  return [estadoLocal, setEstadoSincronizado, { ...statusSincronizacao, avisoPatches, tentarNovamente }];
}
