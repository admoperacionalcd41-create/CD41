// Confere o "escudo" do SQL contra a cópia aninhada `lojas[].protocolos`
// (app antigo): ela é descartada dos patches de lojas, no banco E no diário,
// e o JS (aplicarPatchesEstado) chega ao mesmo documento.
// Uso: node --import ./loader.mjs escudo.mjs
import pg from 'pg';
import { aplicarPatchesEstado } from '../../src/utils/aplicarPatchesEstado.js';

const pool = new pg.Pool({ host: '127.0.0.1', user: 'postgres', password: 'postgres', database: process.env.PGDATABASE || 'doca_sim', max: 1 });
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
let falhas = 0;
const confere = (ok, msg) => { if (!ok) { falhas += 1; console.error('FALHOU:', msg); } else console.log('ok:', msg); };

const inicial = {
  lojas: [{ id: '400', status: 'pendente', protocolos: [{ id: 'P1', z: 1, a: 2 }] }, { id: '401', status: 'pendente' }],
  protocolos: [{ id: 'P1', lojaId: '400' }],
};
await pool.query("insert into public.app_state (id, dados, versao) values ('estado-v1', $1, 100) on conflict (id) do update set dados = excluded.dados, versao = 100", [inicial]);
await pool.query('delete from public.app_state_log');

const patches = [
  { op: 'mesclar_item', colecao: 'lojas', chave: 'id', valorChave: '400', campos: { protocolos: [{ id: 'P1', a: 9 }], status: 'carregando' } },
  { op: 'upsert_item', colecao: 'lojas', chave: 'id', valorChave: '402', item: { id: '402', status: 'nova', protocolos: [{ id: 'PX' }] } },
  { op: 'mesclar_item', colecao: 'protocolos', chave: 'id', valorChave: 'P1', campos: { protocolos: 'não é de loja' } },
];
const { rows } = await pool.query('select * from public.app_state_aplicar_patches($1::jsonb, null)', [JSON.stringify(patches)]);
const banco = (await pool.query("select dados from public.app_state where id='estado-v1'")).rows[0].dados;
const js = aplicarPatchesEstado(inicial, patches);

confere(banco.lojas[0].status === 'carregando', 'campo normal da loja foi aplicado');
confere(canon(banco.lojas[0].protocolos) === canon(inicial.lojas[0].protocolos), 'protocolos aninhados da loja NÃO foram alterados pelo patch');
confere(!('protocolos' in banco.lojas[2]), 'item novo de loja entra sem protocolos aninhados');
confere(banco.protocolos[0].protocolos === 'não é de loja', 'campo "protocolos" de OUTRA coleção continua valendo');
confere(canon(js) === canon(banco), 'JS e SQL chegam ao mesmo documento');
const log = (await pool.query('select patches from public.app_state_log order by versao desc limit 1')).rows[0].patches;
confere(!JSON.stringify(log.filter((p) => p.colecao === 'lojas')).includes('PX') && !('protocolos' in log[0].campos), 'diário guarda o patch já sem a cópia aninhada');
confere(Number(rows[0].versao) === 101, 'versão avançou 1');

// Só a cópia aninhada mudando => nada a gravar (não avança versão, não gera evento)
const so = [{ op: 'mesclar_item', colecao: 'lojas', chave: 'id', valorChave: '400', campos: { protocolos: [{ id: 'P1', outro: 1 }] } }];
const r2 = (await pool.query('select * from public.app_state_aplicar_patches($1::jsonb, null)', [JSON.stringify(so)])).rows[0];
confere(Number(r2.versao) === 101, 'patch só da cópia aninhada não avança a versão');
await pool.end();
process.exit(falhas ? 1 : 0);
