// Abrir o app pelo cache do navegador: confere que NÃO baixa o documento
// inteiro quando o cache serve, e que cai na carga completa quando não serve.
// Servidor de mentira em memória (versão + diário), sem banco.
import { criarMotorSincronizacao } from '../../src/sync/motorSincronizacao.js';
import { calcularPatchesEstado } from '../../src/utils/calcularPatchesEstado.js';
import { iniciarComSnapshot, lerSnapshot, salvarSnapshot, criarGravadorDeSnapshot, CHAVE_SNAPSHOT } from '../../src/sync/inicioComCache.js';

const assert = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } console.log('OK:', m); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function armazenamentoFake(limite = Infinity) {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (v.length > limite) throw new Error('QuotaExceeded'); m.set(k, v); }, removeItem: (k) => m.delete(k), _m: m };
}

// servidor: estado v0 + diário de patches
function criarServidor() {
  let versao = 10;
  let dados = { lojas: [{ id: 'a', status: 'x' }], boxes: [], diaAtual: '2026-11-10', enchimento: 'e'.repeat(2000) };
  const log = [];
  const chamadas = { lerEstado: 0, lerVersao: 0, lerLog: 0 };
  return {
    chamadas,
    get versao() { return versao; },
    get dados() { return dados; },
    gravar(status) { // uma gravação de outro usuário (patches no formato real do app)
      const depois = { ...dados, lojas: [{ id: 'a', status }] };
      const patches = calcularPatchesEstado(dados, depois, { granularidadeCampo: true });
      versao += 1;
      dados = depois;
      log.push({ versao, patches, completo: false });
    },
    zerar() { versao = 3; dados = { ...dados, lojas: [{ id: 'a', status: 'novo' }] }; log.length = 0; },
    podarDiario() { log.length = 0; },
    transporte() {
      return {
        aplicarPatches: async () => ({ data: null, error: { message: 'não usado' } }),
        gravarCompleto: async () => ({ data: null, error: { message: 'não usado' } }),
        lerEstado: async () => { chamadas.lerEstado += 1; return { data: { versao, dados: clone(dados) }, error: null }; },
        lerVersao: async () => { chamadas.lerVersao += 1; return { data: versao, error: null }; },
        lerLogDesde: async (v) => { chamadas.lerLog += 1; return { data: clone(log.filter((l) => l.versao > v)), error: null }; },
      };
    },
  };
}

async function abrir(srv, storage, { normal = (d) => d } = {}) {
  const gravador = criarGravadorDeSnapshot(storage, 0);
  let estado = null;
  const motor = criarMotorSincronizacao({
    transporte: srv.transporte(),
    estadoInicial: { lojas: [], boxes: [] },
    aoMudarEstado: (e) => { estado = e; },
    aoMudarBase: (v, d) => gravador.agendar(v, d),
  });
  const snapshot = lerSnapshot(storage);
  const iniciou = await iniciarComSnapshot({
    snapshot, motor,
    lerVersaoServidor: async () => (await srv.transporte().lerVersao()).data,
  });
  if (!iniciou) {
    const { data } = await srv.transporte().lerEstado();
    motor.carregarInicial({ versao: data.versao, dados: data.dados });
  }
  await esperar(30); gravador.forcar();
  return { motor, iniciou, estado: () => estado };
}

// --- cenário 1: primeira abertura (sem cache) = carga completa, e grava o cache
{
  const srv = criarServidor(); const st = armazenamentoFake();
  const a = await abrir(srv, st);
  assert(a.iniciou === false, '1ª abertura (sem cache): carga completa');
  assert(srv.chamadas.lerEstado === 1, 'baixou o documento 1 vez');
  const snap = lerSnapshot(st);
  assert(snap && snap.versao === 10, 'cache gravado com a versão 10');
}

// --- cenário 2: cache em dia → não baixa o documento
{
  const srv = criarServidor(); const st = armazenamentoFake();
  await abrir(srv, st);
  srv.chamadas.lerEstado = 0;
  const b = await abrir(srv, st);
  assert(b.iniciou === true, '2ª abertura: iniciou pelo cache');
  assert(srv.chamadas.lerEstado === 0, 'NÃO baixou o documento inteiro');
  assert(b.estado().lojas[0].status === 'x', 'tela mostra o estado do cache');
}

