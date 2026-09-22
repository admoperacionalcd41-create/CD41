import { gerarId } from './idGenerator';

// ---------------------------------------------------------------------------
// Reconhece dois formatos de planilha colada:
//
//  1) Formato real do sistema de origem:
//     S.D | P | DATA | DIA | CARGA | DEP | DESTINO | PESO | VOLUME | USUARIO
//     (S.D e P não carregam informação usada aqui e são ignoradas). DESTINO
//     chega como "código - nome" (ex: "0501 - Loja Centro") ou grudado, sem
//     separador, no formato "CIDADE LOJA32" (ex: "CARUARU LOJA32").
//
//  2) Formato simplificado (compatibilidade): Carga | Loja | Nome da Loja | Paletes | Região
//
// O parser detecta automaticamente qual formato foi colado, pelo cabeçalho.
// A quantidade de paletes NÃO vem da planilha real (Peso/Volume são medidas
// físicas, não contagem de paletes) — ela é definida manualmente na tela de
// Agrupamento, com base na conferência física da carga.
// ---------------------------------------------------------------------------

const HEADER_ALIASES = {
  data: ['data', 'dt', 'data emissao', 'data carga', 'data geracao'],
  dataHora: ['data novamente', 'dia', 'hora', 'horario', 'hora emissao', 'hora geracao'],
  carga: ['carga', 'cod carga', 'codigo carga', 'codigo da carga', 'n carga', 'numero carga', 'nº carga'],
  deposito: ['deposito', 'depósito', 'dep', 'cd', 'origem', 'centro de distribuicao'],
  destino: ['destino', 'loja destino', 'loja/destino'],
  peso: ['peso', 'peso kg', 'peso (kg)', 'peso bruto'],
  volume: ['volume', 'vol', 'volume m3', 'volume (m3)', 'cubagem'],
  usuarioGeracao: ['usuario', 'usuário', 'usuario que gerou', 'usuário que gerou', 'gerado por', 'operador', 'usuario gerador'],
  // Compatibilidade com o formato simplificado (opcional):
  loja: ['loja', 'cod loja', 'codigo loja', 'codigo da loja', 'n loja', 'numero loja', 'nº loja'],
  nomeLoja: ['nome loja', 'nome da loja', 'fantasia', 'nome fantasia', 'nome'],
  paletes: ['paletes', 'qtd paletes', 'quantidade de paletes', 'qtd', 'quantidade', 'pallets'],
  regiao: ['regiao', 'região', 'praca', 'praça', 'rota', 'area', 'área'],
};

// Colunas do sistema de origem que existem na exportação mas não carregam
// informação útil para o agrupamento (ex.: "S.D", "P") — ignoradas de
// propósito, sem gerar erro.

