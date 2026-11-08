// Agenda: calendário (FullCalendar) ligado à tabela "events" do Supabase.

// Cores que a pessoa pode escolher para um evento. null = cor do tema.
const CORES_EVENTO = [
  { nome: "Do tema", valor: null },
  { nome: "Rosa", valor: "#c9566c" },
  { nome: "Coral", valor: "#d0603f" },
  { nome: "Mostarda", valor: "#9a7400" },
  { nome: "Verde", valor: "#3f8a5c" },
  { nome: "Azul", valor: "#3d6fb0" },
  { nome: "Roxo", valor: "#7d4fb8" },
];

// ---------- Funções puras (testadas em tests/agenda.test.js) ----------

function doisDigitos(numero) {
  return String(numero).padStart(2, "0");
}

function somarDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

// Date -> texto para <input type="date"> ou <input type="datetime-local">,
// sempre no horário local de quem está usando.
function paraInputData(data, diaInteiro) {
  const dia = `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
  if (diaInteiro) return dia;
  return `${dia}T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
}

// Texto do input -> Date local. "2026-11-07" vira meia-noite daquele dia.
function deInputData(texto, diaInteiro) {
  if (!texto) return null;
  const data = diaInteiro ? new Date(`${texto.slice(0, 10)}T00:00`) : new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data;
}

// No FullCalendar, o fim de um evento de dia inteiro é "exclusivo":
// um evento só no dia 7 tem fim = dia 8 à meia-noite. No formulário
// mostramos o último dia "de verdade" (inclusivo), por isso o -1 / +1.
function eventoParaFormulario(evento) {
  const diaInteiro = Boolean(evento.allDay);
  let fim = "";
  if (evento.end) {
    fim = paraInputData(diaInteiro ? somarDias(evento.end, -1) : evento.end, diaInteiro);
  }
  return {
    titulo: evento.title || "",
    diaInteiro,
    inicio: paraInputData(evento.start, diaInteiro),
    fim,
    cor: (evento.extendedProps && evento.extendedProps.cor) || null,
    compartilhar: Boolean(evento.extendedProps && evento.extendedProps.shared),
  };
}

// Valores do formulário -> linha para salvar no banco.
// Devolve { erro: "mensagem" } ou { linha: {...} }.
function formularioParaLinha(valores) {
  const titulo = (valores.titulo || "").trim();
  if (!titulo) return { erro: "Dê um nome ao evento." };
  if (titulo.length > 200) return { erro: "O nome pode ter no máximo 200 letras." };

  const inicio = deInputData(valores.inicio, valores.diaInteiro);
  if (!inicio) return { erro: "Escolha quando o evento começa." };

  let fim = null;
  if (valores.fim) {
    fim = deInputData(valores.fim, valores.diaInteiro);
    if (!fim) return { erro: "A data de fim é inválida." };
    if (valores.diaInteiro) fim = somarDias(fim, 1); // volta a ser exclusivo
    if (fim < inicio) return { erro: "O fim precisa ser depois do início." };
  }

  return {
    linha: {
      titulo,
      inicio: inicio.toISOString(),
      fim: fim ? fim.toISOString() : null,
      dia_inteiro: Boolean(valores.diaInteiro),
      cor: valores.cor || null,
      shared: Boolean(valores.compartilhar),
    },
  };
}

// Linha do banco -> evento do FullCalendar.
// Eventos do parceiro aparecem, mas não podem ser arrastados nem editados.
function linhaParaEvento(linha, usuarioId) {
  const meu = linha.owner_id === usuarioId;
  const evento = {
    id: linha.id,
    title: meu ? linha.titulo : `💞 ${linha.titulo}`,
    start: linha.inicio,
    end: linha.fim,
    allDay: linha.dia_inteiro,
    editable: meu,
    classNames: meu ? [] : ["evento-parceiro"],
    extendedProps: { meu, shared: linha.shared, cor: linha.cor, tituloOriginal: linha.titulo },
  };
  return evento;
}

