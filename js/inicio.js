// Tela inicial: junta o dia de cada pessoa (eventos, lembretes, notas e,
// para quem tem acesso, finanças). Usa funções de lembretes.js e anotacoes.js.

const LIMITE_LEMBRETES = 5;
const LIMITE_NOTAS = 4;

// ---------- Funções puras (testadas em tests/inicio.test.js) ----------

function saudacao(agora, nome) {
  const hora = agora.getHours();
  const periodo = hora < 5 ? "Boa noite" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = (nome || "").trim().split(/\s+/)[0];
  return primeiroNome ? `${periodo}, ${primeiroNome}!` : `${periodo}!`;
}

function inicioDoDiaLocal(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

// Eventos que acontecem (pelo menos em parte) no dia de "agora".
// Dia inteiro primeiro, depois pelo horário.
function eventosDoDia(linhas, agora) {
  const comeco = inicioDoDiaLocal(agora);
  const fim = new Date(comeco.getFullYear(), comeco.getMonth(), comeco.getDate() + 1);
  return linhas
    .filter((evento) => {
      const inicio = new Date(evento.inicio);
      const termino = evento.fim ? new Date(evento.fim) : null;
      if (inicio >= fim) return false;
      return termino ? termino > comeco : inicio >= comeco;
    })
    .sort((a, b) => {
      if (a.dia_inteiro !== b.dia_inteiro) return a.dia_inteiro ? -1 : 1;
      return new Date(a.inicio) - new Date(b.inicio);
    });
}

function horarioEvento(evento) {
  if (evento.dia_inteiro) return "Dia inteiro";
  const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return evento.fim ? `${hora(evento.inicio)} – ${hora(evento.fim)}` : hora(evento.inicio);
}

// ---------- Parte que roda no navegador ----------

async function iniciarInicio(usuario, perfil) {
  const banco = obterCliente();
  const agora = new Date();

  const titulo = document.getElementById("saudacao");
  titulo.textContent = saudacao(agora, perfil && perfil.nome);
  document.getElementById("data-hoje").textContent = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  document.getElementById("botao-nome").addEventListener("click", async () => {
    const atual = (perfil && perfil.nome) || "";
    const novo = prompt("Como você quer ser chamado(a)?", atual);
    if (novo === null) return;
    const nome = novo.trim().slice(0, 60);
    const { error } = await banco.from("profiles").update({ nome }).eq("id", usuario.id);
    if (error) {
      alert("Não foi possível salvar o nome.");
      return;
    }
    if (perfil) perfil.nome = nome;
    titulo.textContent = saudacao(new Date(), nome);
  });

  if (perfil && perfil.can_see_finance) {
    document.getElementById("cartao-financas").hidden = false;
  }

  await Promise.all([
    mostrarEventos(banco, usuario, agora),
    mostrarLembretes(banco, usuario, agora),
    mostrarNotas(banco),
  ]);
}

function preencherLista(lista, itens, textoVazio, criarItem) {
  lista.innerHTML = "";
  if (itens.length === 0) {
    lista.innerHTML = `<li class="vazio vazio-pequeno">${textoVazio}</li>`;
    return;
  }
  for (const item of itens) lista.appendChild(criarItem(item));
}

function itemResumo(principal, detalhe, extraClasse) {
  const li = document.createElement("li");
  li.className = "item-resumo" + (extraClasse ? ` ${extraClasse}` : "");
  const forte = document.createElement("span");
  forte.className = "item-resumo-principal";
  forte.textContent = principal; // textContent: nunca interpreta HTML
  const fraco = document.createElement("span");
  fraco.className = "item-resumo-detalhe";
  fraco.textContent = detalhe;
  li.append(forte, fraco);
  return li;
}

async function mostrarEventos(banco, usuario, agora) {
  const lista = document.getElementById("lista-eventos-hoje");
  const comeco = inicioDoDiaLocal(agora);
  const fim = new Date(comeco.getFullYear(), comeco.getMonth(), comeco.getDate() + 1);
  const { data, error } = await banco
    .from("events")
    .select("id, owner_id, titulo, inicio, fim, dia_inteiro, cor, shared")
    .lt("inicio", fim.toISOString())
    .or(`fim.gt.${comeco.toISOString()},and(fim.is.null,inicio.gte.${comeco.toISOString()})`)
    .order("inicio");
  if (error) {
    console.error(error);
    lista.innerHTML = `<li class="vazio vazio-pequeno">Não foi possível carregar.</li>`;
    return;
  }
  preencherLista(lista, eventosDoDia(data, agora), "Nenhum evento hoje.", (evento) => {
    const meu = evento.owner_id === usuario.id;
    const item = itemResumo(meu ? evento.titulo : `💞 ${evento.titulo}`, horarioEvento(evento), "com-cor");
    item.style.setProperty("--cor-item", evento.cor || "var(--cor-destaque)");
    return item;
  });
}

async function mostrarLembretes(banco, usuario, agora) {
  const lista = document.getElementById("lista-lembretes-hoje");
  const { data, error } = await banco
    .from("reminders")
    .select("id, owner_id, texto, quando, feito, shared, atualizado_em")
    .eq("feito", false);
  if (error) {
    console.error(error);
    lista.innerHTML = `<li class="vazio vazio-pequeno">Não foi possível carregar.</li>`;
    return;
  }
  const deHoje = filtrarLembretes(data, "hoje", agora);
  document.getElementById("mais-lembretes").hidden = deHoje.length <= LIMITE_LEMBRETES;
  preencherLista(lista, deHoje.slice(0, LIMITE_LEMBRETES), "Nada pendente para hoje. 🎉", (lembrete) => {
    const meu = lembrete.owner_id === usuario.id;
    const atrasado = estaAtrasado(lembrete, agora);
    const detalhe = formatarQuando(lembrete.quando, agora) + (atrasado ? " · atrasado" : "");
    return itemResumo(meu ? lembrete.texto : `💞 ${lembrete.texto}`, detalhe, atrasado ? "atrasado" : "");
  });
}

async function mostrarNotas(banco) {
  const lista = document.getElementById("lista-notas-fixadas");
  const { data, error } = await banco
    .from("notes")
    .select("id, titulo, conteudo, fixada, atualizado_em")
    .eq("fixada", true)
    .order("atualizado_em", { ascending: false })
    .limit(LIMITE_NOTAS);
  if (error) {
    console.error(error);
    lista.innerHTML = `<li class="vazio vazio-pequeno">Não foi possível carregar.</li>`;
    return;
  }
  preencherLista(lista, data, "Fixe uma nota para ela aparecer aqui.", (nota) => {
    const { titulo, trecho } = resumoNota(nota);
    return itemResumo(`📌 ${titulo}`, trecho);
  });
}

if (typeof module !== "undefined") {
  module.exports = { saudacao, eventosDoDia, horarioEvento };
}
