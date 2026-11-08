// Lembretes: lista com filtros (hoje, próximos, feitos) ligada à tabela "reminders".

// ---------- Funções puras (testadas em tests/lembretes.test.js) ----------

function inicioDoDia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function fimDoDia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + 1);
}

// Em qual aba o lembrete aparece. Atrasados ficam em "hoje" para não sumirem.
function classificarLembrete(lembrete, agora) {
  if (lembrete.feito) return "feitos";
  if (!lembrete.quando) return "proximos";
  return new Date(lembrete.quando) < fimDoDia(agora) ? "hoje" : "proximos";
}

function estaAtrasado(lembrete, agora) {
  return !lembrete.feito && Boolean(lembrete.quando) && new Date(lembrete.quando) < agora;
}

// Lembretes de uma aba, na ordem certa:
// hoje/próximos pela data (sem data por último); feitos pelo mais recente.
function filtrarLembretes(lista, filtro, agora) {
  const daAba = lista.filter((lembrete) => classificarLembrete(lembrete, agora) === filtro);
  if (filtro === "feitos") {
    return daAba.sort((a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em));
  }
  return daAba.sort((a, b) => {
    if (!a.quando) return 1;
    if (!b.quando) return -1;
    return new Date(a.quando) - new Date(b.quando);
  });
}

function contarPorAba(lista, agora) {
  const contagem = { hoje: 0, proximos: 0, feitos: 0 };
  for (const lembrete of lista) contagem[classificarLembrete(lembrete, agora)] += 1;
  return contagem;
}

// "Hoje, 14:30", "Amanhã, 09:00", "Ontem, 18:00" ou "sex., 14 de nov., 09:00".
function formatarQuando(iso, agora) {
  if (!iso) return "Sem data";
  const data = new Date(iso);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const diferencaDias = Math.round((inicioDoDia(data) - inicioDoDia(agora)) / 86400000);
  if (diferencaDias === 0) return `Hoje, ${hora}`;
  if (diferencaDias === 1) return `Amanhã, ${hora}`;
  if (diferencaDias === -1) return `Ontem, ${hora}`;
  const opcoes = { weekday: "short", day: "numeric", month: "short" };
  if (data.getFullYear() !== agora.getFullYear()) opcoes.year = "numeric";
  return `${data.toLocaleDateString("pt-BR", opcoes)}, ${hora}`;
}

// Valida o formulário. Devolve { erro } ou { linha }.
function novoLembrete(valores) {
  const texto = (valores.texto || "").trim();
  if (!texto) return { erro: "Escreva o lembrete." };
  if (texto.length > 500) return { erro: "O lembrete pode ter no máximo 500 letras." };
  let quando = null;
  if (valores.quando) {
    const data = new Date(valores.quando);
    if (Number.isNaN(data.getTime())) return { erro: "A data é inválida." };
    quando = data.toISOString();
  }
  return { linha: { texto, quando, shared: Boolean(valores.compartilhar) } };
}

// ---------- Parte que roda no navegador ----------

const NOMES_ABAS = { hoje: "Hoje", proximos: "Próximos", feitos: "Feitos" };

