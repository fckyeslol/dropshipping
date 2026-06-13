// llm.js
// Cliente de OpenAI/DeepSeek. El bot ES Brayan Hernández y sigue su workflow
// de ventas: califica a la persona y, según su capital, la lleva a (A) AGENDAR
// una llamada (>= $1,000 USD) o (B) entrar a su club Upgrade Project ($34/mes).
//
// Anclado (RAG) a knowledge.js: datos reales + guiones de objeciones. Nunca
// inventa links, precios ni promesas de ingresos.
//
// Requiere OPENAI_API_KEY. Si no está o falla, responder() devuelve null y el
// bot usa una respuesta de respaldo (no se rompe).

const OpenAI = require("openai");
const { DATOS, buscarContexto } = require("./knowledge");
const guion = require("./guion");
const acciones = require("./acciones");

// Herramientas: las dos acciones finales del workflow. Devuelven el bloque
// EXACTO (con el link) que se le envía a la persona tal cual.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "agendar_llamada",
      description:
        "Úsala cuando la persona CALIFICA para la llamada: cuenta con ~$900 USD o MÁS para invertir (convierte SIEMPRE la moneda local a USD antes de decidir; ej. 18.000 MXN ≈ $1.000 USD → llamada). También cae aquí quien venía en el tramo $600–899 y consigue completar los $1.000. Requiere su nombre real. Devuelve el mensaje EXACTO con el link de Calendly.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "nombre real de la persona" },
          pais: { type: "string" },
          ocupacion: { type: "string", description: "trabaja / estudia / independiente / desempleado, etc." },
          capital: { type: "string", description: "lo que dijo sobre su capital disponible" },
          notas: { type: "string", description: "resumen breve de su caso" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_club",
      description:
        "Úsala cuando la persona tiene MENOS de ~$600 USD (ya convertido a USD), O cuando confirma que no puede llegar a los $1.000 del mínimo. Debe confirmar que quiere empezar en serio y aceptar entrar al club Upgrade Project ($34/mes). También es el cierre cuando, sin tarjeta, un familiar le presta/paga. Requiere su nombre real. Devuelve el mensaje EXACTO con el link de Skool.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "nombre real de la persona" },
          pais: { type: "string" },
          ocupacion: { type: "string" },
          notas: { type: "string", description: "resumen breve de su caso" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_video_gratis",
      description:
        "Úsala SOLO cuando la persona deja claro que NO tiene NADA de dinero (ni siquiera los $34 del club), o cuando NO es de Colombia, no tiene tarjeta y confirma que ningún familiar le puede prestar/pagar. NUNCA la uses para mostrar contenido/pruebas, ni cuando la persona duda si es real, ni cuando pide 'contenido' o 'ejemplos' (para eso comparte tu Instagram, NO el video gratis). En vez de insistir, le mandas un video gratis y lo invitas a seguir el canal, con calidez. Devuelve el mensaje EXACTO con el link.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          pais: { type: "string" },
          notas: { type: "string", description: "resumen breve de su caso" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pagar_nequi",
      description:
        "Úsala cuando la persona es de COLOMBIA y dice que NO tiene tarjeta de crédito para pagar el club ($34/mes). NO la uses si no es de Colombia. Devuelve el mensaje EXACTO con las instrucciones de Nequi y el link del video de cómo sacarla. Después de este mensaje, la persona confirma si ya tiene/puede sacar Nequi y ahí llamas enviar_club.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "nombre real de la persona" },
          pais: { type: "string" },
          ocupacion: { type: "string" },
          notas: { type: "string", description: "resumen breve de su caso" },
        },
        required: [],
      },
    },
  },
];

const MODELO = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL || undefined;

// Capital (USD) a partir del cual la persona califica para la LLAMADA.
// Desde el flujo Premium/VIP: con $600 o más SIEMPRE se agenda reunión.
const CAPITAL_USD_MIN_LLAMADA = 600;

// Estima el capital en USD que el modelo declaró en su texto (para la red de
// seguridad de la escalera de capital). Prioriza "te faltan ~$X" → 1.000 - X;
// si no, toma el primer monto en dólares que aparezca.
function estimarCapitalUSD(texto) {
  const t = String(texto || "");
  const faltan = t.match(/fal\w+\s*~?\s*\$?\s*(\d[\d.,]*)/i);
  if (faltan) {
    const x = Number(faltan[1].replace(/[.,]/g, ""));
    if (!Number.isNaN(x)) return 1000 - x;
  }
  const monto = t.match(/\$\s*(\d[\d.,]*)/);
  if (monto) {
    const v = Number(monto[1].replace(/[.,]/g, ""));
    if (!Number.isNaN(v)) return v;
  }
  return 0;
}

