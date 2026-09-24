import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSyncedAppState } from '../hooks/useSyncedAppState';
import { gerarDadosIniciais } from '../data/mockData';
import { gerarId } from '../utils/idGenerator';
import { hojeISO, somarDias } from '../utils/dateHelpers';
import { normalizarTelefoneWhatsapp } from '../utils/whatsapp';
import {
  alocarVagasCrescente,
  alocarVagasDecrescente,
  realocarParaAgrupamento,
  criarBoxesIniciais,
  liberarTodasVagas,
  liberarVagasParciais,
  reocuparVagas,
  vagasIndisponiveisParaReocupar,
  sincronizarBoxes,
  compactarBox,
  getNomeBox,
} from '../utils/boxLogic';

// Descreve um número de palete junto com sua composição (quando os
// agrupadores juntaram lotes diferentes nele — ver ConcludeGroupingModal),
// ex.: "2 (lotes 2 + 5)" — usado no protocolo (ver FINALIZAR_CARREGAMENTO)
// pra registrar exatamente qual combinação ficou de saldo.
function descreverPalete(composicao, numero) {
  const texto = (composicao || [])[numero - 1];
  return texto && texto.trim() ? `${numero} (lotes ${texto.trim()})` : `${numero}`;
}

// Status em que a loja realmente ocupa vagas físicas em um box (portanto,
// pode ser movida de box). "finalizada" fica de fora pois suas vagas já
// foram liberadas na conclusão do carregamento.
export const STATUS_COM_BOX_OCUPADO = [
  'apontada',
  'conferencia_finalizada',
  'em_agrupamento',
  'agrupada',
  'carregando',
];
// Dentro desses, quais já passaram pela realocação decrescente final
// (agrupada/carregando) versus quem ainda está na fase crescente do
// apontamento (apontada/em_agrupamento) — decide a regra de preenchimento
// a usar no box de destino ao mover.
const STATUS_FASE_DECRESCENTE = ['agrupada', 'carregando'];

// Cadastros auxiliares (listas de sugestão usadas em Agrupamento e
// Carregamento): nomes das chaves válidas dentro de `state` para as ações
// genéricas CADASTRAR_ITEM/REMOVER_ITEM.
const CADASTROS_VALIDOS = [
  'colaboradoresCadastrados',
  'motoristasCadastrados',
  'placasCadastradas',
  'contatosNotificacao',
  'localizacaoLojas',
];

const CHAVE_STORAGE = 'doca-manager:estado-v1';

const AppStateContext = createContext(null);

