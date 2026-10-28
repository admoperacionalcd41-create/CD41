-- Migração: gravação por CAMPO (resolve "estamos perdendo muita atualização")
--
-- Como usar: no painel do Supabase, "SQL Editor" > "New query", cole SÓ O
-- CONTEÚDO DESTE ARQUIVO e clique em "Run". Pode rodar a qualquer momento
-- (antes ou depois de publicar o app novo) e é seguro rodar mais de uma
-- vez: não apaga nem altera nenhum dado — só recria a função
-- app_state_aplicar_patches, que ganha a operação `mesclar_item`.
--
-- Pré-requisito: já ter rodado migracao-versao-monotonica.sql (coluna
-- `versao` e a função app_state_gravar_completo).
--
-- O que muda: antes, quando duas pessoas mudavam campos DIFERENTES da mesma
-- loja/protocolo quase ao mesmo tempo (ex.: faturamento registrando a NF e
-- o box mudando o status da mesma loja), quem gravasse por último mandava a
-- loja INTEIRA e apagava o campo que a outra tinha acabado de mudar. Agora
-- o app manda só os campos que a pessoa mudou, e o banco mexe só neles.
--
-- Sem esta migração o app novo continua funcionando (ele detecta que o
-- banco não conhece `mesclar_item` e volta ao envio do item inteiro), só
-- não ganha essa proteção.

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

  return query select v_versao, v_agora, v_dados;
end;
$$;

-- Só usuários logados podem chamar essa função — mesmo critério das
-- políticas de RLS da tabela acima (nada de acesso anônimo).
revoke all on function public.app_state_aplicar_patches(jsonb, uuid) from public;
grant execute on function public.app_state_aplicar_patches(jsonb, uuid) to authenticated;