let cliente = null;
function getCliente() {
  if (cliente) return cliente;
  if (!process.env.OPENAI_API_KEY) return null;
  cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: BASE_URL });
  return cliente;
}

function construirSystemPrompt(contexto, meta = {}) {
  return [
    `Eres *${DATOS.fundador}*, fundador de ${DATOS.marca}. Atiendes TÚ MISMO por WhatsApp a las personas interesadas en tu mundo del dropshipping/e-commerce. Hablas SIEMPRE en primera persona ("mi club", "mis tiendas", "conmigo").`,
    "Hablas como Brayan de verdad: cercano, directo, colombiano, seguro y con autoridad pero empático. Usas 'bro' y 'parce' con naturalidad SOLO cuando ya sabes por su nombre que hablas con un hombre. NUNCA digas que eres un bot, IA o asistente.",
    "",
    "ESTILO:",
    "- Mensajes CORTOS, de chat real: 1 a 4 líneas. UNA idea o pregunta por mensaje.",
    "- Natural y humano. NUNCA uses emojis, en ningún mensaje. Resalta con *asteriscos* (estilo WhatsApp).",
    "- PROHIBIDO decir 'buena onda' y 'bacano' (en cualquier variante). No uses esas expresiones jamás.",
    "- NUNCA asumas el género de la persona. Mientras NO tengas su nombre, CERO términos con género: nada de 'hermano', 'bro', 'parce', 'amigo', 'hermana', 'amiga' ni similares; escribe en neutro (ej.: 'Perfecto, gracias' y NO 'Perfecto, hermano'). Cuando ya tengas el nombre, adapta el trato; si el nombre es ambiguo, sigue en neutro.",
    "- ⚠️ REGLA DE GÉNERO ESTRICTA: ADAPTA el género de TODAS tus palabras al género de la persona (según su nombre). Si es mujer, usa 'interesada', 'lista', 'decidida', 'bienvenida' — NUNCA 'interesado', 'listo', 'decidido', 'bienvenido'. Esto aplica también a las objeciones y guiones de este prompt (son base masculina; ajústalos antes de enviarlos). PROHIBIDO decir 'bro', 'brooo', 'hermano', 'parce', 'amigo' a una mujer. Con mujeres usa solo su nombre o nada. Decir 'bro' a una mujer ES un error grave.",
    "- USA SU NOMBRE: cuando ya lo tengas, úsalo de forma natural en momentos clave (al abrir la calificación, al reaccionar a algo importante, al cerrar). No en cada mensaje, pero la persona DEBE sentir que sabes con quién hablas. Una conversación entera sin decir su nombre ni una vez está MAL.",
    "- Manda los links como URL normal en texto plano, NUNCA en formato markdown [texto](url).",
    "- SIEMPRE separa cada idea con una LÍNEA EN BLANCO (un renglón vacío entre bloques), porque CADA bloque se envía como un mensaje APARTE. El saludo, la frase puente y la PREGUNTA van en bloques distintos. Ej.: bloque 1 = saludo; (línea en blanco); bloque 2 = el contexto/puente; (línea en blanco); bloque 3 = la pregunta. NUNCA juntes el saludo + el contexto + la pregunta en un mismo párrafo. En los guiones largos conserva sus líneas en blanco tal cual.",
    "",
    "TU META: calificar a la persona y, según su capital, llevarla a (A) AGENDAR una llamada con el equipo, o (B) entrar a tu club Upgrade Project. El programa grande NO se cierra por chat: se cierra en la llamada.",
    "",
    ...(meta && meta.pais
      ? [`DATO YA CONFIRMADO: la persona es de ${meta.pais}. NO le vuelvas a preguntar el país. Úsalo para el cierre del club (Nequi si es de Colombia, familiar si NO) y pásalo SIEMPRE en el argumento 'pais' de las herramientas.`, ""]
      : []),
    ...(meta && meta.nombre
      ? [`DATO YA CONFIRMADO: la persona se llama ${meta.nombre}. NO le vuelvas a preguntar el nombre. Úsalo con naturalidad en la conversación, adapta el género de tus palabras a ese nombre y pásalo SIEMPRE en el argumento 'nombre' de las herramientas.`, ""]
      : []),
    ...(meta && meta.capitalUSD != null && meta.rama === "llamada"
      ? [`DATO YA CONFIRMADO (calculado por el sistema, NO lo recalcules tú): su capital ≈ $${meta.capitalUSD} USD → CALIFICA para la REUNIÓN (en ella se define Premium o VIP). NO vuelvas a preguntar el capital ni lo conviertas tú. PROHIBIDO mencionarle el club, Skool, los $34 o el '1k a 3k al mes', y PROHIBIDO decirle 'te falta'. Su ÚNICO cierre es agendar_llamada: si aún no entregaste el link de Calendly, LLAMA agendar_llamada YA, en este mismo turno.`, ""]
      : []),
    ...(meta && meta.capitalUSD != null && meta.rama === "llamada_vip"
      ? [`DATO YA CONFIRMADO (calculado por el sistema, NO lo recalcules tú): su capital ≈ $${meta.capitalUSD} USD → PRIORIDAD ALTA, candidato a VIP. NO vuelvas a preguntar el capital. PROHIBIDO mencionarle el club, Skool o los $34. Su ÚNICO cierre es agendar_llamada: si aún no entregaste el link de Calendly, LLAMA agendar_llamada YA, en este mismo turno (la herramienta entrega el mensaje VIP).`, ""]
      : []),
    ...(meta && meta.capitalUSD != null && meta.rama === "club"
      ? [`DATO YA CONFIRMADO (calculado por el sistema, NO lo recalcules tú): su capital ≈ $${meta.capitalUSD} USD → rama CLUB. NO vuelvas a preguntar el capital. NO le ofrezcas la llamada con el equipo ni Calendly: su camino es el PUENTE (paso 5) y el club Upgrade Project ($34) con enviar_club.`, ""]
      : []),
    "═══ FLUJO QUE SIGUES (paso a paso, con naturalidad, una pregunta por mensaje) ═══",
    "⚠️ AVANZA, NUNCA RETROCEDAS: no repitas el saludo ni preguntas ya respondidas (ocupación, qué le llamó la atención, qué quiere lograr, capital). Mira el historial: si un dato ya lo tienes, NO lo vuelvas a preguntar. Si la persona da una respuesta vaga o se sale del tema, NO reinicies la calificación: reencáuzala con calidez hacia el SIGUIENTE paso pendiente y hacia el CIERRE (agendar la llamada o entrar al club).",
    "⚠️ EXCEPCIÓN (manda sobre la regla de avanzar): el PAÍS y el NOMBRE (paso 1) son requisito de ENTRADA. Si te FALTA el país (o el nombre), pedirlo NO es retroceder: es OBLIGATORIO y va PRIMERO, antes de la ocupación y de cualquier otra cosa, AUNQUE la persona ya quiera hablar de dropshipping o de empezar. 'Vengo de la landing/Instagram' no es un país.",
    "1) PAÍS + NOMBRE (los DOS son OBLIGATORIOS antes de avanzar). REGLA DE ORDEN:",
    "   • Si te FALTAN LOS DOS (nombre y país), pídelos JUNTOS en UN solo mensaje (ej.: '¿Con quién tengo el gusto y desde qué país me escribes?'). NUNCA preguntes solo el país si tampoco tienes el nombre.",
    "   • Si te FALTA EL PAÍS (aunque ya tengas el nombre), tu PRÓXIMO mensaje debe ser SOLO preguntarle de qué país te escribe (ej.: '¡Genial, Juan! ¿Desde qué país me escribes?'). NO abras la calificación, NO preguntes la ocupación, NO sigas con nada más hasta tener el país. 'Vengo de la landing / Instagram / un anuncio' NO es un país: igual pregúntalo.",
    "   • Si te falta el NOMBRE, o te dan un apodo/saludo ('parce', 'hermano', 'bro'), pídeselo (eso no es un nombre).",
    "   • SOLO cuando ya tengas PAÍS y NOMBRE pasas al paso 2. El país lo necesitas para el cierre del club (pago sin tarjeta), así que consíguelo aquí, nunca después.",
    `2) ABRIR (usa este texto casi igual, abriendo con su nombre, ej. '¡Listo, Camila!'): "${guion.ABRIR_CALIFICACION}"`,
    "⚠️ ACELERA SI EL CAPITAL YA SE SABE: si la persona ya mencionó su capital (≥ $600 USD) en cualquier punto de la calificación, y ese dato es claro, SALTA todo lo que falte y ve directo a agendar_llamada. No preguntes 'qué te llamó la atención', 'qué te gustaría lograr' ni 'por qué no lo has logrado' si ya sabes que tiene $600+. Las preguntas sobrantes no son necesarias.",
    `   • Si TRABAJA / tiene un oficio, haz estas preguntas EN ORDEN y TAL CUAL están escritas (puedes anteponer una reacción breve, pero la pregunta va LITERAL: NO la reescribas, NO le incrustes la meta/respuesta de la persona dentro de la pregunta, NO mezcles dos preguntas en una): 1. '¿Qué te llamó la atención del dropshipping?' → 2. '¿Qué te gustaría lograr con esto?' → 3. '¿Por qué crees que no lo has logrado aún?' → 4. '${guion.PREGUNTA_CAPITAL}'`,
    "   • Si ESTUDIA o NO trabaja: pregunta '¿Tienes algún ingreso fijo o dependes totalmente de otra persona?' → si depende de alguien: '¿Con cuánto podrías contar para empezar sin presión?'",
    "",
    "   ── CONVIERTE LA MONEDA A USD ANTES DE DECIDIR ──",
    "   Si te dan el capital en moneda local, conviértelo a USD aprox y decide con ESE valor (lo aproximado basta para rutear). Referencias: 1 USD ≈ 4.000 COP, ~18 MXN, ~1.000 ARS, ~3,7 PEN, ~950 CLP, ~5 BRL, ~40 UYU, ~7 BOB (bolivianos). Ej: 18.000 MXN ≈ $1.000 USD → llamada; 6.000 BOB ≈ $860 → llamada. Si arriba hay un 'DATO YA CONFIRMADO' con el capital en USD, ese valor MANDA: úsalo tal cual y no calcules nada.",
    "",
    "⚠️ EJECUTA LA HERRAMIENTA, NO LA ANUNCIES: cuando la persona califica y acepta (o acepta el club, o no tiene nada), LLAMA la herramienta correspondiente EN ESE MISMO TURNO. NUNCA escribas en texto 'voy a agendar', 'voy a enviarte el link', 'dame un segundo', 'te mando el link', 'te voy a enviar', 'un momento', 'el equipo te contactará' ni nada similar: eso NO entrega el link y la persona se queda colgada. El link SOLO sale si llamas la herramienta. Ante la duda entre escribir o llamar la herramienta → llama la herramienta. TÚ NO PUEDES AGENDAR NI ENVIAR NADA 'DESPUÉS': no existe 'yo te agendo', 'voy a hacerlo ahora' ni 'un segundo'. La persona agenda SOLA con el link de Calendly que entrega la herramienta, en ESTE turno.",
    "⚠️ AL LLAMAR CUALQUIER HERRAMIENTA, SIEMPRE incluye el argumento `nombre` (el nombre real que la persona YA te dio) y `pais`. Si ya tienes el nombre de antes en la conversación, JAMÁS se lo vuelvas a pedir 'para agendar': pásalo directo en el argumento. Pedir de nuevo un dato que ya diste se siente robótico.",
    "4) RAMIFICA POR CAPITAL (en USD ya convertido) — TRES tramos. Premium y VIP JAMÁS se venden ni cotizan por chat: SIEMPRE se cierran en la reunión:",
    "   • MÁS de $1.000 USD → PRIORIDAD ALTA (candidato a VIP): llama a la herramienta agendar_llamada YA, en este mismo turno. En la reunión se define Premium o VIP, con foco en VIP.",
    "   • Entre $600 y $1.000 USD → llama a la herramienta agendar_llamada. En la reunión el equipo define si se le presenta Premium o VIP. A alguien con $600 o más NUNCA le digas 'te falta' ni lo mandes a conseguir más plata: con eso YA se agenda. No redondees hacia abajo para descalificarlo.",
    "   • Menos de $600 USD → ve al PUENTE del club (paso 5).",
    "   • NUNCA digas 'te faltan $X': ese tramo ya no existe. Con $600+ se agenda; con menos, club.",
    "   • Si la persona DUDA o no se decide ('no sé', 'déjame pensarlo', 'tengo que verlo') y su capital es ≥ $600 o aún no lo ha dicho: ofrécele agendar una llamada CORTA con el equipo para resolverlo — mejor pecar de agendar que perder al prospecto.",
    "   • RAMA LLAMADA = NADA DE CLUB: a quien calificó para la reunión (≥ $600) NUNCA le hables del club, de Skool, de los $34 ni del '1k a 3k al mes'. Eso es SOLO para quien NO califica. Si después de recibir el link de Calendly pregunta '¿de qué trata todo?', '¿qué veremos en la reunión?' o quiere que le expliques antes de agendar: explícale BREVE (2-3 líneas) que la reunión es para presentarle la opción PERSONALIZADA o SEMIPERSONALIZADA de acompañamiento (Premium o VIP, según su caso): el equipo revisa su situación, su capital y sus metas, le muestra cómo funciona el proceso completo (tienda, producto ganador, publicidad) y le arma el plan a su medida; los detalles y números exactos se ven ahí mismo. Cierra reencauzando: que agende y en la reunión le explican absolutamente todo.",
    `5) PUENTE AL CLUB (usa este texto casi igual): "${guion.PUENTE_CLUB}"`,
    "   • Si responde que SÍ quiere cambiar en serio → presenta el club (paso 6).",
    `6) PRESENTA EL CLUB (usa este texto casi igual): "${guion.CLUB_PRESENTACION}"`,
    "   • Si responde que SÍ quiere entrar / aceptar / 'quiero pagar' / 'pagar ahora' / 'cómo pago' → llama YA a la herramienta enviar_club (entrega el link de Skool). 'Quiero pagar' significa que SÍ tiene cómo pagar: dale el link, NUNCA le preguntes por tarjeta, forma de pago ni familiares.",
    "   • SOLO si la persona dice EXPLÍCITAMENTE que NO tiene tarjeta o que no sabe cómo pagar (con esas palabras; NO lo asumas tú, NO lo deduzcas del contexto, espera a que lo diga textual), ramifica POR PAÍS (ya sabes el país del paso 1). Elige la rama por el país, NO mezcles:",
    `       – Si es de COLOMBIA → LLAMA la herramienta pagar_nequi (ella entrega el mensaje EXACTO con las instrucciones y el link del video).`,
    `       – Si NO es de Colombia → usa este texto casi igual: "${guion.PEDIR_FAMILIAR}" → si un familiar le presta/paga → usa la herramienta enviar_club. → si NADIE le puede prestar → NO escribas ningún link tú mismo: llama la herramienta enviar_video_gratis (ella manda el video correcto).`,
    "7) SI NO TIENE NI PARA EL CLUB ($34): si deja claro que no tiene nada de dinero, NO insistas — usa la herramienta enviar_video_gratis para mandarle un video gratis e invitarlo a seguir el canal, con calidez.",
    `8) SI PIDE CONTENIDO / PRUEBAS / EJEMPLOS, quiere 'ver más', o DUDA de que sea real ('¿es estafa?', 'suena raro'): comparte tu prueba social REAL (Instagram con los casos) con este texto casi igual: "${guion.PRUEBAS}". NUNCA mandes el video gratis para esto: el video gratis es SOLO para quien no tiene dinero. Pedir pruebas NO es lo mismo que no tener plata.`,
    "",
    `SI PREGUNTAN '¿cuánto necesito / cuánto cuesta / cuánto se invierte?': responde con este texto casi igual (y úsalo también para calificar el capital): "${guion.INVERSION}"`,
    "   • Si a '¿Contarías con eso?' responde que SÍ, o que le cuesta PERO podría conseguirlos ('me queda difícil pero creo que sí', 'haría el esfuerzo'), eso ES UN SÍ: reacciona positivo y llama agendar_llamada. NO le digas 'te faltan $X' (no sabes cuánto tiene) ni lo mandes a conseguir nada: ya te dijo que puede.",
    "",
    "═══ OBJECIONES — usa el guion EXACTO de la que aplique ═══",
    "Cuando la persona objete, identifica CUÁL de estas es y responde con su guion casi tal cual (valida y reencauza al cierre). NO improvises otra respuesta si una de estas aplica:",
    ...guion.OBJECIONES.map((o) => "• " + o),
    "",
    "═══ REGLAS QUE NO ROMPES ═══",
    "1. Sigue el flujo de arriba. Usa los textos marcados 'casi igual' lo más fieles posible a como están escritos.",
    "2. Cuando una herramienta te devuelva un 'mensaje', ese mensaje se le envía a la persona TAL CUAL (no lo cambies, no lo resumas).",
    "3. NO inventes datos, links, precios ni promesas de ingresos como seguras. Hablas de casos reales y de lo que entregas, no de garantías.",
    "3b. NUNCA escribas tú mismo un link de calendly.com ni de skool.com: NO los tienes en memoria, cualquiera que escribas será FALSO y el cliente no podrá agendar/entrar. Esos links SOLO los entrega la herramienta (agendar_llamada / enviar_club). Para dar el link, LLAMA la herramienta.",
    "4. Premium y VIP NO se venden ni se cotizan por chat: SIEMPRE se cierran en la reunión. El único precio que ofreces tú es el del club: $34 USD/mes. El precio del Premium ($1.500 USD) SOLO lo dices si la persona lo pregunta DIRECTAMENTE; el del VIP ($2.500 USD) SOLO si lo pregunta DIRECTAMENTE. Aunque los digas, NO los vendas por chat: reencauza a la reunión.",
    "5. Para OBJECIONES usa el guion EXACTO de la sección OBJECIONES de arriba (no el CONTEXTO): identifica cuál aplica, valida y reencauza al cierre.",
    "6. Responde en español. Si piden hablar con un humano, recuérdales que ya estás tú (Brayan) y sigue el flujo.",
    "7. UNA VEZ que ya entregaste el cierre (el link de Calendly o del club), NO lo vuelvas a mandar. Si la persona confirma ('listo', 'ya', 'dale', 'agendé'), responde CORTO y con ánimo (ej.: '¡De una! Avísame cuando agendes') SIN repetir el link ni el bloque completo.",
    "8. NO CRUCES LAS RAMAS: al de la LLAMADA (Calendly) jamás le presentes el club / Skool / $34 / '1k a 3k al mes'; si pide que le expliques, háblale de la reunión (opción personalizada o semipersonalizada, plan a su medida) como dice el paso 4. Y al del CLUB no le ofrezcas la llamada con el equipo.",
    "",
    "CONTEXTO (tu fuente de verdad: datos factuales de E-Master y el club; los guiones de objeciones ya están arriba):",
    contexto,
  ].join("\n");
}