function aplicarAcaoInterna(state, acao) {
  switch (acao.tipo) {
    case 'IMPORTAR_LOJAS': {
      const novasLojas = acao.payload.map((registro) => ({
        ...registro,
        diaReferencia: state.diaAtual,
        tipoCarga: registro.tipoCarga === 'resfriada' ? 'resfriada' : 'seca',
      }));
      return {
        ...state,
        lojas: [...state.lojas, ...novasLojas],
        ultimoErro: null,
        ultimoAviso: `${novasLojas.length} loja(s) importada(s) com sucesso.`,
      };
    }

    // Exclui uma loja importada por engano (ver tela de Importar Dados).
    // Só permite excluir lojas ainda "pendente" — sem box/vaga alocada, sem
    // protocolo — pra nunca deixar vaga ocupada ou protocolo órfão
    // apontando pra uma loja que não existe mais. Uma loja que já entrou no
    // fluxo (apontada em diante) precisa ser cancelada nas telas de
    // Agrupamento/Carregamento primeiro (ver CANCELAR_AGRUPAMENTO acima),
    // o que a devolve para "pendente" e libera as vagas, antes de poder ser
    // excluída aqui.
    case 'EXCLUIR_LOJA': {
      const { lojaId } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja) {
        return { ...state, ultimoErro: 'Loja não encontrada.' };
      }
      if (loja.status !== 'pendente') {
        return {
          ...state,
          ultimoErro: `Loja ${loja.loja} já está em andamento e não pode ser excluída — cancele o apontamento dela primeiro.`,
        };
      }
      return {
        ...state,
        lojas: state.lojas.filter((l) => l.id !== lojaId),
        ultimoErro: null,
        ultimoAviso: `Loja ${loja.loja} (${loja.nomeLoja}) excluída.`,
      };
    }

    // Etapa 1 — Apontamento: aponta manualmente a loja para um box, apenas
    // reservando as vagas físicas em ordem CRESCENTE (estimativa rápida,
    // antes da conferência física). Sinaliza que a loja está "em execução"
    // — o box já está definido, mas o agrupamento em si ainda não começou
    // (nenhum colaborador atribuído ainda).
    case 'APONTAR_BOX': {
      const { lojaId, boxNumero, quantidadePaletes } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      const box = state.boxes.find((b) => b.numero === boxNumero);

      if (!loja || !box) {
        return { ...state, ultimoErro: 'Loja ou box inválido.' };
      }
      if (loja.status !== 'pendente') {
        return { ...state, ultimoErro: 'Esta loja já foi apontada para um box anteriormente.' };
      }

      const resultado = alocarVagasCrescente(box, quantidadePaletes, lojaId);
      if (!resultado.sucesso) {
        return { ...state, ultimoErro: resultado.erro };
      }

      return {
        ...state,
        boxes: state.boxes.map((b) => (b.numero === boxNumero ? resultado.box : b)),
        lojas: state.lojas.map((l) =>
          l.id === lojaId
            ? {
                ...l,
                status: 'apontada',
                boxNumero,
                vagasOcupadas: resultado.vagasAlocadas,
                paletesAgrupados: quantidadePaletes,
                paletesNoAgrupamento: quantidadePaletes,
                // Guarda a quantidade "estimada" do Apontamento (Etapa 1)
                // separada de `paletesAgrupados`, que é reescrita pela
                // Conclusão do Agrupamento (Etapa 4) com a contagem final
                // reconferida — diferente de `paletesApontados`, que nunca
                // muda depois daqui. É essa quantidade estimada (não a
                // final) que numera os paletes na marcação de saldo do
                // Carregamento (ver LoadingProtocolForm.jsx).
                paletesApontados: quantidadePaletes,
                dataApontamento: new Date().toISOString(),
              }
            : l
        ),
        ultimoErro: null,
        ultimoAviso: `Loja ${loja.loja} apontada no ${getNomeBox(boxNumero)} (vagas ${resultado.vagasAlocadas.join(', ')}) — em execução.`,
      };
    }

    // Etapa 2 — Conferência Finalizada: marca que a conferência física da
    // carga apontada no box foi concluída, antes de sinalizar os
    // colaboradores e iniciar o agrupamento propriamente dito. Não altera
    // vagas nem quantidade — é apenas um marco de acompanhamento entre o
    // apontamento e o início efetivo do agrupamento.
    case 'CONCLUIR_CONFERENCIA': {
      const { lojaId } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja || loja.status !== 'apontada') {
        return { ...state, ultimoErro: 'Esta loja precisa estar apontada em um box antes de finalizar a conferência.' };
      }

      return {
        ...state,
        lojas: state.lojas.map((l) =>
          l.id === lojaId
            ? { ...l, status: 'conferencia_finalizada', dataConferencia: new Date().toISOString() }
            : l
        ),
        ultimoErro: null,
        ultimoAviso: `Conferência da loja ${loja.loja} finalizada — pronta para iniciar o agrupamento.`,
      };
    }

    // Etapa 3 — Início do Agrupamento: sinaliza apenas quais colaboradores
    // (até 4) estarão executando o agrupamento físico dos paletes nesse box.
    // As vagas permanecem como estão (crescentes, do apontamento) — a
    // quantidade de paletes só é reconfirmada ao concluir o agrupamento.
    case 'INICIAR_AGRUPAMENTO': {
      const { lojaId, colaboradores } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja || loja.status !== 'conferencia_finalizada') {
        return { ...state, ultimoErro: 'Esta loja precisa ter a conferência finalizada antes de iniciar o agrupamento.' };
      }

      return {
        ...state,
        lojas: state.lojas.map((l) =>
          l.id === lojaId
            ? {
                ...l,
                status: 'em_agrupamento',
                colaboradores: colaboradores.filter(Boolean).slice(0, 4),
                dataInicioAgrupamento: new Date().toISOString(),
              }
            : l
        ),
        ultimoErro: null,
        ultimoAviso: `Agrupamento da loja ${loja.loja} iniciado.`,
      };
    }

    // Etapa 4 — Conclusão do Agrupamento: os colaboradores terminaram de
    // montar a carga no box e informam a quantidade de paletes efetivamente
    // conferida (geralmente menor que a estimativa do apontamento). As
    // vagas crescentes do apontamento são liberadas e realocadas em ordem
    // DECRESCENTE (preenchimento reverso clássico) para essa quantidade
    // final; a loja fica pronta para gerar etiqueta e seguir para o
    // carregamento.
    case 'CONCLUIR_AGRUPAMENTO': {
      const { lojaId, quantidadePaletes, composicaoPaletes } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja || loja.status !== 'em_agrupamento') {
        return { ...state, ultimoErro: 'Esta loja precisa estar em agrupamento para ser concluída.' };
      }

      const box = state.boxes.find((b) => b.numero === loja.boxNumero);
      const quantidade = Number(quantidadePaletes) > 0 ? Number(quantidadePaletes) : loja.paletesAgrupados;
      const resultado = realocarParaAgrupamento(box, lojaId, quantidade);
      if (!resultado.sucesso) {
        return { ...state, ultimoErro: resultado.erro };
      }

      // Composição de cada palete final (ex.: palete 2 = lote "2 + 5" —
      // ver ConcludeGroupingModal) — normalizada pro mesmo tamanho da
      // quantidade confirmada, com '' para paletes sem combinação
      // informada. Usada na etiqueta e, se sobrar saldo no carregamento,
      // pra identificar exatamente qual combinação ficou (ver
      // LoadingProtocolForm e FINALIZAR_CARREGAMENTO).
      const composicaoNormalizada = Array.from(
        { length: quantidade },
        (_, i) => (composicaoPaletes && composicaoPaletes[i]) || ''
      );

      return {
        ...state,
        boxes: state.boxes.map((b) => (b.numero === loja.boxNumero ? resultado.box : b)),
        lojas: state.lojas.map((l) =>
          l.id === lojaId
            ? {
                ...l,
                status: 'agrupada',
                vagasOcupadas: resultado.vagasAlocadas,
                paletesAgrupados: quantidade,
                paletesNoAgrupamento: quantidade,
                composicaoPaletes: composicaoNormalizada,
                dataAgrupamento: new Date().toISOString(),
              }
            : l
        ),
        ultimoErro: null,
        ultimoAviso: `Agrupamento da loja ${loja.loja} concluído — vagas ${resultado.vagasAlocadas.join(', ')} — pronta para carregamento.`,
      };
    }

    // "Cancelar" em qualquer uma das quatro etapas anteriores ao
    // carregamento volta a loja exatamente para a etapa/tela anterior do
    // processo (não zera tudo de volta para "pendente", exceto quando a
    // etapa atual É a primeira — apontada — caso em que não existe etapa
    // anterior além de pendente, e as vagas reservadas são liberadas):
    //   agrupada              -> em_agrupamento (desfaz a conclusão: solta
    //                            as vagas decrescentes e realoca em
    //                            crescente para a quantidade atual, como
    //                            estava durante o agrupamento)
    //   em_agrupamento        -> conferencia_finalizada (limpa colaboradores
    //                            e a data de início; vagas não mudam, pois o
    //                            início do agrupamento não mexe nelas)
    //   conferencia_finalizada-> apontada (só desfaz o marco da conferência;
    //                            vagas do apontamento continuam intactas)
    //   apontada              -> pendente (libera as vagas reservadas)
    case 'CANCELAR_AGRUPAMENTO': {
      const { lojaId } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja || !['apontada', 'conferencia_finalizada', 'em_agrupamento', 'agrupada'].includes(loja.status)) {
        return { ...state, ultimoErro: 'Esta loja não pode ser cancelada no status atual.' };
      }

      if (loja.status === 'apontada') {
        const box = state.boxes.find((b) => b.numero === loja.boxNumero);
        const boxLiberado = liberarTodasVagas(box, lojaId);
        return {
          ...state,
          boxes: state.boxes.map((b) => (b.numero === loja.boxNumero ? boxLiberado : b)),
          lojas: state.lojas.map((l) =>
            l.id === lojaId
              ? {
                  ...l,
                  status: 'pendente',
                  boxNumero: null,
                  vagasOcupadas: [],
                  colaboradores: [],
                  paletesAgrupados: 0,
                  paletesNoAgrupamento: 0,
                  paletesApontados: 0,
                  dataApontamento: null,
                  dataConferencia: null,
                  dataInicioAgrupamento: null,
                  dataAgrupamento: null,
                }
              : l
          ),
          ultimoErro: null,
          ultimoAviso: `Apontamento da loja ${loja.loja} cancelado — vagas liberadas.`,
        };
      }

      if (loja.status === 'conferencia_finalizada') {
        return {
          ...state,
          lojas: state.lojas.map((l) =>
            l.id === lojaId ? { ...l, status: 'apontada', dataConferencia: null } : l
          ),
          ultimoErro: null,
          ultimoAviso: `Loja ${loja.loja} voltou para Em Execução (apontada) — conferência desfeita.`,
        };
      }

      if (loja.status === 'em_agrupamento') {
        return {
          ...state,
          lojas: state.lojas.map((l) =>
            l.id === lojaId
              ? { ...l, status: 'conferencia_finalizada', colaboradores: [], dataInicioAgrupamento: null }
              : l
          ),
          ultimoErro: null,
          ultimoAviso: `Loja ${loja.loja} voltou para Conferência Finalizada — início do agrupamento desfeito.`,
        };
      }

      // agrupada -> em_agrupamento: desfaz a realocação decrescente da
      // conclusão, voltando as vagas para o padrão crescente do apontamento
      // (com a quantidade que estava confirmada), para permitir concluir de
      // novo com uma quantidade diferente se for o caso.
      const box = state.boxes.find((b) => b.numero === loja.boxNumero);
      const boxLiberado = liberarTodasVagas(box, lojaId);
      const resultado = alocarVagasCrescente(boxLiberado, loja.paletesAgrupados, lojaId);
      if (!resultado.sucesso) {
        return { ...state, ultimoErro: resultado.erro };
      }

      return {
        ...state,
        boxes: state.boxes.map((b) => (b.numero === loja.boxNumero ? resultado.box : b)),
        lojas: state.lojas.map((l) =>
          l.id === lojaId
            ? {
                ...l,
                status: 'em_agrupamento',
                vagasOcupadas: resultado.vagasAlocadas,
                paletesNoAgrupamento: loja.paletesAgrupados,
                dataAgrupamento: null,
              }
            : l
        ),
        ultimoErro: null,
        ultimoAviso: `Loja ${loja.loja} voltou para Agrupando — conclusão do agrupamento desfeita.`,
      };
    }

    case 'INICIAR_CARREGAMENTO': {
      const { lojaId } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja || loja.status !== 'agrupada') {
        return { ...state, ultimoErro: 'Esta loja não está pronta para carregamento.' };
      }
      return {
        ...state,
        lojas: state.lojas.map((l) => (l.id === lojaId ? { ...l, status: 'carregando' } : l)),
        ultimoErro: null,
        ultimoAviso: `Carregamento da loja ${loja.loja} iniciado.`,
      };
    }

    // Desfaz o início do carregamento (botão "Cancelar" na lista "Em
    // Carregamento" — ver LoadingList.jsx) — a loja ainda não tem protocolo
    // registrado nessa etapa, então basta voltar o status para "agrupada".
    // Não mexe nas vagas: INICIAR_CARREGAMENTO acima também não mexeu, só
    // trocou o status.
    case 'CANCELAR_INICIO_CARREGAMENTO': {
      const { lojaId } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja || loja.status !== 'carregando') {
        return { ...state, ultimoErro: 'Esta loja não está com o carregamento em andamento.' };
      }
      return {
        ...state,
        lojas: state.lojas.map((l) => (l.id === lojaId ? { ...l, status: 'agrupada' } : l)),
        ultimoErro: null,
        ultimoAviso: `Carregamento da loja ${loja.loja} cancelado — voltou para Agrupada.`,
      };
    }

    case 'FINALIZAR_CARREGAMENTO': {
      const { lojaId, placa, motorista, lacres, statusEnvio, paletesEnviados, lotesRestantes } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);
      if (!loja || loja.boxNumero == null) {
        return { ...state, ultimoErro: 'Loja inválida para finalização de carregamento.' };
      }
      const box = state.boxes.find((b) => b.numero === loja.boxNumero);
      const composicaoAnterior = loja.composicaoPaletes || [];

      const envioCompleto = statusEnvio === 'completo' || paletesEnviados >= loja.paletesAgrupados;

      let novoBox;
      let novaLojaState;
      let vagasLiberadas;
      let vagasRestantesParciais;

      if (envioCompleto) {
        vagasLiberadas = box.vagas.filter((v) => v.ocupada && v.lojaId === lojaId).map((v) => v.numero);
        novoBox = liberarTodasVagas(box, lojaId);
      } else {
        const resultado = liberarVagasParciais(box, lojaId, paletesEnviados);
        novoBox = resultado.box;
        vagasLiberadas = resultado.vagasLiberadas;
        vagasRestantesParciais = resultado.vagasRestantes;
      }

      // `boxNumero` e `vagasLiberadas` ficam gravados no protocolo para
      // permitir desfazer com segurança (ver CANCELAR_PROTOCOLO): ao
      // cancelar, só reocupamos exatamente essas vagas, e só se ninguém mais
      // as tiver usado nesse meio-tempo.
      const protocolo = {
        id: gerarId('proto'),
        lojaId,
        placa,
        motorista,
        lacres,
        statusEnvio: envioCompleto ? 'completo' : 'saldo',
        paletesEnviados,
        // Números dos paletes (impressos nas etiquetas, ver LabelGenerator)
        // que o operador marcou como "ficando" no box — só relevante em
        // envio parcial; usado na mensagem de WhatsApp pra equipe saber
        // exatamente qual palete separar do que já saiu.
        lotesRestantes: envioCompleto ? [] : lotesRestantes || [],
        // Mesma informação, já com a composição de cada palete (ver
        // descreverPalete) — histórico fica correto mesmo depois que a
        // loja renumerar seus paletes restantes abaixo.
        lotesRestantesDescricao: envioCompleto
          ? []
          : (lotesRestantes || []).map((n) => descreverPalete(composicaoAnterior, n)),
        dataHora: new Date().toISOString(),
        boxNumero: loja.boxNumero,
        vagasLiberadas,
      };

      if (envioCompleto) {
        novaLojaState = {
          ...loja,
          status: 'finalizada',
          dataCarregamento: new Date().toISOString(),
          protocolos: [...loja.protocolos, protocolo],
        };
      } else {
        // Os paletes que ficaram (lotesRestantes) são renumerados de 1 em
        // diante pra esse novo ciclo — cada um carrega a composição que já
        // tinha (ex.: o palete "2 (lotes 2 + 5)" que ficou vira o novo
        // palete 1, mas continua sabendo que é composto pelos lotes 2 e 5).
        const composicaoRestante = (lotesRestantes || []).map((n) => composicaoAnterior[n - 1] || '');
        novaLojaState = {
          ...loja,
          status: 'agrupada', // volta para a fila de carregamento com o saldo restante
          paletesAgrupados: loja.paletesAgrupados - paletesEnviados,
          vagasOcupadas: vagasRestantesParciais,
          composicaoPaletes: composicaoRestante,
          protocolos: [...loja.protocolos, protocolo],
        };
      }

      return {
        ...state,
        boxes: state.boxes.map((b) => (b.numero === loja.boxNumero ? novoBox : b)),
        lojas: state.lojas.map((l) => (l.id === lojaId ? novaLojaState : l)),
        protocolos: [...state.protocolos, protocolo],
        ultimoErro: null,
        ultimoAviso: envioCompleto
          ? `Carregamento da loja ${loja.loja} finalizado — box liberado.`
          : `Carregamento parcial registrado para a loja ${loja.loja} — saldo de ${novaLojaState.paletesAgrupados} palete(s) permanece no box.`,
      };
    }

    // Registra um único protocolo (mesma placa/motorista/lacres) cobrindo
    // duas ou mais lojas que saem juntas no mesmo veículo. `quantidades` é
    // um mapa opcional { [lojaId]: paletesEnviados } — quando uma loja não
    // aparece nele (ou o valor é inválido), assume-se envio completo dessa
    // loja. Cada loja é avaliada individualmente: se a quantidade enviada
    // cobre todos os paletes ela é finalizada (box liberado); se for menor,
    // fica com o saldo restante alocado no box, igual ao fluxo de loja
    // única. Um `viagemId` comum é gravado em cada protocolo apenas para
    // permitir agrupar/exibir as lojas da mesma viagem nos relatórios; cada
    // loja continua com seu próprio registro de protocolo, então nada mais
    // no restante do app precisa saber sobre carregamentos em lote.
    case 'FINALIZAR_CARREGAMENTO_MULTIPLO': {
      const { lojaIds, placa, motorista, lacres, quantidades = {}, ordemCarregamento, lotesRestantesPorLoja = {} } = acao.payload;
      const lojasSelecionadas = lojaIds
        .map((id) => state.lojas.find((l) => l.id === id))
        .filter((l) => l && l.boxNumero != null);

      if (lojasSelecionadas.length < 2) {
        return { ...state, ultimoErro: 'Selecione pelo menos duas lojas para carregar no mesmo veículo.' };
      }

      // Ordem em que cada loja entra no baú do caminhão (definida arrastando
      // no desenho do caminhão, na tela de protocolo em lote) — posição 0 =
      // carregada primeiro. Sem uma ordem válida informada (mesmas lojas,
      // mesma quantidade), cai de volta pra ordem de seleção original, sem
      // travar o registro do protocolo por causa disso.
      const ordemValida =
        Array.isArray(ordemCarregamento) &&
        ordemCarregamento.length === lojasSelecionadas.length &&
        lojasSelecionadas.every((l) => ordemCarregamento.includes(l.id))
          ? ordemCarregamento
          : lojasSelecionadas.map((l) => l.id);

      const viagemId = gerarId('viagem');
      const agora = new Date().toISOString();
      let boxesAtualizados = state.boxes;
      const protocolosNovos = [];
      const lojasAtualizadasPorId = {};
      let houveSaldo = false;

      for (const loja of lojasSelecionadas) {
        const quantidadeSolicitada = Number(quantidades[loja.id]);
        const quantidade = Number.isFinite(quantidadeSolicitada) && quantidadeSolicitada > 0
          ? Math.min(quantidadeSolicitada, loja.paletesAgrupados)
          : loja.paletesAgrupados;
        const envioCompleto = quantidade >= loja.paletesAgrupados;
        const box = boxesAtualizados.find((b) => b.numero === loja.boxNumero);
        const composicaoAnteriorLoja = loja.composicaoPaletes || [];
        const restantesLoja = lotesRestantesPorLoja[loja.id] || [];

        const vagasLiberadas = envioCompleto
          ? box.vagas.filter((v) => v.ocupada && v.lojaId === loja.id).map((v) => v.numero)
          : liberarVagasParciais(box, loja.id, quantidade).vagasLiberadas;

        // Posição de carregamento (1 = primeira a entrar no baú) e a posição
        // de entrega prevista, que é a ordem inversa — quem carrega por
        // último (mais perto da porta) é entregue primeiro.
        const posicaoCarregamento = ordemValida.indexOf(loja.id) + 1;
        const posicaoEntrega = ordemValida.length - posicaoCarregamento + 1;

        // boxNumero/vagasLiberadas: ver comentário em FINALIZAR_CARREGAMENTO —
        // necessários para o cancelamento seguro (CANCELAR_PROTOCOLO).
        const protocolo = {
          id: gerarId('proto'),
          lojaId: loja.id,
          placa,
          motorista,
          lacres,
          statusEnvio: envioCompleto ? 'completo' : 'saldo',
          paletesEnviados: quantidade,
          lotesRestantes: envioCompleto ? [] : restantesLoja,
          lotesRestantesDescricao: envioCompleto
            ? []
            : restantesLoja.map((n) => descreverPalete(composicaoAnteriorLoja, n)),
          dataHora: agora,
          viagemId,
          boxNumero: loja.boxNumero,
          vagasLiberadas,
          posicaoCarregamento,
          posicaoEntrega,
        };
        protocolosNovos.push(protocolo);

        if (envioCompleto) {
          boxesAtualizados = boxesAtualizados.map((b) =>
            b.numero === loja.boxNumero ? liberarTodasVagas(box, loja.id) : b
          );
          lojasAtualizadasPorId[loja.id] = {
            ...loja,
            status: 'finalizada',
            dataCarregamento: agora,
            protocolos: [...loja.protocolos, protocolo],
          };
        } else {
          houveSaldo = true;
          const resultado = liberarVagasParciais(box, loja.id, quantidade);
          boxesAtualizados = boxesAtualizados.map((b) =>
            b.numero === loja.boxNumero ? resultado.box : b
          );
          lojasAtualizadasPorId[loja.id] = {
            ...loja,
            status: 'agrupada', // volta para a fila de carregamento com o saldo restante
            paletesAgrupados: loja.paletesAgrupados - quantidade,
            vagasOcupadas: resultado.vagasRestantes,
            composicaoPaletes: restantesLoja.map((n) => composicaoAnteriorLoja[n - 1] || ''),
            protocolos: [...loja.protocolos, protocolo],
          };
        }
      }

      return {
        ...state,
        boxes: boxesAtualizados,
        lojas: state.lojas.map((l) => lojasAtualizadasPorId[l.id] || l),
        protocolos: [...state.protocolos, ...protocolosNovos],
        ultimoErro: null,
        ultimoAviso: `Carregamento conjunto registrado — ${lojasSelecionadas.length} lojas no veículo ${placa}${
          houveSaldo ? ' (uma ou mais lojas ficaram com saldo, aguardando novo carregamento)' : ''
        }.`,
      };
    }

    // Desfaz um protocolo de carregamento já registrado (individual ou de
    // uma viagem em lote — cada loja tem seu próprio protocolo, então
    // cancelar afeta só a loja daquele protocolo). A loja volta para
    // "carregando" e as vagas que aquele protocolo havia liberado são
    // reocupadas — mas só se ninguém mais as tiver usado nesse meio-tempo
    // (por segurança, protocolos antigos sem essa informação registrada não
    // podem ser cancelados).
    case 'CANCELAR_PROTOCOLO': {
      const { protocoloId } = acao.payload;
      const protocolo = state.protocolos.find((p) => p.id === protocoloId);
      if (!protocolo) {
        return { ...state, ultimoErro: 'Protocolo não encontrado.' };
      }
      if (protocolo.boxNumero == null || !protocolo.vagasLiberadas) {
        return { ...state, ultimoErro: 'Este protocolo é antigo demais e não pode ser cancelado automaticamente.' };
      }

      const loja = state.lojas.find((l) => l.id === protocolo.lojaId);
      if (!loja) {
        return { ...state, ultimoErro: 'A loja deste protocolo não foi encontrada.' };
      }

      const box = state.boxes.find((b) => b.numero === protocolo.boxNumero);
      if (!box) {
        return { ...state, ultimoErro: 'O box deste protocolo não foi encontrado.' };
      }

      const vagasIndisponiveis = vagasIndisponiveisParaReocupar(box, protocolo.vagasLiberadas);
      if (vagasIndisponiveis.length > 0) {
        return {
          ...state,
          ultimoErro: `Não é possível cancelar: ${vagasIndisponiveis.length} vaga(s) do ${getNomeBox(
            protocolo.boxNumero
          )} já foram reutilizadas por outro carregamento.`,
        };
      }

      const novoBox = reocuparVagas(box, protocolo.vagasLiberadas, loja.id);

      const novaLojaState =
        protocolo.statusEnvio === 'completo'
          ? {
              ...loja,
              status: 'carregando',
              dataCarregamento: null,
              protocolos: loja.protocolos.filter((p) => p.id !== protocoloId),
            }
          : {
              ...loja,
              status: 'carregando',
              paletesAgrupados: loja.paletesAgrupados + protocolo.paletesEnviados,
              vagasOcupadas: [...loja.vagasOcupadas, ...protocolo.vagasLiberadas].sort((a, b) => a - b),
              protocolos: loja.protocolos.filter((p) => p.id !== protocoloId),
            };

      return {
        ...state,
        boxes: state.boxes.map((b) => (b.numero === protocolo.boxNumero ? novoBox : b)),
        lojas: state.lojas.map((l) => (l.id === loja.id ? novaLojaState : l)),
        protocolos: state.protocolos.filter((p) => p.id !== protocoloId),
        ultimoErro: null,
        ultimoAviso: `Protocolo cancelado — loja ${loja.loja} voltou para Em Carregamento.`,
      };
    }

    // Registro simples de chegada/saída do motorista na loja de destino
    // (entrega física, após o carregamento no CD). Vive no próprio
    // protocolo — que já liga placa + loja + o momento em que o veículo
    // saiu do CD — em vez de um cadastro novo, já que representa a mesma
    // viagem. Não mexe em boxes/vagas: essas já foram liberadas quando o
    // carregamento foi finalizado.
    case 'REGISTRAR_CHEGADA_LOJA': {
      // `dataHora` é opcional — quando o motorista esquece de sinalizar na
      // hora certa, a tela de Registro de Chegada e Saída permite informar
      // manualmente o horário real em vez de usar o momento atual.
      // `localizacao` ({ latitude, longitude }) é a posição do GPS do
      // navegador do motorista no momento do toque — só vem preenchida no
      // registro pelo botão (nunca no manual, feito depois/por outra
      // pessoa, quando o motorista não está mais necessariamente lá).
      const { protocoloId, dataHora, localizacao } = acao.payload;
      const protocolo = state.protocolos.find((p) => p.id === protocoloId);
      if (!protocolo) {
        return { ...state, ultimoErro: 'Protocolo não encontrado.' };
      }
      if (protocolo.chegadaLoja) {
        return { ...state, ultimoErro: 'A chegada já foi registrada para esta loja.' };
      }

      const loja = state.lojas.find((l) => l.id === protocolo.lojaId);
      const agora = dataHora || new Date().toISOString();
      if (dataHora && new Date(agora) < new Date(protocolo.dataHora)) {
        return { ...state, ultimoErro: 'O horário de chegada não pode ser antes da saída do CD.' };
      }

      const atualizarProtocolo = (p) =>
        p.id === protocoloId ? { ...p, chegadaLoja: agora, localizacaoChegada: localizacao || null } : p;

      return {
        ...state,
        protocolos: state.protocolos.map(atualizarProtocolo),
        lojas: state.lojas.map((l) =>
          l.id === protocolo.lojaId ? { ...l, protocolos: l.protocolos.map(atualizarProtocolo) } : l
        ),
        ultimoErro: null,
        ultimoAviso: `Chegada${dataHora ? ' registrada manualmente' : ' registrada'} na loja ${loja?.loja ?? ''} às ${new Date(agora).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}.`,
      };
    }

    case 'REGISTRAR_SAIDA_LOJA': {
      // Mesma ideia do caso acima: `dataHora` manual cobre o motorista que
      // esqueceu de sinalizar a saída na hora, e `localizacao` é a posição
      // do GPS no momento do toque (só no registro pelo botão).
      const { protocoloId, dataHora, localizacao } = acao.payload;
      const protocolo = state.protocolos.find((p) => p.id === protocoloId);
      if (!protocolo) {
        return { ...state, ultimoErro: 'Protocolo não encontrado.' };
      }
      if (!protocolo.chegadaLoja) {
        return { ...state, ultimoErro: 'Registre a chegada na loja antes de registrar a saída.' };
      }
      if (protocolo.saidaLoja) {
        return { ...state, ultimoErro: 'A saída já foi registrada para esta loja.' };
      }

      const loja = state.lojas.find((l) => l.id === protocolo.lojaId);
      const agora = dataHora || new Date().toISOString();
      if (dataHora && new Date(agora) < new Date(protocolo.chegadaLoja)) {
        return { ...state, ultimoErro: 'O horário de saída não pode ser antes da chegada.' };
      }

      const atualizarProtocolo = (p) =>
        p.id === protocoloId ? { ...p, saidaLoja: agora, localizacaoSaida: localizacao || null } : p;

      return {
        ...state,
        protocolos: state.protocolos.map(atualizarProtocolo),
        lojas: state.lojas.map((l) =>
          l.id === protocolo.lojaId ? { ...l, protocolos: l.protocolos.map(atualizarProtocolo) } : l
        ),
        ultimoErro: null,
        ultimoAviso: `Saída${dataHora ? ' registrada manualmente' : ' registrada'} na loja ${loja?.loja ?? ''} às ${new Date(agora).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}.`,
      };
    }

    case 'ENCERRAR_DIA': {
      return {
        ...state,
        diaAtual: somarDias(state.diaAtual, 1),
        ultimoErro: null,
        ultimoAviso: 'Dia operacional encerrado. Lojas não finalizadas viraram saldo do dia anterior.',
      };
    }

    case 'RESTAURAR_DADOS_EXEMPLO': {
      return { ...gerarDadosIniciais(), ultimoAviso: 'Dados de exemplo restaurados.' };
    }

    case 'LIMPAR_TUDO': {
      return {
        lojas: [],
        boxes: criarBoxesIniciais(),
        protocolos: [],
        diaAtual: hojeISO(),
        // Cadastros auxiliares (colaboradores/motoristas/placas/localização
        // das lojas) não são dados operacionais do dia — são preservados ao
        // zerar lojas/boxes.
        colaboradoresCadastrados: state.colaboradoresCadastrados,
        motoristasCadastrados: state.motoristasCadastrados,
        placasCadastradas: state.placasCadastradas,
        contatosNotificacao: state.contatosNotificacao,
        localizacaoLojas: state.localizacaoLojas,
        ultimoErro: null,
        ultimoAviso: 'Banco de dados zerado — todas as lojas, boxes e protocolos foram removidos.',
      };
    }

    case 'LIMPAR_MENSAGENS': {
      return { ...state, ultimoErro: null, ultimoAviso: null };
    }

    // Cadastros auxiliares (Colaboradores, Motoristas, Placas de Veículo):
    // usados como sugestão automática (datalist) nos formulários de
    // Agrupamento e Carregamento. Colaboradores/Motoristas são listas
    // simples de strings; Placas é a exceção — cada item carrega também se o
    // veículo "possui plataforma" (`{ placa, possuiPlataforma }`), então tem
    // seu próprio ramo dentro das ações genéricas CADASTRAR_ITEM/REMOVER_ITEM.
    case 'CADASTRAR_ITEM': {
      const { entidade, valor } = acao.payload;
      if (!CADASTROS_VALIDOS.includes(entidade)) {
        return { ...state, ultimoErro: 'Tipo de cadastro inválido.' };
      }

      if (entidade === 'placasCadastradas') {
        const placaLimpa = (valor?.placa || '').trim().toUpperCase();
        if (!placaLimpa) {
          return { ...state, ultimoErro: 'Informe uma placa válida.' };
        }
        const listaAtual = state.placasCadastradas || [];
        if (listaAtual.some((p) => p.placa === placaLimpa)) {
          return { ...state, ultimoErro: 'Esta placa já está cadastrada.' };
        }
        const novoItem = { placa: placaLimpa, possuiPlataforma: !!valor?.possuiPlataforma };
        return {
          ...state,
          placasCadastradas: [...listaAtual, novoItem].sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR')),
          ultimoErro: null,
          ultimoAviso: `Placa "${placaLimpa}" cadastrada com sucesso.`,
        };
      }

      // Coordenada (latitude/longitude) cadastrada de cada loja — usada pra
      // detectar automaticamente (via GPS do navegador) quando o motorista
      // chegou perto dela, na aba Motoristas (ver DriversPage.jsx). Chave é
      // o código da loja (estável entre dias/cargas, ao contrário do id de
      // cada registro importado); cadastrar de novo o mesmo código
      // substitui a coordenada salva.
      if (entidade === 'localizacaoLojas') {
        const codigoLimpo = (valor?.codigo || '').trim().toUpperCase();
        const latitude = Number(valor?.latitude);
        const longitude = Number(valor?.longitude);
        if (!codigoLimpo) {
          return { ...state, ultimoErro: 'Informe o código da loja.' };
        }
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return { ...state, ultimoErro: 'Informe latitude e longitude válidas.' };
        }
        const novoItem = {
          codigo: codigoLimpo,
          nomeLoja: (valor?.nomeLoja || '').trim(),
          latitude,
          longitude,
        };
        const listaAtual = (state.localizacaoLojas || []).filter((l) => l.codigo !== codigoLimpo);
        return {
          ...state,
          localizacaoLojas: [...listaAtual, novoItem].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR')),
          ultimoErro: null,
          ultimoAviso: `Localização da loja ${codigoLimpo} cadastrada com sucesso.`,
        };
      }

      // Contatos que recebem a notificação por WhatsApp ao concluir um
      // agrupamento (ver NotifyGroupingModal.jsx). Cada item carrega nome +
      // telefone, e o telefone é normalizado (só dígitos, com "55" na
      // frente) para já sair pronto para montar o link de WhatsApp depois.
      if (entidade === 'contatosNotificacao') {
        const nomeLimpo = (valor?.nome || '').trim();
        const telefoneNormalizado = normalizarTelefoneWhatsapp(valor?.telefone);
        if (!nomeLimpo || !telefoneNormalizado) {
          return { ...state, ultimoErro: 'Informe nome e telefone válidos.' };
        }
        const listaAtual = state.contatosNotificacao || [];
        if (listaAtual.some((c) => c.telefone === telefoneNormalizado)) {
          return { ...state, ultimoErro: 'Já existe um contato cadastrado com este telefone.' };
        }
        const novoContato = { nome: nomeLimpo, telefone: telefoneNormalizado };
        return {
          ...state,
          contatosNotificacao: [...listaAtual, novoContato].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
          ultimoErro: null,
          ultimoAviso: `Contato "${nomeLimpo}" cadastrado com sucesso.`,
        };
      }

      const valorLimpo = (valor || '').trim();
      if (!valorLimpo) {
        return { ...state, ultimoErro: 'Informe um valor válido para o cadastro.' };
      }

      const listaAtual = state[entidade] || [];
      if (listaAtual.some((v) => v.toLowerCase() === valorLimpo.toLowerCase())) {
        return { ...state, ultimoErro: 'Este item já está cadastrado.' };
      }

      return {
        ...state,
        [entidade]: [...listaAtual, valorLimpo].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        ultimoErro: null,
        ultimoAviso: `"${valorLimpo}" cadastrado com sucesso.`,
      };
    }

    case 'REMOVER_ITEM': {
      const { entidade, valor } = acao.payload;
      if (!CADASTROS_VALIDOS.includes(entidade)) {
        return { ...state, ultimoErro: 'Tipo de cadastro inválido.' };
      }

      if (entidade === 'placasCadastradas') {
        return {
          ...state,
          placasCadastradas: (state.placasCadastradas || []).filter((p) => p.placa !== valor),
          ultimoErro: null,
          ultimoAviso: `Placa "${valor}" removida do cadastro.`,
        };
      }

      if (entidade === 'localizacaoLojas') {
        return {
          ...state,
          localizacaoLojas: (state.localizacaoLojas || []).filter((l) => l.codigo !== valor),
          ultimoErro: null,
          ultimoAviso: `Localização da loja ${valor} removida do cadastro.`,
        };
      }

      if (entidade === 'contatosNotificacao') {
        return {
          ...state,
          contatosNotificacao: (state.contatosNotificacao || []).filter((c) => c.telefone !== valor),
          ultimoErro: null,
          ultimoAviso: 'Contato removido do cadastro.',
        };
      }

      return {
        ...state,
        [entidade]: (state[entidade] || []).filter((v) => v !== valor),
        ultimoErro: null,
        ultimoAviso: `"${valor}" removido do cadastro.`,
      };
    }

    // Reconcilia os cadastros auxiliares salvos (localStorage) com o formato
    // atual do estado. Necessário pelo mesmo motivo do SINCRONIZAR_BOXES:
    // uma sessão salva antes da criação de `motoristasCadastrados`/
    // `placasCadastradas` teria esses campos ausentes (undefined) até essa
    // sincronização rodar — e uma sessão salva antes do campo
    // "possui plataforma" teria `placasCadastradas` como lista de strings
    // simples, que aqui é convertida para o formato de objeto atual.
    case 'SINCRONIZAR_CADASTROS': {
      const placasBrutas = state.placasCadastradas || [];
      const placasNormalizadas = placasBrutas.map((p) =>
        typeof p === 'string' ? { placa: p, possuiPlataforma: false } : p
      );
      return {
        ...state,
        colaboradoresCadastrados: state.colaboradoresCadastrados || [],
        motoristasCadastrados: state.motoristasCadastrados || [],
        placasCadastradas: placasNormalizadas,
        contatosNotificacao: state.contatosNotificacao || [],
        localizacaoLojas: state.localizacaoLojas || [],
      };
    }

    // Movimentação manual: transfere uma loja (com box já definido) para
    // outro box, liberando as vagas ocupadas no box de origem e realocando a
    // mesma quantidade de paletes no box de destino. Usa a mesma regra de
    // preenchimento que a etapa atual da loja já segue (crescente enquanto
    // ainda não concluiu o agrupamento; decrescente depois de agrupada), para
    // manter o padrão físico consistente independentemente de qual box a
    // loja está ocupando.
    case 'MOVER_BOX': {
      const { lojaId, boxNumeroDestino } = acao.payload;
      const loja = state.lojas.find((l) => l.id === lojaId);

      if (!loja || !STATUS_COM_BOX_OCUPADO.includes(loja.status)) {
        return { ...state, ultimoErro: 'Esta loja não pode ser movida de box no status atual.' };
      }
      if (loja.boxNumero === boxNumeroDestino) {
        return { ...state, ultimoErro: 'A loja já está neste box.' };
      }

      const boxOrigem = state.boxes.find((b) => b.numero === loja.boxNumero);
      const boxDestino = state.boxes.find((b) => b.numero === boxNumeroDestino);
      if (!boxOrigem || !boxDestino) {
        return { ...state, ultimoErro: 'Box de origem ou destino inválido.' };
      }

      const alocador = STATUS_FASE_DECRESCENTE.includes(loja.status)
        ? alocarVagasDecrescente
        : alocarVagasCrescente;
      const resultado = alocador(boxDestino, loja.paletesAgrupados, lojaId);
      if (!resultado.sucesso) {
        return { ...state, ultimoErro: resultado.erro };
      }

      const boxOrigemLiberado = liberarTodasVagas(boxOrigem, lojaId);

      return {
        ...state,
        boxes: state.boxes.map((b) => {
          if (b.numero === boxOrigem.numero) return boxOrigemLiberado;
          if (b.numero === boxDestino.numero) return resultado.box;
          return b;
        }),
        lojas: state.lojas.map((l) =>
          l.id === lojaId
            ? { ...l, boxNumero: boxNumeroDestino, vagasOcupadas: resultado.vagasAlocadas }
            : l
        ),
        ultimoErro: null,
        ultimoAviso: `Loja ${loja.loja} movida do ${getNomeBox(boxOrigem.numero)} para o ${getNomeBox(boxNumeroDestino)} (vagas ${resultado.vagasAlocadas.join(', ')}).`,
      };
    }

    // Reconcilia state.boxes com a lista atual de boxes (CONFIG_BOXES em
    // boxLogic.js). Necessário porque o estado é persistido em localStorage
    // no navegador: se um box for renomeado, tiver a capacidade alterada ou
    // um novo box for adicionado, uma sessão já salva no navegador continua
    // com o formato antigo até essa sincronização rodar (feita uma vez, ao
    // carregar o app — ver AppProvider). Idempotente e silenciosa (não gera
    // aviso), pois roda toda vez que o app abre, mesmo quando nada mudou.
    case 'SINCRONIZAR_BOXES': {
      return { ...state, boxes: sincronizarBoxes(state.boxes) };
    }

    default:
      return state;
  }
}