function normalizar(texto) {
  return String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectarSeparador(linha) {
  const contagens = {
    '\t': (linha.match(/\t/g) || []).length,
    ';': (linha.match(/;/g) || []).length,
    ',': (linha.match(/,/g) || []).length,
  };
  const vencedor = Object.entries(contagens).sort((a, b) => b[1] - a[1])[0];
  return vencedor && vencedor[1] > 0 ? vencedor[0] : '\t';
}

/**
 * Mapeamento posicional (por índice de coluna) usado quando a linha de
 * cabeçalho não é colada — a importação passa a funcionar mesmo sem o
 * título das colunas, desde que a ordem siga um dos layouts conhecidos:
 *
 *  - 10 colunas: S.D, P, DATA, DIA, CARGA, DEP, DESTINO, PESO, VOLUME, USUARIO
 *  -  8 colunas: DATA, DIA, CARGA, DEP, DESTINO, PESO, VOLUME, USUARIO
 *    (mesmo formato real, sem as colunas S.D/P que não carregam informação)
 *  -  5 colunas: Carga, Loja, Nome da Loja, Paletes, Região (formato simplificado)
 *  -  4 colunas: Carga, Loja, Nome da Loja, Paletes (formato simplificado, sem região)
 */
function mapaPosicionalPadrao(numColunas) {
  if (numColunas >= 10) {
    return { data: 2, dataHora: 3, carga: 4, deposito: 5, destino: 6, peso: 7, volume: 8, usuarioGeracao: 9 };
  }
  if (numColunas === 8 || numColunas === 9) {
    return { data: 0, dataHora: 1, carga: 2, deposito: 3, destino: 4, peso: 5, volume: 6, usuarioGeracao: 7 };
  }
  if (numColunas === 5) {
    return { carga: 0, loja: 1, nomeLoja: 2, paletes: 3, regiao: 4 };
  }
  if (numColunas === 4) {
    return { carga: 0, loja: 1, nomeLoja: 2, paletes: 3 };
  }
  return null;
}

function mapearCabecalho(colunas) {
  const mapa = {};
  const indicesGenericoData = [];

  colunas.forEach((coluna, indice) => {
    const norm = normalizar(coluna);
    for (const [campo, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapa[campo] !== undefined) continue;
      if (aliases.some((a) => normalizar(a) === norm)) {
        mapa[campo] = indice;
      }
    }
    if (norm === 'data') indicesGenericoData.push(indice);
  });

  // Muitos sistemas exportam duas colunas chamadas apenas "Data" (uma para a
  // data e outra para a hora do mesmo evento). Nesse caso a 2ª coluna "Data"
  // não bate com nenhum alias específico de hora — tratamos a 2ª ocorrência
  // genérica como a coluna de hora, se nenhuma outra já tiver sido detectada.
  if (mapa.dataHora === undefined && indicesGenericoData.length >= 2) {
    mapa.data = indicesGenericoData[0];
    mapa.dataHora = indicesGenericoData[1];
  }

  return mapa;
}

/**
 * Extrai código e nome de um "Destino" colado. Reconhece três formatos:
 *  - "0501 - Loja Centro"     → código "0501", nome "Loja Centro"
 *  - "CARUARU LOJA32"         → código "LOJA32", nome "CARUARU" (cidade +
 *    identificador de loja grudados, sem separador — formato comum de
 *    exportação de destino de carga)
 *  - texto livre, sem nenhum dos padrões acima → gera um código interno.
 */
function parseDestino(texto, indiceFallback) {
  const bruto = String(texto ?? '').trim();
  if (!bruto) return { codigo: null, nome: null };

  const comSeparador = bruto.match(/^([A-Za0-9._/-]{2,})\s*[-–—:]\s*(.+)$/);
  if (comSeparador) {
    return { codigo: comSeparador[1].trim(), nome: comSeparador[2].trim() };
  }

  const comLoja = bruto.match(/^(.*?)\s*(loja\s*\d+[a-z]?)\s*$/i);
  if (comLoja) {
    const cidade = comLoja[1].trim();
    const codigoLoja = comLoja[2].replace(/\s+/g, '').toUpperCase();
    return { codigo: codigoLoja, nome: cidade || codigoLoja };
  }

  const pareceCodigo = /^\d+$/.test(bruto);
  return {
    codigo: pareceCodigo ? bruto : `AUTO-${String(indiceFallback + 1).padStart(3, '0')}`,
    nome: pareceCodigo ? null : bruto,
  };
}

/**
 * Converte números em formato brasileiro. Aceita "1.234,56" (milhar +
 * decimal), "16,722" (vírgula decimal) e "6.161" — quando o ponto separa
 * grupos de exatamente 3 dígitos e não há vírgula, é tratado como milhar
 * (ex.: peso "6.161" = 6161), não como casa decimal.
 */
function parseNumeroBR(valor) {
  if (valor === undefined || valor === null) return null;
  let s = String(valor).trim().replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');

  if (temVirgula && temPonto) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  } else if (temPonto) {
    const partes = s.split('.');
    const pareceMilhar = partes.length >= 2 && partes.slice(1).every((p) => p.length === 3);
    if (pareceMilhar) s = partes.join('');
  }

  const num = parseFloat(s);
  return Number.isNaN(num) ? null : num;
}

function parseDataBR(str) {
  const s = String(str ?? '').trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return { ano: Number(y), mes: Number(mo), dia: Number(d) };
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return { ano: Number(y), mes: Number(mo), dia: Number(d) };
  }
  return null;
}

/** Extrai um horário "HH:mm[:ss]" de qualquer ponto da string (não apenas
 * no início) — cobre tanto uma coluna só de hora quanto uma coluna de
 * data/hora completa (ex.: "16/09/2026 08:01"). */
