// Testes das funções puras do menu. Rodar com: node --test
const { test } = require("node:test");
const assert = require("node:assert");
const { ITENS_MENU, nomeDaPagina, itensVisiveis } = require("../js/menu.js");

test("nomeDaPagina pega o arquivo no fim do caminho", () => {
  assert.strictEqual(nomeDaPagina("/khanru-dashboards/agenda.html"), "agenda.html");
  assert.strictEqual(nomeDaPagina("/notas/anotacoes.html?id=3#topo"), "anotacoes.html");
});

test("nomeDaPagina trata a raiz como a tela de login", () => {
  assert.strictEqual(nomeDaPagina("/"), "index.html");
  assert.strictEqual(nomeDaPagina("/khanru-dashboards/"), "index.html");
});

test("itensVisiveis esconde Finanças de quem não tem acesso", () => {
  const hrefs = itensVisiveis(ITENS_MENU, false).map((i) => i.href);
  assert.ok(!hrefs.includes("financas.html"));
  assert.strictEqual(hrefs.length, ITENS_MENU.length - 1);
});

test("itensVisiveis mostra Finanças para quem tem acesso", () => {
  const hrefs = itensVisiveis(ITENS_MENU, true).map((i) => i.href);
  assert.ok(hrefs.includes("financas.html"));
});
