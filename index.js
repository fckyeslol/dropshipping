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

// ───────── Sesiones (CAMBIO-05b) ─────────
// Backend Redis si hay REDIS_URL (compartido entre pods), si no memoria local.
// Mismo TTL de 1 hora. La API es async: store.cargar / store.guardar / store.limpiar.
const store = require("./sesionStore");

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
  // Duda de legitimidad ("¿es estafa / es confiable?"): es la objeción 11.
  // Va aquí para responderla con casos + Instagram de forma determinística,
  // en CUALQUIER rama y AUN después del cierre (si no, en rama llamada el bot
  // re-cerraba con Calendly y la objeción quedaba sin responder, CAMBIO-11).
  "estafa", "estafan", "fraude", "es confiable", "es legitimo", "es legítimo",
  "es legal", "no sera real", "será real", "sera real", "es verdad esto",
  "es de verdad", "es seguro esto",
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

// Lugares conocidos (departamentos/ciudades) → país. Best-effort para cuando
// la persona responde con su ciudad o región en vez del país ("vengo del
// Chocó"). Solo lugares poco ambiguos: los que chocan con nombres de persona,
// palabras comunes u otros países se dejan fuera y se repregunta.
const LUGARES = {
  // Colombia: departamentos y ciudades principales
  choco: "Colombia", antioquia: "Colombia", cundinamarca: "Colombia",
  atlantico: "Colombia", santander: "Colombia", narino: "Colombia",
  boyaca: "Colombia", caldas: "Colombia", risaralda: "Colombia",
  quindio: "Colombia", tolima: "Colombia", huila: "Colombia",
  casanare: "Colombia", guajira: "Colombia", magdalena: "Colombia",
  putumayo: "Colombia", caqueta: "Colombia", arauca: "Colombia",
  bogota: "Colombia", medellin: "Colombia", cali: "Colombia",
  barranquilla: "Colombia", cartagena: "Colombia", cucuta: "Colombia",
  bucaramanga: "Colombia", pereira: "Colombia", manizales: "Colombia",
  ibague: "Colombia", "santa marta": "Colombia", villavicencio: "Colombia",
  pasto: "Colombia", monteria: "Colombia", neiva: "Colombia",
  popayan: "Colombia", valledupar: "Colombia", quibdo: "Colombia",
  tunja: "Colombia", sincelejo: "Colombia", riohacha: "Colombia",
  armenia: "Colombia",
  // México
  cdmx: "México", "ciudad de mexico": "México", guadalajara: "México",
  monterrey: "México", puebla: "México", tijuana: "México",
  cancun: "México", chihuahua: "México", oaxaca: "México",
  chiapas: "México", veracruz: "México", queretaro: "México",
  toluca: "México", jalisco: "México", sinaloa: "México",
  sonora: "México", yucatan: "México", michoacan: "México",
  guanajuato: "México", tabasco: "México", tamaulipas: "México",
  "nuevo leon": "México", "baja california": "México",
  // Perú
  lima: "Perú", arequipa: "Perú", trujillo: "Perú", cusco: "Perú",
  piura: "Perú", chiclayo: "Perú", iquitos: "Perú", callao: "Perú",
  tacna: "Perú",
  // Argentina
  "buenos aires": "Argentina", "la plata": "Argentina",
  "mar del plata": "Argentina", tucuman: "Argentina", neuquen: "Argentina",
  mendoza: "Argentina",
  // Chile
  santiago: "Chile", valparaiso: "Chile", concepcion: "Chile",
  antofagasta: "Chile", "vina del mar": "Chile",
  // Venezuela
  caracas: "Venezuela", maracaibo: "Venezuela", barquisimeto: "Venezuela",
  maracay: "Venezuela",
  // Ecuador
  quito: "Ecuador", guayaquil: "Ecuador", cuenca: "Ecuador", ambato: "Ecuador",
  // Bolivia
  "la paz": "Bolivia", cochabamba: "Bolivia", "santa cruz": "Bolivia",
  // Otros
  asuncion: "Paraguay", montevideo: "Uruguay",
  "sao paulo": "Brasil", "rio de janeiro": "Brasil", brasilia: "Brasil",
  tegucigalpa: "Honduras", "san pedro sula": "Honduras",
  managua: "Nicaragua", "san salvador": "El Salvador",
  "san jose": "Costa Rica", "santo domingo": "República Dominicana",
  "punta cana": "República Dominicana", habana: "Cuba",
  madrid: "España", barcelona: "España", sevilla: "España",
  bilbao: "España", malaga: "España", zaragoza: "España",
  tenerife: "España", canarias: "España",
  miami: "Estados Unidos", "nueva york": "Estados Unidos",
  "new york": "Estados Unidos", houston: "Estados Unidos",
  orlando: "Estados Unidos", chicago: "Estados Unidos",
  "los angeles": "Estados Unidos",
};
const CLAVES_LUGAR = Object.keys(LUGARES).sort((a, b) => b.length - a.length);

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
  // Segundo intento: lugares conocidos (ciudad/departamento → país).
  for (const clave of CLAVES_LUGAR) {
    const re = new RegExp("(^|[^a-z])" + clave.replace(/ /g, "\\s+") + "([^a-z]|$)");
    if (re.test(t)) return LUGARES[clave];
  }
  return null;
}

