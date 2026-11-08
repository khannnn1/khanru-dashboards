-- Etapa 2: perfis dos usuários.
-- Cada conta do Supabase Auth ganha uma linha aqui, criada automaticamente.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  tema jsonb not null default '{}'::jsonb,
  can_see_finance boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de cada pessoa: nome, tema de cores e acesso às finanças.';
comment on column public.profiles.can_see_finance is 'Só muda pelo painel do Supabase (SQL), nunca pelo site.';

-- RLS: o banco só devolve a linha do próprio dono.
alter table public.profiles enable row level security;

create policy "perfil: dono lê o seu"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "perfil: dono atualiza o seu"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Grants: o projeto não expõe tabelas novas automaticamente.
-- O usuário logado pode ler o perfil e mudar só nome e tema.
-- can_see_finance fica de fora do update de propósito: ninguém consegue
-- se dar acesso às finanças pelo navegador, nem mexendo no código.
grant select on public.profiles to authenticated;
grant update (nome, tema) on public.profiles to authenticated;

-- Cria o perfil sozinho quando uma conta nova é criada.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$;

revoke execute on function public.criar_perfil() from public, anon, authenticated;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();
