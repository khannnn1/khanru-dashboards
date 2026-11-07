// Testes das funções puras do login. Rodar com: node --test
const { test } = require("node:test");
const assert = require("node:assert");
const { podeAcessarPagina, traduzirErroLogin } = require("../js/sessao.js");

test("páginas comuns são liberadas para qualquer perfil", () => {
  assert.strictEqual(podeAcessarPagina("agenda.html", { can_see_finance: false }), true);
  assert.strictEqual(podeAcessarPagina("dashboard.html", null), true);
});

test("finanças exige can_see_finance verdadeiro", () => {
  assert.strictEqual(podeAcessarPagina("financas.html", { can_see_finance: true }), true);
  assert.strictEqual(podeAcessarPagina("financas.html", { can_see_finance: false }), false);
});

test("finanças fica bloqueada se o perfil não carregou", () => {
  assert.strictEqual(podeAcessarPagina("financas.html", null), false);
  assert.strictEqual(podeAcessarPagina("financas.html", {}), false);
});

test("traduzirErroLogin traduz senha errada", () => {
  const erro = { message: "Invalid login credentials" };
  assert.strictEqual(traduzirErroLogin(erro), "E-mail ou senha incorretos.");
});

test("traduzirErroLogin tem mensagem padrão para erros desconhecidos", () => {
  assert.strictEqual(traduzirErroLogin({ message: "algo estranho" }), "Não foi possível entrar. Tente de novo.");
  assert.strictEqual(traduzirErroLogin(null), "Não foi possível entrar. Tente de novo.");
});
