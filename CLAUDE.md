# Khanru Dashboards

Dashboards pessoais do Cardoso e da namorada: agenda, lembretes, anotações,
personalização de cores e, só no dashboard do Cardoso, finanças via Pluggy
(Open Finance). Projeto independente do seletor de atividades (`../khanru`).

Plano completo: https://claude.ai/artifact/8vjqsMaP73eJueYoxSZrk3

## Regras

- Fale comigo em português e explique como para um iniciante.
- Front-end: HTML, CSS e JS puro, sem build, publicado no GitHub Pages.
- Backend: Supabase (Auth, Postgres com RLS, Edge Functions).
- Toda tabela tem RLS ligado. Dados financeiros só para o dono.
- O projeto Supabase foi criado com "Automatically expose new tables"
  desligado: toda migração que cria tabela precisa dos `grant` de acesso
  (para `authenticated`) além das políticas de RLS.
- Segredos (Pluggy, service_role) só em Edge Functions, nunca no front nem no Git.
  A `anon key` do Supabase pode ficar no front (é pública por design).
- Cores sempre por variáveis CSS do tema (`css/estilo.css`).
- Ao terminar uma etapa: teste, me mostre como testar e sugira a mensagem de commit.
- Não fazer commit, push, deploy nem `supabase db push` sem eu pedir.

## Estrutura

- `index.html`: tela de login.
- `dashboard.html`, `agenda.html`, `lembretes.html`, `anotacoes.html`,
  `financas.html`: páginas do site, todas com o mesmo menu.
- `css/estilo.css`: variáveis de tema e estilos comuns.
- `js/config.js`: URL e anon key do Supabase (públicas).
- `js/menu.js`: monta o menu lateral/inferior em todas as páginas.
- `supabase/`: `config.toml`, migrações (`migrations/`) e Edge Functions
  (`functions/`). Projeto ligado: `ajuwvwdomqifgtozutls` (São Paulo).
- `tests/`: testes das funções puras, rodam com `node --test`.

## Comandos

- Supabase CLI sempre via `npx supabase ...` (não está instalado global).
- Servir o site localmente: `npx serve .` ou a extensão Live Server do VS Code.
- Testes: `node --test`

## Etapas

1. Estrutura de páginas e menu
2. Login e perfis (`profiles.can_see_finance`)
3. Banco e RLS (`events`, `reminders`, `notes`)
4. Agenda (FullCalendar via CDN)
5. Lembretes e anotações
6. Personalização de cores
7. Dashboard inicial
8. Pluggy em sandbox, depois revisão de segurança, depois banco real
