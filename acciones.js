// acciones.js
// ───────────────────────────────────────────────────────────────
//  ACCIONES FINALES del bot + captura de leads.
//   • agendarLlamada → rama CALIFICADA (>= $1,000 USD): entrega el Calendly.
//   • enviarClub     → rama CLUB (< $1,000 USD): entrega el club ($34/mes).
//  Ambas registran el lead (logs + webhook opcional a tu CRM/tabla).
//
//  El LLM (llm.js) llama a estas funciones como "herramientas". Cuando
//  devuelven { ok:true, mensaje }, ese mensaje se le envía a la persona
//  TAL CUAL (así el link y el texto salen exactos, sin que la IA los cambie).
// ───────────────────────────────────────────────────────────────

const guion = require("./guion");

// Saludos/apodos que NO son un nombre. Si llegan como "nombre", el bot
// debe preguntar el nombre real antes de cerrar (evita leads basura).
const NO_ES_NOMBRE = new Set([
  "hola", "buenas", "hermano", "hermana", "parce", "parcero", "bro", "brother",
  "amigo", "amiga", "llave", "mor", "men", "man", "crack", "socio", "jefe",
  "compa", "pana", "mano", "loco", "rey", "reina", "papi", "mami", "señor",
  "senor", "señora", "senora", "que mas", "quemas", "saludos",
]);

function pareceNombreValido(nombre = "") {
  const n = String(nombre)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.length < 2) return false;
  return !NO_ES_NOMBRE.has(n);
}

// Registra el lead: siempre en logs y, si hay LEAD_WEBHOOK_URL, lo manda
// a tu CRM/tabla. No bloquea la respuesta (fire-and-forget).
function registrarLead(lead) {
  try {
    console.log("🟢 NUEVO LEAD:", JSON.stringify(lead));
  } catch (_e) {
    /* noop */
  }
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  }).catch((e) => console.error("Error enviando lead al webhook:", e.message));
}

// Rama CALIFICADA: agenda la llamada (Calendly).
function agendarLlamada(lead = {}) {
  if (!pareceNombreValido(lead.nombre)) {
    return { ok: false, motivo: "Aún no tienes su nombre real (parece un saludo o apodo). Pídeselo antes de agendar." };
  }
  registrarLead({ ...lead, rama: "llamada", evento: "agendar_llamada", ts: new Date().toISOString() });
  return { ok: true, mensaje: guion.CALENDLY_BLOQUE };
}

// Rama CLUB: entrega el club Upgrade Project (Skool, $34/mes).
function enviarClub(lead = {}) {
  if (!pareceNombreValido(lead.nombre)) {
    return { ok: false, motivo: "Aún no tienes su nombre real (parece un saludo o apodo). Pídeselo antes de enviar el club." };
  }
  registrarLead({ ...lead, rama: "club", evento: "enviar_club", ts: new Date().toISOString() });
  return { ok: true, mensaje: guion.CLUB_BLOQUE };
}

module.exports = { agendarLlamada, enviarClub, registrarLead, pareceNombreValido };
