-- Migração: contador de versão monotônico (resolve sobreposição que
-- persistia mesmo com a gravação por patches funcionando sem erro nenhum)
--
-- Como usar: no painel do Supabase do seu projeto JÁ EM USO (que já rodou
-- schema.sql e a migração de gravação por patches antes), abra "SQL
-- Editor" > "New query", cole SÓ O CONTEÚDO DESTE ARQUIVO e clique em
-- "Run". Não apaga nem altera nenhum dado existente — só adiciona uma
-- coluna nova (começando em 0) e troca duas funções. Depois de rodar,
-- publique a nova versão do app (a que já sabe usar essa coluna) — sem
-- isso, o app volta a tentar usar o parâmetro antigo (p_atualizado_em),
-- que não existe mais na função, e toda gravação por patches passa a
-- falhar (vai aparecer o aviso amarelo de erro no indicador de
-- sincronização, com a mensagem "function ... does not exist").
--
-- O conteúdo abaixo também já faz parte de supabase/schema.sql (seções 2,
-- 3 e 4) — então, num projeto NOVO (do zero), rodar schema.sql inteiro já
-- inclui isso, e este arquivo separado não é necessário.
--
-- Por que essa migração existe: a gravação por patches (migração
-- anterior) resolveu a sobreposição entre usuários editando registros
-- DIFERENTES, mas usava um detalhe frágil pra decidir, no celular de cada
-- usuário, "essa atualização que chegou agora é a minha própria gravação
-- voltando (ignora) ou é de outra pessoa (aplica)?" — comparava
-- TIMESTAMPS gerados no APARELHO de cada usuário. Com várias pessoas em
-- celulares diferentes, bastam alguns segundos de diferença entre os
-- relógios de dois aparelhos pra esse filtro descartar silenciosamente a
-- atualização genuína de outra pessoa — sem nenhum erro, porque do ponto
-- de vista do banco as duas gravações foram válidas. A próxima gravação
-- de quem perdeu aquela atualização manda de volta sua cópia local
-- desatualizada, sobrescrevendo a mudança que nunca chegou a ser vista.
-- Essa migração troca o timestamp do aparelho por um contador inteiro
-- que só o SERVIDOR incrementa (`versao`) — nunca ambíguo entre
-- aparelhos, porque não depende de relógio nenhum.

-- =========================================================================
-- 1) Coluna nova em app_state
-- =========================================================================
alter table public.app_state add column if not exists versao bigint not null default 0;

-- =========================================================================
-- 2) app_state_aplicar_patches — mesma função de sempre, mas devolvendo
--    (e incrementando) `versao` em vez de aceitar um timestamp do cliente
-- =========================================================================
-- Precisa ser removida antes de recriada porque o tipo de retorno mudou
-- (Postgres não permite `create or replace` trocar o retorno de uma
-- função, só o corpo) — esse `drop` não afeta nenhum dado, só a definição
-- da função.
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
  select app_state.dados into v_dados from public.app_state where id = 'estado-v1' for update;

  if v_dados is null then
    raise exception 'app_state estado-v1 não existe — faça a gravação inicial completa (app_state_gravar_completo) antes de usar patches';
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

  return query select v_versao, v_agora, v_dados;
end;
$$;

revoke all on function public.app_state_aplicar_patches(jsonb, uuid) from public;
grant execute on function public.app_state_aplicar_patches(jsonb, uuid) to authenticated;

-- =========================================================================
-- 3) app_state_gravar_completo — função nova: grava o documento inteiro
--    (primeira gravação, ou contingência se os patches falharem),
--    incrementando `versao` também, em vez do upsert direto que o
--    cliente usava antes pra esse caminho.
-- =========================================================================
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

  return query select v_versao, v_agora, p_dados;
end;
$$;

revoke all on function public.app_state_gravar_completo(jsonb, uuid) from public;
grant execute on function public.app_state_gravar_completo(jsonb, uuid) to authenticated;
