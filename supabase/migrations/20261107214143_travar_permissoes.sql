-- Correção de segurança encontrada pelo supabase/tests/rls_test.sql.
--
-- O problema: o Supabase já dá permissões padrão de tabela inteira aos
-- papéis "anon" e "authenticated". Um "grant update (nome, tema)" só
-- ACRESCENTA permissão; ele não tira o "update" da tabela inteira que já
-- existia. Resultado: um usuário logado conseguia ligar o próprio
-- can_see_finance pela API.
--
-- A correção: começar do zero (revoke all) e dar só o necessário.
-- E, como segunda camada, um gatilho que recusa qualquer mudança em
-- can_see_finance vinda do site, não importa quais permissões existam.

-- ---------- Zerar permissões e dar só o necessário ----------
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.reminders from anon, authenticated;
revoke all on table public.notes from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (nome, tema) on public.profiles to authenticated;

grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

-- Tabelas criadas daqui para frente não ganham nada sozinhas.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------- Segunda camada: gatilho que protege can_see_finance ----------
create function public.proteger_can_see_finance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Pelo site (anon/authenticated), can_see_finance nunca muda.
  -- Pelo SQL Editor do painel (papel postgres), continua liberado.
  if new.can_see_finance is distinct from old.can_see_finance
     and current_user in ('anon', 'authenticated') then
    raise exception 'can_see_finance só pode ser alterado pelo painel'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteger_can_see_finance() from public, anon, authenticated;
revoke execute on function public.marcar_atualizado_em() from public, anon, authenticated;

create trigger profiles_proteger_can_see_finance
  before update on public.profiles
  for each row execute function public.proteger_can_see_finance();
