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
- Grant de coluna (`grant update (col)`) não tira um grant de tabela que já
  exista. Para restringir colunas, faça `revoke all ... from anon,
  authenticated` antes. Os default privileges do schema public já foram
  zerados (migração `travar_permissoes`); funções novas chamadas pelo site
  também precisam de `grant execute` explícito.
- Toda tabela nova entra no `supabase/tests/rls_test.sql`.
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
- `js/sessao.js`: cliente Supabase, `protegerPagina()` (redireciona quem não
  está logado, carrega o perfil, monta o menu) e o botão Sair.
- `js/agenda.js`: FullCalendar 6.1.22 via CDN (a 7 mudou a API) ligado à
  tabela `events`. Fim de evento de dia inteiro é exclusivo (padrão do
  FullCalendar); o formulário mostra o último dia inclusivo.
- `js/lembretes.js`: abas hoje (inclui atrasados) / próximos (inclui sem
  data) / feitos. `js/notificacoes.js`: avisa lembretes na hora, em qualquer
  página aberta (carregar antes do sessao.js).
- `js/anotacoes.js`: lista + editor com salvamento automático (debounce de
  800 ms via `comAtraso`).
- `js/tema.js`: carregado no `<head>` de todas as páginas. 6 paletas
  (claro/escuro), modo auto/claro/escuro e destaque livre. Aplica as
  variáveis CSS inline; salva em `localStorage` e em `profiles.tema` (o
  perfil vence). O teste `tests/tema.test.js` exige contraste mínimo em
  todas as paletas: paleta nova precisa passar nele.
  Modo `personalizado`: a pessoa escolhe fundo (degradê opcional), barra
  lateral (`--cor-menu`) e painéis (`--cor-cartao`); o texto de cada
  superfície é calculado (`--cor-texto-cartao`, `--cor-texto-menu`...).
  No CSS, `.cartao`, `.dialogo`, `.menu` etc. trocam `--cor-texto` para o
  da sua superfície; campos usam `--cor-campo`, nunca `--cor-fundo`.
- `js/inicio.js` (dashboard.html): saudação com nome editável e cartões de
  eventos de hoje, lembretes de hoje, notas fixadas e finanças (só com
  `can_see_finance`). Reaproveita funções de lembretes.js e anotacoes.js.
- Para testar páginas sem login: criar um `teste-*.html` temporário com um
  Supabase falso e apagar depois (nunca commitar).
- Site publicado: https://khannnn1.github.io/khanru-dashboards/ (branch `main`).
- `profiles.can_see_finance` só muda por SQL no painel: o grant de update
  cobre só `nome` e `tema`.
- `supabase/`: `config.toml`, migrações (`migrations/`) e Edge Functions
  (`functions/`). Projeto ligado: `ajuwvwdomqifgtozutls` (São Paulo).
- `tests/`: testes das funções puras, rodam com `node --test`.
- `supabase/tests/rls_test.sql`: teste de RLS; colar no SQL Editor e rodar
  (faz rollback, não deixa nada salvo). Atualizar a cada tabela nova.
- Tabelas: `events` e `reminders` (dono faz tudo, parceiro só lê se
  `shared`), `notes` (sempre privadas). Colunas em português, exceto
  `owner_id` e `shared`.

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
