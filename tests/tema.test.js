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
  const vazio = normalizarTema(null);
  assert.strictEqual(vazio.paleta, "rosa");
  assert.strictEqual(vazio.modo, "auto");
  assert.strictEqual(vazio.destaque, null);
  assert.strictEqual(vazio.personalizado.fundo2, null);

  const ruim = normalizarTema({ paleta: "toString", modo: "neon", destaque: "red", personalizado: { fundo: "azul", menu: 3 } });
  assert.strictEqual(ruim.paleta, "rosa");
  assert.strictEqual(ruim.modo, "auto");
  assert.strictEqual(ruim.destaque, null);
  assert.ok(/^#[0-9a-f]{6}$/.test(ruim.personalizado.fundo));
  assert.ok(/^#[0-9a-f]{6}$/.test(ruim.personalizado.menu));

  const bom = normalizarTema({ paleta: "oceano", modo: "personalizado", destaque: "#AABBCC", personalizado: { fundo: "#112233", fundo2: "#445566", menu: "#ffffff", cartao: "#EEEEEE" } });
  assert.strictEqual(bom.modo, "personalizado");
  assert.strictEqual(bom.destaque, "#aabbcc");
  assert.deepStrictEqual(bom.personalizado, { fundo: "#112233", fundo2: "#445566", menu: "#ffffff", cartao: "#eeeeee" });
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

// ---------- Modo Personalizado ----------

test("personalizado: cada superfície ganha a cor de texto certa", () => {
  const vars = variaveisDoTema({
    modo: "personalizado",
    personalizado: { fundo: "#ffd6e8", menu: "#1b1f3b", cartao: "#ffffff" },
  }, false);
  assert.strictEqual(vars["--cor-menu"], "#1b1f3b");
  assert.strictEqual(vars["--cor-cartao"], "#ffffff");
  assert.strictEqual(vars["--cor-texto-menu"], "#f7f2ef"); // menu escuro -> letra clara
  assert.strictEqual(vars["--cor-texto-cartao"], "#1f1a1c"); // painel claro -> letra escura
  assert.strictEqual(vars["--fundo-imagem"], "none");
});

test("personalizado: degradê vira linear-gradient e o texto serve nas duas cores", () => {
  const vars = variaveisDoTema({
    modo: "personalizado",
    personalizado: { fundo: "#2b1055", fundo2: "#7597de", menu: "#2b1055", cartao: "#1c1433" },
  }, false);
  assert.strictEqual(vars["--fundo-imagem"], "linear-gradient(160deg, #2b1055, #7597de)");
  // Cores tão diferentes que nenhuma letra passa 4.5 nas duas: usa branco
  // puro com sombra nos títulos.
  assert.strictEqual(vars["--cor-texto"], "#ffffff");
  assert.notStrictEqual(vars["--sombra-texto-fundo"], "none");

  const suave = variaveisDoTema({
    modo: "personalizado",
    personalizado: { fundo: "#1a1a2e", fundo2: "#16213e", menu: "#0f3460", cartao: "#1f1f38" },
  }, false);
  assert.strictEqual(suave["--sombra-texto-fundo"], "none");
});

test("temas prontos não usam degradê e repetem o texto em todas as superfícies", () => {
  const vars = variaveisDoTema({ paleta: "oceano", modo: "claro" }, false);
  assert.strictEqual(vars["--fundo-imagem"], "none");
  assert.strictEqual(vars["--cor-texto-menu"], vars["--cor-texto"]);
  assert.strictEqual(vars["--cor-texto-cartao"], vars["--cor-texto"]);
});

// Sorteia 300 combinações (sempre as mesmas) e confere que tudo fica legível.
test("personalizado: qualquer combinação de cores continua legível", () => {
  let semente = 42;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  const corAleatoria = () =>
    "#" + [0, 0, 0].map(() => Math.floor(aleatorio() * 256).toString(16).padStart(2, "0")).join("");

  for (let i = 0; i < 300; i++) {
    const p = { fundo: corAleatoria(), menu: corAleatoria(), cartao: corAleatoria() };
    const vars = variaveisDoTema({ modo: "personalizado", personalizado: p }, false);
    const pares = [
      ["--cor-texto-cartao", p.cartao, 4.5],
      ["--cor-texto-suave-cartao", p.cartao, 4.5],
      ["--cor-texto-menu", p.menu, 4.5],
      ["--cor-texto-suave-menu", p.menu, 4.5],
      ["--cor-texto", p.fundo, 4.5],
      ["--cor-texto-suave", p.fundo, 4.5],
    ];
    for (const [variavel, fundo, minimo] of pares) {
      const valor = contraste(vars[variavel], fundo);
      assert.ok(valor >= minimo, `${variavel} sobre ${fundo}: ${valor.toFixed(2)}`);
    }
  }
});