// ───────── Capital: conversión a USD DETERMINÍSTICA ─────────
// El LLM convierte mal las monedas y a veces rutea a la rama equivocada.
// Aquí detectamos el monto + moneda en el mensaje, lo convertimos a USD con
// tasas aproximadas (basta para rutear) y decidimos la RAMA en código.
// Tasas: unidades de moneda local por 1 USD.
const MONEDAS = [
  { re: "d[oó]lar(?:es)?|usd|dolares", porUSD: 1 },
  { re: "bolivianos?", porUSD: 7 },
  { re: "soles?", porUSD: 3.7 },
  { re: "reales?", porUSD: 5 },
  { re: "euros?", porUSD: 0.9 },
  { re: "quetzales?", porUSD: 7.7 },
  { re: "lempiras?", porUSD: 24.7 },
  { re: "cordobas?", porUSD: 36.5 },
  { re: "colones?", porUSD: 520 },
  { re: "guaranies?", porUSD: 7300 },
  { re: "pesos?\\s+colombianos?", porUSD: 4000 },
  { re: "pesos?\\s+mexicanos?", porUSD: 18 },
  { re: "pesos?\\s+argentinos?", porUSD: 1000 },
  { re: "pesos?\\s+chilenos?", porUSD: 950 },
  { re: "pesos?\\s+dominicanos?", porUSD: 58 },
  { re: "pesos?\\s+uruguayos?", porUSD: 40 },
  { re: "pesos?", porUSD: null }, // genérico: se resuelve por el país
];
const PESOS_POR_PAIS = {
  Colombia: 4000, "México": 18, Argentina: 1000, Chile: 950,
  Uruguay: 40, "República Dominicana": 58,
};

// "6.000" / "6,000" → 6000 ; "1,5" → 1.5
function parseNumero(s) {
  const limpio = String(s).replace(/\s/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(limpio)) return Number(limpio.replace(/[.,]/g, ""));
  return Number(limpio.replace(",", "."));
}

// Devuelve el capital en USD aprox o null si el mensaje no trae un monto claro.
// NO se dispara sobre METAS ("quiero ganar 2000 al mes"), solo sobre capital.
function detectarCapitalUSD(texto, pais) {
  const t = normalizar(texto);
  if (/(ganar|generar|facturar|lograr|llegar a)\b/.test(t)) return null;
  if (/al mes|mensual|por mes|a la semana|al dia|diarios?/.test(t)) return null;

  const MULT = { mil: 1000, millon: 1e6, millones: 1e6, k: 1000 };
  for (const m of MONEDAS) {
    const re = new RegExp("(\\d[\\d.,]*)\\s*(mil|millon(?:es)?|k)?\\s*(?:de\\s+)?(?:" + m.re + ")([^a-z]|$)");
    const hit = t.match(re);
    if (!hit) continue;
    let monto = parseNumero(hit[1]);
    if (hit[2]) monto *= MULT[hit[2]] || 1;
    let tasa = m.porUSD;
    if (tasa === null) tasa = PESOS_POR_PAIS[pais] || null; // "pesos" a secas
    if (!tasa || Number.isNaN(monto) || monto <= 0) continue;
    return monto / tasa;
  }

  // "$700" / "tengo 2 millones" sin moneda explícita: usa la moneda del país.
  const generico = t.match(/\$?\s*(\d[\d.,]*)\s*(mil|millon(?:es)?|k)\b/) || t.match(/\$\s*(\d[\d.,]*)/);
  if (generico) {
    let monto = parseNumero(generico[1]);
    if (generico[2]) monto *= MULT[generico[2]] || 1;
    if (Number.isNaN(monto) || monto <= 0) return null;
    // Montos chicos con "$" se leen como USD; montos grandes, en moneda local.
    if (monto <= 20000) return monto;
    const tasa = PESOS_POR_PAIS[pais];
    return tasa ? monto / tasa : null;
  }
  return null;
}

