// index.js
// Bot de WhatsApp de E-Master Project (Brayan Hernández) — Twilio + Express + LLM.
//
// 100% conversacional. El bot es del EQUIPO de Brayan y su meta es
// calificar al interesado y llevarlo a AGENDAR una llamada.
// Flujo:
//   • Saludo               → se presenta el equipo y abre la conversación.
//   • "resultados/pruebas" → envía el bloque de testimonios reales.
//   • Cualquier otra cosa  → responde el LLM (setter), breve y humano,
//                            con el conocimiento de E-Master como contexto.
//
// El estado de cada conversación se guarda EN MEMORIA por número.

const path = require("path");
const express = require("express");
const twilio = require("twilio");
const guion = require("./guion");
const resultados = require("./resultados");
const acciones = require("./acciones");
const llm = require("./llm");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// Sirve archivos públicos (ej. el audio del saludo) — un archivo en /public
// queda accesible en https://TU-URL/<archivo>.
app.use(express.static(path.join(__dirname, "public")));

const { MessagingResponse } = twilio.twiml;

// Audio pregrabado del saludo (el que pide el nombre). Si está vacío, saluda
// con texto. Puede ser una URL pública o un archivo en /public.
const SALUDO_AUDIO_URL = process.env.SALUDO_AUDIO_URL || "";

// Respuesta de saludo: audio si está configurado; si no, el texto del guion.
function saludoResp() {
  return SALUDO_AUDIO_URL ? { media: [SALUDO_AUDIO_URL] } : guion.SALUDO;
}

// ───────── Envío de mensajes salientes (Twilio REST) ─────────
// Se usa para el "saludo diferido": responder unos segundos después.
let twilioClient = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

function puedeEnviar() {
  return Boolean(getTwilioClient() && process.env.TWILIO_WHATSAPP_FROM);
}

async function enviarWhatsapp(to, body) {
  const c = getTwilioClient();
  if (!c) return;
  await c.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to, body });
}

// Retraso del saludo de apertura: aleatorio entre MIN y MAX (ms) para que
// se sienta humano. Por defecto entre 20s y 45s. Editable por env.
const SALUDO_DELAY_MIN_MS = Number(process.env.SALUDO_DELAY_MIN_MS || 20000);
const SALUDO_DELAY_MAX_MS = Number(process.env.SALUDO_DELAY_MAX_MS || 45000);

// ¿Está activo el saludo diferido? (MAX = 0 lo desactiva → saludo al instante)
const saludoDiferidoActivo = () => SALUDO_DELAY_MAX_MS > 0;

function delaySaludoMs() {
  const min = Math.max(0, SALUDO_DELAY_MIN_MS);
  const max = Math.max(min, SALUDO_DELAY_MAX_MS);
  return Math.floor(min + Math.random() * (max - min));
}

// ───────── Sesiones en memoria ─────────
const sesiones = new Map();
const SESION_TTL_MS = 60 * 60 * 1000; // 1 hora

function obtenerSesion(id) {
  const ahora = Date.now();
  let s = sesiones.get(id);
  if (!s) {
    s = { historial: [], saludado: false, visto: ahora };
    sesiones.set(id, s);
  }
  s.visto = ahora;
  return s;
}

function limpiarSesiones() {
  const ahora = Date.now();
  for (const [id, s] of sesiones) {
    if (ahora - s.visto > SESION_TTL_MS) sesiones.delete(id);
  }
}

// Saludos "puros" y comandos de reinicio.
const SALUDOS = [
  "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "buen dia",
  "que tal", "hey", "hi", "hello", "ola", "saludos", "menu", "inicio", "info",
  "informacion", "información", "quiero informacion", "quiero información",
];

// Disparadores del bloque de resultados/testimonios.
const PALABRAS_RESULTADOS = [
  "testimonio", "testimonios", "resultado", "resultados", "prueba", "pruebas",
  "caso", "casos", "estudiantes", "funciona de verdad", "es real",
];

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Divide un texto en varios mensajes (más humano), PERO solo si es largo.
// Los mensajes cortos van en UNA sola burbuja (así no saturamos a WhatsApp/Twilio
// con muchas burbujas); los largos se cortan en sus líneas en blanco.
const UMBRAL_DIVIDIR = 300; // caracteres: por debajo de esto, un solo mensaje

