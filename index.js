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

// Carga el .env en desarrollo local. En Railway las vars van en la plataforma
// (ahí no hay .env y dotenv simplemente no hace nada).
try { require("dotenv").config(); } catch (_e) {}

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

// Señales de OBJECIÓN de garantía: aunque mencionen "resultados", NO es un
// pedido de testimonios sino la objeción "¿me aseguras resultados?". En ese
// caso NO mostramos el bloque de testimonios: lo maneja el LLM con su guion.
const PALABRAS_GARANTIA = [
  "asegura", "aseguras", "asegures", "garantiza", "garantizas", "garantia",
  "promete", "prometes", "prometo",
];

// País por nombre o gentilicio (sin tildes, en minúscula) → país canónico.
// Sirve para el GATE del país: detectamos de dónde es la persona en su mensaje.
const PAISES = {
  colombia: "Colombia", colombiano: "Colombia", colombiana: "Colombia",
  mexico: "México", mexicano: "México", mexicana: "México",
  peru: "Perú", peruano: "Perú", peruana: "Perú",
  argentina: "Argentina", argentino: "Argentina",
  chile: "Chile", chileno: "Chile", chilena: "Chile",
  venezuela: "Venezuela", venezolano: "Venezuela", venezolana: "Venezuela",
  ecuador: "Ecuador", ecuatoriano: "Ecuador", ecuatoriana: "Ecuador",
  bolivia: "Bolivia", boliviano: "Bolivia", boliviana: "Bolivia",
  paraguay: "Paraguay", paraguayo: "Paraguay", paraguaya: "Paraguay",
  uruguay: "Uruguay", uruguayo: "Uruguay", uruguaya: "Uruguay",
  brasil: "Brasil", brazil: "Brasil", brasileno: "Brasil", brasilero: "Brasil",
  panama: "Panamá", panameno: "Panamá",
  guatemala: "Guatemala", guatemalteco: "Guatemala",
  honduras: "Honduras", hondureno: "Honduras",
  nicaragua: "Nicaragua", nicaraguense: "Nicaragua",
  "el salvador": "El Salvador", salvador: "El Salvador", salvadoreno: "El Salvador",
  "costa rica": "Costa Rica", costarricense: "Costa Rica",
  "republica dominicana": "República Dominicana", dominicano: "República Dominicana", dominicana: "República Dominicana",
  "puerto rico": "Puerto Rico", boricua: "Puerto Rico", puertorriqueno: "Puerto Rico",
  cuba: "Cuba", cubano: "Cuba", cubana: "Cuba",
  espana: "España", espanol: "España", espanola: "España",
  "estados unidos": "Estados Unidos", eeuu: "Estados Unidos",
};
// Claves ordenadas por longitud desc: prioriza multi-palabra ("costa rica" antes que "rica").
const CLAVES_PAIS = Object.keys(PAISES).sort((a, b) => b.length - a.length);

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Detecta el país mencionado en un texto ("soy de Perú", "peruano", etc.).
// Devuelve el país canónico o null. Usa límites de no-letra para no matchear
// dentro de otra palabra ("peru" no matchea en "peruano", pero "peruano" sí).
function detectarPais(texto) {
  const t = normalizar(texto);
  for (const clave of CLAVES_PAIS) {
    const re = new RegExp("(^|[^a-z])" + clave.replace(/ /g, "\\s+") + "([^a-z]|$)");
    if (re.test(t)) return PAISES[clave];
  }
  return null;
}

// Divide un texto en varios mensajes (más humano). CADA bloque separado por una
// LÍNEA EN BLANCO se envía como un mensaje APARTE, sin importar el largo: así el
// saludo, la frase puente y la pregunta salen como mensajes distintos (como
// chatea una persona real), en vez de un bloque con varias ideas pegadas.
function dividirEnMensajes(texto) {
  const limpio = String(texto || "").trim();
  const partes = limpio
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^[-—]+$/.test(p));
  return partes.length > 0 ? partes : [limpio];
}

