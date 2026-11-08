// Tema de cores: 6 paletas prontas, modo claro/escuro/automático e uma cor
// de destaque livre. Carregado no <head> de todas as páginas para aplicar o
// tema salvo antes da página aparecer (assim não "pisca" com a cor errada).

const CHAVE_TEMA = "khanru-tema";

// Cada paleta tem as cores do modo claro e do escuro.
// A cor do texto sobre o destaque é calculada sozinha (corDeTextoSobre).
const PALETAS = {
  rosa: {
    nome: "Rosa",
    claro: { fundo: "#f7ede4", cartao: "#fffaf5", texto: "#3d2c2e", textoSuave: "#735a5c", destaque: "#c24d64", realce: "#ffe3a3", borda: "#edd9cc", menu: "#fffaf5" },
    escuro: { fundo: "#241b1d", cartao: "#332628", texto: "#f6e9e3", textoSuave: "#c4aeac", destaque: "#e57a8e", realce: "#6b5227", borda: "#4a3739", menu: "#2c2123" },
  },
  lavanda: {
    nome: "Lavanda",
    claro: { fundo: "#f1edf7", cartao: "#fbf9fe", texto: "#2f2a3d", textoSuave: "#625a77", destaque: "#7b5cc4", realce: "#e3d8ff", borda: "#ddd5ec", menu: "#fbf9fe" },
    escuro: { fundo: "#1d1a26", cartao: "#2a2536", texto: "#ece8f6", textoSuave: "#b3aac8", destaque: "#a58bf0", realce: "#4a3d73", borda: "#3d3650", menu: "#231f2e" },
  },
  oceano: {
    nome: "Oceano",
    claro: { fundo: "#e9f1f5", cartao: "#f8fcfd", texto: "#1f3340", textoSuave: "#4f6676", destaque: "#2b7a9e", realce: "#c7e8f3", borda: "#d0e0e8", menu: "#f8fcfd" },
    escuro: { fundo: "#131d24", cartao: "#1c2a33", texto: "#e4f0f5", textoSuave: "#9fb6c2", destaque: "#5fb3d6", realce: "#1f4a5c", borda: "#2c3d48", menu: "#17232b" },
  },
  floresta: {
    nome: "Floresta",
    claro: { fundo: "#edf3ec", cartao: "#f9fcf8", texto: "#263326", textoSuave: "#546653", destaque: "#3f7f4f", realce: "#d8ecc5", borda: "#d5e2d2", menu: "#f9fcf8" },
    escuro: { fundo: "#161d17", cartao: "#212b22", texto: "#e6efe4", textoSuave: "#a6b8a4", destaque: "#72c08a", realce: "#34502a", borda: "#314033", menu: "#1b231c" },
  },
  porDoSol: {
    nome: "Pôr do sol",
    claro: { fundo: "#fbefe6", cartao: "#fffaf6", texto: "#3b2a22", textoSuave: "#6e564b", destaque: "#b9562a", realce: "#ffd9a8", borda: "#f0d9c9", menu: "#fffaf6" },
    escuro: { fundo: "#241a16", cartao: "#33251f", texto: "#f7e9e0", textoSuave: "#c9ada0", destaque: "#f08a54", realce: "#6b4320", borda: "#4a372e", menu: "#2b201b" },
  },
  grafite: {
    nome: "Grafite",
    claro: { fundo: "#eeeff1", cartao: "#fbfbfc", texto: "#23262b", textoSuave: "#595f69", destaque: "#4a5568", realce: "#e2e6ec", borda: "#d9dce1", menu: "#fbfbfc" },
    escuro: { fundo: "#16181b", cartao: "#212429", texto: "#e9ebee", textoSuave: "#a5abb5", destaque: "#9aa6b8", realce: "#39404a", borda: "#343840", menu: "#1b1d21" },
  },
};

const TEMA_PADRAO = { paleta: "rosa", modo: "auto", destaque: null };
const MODOS = ["auto", "claro", "escuro"];

// ---------- Funções puras (testadas em tests/tema.test.js) ----------

function hexParaRgb(hex) {
  const valor = parseInt(hex.slice(1), 16);
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}

