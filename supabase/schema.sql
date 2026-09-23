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
-- 2) app_state — dados do sistema (Fase B: ainda não usada pelo app)
-- =========================================================================
-- Guarda o estado inteiro do Doca Manager (lojas, boxes, motoristas,
-- carregamentos etc.) como um único registro JSON, compartilhado entre
-- todos os usuários em tempo real — substituindo o armazenamento local do
-- navegador (localStorage) usado até aqui. Criada com o schema já pronto
-- para quando essa etapa for implementada; até lá, o app continua
-- funcionando com os dados salvos localmente no navegador de cada um.

create table if not exists public.app_state (
  id text primary key default 'estado-v1',
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id)
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