// "2026-11-07": chave de um dia no horário local (para marcar dias com evento).
function chaveDia(data) {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

// Para cada dia com evento, a cor que vai pintar a célula: a do primeiro
// evento do dia (eventos sem cor usam null = cor de destaque do tema).
// Recebe objetos com start, end (Date ou null) e cor.
function coresPorDia(eventos) {
  const mapa = new Map();
  const ordenados = [...eventos].sort((a, b) => a.start - b.start);
  for (const evento of ordenados) {
    const fim = evento.end || evento.start;
    let dia = new Date(evento.start.getFullYear(), evento.start.getMonth(), evento.start.getDate());
    do {
      const chave = chaveDia(dia);
      if (!mapa.has(chave)) mapa.set(chave, evento.cor || null);
      dia = somarDias(dia, 1);
    } while (dia < fim);
  }
  return mapa;
}

// 6 semanas (domingo a sábado) que cobrem o mês, para o mini calendário.
function semanasDoMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  const inicio = somarDias(primeiro, -primeiro.getDay());
  const semanas = [];
  for (let s = 0; s < 6; s++) {
    const semana = [];
    for (let d = 0; d < 7; d++) semana.push(somarDias(inicio, s * 7 + d));
    semanas.push(semana);
  }
  return semanas;
}

// Agrupa os próximos eventos por dia: "Hoje", "Amanhã" ou "seg., 9 de nov.".
function agruparPorDia(linhas, agora) {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const grupos = new Map();
  const ordenadas = [...linhas].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  for (const linha of ordenadas) {
    const inicio = new Date(linha.inicio);
    // Evento que começou antes de hoje (ex.: viagem) aparece em "Hoje".
    const dia = inicio < hoje ? hoje : new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const chave = chaveDia(dia);
    if (!grupos.has(chave)) {
      const diferenca = Math.round((dia - hoje) / 86400000);
      const rotulo =
        diferenca === 0 ? "Hoje"
        : diferenca === 1 ? "Amanhã"
        : dia.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
      grupos.set(chave, { rotulo, eventos: [] });
    }
    grupos.get(chave).eventos.push(linha);
  }
  return [...grupos.values()];
}

// ---------- Parte que roda no navegador ----------

