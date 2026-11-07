-- Teste de RLS: prova que um usuário não lê nem mexe nos dados privados do outro.
--
-- Como rodar: cole tudo no SQL Editor do Supabase e clique em Run.
--   - Passou: aparece a linha "OK: todos os testes de RLS passaram".
--   - Falhou: aparece um erro começando com "FALHOU:" dizendo o que vazou.
-- Nada fica salvo: tudo roda dentro de uma transação desfeita no fim (rollback).
-- Os dois usuários abaixo são de mentira e somem junto com o rollback.

begin;

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'teste-a@exemplo.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'teste-b@exemplo.test', 'authenticated', 'authenticated');

-- ===== Agindo como A: cria dados privados e um compartilhado =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.events (titulo, inicio) values ('evento privado de A', now());
insert into public.events (titulo, inicio, shared) values ('evento compartilhado de A', now(), true);
insert into public.reminders (texto) values ('lembrete privado de A');
insert into public.notes (titulo, conteudo) values ('nota de A', 'segredo');

-- ===== Agindo como B =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
begin
  if exists (select 1 from public.events where titulo = 'evento privado de A') then
    raise exception 'FALHOU: B conseguiu ler um evento privado de A';
  end if;
  if not exists (select 1 from public.events where titulo = 'evento compartilhado de A') then
    raise exception 'FALHOU: B não vê o evento compartilhado de A';
  end if;
  if exists (select 1 from public.reminders) then
    raise exception 'FALHOU: B conseguiu ler um lembrete privado de A';
  end if;
  if exists (select 1 from public.notes) then
    raise exception 'FALHOU: B conseguiu ler uma nota de A';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FALHOU: B enxerga o perfil de outra pessoa';
  end if;
end $$;

-- B tenta editar e apagar o evento compartilhado de A (deve ser ignorado)
update public.events set titulo = 'alterado por B' where titulo = 'evento compartilhado de A';
delete from public.events where titulo = 'evento compartilhado de A';

-- B tenta criar evento em nome de A (deve ser recusado)
do $$
begin
  begin
    insert into public.events (owner_id, titulo, inicio)
    values ('00000000-0000-0000-0000-00000000000a', 'falsificado por B', now());
    raise exception 'FALHOU: B criou um evento em nome de A';
  exception when insufficient_privilege then
    null; -- recusado, como esperado
  end;
end $$;

-- B tenta se dar acesso às finanças (deve ser recusado)
do $$
begin
  begin
    update public.profiles set can_see_finance = true;
    raise exception 'FALHOU: B conseguiu ligar can_see_finance';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- ===== De volta como A: o evento compartilhado continua intacto =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
begin
  if not exists (select 1 from public.events where titulo = 'evento compartilhado de A') then
    raise exception 'FALHOU: B alterou ou apagou o evento de A';
  end if;
  if (select count(*) from public.events) <> 2 then
    raise exception 'FALHOU: A deveria ver exatamente os seus 2 eventos';
  end if;
end $$;

-- ===== Deslogado (anon): não acessa nada =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform 1 from public.events;
    raise exception 'FALHOU: visitante deslogado acessou a agenda';
  exception when insufficient_privilege then
    null;
  end;
end $$;

select 'OK: todos os testes de RLS passaram' as resultado;

rollback;