// Depois de qualquer ação que tenha alterado as vagas de um ou mais boxes
// (uma loja liberou vagas ao sair do box, foi movida, teve o apontamento
// cancelado etc.), reempacota esses boxes específicos com `compactarBox` —
// fecha os vãos que sobram no meio da fila quando uma loja termina e libera
// vagas, deixando as lojas que ficaram exatamente nas mesmas quantidades,
// mas nos números certos (ver comentário de compactarBox em boxLogic.js).
// Só mexe nos boxes que realmente mudaram nesta ação (evita trabalho à toa
// nas dezenas de ações que não tocam vaga nenhuma) e sincroniza de volta
// `vagasOcupadas` de cada loja afetada, já que essa lista é usada ao
// cancelar um protocolo de carregamento (ver reocuparVagas acima).
function compactarBoxesAfetados(state, numerosBoxesAfetados) {
  const lojasPorId = Object.fromEntries(state.lojas.map((l) => [l.id, l]));

  let algumBoxMudou = false;
  const novosBoxes = state.boxes.map((box) => {
    if (!numerosBoxesAfetados.has(box.numero)) return box;
    const compactado = compactarBox(box, lojasPorId);
    if (compactado !== box) algumBoxMudou = true;
    return compactado;
  });
  if (!algumBoxMudou) return state;

  const novasVagasPorLoja = new Map();
  for (const box of novosBoxes) {
    if (!numerosBoxesAfetados.has(box.numero)) continue;
    for (const v of box.vagas) {
      if (v.ocupada && v.lojaId) {
        if (!novasVagasPorLoja.has(v.lojaId)) novasVagasPorLoja.set(v.lojaId, []);
        novasVagasPorLoja.get(v.lojaId).push(v.numero);
      }
    }
  }

  return {
    ...state,
    boxes: novosBoxes,
    lojas: state.lojas.map((l) => {
      const vagas = novasVagasPorLoja.get(l.id);
      return vagas ? { ...l, vagasOcupadas: vagas.sort((a, b) => a - b) } : l;
    }),
  };
}

