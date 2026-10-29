// Simulação de vários usuários usando o app ao mesmo tempo contra o
// Postgres REAL (mesmas funções SQL de produção, de supabase/schema.sql),
// com latência de rede e entrega do Realtime aleatórias.
//
// Cada usuário só mexe em campos que são "dele" (ex.: loja.f_c2, vaga 2
// de cada box), mas nos MESMOS registros dos outros (mesmas lojas, mesmos
// boxes, protocolos compartilhados) — que é a situação real do armazém:
// faturamento, box e motoristas mexendo em pedaços diferentes das mesmas
// cargas. Então NENHUMA ação deveria se perder: no fim, o banco precisa
// ter o último valor que cada usuário gravou em cada campo dele.
//
// Uso (de dentro desta pasta, com `npm i pg` feito antes):
//   node --import ./loader.mjs simular.mjs novo [seed] [usuarios] [acoes]
// Pré-requisito: um Postgres com supabase/schema.sql carregado (ver README.md).
import pg from 'pg';
// Variáveis: PGHOST (padrão 127.0.0.1), PGUSER/PGPASSWORD (padrão postgres/postgres), PGDATABASE (padrão doca_sim).

const [, , nomeMotor = 'novo', seedArg = '1', usuariosArg = '5', acoesArg = '30'] = process.argv;
// MODO=misto: metade dos aparelhos com o app NOVO e metade com o ANTIGO ao mesmo tempo
// (como numa publicação gradual: o app antigo segue aberto em alguns celulares).
// MODO=leve (padrão): protocolo novo — gravação devolve só a versão e o
// Realtime entrega o diário (patches). MODO=legado: protocolo antigo (documento
// inteiro em toda resposta e em todo evento), só pra comparar o egress.
// PERDA_EVENTOS=0.05: probabilidade de um evento do Realtime nunca chegar a um
// aparelho (testa a recuperação pelo diário / releitura).
const MODO = process.env.MODO || 'leve';
const PERDA_EVENTOS = Number(process.env.PERDA_EVENTOS || 0);
// PAD_KB=300: engorda o documento (simula o tamanho real, ~300 kB) pra medir o egress.
const PAD_KB = Number(process.env.PAD_KB || 0);
const SEED = Number(seedArg);
const N_USUARIOS = Number(usuariosArg);
const N_ACOES = Number(acoesArg);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const entre = (a, b) => Math.floor(a + rnd() * (b - a));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const pool = new pg.Pool({
  host: process.env.PGHOST || '127.0.0.1',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'doca_sim',
  max: 20,
});

const LOJAS = ['0401', '0402', '0403', '0404', '0405', '0406'];
const BOXES = [1, 2, 3];

function estadoInicial() {
  return {
    lojas: LOJAS.map((id) => ({ id, loja: id, status: 'pendente', ...(PAD_KB ? { enchimento: 'x'.repeat(Math.round((PAD_KB * 1024) / LOJAS.length)) } : {}) })),
    protocolos: [],
    boxes: BOXES.map((numero) => ({
      numero,
      nome: `Box ${numero}`,
      vagas: Array.from({ length: N_USUARIOS }, (_, i) => ({ numero: i + 1, ocupante: null })),
    })),
    diaAtual: '2026-10-28',
    colaboradoresCadastrados: [],
    motoristasCadastrados: [],
    placasCadastradas: [],
    contatosNotificacao: [],
    localizacaoLojas: [],
    observacoesLoja: {},
    sequenciaLojas: [],
    valorPaletesAgrupamento: 0.58,
  };
}

// --- "reducer" da simulação: ações puras, como as do AppContext ---------
const setCampoLoja = (id, campo, valor) => (s) => ({
  ...s,
  lojas: s.lojas.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)),
});
const setVaga = (box, vaga, valor) => (s) => ({
  ...s,
  boxes: s.boxes.map((b) =>
    b.numero === box ? { ...b, vagas: b.vagas.map((v) => (v.numero === vaga ? { ...v, ocupante: valor } : v)) } : b
  ),
});
const addProtocolo = (id, valor) => (s) => ({ ...s, protocolos: [...s.protocolos, { id, criadoPor: valor }] });
const setCampoProtocolo = (id, campo, valor) => (s) => ({
  ...s,
  protocolos: s.protocolos.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)),
});
const compor = (...fns) => (s) => fns.reduce((acc, f) => f(acc), s);

// --- transporte + "Realtime" ---------------------------------------------
let requisicoesEmAndamento = 0;
let entregasPendentes = 0;
const clientes = [];
const bufferBroadcast = new Map();
let proximaVersaoBroadcast = null;
const bytes = { respostas: 0, eventos: 0, leituras: 0, eventosEntregues: 0 };
const tam = (v) => Buffer.byteLength(JSON.stringify(v ?? null));

