-- Migração: sincronização LEVE (resolve "atingindo o limite de egress do Supabase")
--
-- Como usar: no painel do Supabase, "SQL Editor" > "New query", cole SÓ O
-- CONTEÚDO DESTE ARQUIVO e clique em "Run". RODE ANTES de publicar o app
-- novo. É seguro rodar mais de uma vez e não apaga nem altera nenhum dado
-- do sistema: só cria a tabela `app_state_log` (diário das últimas mudanças),
-- recria as duas funções de gravação pra também registrarem nesse diário, e
-- cria a versão "leve" da gravação por patches (devolve só o número da versão).
--
-- Pré-requisito: já ter rodado as migrações anteriores (versão monotônica e
-- gravação por campo).
--
-- O que muda: antes, a cada ação o Supabase mandava o documento inteiro
-- (~300 kB) pra cada usuário conectado e de volta pra quem gravou. Agora
-- manda só a lista do que mudou (alguns kB). Aparelhos com o app ANTIGO
-- aberto continuam funcionando (as funções antigas seguem existindo), só
-- gastam o egress de antes até recarregarem.

-- 1) diário de mudanças
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


-- 2) gravação por patches (agora registra no diário)
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

-- 3) gravação do documento inteiro (agora registra no diário)
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

-- 4) Versão "leve" da gravação por patches: faz o mesmo, mas devolve só o
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

