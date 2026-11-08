// Testes das funções puras da agenda. Rodar com: node --test
const { test } = require("node:test");
const assert = require("node:assert");
const {
  paraInputData,
  deInputData,
  eventoParaFormulario,
  formularioParaLinha,
  linhaParaEvento,
  coresPorDia,
  chaveDia,
  semanasDoMes,
  agruparPorDia,
} = require("../js/agenda.js");

// Datas criadas no horário local, igual ao que o navegador faz.
const dia7as14h = new Date(2026, 10, 7, 14, 30);
const dia7 = new Date(2026, 10, 7);
const dia8 = new Date(2026, 10, 8);

test("paraInputData formata data com e sem horário", () => {
  assert.strictEqual(paraInputData(dia7as14h, false), "2026-11-07T14:30");
  assert.strictEqual(paraInputData(dia7as14h, true), "2026-11-07");
});

test("deInputData lê o texto dos inputs no horário local", () => {
  assert.strictEqual(deInputData("2026-11-07", true).getTime(), dia7.getTime());
  assert.strictEqual(deInputData("2026-11-07T14:30", false).getTime(), dia7as14h.getTime());
  assert.strictEqual(deInputData("", false), null);
  assert.strictEqual(deInputData("bobagem", false), null);
});

test("evento de dia inteiro mostra o último dia de verdade no formulário", () => {
  // No FullCalendar, evento só no dia 7 termina no dia 8 (fim exclusivo).
  const valores = eventoParaFormulario({ title: "Aniversário", start: dia7, end: dia8, allDay: true, extendedProps: {} });
  assert.strictEqual(valores.inicio, "2026-11-07");
  assert.strictEqual(valores.fim, "2026-11-07");
  assert.strictEqual(valores.diaInteiro, true);
});

test("formularioParaLinha devolve o fim exclusivo para dia inteiro", () => {
  const { linha } = formularioParaLinha({ titulo: " Viagem ", diaInteiro: true, inicio: "2026-11-07", fim: "2026-11-07" });
  assert.strictEqual(linha.titulo, "Viagem");
  assert.strictEqual(linha.inicio, dia7.toISOString());
  assert.strictEqual(linha.fim, dia8.toISOString());
  assert.strictEqual(linha.dia_inteiro, true);
});

test("ida e volta formulário -> linha -> formulário não muda as datas", () => {
  const original = { titulo: "Cinema", diaInteiro: false, inicio: "2026-11-07T19:00", fim: "2026-11-07T21:30", cor: "#3d6fb0", compartilhar: true };
  const { linha } = formularioParaLinha(original);
  const evento = linhaParaEvento({ ...linha, id: "1", owner_id: "eu" }, "eu");
  const volta = eventoParaFormulario({
    title: evento.title,
    start: new Date(evento.start),
    end: new Date(evento.end),
    allDay: evento.allDay,
    extendedProps: evento.extendedProps,
  });
  assert.deepStrictEqual(volta, original);
});

test("formularioParaLinha recusa dados inválidos", () => {
  assert.ok(formularioParaLinha({ titulo: "  ", inicio: "2026-11-07T10:00" }).erro);
  assert.ok(formularioParaLinha({ titulo: "x".repeat(201), inicio: "2026-11-07T10:00" }).erro);
  assert.ok(formularioParaLinha({ titulo: "Sem data", inicio: "" }).erro);
  const fimAntes = formularioParaLinha({ titulo: "Errado", inicio: "2026-11-07T10:00", fim: "2026-11-07T09:00" });
  assert.strictEqual(fimAntes.erro, "O fim precisa ser depois do início.");
});

test("formularioParaLinha aceita evento sem fim e sem cor", () => {
  const { linha } = formularioParaLinha({ titulo: "Dentista", diaInteiro: false, inicio: "2026-11-07T14:30" });
  assert.strictEqual(linha.fim, null);
  assert.strictEqual(linha.cor, null);
  assert.strictEqual(linha.shared, false);
});

