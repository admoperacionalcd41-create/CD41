// Prova que aplicarPatchesEstado (JS, no aparelho) chega exatamente no
// mesmo documento que app_state_aplicar_patches (SQL, no banco) para patches
// aleatórios gerados por calcularPatchesEstado. Se divergir, cada aparelho
// ficaria com um documento diferente do banco.
//
// Uso (de dentro desta pasta, com `npm i pg`): node --import ./loader.mjs equivalencia.mjs [iteracoes] [seed]
import pg from 'pg';
import { calcularPatchesEstado } from '../../src/utils/calcularPatchesEstado.js';
import { aplicarPatchesEstado } from '../../src/utils/aplicarPatchesEstado.js';

const ITER = Number(process.argv[2] || 300);
let seed = Number(process.argv[3] || 7);
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (n) => Math.floor(rnd() * n);

const pool = new pg.Pool({
  host: process.env.PGHOST || '127.0.0.1', user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres', database: process.env.PGDATABASE || 'doca_sim', max: 2,
});

const canon = (v) => JSON.stringify(v, (_k, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x);

const valorAleatorio = () => pick([null, 'a', 'b', 'x' + int(5), int(100), true, false, { k: int(3) }, [int(3), 'z'], '']);

function estadoInicial() {
  return {
    lojas: Array.from({ length: 4 }, (_, i) => ({ id: String(400 + i), loja: String(400 + i), status: 'pendente', n: i })),
    protocolos: [{ id: 'P1', dono: 'a', lojaId: '400' }],
    boxes: [1, 2, 3].map((numero) => ({ numero, nome: `Box ${numero}`, vagas: [1, 2, 3].map((n) => ({ numero: n, ocupante: null })) })),
    placasCadastradas: [{ placa: 'AAA1A11', possuiPlataforma: false }],
    contatosNotificacao: [{ telefone: '1199', nome: 'x' }],
    localizacaoLojas: [{ codigo: 10, texto: 't' }, { codigo: '11', texto: 'u' }],
    colaboradoresCadastrados: ['ana', 'bia'],
    motoristasCadastrados: ['zé'],
    observacoesLoja: { 400: 'obs' },
    diaAtual: '2026-10-28',
    valorPaletesAgrupamento: 0.58,
    sequenciaLojas: ['400', '401'],
  };
}

function mutar(e) {
  const s = JSON.parse(JSON.stringify(e));
  const n = 1 + int(4);
  for (let k = 0; k < n; k += 1) {
    switch (int(14)) {
      case 0: pick(s.lojas) && (pick(s.lojas)[`c${int(4)}`] = valorAleatorio()); break;
      case 1: { const l = pick(s.lojas); if (l) delete l[pick(Object.keys(l).filter((x) => x !== 'id'))]; break; }
      case 2: s.lojas.push({ id: 'N' + int(50), nova: valorAleatorio() }); break;
      case 3: s.lojas.splice(int(s.lojas.length), 1); break;
      case 4: s.protocolos.push({ id: 'P' + int(50), dono: valorAleatorio() }); break;
      case 5: { const p = pick(s.protocolos); if (p) p.entrega = valorAleatorio(); break; }
      case 6: { const b = pick(s.boxes); const v = pick(b.vagas); v.ocupante = valorAleatorio(); break; }
      case 7: { const b = pick(s.boxes); b.vagas.push({ numero: 4 + int(3), ocupante: valorAleatorio() }); break; }
      case 8: s.colaboradoresCadastrados = pick([[...s.colaboradoresCadastrados, 'n' + int(5)], s.colaboradoresCadastrados.slice(1)]); break;
      case 9: s.observacoesLoja = pick([{ ...s.observacoesLoja, [int(6)]: valorAleatorio() }, Object.fromEntries(Object.entries(s.observacoesLoja).slice(1))]); break;
      case 10: s.diaAtual = pick(['2026-10-29', '2026-10-30', null]); break;
      case 11: s.sequenciaLojas = pick([[], ['401', '400'], ['402'], null]); break;
      case 12: s.localizacaoLojas = pick([[...s.localizacaoLojas, { codigo: 12 + int(3), texto: 'v' }], s.localizacaoLojas.slice(1)]); break;
      default: s.placasCadastradas = pick([[...s.placasCadastradas, { placa: 'B' + int(9), possuiPlataforma: true }], []]);
    }
  }
  return s;
}

let divergencias = 0;
let totalPatches = 0;
const ops = new Set();
let estado = estadoInicial();
await pool.query('delete from public.app_state');
await pool.query("select * from public.app_state_gravar_completo($1::jsonb, null)", [JSON.stringify(estado)]);

for (let i = 0; i < ITER; i += 1) {
  const proximo = mutar(estado);
  const patches = calcularPatchesEstado(estado, proximo, { granularidadeCampo: rnd() < 0.8 });
  if (!patches || patches.length === 0) continue;
  patches.forEach((p) => ops.add(p.op));
  totalPatches += patches.length;
  const viaRede = JSON.parse(JSON.stringify(patches));
  const { rows } = await pool.query('select * from public.app_state_aplicar_patches($1::jsonb, null)', [JSON.stringify(patches)]);
  const noBanco = rows[0].dados;
  const noCliente = aplicarPatchesEstado(estado, viaRede);
  if (canon(noBanco) !== canon(noCliente)) {
    divergencias += 1;
    if (divergencias <= 3) console.error('DIVERGIU', JSON.stringify(patches).slice(0, 400), '\nSQL :', canon(noBanco).slice(0, 600), '\nJS  :', canon(noCliente).slice(0, 600));
  }
  estado = noBanco; // segue a partir do que o banco tem
}
console.log(JSON.stringify({ iteracoes: ITER, patchesComparados: totalPatches, opsVistas: [...ops].sort(), divergencias }));
await pool.end();
process.exit(divergencias === 0 ? 0 : 1);
