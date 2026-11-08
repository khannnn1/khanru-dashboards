// Anotações: lista com busca e notas fixadas + editor que salva sozinho.
// Ligado à tabela "notes" (sempre privada: só o dono vê).

const ATRASO_SALVAR_MS = 800; // espera a pessoa parar de digitar antes de salvar

// ---------- Funções puras (testadas em tests/anotacoes.test.js) ----------

// Minúsculas e sem acento, para "Mercado" achar "mercadão" e "Avó" achar "avo".
function normalizarTexto(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Fixadas primeiro; dentro de cada grupo, a mais recente primeiro.
function ordenarNotas(notas) {
  return [...notas].sort((a, b) => {
    if (a.fixada !== b.fixada) return a.fixada ? -1 : 1;
    return new Date(b.atualizado_em) - new Date(a.atualizado_em);
  });
}

function filtrarNotas(notas, busca) {
  const termo = normalizarTexto(busca).trim();
  const achadas = termo
    ? notas.filter((nota) => normalizarTexto(`${nota.titulo} ${nota.conteudo}`).includes(termo))
    : notas;
  return ordenarNotas(achadas);
}

// O que aparece na lista: título (ou a 1ª linha do texto) e um trecho.
function resumoNota(nota) {
  const linhas = (nota.conteudo || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const titulo = (nota.titulo || "").trim() || linhas.shift() || "Nota sem título";
  const trecho = linhas.join(" ").slice(0, 90);
  return { titulo, trecho };
}

// Chama "funcao" só depois de "ms" sem novas chamadas (debounce).
function comAtraso(funcao, ms) {
  let espera = null;
  let pendentes = [];
  const chamar = (...args) => {
    clearTimeout(espera);
    pendentes = args;
    espera = setTimeout(() => {
      espera = null;
      funcao(...pendentes);
    }, ms);
  };
  // Executa na hora o que estiver pendente (ex.: ao trocar de nota).
  chamar.agora = () => {
    if (espera === null) return;
    clearTimeout(espera);
    espera = null;
    funcao(...pendentes);
  };
  // Esquece o que estava pendente (ex.: a nota foi apagada).
  chamar.cancelar = () => {
    clearTimeout(espera);
    espera = null;
  };
  return chamar;
}

// ---------- Parte que roda no navegador ----------

async function iniciarAnotacoes() {
  const banco = obterCliente();
  const pagina = document.getElementById("pagina-notas");
  const lista = document.getElementById("lista-notas");
  const busca = document.getElementById("busca-notas");
  const editor = document.getElementById("editor-nota");
  const campoTitulo = document.getElementById("nota-titulo");
  const campoConteudo = document.getElementById("nota-conteudo");
  const botaoFixar = document.getElementById("botao-fixar");
  const estado = document.getElementById("estado-salvamento");
  let notas = [];
  let notaAberta = null;

  async function carregar() {
    const { data, error } = await banco
      .from("notes")
      .select("id, titulo, conteudo, fixada, atualizado_em")
      .order("atualizado_em", { ascending: false });
    if (error) {
      console.error(error);
      lista.innerHTML = `<li class="vazio">Não foi possível carregar as notas.</li>`;
      return;
    }
    notas = data;
    desenharLista();
  }

  function desenharLista() {
    const visiveis = filtrarNotas(notas, busca.value);
    if (visiveis.length === 0) {
      lista.innerHTML = `<li class="vazio">${busca.value ? "Nenhuma nota encontrada." : "Nenhuma nota ainda."}</li>`;
      return;
    }
    lista.innerHTML = "";
    for (const nota of visiveis) {
      const { titulo, trecho } = resumoNota(nota);
      const item = document.createElement("li");
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "item-nota";
      if (notaAberta && nota.id === notaAberta.id) botao.setAttribute("aria-current", "true");
      const nome = document.createElement("strong");
      nome.textContent = `${nota.fixada ? "📌 " : ""}${titulo}`;
      const resumo = document.createElement("span");
      resumo.textContent = trecho || " ";
      botao.append(nome, resumo);
      botao.addEventListener("click", () => abrirNota(nota));
      item.appendChild(botao);
      lista.appendChild(item);
    }
  }

  function abrirNota(nota) {
    salvar.agora();
    notaAberta = nota;
    campoTitulo.value = nota.titulo;
    campoConteudo.value = nota.conteudo;
    atualizarBotaoFixar();
    estado.textContent = "";
    editor.hidden = false;
    pagina.classList.add("editando"); // no celular, mostra o editor no lugar da lista
    desenharLista();
    campoConteudo.focus();
  }

  function fecharEditor() {
    salvar.agora();
    notaAberta = null;
    editor.hidden = true;
    pagina.classList.remove("editando");
    desenharLista();
  }

  function atualizarBotaoFixar() {
    botaoFixar.textContent = notaAberta.fixada ? "📌 Desafixar" : "📌 Fixar no topo";
    botaoFixar.setAttribute("aria-pressed", String(notaAberta.fixada));
  }

  async function gravar(nota, mudancas) {
    estado.textContent = "Salvando...";
    const { data, error } = await banco
      .from("notes")
      .update(mudancas)
      .eq("id", nota.id)
      .select("atualizado_em")
      .single();
    if (error) {
      console.error(error);
      estado.textContent = "⚠️ Não salvou. Confira a internet.";
      return;
    }
    Object.assign(nota, mudancas, { atualizado_em: data.atualizado_em });
    if (nota === notaAberta) estado.textContent = "Salvo ✓";
    desenharLista();
  }

  // Guarda a nota no momento da digitação: se a pessoa trocar de nota antes
  // do salvamento, ainda salva na nota certa.
  const salvar = comAtraso((nota, mudancas) => gravar(nota, mudancas), ATRASO_SALVAR_MS);

  function aoDigitar() {
    if (!notaAberta) return;
    estado.textContent = "Digitando...";
    salvar(notaAberta, { titulo: campoTitulo.value.slice(0, 200), conteudo: campoConteudo.value });
  }

  campoTitulo.addEventListener("input", aoDigitar);
  campoConteudo.addEventListener("input", aoDigitar);

  document.getElementById("botao-nova-nota").addEventListener("click", async () => {
    salvar.agora();
    const { data, error } = await banco
      .from("notes")
      .insert({ titulo: "", conteudo: "" })
      .select("id, titulo, conteudo, fixada, atualizado_em")
      .single();
    if (error) {
      console.error(error);
      alert("Não foi possível criar a nota.");
      return;
    }
    busca.value = "";
    notas.unshift(data);
    abrirNota(data);
    campoTitulo.focus();
  });

  botaoFixar.addEventListener("click", async () => {
    if (!notaAberta) return;
    await gravar(notaAberta, { fixada: !notaAberta.fixada });
    atualizarBotaoFixar();
  });

  document.getElementById("botao-apagar-nota").addEventListener("click", async () => {
    if (!notaAberta) return;
    const nome = resumoNota(notaAberta).titulo;
    if (!confirm(`Apagar a nota "${nome}"? Não dá para desfazer.`)) return;
    salvar.cancelar();
    const { error } = await banco.from("notes").delete().eq("id", notaAberta.id);
    if (error) {
      console.error(error);
      estado.textContent = "⚠️ Não foi possível apagar.";
      return;
    }
    notas = notas.filter((nota) => nota.id !== notaAberta.id);
    notaAberta = null;
    fecharEditor();
  });

  document.getElementById("botao-voltar-notas").addEventListener("click", fecharEditor);
  busca.addEventListener("input", desenharLista);

  // Se a pessoa fechar a aba com algo pendente, tenta salvar.
  window.addEventListener("pagehide", () => salvar.agora());

  await carregar();
}

if (typeof module !== "undefined") {
  module.exports = { normalizarTexto, ordenarNotas, filtrarNotas, resumoNota, comAtraso };
}