function publicarCommit(row) {
  bufferBroadcast.set(row.versao, row);
  while (bufferBroadcast.has(proximaVersaoBroadcast)) {
    const r = bufferBroadcast.get(proximaVersaoBroadcast);
    bufferBroadcast.delete(proximaVersaoBroadcast);
    proximaVersaoBroadcast += 1;
    clientes.forEach((c) => {
      if (c.leve && PERDA_EVENTOS > 0 && rnd() < PERDA_EVENTOS) return; // evento perdido (só nos aparelhos novos: os antigos se recuperam relendo o documento, o que o simulador não reproduz)
      entregasPendentes += 1;
      bytes.eventos += tam(c.leve ? { versao: r.versao, patches: r.patches, completo: r.completo } : { versao: r.versao, dados: r.dados });
      bytes.eventosEntregues += 1;
      c.filaRealtime = c.filaRealtime
        .then(() => esperar(entre(20, 500)))
        .then(() => {
          const copia = JSON.parse(JSON.stringify(r));
          if (c.leve) c.motor.receberLog({ versao: copia.versao, patches: copia.patches, completo: copia.completo });
          else c.motor.receberRemoto({ versao: copia.versao, dados: copia.dados });
          entregasPendentes -= 1;
        });
    });
  }
}

function criarTransporte(leve) {
  const chamar = async (sql, params) => {
    requisicoesEmAndamento += 1;
    try {
      await esperar(entre(30, 250)); // ida
      let resultado;
      try {
        const { rows } = await pool.query(sql, params);
        const row = rows[0];
        const versao = Number(typeof row.versao !== 'undefined' ? row.versao : Object.values(row)[0]);
        const { rows: log } = await pool.query('select patches, completo from public.app_state_log where versao = $1', [versao]);
        publicarCommit({ versao, dados: row.dados, patches: log[0]?.patches ?? null, completo: !!log[0]?.completo });
        if (leve) {
          resultado = { data: versao, error: null };
          bytes.respostas += tam(versao);
        } else {
          resultado = { data: [{ versao, dados: row.dados }], error: null };
          bytes.respostas += tam(resultado.data);
        }
      } catch (e) {
        resultado = { data: null, error: { message: e.message } };
      }
      await esperar(entre(30, 250)); // volta
      return resultado;
    } finally {
      requisicoesEmAndamento -= 1;
    }
  };
  // No modo misto o aparelho "leve" também chama a função antiga (pra o
  // simulador ter o documento e poder entregá-lo aos aparelhos antigos) e só
  // descarta o documento da resposta — o que importa é o que ELE recebe.
  const rpcPatches = MODO === 'leve' ? 'app_state_aplicar_patches_leve' : 'app_state_aplicar_patches';
  const transporte = {
    aplicarPatches: (patches) => chamar(`select * from public.${rpcPatches}($1::jsonb, null)`, [JSON.stringify(patches)]),
    gravarCompleto: (dados) => chamar('select * from public.app_state_gravar_completo($1::jsonb, null)', [JSON.stringify(dados)]),
    lerEstado: async () => {
      await esperar(entre(30, 250));
      const { rows } = await pool.query("select versao, dados from public.app_state where id='estado-v1'");
      await esperar(entre(30, 250));
      const data = rows[0] ? { versao: Number(rows[0].versao), dados: rows[0].dados } : null;
      bytes.leituras += tam(data);
      return { data, error: null };
    },
  };
  if (leve) {
    transporte.lerVersao = async () => {
      await esperar(entre(30, 250));
      const { rows } = await pool.query("select versao from public.app_state where id='estado-v1'");
      await esperar(entre(30, 250));
      bytes.leituras += tam(rows[0]);
      return { data: rows[0] ? Number(rows[0].versao) : null, error: null };
    };
    transporte.lerLogDesde = async (versao) => {
      await esperar(entre(30, 250));
      const { rows } = await pool.query('select versao, patches, completo from public.app_state_log where versao > $1 order by versao limit 300', [versao]);
      await esperar(entre(30, 250));
      bytes.leituras += tam(rows);
      return { data: rows.map((r) => ({ versao: Number(r.versao), patches: r.patches, completo: r.completo })), error: null };
    };
  }
  return transporte;
}

