-- Etapa 3: agenda, lembretes e anotações.
--
-- Regras de acesso (RLS):
--   - cada pessoa lê, cria, edita e apaga só o que é seu;
--   - eventos e lembretes com shared = true podem ser LIDOS pelo parceiro,
--     mas só o dono edita ou apaga;
--   - anotações são sempre privadas.
-- Como o cadastro público está desligado, "qualquer usuário logado" são
-- só vocês dois; por isso "shared" significa "o parceiro pode ver".

-- Atualiza a coluna atualizado_em sozinha a cada edição.
create function public.marcar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ---------- Agenda ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  cor text check (cor is null or cor ~ '^#[0-9a-fA-F]{6}$'),
  shared boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create index events_owner_inicio_idx on public.events (owner_id, inicio);

create trigger events_atualizado_em
  before update on public.events
  for each row execute function public.marcar_atualizado_em();

-- ---------- Lembretes ----------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  quando timestamptz,
  feito boolean not null default false,
  shared boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index reminders_owner_quando_idx on public.reminders (owner_id, quando);

create trigger reminders_atualizado_em
  before update on public.reminders
  for each row execute function public.marcar_atualizado_em();

-- ---------- Anotações ----------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null default '' check (char_length(titulo) <= 200),
  conteudo text not null default '',
  fixada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index notes_owner_idx on public.notes (owner_id, fixada, atualizado_em desc);

create trigger notes_atualizado_em
  before update on public.notes
  for each row execute function public.marcar_atualizado_em();

-- ---------- RLS ----------
alter table public.events enable row level security;
alter table public.reminders enable row level security;
alter table public.notes enable row level security;

-- events: dono faz tudo; parceiro só lê o que for compartilhado
create policy "events: ler os seus e os compartilhados"
  on public.events for select to authenticated
  using (owner_id = (select auth.uid()) or shared);

create policy "events: criar só em seu nome"
  on public.events for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "events: editar só os seus"
  on public.events for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "events: apagar só os seus"
  on public.events for delete to authenticated
  using (owner_id = (select auth.uid()));

-- reminders: mesmo esquema dos eventos
create policy "reminders: ler os seus e os compartilhados"
  on public.reminders for select to authenticated
  using (owner_id = (select auth.uid()) or shared);

create policy "reminders: criar só em seu nome"
  on public.reminders for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "reminders: editar só os seus"
  on public.reminders for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "reminders: apagar só os seus"
  on public.reminders for delete to authenticated
  using (owner_id = (select auth.uid()));

-- notes: sempre privadas
create policy "notes: dono faz tudo"
  on public.notes for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------- Grants ----------
-- O projeto não expõe tabelas novas sozinho; sem isto a API recusa tudo.
-- Só "authenticated" (logado) recebe acesso; "anon" (deslogado) nenhum.
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