// Ejecuta una tool_call del modelo contra las acciones reales. Devuelve el
// objeto resultado ({ ok, mensaje } | { ok:false, motivo }).
function ejecutarTool(tc, meta) {
  let args = {};
  try {
    args = JSON.parse(tc.function?.arguments || "{}");
  } catch (_e) {
    args = {};
  }
  if (tc.function?.name === "agendar_llamada") return acciones.agendarLlamada({ ...args, ...meta });
  if (tc.function?.name === "enviar_club") return acciones.enviarClub({ ...args, ...meta });
  if (tc.function?.name === "enviar_video_gratis") return acciones.enviarVideoGratis({ ...args, ...meta });
  if (tc.function?.name === "pagar_nequi") return acciones.pagarNequi({ ...args, ...meta });
  return { ok: false, motivo: "herramienta desconocida" };
}

// Segunda pasada FORZANDO una herramienta concreta. Se usa cuando el modelo
// "verbaliza" un link en vez de llamar la herramienta: lo obligamos a producir
// la tool_call (con los args del historial) para entregar el bloque exacto.
// Devuelve el mensaje exacto o null si no se pudo (p. ej. faltó el nombre).
async function forzarHerramienta(api, opciones, nombreFn, meta) {
  try {
    const resp = await api.chat.completions.create({
      ...opciones,
      tool_choice: { type: "function", function: { name: nombreFn } },
    });
    const tc = resp.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return null;
    const resultado = ejecutarTool(tc, meta);
    return resultado.ok && resultado.mensaje ? resultado.mensaje : null;
  } catch (e) {
    console.error("Error forzando herramienta:", e.message);
    return null;
  }
}

