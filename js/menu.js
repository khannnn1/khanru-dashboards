// Monta o menu em todas as páginas. Cada página só precisa ter
// <nav id="menu"></nav> e carregar este arquivo.

const ITENS_MENU = [
  { href: "dashboard.html", texto: "Início", icone: "🏠" },
  { href: "agenda.html", texto: "Agenda", icone: "📅" },
  { href: "lembretes.html", texto: "Lembretes", icone: "⏰" },
  { href: "anotacoes.html", texto: "Anotações", icone: "📝" },
  { href: "financas.html", texto: "Finanças", icone: "💰", soFinancas: true },
];

// Descobre o nome do arquivo da página a partir do caminho da URL.
// "/khanru-dashboards/agenda.html" -> "agenda.html"; "/" -> "index.html"
function nomeDaPagina(caminho) {
  const semConsulta = caminho.split(/[?#]/)[0];
  const ultimo = semConsulta.split("/").pop();
  return ultimo === "" ? "index.html" : ultimo;
}

// Esconde "Finanças" de quem não tem acesso. Isso é só visual:
// a proteção de verdade fica no banco (RLS) e nas Edge Functions.
function itensVisiveis(itens, podeVerFinancas) {
  return itens.filter((item) => !item.soFinancas || podeVerFinancas);
}

function montarMenu(nav, paginaAtual, podeVerFinancas) {
  const itens = itensVisiveis(ITENS_MENU, podeVerFinancas)
    .map((item) => {
      const atual = item.href === paginaAtual ? ' aria-current="page"' : "";
      return `
        <li>
          <a class="menu-link" href="${item.href}"${atual}>
            <span class="menu-icone" aria-hidden="true">${item.icone}</span>
            <span>${item.texto}</span>
          </a>
        </li>`;
    })
    .join("");

  nav.innerHTML = `
    <a class="menu-logo" href="dashboard.html">Khanru 💞</a>
    <ul class="menu-lista">${itens}</ul>
    <a class="menu-link menu-sair" href="index.html">
      <span class="menu-icone" aria-hidden="true">🚪</span>
      <span>Sair</span>
    </a>`;
}

// No navegador, monta o menu. No Node (testes), só exporta as funções.
if (typeof document !== "undefined") {
  const nav = document.getElementById("menu");
  if (nav) {
    // Até a etapa 2 (login) não sabemos quem está logado, então o
    // item aparece para todos. Depois isso vem de profiles.can_see_finance.
    const podeVerFinancas = true;
    montarMenu(nav, nomeDaPagina(location.pathname), podeVerFinancas);
  }
}

if (typeof module !== "undefined") {
  module.exports = { ITENS_MENU, nomeDaPagina, itensVisiveis };
}
