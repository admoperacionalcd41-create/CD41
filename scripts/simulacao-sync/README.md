# Simulação de vários usuários (sincronização)

Reproduz, contra um Postgres **de verdade** com as mesmas funções SQL de
produção (`supabase/schema.sql`), vários usuários usando o app ao mesmo
tempo — cada um com latência de rede e entrega de Realtime aleatórias,
mexendo em campos diferentes dos mesmos registros (lojas, vagas de box,
protocolos). No fim confere se o banco tem a última ação de cada usuário em
cada campo e se a tela de cada um bate com o banco.

Resultado esperado: `atualizacoesPerdidas: 0` e `telasDiferentesDoBanco: 0`.

## Como rodar

```bash
createdb doca_sim
psql doca_sim -c "create schema auth; create table auth.users (id uuid primary key); create role authenticated;"
# carrega o schema sem as partes exclusivas do Supabase:
sed -e '/alter publication supabase_realtime/d' \
    -e "s/auth\.role() = 'authenticated'/true/g" \
    -e 's/auth\.uid() = id/true/g' ../../supabase/schema.sql | psql doca_sim
cd scripts/simulacao-sync && npm init -y && npm i pg
node --import ./loader.mjs simular.mjs novo 1 5 30   # seed, usuários, ações por usuário
```

Rode uma simulação por vez (todas usam a mesma linha `app_state`).

## Sincronização leve (egress)

O protocolo atual é o "leve": a gravação devolve só a versão e o Realtime
entrega o diário de patches (`app_state_log`). Variáveis do `simular.mjs`:

- `MODO=leve` (padrão) | `legado` (documento inteiro em tudo, pra comparar o
  egress) | `misto` (metade dos aparelhos no app novo, metade no antigo).
- `PERDA_EVENTOS=0.3`: 30% dos eventos do Realtime nunca chegam aos aparelhos
  novos (testa a recuperação pelo diário/releitura).
- `PAD_KB=300`: engorda o documento pra ~300 kB (tamanho real) e o relatório
  `bytesKB` mostra o tráfego total (respostas + eventos + leituras).

`node --import ./loader.mjs equivalencia.mjs 400 7` compara, com patches
aleatórios, o documento que o JS (`aplicarPatchesEstado.js`) monta no
aparelho com o que o SQL monta no banco. Precisa dar `divergencias: 0`.
(Antes de tudo, rode também `supabase/migracao-sincronizacao-leve.sql` no
banco de teste se ele foi criado com um schema antigo.)