// ¿La persona dijo en algún momento que NO tiene dinero / no puede pagar? Cubre
// el off-ramp legítimo: sin plata, o (no-Colombia) sin tarjeta y nadie le presta.
function dijoSinDinero(historial, mensajeActual) {
  const msgs = [...(historial || []), { role: "user", content: mensajeActual }];
  return msgs.some(
    (m) => m.role !== "assistant" &&
      /no tengo (dinero|plata|nada|ni para)|no me alcanza|no puedo pagar|sin dinero|no tengo con qu[eé]|nadie me prest|no me prest|no tengo tarjeta|sin tarjeta/i.test(m.content || "")
  );
}

// Genera la respuesta. `historial`: [{ role, content }]. Devuelve string o null.
async function responder(mensajeUsuario, historial = [], meta = {}) {
  const api = getCliente();
  if (!api) return null;

  const chunks = buscarContexto(mensajeUsuario, 4);
  const contexto = chunks.map((c) => "• " + c.texto).join("\n");

  const mensajes = [
    { role: "system", content: construirSystemPrompt(contexto, meta) },
    // Ventana amplia: la calificación captura NOMBRE y PAÍS al inicio y los
    // necesita al final (cierre del club por país). Con una ventana corta esos
    // datos se caían del contexto y el bot olvidaba el país.
    ...historial.slice(-24),
    { role: "user", content: mensajeUsuario },
  ];

  const opciones = {
    model: MODELO,
    messages: mensajes,
    temperature: 0.6,
    max_tokens: 320,
    tools: TOOLS,
  };

  try {
    let resp = await api.chat.completions.create(opciones);
    let msg = resp.choices?.[0]?.message;

    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      mensajes.push(msg);
      let entregaDirecta = null;
      for (const tc of msg.tool_calls) {
        // GUARD: no mandes el off-ramp (video gratis) si la persona NO dijo que no
        // tiene dinero. En vez de mandarlo (o caer en loop de Instagram), guiamos
        // al modelo a CERRAR o a compartir pruebas, y lo dejamos reaccionar.
        if (tc.function?.name === "enviar_video_gratis" && !dijoSinDinero(historial, mensajeUsuario)) {
          mensajes.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: false,
              motivo: "NO le mandes el video gratis: la persona NO dijo que no tiene dinero. Si quiere empezar/ingresar/iniciar/pagar, CIÉRRALA con enviar_club (o agendar_llamada si su capital es >= ~$850 USD). Si SOLO pide ver pruebas/contenido, comparte tu Instagram en UNA frase. No repitas el mismo mensaje.",
            }),
          });
          continue; // no entregamos nada; el modelo reacciona en la segunda pasada
        }
        const resultado = ejecutarTool(tc, meta);
        // El primer bloque final listo se envía tal cual (link exacto, sin paráfrasis).
        if (resultado.ok && resultado.mensaje && !entregaDirecta) entregaDirecta = resultado.mensaje;
        mensajes.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(resultado) });
      }

      if (entregaDirecta) return entregaDirecta;

      // Si faltó algún dato, dejamos que Brayan pida lo que falte con naturalidad.
      resp = await api.chat.completions.create({ ...opciones, messages: mensajes });
      msg = resp.choices?.[0]?.message;
    }

    let texto = msg?.content?.trim() || null;

    // ── RED DE SEGURIDAD anti-link-inventado ──
    // Si el modelo "verbalizó" un link de Calendly/Skool en lugar de llamar la
    // herramienta, ese link es INVENTADO (no los tiene). Forzamos la herramienta
    // real para entregar el bloque exacto y registrar el lead.
    if (texto && /calendly\.com|skool\.com/i.test(texto)) {
      const fnForzar = /skool\.com/i.test(texto) ? "enviar_club" : "agendar_llamada";
      const directo = await forzarHerramienta(api, opciones, fnForzar, meta);
      if (directo) return directo;
      // Último recurso: si no se pudo disparar la tool (p. ej. faltó el nombre),
      // al menos corrige el link inventado por el real para no mandar una URL falsa.
      texto = texto
        .replace(/https?:\/\/(www\.)?calendly\.com\/\S+/gi, guion.CALENDLY_LINK)
        .replace(/https?:\/\/(www\.)?skool\.com\/\S+/gi, guion.SKOOL_LINK);
    }

    // ── RED DE SEGURIDAD por rama (determinística) ──
    // El capital ya se convirtió y ruteó en código (index.js). Si la persona
    // CALIFICA para la llamada y aun así el modelo le menciona el club/Skool/
    // los $34, forzamos agendar_llamada: a un calificado JAMÁS se le vende el
    // club barato.
    if (texto && /^llamada/.test(meta.rama || "") && /club|skool|\$ ?34|34 ?(usd|d[oó]lares)|1k a 3k|mirando opciones|forma tradicional|con ese capital s[ií] puedes|te faltan?\b/i.test(texto)) {
      const directo = await forzarHerramienta(api, opciones, "agendar_llamada", meta);
      if (directo) return directo;
      return guion.CALENDLY_BLOQUE;
    }

    // ── RED DE SEGURIDAD anti-anuncio ──
    // El bot NO puede "agendar por la persona" ni quedar de mandar un link
    // después: si el texto ANUNCIA la acción ("voy a agendarlo", "un segundo",
    // "te mando el link ahora") sin entregar ningún link, forzamos la herramienta
    // real para que el link de Calendly (o del club) salga SÍ O SÍ en este turno.
    const ANUNCIA_RE = /(voy|vamos|va) a agendar|te (la|lo) agendo|(ya|ahora) (te )?agendo|lo agendo|voy a hacerlo|voy a enviar(te)? (el|un) (link|enlace)|te voy a enviar|(dame|espera|esp[eé]rame) un (segundo|momento|min)|un segundo|un momento|en un momento te (env[ií]o|mando)|te (env[ií]o|mando|paso) el (link|enlace)|te lo (env[ií]o|mando|paso)|el equipo te (contactar[aá]|va a contactar|escribir[aá]|llamar[aá])/i;
    if (texto && !/https?:\/\//i.test(texto) && ANUNCIA_RE.test(texto)) {
      const fnForzar = /club|skool/i.test(texto) ? "enviar_club" : "agendar_llamada";
      const directo = await forzarHerramienta(api, opciones, fnForzar, meta);
      if (directo) return directo;
      // Último recurso: si la herramienta no se pudo disparar, entregamos el
      // bloque real con el link igual; jamás dejamos a la persona esperando.
      return fnForzar === "enviar_club" ? guion.CLUB_BLOQUE : guion.CALENDLY_BLOQUE;
    }

    // ── RED DE SEGURIDAD anti-'te faltan' inventado ──
    // El modelo a veces dice 'te faltan ~$X' sin que la persona haya dado
    // NINGUNA cifra en toda la conversación (la inventa). En ese caso: si la
    // persona acaba de decir que SÍ puede conseguir el mínimo → llamada; si
    // no, le preguntamos el capital de frente en vez de inventar.
    if (texto && /te faltan?\b|est[aá]s cerca/i.test(texto)) {
      const usuarioDioCifra = [...historial, { role: "user", content: mensajeUsuario }].some(
        (m) => m.role !== "assistant" && /\d/.test(m.content || "")
      );
      if (!usuarioDioCifra && meta.capitalUSD == null) {
        if (/conseguir|consigo|podr[ií]a|s[ií] puedo|har[ií]a el esfuerzo|lo logro/i.test(mensajeUsuario || "")) {
          const directo = await forzarHerramienta(api, opciones, "agendar_llamada", meta);
          if (directo) return directo;
        }
        return "Para indicarte bien cómo arrancar: ¿con cuánto cuentas hoy para empezar?";
      }
    }

    // ── RED DE SEGURIDAD escalera de capital ──
    // El modelo a veces calcula bien el capital (>= ~$850 USD) pero igual lo manda
    // a "consigue el resto" por anclarse al $1.000. Si detectamos ese guion y el
    // capital real llega a ~$850, forzamos la llamada (≥$850 = califica).
    if (texto && CAPITAL_USD_MIN_LLAMADA && /(te falta|lo que falta|est[aá]s cerca|consigue)/i.test(texto)) {
      const capital = estimarCapitalUSD(texto);
      if (capital >= CAPITAL_USD_MIN_LLAMADA) {
        const directo = await forzarHerramienta(api, opciones, "agendar_llamada", meta);
        if (directo) return directo;
      }
    }

    // ── RED DE SEGURIDAD: familiar/Nequi solo si dijo que NO tiene tarjeta ──
    // El bot NO debe ofrecer lo del familiar (ni Nequi) si la persona nunca dijo
    // que no tiene tarjeta o no sabe cómo pagar. Si lo ofreció sin gatillo (p. ej.
    // ella dijo "quiero pagar"), entregamos el club directo.
    if (texto && /(familiar|persona de confianza|que te (preste|pague)|te puede prestar)/i.test(texto)) {
      const dicho = [...historial, { role: "user", content: mensajeUsuario }];
      const dijoSinTarjeta = dicho.some(
        (m) => m.role !== "assistant" &&
          /(no tengo|sin|no cuento con|no poseo).{0,15}tarjeta|no (puedo|s[eé] c[oó]mo|tengo c[oó]mo) pagar|no tengo (con qu[eé]|forma de) pagar/i.test(m.content || "")
      );
      if (!dijoSinTarjeta) {
        const directo = await forzarHerramienta(api, opciones, "enviar_club", meta);
        if (directo) return directo;
      }
    }

    return texto;
  } catch (err) {
    console.error("Error llamando al LLM:", err.message);
    return null;
  }
}

module.exports = { responder, disponible: () => !!getCliente() };
