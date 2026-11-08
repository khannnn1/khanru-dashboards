// Testes das funções puras das anotações. Rodar com: node --test
const { test } = require("node:test");
const assert = require("node:assert");
const { normalizarTexto, filtrarNotas, resumoNota, comAtraso } = require("../js/anotacoes.js");

const notas = [
  { id: "1", titulo: "Mercado", conteudo: "arroz\nfeijão", fixada: false, atualizado_em: "2026-11-05T10:00:00Z" },
  { id: "2", titulo: "Viagem", conteudo: "Visitar a avó", fixada: true, atualizado_em: "2026-11-01T10:00:00Z" },
  { id: "3", titulo: "", conteudo: "Ideias de presente", fixada: false, atualizado_em: "2026-11-07T10:00:00Z" },
];

test("normalizarTexto ignora acentos e maiúsculas", () => {
  assert.strictEqual(normalizarTexto("Feijão AVÓ"), "feijao avo");
  assert.strictEqual(normalizarTexto(null), "");
});

test("filtrarNotas sem busca põe fixadas primeiro e depois as mais recentes", () => {
  assert.deepStrictEqual(filtrarNotas(notas, "").map((n) => n.id), ["2", "3", "1"]);
});

test("filtrarNotas busca no título e no texto, sem acento", () => {
  assert.deepStrictEqual(filtrarNotas(notas, "feijao").map((n) => n.id), ["1"]);
  assert.deepStrictEqual(filtrarNotas(notas, "AVO").map((n) => n.id), ["2"]);
  assert.deepStrictEqual(filtrarNotas(notas, "zzz"), []);
});

test("filtrarNotas não muda a lista original", () => {
  const copia = notas.map((n) => n.id);
  filtrarNotas(notas, "");
  assert.deepStrictEqual(notas.map((n) => n.id), copia);
});

test("resumoNota usa o título ou a primeira linha do texto", () => {
  assert.deepStrictEqual(resumoNota(notas[0]), { titulo: "Mercado", trecho: "arroz feijão" });
  assert.deepStrictEqual(resumoNota(notas[2]), { titulo: "Ideias de presente", trecho: "" });
  assert.deepStrictEqual(resumoNota({ titulo: " ", conteudo: "" }), { titulo: "Nota sem título", trecho: "" });
});

test("comAtraso chama só uma vez, com os últimos valores", async () => {
  const chamadas = [];
  const salvar = comAtraso((valor) => chamadas.push(valor), 20);
  salvar("a");
  salvar("ab");
  salvar("abc");
  await new Promise((r) => setTimeout(r, 50));
  assert.deepStrictEqual(chamadas, ["abc"]);
});

test("comAtraso.agora executa o pendente na hora e cancelar descarta", () => {
  const chamadas = [];
  const salvar = comAtraso((valor) => chamadas.push(valor), 1000);
  salvar("pendente");
  salvar.agora();
  salvar.agora(); // nada pendente: não chama de novo
  salvar("descartado");
  salvar.cancelar();
  assert.deepStrictEqual(chamadas, ["pendente"]);
});
