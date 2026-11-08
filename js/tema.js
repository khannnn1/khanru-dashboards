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
const MODOS = ["auto", "claro", "escuro", "personalizado"];

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

// Mistura duas cores: peso 1 = só a primeira, 0 = só a segunda.
function misturar(hexA, hexB, peso) {
  const a = hexParaRgb(hexA);
  const b = hexParaRgb(hexB);
  return rgbParaHex(a.map((c, i) => c * peso + b[i] * (1 - peso)));
}

const TEXTO_CLARO = "#f7f2ef";
const TEXTO_ESCURO = "#1f1a1c";

// Cor de texto para uma ou mais cores de fundo (ex.: as duas do degradê):
// fica com a opção cujo PIOR contraste é o maior.
// Prefere os tons suaves; se não chegarem a 4.5:1 (cores "do meio", como um
// rosa forte), usa branco ou preto puros, que sempre passam numa cor só.
function piorContraste(texto, fundos) {
  return Math.min(...fundos.map((f) => contraste(texto, f)));
}

function textoParaFundos(fundos) {
  const suave = piorContraste(TEXTO_CLARO, fundos) >= piorContraste(TEXTO_ESCURO, fundos) ? TEXTO_CLARO : TEXTO_ESCURO;
  if (piorContraste(suave, fundos) >= 4.5) return suave;
  return piorContraste("#ffffff", fundos) >= piorContraste("#000000", fundos) ? "#ffffff" : "#000000";
}

// Texto "suave" (mais apagado), mas que ainda passe 4.5:1 em todos os fundos.
function textoSuaveParaFundos(texto, fundos) {
  for (let passo = 0; passo <= 10; passo++) {
    const suave = misturar(texto, fundos[0], 0.6 + passo * 0.04);
    if (fundos.every((f) => contraste(suave, f) >= 4.5)) return suave;
  }
  return texto;
}

// Cores do modo Personalizado: começa com o Rosa escuro.
const PERSONALIZADO_PADRAO = { fundo: "#241b1d", fundo2: null, menu: "#2c2123", cartao: "#332628" };

// Aceita qualquer coisa (do localStorage ou do banco) e devolve um tema válido.
function normalizarTema(tema) {
  const t = tema && typeof tema === "object" ? tema : {};
  const p = t.personalizado && typeof t.personalizado === "object" ? t.personalizado : {};
  const cor = (valor, padrao) => (ehHexValido(valor) ? valor.toLowerCase() : padrao);
  return {
    paleta: Object.prototype.hasOwnProperty.call(PALETAS, t.paleta) ? t.paleta : TEMA_PADRAO.paleta,
    modo: MODOS.includes(t.modo) ? t.modo : TEMA_PADRAO.modo,
    destaque: cor(t.destaque, null),
    personalizado: {
      fundo: cor(p.fundo, PERSONALIZADO_PADRAO.fundo),
      fundo2: cor(p.fundo2, null),
      menu: cor(p.menu, PERSONALIZADO_PADRAO.menu),
      cartao: cor(p.cartao, PERSONALIZADO_PADRAO.cartao),
    },
  };
}

function resolverModo(modo, sistemaPrefereEscuro) {
  if (modo === "claro" || modo === "escuro" || modo === "personalizado") return modo;
  return sistemaPrefereEscuro ? "escuro" : "claro";
}