// Rama de cierre según el capital (en USD). Mismos cortes que el prompt:
//   > $1.000  → llamada VIP (prioridad alta, candidato a VIP)
//   $600–1.000 → llamada (en la reunión se define Premium o VIP)
//   < $600    → club
function ramaPorCapital(usd) {
  if (usd > 1000) return "llamada_vip";
  if (usd >= 600) return "llamada";
  return "club";
}

// Detección de nombre CONSERVADORA: solo patrones explícitos ("me llamo Juan",
// "mi nombre es Ana", "soy Pedro"). Si no hay patrón claro NO asume nombre
// (el LLM lo pide después). Sirve para que el gate del país no vuelva a pedir
// el nombre cuando la persona ya lo dio.
const NO_NOMBRES = new Set([
  "de", "del", "la", "el", "un", "una", "desde", "muy", "mas",
  "interesado", "interesada", "nuevo", "nueva", "yo", "alguien",
  "estudiante", "emprendedor", "emprendedora",
  // Apodos/saludos que NO son un nombre real (CAMBIO-02). detectarNombre corre
  // antes del LLM, así que el filtro debe vivir aquí, no solo en el prompt.
  "parce", "parcero", "parcera", "bro", "brother", "broder", "brou",
  "hermano", "hermana", "mano", "manito", "pana", "compa", "compadre",
  "comadre", "loco", "men", "papi", "papá", "papa", "mami", "rey", "reina",
  "crack", "capo", "jefe", "jefa", "amigo", "amiga", "socio", "socia",
  "llave", "primo", "prima", "vale", "mijo", "mija", "causa", "wey", "güey",
  // Ocupaciones comunes ("soy enfermera" NO es un nombre):
  "enfermera", "enfermero", "doctor", "doctora", "medico", "medica",
  "ingeniero", "ingeniera", "abogado", "abogada", "profesor", "profesora",
  "maestro", "maestra", "mesero", "mesera", "vendedor", "vendedora",
  "conductor", "conductora", "taxista", "comerciante", "contador",
  "contadora", "policia", "militar", "soldado", "cocinero", "cocinera",
  "chef", "barbero", "barbera", "estilista", "secretaria", "secretario",
  "asistente", "independiente", "empleado", "empleada", "obrero", "obrera",
  "agricultor", "agricultora", "desempleado", "desempleada", "freelancer",
  "trabajador", "trabajadora", "tecnico", "tecnica", "operario", "operaria",
]);

// CAMBIO-01: señal determinística de que la persona NO tiene NADA, ni para el
// club ($34). Es el off-ramp (video gratis). NARROW a propósito: NO debe pisar
// la objeción #2 "no tengo el dinero [ahora]" (empuje al club) ni el sub-flujo
// de "no tengo tarjeta" (Nequi/familiar). Por eso exige "nada de dinero",
// "ni los 34" o "ni para el club", no un simple "no tengo el dinero".
const SIN_NADA_RE =
  /\bni (para )?(los |el |unos )?(34|35|treinta y cuatro|club)\b|no tengo nada de (dinero|plata)|no tengo nada,?\s*(ni|para)|no tengo ni para (el club|los 34|empezar|eso)|no me alcanza ni (para|los)|no tengo (ni un peso|nada ahorita ni|absolutamente nada)|estoy en (cero|ceros)/i;

// CAMBIO-10: "no tengo tarjeta" → en COLOMBIA el cierre es Nequi (determinístico,
// el LLM lo confundía con la objeción de efectivo o lo ruteaba a familiar).
const SIN_TARJETA_RE =
  /(no tengo|sin|no cuento con|no poseo|no manejo)\s*(ninguna\s*|una\s*)?tarjeta|no tengo (con qu[eé]|forma de|c[oó]mo) pagar/i;
// Confirmación de que ya tiene/sacó la Nequi (o pide el link) → cerrar con el club.
const NEQUI_LISTA_RE =
  /(ya (la )?(tengo|saqu[eé]|cre[eé]|abr[ií]|hice|active)|ya tengo (la )?nequi|lista la nequi|nequi lista|ya puedo pagar|mandame el? link|c[oó]mo pago|quiero pagar)/i;