// --- execução --------------------------------------------------------------
async function main() {
  const modulo = await import('../../src/sync/motorSincronizacao.js');
  const criarMotor = modulo.criarMotor || modulo.criarMotorSincronizacao;

  await pool.query('delete from public.app_state_log');
  await pool.query('delete from public.app_state');
  const { rows } = await pool.query('select * from public.app_state_gravar_completo($1::jsonb, null)', [
    JSON.stringify(estadoInicial()),
  ]);
  proximaVersaoBroadcast = Number(rows[0].versao) + 1;
  await pool.query('delete from public.app_state_log');
  const linhaInicial = { versao: Number(rows[0].versao), dados: rows[0].dados };

  const esperado = new Map(); // chave do campo -> último valor que o "dono" gravou
  const errosAcao = [];

  for (let i = 0; i < N_USUARIOS; i += 1) {
    const leve = MODO === 'leve' || (MODO === 'misto' && i % 2 === 0);
    const motor = criarMotor({ transporte: criarTransporte(leve), estadoInicial: estadoInicial() });
    motor.carregarInicial(JSON.parse(JSON.stringify(linhaInicial)));
    clientes.push({ id: i + 1, leve, motor, filaRealtime: Promise.resolve() });
  }

  await Promise.all(
    clientes.map(async (c) => {
      const meusProtocolos = [];
      for (let k = 0; k < N_ACOES; k += 1) {
        await esperar(entre(50, 600));
        const token = `c${c.id}-a${k}`;
        const tipo = rnd();
        const loja = LOJAS[entre(0, LOJAS.length)];
        const box = BOXES[entre(0, BOXES.length)];
        try {
          if (tipo < 0.3) {
            c.motor.aplicarLocal(setCampoLoja(loja, `f_c${c.id}`, token));
            esperado.set(`loja:${loja}:f_c${c.id}`, token);
          } else if (tipo < 0.55) {
            // ação "de box": mexe na loja E numa vaga, igual MOVER_BOX/APONTAR_BOX
            c.motor.aplicarLocal(compor(setCampoLoja(loja, `box_c${c.id}`, token), setVaga(box, c.id, token)));
            esperado.set(`loja:${loja}:box_c${c.id}`, token);
            esperado.set(`vaga:${box}:${c.id}`, token);
          } else if (tipo < 0.75 || meusProtocolos.length === 0) {
            const id = `P-${token}`;
            c.motor.aplicarLocal(addProtocolo(id, token));
            meusProtocolos.push(id);
            esperado.set(`protocolo:${id}:criadoPor`, token);
          } else {
            const id = meusProtocolos[entre(0, meusProtocolos.length)];
            c.motor.aplicarLocal(setCampoProtocolo(id, `entrega`, token));
            esperado.set(`protocolo:${id}:entrega`, token);
          }
        } catch (e) {
          errosAcao.push(e.message);
        }
      }
    })
  );

  // espera tudo assentar (sem gravação pendente, sem requisição, sem Realtime em trânsito)
  let estavel = 0;
  for (let t = 0; t < 600 && estavel < 15; t += 1) {
    await esperar(100);
    const quieto =
      requisicoesEmAndamento === 0 && entregasPendentes === 0 && clientes.every((c) => c.motor.ocioso());
    estavel = quieto ? estavel + 1 : 0;
  }

  // Eventos perdidos só são notados na próxima mudança ou ao "voltar ao app":
  // simula esse "voltar ao app" em todos os aparelhos e espera assentar.
  if (MODO !== 'legado') {
    clientes.filter((c) => c.leve).forEach((c) => c.motor.atualizarDoServidor());
    estavel = 0;
    for (let t = 0; t < 600 && estavel < 15; t += 1) {
      await esperar(100);
      const quieto = requisicoesEmAndamento === 0 && entregasPendentes === 0 && clientes.every((c) => c.motor.ocioso());
      estavel = quieto ? estavel + 1 : 0;
    }
  }

  const { rows: finais } = await pool.query("select versao, dados from public.app_state where id='estado-v1'");
  const servidor = finais[0].dados;

  const ler = (dados, chave) => {
    const [tipo, a, b] = chave.split(':');
    if (tipo === 'loja') return dados.lojas.find((l) => l.id === a)?.[b];
    if (tipo === 'vaga') return dados.boxes.find((x) => x.numero === Number(a))?.vagas.find((v) => v.numero === Number(b))?.ocupante;
    if (tipo === 'protocolo') return dados.protocolos.find((p) => p.id === a)?.[b];
    return undefined;
  };

  const perdidas = [];
  esperado.forEach((valor, chave) => {
    const noServidor = ler(servidor, chave);
    if (noServidor !== valor) perdidas.push(`${chave}: esperado ${valor}, banco tem ${noServidor}`);
  });

  // Tela de cada usuário mostra o mesmo que o banco em cada campo verificado?
  let divergentes = 0;
  clientes.forEach((c) => {
    esperado.forEach((_v, chave) => {
      if (ler(c.motor.estadoLocal(), chave) !== ler(servidor, chave)) divergentes += 1;
    });
  });

  const canonico = (v) =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x
    );
  const docServidor = canonico(servidor);
  const documentosDiferentes = clientes.filter((c) => canonico(c.motor.estadoLocal()) !== docServidor).length;

  console.log(
    JSON.stringify({
      modo: MODO,
      perdaEventos: PERDA_EVENTOS,
      bytesKB: {
        respostas: Math.round(bytes.respostas / 1024),
        eventos: Math.round(bytes.eventos / 1024),
        leituras: Math.round(bytes.leituras / 1024),
        total: Math.round((bytes.respostas + bytes.eventos + bytes.leituras) / 1024),
      },
      documentosDiferentesDoBanco: documentosDiferentes,
      motor: nomeMotor,
      seed: SEED,
      versaoFinal: Number(finais[0].versao),
      camposVerificados: esperado.size,
      atualizacoesPerdidas: perdidas.length,
      telasDiferentesDoBanco: divergentes,
      exemplos: perdidas.slice(0, 4),
      errosAcao: errosAcao.length,
    })
  );
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
