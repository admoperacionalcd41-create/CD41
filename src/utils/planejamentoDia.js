// ---------------------------------------------------------------------------
// PLANEJAMENTO do Processo do Dia — análise para decidir onde focar.
//
// Meta do usuário: entregar TODAS as lojas, e quem não foi entregue no dia
// anterior tem prioridade hoje. Para cada loja (na mesma sequência/posição
// do Processo do Dia) a análise cruza:
//   - situação da carga agora (box, etapa e, se agrupada, os paletes);
//   - se já foi carregada hoje (completo / parcial com saldo);
//   - se foi entregue no dia útil anterior (ontem; na segunda-feira conta
//     sexta a domingo, pra não acusar falta de quem recebeu no sábado).
// e classifica a prioridade e a ação sugerida. Tudo derivado do estado atual
// (nada é gravado).
// ---------------------------------------------------------------------------
import { getLinhasProcessoDoDia, getEntregaCodigoLojaNaData } from './selectors';
import { lojaPassaFiltroTipoCarga } from './tipoCarga';
import { hojeISO, somarDias } from './dateHelpers';

const ETAPAS_NO_BOX = ['apontada', 'conferencia_finalizada', 'em_agrupamento', 'agrupada', 'carregando'];
const ORDEM_ETAPA = ETAPAS_NO_BOX; // mais à direita = mais avançada

/** Dias (YYYY-MM-DD) que contam como "dia anterior": do último dia útil (seg–sex) anterior a hoje até ontem. */
export function getJanelaDiaAnterior(hoje = hojeISO()) {
  const dias = [];
  let d = somarDias(hoje, -1);
  dias.push(d);
  // 0 = domingo, 6 = sábado
  const diaSemana = (iso) => new Date(`${iso}T12:00:00`).getDay();
  while (diaSemana(d) === 0 || diaSemana(d) === 6) {
    d = somarDias(d, -1);
    dias.push(d);
  }
  return dias.reverse();
}

export const ROTULO_ETAPA = {
  apontada: 'Em execução',
  conferencia_finalizada: 'Conferência finalizada',
  em_agrupamento: 'Agrupando',
  agrupada: 'Agrupada',
  carregando: 'Em carregamento',
};

export const NIVEIS = {
  concluida: { rotulo: 'Concluída', ordem: 5 },
  no_prazo: { rotulo: 'No prazo', ordem: 4 },
  atencao: { rotulo: 'Atenção', ordem: 3 },
  alta: { rotulo: 'Alta', ordem: 2 },
  critica: { rotulo: 'Crítica', ordem: 1 },
};

/**
 * @returns {{ hoje, diasAnteriores, linhas: Array, resumo: object, foco: object }}
 */