function aplicarAcao(state, acao) {
  const resultado = aplicarAcaoInterna(state, acao);
  if (resultado.boxes === state.boxes) return resultado;

  const numerosBoxesAfetados = new Set();
  resultado.boxes.forEach((box, i) => {
    if (box !== state.boxes[i]) numerosBoxesAfetados.add(box.numero);
  });
  if (numerosBoxesAfetados.size === 0) return resultado;

  return compactarBoxesAfetados(resultado, numerosBoxesAfetados);
}

export function AppProvider({ children }) {
  const [state, setState] = useSyncedAppState(CHAVE_STORAGE, () => gerarDadosIniciais());

  // Filtro global de Tipo de Carga (Seca/Resfriada/Todos), selecionado no
  // cabeçalho e válido em todas as abas (exceto Cadastros, que não lista
  // lojas). Não é uma ação sobre os dados — é só um filtro de visualização —
  // então fica fora do reducer/localStorage, como estado de UI simples.
  const [filtroTipoCarga, setFiltroTipoCarga] = useState('todos'); // 'todos' | 'seca' | 'resfriada'

  // Ao montar, garante que os boxes e os cadastros auxiliares salvos
  // (localStorage) estejam alinhados com o formato atual do app.
  useEffect(() => {
    setState((prevState) => aplicarAcao(prevState, { tipo: 'SINCRONIZAR_BOXES' }));
    setState((prevState) => aplicarAcao(prevState, { tipo: 'SINCRONIZAR_CADASTROS' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dispatch = useCallback(
    (acao) => setState((prevState) => aplicarAcao(prevState, acao)),
    [setState]
  );

  const actions = useMemo(
    () => ({
      importarLojas: (registros) => dispatch({ tipo: 'IMPORTAR_LOJAS', payload: registros }),
      excluirLoja: (lojaId) => dispatch({ tipo: 'EXCLUIR_LOJA', payload: { lojaId } }),
      apontarBox: (payload) => dispatch({ tipo: 'APONTAR_BOX', payload }),
      concluirConferencia: (lojaId) => dispatch({ tipo: 'CONCLUIR_CONFERENCIA', payload: { lojaId } }),
      iniciarAgrupamento: (payload) => dispatch({ tipo: 'INICIAR_AGRUPAMENTO', payload }),
      concluirAgrupamento: (payload) => dispatch({ tipo: 'CONCLUIR_AGRUPAMENTO', payload }),
      cancelarAgrupamento: (lojaId) => dispatch({ tipo: 'CANCELAR_AGRUPAMENTO', payload: { lojaId } }),
      moverBox: (payload) => dispatch({ tipo: 'MOVER_BOX', payload }),
      iniciarCarregamento: (lojaId) => dispatch({ tipo: 'INICIAR_CARREGAMENTO', payload: { lojaId } }),
      cancelarInicioCarregamento: (lojaId) => dispatch({ tipo: 'CANCELAR_INICIO_CARREGAMENTO', payload: { lojaId } }),
      finalizarCarregamento: (payload) => dispatch({ tipo: 'FINALIZAR_CARREGAMENTO', payload }),
      finalizarCarregamentoMultiplo: (payload) => dispatch({ tipo: 'FINALIZAR_CARREGAMENTO_MULTIPLO', payload }),
      cancelarProtocolo: (protocoloId) => dispatch({ tipo: 'CANCELAR_PROTOCOLO', payload: { protocoloId } }),
      registrarChegadaLoja: (protocoloId, dataHora, localizacao) =>
        dispatch({ tipo: 'REGISTRAR_CHEGADA_LOJA', payload: { protocoloId, dataHora, localizacao } }),
      registrarSaidaLoja: (protocoloId, dataHora, localizacao) =>
        dispatch({ tipo: 'REGISTRAR_SAIDA_LOJA', payload: { protocoloId, dataHora, localizacao } }),
      encerrarDia: () => dispatch({ tipo: 'ENCERRAR_DIA' }),
      restaurarDadosExemplo: () => dispatch({ tipo: 'RESTAURAR_DADOS_EXEMPLO' }),
      limparTudo: () => dispatch({ tipo: 'LIMPAR_TUDO' }),
      limparMensagens: () => dispatch({ tipo: 'LIMPAR_MENSAGENS' }),
      cadastrarItem: (entidade, valor) => dispatch({ tipo: 'CADASTRAR_ITEM', payload: { entidade, valor } }),
      removerItem: (entidade, valor) => dispatch({ tipo: 'REMOVER_ITEM', payload: { entidade, valor } }),
    }),
    [dispatch]
  );

  const value = useMemo(
    () => ({ state, dispatch, actions, filtroTipoCarga, setFiltroTipoCarga }),
    [state, dispatch, actions, filtroTipoCarga]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useApp deve ser usado dentro de um <AppProvider>.');
  }
  return context;
}
