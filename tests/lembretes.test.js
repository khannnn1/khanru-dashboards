// Testes das funções puras dos lembretes e notificações. Rodar com: node --test
const { test } = require("node:test");
const assert = require("node:assert");
const {
  classificarLembrete,
  estaAtrasado,
  filtrarLembretes,
  contarPorAba,
  formatarQuando,
  novoLembrete,
} = require("../js/lembretes.js");
const { lembretesParaAvisar } = require("../js/notificacoes.js");

// "Agora" fixo: sábado, 7 de novembro de 2026, 15:00 (horário local).
const agora = new Date(2026, 10, 7, 15, 0);
const em = (dia, hora, minuto = 0) => new Date(2026, 10, dia, hora, minuto).toISOString();

test("classificarLembrete separa hoje, próximos e feitos", () => {
  assert.strictEqual(classificarLembrete({ feito: false, quando: em(7, 20) }, agora), "hoje");
  assert.strictEqual(classificarLembrete({ feito: false, quando: em(8, 9) }, agora), "proximos");
  assert.strictEqual(classificarLembrete({ feito: false, quando: null }, agora), "proximos");
  assert.strictEqual(classificarLembrete({ feito: true, quando: em(7, 20) }, agora), "feitos");
});

test("lembrete atrasado de outro dia continua aparecendo em hoje", () => {
  const atrasado = { feito: false, quando: em(5, 10) };
  assert.strictEqual(classificarLembrete(atrasado, agora), "hoje");
  assert.strictEqual(estaAtrasado(atrasado, agora), true);
  assert.strictEqual(estaAtrasado({ feito: true, quando: em(5, 10) }, agora), false);
  assert.strictEqual(estaAtrasado({ feito: false, quando: null }, agora), false);
});

test("filtrarLembretes ordena por data com os sem data no fim", () => {
  const lista = [
    { id: "sem", feito: false, quando: null },
    { id: "dia9", feito: false, quando: em(9, 8) },
    { id: "dia8", feito: false, quando: em(8, 8) },
  ];
  const ids = filtrarLembretes(lista, "proximos", agora).map((l) => l.id);
  assert.deepStrictEqual(ids, ["dia8", "dia9", "sem"]);
});

test("filtrarLembretes mostra os feitos mais recentes primeiro", () => {
  const lista = [
    { id: "antigo", feito: true, atualizado_em: em(1, 8) },
    { id: "novo", feito: true, atualizado_em: em(6, 8) },
  ];
  assert.deepStrictEqual(filtrarLembretes(lista, "feitos", agora).map((l) => l.id), ["novo", "antigo"]);
});

test("contarPorAba conta cada aba", () => {
  const lista = [
    { feito: false, quando: em(7, 18) },
    { feito: false, quando: null },
    { feito: true, quando: null },
    { feito: true, quando: null },
  ];
  assert.deepStrictEqual(contarPorAba(lista, agora), { hoje: 1, proximos: 1, feitos: 2 });
});

test("formatarQuando usa hoje, amanhã e ontem", () => {
  assert.strictEqual(formatarQuando(em(7, 9, 5), agora), "Hoje, 09:05");
  assert.strictEqual(formatarQuando(em(8, 18), agora), "Amanhã, 18:00");
  assert.strictEqual(formatarQuando(em(6, 7, 30), agora), "Ontem, 07:30");
  assert.strictEqual(formatarQuando(null, agora), "Sem data");
  assert.match(formatarQuando(em(20, 10), agora), /20.*nov.*10:00/);
});

test("novoLembrete valida e monta a linha", () => {
  assert.ok(novoLembrete({ texto: "   " }).erro);
  assert.ok(novoLembrete({ texto: "x".repeat(501) }).erro);
  const { linha } = novoLembrete({ texto: " Pagar luz ", quando: "2026-11-10T09:00", compartilhar: true });
  assert.strictEqual(linha.texto, "Pagar luz");
  assert.strictEqual(linha.quando, new Date(2026, 10, 10, 9, 0).toISOString());
  assert.strictEqual(linha.shared, true);
  assert.strictEqual(novoLembrete({ texto: "Sem data" }).linha.quando, null);
});

test("lembretesParaAvisar só avisa os meus, na hora, e uma vez", () => {
  const lista = [
    { id: "agora", owner_id: "eu", feito: false, quando: em(7, 14, 59) },
    { id: "futuro", owner_id: "eu", feito: false, quando: em(7, 16) },
    { id: "velho", owner_id: "eu", feito: false, quando: em(7, 12) },
    { id: "feito", owner_id: "eu", feito: true, quando: em(7, 14, 59) },
    { id: "do-par", owner_id: "par", feito: false, quando: em(7, 14, 59) },
    { id: "avisado", owner_id: "eu", feito: false, quando: em(7, 14, 50) },
  ];
  const ids = lembretesParaAvisar(lista, agora, ["avisado"], "eu").map((l) => l.id);
  assert.deepStrictEqual(ids, ["agora"]);
});
