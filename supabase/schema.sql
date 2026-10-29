-- Doca Manager — schema do Supabase
--
-- Como usar: no painel do Supabase, abra "SQL Editor" (menu lateral) > "New
-- query", cole todo este arquivo e clique em "Run". Pode ser executado uma
-- única vez, do zero, num projeto novo.
--
-- Depois de rodar este script, os ~20 usuários (contas de login) são
-- criados manualmente em "Authentication" > "Users" > "Add user" (email +
-- senha), e para cada um é preciso inserir a linha correspondente na tabela
-- "profiles" abaixo (nome + grupo), senão o login funciona mas o sistema
-- nega acesso ("Acesso não liberado").


-- =========================================================================
-- 1) profiles — perfil de acesso de cada usuário (nome + grupo)
-- =========================================================================
-- grupo: 'motorista' (só vê a aba Motoristas) | 'administrativo' (acesso
-- total: Dashboard, Boxes, Agrupamento, Carregamento, Motoristas,
-- Relatórios, Cadastros e Importar).
--
-- IMPORTANTE pra login de motorista: o campo `nome` precisa ser EXATAMENTE
-- igual (maiúsculas/minúsculas não importam, mas o resto do texto sim) ao
-- nome desse motorista cadastrado em Cadastros > Motoristas e usado no
-- campo "Motorista" dos carregamentos dele. É assim que a aba Motoristas
-- sabe mostrar só as entregas daquele login, sem lista nenhuma de outros
-- nomes pra escolher (ver DriversPage.jsx) — um nome digitado diferente
-- (ex.: com um sobrenome a mais, ou abreviado) faz a tela abrir "sem
-- nenhuma entrega encontrada" pra esse motorista.
--
-- Atenção: isso esconde os outros nomes na TELA de quem loga como
-- motorista, mas não é uma restrição de acesso aos dados em si — a tabela
-- app_state abaixo é lida inteira por qualquer usuário autenticado (ver
-- política "Usuário logado lê o estado"). Então tecnicamente, alguém com
-- conhecimento técnico (abrindo as ferramentas de desenvolvedor do
-- navegador) ainda conseguiria ver a resposta bruta com todos os dados.
-- Pra um motorista de verdade não ver nem isso, precisaria reestruturar o
-- banco pra não guardar tudo num único registro JSON compartilhado (ver
-- nota abaixo sobre app_state) — bem mais trabalho, e fora do que esse
-- sistema faz hoje.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  grupo text not null check (grupo in ('motorista', 'administrativo')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuário logado pode ler o próprio perfil (é o que o app usa pra
-- decidir quais abas mostrar). Ninguém pode ler o perfil de outra pessoa,
-- nem criar/alterar perfis pelo próprio app (isso é feito manualmente pelo
-- administrador no painel do Supabase).
drop policy if exists "Usuário lê o próprio perfil" on public.profiles;
create policy "Usuário lê o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);


-- =========================================================================
-- 2) app_state — dados do sistema
-- =========================================================================
-- Guarda o estado inteiro do Doca Manager (lojas, boxes, motoristas,
-- carregamentos, cadastros etc.) como um único registro JSON (id
-- "estado-v1"), compartilhado entre todos os usuários em tempo real —
-- substitui o armazenamento local do navegador (localStorage) usado antes.
--
-- Nota (histórico): uma otimização que dividia esse estado em pedaços
-- (linhas separadas por id — "lojas"/"protocolos"/"boxes"/"cadastros") foi
-- tentada duas vezes e revertida as duas — causava inconsistência de dados
-- entre usuários (duas pessoas mexendo em lojas/boxes diferentes quase ao
-- mesmo tempo podiam sobrescrever a mudança uma da outra num pedaço, já
-- que cada gravação mandava o pedaço INTEIRO, não um diff) e, por
-- consequência, telas brancas.
--
-- Atualização (pedido do usuário: com várias pessoas usando ao mesmo
-- tempo — motoristas incluídos — as colisões ficaram frequentes demais):
-- em vez de reestruturar o banco em várias tabelas (a ideia tentada antes),
-- a linha única continua existindo, mas a GRAVAÇÃO agora manda só um
-- "diff" (uma lista de patches — "a loja X agora é assim", "a vaga Y do
-- box Z agora é assim"), aplicado atomicamente dentro da função
-- app_state_aplicar_patches abaixo. Isso resolve exatamente a causa raiz
-- documentada acima ("cada gravação manda o pedaço inteiro, não um diff")
-- sem precisar da reestruturação em várias tabelas: duas pessoas mexendo
-- em registros DIFERENTES (o caso comum) nunca mais colidem entre si, e a
-- trava de linha dentro da função serializa só o raríssimo caso de
-- colisão no MESMÍSSIMO registro, sem nenhuma delas precisar saber da
-- outra ou tentar de novo. Ver src/utils/calcularPatchesEstado.js (calcula
-- a lista de patches no cliente) e src/hooks/useSyncedAppState.js (chama a
-- função via supabase.rpc).

create table if not exists public.app_state (
  id text primary key default 'estado-v1',
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  -- Pedido do usuário ("ainda tá sobrepondo, mesmo sem erro nenhum
  -- aparecer"): até aqui, o app decidia o que era eco da própria gravação
  -- (pra ignorar) comparando TIMESTAMPS gerados no APARELHO de cada
  -- usuário (`new Date().toISOString()`) — com 15 motoristas em celulares
  -- diferentes, relógios poucos segundos fora de sincronia entre si fazem
  -- esse filtro descartar silenciosamente a atualização genuína de outra
  -- pessoa (sem nenhum erro — do ponto de vista do banco, as duas
  -- gravações foram válidas), e a próxima gravação desse usuário manda de
  -- volta sua cópia local desatualizada daquele registro, sobrescrevendo a
  -- mudança que nunca chegou a ser aplicada. `versao` substitui essa
  -- comparação por um contador inteiro que só o SERVIDOR incrementa (+1 a
  -- cada gravação, de patches ou documento inteiro — ver as duas funções
  -- abaixo) — nunca depende do relógio de aparelho nenhum, então essa
  -- classe de bug deixa de existir (não só fica mais rara).
  versao bigint not null default 0
);

alter table public.app_state enable row level security;

-- Qualquer usuário logado (dos ~20 liberados) pode ler e atualizar o estado
-- compartilhado — o controle de quem pode logar já é feito pela tabela
-- profiles / criação manual de contas, então dentro do sistema todo mundo
-- que está autenticado participa da mesma operação.
drop policy if exists "Usuário logado lê o estado" on public.app_state;
create policy "Usuário logado lê o estado"
  on public.app_state for select
  using (auth.role() = 'authenticated');

drop policy if exists "Usuário logado atualiza o estado" on public.app_state;
create policy "Usuário logado atualiza o estado"
  on public.app_state for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Usuário logado insere o estado" on public.app_state;
create policy "Usuário logado insere o estado"
  on public.app_state for insert
  with check (auth.role() = 'authenticated');

-- Fase B agora em uso: publica as mudanças de app_state em tempo real, pra
-- que o Supabase Realtime avise instantaneamente todos os navegadores
-- conectados quando alguém grava um novo estado (ver
-- src/hooks/useSyncedAppState.js). Sem isso a tabela funciona normalmente,
-- mas ninguém recebe as atualizações dos outros sem recarregar a página.
alter publication supabase_realtime add table public.app_state;


-- =========================================================================
-- 3) app_state_aplicar_patches — gravação em "pedaços", não o documento
--    inteiro (ver nota na seção 2 acima)
-- =========================================================================
-- Recebe uma LISTA de patches (ver formato de cada "op" nos comentários
-- abaixo, e src/utils/calcularPatchesEstado.js, que é quem monta essa
-- lista no cliente) e aplica todos, de uma vez, dentro de uma única
-- transação com a linha travada (select ... for update) — isso serializa
-- gravações concorrentes (cada uma espera a anterior terminar e aplica por
-- cima do resultado já salvo dela, nunca por cima de uma versão velha), sem
-- nenhuma delas precisar saber da outra ou tentar de novo. Como cada patch
-- só toca o PEDAÇO específico que mudou (uma loja, uma vaga de um box, uma
-- chave de um mapa, um campo escalar), duas gravações que mexem em
-- registros DIFERENTES nunca se apagam uma à outra, mesmo chegando quase
-- juntas.
--
-- "op" aceitas em cada item de p_patches:
--   upsert_item     { colecao, chave, valorChave, item }
--     -- cria ou substitui (pelo valor de item[chave]) um item dentro de
--     -- dados[colecao] (coleções: lojas, protocolos, placasCadastradas,
--     -- contatosNotificacao, localizacaoLojas — ver CHAVE_COLECAO em
--     -- mesclarEstadoSincronizado.js). Usado só pra item NOVO.
--   mesclar_item    { colecao, chave, valorChave, campos, removidos? }
--     -- num item que já existe, aplica só `campos` (item || campos) e
--     -- remove as chaves de `removidos` — os outros campos ficam como
--     -- estão no banco. Item inexistente: ignora (respeita exclusão).
--   remover_item    { colecao, chave, valorChave }
--     -- remove de dados[colecao] o item cujo campo `chave` é `valorChave`.
--   upsert_vaga     { numeroBox, vaga }
--     -- cria ou substitui (pelo numero da vaga) uma vaga dentro de
--     -- dados.boxes[box com numero=numeroBox].vagas — boxes NÃO usa
--     -- upsert_item porque é um recurso compartilhado (ver boxLogic.js):
--     -- só a vaga especifica muda, nunca o box inteiro, senão a vaga que
--     -- OUTRA pessoa ocupou um instante atrás seria apagada.
--   definir_escalar { campo, valor }
--     -- define dados[campo] = valor (diaAtual, valorPaletesAgrupamento,
--     -- sequenciaLojas).
--   definir_mapa    { campo, chave, valor }
--     -- define dados[campo][chave] = valor (hoje só observacoesLoja).
--   remover_mapa    { campo, chave }
--     -- remove a chave `chave` de dados[campo].
--   adicionar_simples { campo, valor }
--     -- adiciona `valor` em dados[campo] se ainda não existir (coleções
--     -- simples de string: colaboradoresCadastrados, motoristasCadastrados).
--   remover_simples   { campo, valor }
--     -- remove `valor` de dados[campo].
--
-- versao: quem decide o que é eco da própria gravação (ou atualização
-- atrasada/fora de ordem) é o cliente comparando essa coluna — um contador
-- que SÓ esta função (e app_state_gravar_completo, ver mais abaixo)
-- incrementa, nunca um timestamp gerado no aparelho (ver comentário na
-- tabela app_state acima, seção 2 — essa troca é o que resolve a
-- sobreposição que persistia mesmo sem nenhum erro aparecer).
--
-- security invoker (padrão — fica explícito aqui): a função roda com o
-- mesmo papel de quem chama (o usuário autenticado via RLS), exatamente
-- como as leituras/gravações diretas que o app já fazia antes — nenhum
-- privilégio novo é concedido além do que as políticas da tabela (acima)
-- já permitem.
drop function if exists public.app_state_aplicar_patches(jsonb, uuid, timestamptz);
create or replace function public.app_state_aplicar_patches(
  p_patches jsonb,
  p_usuario uuid default null
)
returns table (versao bigint, atualizado_em timestamptz, dados jsonb)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_dados jsonb;
  v_patch jsonb;
  v_colecao text;
  v_campo text;
  v_chave text;
  v_valor_chave text;
  v_item jsonb;
  v_colecao_atual jsonb;
  v_indice int;
  v_numero_box int;
  v_vaga jsonb;
  v_boxes jsonb;
  v_idx_box int;
  v_vagas jsonb;
  v_idx_vaga int;
  v_mapa jsonb;
  v_simples jsonb;
  v_versao bigint;
  v_agora timestamptz;
begin
  -- Trava a linha (uma só, sempre 'estado-v1') até o fim da transação —
  -- ver comentário no topo desta seção.
  select app_state.dados into v_dados from public.app_state where id = 'estado-v1' for update;

  if v_dados is null then
    raise exception 'app_state estado-v1 não existe — faça a gravação inicial completa (upsert do documento inteiro) antes de usar patches';
  end if;

  for v_patch in select * from jsonb_array_elements(p_patches)
  loop
    case v_patch->>'op'

    when 'upsert_item' then
      v_colecao := v_patch->>'colecao';
      v_chave := v_patch->>'chave';
      v_valor_chave := v_patch->>'valorChave';
      v_item := v_patch->'item';
      v_colecao_atual := coalesce(v_dados->v_colecao, '[]'::jsonb);
      select (i - 1) into v_indice
        from jsonb_array_elements(v_colecao_atual) with ordinality as t(elem, i)
        where elem->>v_chave = v_valor_chave
        limit 1;
      if v_indice is null then
        v_colecao_atual := v_colecao_atual || jsonb_build_array(v_item);
      else
        v_colecao_atual := jsonb_set(v_colecao_atual, array[v_indice::text], v_item);
      end if;
      v_dados := jsonb_set(v_dados, array[v_colecao], v_colecao_atual);

    when 'mesclar_item' then
      -- Só os CAMPOS que mudaram num item que já existe (ver
      -- calcularPatchesEstado.js): `item || campos`, sem tocar nos outros
      -- campos — duas pessoas mudando campos diferentes da mesma loja ao
      -- mesmo tempo não se apagam mais. Se o item não existe mais (outra
      -- pessoa excluiu), respeita a exclusão e não recria um item parcial.
      v_colecao := v_patch->>'colecao';
      v_chave := v_patch->>'chave';
      v_valor_chave := v_patch->>'valorChave';
      v_colecao_atual := coalesce(v_dados->v_colecao, '[]'::jsonb);
      select (i - 1) into v_indice
        from jsonb_array_elements(v_colecao_atual) with ordinality as t(elem, i)
        where elem->>v_chave = v_valor_chave
        limit 1;
      if v_indice is not null then
        v_item := (v_colecao_atual->v_indice) || coalesce(v_patch->'campos', '{}'::jsonb);
        if jsonb_typeof(v_patch->'removidos') = 'array' then
          v_item := v_item - array(select jsonb_array_elements_text(v_patch->'removidos'));
        end if;
        v_colecao_atual := jsonb_set(v_colecao_atual, array[v_indice::text], v_item);
        v_dados := jsonb_set(v_dados, array[v_colecao], v_colecao_atual);
      end if;

    when 'remover_item' then
      v_colecao := v_patch->>'colecao';
      v_chave := v_patch->>'chave';
      v_valor_chave := v_patch->>'valorChave';
      v_colecao_atual := coalesce(v_dados->v_colecao, '[]'::jsonb);
      select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_colecao_atual
        from jsonb_array_elements(v_colecao_atual) as elem
        where elem->>v_chave is distinct from v_valor_chave;
      v_dados := jsonb_set(v_dados, array[v_colecao], v_colecao_atual);

    when 'upsert_vaga' then
      v_numero_box := (v_patch->>'numeroBox')::int;
      v_vaga := v_patch->'vaga';
      v_boxes := coalesce(v_dados->'boxes', '[]'::jsonb);
      select (i - 1) into v_idx_box
        from jsonb_array_elements(v_boxes) with ordinality as t(elem, i)
        where (elem->>'numero')::int = v_numero_box
        limit 1;
      if v_idx_box is null then
        raise exception 'upsert_vaga: box % não encontrado', v_numero_box;
      end if;
      v_vagas := coalesce(v_boxes->v_idx_box->'vagas', '[]'::jsonb);
      select (i - 1) into v_idx_vaga
        from jsonb_array_elements(v_vagas) with ordinality as t(elem, i)
        where (elem->>'numero')::int = (v_vaga->>'numero')::int
        limit 1;
      if v_idx_vaga is null then
        v_vagas := v_vagas || jsonb_build_array(v_vaga);
      else
        v_vagas := jsonb_set(v_vagas, array[v_idx_vaga::text], v_vaga);
      end if;
      v_boxes := jsonb_set(v_boxes, array[v_idx_box::text, 'vagas'], v_vagas);
      v_dados := jsonb_set(v_dados, array['boxes'], v_boxes);

    when 'definir_escalar' then
      v_campo := v_patch->>'campo';
      v_dados := jsonb_set(v_dados, array[v_campo], v_patch->'valor');

    when 'definir_mapa' then
      v_campo := v_patch->>'campo';
      v_chave := v_patch->>'chave';
      v_mapa := coalesce(v_dados->v_campo, '{}'::jsonb);
      v_mapa := jsonb_set(v_mapa, array[v_chave], v_patch->'valor');
      v_dados := jsonb_set(v_dados, array[v_campo], v_mapa);

    when 'remover_mapa' then
      v_campo := v_patch->>'campo';
      v_chave := v_patch->>'chave';
      v_mapa := coalesce(v_dados->v_campo, '{}'::jsonb);
      v_mapa := v_mapa - v_chave;
      v_dados := jsonb_set(v_dados, array[v_campo], v_mapa);

    when 'adicionar_simples' then
      v_campo := v_patch->>'campo';
      v_simples := coalesce(v_dados->v_campo, '[]'::jsonb);
      if not exists (select 1 from jsonb_array_elements_text(v_simples) t where t = (v_patch->>'valor')) then
        v_simples := v_simples || jsonb_build_array(v_patch->'valor');
      end if;
      v_dados := jsonb_set(v_dados, array[v_campo], v_simples);

    when 'remover_simples' then
      v_campo := v_patch->>'campo';
      v_simples := coalesce(v_dados->v_campo, '[]'::jsonb);
      select coalesce(jsonb_agg(t), '[]'::jsonb) into v_simples
        from jsonb_array_elements_text(v_simples) t
        where t is distinct from (v_patch->>'valor');
      v_dados := jsonb_set(v_dados, array[v_campo], v_simples);

    else
      raise exception 'patch com op desconhecida: %', v_patch->>'op';
    end case;
  end loop;

  update public.app_state
    set dados = v_dados, atualizado_em = now(), atualizado_por = p_usuario, versao = app_state.versao + 1
    where id = 'estado-v1'
    returning app_state.versao, app_state.atualizado_em into v_versao, v_agora;

  -- Diário de mudanças (ver seção 5): é ESTE registro, pequeno, que o
  -- Realtime entrega aos outros aparelhos — não mais o documento inteiro.
  -- Patches muito grandes (ex.: importação em massa) não vão no diário:
  -- marcados como `completo`, os aparelhos relêem o documento.
  insert into public.app_state_log (versao, patches, completo)
    values (
      v_versao,
      case when octet_length(p_patches::text) > 200000 then null else p_patches end,
      octet_length(p_patches::text) > 200000
    )
  on conflict on constraint app_state_log_pkey do update set patches = excluded.patches, completo = excluded.completo;
  delete from public.app_state_log where app_state_log.versao < v_versao - 1000;

  return query select v_versao, v_agora, v_dados;
end;
$$;

-- Só usuários logados podem chamar essa função — mesmo critério das
-- políticas de RLS da tabela acima (nada de acesso anônimo).
revoke all on function public.app_state_aplicar_patches(jsonb, uuid) from public;
grant execute on function public.app_state_aplicar_patches(jsonb, uuid) to authenticated;


-- =========================================================================
-- 4) app_state_gravar_completo — grava o documento INTEIRO de uma vez
--    (primeira gravação, antes de existir uma base pra calcular patches;
--    ou contingência se a gravação por patches falhar — ver
--    src/hooks/useSyncedAppState.js)
-- =========================================================================
-- Faz o mesmo que um `upsert` direto na tabela faria, mas incrementando
-- `versao` atomicamente no servidor junto — por isso é uma função em vez
-- de um upsert simples do cliente: sem isso, esse caminho de gravação
-- ficaria de fora do contador e voltaria a depender do relógio do
-- aparelho pra decidir o que é eco (ver comentário na tabela app_state,
-- seção 2).
create or replace function public.app_state_gravar_completo(
  p_dados jsonb,
  p_usuario uuid default null
)
returns table (versao bigint, atualizado_em timestamptz, dados jsonb)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_versao bigint;
  v_agora timestamptz;