export function getPlanejamentoDoDia(state, filtroTipoCarga, hoje = hojeISO()) {
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;
  const linhasProcesso = getLinhasProcessoDoDia(state, filtroTipoCarga);
  const diasAnteriores = getJanelaDiaAnterior(hoje);

  // Mesma sequência/posição do Processo do Dia (state.sequenciaLojas; as não
  // sequenciadas entram depois, na ordem padrão).
  const porCodigo = new Map(linhasProcesso.map((l) => [l.codigo, l]));
  const ordemSalva = (state.sequenciaLojas || []).filter((c) => porCodigo.has(c));
  const emOrdem = [...ordemSalva.map((c) => porCodigo.get(c)), ...linhasProcesso.filter((l) => !ordemSalva.includes(l.codigo))];

  // Cargas fisicamente em andamento (box ocupado) por código: etapa mais avançada + paletes.
  const emAndamentoPorCodigo = new Map();
  state.lojas.forEach((l) => {
    if (l.boxNumero == null || !ETAPAS_NO_BOX.includes(l.status) || !lojaPassaFiltroTipoCarga(l, filtroTipoCarga)) return;
    const atual = emAndamentoPorCodigo.get(l.loja);
    if (!atual || ORDEM_ETAPA.indexOf(l.status) >= ORDEM_ETAPA.indexOf(atual.etapa)) {
      emAndamentoPorCodigo.set(l.loja, {
        etapa: l.status,
        boxNumero: l.boxNumero,
        paletes: (l.status === 'agrupada' || l.status === 'carregando') && l.paletesAgrupados > 0 ? l.paletesAgrupados : null,
      });
    }
  });

  const linhas = emOrdem.map((l, i) => {
    const andamento = emAndamentoPorCodigo.get(l.codigo) || null;

    const completoHoje = l.cargas.some((c) => c.situacaoChave === 'completo');
    const parcialHoje = !completoHoje && l.cargas.some((c) => c.situacaoChave === 'parcial');
    const carregadaHoje = completoHoje ? 'sim' : parcialHoje ? 'parcial' : 'nao';

    // Entrega no dia anterior (protocolos = o que realmente saiu do CD).
    const ontemPorDia = diasAnteriores.map((d) => getEntregaCodigoLojaNaData(state, l.codigo, d, tipo));
    const entregueOntem = ontemPorDia.some((o) => o.entregue);
    const parcialOntem = ontemPorDia.some((o) => o.parcial);
    const tinhaCargaOntem = ontemPorDia.some((o) => o.temAtividade);
    const ontem = !entregueOntem ? 'nao' : parcialOntem ? 'parcial' : 'sim';

    const temCargaImportadaHoje = l.cargas.length > 0 && l.cargas.some((c) => c.status === 'pendente');
    const naoEntregueOntem = ontem !== 'sim';

    let nivel;
    let acao;
    let motivo;
    let prontidao; // 0 (nada) .. 5 (pronta/saindo) — ordena o foco
    if (carregadaHoje === 'sim') {
      nivel = 'concluida';
      acao = 'Nada a fazer — já carregada hoje.';
      motivo = '';
      prontidao = -1;
    } else if (andamento) {
      const e = andamento.etapa;
      prontidao = ORDEM_ETAPA.indexOf(e) + 1; // 1..5
      acao =
        e === 'carregando'
          ? 'Finalizar o protocolo de carregamento'
          : e === 'agrupada'
          ? `Carregar agora${andamento.paletes ? ` (${andamento.paletes} pal.)` : ''}`
          : e === 'em_agrupamento'
          ? 'Concluir o agrupamento'
          : e === 'conferencia_finalizada'
          ? 'Iniciar o agrupamento'
          : 'Terminar a execução e agrupar';
      if (carregadaHoje === 'parcial') acao = `Saldo pendente — ${acao.charAt(0).toLowerCase()}${acao.slice(1)}`;
      nivel = naoEntregueOntem || carregadaHoje === 'parcial' ? 'alta' : 'no_prazo';
      motivo = naoEntregueOntem
        ? ontem === 'parcial'
          ? 'Ontem saiu só parte da carga'
          : 'Não foi entregue ontem'
        : carregadaHoje === 'parcial'
        ? 'Saiu só parte hoje — falta o saldo'
        : '';
    } else {
      // Sem carga no box.
      prontidao = temCargaImportadaHoje ? 0.5 : 0;
      acao = temCargaImportadaHoje
        ? 'Carga importada — falta expedir/apontar'
        : carregadaHoje === 'parcial'
        ? 'Saldo sem carga no box — conferir'
        : 'Sem carga hoje — cobrar geração/importação da carga';
      nivel = naoEntregueOntem ? 'critica' : 'atencao';
      motivo = naoEntregueOntem
        ? ontem === 'parcial'
          ? 'Ontem saiu só parte da carga e hoje não há carga no box'
          : tinhaCargaOntem
          ? 'Faltou ontem (tinha carga) e hoje ainda não tem carga pronta'
          : 'Não foi entregue ontem e hoje ainda não tem carga pronta'
        : 'Sem carga em andamento — risco de ficar sem entrega hoje';
    }

    return {
      posicao: i + 1,
      codigo: l.codigo,
      nomeLoja: l.nomeLoja,
      tiposCarga: l.tiposCarga,
      andamento,
      carregadaHoje,
      ontem,
      tinhaCargaOntem,
      nivel,
      acao,
      motivo,
      prontidao,
      naoEntregueOntem,
    };
  });

  const abertas = linhas.filter((l) => l.nivel !== 'concluida');
  const concluidas = linhas.length - abertas.length;
  const prontas = abertas.filter((l) => l.andamento && ['agrupada', 'carregando'].includes(l.andamento.etapa));
  const emPreparo = abertas.filter((l) => l.andamento && !['agrupada', 'carregando'].includes(l.andamento.etapa));
  const semCarga = abertas.filter((l) => !l.andamento);
  const atrasadasAbertas = abertas.filter((l) => l.naoEntregueOntem);
  const somaPaletes = (arr) => arr.reduce((s, l) => s + (l.andamento?.paletes || 0), 0);

  const resumo = {
    total: linhas.length,
    concluidas,
    abertas: abertas.length,
    prontas: prontas.length,
    paletesProntos: somaPaletes(prontas),
    emPreparo: emPreparo.length,
    semCarga: semCarga.length,
    atrasadasAbertas: atrasadasAbertas.length,
    criticas: abertas.filter((l) => l.nivel === 'critica').length,
    // Cobertura se tudo que já está agrupado/carregando sair hoje.
    coberturaAtual: linhas.length ? Math.round((concluidas / linhas.length) * 100) : 0,
    coberturaProjetada: linhas.length ? Math.round(((concluidas + prontas.length) / linhas.length) * 100) : 0,
    coberturaPossivel: linhas.length ? Math.round(((concluidas + prontas.length + emPreparo.length) / linhas.length) * 100) : 0,
  };

  // Onde focar: ordem de ataque = quem estava em atraso primeiro; dentro disso,
  // o que está mais perto de sair (vitória rápida); a posição desempata.
  const ordemFoco = (a, b) =>
    Number(b.naoEntregueOntem) - Number(a.naoEntregueOntem) || b.prontidao - a.prontidao || a.posicao - b.posicao;
  const foco = {
    carregarAgora: [...prontas].sort(ordemFoco),
    fecharPreparo: [...emPreparo].sort(ordemFoco),
    cobrarCarga: [...semCarga].sort(ordemFoco),
  };

  return { hoje, diasAnteriores, linhas, resumo, foco };
}
