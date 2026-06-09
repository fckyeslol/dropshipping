// knowledge.js
// ───────────────────────────────────────────────────────────────
//  BASE DE CONOCIMIENTO de E-Master Project (RAG ligero)
// ───────────────────────────────────────────────────────────────
//  Toda la información de abajo viene del material oficial (landing,
//  Instagram, testimonios). El bot SOLO puede responder con base en
//  estos textos; NO inventa precios, garantías ni promesas de ingresos.
//
//  Cada elemento de CHUNKS es un "fragmento" de conocimiento. El
//  recuperador (buscarContexto) elige los más relevantes a la pregunta
//  del interesado y se los pasa al LLM como única fuente de verdad.
//
//  Para enseñarle algo nuevo al bot, agrega un chunk aquí.
//  Cuando proceses chats reales (parse_whatsapp.js), pega aquí las
//  respuestas y objeciones que mejor funcionan en la vida real.
// ───────────────────────────────────────────────────────────────

// Datos de contacto / marca. Ajusta lo que haga falta.
const DATOS = {
  marca: "E-Master Project",
  programa: "E-Master Academy VIP",
  fundador: "Brayan Hernández",
  instagram: "https://instagram.com/brayanher_",
  // ⚠️ Completa cuando los tengas (déjalos vacíos si no estás seguro:
  //    el bot ofrece agendar la llamada en vez de inventar el dato).
  web: "",
  email: "",
  empresa: "E-Master Project LLC",
};

const CHUNKS = [
  {
    tema: "quien es brayan hernandez fundador mentor",
    texto:
      "Brayan Hernández es un emprendedor colombiano, fundador de E-Master Project. Empezó vendiendo por internet y construyó un negocio de e-commerce a gran escala (dropshipping privado y marca propia). Hoy enseña a otros el mismo sistema a través de mentoría privada. Su cuenta es @brayanher_.",
  },
  {
    tema: "que es e-master academy vip programa curso mentoria",
    texto:
      "E-Master Academy VIP es el programa de formación avanzada en e-commerce de Brayan Hernández. Es el sistema paso a paso para construir un negocio rentable vendiendo productos por internet usando inteligencia artificial, desde un computador y desde cualquier parte del mundo. Combina dropshipping privado y marca propia.",
  },
  {
    tema: "que aprendes contenido tienda meta ads mercado persuasion",
    texto:
      "En el programa aprendes a construir un negocio sólido y rentable en dropshipping: creación de tu tienda online, investigación de mercado, publicidad avanzada en Meta Ads (Facebook/Instagram), persuasión efectiva en ventas y gestión emocional/mentalidad. El objetivo es que domines todo el proceso de principio a fin con apoyo de la IA.",
  },
  {
    tema: "que incluye clases en vivo mentoria comunidad herramientas",
    texto:
      "El programa incluye: clases en vivo con expertos, estrategias comprobadas, mentoría personalizada, acceso a una comunidad privada de emprendedores comprometidos, y herramientas prácticas para generar ingresos reales y estables desde cualquier parte del mundo.",
  },
  {
    tema: "para quien es desde cero sin experiencia requisitos",
    texto:
      "El programa está pensado para personas que quieren un cambio real en su vida y están dispuestas a comprometerse, aunque empiecen desde cero. Varios estudiantes no sabían nada de este negocio cuando empezaron. Lo importante es la disciplina, el enfoque y seguir el sistema con la mentoría. Se necesita un computador y conexión a internet.",
  },
  {
    tema: "dropshipping privado marca propia que es como funciona",
    texto:
      "El modelo que enseña Brayan es dropshipping privado y marca propia: no es el dropshipping genérico saturado, sino una operación más sólida con proveedores y marca propia, apoyada en publicidad en Meta Ads e inteligencia artificial. Se puede operar desde cualquier país del mundo.",
  },
  {
    tema: "resultados testimonios estudiantes casos de exito",
    texto:
      "Estudiantes con resultados construidos con el Proyecto E-Master: Andrés Galíndez pasó de trabajar en un parqueadero a +10.000 USD en su primer mes. Cristian Lozano (Popayán), +10.000 USD tras dejar su empleo. David Montoya pasó de un call center a +10.000 USD su primer mes. Kevin y Carlos (Barranquilla), +20.000 USD en un mes. Luis David, +50.000 USD en sus primeros dos meses (lo hizo desde la universidad). Lucas Valderruten, sin saber nada del negocio, +10.000 USD su primer mes. Samuel Cabrera (Cali), desde cero, +10.000 USD su primer mes. Liz y German, en pareja, +10.000 USD en un mes. Hay entrevistas completas en YouTube.",
  },
  {
    tema: "es real confiable estafa pruebas",
    texto:
      "E-Master es un programa real con resultados verificables: hay entrevistas completas de estudiantes en YouTube y una comunidad activa de emprendedores. Brayan muestra su propio recorrido y el de sus alumnos. La mejor forma de resolver dudas es agendar la llamada estratégica con el equipo, sin compromiso.",
  },
  {
    tema: "inversion precio costo cuanto vale planes facilidades",
    texto:
      "La inversión en el programa, los planes disponibles y las facilidades de pago las explica el equipo en la llamada estratégica, según el caso de cada persona. Por eso primero se agenda una llamada: ahí se ve si la persona califica para un cupo y se le explica todo. (No se da el precio por chat.)",
  },
  {
    tema: "llamada estrategica como funciona agendar sin compromiso",
    texto:
      "La llamada estratégica es una sesión con el equipo de E-Master donde conocen el caso de la persona, le explican cómo funciona el programa y la inversión, y resuelven sus dudas. Es sin compromiso. Los cupos del programa son limitados, por eso se prioriza a quienes agendan y llegan a la llamada.",
  },
  {
    tema: "desde cualquier pais del mundo internacional",
    texto:
      "El negocio se puede construir desde cualquier parte del mundo: solo necesitas un computador y conexión a internet. La mentoría y la comunidad son online, y la operación de e-commerce puede apuntar a distintos mercados.",
  },
  {
    tema: "tiempo dedicacion compatible trabajo estudio",
    texto:
      "Se puede empezar dedicándole tiempo en paralelo a un trabajo o estudio. Por ejemplo, Luis David construyó su operación mientras estaba en la universidad. La clave es la constancia y seguir el sistema; el equipo orienta cuánto tiempo conviene dedicarle según el caso.",
  },
  {
    tema: "garantia resultados promesa ingresos",
    texto:
      "El programa entrega formación, mentoría, comunidad y herramientas. Los resultados dependen del compromiso, la ejecución y el contexto de cada persona; los casos de éxito son reales pero no son una promesa de que todos ganen lo mismo. Cualquier detalle sobre garantías o condiciones lo explica el equipo en la llamada.",
  },
  {
    tema: "contacto instagram redes",
    texto:
      `Puedes ver el contenido y los resultados de Brayan en Instagram: ${DATOS.instagram}. Para avanzar con el programa, lo mejor es agendar la llamada estratégica con el equipo.`,
  },
];

