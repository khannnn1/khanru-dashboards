// Testes das funções puras do tema. Rodar com: node --test
const { test } = require("node:test");
const assert = require("node:assert");
const {
  PALETAS,
  hexParaRgb,
  contraste,
  escurecer,
  corDeTextoSobre,
  normalizarTema,
  resolverModo,
  variaveisDoTema,
  destaqueTemPoucoContraste,
} = require("../js/tema.js");

test("hexParaRgb e contraste seguem a fórmula das normas", () => {
  assert.deepStrictEqual(hexParaRgb("#ff8000"), [255, 128, 0]);
  assert.strictEqual(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.strictEqual(contraste("#777777", "#777777"), 1);
});

test("escurecer mistura com preto", () => {
  assert.strictEqual(escurecer("#ffffff", 0.5), "#808080");
  assert.strictEqual(escurecer("#123456", 0), "#123456");
});

test("corDeTextoSobre escolhe branco no escuro e escuro no claro", () => {
  assert.strictEqual(corDeTextoSobre("#1d3557"), "#ffffff");
  assert.strictEqual(corDeTextoSobre("#ffe066"), "#1a1416");
});

test("normalizarTema corrige valores inválidos ou vazios", () => {
  assert.deepStrictEqual(normalizarTema(null), { paleta: "rosa", modo: "auto", destaque: null });
  assert.deepStrictEqual(
    normalizarTema({ paleta: "toString", modo: "neon", destaque: "red" }),
    { paleta: "rosa", modo: "auto", destaque: null }
  );
  assert.deepStrictEqual(
    normalizarTema({ paleta: "oceano", modo: "escuro", destaque: "#AABBCC" }),
    { paleta: "oceano", modo: "escuro", destaque: "#aabbcc" }
  );
});

test("resolverModo respeita a escolha e usa o sistema no automático", () => {
  assert.strictEqual(resolverModo("claro", true), "claro");
  assert.strictEqual(resolverModo("escuro", false), "escuro");
  assert.strictEqual(resolverModo("auto", true), "escuro");
  assert.strictEqual(resolverModo("auto", false), "claro");
});

test("variaveisDoTema usa a cor de destaque livre quando existe", () => {
  const vars = variaveisDoTema({ paleta: "floresta", modo: "claro", destaque: "#1d3557" }, false);
  assert.strictEqual(vars["--cor-destaque"], "#1d3557");
  assert.strictEqual(vars["--cor-texto-no-destaque"], "#ffffff");
  assert.strictEqual(vars["--cor-fundo"], PALETAS.floresta.claro.fundo);
  assert.strictEqual(vars["color-scheme"], "light");
});

test("destaqueTemPoucoContraste avisa sobre cor clara em tema claro", () => {
  assert.strictEqual(destaqueTemPoucoContraste({ paleta: "rosa", modo: "claro", destaque: "#fff3b0" }, false), true);
  assert.strictEqual(destaqueTemPoucoContraste({ paleta: "rosa", modo: "claro" }, false), false);
});

// Garante que todas as paletas prontas são legíveis, nos dois modos.
for (const [chave, paleta] of Object.entries(PALETAS)) {
  for (const modo of ["claro", "escuro"]) {
    test(`paleta ${chave} (${modo}) tem contraste legível`, () => {
      const c = paleta[modo];
      const vars = variaveisDoTema({ paleta: chave, modo }, false);
      assert.ok(contraste(c.texto, c.cartao) >= 7, "texto sobre cartão");
      assert.ok(contraste(c.textoSuave, c.cartao) >= 4.5, "texto suave sobre cartão");
      assert.ok(contraste(c.textoSuave, c.fundo) >= 4.5, "texto suave sobre fundo");
      assert.ok(contraste(c.destaque, c.cartao) >= 3, "destaque sobre cartão");
      assert.ok(contraste(vars["--cor-texto-no-destaque"], c.destaque) >= 4.5, "texto dentro do botão");
    });
  }
}