// --- cenário 3: cache atrasado, diário cobre → aplica só o que mudou
{
  const srv = criarServidor(); const st = armazenamentoFake();
  await abrir(srv, st);
  // dois usuários mexem enquanto o aparelho estava fechado (usa o formato real de patches)
  srv.gravar('p1'); srv.gravar('p2');
  srv.chamadas.lerEstado = 0; srv.chamadas.lerLog = 0;
  const c = await abrir(srv, st);
  assert(c.iniciou === true, 'cache atrasado (v10 → v12): iniciou pelo cache');
  assert(srv.chamadas.lerEstado === 0, 'diário cobre: não baixou o documento');
  assert(srv.chamadas.lerLog >= 1, 'buscou só as linhas novas do diário');
  assert(c.estado().lojas[0].status === 'p2', 'tela ficou igual ao servidor (p2)');
  assert(lerSnapshot(st).versao === 12, 'cache atualizado para v12');
}

// --- cenário 4: diário não cobre (podado) → cai no documento inteiro, mas fica correto
{
  const srv = criarServidor(); const st = armazenamentoFake();
  await abrir(srv, st);
  srv.gravar('q1'); srv.gravar('q2'); srv.podarDiario();
  srv.chamadas.lerEstado = 0;
  const d = await abrir(srv, st);
  assert(d.iniciou === true, 'diário podado: ainda inicia pelo cache');
  assert(srv.chamadas.lerEstado === 1, 'diário não cobre: relê o documento (1x), como antes');
  assert(d.estado().lojas[0].status === 'q2', 'tela igual ao servidor');
}

// --- cenário 5: servidor ATRÁS do cache (banco restaurado) → ignora o cache
{
  const srv = criarServidor(); const st = armazenamentoFake();
  await abrir(srv, st);
  srv.zerar();
  srv.chamadas.lerEstado = 0;
  const e = await abrir(srv, st);
  assert(e.iniciou === false, 'servidor com versão menor que o cache: cache descartado');
  assert(srv.chamadas.lerEstado === 1, 'fez a carga completa');
  assert(e.estado().lojas[0].status === 'novo', 'tela mostra o estado do servidor, não o cache velho');
}

// --- cenário 6: cache corrompido / inválido
{
  const srv = criarServidor(); const st = armazenamentoFake();
  st.setItem(CHAVE_SNAPSHOT, '{lixo');
  assert(lerSnapshot(st) === null, 'JSON corrompido → sem cache');
  st.setItem(CHAVE_SNAPSHOT, JSON.stringify({ versao: 'x', dados: {} }));
  assert(lerSnapshot(st) === null, 'versão inválida → sem cache');
  const f = await abrir(srv, st);
  assert(f.iniciou === false && srv.chamadas.lerEstado === 1, 'cai na carga completa');
}

// --- cenário 7: armazenamento cheio não quebra nada
{
  const st = armazenamentoFake(100);
  assert(salvarSnapshot(st, 5, { x: 'y'.repeat(500) }) === false, 'cota cheia: salvarSnapshot devolve false sem lançar');
  assert(lerSnapshot(st) === null, 'e não deixa lixo salvo');
}

// --- cenário 8: erro ao ler a versão → carga completa
{
  const st = armazenamentoFake(); salvarSnapshot(st, 10, { lojas: [] });
  const motor = { carregarInicial() { throw new Error('não deveria'); }, atualizarDoServidor() {} };
  const ok = await iniciarComSnapshot({ snapshot: lerSnapshot(st), motor, lerVersaoServidor: async () => { throw new Error('rede'); } });
  assert(ok === false, 'falha de rede ao conferir a versão → carga completa');
  const ok2 = await iniciarComSnapshot({ snapshot: lerSnapshot(st), motor, lerVersaoServidor: async () => null });
  assert(ok2 === false, 'versão nula → carga completa');
}

// --- gravador: agrupa gravações
{
  const st = armazenamentoFake(); let escritas = 0; const orig = st.setItem; st.setItem = (k, v) => { escritas += 1; orig(k, v); };
  const g = criarGravadorDeSnapshot(st, 50);
  for (let i = 1; i <= 20; i++) g.agendar(i, { i });
  await esperar(120);
  assert(escritas === 1 && lerSnapshot(st).versao === 20, '20 mudanças seguidas = 1 escrita, com a versão mais nova');
}
console.log('✅ OK');
