// oferta.js
// ───────────────────────────────────────────────────────────────
//  EL PROGRAMA y el GUION de calificación (lo que el bot vende/usa).
//
//  Esto alimenta el "system prompt" del bot (llm.js): qué ofrece
//  E-Master y qué quiere averiguar de la persona antes de invitarla
//  a la llamada. EDÍTAME a tu gusto.
// ───────────────────────────────────────────────────────────────

// ── Saludo de apertura (template, instantáneo o diferido) ──
// Abre la conversación Y empieza a calificar (pregunta abierta).
const SALUDO =
  "¡Hola! 👋 Te escribo del equipo de *Brayan Hernández* (E-Master).\n" +
  "¿Con quién tengo el gusto? Y cuéntame, ¿qué fue lo que te llamó la atención del programa?";

// ── El programa, en datos que el bot puede usar ──
const PROGRAMA = {
  nombre: "E-Master Academy VIP",
  promesa:
    "Sistema paso a paso para construir un negocio rentable de e-commerce (dropshipping privado y marca propia) usando IA, desde un computador y desde cualquier parte del mundo.",
  incluye: [
    "Clases en vivo con expertos",
    "Mentoría personalizada",
    "Comunidad privada de emprendedores",
    "Estrategias comprobadas (tienda, investigación de mercado, Meta Ads)",
    "Persuasión en ventas y mentalidad",
    "Herramientas prácticas e inteligencia artificial",
  ],
  paraQuien:
    "Personas comprometidas que quieren un cambio real, aunque empiecen desde cero. Se necesita un computador, conexión a internet y disposición para ejecutar.",
};

// ── Qué queremos averiguar antes de invitar a la llamada ──
// El bot NO las dispara como formulario: las teje en la conversación,
// una a una. Sirven para entender el caso y para calificar el lead.
const CALIFICACION = [
  "Su nombre y de qué país escribe.",
  "Su situación actual (¿trabaja, estudia, es independiente, está buscando empleo?).",
  "Si ya ha intentado vender por internet / dropshipping antes.",
  "Qué quiere lograr y para cuándo (su motivación real).",
  "Qué tan en serio está dispuesto a empezar (compromiso / tiempo).",
];

// Resumen corto del programa para inyectar en el system prompt.
function programaTexto() {
  return [
    `Programa: ${PROGRAMA.nombre}.`,
    `Promesa: ${PROGRAMA.promesa}`,
    `Incluye: ${PROGRAMA.incluye.join("; ")}.`,
    `Para quién: ${PROGRAMA.paraQuien}`,
  ].join("\n");
}

// Lista de calificación para el system prompt.
function calificacionTexto() {
  return CALIFICACION.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

module.exports = { SALUDO, PROGRAMA, CALIFICACION, programaTexto, calificacionTexto };