// Modo Personalizado: a pessoa escolhe fundo (com degradê opcional), barra
// lateral e painéis. Todo o resto (textos, bordas, campos) é calculado para
// continuar legível sobre cada uma dessas cores.
function variaveisPersonalizadas(tema) {
  const p = tema.personalizado;
  const fundos = p.fundo2 ? [p.fundo, p.fundo2] : [p.fundo];
  const textoCartao = textoParaFundos([p.cartao]);
  const textoMenu = textoParaFundos([p.menu]);
  const textoFundo = textoParaFundos(fundos);
  const cartaoEscuro = luminancia(p.cartao) < 0.18;
  const destaque = tema.destaque || PALETAS[tema.paleta][cartaoEscuro ? "escuro" : "claro"].destaque;
  return {
    "--cor-fundo": p.fundo,
    "--fundo-imagem": p.fundo2 ? `linear-gradient(160deg, ${p.fundo}, ${p.fundo2})` : "none",
    // Degradê com cores muito diferentes: nenhuma cor de letra serve nas duas
    // pontas, então os títulos ganham uma sombra leve para destacar.
    "--sombra-texto-fundo":
      piorContraste(textoFundo, fundos) >= 4.5
        ? "none"
        : textoFundo === "#ffffff" || textoFundo === TEXTO_CLARO
          ? "0 1px 3px rgba(0, 0, 0, 0.7)"
          : "0 1px 3px rgba(255, 255, 255, 0.8)",
    "--cor-cartao": p.cartao,
    "--cor-menu": p.menu,
    "--cor-texto": textoFundo,
    "--cor-texto-suave": piorContraste(textoFundo, fundos) >= 4.5 ? textoSuaveParaFundos(textoFundo, fundos) : textoFundo,
    "--cor-texto-cartao": textoCartao,
    "--cor-texto-suave-cartao": textoSuaveParaFundos(textoCartao, [p.cartao]),
    "--cor-texto-menu": textoMenu,
    "--cor-texto-suave-menu": textoSuaveParaFundos(textoMenu, [p.menu]),
    "--cor-destaque": destaque,
    "--cor-destaque-escuro": escurecer(destaque, 0.15),
    "--cor-texto-no-destaque": corDeTextoSobre(destaque),
    "--cor-realce": misturar(destaque, p.cartao, 0.3),
    "--cor-borda": misturar(textoCartao, p.cartao, 0.16),
    "--cor-perigo": cartaoEscuro ? "#f2867d" : "#b3261e",
    "color-scheme": cartaoEscuro ? "dark" : "light",
  };
}