function parseHora(str) {
  const s = String(str ?? '').trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, h, mi, se] = m;
  return { h: Number(h), mi: Number(mi), se: se ? Number(se) : 0 };
}

/**
 * Combina as duas colunas de data ("DATA" + "data novamente") em um único
 * timestamp ISO. Aceita tanto o caso "data + hora" quanto duas datas
 * completas (usa a segunda coluna como mais confiável nesse caso).
 */
function combinarDataHora(col1, col2) {
  const data1 = parseDataBR(col1);
  const hora2 = parseHora(col2);
  if (data1 && hora2) {
    const dt = new Date(data1.ano, data1.mes - 1, data1.dia, hora2.h, hora2.mi, hora2.se);
    if (!Number.isNaN(dt.getTime())) return { iso: dt.toISOString(), bruto: null };
  }
  const tentativaCol2 = new Date(String(col2 ?? '').replace(' ', 'T'));
  if (col2 && !Number.isNaN(tentativaCol2.getTime())) return { iso: tentativaCol2.toISOString(), bruto: null };

  const tentativaCol1 = new Date(String(col1 ?? '').replace(' ', 'T'));
  if (col1 && !Number.isNaN(tentativaCol1.getTime())) return { iso: tentativaCol1.toISOString(), bruto: null };

  const bruto = [col1, col2].filter(Boolean).join(' ').trim();
  return { iso: null, bruto: bruto || null };
}

/**
 * Interpreta um bloco de texto colado (TAB, ponto-e-vírgula ou vírgula)
 * contendo cargas/lojas do dia, no formato real de exportação do sistema
 * de origem ou no formato simplificado de compatibilidade.
 *
 * Retorna { sucesso, registros, erros, totalLinhas, formatoDetectado }.
 */