async function iniciarAgenda(usuario) {
  const banco = obterCliente();
  const dialogo = document.getElementById("dialogo-evento");
  const form = document.getElementById("form-evento");
  const mensagem = document.getElementById("mensagem-evento");
  const botaoApagar = document.getElementById("botao-apagar");
  const avisoParceiro = document.getElementById("aviso-parceiro");
  let eventoEditando = null; // null = criando um evento novo

  montarSeletorDeCores(document.getElementById("cores-evento"));

  const celular = window.matchMedia("(max-width: 720px)").matches;
  const tituloPeriodo = document.getElementById("titulo-periodo");
  const seletorVisao = document.getElementById("seletor-visao");
  let diasComEvento = new Map(); // "2026-11-07" -> cor do primeiro evento
  let mesDoMini = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const calendario = new FullCalendar.Calendar(document.getElementById("calendario"), {
    locale: "pt-br",
    initialView: celular ? "listWeek" : "dayGridMonth",
    headerToolbar: false, // usamos o nosso próprio cabeçalho (mais bonito)
    height: "auto",
    nowIndicator: true,
    selectable: true,
    editable: true,
    dayMaxEvents: 3,
    eventDisplay: "block", // todo evento vira "pílula" colorida, inclusive os com horário
    moreLinkContent: (info) => `+${info.num} mais`,
    allDayText: "Dia todo",
    slotMinTime: "06:00:00",
    scrollTime: "08:00:00",
    slotLabelFormat: { hour: "2-digit", minute: "2-digit" },
    eventTimeFormat: { hour: "2-digit", minute: "2-digit" },
    fixedWeekCount: false,
    listDayFormat: { weekday: "long", day: "numeric", month: "long" },
    listDaySideFormat: false,
    noEventsContent: "Nada marcado neste período.",

    // Na semana e no dia, o cabeçalho mostra "seg." em cima e o número embaixo.
    dayHeaderContent: (info) => {
      if (info.view.type !== "timeGridWeek" && info.view.type !== "timeGridDay") return info.text;
      const semana = info.date.toLocaleDateString("pt-BR", { weekday: "short" });
      return { html: `<span class="cab-dia-semana">${semana}</span><span class="cab-dia-numero">${info.date.getDate()}</span>` };
    },

    // Busca no banco só os eventos do período que está na tela.
    events: async (periodo) => {
      const inicio = periodo.start.toISOString();
      const fim = periodo.end.toISOString();
      const { data, error } = await banco
        .from("events")
        .select("id, owner_id, titulo, inicio, fim, dia_inteiro, cor, shared")
        .lt("inicio", fim)
        .or(`fim.gte.${inicio},and(fim.is.null,inicio.gte.${inicio})`)
        .order("inicio");
      if (error) {
        mostrarErroGeral("Não foi possível carregar a agenda.", error);
        return [];
      }
      return data.map((linha) => linhaParaEvento(linha, usuario.id));
    },

    // Cada evento recebe a sua cor numa variável CSS; o CSS desenha a
    // "pílula" com fundo suave e uma barrinha forte na esquerda.
    eventDidMount: (info) => {
      info.el.style.setProperty("--cor-evento", info.event.extendedProps.cor || "var(--cor-destaque)");
      // Passar o mouse mostra o nome inteiro e o horário (no mês o nome pode ser cortado).
      const hora = info.event.allDay
        ? "Dia todo"
        : info.event.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      info.el.title = `${info.event.extendedProps.tituloOriginal} · ${hora}`;
    },

    // Guarda quais dias têm evento: pinta essas células e põe as bolinhas
    // no mini calendário.
    eventsSet: (eventos) => {
      diasComEvento = coresPorDia(
        eventos.map((e) => ({ start: e.start, end: e.end, cor: e.extendedProps.cor }))
      );
      document.querySelectorAll("#calendario .fc-daygrid-day[data-date]").forEach(pintarDia);
      desenharMiniCalendario();
    },

    // Quando o calendário redesenha uma célula (ex.: trocou de mês), pinta de novo.
    dayCellDidMount: (info) => pintarDia(info.el),

    // Mudou de mês/semana/visão: atualiza o título e o mini calendário.
    datesSet: (info) => {
      // Semana e dia ficam com altura fixa e rolagem (começando às 8h);
      // mês e lista crescem conforme o conteúdo.
      const altura = info.view.type.startsWith("timeGrid") ? 760 : "auto";
      if (calendario.getOption("height") !== altura) {
        calendario.setOption("height", altura);
        if (altura !== "auto") setTimeout(() => calendario.scrollToTime("08:00:00"), 0);
      }
      tituloPeriodo.textContent = info.view.title;
      seletorVisao.querySelectorAll("button").forEach((botao) => {
        botao.setAttribute("aria-pressed", String(botao.dataset.visao === info.view.type));
      });
      const meio = new Date((info.start.getTime() + info.end.getTime()) / 2);
      mesDoMini = new Date(meio.getFullYear(), meio.getMonth(), 1);
      desenharMiniCalendario();
    },

    // Selecionar um dia (ou arrastar sobre horários) cria um evento.
    select: (selecao) => {
      calendario.unselect();
      abrirDialogo(null, {
        title: "",
        start: selecao.start,
        end: selecao.allDay && somarDias(selecao.start, 1).getTime() === selecao.end.getTime() ? null : selecao.end,
        allDay: selecao.allDay,
        extendedProps: {},
      });
    },

    eventClick: (info) => abrirDialogo(info.event),

    // Arrastar ou esticar um evento muda a data no banco.
    eventDrop: (info) => salvarNovaData(info),
    eventResize: (info) => salvarNovaData(info),
  });

  // Dia com evento: a célula ganha um fundo suave e uma faixa da cor do evento.
  function pintarDia(celula) {
    const chave = celula.dataset.date;
    if (!chave) return;
    if (diasComEvento.has(chave)) {
      celula.classList.add("dia-com-evento");
      celula.style.setProperty("--cor-dia", diasComEvento.get(chave) || "var(--cor-destaque)");
    } else {
      celula.classList.remove("dia-com-evento");
      celula.style.removeProperty("--cor-dia");
    }
  }

  // ----- Cabeçalho próprio -----
  document.getElementById("botao-anterior").addEventListener("click", () => calendario.prev());
  document.getElementById("botao-proximo").addEventListener("click", () => calendario.next());
  document.getElementById("botao-hoje").addEventListener("click", () => calendario.today());
  seletorVisao.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-visao]");
    if (botao) calendario.changeView(botao.dataset.visao);
  });

  document.getElementById("botao-novo-evento").addEventListener("click", () => {
    // Começa na próxima hora cheia, com 1 hora de duração.
    const inicio = new Date();
    inicio.setMinutes(0, 0, 0);
    inicio.setHours(inicio.getHours() + 1);
    abrirDialogo(null, { title: "", start: inicio, end: new Date(inicio.getTime() + 3600000), allDay: false, extendedProps: {} });
  });

  // ----- Mini calendário -----
  const mini = document.getElementById("mini-calendario");

  function desenharMiniCalendario() {
    if (!mini) return;
    const hoje = chaveDia(new Date());
    const visao = calendario.view;
    mini.querySelector(".mini-titulo").textContent = mesDoMini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const corpo = mini.querySelector("tbody");
    corpo.innerHTML = "";
    for (const semana of semanasDoMes(mesDoMini.getFullYear(), mesDoMini.getMonth())) {
      const linha = document.createElement("tr");
      for (const dia of semana) {
        const celula = document.createElement("td");
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = dia.getDate();
        botao.className = "mini-dia";
        const chave = chaveDia(dia);
        if (dia.getMonth() !== mesDoMini.getMonth()) botao.classList.add("fora-do-mes");
        if (chave === hoje) botao.classList.add("hoje");
        if (diasComEvento.has(chave)) botao.classList.add("tem-evento");
        if (visao && visao.type !== "dayGridMonth" && dia >= visao.currentStart && dia < visao.currentEnd) {
          botao.classList.add("no-periodo");
        }
        botao.setAttribute("aria-label", dia.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
        botao.addEventListener("click", () => {
          if (calendario.view.type === "dayGridMonth") calendario.changeView("timeGridDay", dia);
          else calendario.gotoDate(dia);
        });
        celula.appendChild(botao);
        linha.appendChild(celula);
      }
      corpo.appendChild(linha);
    }
  }

  mini.querySelector(".mini-anterior").addEventListener("click", () => {
    mesDoMini = new Date(mesDoMini.getFullYear(), mesDoMini.getMonth() - 1, 1);
    desenharMiniCalendario();
  });
  mini.querySelector(".mini-proximo").addEventListener("click", () => {
    mesDoMini = new Date(mesDoMini.getFullYear(), mesDoMini.getMonth() + 1, 1);
    desenharMiniCalendario();
  });

  // ----- Próximos dias -----
  const listaProximos = document.getElementById("lista-proximos");

  async function carregarProximos() {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const limite = somarDias(hoje, 14);
    const { data, error } = await banco
      .from("events")
      .select("id, owner_id, titulo, inicio, fim, dia_inteiro, cor, shared")
      .lt("inicio", limite.toISOString())
      .or(`fim.gt.${agora.toISOString()},and(fim.is.null,inicio.gte.${hoje.toISOString()})`)
      .order("inicio")
      .limit(30);
    if (error) {
      listaProximos.innerHTML = `<li class="vazio vazio-pequeno">Não foi possível carregar.</li>`;
      return;
    }
    const grupos = agruparPorDia(data, agora).slice(0, 6);
    if (grupos.length === 0) {
      listaProximos.innerHTML = `<li class="vazio vazio-pequeno">Nada nos próximos 14 dias.</li>`;
      return;
    }
    listaProximos.innerHTML = "";
    for (const grupo of grupos) {
      const item = document.createElement("li");
      const rotulo = document.createElement("span");
      rotulo.className = "proximos-dia";
      rotulo.textContent = grupo.rotulo;
      const eventos = document.createElement("ul");
      for (const linha of grupo.eventos) {
        const meu = linha.owner_id === usuario.id;
        const ev = document.createElement("li");
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "proximo-evento" + (meu ? "" : " do-par");
        botao.style.setProperty("--cor-evento", linha.cor || "var(--cor-destaque)");
        const nome = document.createElement("span");
        nome.className = "proximo-nome";
        nome.textContent = meu ? linha.titulo : `💞 ${linha.titulo}`; // textContent: nunca vira HTML
        const hora = document.createElement("span");
        hora.className = "proximo-hora";
        hora.textContent = linha.dia_inteiro
          ? "Dia todo"
          : new Date(linha.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        botao.append(nome, hora);
        botao.addEventListener("click", () => calendario.changeView("timeGridDay", new Date(linha.inicio)));
        ev.appendChild(botao);
        eventos.appendChild(ev);
      }
      item.append(rotulo, eventos);
      listaProximos.appendChild(item);
    }
  }

  function atualizarTudo() {
    calendario.refetchEvents();
    carregarProximos();
  }

  calendario.render();
  carregarProximos();

  async function salvarNovaData(info) {
    const { error } = await banco
      .from("events")
      .update({
        inicio: info.event.start.toISOString(),
        fim: info.event.end ? info.event.end.toISOString() : null,
        dia_inteiro: info.event.allDay,
      })
      .eq("id", info.event.id);
    if (error) {
      info.revert();
      mostrarErroGeral("Não foi possível mudar a data.", error);
      return;
    }
    carregarProximos();
  }

  function abrirDialogo(evento, rascunho) {
    eventoEditando = evento;
    const fonte = evento || rascunho;
    const valores = eventoParaFormulario(fonte);
    const doParceiro = evento && !evento.extendedProps.meu;

    if (evento) valores.titulo = evento.extendedProps.tituloOriginal;

    document.getElementById("titulo-dialogo").textContent = evento
      ? doParceiro ? "Evento do seu par" : "Editar evento"
      : "Novo evento";

    form.titulo.value = valores.titulo;
    form.diaInteiro.checked = valores.diaInteiro;
    ajustarTiposDeData(valores.diaInteiro);
    form.inicio.value = valores.inicio;
    form.fim.value = valores.fim;
    form.compartilhar.checked = valores.compartilhar;
    marcarCor(valores.cor);

    // Evento do parceiro: só leitura.
    form.querySelectorAll("input, button[type=submit]").forEach((campo) => {
      campo.disabled = doParceiro;
    });
    avisoParceiro.hidden = !doParceiro;
    botaoApagar.hidden = !evento || doParceiro;
    mensagem.textContent = "";

    dialogo.showModal();
    if (!doParceiro) form.titulo.focus();
  }

  function ajustarTiposDeData(diaInteiro) {
    const tipo = diaInteiro ? "date" : "datetime-local";
    for (const campo of [form.inicio, form.fim]) {
      const valorAtual = campo.value;
      campo.type = tipo;
      if (!valorAtual) continue;
      // Converte o valor que já estava escrito para o novo formato.
      campo.value = diaInteiro ? valorAtual.slice(0, 10) : `${valorAtual.slice(0, 10)}T09:00`;
    }
  }

  form.diaInteiro.addEventListener("change", () => ajustarTiposDeData(form.diaInteiro.checked));

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const resultado = formularioParaLinha({
      titulo: form.titulo.value,
      diaInteiro: form.diaInteiro.checked,
      inicio: form.inicio.value,
      fim: form.fim.value,
      cor: corEscolhida(),
      compartilhar: form.compartilhar.checked,
    });

    if (resultado.erro) {
      mensagem.textContent = resultado.erro;
      return;
    }

    mensagem.textContent = "Salvando...";
    const consulta = eventoEditando
      ? banco.from("events").update(resultado.linha).eq("id", eventoEditando.id)
      : banco.from("events").insert(resultado.linha);
    const { error } = await consulta;

    if (error) {
      console.error(error);
      mensagem.textContent = "Não foi possível salvar. Tente de novo.";
      return;
    }
    dialogo.close();
    atualizarTudo();
  });

  botaoApagar.addEventListener("click", async () => {
    if (!eventoEditando) return;
    if (!confirm(`Apagar "${eventoEditando.extendedProps.tituloOriginal}"?`)) return;
    const { error } = await banco.from("events").delete().eq("id", eventoEditando.id);
    if (error) {
      console.error(error);
      mensagem.textContent = "Não foi possível apagar. Tente de novo.";
      return;
    }
    dialogo.close();
    atualizarTudo();
  });

  document.getElementById("botao-cancelar").addEventListener("click", () => dialogo.close());
}