// Tema -> variáveis CSS que o site usa (as mesmas do css/estilo.css).
function variaveisDoTema(temaBruto, sistemaPrefereEscuro) {
  const tema = normalizarTema(temaBruto);
  const modo = resolverModo(tema.modo, sistemaPrefereEscuro);
  if (modo === "personalizado") return variaveisPersonalizadas(tema);

  const cores = PALETAS[tema.paleta][modo];
  const destaque = tema.destaque || cores.destaque;
  return {
    "--cor-fundo": cores.fundo,
    "--fundo-imagem": "none",
    "--sombra-texto-fundo": "none",
    "--cor-cartao": cores.cartao,
    "--cor-menu": cores.menu,
    "--cor-texto": cores.texto,
    "--cor-texto-suave": cores.textoSuave,
    "--cor-texto-cartao": cores.texto,
    "--cor-texto-suave-cartao": cores.textoSuave,
    "--cor-texto-menu": cores.texto,
    "--cor-texto-suave-menu": cores.textoSuave,
    "--cor-destaque": destaque,
    "--cor-destaque-escuro": escurecer(destaque, 0.15),
    "--cor-texto-no-destaque": corDeTextoSobre(destaque),
    "--cor-realce": cores.realce,
    "--cor-borda": cores.borda,
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
        <legend>Modo</legend>
        <div class="abas abas-modo">
          <label><input type="radio" name="modo" value="auto"><span>Automático</span></label>
          <label><input type="radio" name="modo" value="claro"><span>☀️ Claro</span></label>
          <label><input type="radio" name="modo" value="escuro"><span>🌙 Escuro</span></label>
          <label><input type="radio" name="modo" value="personalizado"><span>🎨 Personalizado</span></label>
        </div>
      </fieldset>

      <fieldset data-mostrar="pronto">
        <legend>Tema</legend>
        <div class="grade-paletas">${opcoesPaletas}</div>
      </fieldset>

      <fieldset data-mostrar="personalizado">
        <legend>Suas cores</legend>
        <p class="aviso-etapa">Escolha cada parte. As letras ficam claras ou escuras sozinhas para continuar legíveis.</p>
        <div class="grade-cores-livres">
          <label class="cor-livre">
            <input type="color" name="corFundo">
            <span>Fundo da página</span>
          </label>
          <label class="cor-livre">
            <input type="color" name="corMenu">
            <span>Barra lateral</span>
          </label>
          <label class="cor-livre">
            <input type="color" name="corCartao">
            <span>Painéis</span>
          </label>
          <div class="cor-livre">
            <input type="color" name="corFundo2" aria-label="Segunda cor do degradê">
            <label><input type="checkbox" name="usarDegrade"> Degradê no fundo</label>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Cor de destaque</legend>
        <label class="campo-check">
          <input type="checkbox" name="usarDestaque">
          <span>Usar uma cor minha (botões, menu e links)</span>
        </label>
        <input type="color" name="destaque" class="seletor-cor" aria-label="Escolher cor de destaque">
        <p id="aviso-contraste" class="aviso-contraste" role="status" hidden>
          ⚠️ Essa cor aparece pouco sobre os painéis. Tente uma mais forte ou mais clara.
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
  form.addEventListener("input", (evento) => {
    const entrandoNoPersonalizado =
      evento.target.name === "modo" && form.modo.value === "personalizado" && temaAtual.modo !== "personalizado";

    // Ao entrar no Personalizado, começa com as cores que estão na tela,
    // para a troca não dar um "susto".
    if (entrandoNoPersonalizado) {
      const vars = variaveisDoTema(temaAtual, sistemaPrefereEscuro());
      form.corFundo.value = vars["--cor-fundo"];
      form.corMenu.value = vars["--cor-menu"];
      form.corCartao.value = vars["--cor-cartao"];
    }

    const destaqueLivre = form.usarDestaque.checked;
    const degrade = form.usarDegrade.checked;
    mudarTema({
      paleta: form.paleta.value,
      modo: form.modo.value,
      destaque: destaqueLivre ? form.destaque.value : null,
      personalizado: {
        fundo: form.corFundo.value,
        fundo2: degrade ? form.corFundo2.value : null,
        menu: form.corMenu.value,
        cartao: form.corCartao.value,
      },
    });
    atualizarCamposVisiveis(form);
  });

  form.querySelector('[data-acao="restaurar"]').addEventListener("click", () => {
    mudarTema(TEMA_PADRAO);
    preencherDialogo(dialogo);
  });

  return dialogo;
}

// Mostra a grade de temas ou as cores livres, conforme o modo.
function atualizarCamposVisiveis(form) {
  const personalizado = form.modo.value === "personalizado";
  form.querySelector('[data-mostrar="pronto"]').hidden = personalizado;
  form.querySelector('[data-mostrar="personalizado"]').hidden = !personalizado;
  form.destaque.disabled = !form.usarDestaque.checked;
  form.corFundo2.disabled = !form.usarDegrade.checked;
}

function preencherDialogo(dialogo) {
  const form = dialogo.querySelector("form");
  const vars = variaveisDoTema(temaAtual, sistemaPrefereEscuro());
  const p = temaAtual.personalizado;
  form.paleta.value = temaAtual.paleta;
  form.modo.value = temaAtual.modo;
  form.usarDestaque.checked = Boolean(temaAtual.destaque);
  form.destaque.value = temaAtual.destaque || vars["--cor-destaque"];
  form.corFundo.value = p.fundo;
  form.corMenu.value = p.menu;
  form.corCartao.value = p.cartao;
  form.usarDegrade.checked = Boolean(p.fundo2);
  form.corFundo2.value = p.fundo2 || escurecer(p.fundo, 0.35);
  atualizarCamposVisiveis(form);
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
