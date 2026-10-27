-- Migração: gravação por patches (resolve colisões com várias pessoas
-- usando ao mesmo tempo)
--
-- Como usar: no painel do Supabase do seu projeto JÁ EM USO (que já rodou
-- schema.sql antes), abra "SQL Editor" > "New query", cole SÓ O CONTEÚDO
-- DESTE ARQUIVO (não precisa colar schema.sql de novo) e clique em "Run".
-- Não apaga nem altera nenhum dado existente — só adiciona uma função nova
-- no banco. Depois de rodar, publique a nova versão do app (a que já sabe
-- usar essa função) — sem isso, o app continua funcionando do jeito antigo
-- (gravação do documento inteiro), só não ganha o reforço de robustez.
--
-- O conteúdo abaixo também já faz parte de supabase/schema.sql (seção 3) —
-- então, num projeto NOVO (do zero), rodar schema.sql inteiro já inclui
-- isso, e este arquivo separado não é necessário.

-- =========================================================================
-- 3) app_state_aplicar_patches — gravação em "pedaços", não o documento
--    inteiro (ver nota na seção 2 de schema.sql)
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
--     -- mesclarEstadoSincronizado.js).
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
-- p_atualizado_em: o timestamp vem do CLIENTE (gerado antes da chamada de
-- rede), não de now() aqui dentro — o filtro de eco do Realtime no cliente
-- (ultimoTimestampAplicadoRef, ver useSyncedAppState.js) depende de
-- conhecer esse valor ANTES da viagem de rede, pra reconhecer e ignorar a
-- própria gravação quando ela volta pelo canal em tempo real.
--
-- security invoker (padrão — fica explícito aqui): a função roda com o
-- mesmo papel de quem chama (o usuário autenticado via RLS), exatamente
-- como as leituras/gravações diretas que o app já fazia antes — nenhum
-- privilégio novo é concedido além do que as políticas da tabela (schema.sql)
-- já permitem.
create or replace function public.app_state_aplicar_patches(
  p_patches jsonb,
  p_usuario uuid default null,
  p_atualizado_em timestamptz default null
)
returns table (atualizado_em timestamptz, dados jsonb)
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
  v_agora timestamptz := coalesce(p_atualizado_em, now());
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
    set dados = v_dados, atualizado_em = v_agora, atualizado_por = p_usuario
    where id = 'estado-v1';

  return query select v_agora, v_dados;
end;
$$;

-- Só usuários logados podem chamar essa função — mesmo critério das
-- políticas de RLS da tabela acima (nada de acesso anônimo).
revoke all on function public.app_state_aplicar_patches(jsonb, uuid, timestamptz) from public;
grant execute on function public.app_state_aplicar_patches(jsonb, uuid, timestamptz) to authenticated;
