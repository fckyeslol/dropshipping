// agenda.js
// ───────────────────────────────────────────────────────────────
//  AGENDAR LA LLAMADA + CAPTURA DE LEADS
// ───────────────────────────────────────────────────────────────
//  La meta del bot es llevar a la persona a AGENDAR una llamada.
//  Aquí vive:
//    • el link de agenda (BOOKING_LINK) que se le entrega, y
//    • el registro del lead (logs y, opcional, un webhook a tu CRM).
//
//  El LLM (llm.js) llama a `agendarLlamada(...)` con los datos que
//  haya recogido en la conversación. Esto imita al "cotizar" del otro
//  bot: una herramienta que el modelo usa para cerrar el paso final.
// ───────────────────────────────────────────────────────────────

// Link al que enviamos a la persona para agendar (Calendly, Cal.com,
// Google Form, o un wa.me a un asesor). Se configura por variable de entorno.
const BOOKING_LINK = process.env.BOOKING_LINK || "";

// Registra el lead: siempre en logs y, si hay LEAD_WEBHOOK_URL, lo manda
// a tu CRM / hoja de cálculo. No bloquea la respuesta (fire-and-forget).
function registrarLead(lead) {
  try {
    console.log("🟢 NUEVO LEAD:", JSON.stringify(lead));
  } catch (_e) {
    /* noop */
  }

  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;

  // No esperamos la respuesta: si tu CRM tarda, no frena el chat.
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  }).catch((e) => console.error("Error enviando lead al webhook:", e.message));
}

// Resumen corto del lead, para confirmar en el chat / guardar.
function resumenLead(lead = {}) {
  const partes = [];
  if (lead.nombre) partes.push(lead.nombre);
  if (lead.pais) partes.push(lead.pais);
  if (lead.situacion) partes.push(lead.situacion);
  return partes.join(" · ") || "interesado";
}

// Herramienta que usa el LLM cuando la persona quiere agendar.
// Devuelve { disponible, link, resumen } o { disponible:false, motivo }.
function agendarLlamada(lead = {}) {
  // Guardamos el lead aunque no haya link configurado (no se pierde).
  registrarLead({ ...lead, evento: "agendar_llamada", ts: new Date().toISOString() });

  if (!BOOKING_LINK) {
    return {
      disponible: false,
      motivo:
        "Aún no hay link de agenda configurado (BOOKING_LINK). Pide sus datos y dile que el equipo lo contacta enseguida para coordinar la llamada.",
    };
  }

  return { disponible: true, link: BOOKING_LINK, resumen: resumenLead(lead) };
}

// ¿Hay link de agenda configurado?
function activo() {
  return Boolean(BOOKING_LINK);
}

module.exports = { BOOKING_LINK, agendarLlamada, registrarLead, resumenLead, activo };