test("linhaParaEvento: evento do parceiro é só leitura e marcado", () => {
  const linha = { id: "1", owner_id: "parceiro", titulo: "Jantar", inicio: "x", fim: null, dia_inteiro: false, cor: null, shared: true };
  const evento = linhaParaEvento(linha, "eu");
  assert.strictEqual(evento.editable, false);
  assert.strictEqual(evento.title, "💞 Jantar");
  assert.deepStrictEqual(evento.classNames, ["evento-parceiro"]);
  assert.strictEqual(evento.extendedProps.tituloOriginal, "Jantar");
});

test("linhaParaEvento: evento meu é editável e usa a cor escolhida", () => {
  const linha = { id: "2", owner_id: "eu", titulo: "Academia", inicio: "x", fim: null, dia_inteiro: false, cor: "#3f8a5c", shared: false };
  const evento = linhaParaEvento(linha, "eu");
  assert.strictEqual(evento.editable, true);
  assert.strictEqual(evento.title, "Academia");
  assert.strictEqual(evento.extendedProps.cor, "#3f8a5c");
});

test("chaveDia usa o dia local", () => {
  assert.strictEqual(chaveDia(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("semanasDoMes cobre o mês em 6 semanas começando no domingo", () => {
  const semanas = semanasDoMes(2026, 10); // novembro de 2026 começa num domingo
  assert.strictEqual(semanas.length, 6);
  assert.ok(semanas.every((s) => s.length === 7));
  assert.strictEqual(chaveDia(semanas[0][0]), "2026-11-01");
  assert.ok(semanas.flat().every((d, i) => d.getDay() === i % 7));
  const fev = semanasDoMes(2026, 1); // fevereiro de 2026 começa num domingo também
  assert.strictEqual(chaveDia(fev[0][0]), "2026-02-01");
  const out = semanasDoMes(2026, 9); // outubro de 2026 começa numa quinta
  assert.strictEqual(chaveDia(out[0][0]), "2026-09-27");
});

test("agruparPorDia separa hoje, amanhã e outros dias, em ordem", () => {
  const agora = new Date(2026, 10, 7, 15, 0);
  const em = (dia, hora) => new Date(2026, 10, dia, hora).toISOString();
  const grupos = agruparPorDia(
    [
      { id: "c", inicio: em(10, 9) },
      { id: "a", inicio: em(7, 20) },
      { id: "b", inicio: em(8, 8) },
      { id: "viagem", inicio: em(5, 0) },
      { id: "a2", inicio: em(7, 21) },
    ],
    agora
  );
  assert.deepStrictEqual(grupos.map((g) => g.rotulo).slice(0, 2), ["Hoje", "Amanhã"]);
  assert.deepStrictEqual(grupos[0].eventos.map((e) => e.id), ["viagem", "a", "a2"]);
  assert.match(grupos[2].rotulo, /10/);
  assert.strictEqual(grupos.length, 3);
});

test("coresPorDia pinta cada dia com a cor do primeiro evento", () => {
  const d = (dia, hora = 0, min = 0) => new Date(2026, 10, dia, hora, min);
  const mapa = coresPorDia([
    { start: d(7, 20), end: d(7, 22), cor: "#3f8a5c" },
    { start: d(7, 9), end: null, cor: null },
    { start: d(10), end: d(13), cor: "#3d6fb0" }, // dia inteiro de 10 a 12 (fim exclusivo)
    { start: d(14, 23), end: d(15, 1), cor: "#d0603f" }, // vira a noite
  ]);
  assert.strictEqual(mapa.get("2026-11-07"), null); // o das 9h vem primeiro e não tem cor
  assert.deepStrictEqual(
    ["2026-11-10", "2026-11-11", "2026-11-12"].map((k) => mapa.get(k)),
    ["#3d6fb0", "#3d6fb0", "#3d6fb0"]
  );
  assert.strictEqual(mapa.has("2026-11-13"), false);
  assert.strictEqual(mapa.get("2026-11-15"), "#d0603f");
  assert.strictEqual(mapa.has("2026-11-08"), false);
});