export function parseDadosColados(texto) {
  // Importante: NÃO usar .trim() na linha inteira aqui — colunas vazias nas
  // pontas (ex.: "S.D" e "P" em branco, no início da linha) são feitas de
  // separadores consecutivos, e trim() apagaria esses separadores junto com
  // o espaço em branco, desalinhando todas as colunas seguintes. Cada célula
  // já é individualmente "trimada" depois do split, mais abaixo.
  const linhas = String(texto ?? '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (linhas.length === 0) {
    return { sucesso: false, erro: 'Nenhum dado encontrado para importar.', registros: [], erros: [] };
  }

  const separador = detectarSeparador(linhas[0]);
  const linhasColunas = linhas.map((l) => l.split(separador).map((c) => c.trim()));

  let mapa = mapearCabecalho(linhasColunas[0]);
  const temCabecalho = Object.keys(mapa).length >= 2;

  // A linha de título é opcional: se a primeira linha não for reconhecida
  // como cabeçalho, assumimos que TODAS as linhas já são dados, na ordem
  // posicional de um dos layouts conhecidos (pelo número de colunas).
  let dados;
  let linhaInicial;
  if (temCabecalho) {
    dados = linhasColunas.slice(1);
    linhaInicial = 2;
  } else {
    const numColunas = linhasColunas[0].length;
    const mapaPosicional = mapaPosicionalPadrao(numColunas);
    if (!mapaPosicional) {
      return {
        sucesso: false,
        erro:
          `Não foi possível reconhecer as colunas coladas (${numColunas} coluna(s) encontrada(s)). ` +
          'Cole os dados com a linha de título, ou sem título desde que sigam um dos layouts conhecidos: ' +
          'DATA, DIA, CARGA, DEP, DESTINO, PESO, VOLUME, USUARIO (com ou sem as colunas iniciais S.D/P) ' +
          'ou Carga, Loja, Nome da Loja, Paletes, Região.',
        registros: [],
        erros: [],
      };
    }
    mapa = mapaPosicional;
    dados = linhasColunas;
    linhaInicial = 1;
  }

  const formatoReal = mapa.destino !== undefined;

  const registros = [];
  const erros = [];

  dados.forEach((colunas, indice) => {
    const numeroLinha = indice + linhaInicial;
    const carga = mapa.carga !== undefined ? colunas[mapa.carga] : '';

    if (colunas.every((c) => !c)) return; // linha em branco, ignora silenciosamente

    let lojaCodigo = '';
    let nomeLoja = '';

    if (formatoReal) {
      const destino = parseDestino(colunas[mapa.destino], indice);
      lojaCodigo = destino.codigo || `AUTO-${String(indice + 1).padStart(3, '0')}`;
      nomeLoja = destino.nome || `Loja ${lojaCodigo}`;
    } else {
      lojaCodigo = mapa.loja !== undefined ? colunas[mapa.loja] : '';
      nomeLoja = mapa.nomeLoja !== undefined ? colunas[mapa.nomeLoja] : '';
    }

    if (!carga || !lojaCodigo) {
      erros.push(`Linha ${numeroLinha}: Carga e/ou Destino/Loja não identificados.`);
      return;
    }

    const deposito = mapa.deposito !== undefined ? colunas[mapa.deposito] : '';
    const peso = mapa.peso !== undefined ? parseNumeroBR(colunas[mapa.peso]) : null;
    const volume = mapa.volume !== undefined ? parseNumeroBR(colunas[mapa.volume]) : null;
    const usuarioGeracao = mapa.usuarioGeracao !== undefined ? colunas[mapa.usuarioGeracao] : '';
    const regiao = mapa.regiao !== undefined ? colunas[mapa.regiao] : '';
    const paletesInformados = mapa.paletes !== undefined ? parseNumeroBR(colunas[mapa.paletes]) : null;

    let dataGeracaoISO = null;
    let dataGeracaoBruta = null;
    if (mapa.data !== undefined || mapa.dataHora !== undefined) {
      const combinado = combinarDataHora(
        mapa.data !== undefined ? colunas[mapa.data] : '',
        mapa.dataHora !== undefined ? colunas[mapa.dataHora] : ''
      );
      dataGeracaoISO = combinado.iso;
      dataGeracaoBruta = combinado.bruto;
    }

    registros.push({
      id: gerarId('loja'),
      carga: carga.toUpperCase(),
      loja: lojaCodigo.toUpperCase(),
      nomeLoja: nomeLoja || `Loja ${lojaCodigo}`,
      regiao: regiao || '',
      deposito: deposito || '',
      peso: peso ?? null,
      volume: volume ?? null,
      usuarioGeracao: usuarioGeracao || '',
      dataGeracaoISO,
      dataGeracaoBruta,
      // A quantidade de paletes é definida manualmente no Agrupamento; se a
      // planilha colada (formato simplificado) já trouxer uma coluna de
      // paletes, usamos como estimativa inicial.
      paletesPlanejados: paletesInformados && paletesInformados > 0 ? paletesInformados : 0,
      paletesAgrupados: 0,
      paletesNoAgrupamento: 0,
      status: 'pendente',
      boxNumero: null,
      vagasOcupadas: [],
      colaboradores: [],
      protocolos: [],
      dataImportacao: new Date().toISOString(),
      dataApontamento: null,
      dataConferencia: null,
      dataInicioAgrupamento: null,
      dataAgrupamento: null,
      dataCarregamento: null,
      diaReferencia: null, // preenchido pelo reducer com o "dia atual" do sistema
      // Definido pela tela de Importação (seletor Seca/Resfriada, aplicado a
      // todo o lote colado); 'seca' aqui é só um valor de segurança caso o
      // registro chegue sem passar por lá.
      tipoCarga: 'seca',
    });
  });

  return {
    sucesso: registros.length > 0,
    registros,
    erros,
    totalLinhas: dados.length,
    temCabecalho,
    formatoDetectado:
      (formatoReal ? 'sistema de origem (Destino, Peso, Volume...)' : 'simplificado (Loja, Paletes...)') +
      (temCabecalho ? '' : ' — sem linha de título, colunas identificadas pela posição'),
  };
}

export const MODELO_EXEMPLO =
  'S.D\tP\tDATA\tDIA\tCARGA\tDEP\tDESTINO\tPESO\tVOLUME\tUSUARIO\n' +
  '\t\t16/09/2026 08:01\t16/09/2026 08:01\t96374\t1\tCARUARU LOJA32\t6.161\t16,722\tEDVALDOBDJ\n' +
  '\t\t16/09/2026 08:01\t16/09/2026 08:01\t96375\t1\tCARUARU LOJA46\t2.363\t9,927\tEDVALDOBDJ\n' +
  '\t\t16/09/2026 08:02\t16/09/2026 08:02\t96376\t1\tCARUARU LOJA01\t2.854\t10,626\tEDVALDOBDJ';
