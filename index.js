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

const express = require("express");
const twilio = require("twilio");
const oferta = require("./oferta");
const resultados = require("./resultados");
const llm = require("./llm");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const { MessagingResponse } = twilio.twiml;

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

async function procesarMensaje(mensajeUsuario, sesion) {
  const texto = normalizar(mensajeUsuario);

  // 1) Saludo / reinicio → el equipo se presenta (template, instantáneo).
  if (SALUDOS.includes(texto)) {
    sesion.historial = [];
    return oferta.SALUDO;
  }

  // 2) Pide resultados/pruebas → bloque de testimonios reales.
  if (PALABRAS_RESULTADOS.some((p) => texto.includes(p))) {
    return resultados.testimonios();
  }

  // 3) Todo lo demás lo lleva el LLM (setter), con E-Master como contexto.
  const respuestaLLM = await llm.responder(mensajeUsuario, sesion.historial);
  if (respuestaLLM) {
    sesion.historial.push({ role: "user", content: mensajeUsuario });
    sesion.historial.push({ role: "assistant", content: respuestaLLM });
    if (sesion.historial.length > 12) sesion.historial = sesion.historial.slice(-12);
    return respuestaLLM;
  }

  // 4) Respaldo si no hay LLM disponible.
  return oferta.SALUDO;
}

// ───────── Webhook de Twilio (WhatsApp) ─────────
app.post("/webhook", async (req, res) => {
  limpiarSesiones();

  const id = req.body.From || "anon";
  const entrante = req.body.Body || "";
  const sesion = obtenerSesion(id);

  // Saludo de APERTURA con retraso: si es el primer mensaje de la sesión y es
  // un saludo, confirmamos a Twilio al instante (sin texto) y enviamos el
  // saludo unos segundos después, para que se sienta humano.
  const esSaludo = SALUDOS.includes(normalizar(entrante));
  if (esSaludo && !sesion.saludado && puedeEnviar() && saludoDiferidoActivo()) {
    sesion.saludado = true;
    res.type("text/xml").send(new MessagingResponse().toString()); // ack vacío
    setTimeout(() => {
      enviarWhatsapp(id, oferta.SALUDO).catch((e) =>
        console.error("Error enviando saludo diferido:", e.message)
      );
    }, delaySaludoMs());
    return;
  }
  sesion.saludado = true;

  let respuesta;
  try {
    respuesta = await procesarMensaje(entrante, sesion);
  } catch (err) {
    console.error("Error procesando mensaje:", err.message);
    respuesta = oferta.SALUDO;
  }

  const twiml = new MessagingResponse();
  const msg = twiml.message();
  if (typeof respuesta === "string") {
    msg.body(respuesta);
  } else {
    // Respuesta con imágenes: { texto, media: [urls] }
    if (respuesta.texto) msg.body(respuesta.texto);
    (respuesta.media || []).forEach((url) => msg.media(url));
  }
  res.type("text/xml").send(twiml.toString());
});

const VERSION = "v1-setter-agendar-llamada";
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
