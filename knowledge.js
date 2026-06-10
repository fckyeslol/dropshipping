// knowledge.js
// ───────────────────────────────────────────────────────────────
//  BASE DE CONOCIMIENTO de E-Master / Brayan (RAG ligero)
// ───────────────────────────────────────────────────────────────
//  Datos REALES + guiones de objeciones. El bot SOLO responde con base
//  en estos textos; el recuperador (buscarContexto) elige los chunks
//  relevantes a cada mensaje y se los pasa al LLM como contexto.
//
//  Las OBJECIONES están aquí como chunks: cuando la persona objeta
//  ("está caro", "no tengo dinero"...), el recuperador trae el guion
//  correcto y Brayan lo usa casi tal cual.
// ───────────────────────────────────────────────────────────────

const DATOS = {
  marca: "E-Master Project",
  programa: "E-Master Academy VIP",
  club: "Upgrade Project",
  fundador: "Brayan Hernández",
  instagram: "https://instagram.com/brayanher_",
  empresa: "E-Master Project LLC",
};

const CHUNKS = [
  // ───────── Quién / qué ─────────
  {
    tema: "quien es brayan hernandez fundador mentor",
    texto:
      "Brayan Hernández es un emprendedor colombiano, fundador de E-Master Project. Empezó vendiendo por internet y construyó un negocio de e-commerce a gran escala (dropshipping privado y marca propia). Hoy enseña su sistema con mentoría privada. Instagram: @brayanher_.",
  },
  {
    tema: "que es e-master academy vip programa",
    texto:
      "E-Master Academy VIP es el programa de formación avanzada en e-commerce de Brayan: el sistema paso a paso para construir un negocio rentable vendiendo por internet (dropshipping privado y marca propia) usando inteligencia artificial, desde un computador y desde cualquier parte del mundo.",
  },
  {
    tema: "que aprendes tienda meta ads mercado persuasion mentalidad",
    texto:
      "En el programa aprendes a construir un negocio sólido: creación de tu tienda online, investigación de mercado, publicidad avanzada en Meta Ads, persuasión efectiva en ventas y gestión emocional/mentalidad, todo apoyado en IA.",
  },
  {
    tema: "que incluye clases en vivo mentoria comunidad",
    texto:
      "Incluye clases en vivo con expertos, estrategias comprobadas, mentoría personalizada, acceso a una comunidad privada de emprendedores y herramientas prácticas para generar ingresos desde cualquier parte del mundo.",
  },
  {
    tema: "resultados testimonios estudiantes casos de exito",
    texto:
      "Casos reales: Andrés Galíndez pasó de un parqueadero a +10.000 USD su primer mes. Cristian Lozano (Popayán), +10.000 USD. David Montoya, de un call center a +10.000 USD. Kevin y Carlos (Barranquilla), +20.000 USD en un mes. Luis David, +50.000 USD en dos meses estudiando en la universidad. Lucas Valderruten y Samuel Cabrera (Cali), +10.000 USD desde cero. Liz y German, en pareja, +10.000 USD. Hay entrevistas en YouTube.",
  },

  // ───────── Inversión / capital / llamada ─────────
  {
    tema: "inversion capital cuanto cuesta cuanto necesito empezar precio",
    texto:
      "Para empezar por cuenta propia se necesita invertir en la formación, en la publicidad (pauta) y en las plataformas. El mínimo para iniciar son $1,000 USD (unos 3 millones de pesos colombianos). El precio del programa grande no se da por chat: se explica en la llamada con el equipo. El club Upgrade Project sí tiene precio fijo: $34 USD al mes.",
  },
  {
    tema: "llamada reunion estrategica como funciona agendar calendly",
    texto:
      "Cuando la persona cuenta con el capital mínimo (~$1,000 USD) y quiere avanzar, se agenda una reunión con el equipo por Calendly. En esa llamada le explican todo el proceso, el programa y la inversión, y resuelven dudas. Se le pide avisar cuando agende para confirmar.",
  },

  // ───────── Club Upgrade Project ─────────
  {
    tema: "club upgrade project skool 34 dolares mensual que es low ticket",
    texto:
      "Upgrade Project es el club de Brayan en Skool, por $34 USD al mes, para quienes empiezan con poco capital. Da las herramientas para empezar desde cero y apuntar a generar de 1k a 3k USD al mes: anuncios en TikTok y Facebook, diseño de página, entrega de productos, productos ganadores, marca personal y ventas. Incluye posibilidad de llamada 1:1 con Brayan para los más activos. Es exclusivo y privado: comparte info de programas de 2 mil dólares por ese precio. Link: https://www.skool.com/upgrade-project-6844/about",
  },
  {
    tema: "tarjeta nequi colombia pago sin tarjeta como pagar",
    texto:
      "Si la persona es de Colombia y no tiene tarjeta para pagar el club, puede sacar la tarjeta de Nequi (es gratis y rápido) y con eso paga." +
      (process.env.NEQUI_VIDEO_URL
        ? ` Comparte este video de cómo sacarla y motívalo a ingresar: ${process.env.NEQUI_VIDEO_URL}`
        : " Se le puede enviar un video de cómo sacar la tarjeta Nequi y motivarlo a ingresar."),
  },
  {
    tema: "para quien desde cero sin experiencia compromiso requisitos",
    texto:
      "El programa y el club son para personas comprometidas que quieren un cambio real, aunque empiecen desde cero. Se necesita un computador, conexión a internet y disposición para ejecutar. La mayoría de los casos de éxito empezaron sin experiencia.",
  },
  {
    tema: "desde cualquier pais del mundo internacional tiempo dedicacion",
    texto:
      "El negocio se puede construir desde cualquier país, solo con computador e internet, y se puede empezar en paralelo a un trabajo o estudio (Luis David lo hizo en la universidad). La clave es constancia y seguir el sistema con la guía.",
  },

  // ───────── OBJECIONES (guion casi literal) ─────────
  {
    tema: "objecion caro costoso muy costoso precio alto",
    texto:
      "OBJECIÓN 'me parece muy costoso': Bro, el costo ya lo estás pagando… solo que sin resultados. La diferencia es que hoy puedes invertir para cambiar esa situación. ¿Qué prefieres seguir pagando: el precio de quedarte igual o la inversión que te va a sacar de ahí? Y 'caro' comparado con qué… ¿con algo que no te da resultados? Aquí recibes en proporción a lo que inviertes.",
  },
  {
    tema: "objecion no tengo dinero no tengo plata sin dinero",
    texto:
      "OBJECIÓN 'no tengo el dinero': El 90% de los que hoy están con nosotros tampoco lo tenían, y justo por eso empezaron: para conseguirlo. Si con la info de adentro puedes pasar a facturar 3 mil USD, ¿valdría la pena hacer el esfuerzo? Si ya estuvieras generando lo que quieres, ¿me dirías que no? Hagamos un abono y arrancamos hoy mismo; no dejes que el dinero te frene otra vez.",
  },
  {
    tema: "objecion lo voy a pensar lo tengo que pensar pensarlo",
    texto:
      "OBJECIÓN 'me lo tengo que pensar': Lo entiendo bro, pero entre tú y yo, cuando alguien dice eso hay algo real detrás. Dime qué te genera la duda y lo resolvemos. ¿Tienes dudas del programa? No, ¿cierto? Entonces lo único que estás pensando es el tema financiero; resolvámoslo.",
  },
  {
    tema: "objecion mas barato otras opciones comparar competencia",
    texto:
      "OBJECIÓN 'conozco algo más barato / quiero ver otras opciones': Te entiendo bro, pero buscar lo más barato casi siempre sale más caro… el precio más caro en los negocios es el tiempo. Si hoy puedes lograr resultados en 30 días, ¿valdría la pena invertir ya y dejar de perder tiempo? Arranquemos hoy mismo.",
  },
  {
    tema: "objecion en un rato hago el pago despues pago luego",
    texto:
      "OBJECIÓN 'en un rato hago el pago': Bro, hagámoslo de una vez; así confirmamos que todo funcione y te lleguen los accesos. Te soy sincero: hay algo que no me estás diciendo. ¿Eres de los que toman las oportunidades o de los que las aplazan?",
  },
  {
    tema: "objecion hablar con pareja esposa familia consultar",
    texto:
      "OBJECIÓN 'debo hablarlo con mi pareja/familiar': Lo entiendo full. El detalle es que esa persona no estuvo en esta conversación, no vio cómo puedo ayudarte y va a decidir con otra información. ¿Esto te parece una buena o una mala decisión? Hagamos el pago ahora y luego hablas con calma; seguimos tu proceso hoy mismo.",
  },
  {
    tema: "objecion tengo el dinero en efectivo cash",
    texto:
      "OBJECIÓN 'tengo el dinero en efectivo': Total, no hay lío bro. Solo que los cupos se asignan por orden de pago y el sistema me exige dejar un registro hoy. ¿Tienes algo en digital o alguien que te pueda hacer un giro ya mismo? Así aseguramos tu acceso y tú repones el dinero cuando lo retires.",
  },
  {
    tema: "objecion ahora no puedo mas adelante despues no es el momento",
    texto:
      "OBJECIÓN 'ahora no puedo / no es el momento': Bro, el problema no es empezar hoy, es cuánto te cuesta cada mes seguir igual. Retrasar tu inicio no te ahorra dinero, te cuesta oportunidades. ¿No es la primera vez que te pasa, cierto? Ese 'después' nunca llega. Si hoy no rompes ese patrón, ¿cuándo lo vas a romper?",
  },
  {
    tema: "objecion descuento rebaja promocion mas economico",
    texto:
      "OBJECIÓN '¿no tienes un descuento?': Nosotros no competimos por precio, bro, competimos por resultados. Lo que compras aquí no es un curso: es un resultado. Si te doy un descuento tendría que quitarte parte del acompañamiento y eso afectaría tus resultados, y no te voy a entregar algo que no te sirva.",
  },
  {
    tema: "es real estafa confiable seguro pruebas funciona de verdad",
    texto:
      "E-Master es real, con resultados verificables y entrevistas de estudiantes en YouTube, además de una comunidad activa. La mejor forma de despejar dudas es la llamada con el equipo (o entrar al club si el capital es bajo).",
  },
];

