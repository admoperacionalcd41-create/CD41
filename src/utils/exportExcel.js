import * as XLSX from 'xlsx';
import {
  getCodigosEntreguesNaData,
  getCodigosLojaNoPeriodo,
  getEntregaCodigoLojaNaData,
  getPermanenciasRegistradas,
  getEntregasPorMotorista,
  getLojasAgrupadasOuAlem,
} from './selectors';
import { getDiasUteisSemanaAtual, formatarDiaSemanaCurto, formatarData, formatarDataHora, hojeISO } from './dateHelpers';
import { lojaPassaFiltroTipoCarga } from './tipoCarga';

const META_DIARIA = 28;

const ROTULO_TIPO = {
  seca: 'Carga Seca',
  resfriada: 'Carga Resfriada',
  todos: 'Seca + Resfriada',
};

// Larguras de coluna aproximadas (em caracteres) — o SheetJS não calcula
// isso sozinho, então cada planilha define as suas pra não sair com tudo
// espremido numa coluna estreita ao abrir no Excel.
function definirLargurasColunas(planilha, larguras) {
  planilha['!cols'] = larguras.map((wch) => ({ wch }));
}

function construirPlanilhaMetaDiaria(state, tipo, rotuloTipo) {
  const hoje = hojeISO();
  const linhas = getDiasUteisSemanaAtual().map((dataISO) => {
    const entregues = getCodigosEntreguesNaData(state, dataISO, tipo);
    const pct = Math.min(100, Math.round((entregues / META_DIARIA) * 100));
    return {
      Data: formatarData(dataISO),
      'Dia da Semana': formatarDiaSemanaCurto(dataISO),
      'Lojas Entregues': entregues,
      Meta: META_DIARIA,
      '% Atingido': pct,
      'Meta Batida': entregues >= META_DIARIA ? 'Sim' : dataISO > hoje ? '—' : 'Não',
    };
  });
  const planilha = XLSX.utils.json_to_sheet(linhas);
  definirLargurasColunas(planilha, [12, 14, 16, 8, 12, 12]);
  return planilha;
}

function construirPlanilhaMetaPorLoja(state, tipo) {
  const dias = getDiasUteisSemanaAtual();
  const codigos = getCodigosLojaNoPeriodo(state, dias, tipo);

  const linhas = codigos.map(({ codigo, nomeLoja }) => {
    const linha = { Código: codigo, Loja: nomeLoja };
    let diasEntregues = 0;
    let diasAvaliados = 0;
    dias.forEach((dataISO) => {
      const rotuloDia = formatarDiaSemanaCurto(dataISO);
      const { temAtividade, entregue, paletes, parcial } = getEntregaCodigoLojaNaData(state, codigo, dataISO, tipo);
      if (!temAtividade) {
        linha[rotuloDia] = '—';
      } else if (entregue) {
        linha[rotuloDia] = parcial ? `${paletes} (parcial)` : paletes;
        diasEntregues += 1;
        diasAvaliados += 1;
      } else {
        linha[rotuloDia] = 'FALTOU';
        diasAvaliados += 1;
      }
    });
    linha['Dias Entregues'] = diasEntregues;
    linha['Dias Avaliados'] = diasAvaliados;
    linha['Entrega Completa'] = diasAvaliados > 0 && diasEntregues === diasAvaliados ? 'Sim' : 'Não';
    return linha;
  });

  const planilha = XLSX.utils.json_to_sheet(linhas);
  definirLargurasColunas(planilha, [10, 26, 10, 10, 10, 10, 10, 14, 14, 16]);
  return planilha;
}

function construirPlanilhaTempoPermanencia(state, tipo) {
  const permanencias = getPermanenciasRegistradas(state, tipo).sort((a, b) => b.permanenciaMs - a.permanenciaMs);
  const linhas = permanencias.map((p) => ({
    Código: p.loja.loja,
    Loja: p.loja.nomeLoja,
    Motorista: p.motorista,
    Placa: p.placa,
    Chegada: formatarDataHora(p.chegadaLoja),
    Saída: formatarDataHora(p.saidaLoja),
    'Permanência (min)': Math.round(p.permanenciaMs / 60000),
  }));
  const planilha = XLSX.utils.json_to_sheet(linhas);
  definirLargurasColunas(planilha, [10, 26, 20, 12, 16, 16, 18]);
  return planilha;
}

