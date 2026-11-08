// Testes das funções puras da tela inicial. Rodar com: node --test
const { test } = require("node:test");
const assert = require("node:assert");
const { saudacao, eventosDoDia, horarioEvento } = require("../js/inicio.js");

const agora = new Date(2026, 10, 7, 15, 0); // sábado, 7/nov, 15:00
const em = (dia, hora, minuto = 0) => new Date(2026, 10, dia, hora, minuto).toISOString();

test("saudacao muda com a hora e usa só o primeiro nome", () => {
  assert.strictEqual(saudacao(new Date(2026, 10, 7, 8), "Felipe Cardoso"), "Bom dia, Felipe!");
  assert.strictEqual(saudacao(new Date(2026, 10, 7, 14), "Carol"), "Boa tarde, Carol!");
  assert.strictEqual(saudacao(new Date(2026, 10, 7, 21), ""), "Boa noite!");
  assert.strictEqual(saudacao(new Date(2026, 10, 7, 2), null), "Boa noite!");
});

test("eventosDoDia pega só o que acontece hoje, dia inteiro primeiro", () => {
  const linhas = [
    { id: "tarde", inicio: em(7, 16), fim: null, dia_inteiro: false },
    { id: "manha", inicio: em(7, 9), fim: em(7, 10), dia_inteiro: false },
    { id: "diaTodo", inicio: em(7, 0), fim: em(8, 0), dia_inteiro: true },
    { id: "amanha", inicio: em(8, 9), fim: null, dia_inteiro: false },
    { id: "ontem", inicio: em(6, 9), fim: em(6, 10), dia_inteiro: false },
    { id: "viagem", inicio: em(5, 0), fim: em(9, 0), dia_inteiro: true },
    { id: "madrugada", inicio: em(6, 23), fim: em(7, 1), dia_inteiro: false },
  ];
  const ids = eventosDoDia(linhas, agora).map((e) => e.id);
  assert.deepStrictEqual(ids, ["viagem", "diaTodo", "madrugada", "manha", "tarde"]);
});

test("eventosDoDia ignora evento de dia inteiro que terminou ontem", () => {
  // Dia inteiro só no dia 6: fim exclusivo = dia 7 à meia-noite.
  const linhas = [{ id: "so6", inicio: em(6, 0), fim: em(7, 0), dia_inteiro: true }];
  assert.deepStrictEqual(eventosDoDia(linhas, agora), []);
});

test("horarioEvento mostra o intervalo ou dia inteiro", () => {
  assert.strictEqual(horarioEvento({ dia_inteiro: true, inicio: em(7, 0) }), "Dia inteiro");
  assert.strictEqual(horarioEvento({ dia_inteiro: false, inicio: em(7, 9), fim: em(7, 10, 30) }), "09:00 – 10:30");
  assert.strictEqual(horarioEvento({ dia_inteiro: false, inicio: em(7, 14, 5), fim: null }), "14:05");
});