// Bolinhas de cor dentro do formulário (rádios estilizados).
function montarSeletorDeCores(lugar) {
  lugar.innerHTML = CORES_EVENTO.map(
    (cor, indice) => `
      <label class="bolinha-cor" title="${cor.nome}">
        <input type="radio" name="cor" value="${cor.valor || ""}" ${indice === 0 ? "checked" : ""}>
        <span style="background: ${cor.valor || "var(--cor-destaque)"}"></span>
        <span class="so-leitor">${cor.nome}</span>
      </label>`
  ).join("");
}

function marcarCor(valor) {
  const radio = document.querySelector(`#cores-evento input[value="${valor || ""}"]`);
  (radio || document.querySelector("#cores-evento input")).checked = true;
}

function corEscolhida() {
  const marcado = document.querySelector("#cores-evento input:checked");
  return marcado && marcado.value ? marcado.value : null;
}

function mostrarErroGeral(texto, erro) {
  console.error(texto, erro);
  const aviso = document.getElementById("aviso-agenda");
  aviso.textContent = texto;
  aviso.hidden = false;
}

if (typeof module !== "undefined") {
  module.exports = {
    CORES_EVENTO,
    paraInputData,
    deInputData,
    somarDias,
    eventoParaFormulario,
    formularioParaLinha,
    linhaParaEvento,
    coresPorDia,
    chaveDia,
    semanasDoMes,
    agruparPorDia,
  };
}
