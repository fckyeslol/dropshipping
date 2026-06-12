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
  // Genéricos que la IA podría inventar si no tiene el nombre real:
  "anonimo", "cliente", "usuario", "interesado", "persona", "lead", "prueba",
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

// POST genérico a un webhook (fire-and-forget, no bloquea la respuesta).
function postWebhook(url, payload) {
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("Error en webhook:", e.message));
}

// Reporte de SEGUIMIENTO (para re-contactar a quien no agenda). Va a un webhook
// aparte (SEGUIMIENTO_WEBHOOK_URL), distinto de la tabla del 1:1.
function reportarSeguimiento(payload) {
  postWebhook(process.env.SEGUIMIENTO_WEBHOOK_URL, payload);
}

// Registra el lead. SIEMPRE lo deja en los logs. Solo lo manda a la TABLA
// (LEAD_WEBHOOK_URL) si opciones.tabla === true → reservado para el servicio 1:1.
// Además marca al contacto como convertido en el seguimiento (para no re-contactarlo).
function registrarLead(lead, opciones = {}) {
  try {
    console.log("🟢 LEAD:", JSON.stringify(lead));
  } catch (_e) {
    /* noop */
  }
  if (opciones.tabla) postWebhook(process.env.LEAD_WEBHOOK_URL, lead);
  reportarSeguimiento({
    telefono: lead.telefono || null,
    nombre: lead.nombre || null,
    canal: lead.canal || "whatsapp",
    estado: lead.rama === "llamada" ? "agendo" : lead.rama === "club" ? "club" : "sin_dinero",
    ts: lead.ts,
  });
}

// Rama CALIFICADA: agenda la llamada (Calendly).
// Con más de $1.000 USD confirmados es PRIORIDAD ALTA (candidato a VIP) y se
// entrega el bloque VIP. Premium/VIP se cierran en la reunión, nunca por chat.
function agendarLlamada(lead = {}) {
  if (!pareceNombreValido(lead.nombre)) {
    return { ok: false, motivo: "No recibí el argumento 'nombre'. Si la persona YA te dio su nombre antes en la conversación, vuelve a llamar agendar_llamada incluyéndolo en 'nombre' (NO se lo preguntes otra vez). Pídeselo SOLO si de verdad nunca lo dio o si dio un apodo/saludo." };
  }
  const esVip = Number(lead.capitalUSD) > 1000;
  // tabla:true → este SÍ va a la tabla del servicio 1:1.
  registrarLead(
    { ...lead, rama: "llamada", prioridad: esVip ? "alta_vip" : "normal", evento: "agendar_llamada", ts: new Date().toISOString() },
    { tabla: true }
  );
  return { ok: true, mensaje: esVip ? guion.CALENDLY_BLOQUE_VIP : guion.CALENDLY_BLOQUE };
}

// Rama CLUB: entrega el club Upgrade Project (Skool, $34/mes).
function enviarClub(lead = {}) {
  if (!pareceNombreValido(lead.nombre)) {
    return { ok: false, motivo: "No recibí el argumento 'nombre'. Si la persona YA te dio su nombre antes en la conversación, vuelve a llamar enviar_club incluyéndolo en 'nombre' (NO se lo preguntes otra vez). Pídeselo SOLO si de verdad nunca lo dio o si dio un apodo/saludo." };
  }
  // tabla:false → el club NO va a la tabla del 1:1 (solo logs + seguimiento).
  registrarLead({ ...lead, rama: "club", evento: "enviar_club", ts: new Date().toISOString() }, { tabla: false });
  return { ok: true, mensaje: guion.CLUB_BLOQUE };
}

// Off-ramp: la persona no tiene dinero ni para el club → video gratis + seguir el canal.
function enviarVideoGratis(lead = {}) {
  registrarLead({ ...lead, rama: "sin_dinero", evento: "video_gratis", ts: new Date().toISOString() }, { tabla: false });
  return { ok: true, mensaje: guion.VIDEO_GRATIS };
}

module.exports = { agendarLlamada, enviarClub, enviarVideoGratis, registrarLead, reportarSeguimiento, pareceNombreValido };