begin
  insert into public.app_state (id, dados, atualizado_em, atualizado_por, versao)
    values ('estado-v1', p_dados, now(), p_usuario, 1)
  on conflict (id) do update
    set dados = excluded.dados,
        atualizado_em = now(),
        atualizado_por = excluded.atualizado_por,
        versao = app_state.versao + 1
  returning app_state.versao, app_state.atualizado_em into v_versao, v_agora;

  -- Diário de mudanças (seção 5): documento inteiro gravado = os outros
  -- aparelhos precisam reler o documento (patches nulos + completo).
  insert into public.app_state_log (versao, patches, completo)
    values (v_versao, null, true)
  on conflict on constraint app_state_log_pkey do update set patches = null, completo = true;
  delete from public.app_state_log where app_state_log.versao < v_versao - 1000;

  return query select v_versao, v_agora, p_dados;
end;
$$;

revoke all on function public.app_state_gravar_completo(jsonb, uuid) from public;
grant execute on function public.app_state_gravar_completo(jsonb, uuid) to authenticated;


-- =========================================================================
-- 5) app_state_log — diário de mudanças (Realtime leve, pouco egress)
-- =========================================================================
-- Pedido do usuário ("atingindo o limite do Supabase, como manter grátis?"):
-- o Realtime entregava o documento inteiro (~300 kB) a CADA usuário
-- conectado a cada ação, e a gravação devolvia o documento inteiro de
-- novo a quem gravou. Resultado: ~41 GB de egress num mês contra 5 GB do
-- plano gratuito. Agora cada gravação deixa aqui só a lista de patches (o
-- mesmo diff que o app já mandava, alguns kB), e é esta tabela que o
-- Realtime publica. Cada aparelho aplica esses patches sobre o último
-- estado que conhece; se perder alguma versão, lê o diário (ou, em último
-- caso, o documento) pra se atualizar. Guarda só as últimas ~1000 versões.
--
-- `completo = true` (patches nulos): documento inteiro gravado, ou patches
-- grandes demais — o aparelho relê o documento.
create table if not exists public.app_state_log (
  versao bigint primary key,
  patches jsonb,
  completo boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.app_state_log enable row level security;

drop policy if exists "Usuário logado lê o diário" on public.app_state_log;
create policy "Usuário logado lê o diário"
  on public.app_state_log for select
  using (auth.role() = 'authenticated');

drop policy if exists "Usuário logado grava no diário" on public.app_state_log;
create policy "Usuário logado grava no diário"
  on public.app_state_log for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Usuário logado limpa o diário" on public.app_state_log;
create policy "Usuário logado limpa o diário"
  on public.app_state_log for delete
  using (auth.role() = 'authenticated');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state_log'
     ) then
    alter publication supabase_realtime add table public.app_state_log;
  end if;
end $$;

-- Versão "leve" da gravação por patches: faz o mesmo, mas devolve só o
-- número da versão (alguns bytes) em vez do documento inteiro. A versão
-- antiga continua existindo, pra aparelhos com o app antigo aberto. (A
-- gravação do documento inteiro é rara e segue devolvendo o documento.)
create or replace function public.app_state_aplicar_patches_leve(
  p_patches jsonb,
  p_usuario uuid default null
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_versao bigint;
begin
  select r.versao into v_versao from public.app_state_aplicar_patches(p_patches, p_usuario) r;
  return v_versao;
end;
$$;

revoke all on function public.app_state_aplicar_patches_leve(jsonb, uuid) from public;
grant execute on function public.app_state_aplicar_patches_leve(jsonb, uuid) to authenticated;