async function iniciarLembretes(usuario) {
  const banco = obterCliente();
  const form = document.getElementById("form-lembrete");
  const mensagem = document.getElementById("mensagem-lembrete");
  const lista = document.getElementById("lista-lembretes");
  const abas = document.getElementById("abas-lembretes");
  let lembretes = [];
  let abaAtual = "hoje";

  async function carregar() {
    const { data, error } = await banco
      .from("reminders")
      .select("id, owner_id, texto, quando, feito, shared, atualizado_em")
      .order("quando", { ascending: true, nullsFirst: false });
    if (error) {
      console.error(error);
      lista.innerHTML = `<li class="vazio">Não foi possível carregar os lembretes.</li>`;
      return;
    }
    lembretes = data;
    desenhar();
  }

  function desenhar() {
    const agora = new Date();
    const contagem = contarPorAba(lembretes, agora);

    abas.querySelectorAll("button").forEach((botao) => {
      const aba = botao.dataset.aba;
      botao.setAttribute("aria-selected", String(aba === abaAtual));
      botao.textContent = `${NOMES_ABAS[aba]} (${contagem[aba]})`;
    });

    const itens = filtrarLembretes(lembretes, abaAtual, agora);
    if (itens.length === 0) {
      const textos = {
        hoje: "Nada para hoje. 🎉",
        proximos: "Nenhum lembrete pela frente.",
        feitos: "Nenhum lembrete feito ainda.",
      };
      lista.innerHTML = `<li class="vazio">${textos[abaAtual]}</li>`;
      return;
    }

    lista.innerHTML = "";
    for (const lembrete of itens) lista.appendChild(criarItem(lembrete, agora));
  }

  function criarItem(lembrete, agora) {
    const meu = lembrete.owner_id === usuario.id;
    const item = document.createElement("li");
    item.className = "item-lembrete";
    if (lembrete.feito) item.classList.add("feito");
    if (estaAtrasado(lembrete, agora)) item.classList.add("atrasado");

    const marcar = document.createElement("input");
    marcar.type = "checkbox";
    marcar.checked = lembrete.feito;
    marcar.disabled = !meu;
    marcar.setAttribute("aria-label", `Marcar "${lembrete.texto}" como feito`);
    marcar.addEventListener("change", () => alternarFeito(lembrete, marcar.checked));

    const textos = document.createElement("div");
    textos.className = "item-lembrete-textos";
    const texto = document.createElement("span");
    texto.className = "item-lembrete-texto";
    texto.textContent = meu ? lembrete.texto : `💞 ${lembrete.texto}`; // textContent evita HTML injetado
    const detalhes = document.createElement("span");
    detalhes.className = "item-lembrete-detalhes";
    const partes = [formatarQuando(lembrete.quando, agora)];
    if (estaAtrasado(lembrete, agora)) partes.push("atrasado");
    if (lembrete.shared) partes.push(meu ? "compartilhado" : "do seu par");
    detalhes.textContent = partes.join(" · ");
    textos.append(texto, detalhes);

    item.append(marcar, textos);

    if (meu) {
      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.className = "botao-icone";
      apagar.title = "Apagar";
      apagar.setAttribute("aria-label", `Apagar "${lembrete.texto}"`);
      apagar.textContent = "🗑️";
      apagar.addEventListener("click", () => apagarLembrete(lembrete));
      item.appendChild(apagar);
    }
    return item;
  }

  async function alternarFeito(lembrete, feito) {
    const { error } = await banco.from("reminders").update({ feito }).eq("id", lembrete.id);
    if (error) {
      console.error(error);
      mostrarAviso("Não foi possível atualizar o lembrete.");
    }
    await carregar();
  }

  async function apagarLembrete(lembrete) {
    if (!confirm(`Apagar "${lembrete.texto}"?`)) return;
    const { error } = await banco.from("reminders").delete().eq("id", lembrete.id);
    if (error) {
      console.error(error);
      mostrarAviso("Não foi possível apagar o lembrete.");
    }
    await carregar();
  }

  function mostrarAviso(texto) {
    mensagem.textContent = texto;
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const resultado = novoLembrete({
      texto: form.texto.value,
      quando: form.quando.value,
      compartilhar: form.compartilhar.checked,
    });
    if (resultado.erro) {
      mostrarAviso(resultado.erro);
      return;
    }
    mostrarAviso("Salvando...");
    const { error } = await banco.from("reminders").insert(resultado.linha);
    if (error) {
      console.error(error);
      mostrarAviso("Não foi possível salvar. Tente de novo.");
      return;
    }
    form.reset();
    mostrarAviso("");
    abaAtual = classificarLembrete({ feito: false, quando: resultado.linha.quando }, new Date());
    await carregar();
    form.texto.focus();
  });

  abas.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-aba]");
    if (!botao) return;
    abaAtual = botao.dataset.aba;
    desenhar();
  });

  // Atualiza "atrasado" e as abas a cada minuto, sem ir ao banco.
  setInterval(desenhar, 60000);

  await carregar();
}

if (typeof module !== "undefined") {
  module.exports = {
    classificarLembrete,
    estaAtrasado,
    filtrarLembretes,
    contarPorAba,
    formatarQuando,
    novoLembrete,
  };
}