function detectarNombre(texto) {
  const t = normalizar(texto);
  const m = t.match(/(?:me llamo|mi nombre es|soy)\s+([a-zñ]{3,})/);
  if (!m) return null;
  const candidato = m[1];
  if (NO_NOMBRES.has(candidato) || PAISES[candidato]) return null;
  return candidato.charAt(0).toUpperCase() + candidato.slice(1);
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
    sesion.nombre = null; // reinicia el nombre capturado
    sesion.capitalUSD = null; // reinicia el capital capturado
    // CAMBIO-03: el SALUDO ya pregunta el país; cuenta como 1ra pregunta para
    // que el primer país inválido posterior dispare la repregunta variada.
    sesion.vecesPidioPais = 1;
    return saludoResp();
  }

  // GATE DEL PAÍS (determinístico, no depende del LLM): de dónde es la persona
  // SIEMPRE va primero. Detectamos país y nombre en su mensaje y los guardamos;
  // si aún no tenemos el país, lo preguntamos y no avanzamos a la calificación.
  // Si TAMPOCO tenemos el nombre, pedimos los DOS en el mismo mensaje (nunca
  // asumimos quién es ni su género).
  const paisDetectado = detectarPais(mensajeUsuario);
  if (paisDetectado) sesion.pais = paisDetectado;
  // El PRIMER nombre capturado manda: "soy enfermera" más adelante no debe
  // pisar el nombre real que la persona ya dio.
  const nombreDetectado = detectarNombre(mensajeUsuario);
  if (nombreDetectado && !sesion.nombre) sesion.nombre = nombreDetectado;
  const capitalDetectado = detectarCapitalUSD(mensajeUsuario, sesion.pais);
  if (capitalDetectado != null) sesion.capitalUSD = capitalDetectado;
  if (!sesion.pais) {
    // Si ya preguntamos el país y la respuesta no se reconoció (p. ej. una
    // ciudad que no está en LUGARES), repreguntamos con otra frase en vez de
    // repetir el mismo mensaje como un robot.
    // CAMBIO-03: el reintento depende de un contador de sesión, no del último
    // mensaje del historial (el branch de saludo no escribe historial, así que
    // el 1er país inválido tras un saludo no se trataba como reintento).
    const yaPregunto = (sesion.vecesPidioPais || 0) >= 1;
    let pregunta;
    if (!sesion.nombre) {
      // Si aún falta el nombre, siempre pedimos los dos juntos (nunca saltamos
      // a la repregunta de solo-país y perdemos el nombre).
      pregunta = guion.PREGUNTA_NOMBRE_PAIS;
    } else if (yaPregunto) {
      pregunta = guion.PREGUNTA_PAIS_REINTENTO;
    } else {
      pregunta = guion.PREGUNTA_PAIS;
    }
    sesion.vecesPidioPais = (sesion.vecesPidioPais || 0) + 1;
    sesion.historial.push({ role: "user", content: mensajeUsuario });
    sesion.historial.push({ role: "assistant", content: pregunta });
    if (sesion.historial.length > 40) sesion.historial = sesion.historial.slice(-40);
    return pregunta;
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

  // 2.5) OFF-RAMP determinístico (CAMBIO-01): la persona deja claro que no tiene
  //      NADA, ni para el club ($34). Antes el LLM seguía empujando el club y
  //      caía en loop ("¿Ya pudiste entrar al club?"). Aquí cortamos con calidez
  //      y entregamos el video gratis (registra el lead como sin_dinero).
  if (SIN_NADA_RE.test(texto)) {
    sesion.historial.push({ role: "user", content: mensajeUsuario });
    if (sesion.cerrado === "video") {
      const corto = "¡Listo, bro! Cualquier cosa por aquí estoy.";
      sesion.historial.push({ role: "assistant", content: corto });
      return corto;
    }
    const r = acciones.enviarVideoGratis({ nombre: sesion.nombre, pais: sesion.pais });
    sesion.cerrado = "video";
    sesion.historial.push({ role: "assistant", content: r.mensaje });
    if (sesion.historial.length > 40) sesion.historial = sesion.historial.slice(-40);
    return r.mensaje;
  }

  // 2.6) PAGO SIN TARJETA EN COLOMBIA → Nequi (determinístico, CAMBIO-10).
  //      El pago por país es decisión crítica: no la deja al LLM (confundía
  //      "no tengo tarjeta" con la objeción de efectivo, o ruteaba a familiar).
  //      Solo aplica en rama club (capital < $600) y para Colombia.
  const enRamaClub = sesion.capitalUSD != null && ramaPorCapital(sesion.capitalUSD) === "club";
  const esColombia = /colombia/i.test(sesion.pais || "");
  if (esColombia && (enRamaClub || sesion.esperaNequi)) {
    // (a) Ya le mostramos Nequi y confirma que la tiene / pide el link → club.
    if (sesion.esperaNequi && NEQUI_LISTA_RE.test(texto) && sesion.nombre) {
      const r = acciones.enviarClub({ nombre: sesion.nombre, pais: sesion.pais });
      if (r.ok && r.mensaje) {
        sesion.esperaNequi = false;
        sesion.cerrado = "club";
        sesion.historial.push({ role: "user", content: mensajeUsuario });
        sesion.historial.push({ role: "assistant", content: r.mensaje });
        if (sesion.historial.length > 40) sesion.historial = sesion.historial.slice(-40);
        return r.mensaje;
      }
    }
    // (b) Dice que no tiene tarjeta → entrega Nequi (con el video de cómo sacarla).
    if (SIN_TARJETA_RE.test(texto)) {
      const r = acciones.pagarNequi({ nombre: sesion.nombre, pais: sesion.pais });
      sesion.esperaNequi = true;
      sesion.historial.push({ role: "user", content: mensajeUsuario });
      sesion.historial.push({ role: "assistant", content: r.mensaje });
      if (sesion.historial.length > 40) sesion.historial = sesion.historial.slice(-40);
      return r.mensaje;
    }
  }

  // 3) Todo lo demás lo lleva el LLM (Brayan), con E-Master como contexto.
  //    Le pasamos el país ya capturado para que NO lo vuelva a preguntar y para
  //    el cierre por país (Nequi vs familiar) y los args de las herramientas.
  // Solo pasamos `nombre` si lo detectamos de verdad: pasarlo en null/undefined
  // pisaría el nombre que el LLM manda en los argumentos de las herramientas.
  const metaLLM = { ...meta, pais: sesion.pais };
  if (sesion.nombre) metaLLM.nombre = sesion.nombre;
  if (sesion.capitalUSD != null) {
    metaLLM.capitalUSD = Math.round(sesion.capitalUSD);
    metaLLM.rama = ramaPorCapital(sesion.capitalUSD);
  }
  // CAMBIO-12: si ya entregamos un cierre, el LLM debe RESPONDER dudas
  // post-cierre (no re-pegar el link ni caer en el loop "¿ya agendaste?").
  if (sesion.cerrado) metaLLM.cerrado = sesion.cerrado;
  let respuestaLLM = await llm.responder(mensajeUsuario, sesion.historial, metaLLM);
  if (respuestaLLM) {
    // Anti-repetición del CIERRE: si el bot ya entregó un bloque de cierre
    // (Calendly / club / video) y lo vuelve a generar, NO repetimos el bloque
    // con el link; respondemos algo corto de confirmación. Así no spameamos el
    // mismo link cuando la persona dice "listo", "ya", etc.
    const tipoCierre =
      respuestaLLM === guion.CALENDLY_BLOQUE || respuestaLLM === guion.CALENDLY_BLOQUE_VIP ? "llamada" :
      respuestaLLM === guion.CLUB_BLOQUE ? "club" :
      respuestaLLM === guion.VIDEO_GRATIS ? "video" : null;

    if (tipoCierre && sesion.cerrado === tipoCierre) {
      // Ya se entregó este cierre: en vez de repetir el link, hacemos SEGUIMIENTO.
      respuestaLLM =
        tipoCierre === "llamada" ? "¿Ya pudiste agendar en el link, bro? Avísame apenas lo hagas y lo confirmamos." :
        tipoCierre === "club" ? "¿Ya pudiste entrar al club? Mándame la captura apenas estés adentro y te activo de una." :
        "¡Listo, bro! Cualquier cosa por aquí estoy.";
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
  store.limpiar();

  const id = req.body.From || "anon";
  const telefono = id.replace(/^whatsapp:/, "");
  const entrante = req.body.Body || "";
  const sesion = await store.cargar(id);

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
    await store.guardar(id, sesion); // persiste el saludado (puede caer en otro pod)
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
  await store.guardar(id, sesion);

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
  store.limpiar();
  try {
    const usuario = String(req.body.usuario || req.body.user_id || "anon");
    const mensaje = String(req.body.mensaje || req.body.text || "");
    const id = "ig:" + usuario;
    const sesion = await store.cargar(id);

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
    await store.guardar(id, sesion);

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
    res.json({ version: "v2", content: { messages: [{ type: "text", text: "Dame un segundo" }] } });
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

module.exports = { app, procesarMensaje, detectarCapitalUSD, ramaPorCapital };