// Quita tildes y pasa a minúsculas para comparar.
function normalizar(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Palabras de relleno que NO aportan tema.
const STOPWORDS = new Set([
  "donde", "como", "cual", "cuales", "para", "por", "que", "los", "las",
  "una", "uno", "del", "con", "sin", "mas", "muy", "este", "esta", "esto",
  "tienen", "tiene", "hacen", "hace", "puedo", "puede", "quiero", "necesito",
  "estan", "esta", "soy", "son", "ustedes", "tengo", "hay", "algo", "sobre",
  "y", "o", "el", "la", "lo", "un", "me", "te", "se", "su", "de", "en", "a",
]);

// Recuperador por solapamiento de raíces de palabra (RAG ligero).
function buscarContexto(consulta, k = 4) {
  const palabras = normalizar(consulta)
    .split(/[^a-z0-9ñ]+/i)
    .filter((p) => p.length >= 4 && !STOPWORDS.has(p));

  if (palabras.length === 0) return [CHUNKS[1], CHUNKS[5]]; // qué es + inversión

  const puntuados = CHUNKS.map((c) => {
    const base = normalizar(c.tema + " " + c.texto);
    let score = 0;
    for (const p of palabras) {
      const raiz = p.slice(0, 5);
      if (base.includes(raiz)) score += 1;
    }
    return { c, score };
  });

  const relevantes = puntuados
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);

  if (relevantes.length === 0) return [CHUNKS[1], CHUNKS[5]];
  return relevantes;
}

module.exports = { DATOS, CHUNKS, buscarContexto };
