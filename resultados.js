// resultados.js
// Bloque de resultados / testimonios de estudiantes de E-Master.
//
// Cuando alguien pide "pruebas", "resultados" o "testimonios", el bot
// envía este resumen. Son casos REALES tomados del material oficial.
//
// 👉 Cuando tengas los links exactos de las entrevistas en YouTube,
//    ponlos en cada `video`. Mientras estén vacíos, el bot solo
//    menciona que hay entrevistas (no inventa URLs).

const CANAL_YOUTUBE = ""; // opcional: link del canal de Brayan
const { INSTAGRAM_URL } = require("./guion");

const CASOS = [
  { nombre: "Andrés Galíndez", logro: "+10K USD", detalle: "de empleado en un parqueadero a su primer mes", video: "" },
  { nombre: "Cristian Lozano", logro: "+10K USD", detalle: "dejó su empleo a los 30 y empezó de cero (Popayán)", video: "" },
  { nombre: "David Montoya", logro: "+10K USD", detalle: "de un call center a su primer mes con dropshipping", video: "" },
  { nombre: "Kevin & Carlos", logro: "+20K USD", detalle: "escalando en un solo mes (Barranquilla)", video: "" },
  { nombre: "Luis David", logro: "+50K USD", detalle: "en sus primeros dos meses, estudiando en la universidad", video: "" },
  { nombre: "Lucas Valderruten", logro: "+10K USD", detalle: "sin saber nada del negocio, su primer mes", video: "" },
  { nombre: "Samuel Cabrera", logro: "+10K USD", detalle: "desde Cali y desde cero, su primer mes", video: "" },
  { nombre: "Liz & German", logro: "+10K USD", detalle: "en pareja, en un mes", video: "" },
];

// Devuelve un string con el resumen de resultados para enviar por WhatsApp.
function testimonios() {
  const lista = CASOS.map((c) => {
    const link = c.video ? `\n  ${c.video}` : "";
    return `• *${c.nombre}* — ${c.logro}: ${c.detalle}${link}`;
  }).join("\n");

  let texto =
    "*Algunos resultados de estudiantes de E-Master:*\n\n" +
    lista +
    "\n\nSon casos reales (hay entrevistas completas en YouTube).";

  // CAMBIO-07: incluir SIEMPRE el Instagram con los casos. Es la prueba social
  // verificable que pide la objeción "¿esto es real / no será estafa?".
  if (INSTAGRAM_URL) texto += `\n\nMira los casos, entrevistas y el día a día aquí:\n${INSTAGRAM_URL}`;

  if (CANAL_YOUTUBE) texto += `\n${CANAL_YOUTUBE}`;

  texto +=
    "\n\nLo mejor es que veamos *tu* caso en una llamada con el equipo, sin compromiso. ¿Te gustaría que la agendemos?";

  return texto;
}

module.exports = { CASOS, testimonios };