function construirPlanilhaLojasPorMotorista(state, tipo) {
  const dados = getEntregasPorMotorista(state, tipo);
  const linhas = dados.map((m) => ({
    Motorista: m.motorista,
    'Lojas Entregues': m.lojasEntregues,
  }));
  const planilha = XLSX.utils.json_to_sheet(linhas);
  definirLargurasColunas(planilha, [26, 16]);
  return planilha;
}

function construirPlanilhaProdutividade(state, filtroTipoCarga) {
  const lojasConsideradas = getLojasAgrupadasOuAlem(state).filter((l) => lojaPassaFiltroTipoCarga(l, filtroTipoCarga));

  const mapa = new Map();
  lojasConsideradas.forEach((loja) => {
    const paletes = loja.paletesNoAgrupamento || loja.paletesAgrupados || 0;
    const colaboradoresDaLoja = (loja.colaboradores || []).filter(Boolean);
    if (colaboradoresDaLoja.length === 0) return;
    const paletesPorColaborador = paletes / colaboradoresDaLoja.length;
    colaboradoresDaLoja.forEach((nome) => {
      const atual = mapa.get(nome) || { nome, lojas: 0, paletes: 0 };
      atual.lojas += 1;
      atual.paletes += paletesPorColaborador;
      mapa.set(nome, atual);
    });
  });

  const linhas = [...mapa.values()]
    .sort((a, b) => b.paletes - a.paletes)
    .map((c) => ({
      Colaborador: c.nome,
      'Lojas Atendidas': c.lojas,
      'Total de Paletes': Number(c.paletes.toFixed(1)),
      'Média Paletes/Loja': Number((c.paletes / c.lojas).toFixed(1)),
    }));

  const planilha = XLSX.utils.json_to_sheet(linhas);
  definirLargurasColunas(planilha, [24, 16, 16, 18]);
  return planilha;
}

/**
 * Gera um único arquivo .xlsx com uma aba para cada relatório exibido na
 * aba Relatórios (Meta de Entrega — geral e por loja, Tempo de
 * Permanência, Lojas por Motorista e Produtividade), respeitando o mesmo
 * filtro Seca/Resfriada selecionado no cabeçalho no momento da exportação,
 * e entrega o arquivo ao usuário.
 *
 * O app roda em dois lugares diferentes: publicado como Artifact (onde o
 * navegador não deixa a página disparar um download sozinha — é preciso
 * pedir pela capability `downloads` do Claude) ou hospedado como site
 * comum (Netlify Drop etc., sem essa restrição, onde o download direto via
 * blob funciona normalmente). Por isso tenta a capability primeiro e cai
 * pro download direto quando ela não existir nesse ambiente.
 */
export async function exportarRelatoriosParaExcel(state, filtroTipoCarga) {
  const tipo = filtroTipoCarga && filtroTipoCarga !== 'todos' ? filtroTipoCarga : undefined;
  const rotuloTipo = ROTULO_TIPO[filtroTipoCarga] || ROTULO_TIPO.todos;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, construirPlanilhaMetaDiaria(state, tipo, rotuloTipo), 'Meta Diaria');
  XLSX.utils.book_append_sheet(workbook, construirPlanilhaMetaPorLoja(state, tipo), 'Meta por Loja');
  XLSX.utils.book_append_sheet(workbook, construirPlanilhaTempoPermanencia(state, tipo), 'Tempo de Permanencia');
  XLSX.utils.book_append_sheet(workbook, construirPlanilhaLojasPorMotorista(state, tipo), 'Lojas por Motorista');
  XLSX.utils.book_append_sheet(workbook, construirPlanilhaProdutividade(state, filtroTipoCarga), 'Produtividade');

  const dataArquivo = hojeISO();
  const nomeArquivo = `relatorios-doca-manager-${dataArquivo}.xlsx`;

  // Ambiente Artifact (claude.ai): pede a capability de downloads e entrega
  // o arquivo por ela, se disponível nessa visualização.
  if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
    try {
      const downloads = await window.claude.use('downloads');
      if (downloads) {
        const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([arrayBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        await downloads.save({ filename: nomeArquivo, data: blob });
        return;
      }
    } catch (erro) {
      // 'declined' (usuário cancelou o diálogo) não é uma falha real — só
      // não faz nada. Qualquer outro erro cai pro download direto abaixo,
      // que ainda funciona nos ambientes fora do Artifact.
      if (erro?.code === 'declined') return;
    }
  }

  // Site comum (zip hospedado) ou ambiente local: download direto via blob.
  XLSX.writeFile(workbook, nomeArquivo);
}