async function procesarMensaje(mensajeUsuario, sesion, meta = {}) {
  const texto = normalizar(mensajeUsuario);

  // 1) Saludo / reinicio → saludo (audio si está configurado, si no texto).
  if (SALUDOS.includes(texto)) {
    sesion.historial = [];
    sesion.pais = null; // reinicia el gate del país
    return saludoResp();
  }

  // GATE DEL PAÍS (determinístico, no depende del LLM): de dónde es la persona
  // SIEMPRE va primero. Detectamos el país en su mensaje y lo guardamos; si aún
  // no lo tenemos, preguntamos SOLO el país y no avanzamos a la calificación.
  const paisDetectado = detectarPais(mensajeUsuario);
  if (paisDetectado) sesion.pais = paisDetectado;
  if (!sesion.pais) {
    sesion.historial.push({ role: "user", content: mensajeUsuario });
    sesion.historial.push({ role: "assistant", content: guion.PREGUNTA_PAIS });
    if (sesion.historial.length > 40) sesion.historial = sesion.historial.slice(-40);
    return guion.PREGUNTA_PAIS;
  }

  // 2) Pide resultados/pruebas → bloque de testimonios reales.
  //    PERO si es la objeción de garantía ("¿me aseguras resultados?"), NO:
  //    eso lo responde el LLM con el guion de garantía.
  if (
    PALABRAS_RESULTADOS.some((p) => texto.includes(p)) &&
    !PALABRAS_GARANTIA.some((p) => texto.includes(p))
  ) {
    return resultados.testimonios();
  }

  // 3) Todo lo demás lo lleva el LLM (Brayan), con E-Master como contexto.
  //    Le pasamos el país ya capturado para que NO lo vuelva a preguntar y para
  //    el cierre por país (Nequi vs familiar) y los args de las herramientas.
  let respuestaLLM = await llm.responder(mensajeUsuario, sesion.historial, { ...meta, pais: sesion.pais });
  if (respuestaLLM) {
    // Anti-repetición del CIERRE: si el bot ya entregó un bloque de cierre
    // (Calendly / club / video) y lo vuelve a generar, NO repetimos el bloque
    // con el link; respondemos algo corto de confirmación. Así no spameamos el
    // mismo link cuando la persona dice "listo", "ya", etc.
    const tipoCierre =
      respuestaLLM === guion.CALENDLY_BLOQUE ? "llamada" :
      respuestaLLM === guion.CLUB_BLOQUE ? "club" :
      respuestaLLM === guion.VIDEO_GRATIS ? "video" : null;

    if (tipoCierre && sesion.cerrado === tipoCierre) {
      // Ya se entregó este cierre: en vez de repetir el link, hacemos SEGUIMIENTO.
      respuestaLLM =
        tipoCierre === "llamada" ? "¿Ya pudiste agendar en el link, bro? Avísame apenas lo hagas y lo confirmamos 🙌" :
        tipoCierre === "club" ? "¿Ya pudiste entrar al club? Mándame la captura apenas estés adentro y te activo de una 🙌" :
        "¡Listo, bro! Cualquier cosa por aquí estoy 🙌";
    } else if (tipoCierre) {
      sesion.cerrado = tipoCierre;
    }

    sesion.historial.push({ role: "user", content: mensajeUsuario });
    sesion.historial.push({ role: "assistant", content: respuestaLLM });
    // Guardamos una ventana amplia: el cierre del club depende del PAÍS capturado
    // al inicio de la calificación, así que no debe caerse del historial.
    if (sesion.historial.length > 40) sesion.historial = sesion.historial.slice(-40);
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
      canal: "whatsapp",
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
    respuesta = await procesarMensaje(entrante, sesion, { telefono, canal: "whatsapp" });
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

// ───────── API para ManyChat (Instagram DMs) ─────────
// ManyChat manda { mensaje, usuario, nombre } y devolvemos los mensajes en el
// formato "v2" que ManyChat renderiza como burbujas (más un campo "respuesta"
// plano por si prefieres mapearlo a un solo mensaje). Misma lógica que WhatsApp.
app.post("/api/manychat", async (req, res) => {
  limpiarSesiones();
  try {
    const usuario = String(req.body.usuario || req.body.user_id || "anon");
    const mensaje = String(req.body.mensaje || req.body.text || "");
    const id = "ig:" + usuario;
    const sesion = obtenerSesion(id);

    // Seguimiento: primer contacto (canal instagram).
    if (!sesion.contactoReportado) {
      sesion.contactoReportado = true;
      acciones.reportarSeguimiento({
        telefono: usuario,
        canal: "instagram",
        evento: "primer_contacto",
        estado: "sin_agendar",
        ts: new Date().toISOString(),
      });
    }
    sesion.saludado = true;

    let respuesta;
    try {
      respuesta = await procesarMensaje(mensaje, sesion, { telefono: usuario, canal: "instagram" });
    } catch (err) {
      console.error("Error procesando (manychat):", err.message);
      respuesta = guion.SALUDO;
    }

    // En IG mandamos texto. Si el saludo viene en audio (config de WhatsApp), usamos texto.
    const base = typeof respuesta === "string" ? respuesta : guion.SALUDO;
    const partes = dividirEnMensajes(base);

    res.json({
      version: "v2",
      content: { messages: partes.map((t) => ({ type: "text", text: t })) },
      respuesta: partes.join("\n\n"),
    });
  } catch (err) {
    console.error("Error en /api/manychat:", err.message);
    res.json({ version: "v2", content: { messages: [{ type: "text", text: "Dame un segundo 🙌" }] } });
  }
});

const VERSION = "v12-nequi-cierre";
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
