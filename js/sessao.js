// Cuida do login: cria o cliente do Supabase, protege as páginas,
// carrega o perfil de quem está logado e monta o menu.

const PAGINA_LOGIN = "index.html";
const PAGINA_INICIAL = "dashboard.html";
const PAGINAS_DE_FINANCAS = ["financas.html"];

// ---------- Funções puras (testadas em tests/sessao.test.js) ----------

// A pessoa pode ver esta página? Finanças exige can_see_finance.
// Isso só decide a navegação; os dados em si são protegidos no banco.
function podeAcessarPagina(pagina, perfil) {
  if (!PAGINAS_DE_FINANCAS.includes(pagina)) return true;
  return Boolean(perfil && perfil.can_see_finance);
}

// Troca as mensagens de erro do Supabase (em inglês) por português.
function traduzirErroLogin(erro) {
  const mensagem = ((erro && erro.message) || "").toLowerCase();
  if (mensagem.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (mensagem.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado.";
  if (mensagem.includes("rate limit") || mensagem.includes("too many")) {
    return "Muitas tentativas. Espere um pouco e tente de novo.";
  }
  if (mensagem.includes("fetch") || mensagem.includes("network")) {
    return "Sem conexão com o servidor. Confira sua internet.";
  }
  return "Não foi possível entrar. Tente de novo.";
}

// ---------- Parte que roda no navegador ----------

let cliente = null;

function obterCliente() {
  if (!cliente) {
    // "supabase" vem do script do CDN carregado antes deste arquivo.
    cliente = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseChavePublica);
  }
  return cliente;
}

async function carregarPerfil(usuarioId) {
  const { data, error } = await obterCliente()
    .from("profiles")
    .select("nome, tema, can_see_finance")
    .eq("id", usuarioId)
    .single();
  if (error) {
    console.error("Erro ao carregar o perfil:", error.message);
    return null;
  }
  return data;
}

async function sair() {
  await obterCliente().auth.signOut();
  location.replace(PAGINA_LOGIN);
}

// Chamado em toda página protegida. Devolve { usuario, perfil }.
async function protegerPagina() {
  const { data } = await obterCliente().auth.getSession();
  const sessao = data.session;

  if (!sessao) {
    location.replace(PAGINA_LOGIN);
    return null;
  }

  const perfil = await carregarPerfil(sessao.user.id);
  const pagina = nomeDaPagina(location.pathname);

  if (!podeAcessarPagina(pagina, perfil)) {
    location.replace(PAGINA_INICIAL);
    return null;
  }

  const nav = document.getElementById("menu");
  if (nav) {
    montarMenu(nav, pagina, Boolean(perfil && perfil.can_see_finance));
    document.getElementById("botao-sair").addEventListener("click", sair);
  }

  // Se a sessão acabar em outra aba (ex.: clicou em Sair), volta ao login.
  obterCliente().auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") location.replace(PAGINA_LOGIN);
  });

  // Tema de cores do perfil + botão 🎨 do menu (se o tema.js foi carregado).
  if (typeof iniciarPersonalizacao === "function") iniciarPersonalizacao(perfil);

  // Avisos de lembretes em qualquer página (se o notificacoes.js foi carregado).
  if (typeof iniciarNotificacoes === "function") iniciarNotificacoes(sessao.user);

  document.documentElement.classList.remove("carregando");
  return { usuario: sessao.user, perfil };
}

if (typeof module !== "undefined") {
  module.exports = { podeAcessarPagina, traduzirErroLogin };
}