function rgbParaHex([r, g, b]) {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

function ehHexValido(texto) {
  return typeof texto === "string" && /^#[0-9a-fA-F]{6}$/.test(texto);
}

// Luminância relativa e contraste, pela fórmula das normas WCAG.
function luminancia(hex) {
  const [r, g, b] = hexParaRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(hexA, hexB) {
  const [maior, menor] = [luminancia(hexA), luminancia(hexB)].sort((a, b) => b - a);
  return (maior + 0.05) / (menor + 0.05);
}

// Mistura a cor com preto (fator 0 a 1). Usado no "hover" dos botões.
function escurecer(hex, fator) {
  return rgbParaHex(hexParaRgb(hex).map((c) => c * (1 - fator)));
}

// Texto branco ou escuro sobre uma cor: o que tiver mais contraste.
function corDeTextoSobre(hex) {
  const escuro = "#1a1416";
  return contraste(hex, "#ffffff") >= contraste(hex, escuro) ? "#ffffff" : escuro;
}

// Aceita qualquer coisa (do localStorage ou do banco) e devolve um tema válido.
function normalizarTema(tema) {
  const t = tema && typeof tema === "object" ? tema : {};
  return {
    paleta: Object.prototype.hasOwnProperty.call(PALETAS, t.paleta) ? t.paleta : TEMA_PADRAO.paleta,
    modo: MODOS.includes(t.modo) ? t.modo : TEMA_PADRAO.modo,
    destaque: ehHexValido(t.destaque) ? t.destaque.toLowerCase() : null,
  };
}

function resolverModo(modo, sistemaPrefereEscuro) {
  if (modo === "claro" || modo === "escuro") return modo;
  return sistemaPrefereEscuro ? "escuro" : "claro";
}

// Tema -> variáveis CSS que o site usa (as mesmas do css/estilo.css).
function variaveisDoTema(temaBruto, sistemaPrefereEscuro) {
  const tema = normalizarTema(temaBruto);
  const modo = resolverModo(tema.modo, sistemaPrefereEscuro);
  const cores = PALETAS[tema.paleta][modo];
  const destaque = tema.destaque || cores.destaque;
  return {
    "--cor-fundo": cores.fundo,
    "--cor-cartao": cores.cartao,
    "--cor-texto": cores.texto,
    "--cor-texto-suave": cores.textoSuave,
    "--cor-destaque": destaque,
    "--cor-destaque-escuro": escurecer(destaque, 0.15),
    "--cor-texto-no-destaque": corDeTextoSobre(destaque),
    "--cor-realce": cores.realce,
    "--cor-borda": cores.borda,
    "--cor-menu": cores.menu,
    "--cor-perigo": modo === "escuro" ? "#f2867d" : "#b3261e",
    "color-scheme": modo === "escuro" ? "dark" : "light",
  };
}

// A cor de destaque escolhida aparece bem sobre o fundo dos cartões?
// 3:1 é o mínimo das normas para botões e elementos gráficos.
function destaqueTemPoucoContraste(temaBruto, sistemaPrefereEscuro) {
  const vars = variaveisDoTema(temaBruto, sistemaPrefereEscuro);
  return contraste(vars["--cor-destaque"], vars["--cor-cartao"]) < 3;
}

// ---------- Parte que roda no navegador ----------

let temaAtual = TEMA_PADRAO;

function sistemaPrefereEscuro() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function aplicarTema(tema) {
  temaAtual = normalizarTema(tema);
  const raiz = document.documentElement;
  for (const [nome, valor] of Object.entries(variaveisDoTema(temaAtual, sistemaPrefereEscuro()))) {
    raiz.style.setProperty(nome, valor);
  }
  const corBarra = document.querySelector('meta[name="theme-color"]');
  if (corBarra) corBarra.content = raiz.style.getPropertyValue("--cor-fundo");
}

function lerTemaLocal() {
  try {
    return normalizarTema(JSON.parse(localStorage.getItem(CHAVE_TEMA)));
  } catch {
    return TEMA_PADRAO;
  }
}

function guardarTemaLocal(tema) {
  localStorage.setItem(CHAVE_TEMA, JSON.stringify(tema));
}

// Roda já, no <head>: aplica o último tema usado neste aparelho.
if (typeof document !== "undefined") {
  aplicarTema(lerTemaLocal());
  // No modo automático, acompanha quando o sistema troca entre claro e escuro.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => aplicarTema(temaAtual));
}

// Chamado pelo sessao.js depois do login: o tema do perfil vale em qualquer
// aparelho, então ele tem prioridade sobre o salvo neste navegador.
function iniciarPersonalizacao(perfil) {
  if (perfil && perfil.tema && perfil.tema.paleta) {
    aplicarTema(perfil.tema);
    guardarTemaLocal(temaAtual);
  }
  const botao = document.getElementById("botao-cores");
  if (botao) botao.addEventListener("click", abrirPersonalizacao);
}

let salvarNoPerfilDepois = null;

function salvarTema(usuarioId) {
  guardarTemaLocal(temaAtual);
  clearTimeout(salvarNoPerfilDepois);
  // Espera a pessoa parar de mexer antes de gravar no banco.
  salvarNoPerfilDepois = setTimeout(async () => {
    const { error } = await obterCliente().from("profiles").update({ tema: temaAtual }).eq("id", usuarioId);
    const estado = document.getElementById("estado-tema");
    if (estado) estado.textContent = error ? "⚠️ Não salvou no perfil" : "Salvo ✓";
  }, 600);
}

function abrirPersonalizacao() {
  let dialogo = document.getElementById("dialogo-cores");
  if (!dialogo) dialogo = criarDialogoCores();
  preencherDialogo(dialogo);
  dialogo.showModal();
}

function criarDialogoCores() {
  const dialogo = document.createElement("dialog");
  dialogo.id = "dialogo-cores";
  dialogo.className = "dialogo";
  dialogo.setAttribute("aria-labelledby", "titulo-cores");

  const opcoesPaletas = Object.entries(PALETAS)
    .map(([chave, paleta]) => `
      <label class="opcao-paleta">
        <input type="radio" name="paleta" value="${chave}">
        <span class="amostra-paleta" aria-hidden="true">
          <span style="background:${paleta.claro.fundo}"></span>
          <span style="background:${paleta.claro.destaque}"></span>
          <span style="background:${paleta.escuro.cartao}"></span>
          <span style="background:${paleta.escuro.destaque}"></span>
        </span>
        <span>${paleta.nome}</span>
      </label>`)
    .join("");

  dialogo.innerHTML = `
    <form method="dialog" class="form-cores">
      <h2 id="titulo-cores">🎨 Cores do seu dashboard</h2>

      <fieldset>
        <legend>Tema</legend>
        <div class="grade-paletas">${opcoesPaletas}</div>
      </fieldset>

      <fieldset>
        <legend>Modo</legend>
        <div class="abas abas-modo">
          <label><input type="radio" name="modo" value="auto"><span>Automático</span></label>
          <label><input type="radio" name="modo" value="claro"><span>☀️ Claro</span></label>
          <label><input type="radio" name="modo" value="escuro"><span>🌙 Escuro</span></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Cor de destaque</legend>
        <label class="campo-check">
          <input type="checkbox" name="usarDestaque">
          <span>Usar uma cor minha</span>
        </label>
        <input type="color" name="destaque" class="seletor-cor" aria-label="Escolher cor de destaque">
        <p id="aviso-contraste" class="aviso-contraste" role="status" hidden>
          ⚠️ Essa cor aparece pouco sobre o fundo. Tente uma mais forte ou mais clara.
        </p>
      </fieldset>

      <div class="previa-tema" aria-hidden="true">
        <span class="botao">Botão</span>
        <span class="previa-texto">Texto normal</span>
        <span class="previa-suave">texto suave</span>
      </div>

      <div class="botoes-dialogo">
        <button type="button" class="botao botao-secundario" data-acao="restaurar">Restaurar padrão</button>
        <span id="estado-tema" class="estado-salvamento" role="status"></span>
        <button type="submit" class="botao" autofocus>Pronto</button>
      </div>
    </form>`;

  document.body.appendChild(dialogo);
  const form = dialogo.querySelector("form");

  // Qualquer mudança aplica na hora e salva.
  form.addEventListener("input", () => {
    const destaqueLivre = form.usarDestaque.checked;
    form.destaque.disabled = !destaqueLivre;
    mudarTema({
      paleta: form.paleta.value,
      modo: form.modo.value,
      destaque: destaqueLivre ? form.destaque.value : null,
    });
  });

  form.querySelector('[data-acao="restaurar"]').addEventListener("click", () => {
    mudarTema(TEMA_PADRAO);
    preencherDialogo(dialogo);
  });

  return dialogo;
}

function preencherDialogo(dialogo) {
  const form = dialogo.querySelector("form");
  form.paleta.value = temaAtual.paleta;
  form.modo.value = temaAtual.modo;
  form.usarDestaque.checked = Boolean(temaAtual.destaque);
  form.destaque.disabled = !temaAtual.destaque;
  form.destaque.value = temaAtual.destaque || variaveisDoTema(temaAtual, sistemaPrefereEscuro())["--cor-destaque"];
  atualizarAvisoContraste();
  document.getElementById("estado-tema").textContent = "";
}

function atualizarAvisoContraste() {
  const aviso = document.getElementById("aviso-contraste");
  if (aviso) aviso.hidden = !destaqueTemPoucoContraste(temaAtual, sistemaPrefereEscuro());
}

function mudarTema(tema) {
  aplicarTema(tema);
  atualizarAvisoContraste();
  document.getElementById("estado-tema").textContent = "Salvando...";
  // O id vem da sessão guardada pelo supabase-js.
  obterCliente().auth.getSession().then(({ data }) => {
    if (data.session) salvarTema(data.session.user.id);
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    PALETAS,
    TEMA_PADRAO,
    hexParaRgb,
    contraste,
    escurecer,
    corDeTextoSobre,
    normalizarTema,
    resolverModo,
    variaveisDoTema,
    destaqueTemPoucoContraste,
  };
}
