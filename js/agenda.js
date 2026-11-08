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
  if (linha.cor) {
    evento.backgroundColor = linha.cor;
    evento.borderColor = linha.cor;
  }
  return evento;
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

  const calendario = new FullCalendar.Calendar(document.getElementById("calendario"), {
    locale: "pt-br",
    initialView: celular ? "listWeek" : "dayGridMonth",
    height: "auto",
    nowIndicator: true,
    selectable: true,
    editable: true,
    dayMaxEvents: 3,
    headerToolbar: celular
      ? { left: "prev,next", center: "title", right: "today" }
      : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" },
    footerToolbar: celular ? { center: "dayGridMonth,timeGridDay,listWeek" } : undefined,

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

  calendario.render();

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
    }
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
    calendario.refetchEvents();
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
    calendario.refetchEvents();
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
  };
}
