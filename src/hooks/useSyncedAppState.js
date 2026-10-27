import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURADO } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from './useLocalStorage';
import { sincronizarBoxes, criarBoxesIniciais } from '../utils/boxLogic';
import { hojeISO } from '../utils/dateHelpers';
import { mesclarEstadoSincronizado } from '../utils/mesclarEstadoSincronizado';
import { calcularPatchesEstado } from '../utils/calcularPatchesEstado';

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

  const estadoRef = useRef(estadoLocal);
  // Pedido do usuário ("ainda tá sobrepondo, e o aviso de erro nem
  // apareceu"): com o erro da função de patches confirmado ausente (a RPC
  // está dando certo), a suspeita mais forte deixou de ser "a gravação por
  // patches falha" e passou a ser "o filtro de eco do Realtime decide
  // errado quando uma atualização é nossa própria ou de outra pessoa" —
  // porque esse filtro comparava TIMESTAMPS gerados pelo RELÓGIO DE CADA
  // CELULAR/COMPUTADOR (`new Date().toISOString()`), não um valor do
  // servidor. Com 15 motoristas em aparelhos diferentes, é extremamente
  // comum o relógio de um estar alguns segundos (ou minutos) adiantado ou
  // atrasado em relação ao de outro — e, quando isso acontece, o filtro
  // (`novo.atualizado_em <= ultimoTimestampAplicadoRef.current`) pode
  // descartar silenciosamente a atualização genuína de OUTRA pessoa (achar
  // que já é "antiga" por comparação de relógio, não por ordem real dos
  // eventos) — o app desse usuário nunca aplica aquela mudança, e a
  // PRÓXIMA gravação dele manda de volta sua cópia local desatualizada
  // daquele mesmo registro, sobrescrevendo a mudança que nunca chegou a
  // ser vista. Isso bate exatamente com os dois sintomas relatados: "não
  // atualizou pra todos os usuários" (a atualização foi descartada nalgum
  // cliente) e "continua sobrepondo" (esse cliente depois grava por cima
  // com dados velhos) — sem nenhum erro aparecer em lugar nenhum, porque do
  // ponto de vista do banco nada deu errado: as duas gravações foram
  // válidas, só que a segunda não sabia da primeira.
  //
  // A correção: usar `versao` (ver supabase/migracao-versao-monotonica.sql)
  // — um contador inteiro que SÓ o servidor incrementa, sempre em +1, a
  // cada gravação (gravação por patches OU documento inteiro) — em vez do
  // timestamp do cliente, pra decidir o que é eco da própria gravação e o
  // que é uma atualização nova de verdade. Um contador do servidor nunca
  // depende de relógio de aparelho nenhum, então essa classe de bug some
  // por completo, não só fica mais rara.
  const ultimaVersaoAplicadaRef = useRef(null);
  const timeoutGravacaoRef = useRef(null);
  const idUsuarioRef = useRef(idUsuario);
  // Último estado que sabemos que já está refletido no servidor (carga
  // inicial, algo recebido via Realtime, ou gravação nossa que deu certo).
  // Além de ser a "base" da mesclagem de 3 pontas acima, é também a base
  // usada por calcularPatchesEstado (ver gravarNoSupabase) pra saber
  // exatamente O QUE mudou localmente desde então — é esse diff, não o
  // documento inteiro, que vai pro servidor a cada gravação (ver pedido do
  // usuário sobre colisão com várias pessoas usando ao mesmo tempo).
  const baseServidorRef = useRef(null);

  // Pedido do usuário: antes, se a gravação no Supabase falhasse (ex.: sinal
  // fraco no celular do operador), a única coisa que acontecia era um aviso
  // no console do navegador — a tela continuava mostrando "Online" (que só
  // reflete a internet do aparelho, não se o salvamento realmente chegou no
  // banco) e a ação feita podia nunca ser persistida, sem ninguém perceber.
  // Esse estado torna isso visível (ver ConnectionStatus.jsx) e, junto com
  // `agendarNovaTentativa` abaixo, garante que a gravação continua sendo
  // tentada automaticamente até dar certo, em vez de desistir silenciosamente
  // na primeira falha.
  //   status: 'sincronizado' | 'salvando' | 'erro'
  //   mensagem: texto do erro mais recente (só relevante quando status é 'erro')
  //   tentativas: quantas vezes seguidas a gravação falhou até agora
  const [statusSincronizacao, setStatusSincronizacao] = useState({
    status: 'sincronizado',
    mensagem: null,
    tentativas: 0,
  });
  const tentativasFalhasRef = useRef(0);
  const retryTimeoutRef = useRef(null);

  // Pedido do usuário ("ainda tá sobrepondo atualização de outros
  // usuários"): a gravação por patches (ver app_state_aplicar_patches em
  // supabase/schema.sql) está falhando na prática, e cada falha cai pro
  // caminho antigo (gravarDocumentoInteiro) — que FUNCIONA (a ação não se
  // perde), mas é exatamente esse caminho antigo que sobrescreve o
  // documento inteiro e causa a sobreposição entre usuários que o usuário
  // está vendo. Até agora, o erro exato de por que a função nova falha só
  // ia pro console do navegador (que o usuário não consegue/não quer
  // abrir) — isso tornava o diagnóstico impossível sem pedir prints do
  // painel do Supabase, um processo lento e sujeito a erro (já aconteceu
  // de vir print do projeto errado). Agora o erro fica guardado aqui e
  // exposto no próprio indicador de sincronização (ver ConnectionStatus.jsx)
  // — com um botão de copiar —, pra o usuário conseguir mandar o texto
  // exato direto na conversa, sem precisar do painel do Supabase.
  const [avisoPatches, setAvisoPatches] = useState(null);

  useEffect(
    () => () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    estadoRef.current = estadoLocal;
  }, [estadoLocal]);

  useEffect(() => {
    idUsuarioRef.current = idUsuario;
  }, [idUsuario]);

  // Pedido do usuário ("com 3 usuários já tá dando problema, imagina com 15
  // motoristas"): a versão anterior desta função (gravação condicional por
  // timestamp + mesclagem só quando colidia) reduzia a chance de uma ação
  // apagar a outra, mas toda gravação ainda mandava o documento JSON
  // INTEIRO — com várias pessoas gravando ações diferentes quase ao mesmo
  // tempo, cada gravação tinha chance de colidir com a de outra, e cada
  // colisão custava uma viagem extra ao banco. Quanto mais gente, mais
  // colisões, mais lentidão — o problema piorava com a escala, não só a
  // frequência de erros.
  //
  // Agora a gravação manda só os PEDAÇOS que mudaram desde a última vez que
  // sincronizamos (calcularPatchesEstado, usando baseServidorRef como
  // ponto de partida), numa chamada pra app_state_aplicar_patches (ver
  // supabase/schema.sql) — uma função SQL que aplica a lista inteira numa
  // única transação, travando a linha só pelo tempo de aplicar os patches
  // (bem rápido). Isso elimina a colisão pro caso comum (duas pessoas
  // mexendo em registros DIFERENTES — cada motorista cuida da própria
  // carga): o servidor nunca mais vê um "documento inteiro" que possa
  // sobrescrever o pedaço que outra pessoa acabou de mudar, porque a
  // gravação NUNCA manda o resto do documento, só o que de fato mudou aqui.
  // Não há mais "conflito" nem "tentar de novo" — a função sempre aplica
  // com sucesso (a trava de linha só faz concorrências esperarem a vez,
  // nunca falharem).
  const gravarNoSupabase = useCallback(
    (dados) => {
      const dadosNormalizados = normalizarEstadoRecebido(dados);
      setStatusSincronizacao((s) => ({ status: 'salvando', mensagem: null, tentativas: s.tentativas }));

      const agendarNovaTentativaPorFalha = (mensagemErro) => {
        tentativasFalhasRef.current += 1;
        const tentativaAtual = tentativasFalhasRef.current;
        setStatusSincronizacao({ status: 'erro', mensagem: mensagemErro, tentativas: tentativaAtual });

        // Tenta de novo automaticamente — sem isso, uma ação feita bem
        // nesse momento (ex.: finalizar um carregamento) ficaria só na
        // tela de quem fez, nunca chegando no servidor nem aparecendo pra
        // mais ninguém, até a pessoa mexer em algo de novo (o que agenda
        // uma nova gravação) ou recarregar a página (perdendo a ação).
        // Espera crescente a cada falha seguida (5s, 10s, 20s, 40s, até um
        // teto de 60s) pra não bater no Supabase sem parar se a conexão
        // continuar ruim por um tempo.
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        const espera = Math.min(5000 * 2 ** Math.min(tentativaAtual - 1, 4), 60000);
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          // Retenta com o estado MAIS RECENTE (estadoRef.current), não o
          // que falhou — se a pessoa continuou trabalhando enquanto a
          // gravação falhava, é a versão atual que precisa ser salva.
          gravarNoSupabase(estadoRef.current);
        }, espera);
      };

      const sucesso = (basePosGravacao, versaoPosGravacao) => {
        tentativasFalhasRef.current = 0;
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        baseServidorRef.current = basePosGravacao;
        // Só avança a versão conhecida pra frente — nunca deixa um
        // resultado fora de ordem (ex.: resposta atrasada de uma gravação
        // antiga) voltar o contador pra trás.
        if (typeof versaoPosGravacao === 'number') {
          ultimaVersaoAplicadaRef.current = Math.max(ultimaVersaoAplicadaRef.current ?? 0, versaoPosGravacao);
        }
        setStatusSincronizacao({ status: 'sincronizado', mensagem: null, tentativas: 0 });
      };

      // Extrai { versao, dados } da resposta de uma chamada RPC (tanto
      // app_state_aplicar_patches quanto app_state_gravar_completo abaixo
      // devolvem esse mesmo formato — ver supabase/schema.sql) — o
      // Supabase-js devolve um array de linhas pra função que usa RETURNS
      // TABLE, normalmente com 1 item só.
      const extrairResultadoRpc = (data) => (Array.isArray(data) ? data[0] : data) || {};

      // Grava o documento INTEIRO de uma vez (mecanismo mais simples, usado
      // antes da gravação por patches) — usado tanto na primeira gravação
      // desta sessão (ainda sem base pra calcular um diff) quanto como
      // CONTINGÊNCIA se a gravação por patches falhar (ver comentário na
      // chamada a app_state_aplicar_patches abaixo): a prioridade nº 1 é
      // nunca perder a ação de ninguém — se por qualquer motivo a função
      // nova não puder ser chamada (ex.: ainda não propagada na API do
      // Supabase, uma mudança de permissão, etc.), cai de volta pra este
      // caminho mais simples, que já era usado em produção antes de hoje e
      // continua funcionando mesmo sem a função SQL nova.
      //
      // Pedido do usuário (ver comentário de ultimaVersaoAplicadaRef acima):
      // isso usava um `.upsert()` direto antes — trocado por uma função SQL
      // (app_state_gravar_completo, ver supabase/schema.sql) só pra poder
      // incrementar `versao` atomicamente no servidor, igual à gravação por
      // patches; sem isso, esse caminho continuaria dependendo do relógio
      // do aparelho pra decidir o que é eco.
      const gravarDocumentoInteiro = () => {
        supabase
          .rpc('app_state_gravar_completo', {
            p_dados: dadosNormalizados,
            p_usuario: idUsuarioRef.current,
          })
          .then(({ data, error }) => {
            if (error) {
              // eslint-disable-next-line no-console
              console.warn('Não foi possível sincronizar o estado com o Supabase:', error.message);
              agendarNovaTentativaPorFalha(error.message);
              return;
            }
            const resultado = extrairResultadoRpc(data);
            sucesso(dadosNormalizados, resultado.versao);
          });
      };

      const patches = calcularPatchesEstado(baseServidorRef.current, dadosNormalizados);

      if (patches === null) {
        // Ainda não sabemos nenhum estado anterior da linha (primeira
        // gravação desta sessão, ou linha recém-criada) — não há base pra
        // calcular um diff.
        gravarDocumentoInteiro();
        return;
      }

      if (patches.length === 0) {
        // Nada mudou de fato desde a última gravação (ex.: um
        // reagendamento que não altera nada) — não há o que mandar pro
        // servidor.
        sucesso(dadosNormalizados);
        return;
      }

      supabase
        .rpc('app_state_aplicar_patches', {
          p_patches: patches,
          p_usuario: idUsuarioRef.current,
        })
        .then(({ data, error }) => {
          if (error) {
            // A gravação por patches falhou — em vez de só tentar de novo a
            // MESMA chamada (que repetiria o mesmo erro se for algo
            // persistente, deixando a ação de alguém sem chegar no servidor
            // mesmo depois de recarregar a página — exatamente o problema
            // original que essa sincronização existe pra evitar), cai pro
            // caminho mais simples (documento inteiro) NA HORA. Garante que
            // a ação do usuário chega no servidor de um jeito ou de outro;
            // só perde, temporariamente, o reforço contra colisão desta
            // gravação específica.
            // eslint-disable-next-line no-console
            console.warn(
              'Gravação por patches falhou, usando gravação do documento inteiro como contingência:',
              error.message,
              error
            );
            // Guarda o erro EXATO (mensagem, código, detalhes, hint — os
            // mesmos campos que apareceriam no painel do Supabase) pra
            // mostrar no indicador de sincronização, já que é isso que
            // falta pra descobrir por que app_state_aplicar_patches não
            // está funcionando em produção.
            setAvisoPatches({
              mensagem: error.message || 'erro desconhecido',
              codigo: error.code || null,
              detalhes: error.details || null,
              hint: error.hint || null,
              em: new Date().toLocaleString('pt-BR'),
            });
            gravarDocumentoInteiro();
            return;
          }
          // RPC deu certo — se havia um aviso de falha anterior, ele não
          // se aplica mais (a gravação por patches voltou a funcionar).
          setAvisoPatches(null);
          // A função devolve o documento já aplicado no servidor (e a nova
          // `versao`) — usa ele como nova base (em vez de dadosNormalizados)
          // porque reflete com exatidão o que está lá agora, incluindo
          // qualquer patch de OUTRA pessoa que a trava de linha tenha
          // serializado bem antes do nosso (ver comentário da função
          // acima). Se por algum motivo a resposta não vier no formato
          // esperado, cai pra dadosNormalizados mesmo assim — não é
          // crítico (o Realtime traz a versão certa em seguida).
          const resultado = extrairResultadoRpc(data);
          sucesso(
            resultado.dados ? normalizarEstadoRecebido(resultado.dados) : dadosNormalizados,
            resultado.versao
          );
        });
    },
    []
  );

  // Botão "Tentar agora" (ver ConnectionStatus.jsx) — pula a espera da
  // próxima tentativa automática e grava já, com o estado atual.
  const tentarSincronizarNovamente = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    gravarNoSupabase(estadoRef.current);
  }, [gravarNoSupabase]);

  // Só busca/escuta o estado compartilhado depois de haver login — antes
  // disso (tela de login) não há sessão autenticada e as regras de acesso
  // do Supabase (RLS) bloqueiam a leitura mesmo.
  useEffect(() => {
    if (!idUsuario) return undefined;
    let ativo = true;

    supabase
      .from('app_state')
      .select('dados, versao')
      .eq('id', ID_ESTADO_COMPARTILHADO)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('Não foi possível carregar o estado compartilhado do Supabase:', error.message);
          // Igual à gravação: deixa visível (ver ConnectionStatus.jsx) em
          // vez de só no console — aqui sem repetir sozinho (é a carga
          // inicial, única por sessão), mas o indicador explica o que
          // houve e sugere recarregar a página.
          setStatusSincronizacao({
            status: 'erro',
            mensagem: 'Não foi possível carregar os dados mais recentes. Recarregue a página.',
            tentativas: 1,
          });
          return;
        }
        if (data) {
          ultimaVersaoAplicadaRef.current = data.versao ?? 0;
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
          // Ignora o eco da própria gravação e eventos atrasados/fora de
          // ordem — usando `versao` (contador inteiro só o servidor
          // incrementa, +1 a cada gravação) em vez do timestamp do
          // aparelho (ver comentário de ultimaVersaoAplicadaRef acima):
          // um número de versão nunca é ambíguo entre aparelhos com
          // relógios diferentes, ao contrário de um timestamp gerado no
          // cliente.
          if (
            typeof novo.versao === 'number' &&
            ultimaVersaoAplicadaRef.current != null &&
            novo.versao <= ultimaVersaoAplicadaRef.current
          ) {
            return;
          }
          if (typeof novo.versao === 'number') {
            ultimaVersaoAplicadaRef.current = novo.versao;
          }
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

  return [
    estadoLocal,
    setEstadoSincronizado,
    { ...statusSincronizacao, avisoPatches, tentarNovamente: tentarSincronizarNovamente },
  ];
}