function dividirEnMensajes(texto) {
  const limpio = String(texto || "").trim();
  if (limpio.length <= UMBRAL_DIVIDIR) return [limpio];
  const partes = limpio
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^[-—]+$/.test(p));
  return partes.length > 0 ? partes : [limpio];
}

async function procesarMensaje(mensajeUsuario, sesion, telefono = null) {
  const texto = normalizar(mensajeUsuario);

  // 1) Saludo / reinicio → saludo (audio si está configurado, si no texto).
  if (SALUDOS.includes(texto)) {
    sesion.historial = [];
    return saludoResp();
  }

  // 2) Pide resultados/pruebas → bloque de testimonios reales.
  if (PALABRAS_RESULTADOS.some((p) => texto.includes(p))) {
    return resultados.testimonios();
  }

  // 3) Todo lo demás lo lleva el LLM (Brayan), con E-Master como contexto.
  const respuestaLLM = await llm.responder(mensajeUsuario, sesion.historial, telefono);
  if (respuestaLLM) {
    sesion.historial.push({ role: "user", content: mensajeUsuario });
    sesion.historial.push({ role: "assistant", content: respuestaLLM });
    if (sesion.historial.length > 12) sesion.historial = sesion.historial.slice(-12);
    return respuestaLLM;
  }

  // 4) Respaldo si no hay LLM disponible.
  return guion.SALUDO;
}

// ───────── Webhook de Twilio (WhatsApp) ─────────
app.post("/webhook", async (req, res) => {
  limpiarSesiones();

  const id = req.body.From || "anon";
  const telefono = id.replace(/^whatsapp:/, "");
  const entrante = req.body.Body || "";
  const sesion = obtenerSesion(id);

  // SEGUIMIENTO: reporta el PRIMER contacto (base para re-contactar a quien no agenda).
  if (!sesion.contactoReportado) {
    sesion.contactoReportado = true;
    acciones.reportarSeguimiento({
      telefono,
      evento: "primer_contacto",
      estado: "sin_agendar",
      ts: new Date().toISOString(),
    });
  }

  // Saludo de APERTURA con retraso (solo para saludo de TEXTO): primer mensaje +
  // saludo → ack al instante y enviamos el saludo unos segundos después (más humano).
  // Si hay audio configurado, el saludo va al instante (no se difiere).
  const esSaludo = SALUDOS.includes(normalizar(entrante));
  if (esSaludo && !sesion.saludado && puedeEnviar() && saludoDiferidoActivo() && !SALUDO_AUDIO_URL) {
    sesion.saludado = true;
    res.type("text/xml").send(new MessagingResponse().toString()); // ack vacío
    setTimeout(() => {
      enviarWhatsapp(id, guion.SALUDO).catch((e) =>
        console.error("Error enviando saludo diferido:", e.message)
      );
    }, delaySaludoMs());
    return;
  }
  sesion.saludado = true;

  let respuesta;
  try {
    respuesta = await procesarMensaje(entrante, sesion, telefono);
  } catch (err) {
    console.error("Error procesando mensaje:", err.message);
    respuesta = guion.SALUDO;
  }

  const twiml = new MessagingResponse();
  if (typeof respuesta === "string") {
    // Un mensaje largo se parte en varios (cada renglón en blanco = nuevo mensaje).
    dividirEnMensajes(respuesta).forEach((parte) => twiml.message(parte));
  } else {
    // Respuesta con imágenes: { texto, media: [urls] } va en un solo mensaje.
    const msg = twiml.message();
    if (respuesta.texto) msg.body(respuesta.texto);
    (respuesta.media || []).forEach((url) => msg.media(url));
  }
  res.type("text/xml").send(twiml.toString());
});

const VERSION = "v10-menos-burbujas";
app.get("/", (_req, res) => {
  res.send(`Bot de WhatsApp de E-Master (Brayan Hernández) activo ✅ (${VERSION})`);
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Bot de E-Master escuchando en el puerto ${PORT}`);
  });
}

module.exports = { app, procesarMensaje };