// Quita tildes y pasa a minúsculas para comparar.
function normalizar(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Palabras de relleno que NO deben usarse para recuperar (no aportan tema).
const STOPWORDS = new Set([
  "donde", "como", "cual", "cuales", "para", "por", "que", "los", "las",
  "una", "uno", "del", "con", "sin", "mas", "muy", "este", "esta", "esto",
  "tienen", "tiene", "hacen", "hace", "puedo", "puede", "quiero", "necesito",
  "estan", "esta", "soy", "son", "ustedes", "tengo", "hay", "algo", "sobre",
  "y", "o", "el", "la", "lo", "un", "me", "te", "se", "su", "de", "en", "a",
]);

// Recuperador por solapamiento de RAÍCES de palabra (RAG ligero).
// Devuelve los `k` chunks más relevantes a la consulta. Usar raíces
// (primeros caracteres) hace que "experiencia" calce con "experimentar", etc.
function buscarContexto(consulta, k = 4) {
  const palabras = normalizar(consulta)
    .split(/[^a-z0-9ñ]+/i)
    .filter((p) => p.length >= 4 && !STOPWORDS.has(p));

  if (palabras.length === 0) {
    // Sin palabras útiles: devolvemos lo esencial (qué es + llamada).
    return [CHUNKS[1], CHUNKS[9]];
  }

  const puntuados = CHUNKS.map((c) => {
    const base = normalizar(c.tema + " " + c.texto);
    let score = 0;
    for (const p of palabras) {
      const raiz = p.slice(0, 5); // raíz: primeros 5 caracteres
      if (base.includes(raiz)) score += 1;
    }
    return { c, score };
  });

  const relevantes = puntuados
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);

  // Si nada coincidió, devolvemos contexto general para no dejar al LLM a ciegas.
  if (relevantes.length === 0) return [CHUNKS[1], CHUNKS[9]];
  return relevantes;
}

module.exports = { DATOS, CHUNKS, buscarContexto };
