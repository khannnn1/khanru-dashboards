// Notificações do navegador para lembretes, enquanto o site estiver aberto
// (em qualquer página). Notificação com o site fechado (push) fica para depois.

const CHAVE_AVISADOS = "khanru-lembretes-avisados";
const JANELA_AVISO_MS = 60 * 60 * 1000; // avisa até 1h depois da hora; mais que isso já passou

// ---------- Função pura (testada em tests/notificacoes.test.js) ----------

// Quais lembretes devem tocar agora: meus, não feitos, com hora que já
// chegou (há menos de 1h) e que ainda não foram avisados.
function lembretesParaAvisar(lista, agora, jaAvisados, usuarioId) {
  return lista.filter((lembrete) => {
    if (lembrete.owner_id !== usuarioId || lembrete.feito || !lembrete.quando) return false;
    if (jaAvisados.includes(lembrete.id)) return false;
    const atraso = agora - new Date(lembrete.quando);
    return atraso >= 0 && atraso < JANELA_AVISO_MS;
  });
}

// ---------- Parte que roda no navegador ----------

function lerAvisados() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_AVISADOS)) || [];
  } catch {
    return [];
  }
}

function guardarAvisados(ids) {
  // Guarda só os últimos 200 para a lista não crescer para sempre.
  localStorage.setItem(CHAVE_AVISADOS, JSON.stringify(ids.slice(-200)));
}

async function verificarLembretes(usuario) {
  if (Notification.permission !== "granted") return;
  const desde = new Date(Date.now() - JANELA_AVISO_MS).toISOString();
  const ate = new Date().toISOString();
  const { data, error } = await obterCliente()
    .from("reminders")
    .select("id, owner_id, texto, quando, feito")
    .eq("owner_id", usuario.id)
    .eq("feito", false)
    .gte("quando", desde)
    .lte("quando", ate);
  if (error || !data) return;

  const avisados = lerAvisados();
  for (const lembrete of lembretesParaAvisar(data, new Date(), avisados, usuario.id)) {
    new Notification("⏰ Lembrete", { body: lembrete.texto, tag: lembrete.id });
    avisados.push(lembrete.id);
  }
  guardarAvisados(avisados);
}

function iniciarNotificacoes(usuario) {
  if (!("Notification" in window)) return;
  verificarLembretes(usuario);
  setInterval(() => verificarLembretes(usuario), 30000);
}

// Botão "Ativar notificações" (página de lembretes).
function prepararBotaoNotificacoes(botao, usuario) {
  if (!("Notification" in window)) {
    botao.hidden = true;
    return;
  }
  const atualizar = () => {
    const estado = Notification.permission;
    botao.hidden = estado === "granted";
    botao.disabled = estado === "denied";
    botao.textContent =
      estado === "denied" ? "Notificações bloqueadas no navegador" : "🔔 Ativar notificações";
  };
  atualizar();
  botao.addEventListener("click", async () => {
    await Notification.requestPermission();
    atualizar();
    verificarLembretes(usuario);
  });
}

if (typeof module !== "undefined") {
  module.exports = { lembretesParaAvisar };
}
