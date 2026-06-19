#!/usr/bin/env bun
/**
 * SISTEMA MULTIAGENTE DE PRUEBAS
 * ===============================
 * Cada flujo de FLUJOS_CONVERSACION.md es un "agente-prospecto" que
 * conversa con el bot y valida que se comporte como debe.
 *
 * Uso:
 *   export DEEPSEEK_API_KEY=sk-...
 *   bun tests/multiagente-test.js [--grupo A] [--caso A1] [--url URL]
 *
 * Por defecto prueba todos los grupos contra:
 *   https://dropshipping-production-2fb2.up.railway.app
 */

const BOT_URL = process.env.BOT_URL || "https://dropshipping-production-2fb2.up.railway.app";
const API_KEY = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
// OpenClaw defaults to DeepSeek. If using OpenAI key, override via env:
// OpenAI: set to https://api.openai.com (no /v1, script appends it)
const API_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/v1\/?$/, "").replace(/\/+$/, "");
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_PASOS = 25; // máximo de intercambios por test

// ── Utilería LLM ────────────────────────────────────────────────
async function llamarLLM(system, messages, temp = 0.7) {
  const resp = await fetch(`${API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
      temperature: temp,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`LLM error ${resp.status}: ${txt}`);
  }
  const json = await resp.json();
  return json.choices[0].message.content;
}

// ── Comunicación con el bot ─────────────────────────────────────
async function hablarConBot(telefono, mensaje) {
  const resp = await fetch(`${BOT_URL}/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: `whatsapp:+${telefono}`, Body: mensaje }),
  });
  const xml = await resp.text();
  // Extraer texto: puede estar en <Body>...</Body> o directamente en <Message>...</Message>
  let bodies;
  const hasMedia = xml.includes("<Media>");
  if (hasMedia) {
    bodies = [...xml.matchAll(/<Body>(.*?)<\/Body>/gs)].map((m) => m[1].trim());
  } else {
    bodies = [...xml.matchAll(/<Message>(.*?)<\/Message>/gs)].map((m) => m[1].trim());
  }
  const mediA = [...xml.matchAll(/<Media>(.*?)<\/Media>/gs)].map((m) => m[1].trim());
  return { texto: bodies.join("\n\n"), media: mediA };
}

// ── Config de test cases ────────────────────────────────────────
// Cada test case define:
//   nombre, persona, guion (lo que el prospecto debe hacer/dar),
//   veredicto esperado, asserts.
// El prospecto actúa siguiendo el guion pero responde NATURALMENTE
// (no copia literal), mientras el bot debe comportarse como se espera.

const TEST_CASES = [
  // ── GRUPO A: Ramas de capital (camino feliz) ──
  {
    id: "A1", grupo: "A", nombre: "VIP > $1,000",
    persona: "Te llamas Carlos, eres colombiano, trabajas como administrador de empresas. Quieres empezar en dropshipping y tienes $1,500 USD para invertir. Eres serio, decidido, respondes con claridad.",
    guion: [
      "Saluda al bot. Di tu nombre completo y país.",
      "Di a qué te dedicas.",
      "Responde qué te llamó la atención del dropshipping (libertad financiera, ingresos pasivos).",
      "Di qué te gustaría lograr (mínimo $10k al mes, viajar, independencia).",
      "Explica por qué crees que no lo has logrado aún (falta de guía, información dispersa).",
      "Da tu capital: $1,500 USD.",
    ],
    veredicto: "Bot debe agendar llamada VIP > $1,000. Nunca mencionar club/Skool/$34.",
    asserts: [
      "bot_pregunta_ocupacion", "bot_no_menciona_club", "bot_entrega_calendly_vip",
    ],
  },
  {
    id: "A2", grupo: "A", nombre: "Llamada normal $600-$1,000",
    persona: "Te llamas María, eres mexicana, trabajas en recursos humanos. Tienes $700 USD. Hablas formal pero con interés genuino.",
    guion: [
      "Saluda y da nombre + país.",
      "Di a qué te dedicas.",
      "Responde qué te llamó la atención.",
      "Di qué te gustaría lograr ($3k-$5k extra al mes).",
      "Explica tu bloqueo: miedo a perder dinero, no saber por dónde empezar.",
      "Da tu capital: $700 USD.",
    ],
    veredicto: "Bot debe agendar llamada normal ($600-$1,000). No mencionar club. No decir 'te faltan'.",
    asserts: [
      "bot_entrega_calendly_normal", "bot_no_menciona_club", "bot_no_menciona_te_faltan",
    ],
  },
  {
    id: "A3", grupo: "A", nombre: "Club < $600",
    persona: "Te llamas Diego, eres peruano, trabajas como mesero. Tienes $300 USD. Motivado pero con poco capital.",
    guion: [
      "Saluda y da nombre + país.",
      "Di a qué te dedicas.",
      "Responde qué te llamó la atención.",
      "Di qué te gustaría lograr.",
      "Explica tu bloqueo: horarios complicados, no tienes tiempo para aprender solo.",
      "Da tu capital: $300 USD.",
      "Cuando el bot haga el puente al club, confirma que SÍ quieres cambiar en serio.",
      "Acepta el club cuando te lo presenten.",
    ],
    veredicto: "Bot debe: puente al club → confirmación → presentación club → link Skool.",
    asserts: [
      "bot_hace_puente_club", "bot_presenta_club", "bot_entrega_skool",
    ],
  },
  {
    id: "A4", grupo: "A", nombre: "Video gratis (sin nada)",
    persona: "Te llamas Sofía, eres argentina. No trabajas, dependes de tus papás. No tienes dinero ni para el club.",
    guion: [
      "Saluda y da nombre + país.",
      "Di que no trabajas, eres estudiante.",
      "Responde que no tienes ingreso fijo.",
      "Cuando pregunten capital: 'No tengo nada, ni los $34'.",
    ],
    veredicto: "Bot debe enviar el video gratis, sin insistir en que pague.",
    asserts: [
      "bot_entrega_video_gratis", "bot_no_insiste_pago",
    ],
  },

  // ── GRUPO B: Gates de entrada ──
  {
    id: "B1", grupo: "B", nombre: "Solo saluda",
    stopAfterFirstBotReply: true, // solo queremos ver la reacción inicial
    persona: "Eres un prospecto curioso que solo saluda. NO respondes nada más.",
    guion: [
      "Saluda solamente: 'Hola', 'Buenas', o similar. Luego te quedas callado.",
    ],
    veredicto: "Bot debe responder pidiendo nombre + país juntos.",
    asserts: ["bot_pide_nombre_pais"],
  },
  {
    id: "B2", grupo: "B", nombre: "Da nombre, no país",
    stopAfterFirstBotReply: true,
    persona: "Te llamas Camila. Das tu nombre pero no el país.",
    guion: [
      "Escribe: 'Soy Camila, vengo de la landing' o similar. No menciones país.",
    ],
    veredicto: "Bot debe preguntar solo por el país.",
    asserts: ["bot_pide_solo_pais"],
  },
  {
    id: "B3", grupo: "B", nombre: "Responde con ciudad/departamento",
    persona: "Te llamas Carlos, eres de Chocó, Colombia.",
    guion: [
      "Primer mensaje: solo saludas 'Hola', sin dar nombre ni país.",
      "El bot te pregunta nombre y país. Respondes: 'Soy Carlos, de Chocó'.",
    ],
    veredicto: "Bot debe deducir Colombia a partir de 'Chocó'.",
    asserts: ["bot_deduce_pais"],
  },
  {
    id: "B5", grupo: "B", nombre: "Apodo en vez de nombre",
    persona: "No quieres dar tu nombre real, usas apodos siempre.",
    guion: [
      "Primer mensaje: solo saludas 'Hola', sin dar nombre ni país.",
      "El bot te pregunta nombre y país. Respondes con un apodo: 'Soy Parce, de Colombia'.",
    ],
    veredicto: "Bot debe rechazar el apodo y pedir nombre real.",
    asserts: ["bot_rechaza_apodo"],
  },
  // ── GRUPO C: Conversión de moneda ──
  {
    id: "C1", grupo: "C", nombre: "Bolivianos → USD",
    persona: "Te llamas Juan, eres boliviano, trabajas. Tienes 6,000 bolivianos.",
    guion: [
      "Saluda, da nombre + país.",
      "Di a qué te dedicas (profesor).",
      "Responde las preguntas de calificación.",
      "Da tu capital: '6,000 bolivianos'.",
    ],
    veredicto: "~$860 USD → rama llamada normal. No club, no VIP.",
    asserts: ["bot_entrega_calendly_normal"],
  },
  {
    id: "C2", grupo: "C", nombre: "Pesos mexicanos → USD",
    persona: "Te llamas Ana, eres mexicana, trabajas. Tienes 18,000 MXN.",
    guion: [
      "Saluda, da nombre + país.",
      "Di a qué te dedicas.",
      "Responde calificación.",
      "Da capital: '18 mil pesos mexicanos'.",
    ],
    veredicto: "~$1,000 USD → rama llamada (normal).",
    asserts: ["bot_entrega_calendly_normal"],
  },
  {
    id: "C3", grupo: "C", nombre: "Meta no es capital",
    stopAfterFirstBotReply: true, // solo nos interesa la reacción al dar una meta como capital
    persona: "Te llamas Pedro. Cuando pregunten capital, dices una META, no un capital disponible.",
    guion: [
      "Saluda, da nombre + país.",
      "Di a qué te dedicas.",
      "Responde calificación.",
      "Cuando pregunten capital: 'Quiero ganar 3,000 al mes'.",
    ],
    veredicto: "Bot NO debe interpretar 'quiero ganar 3,000' como capital.",
    asserts: ["bot_no_interpreta_meta_como_capital"],
  },

  // ── GRUPO D: Sub-flujos de pago ──
  {
    id: "D1", grupo: "D", nombre: "Colombia sin tarjeta",
    persona: "Te llamas Andrés, colombiano, tienes $300 USD. Quieres el club pero no tienes tarjeta.",
    guion: [
      "Pasa por la calificación normal (trabajas, das capital $300).",
      "Cuando llegue el puente y presentación del club, di que SÍ quieres.",
      "Cuando te digan el precio: 'Sí quiero, pero no tengo tarjeta, solo efectivo'.",
    ],
    veredicto: "Bot debe ofrecer Nequi (Colombia) y luego enviar club.",
    asserts: ["bot_ofrece_nequi", "bot_entrega_skool"],
  },
  {
    id: "D2", grupo: "D", nombre: "No-Colombia sin tarjeta, familiar paga",
    persona: "Te llamas Roberto, eres argentino, tienes $200 USD. Sin tarjeta.",
    guion: [
      "Pasa calificación.",
      "Acepta el club.",
      "Cuando te digan precio: 'No tengo tarjeta, solo efectivo'.",
      "Cuando pregunten: 'Sí, mi primo me puede prestar'.",
    ],
    veredicto: "Bot debe ofrecer familiar, luego enviar club.",
    asserts: ["bot_ofrece_familiar", "bot_entrega_skool"],
  },
  {
    id: "D3", grupo: "D", nombre: "Nadie presta → video gratis",
    persona: "Te llamas Luis, eres chileno. Sin tarjeta, nadie puede prestarte.",
    guion: [
      "Pasa calificación.",
      "Acepta el club.",
      "Cuando te digan precio: 'No tengo tarjeta'.",
      "Cuando pregunten por familiar: 'No, nadie puede prestarme'.",
    ],
    veredicto: "Bot debe enviar video gratis si nadie puede pagar.",
    asserts: ["bot_entrega_video_gratis"],
  },

  // ── GRUPO E: Género y nombre ──
  {
    id: "E1", grupo: "E", nombre: "Mujer, adapta género",
    persona: "Te llamas Valeria, eres venezolana, trabajas. Capital $500 USD.",
    guion: [
      "Saluda, da nombre + país.",
      "Di a qué te dedicas.",
      "Responde calificación normal.",
      "Da capital: $500 USD.",
    ],
    veredicto: "Bot debe usar 'interesada' y lenguaje femenino. Nunca 'bro' o 'hermano'.",
    asserts: ["bot_usa_genero_femenino", "bot_no_dice_bro"],
  },

  // ── GRUPO F: Disciplina de cierre ──
  {
    id: "F1", grupo: "F", nombre: "Pide explicación antes de agendar",
    persona: "Te llamas Javier, colombiano, $800 USD. Cuando te digan de agendar, pides explicación.",
    guion: [
      "Calificación normal, capital $800 USD.",
      "Cuando llegue el cierre: 'Antes de agendar, explícame bien de qué trata todo'.",
    ],
    veredicto: "Bot no debe presentar el club. Debe hablar de la reunión.",
    asserts: ["bot_no_presenta_club_en_llamada", "bot_insiste_reunion"],
  },
  {
    id: "F2", grupo: "F", nombre: "Anti-anuncio",
    persona: "Te llamas Ricardo, colombiano, $900 USD. Responde normal hasta el cierre.",
    guion: [
      "Calificación normal, capital $900 USD.",
    ],
    veredicto: "Bot debe entregar el link de Calendly en el mismo turno, sin anunciar.",
    asserts: ["bot_entrega_link_directo"],
  },
  {
    id: "F3", grupo: "F", nombre: "Confirma después del cierre",
    persona: "Te llamas Daniel, capital $1,200 USD.",
    guion: [
      "Calificación normal, capital $1,200 USD.",
      "Después de que el bot entregue Calendly: 'Listo, ya agendé'.",
    ],
    veredicto: "Bot responde corto, no repite el link.",
    asserts: ["bot_respuesta_corta"],
  },

  // ── GRUPO G: Objeciones (una representativa) ──
  {
    id: "G6", grupo: "G", nombre: "Objeción: hablarlo con pareja",
    persona: "Te llamas Miguel, colombiano, $500 USD. Quieres el club pero dices que debes hablarlo con tu pareja.",
    guion: [
      "Calificación normal (trabajas, capital $500).",
      "Acepta el puente al club.",
      "Cuando presenten el club y pidan confirmación: 'Déjame hablarlo con mi esposa primero'.",
    ],
    veredicto: "Bot debe usar el guion de objeción #6 (pareja), presionando a pagar ya.",
    asserts: ["bot_usa_objeción_pareja"],
  },
  {
    id: "G7", grupo: "G", nombre: "Objeción: permiso de papás",
    persona: "Te llamas Felipe, colombiano, $200 USD. Dependes de tus papás.",
    guion: [
      "Calificación (estudiante, sin ingreso fijo).",
      "Capital $200 USD.",
      "Cuando presenten el club: 'Mi mamá no me deja, necesito permiso'.",
    ],
    veredicto: "Bot debe usar objeción #7 (permiso), con empatía, sin presionar.",
    asserts: ["bot_usa_objeción_permiso", "bot_empático_no_presiona"],
  },
  {
    id: "G11", grupo: "G", nombre: "Objeción: ¿esto es real/estafa?",
    persona: "Te llamas Andrea, mexicana, $400 USD. Dudas de la legitimidad.",
    guion: [
      "Calificación (trabajas, capital $400).",
      "Acepta puente al club.",
      "Cuando presenten club: '¿Esto es real o es una estafa?'",
    ],
    veredicto: "Bot debe usar objeción #11, mencionar casos reales e Instagram.",
    asserts: ["bot_usa_objeción_real"],
  },

  // ── GRUPO H: Precios Premium/VIP ──
  {
    id: "H1", grupo: "H", nombre: "Pregunta precio Premium",
    persona: "Te llamas Fernando, colombiano, $3,000 USD.",
    guion: [
      "Calificación normal.",
      "Da capital $3,000 USD.",
      "Antes del cierre: '¿Cuánto cuesta el programa Premium?'",
    ],
    veredicto: "Bot puede dar el precio de Premium ($1,500) porque lo preguntaron directo, pero reencauza a reunión.",
    asserts: ["bot_da_precio_premium", "bot_reencauza_reunion"],
  },
];

// ── Sistema de validación ───────────────────────────────────────
// Cada assert es una función que recibe el historial de la conversación
// y devuelve { pass: bool, detalle: string }

async function validar(assertName, historial) {
  const ultimos = historial.slice(-6).map((m) => `${m.rol}: ${m.texto}`).join("\n---\n");
  const prompt = `Eres un validador de bots de conversación. Dado el siguiente historial de una conversación entre un prospecto y un bot de ventas (que se hace pasar por "Brayan"), evalúa si se cumple el assert:

ASSERT: "${assertName}"

HISTORIAL (últimos intercambios):
${ultimos}

Responde SOLO con:
PASS: <razón breve>
FAIL: <qué faltó>
`;

  const resp = await llamarLLM("Eres un validador estricto y preciso.", [
    { role: "user", content: prompt },
  ], 0.3);
  return resp.trim();
}

// ── Runner principal ────────────────────────────────────────────
async function ejecutarTest(testCase, opts = {}) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 ${testCase.id} - ${testCase.nombre} [Grupo ${testCase.grupo}]`);
  console.log(`${"=".repeat(60)}`);

  const telefono = `1555${Math.floor(1000000 + Math.random() * 8999999)}`;
  const historial = [];
  const systemProspecto = `Eres un prospecto realista conversando con el bot de Brayan Hernández (E-Master Project). 
Tu PERSONA: ${testCase.persona}

Debes seguir este GUIÓN de conversación, pero responde NATURALMENTE, como una persona real:
${testCase.guion.map((g, i) => `${i + 1}. ${g}`).join("\n")}

IMPORTANTE:
- No digas "estoy siguiendo un guión" ni hagas meta-comentarios.
- Responde de forma natural, como si fuera una conversación real de WhatsApp.
- Cada mensaje debe ser corto (1-3 líneas), como gente normal en WhatsApp.
- NO adelantes información: espera a que el bot pregunte o mencione algo.
- Si no tienes más que decir según tu guión, solo responde lo necesario para avanzar.
- Si el bot ya te dio el cierre (link de Calendly, link de Skool, o video gratis), considera que la conversación ha terminado.`;

  let paso = 0;
  let botDioCierre = false;
  let mensajeProspecto = null;

  const stopEarly = testCase.stopAfterFirstBotReply;
  while (paso < MAX_PASOS && !botDioCierre) {
    paso++;

    // El prospecto decide qué decir
    if (!mensajeProspecto) {
      const contextoHistorial = historial.map((m) => `${m.rol}: ${m.texto}`).join("\n");
      const promptProspecto = `Historial de la conversación hasta ahora:

${contextoHistorial || "(esto es el inicio de la conversación, nadie ha hablado aún)"}

¿Qué dices ahora? Responde SOLO con el texto que enviarías, nada más.`;
      mensajeProspecto = await llamarLLM(systemProspecto, [
        { role: "user", content: promptProspecto },
      ], 0.8);
      // Limpiar posibles comillas
      mensajeProspecto = mensajeProspecto.replace(/^["']|["']$/g, "").trim();
    }

    // Enviar al bot
    console.log(`\n[${paso}] 👤 Prospecto: ${mensajeProspecto}`);
    historial.push({ rol: "prospecto", texto: mensajeProspecto });

    const botResp = await hablarConBot(telefono, mensajeProspecto);
    console.log(`[${paso}] 🤖 Bot: ${botResp.texto.substring(0, 300)}${botResp.texto.length > 300 ? "..." : ""}`);
    if (botResp.media.length) {
      console.log(`[${paso}] 📎 Media: ${botResp.media.join(", ")}`);
    }
    historial.push({ rol: "bot", texto: botResp.texto, media: botResp.media });

    // Si es test de gate (stopEarly), terminamos después de la primera respuesta del bot
    if (stopEarly) {
      console.log(`[${paso}] 🛑 Gate test: verificando primera respuesta del bot`);
      break;
    }

    // Detectar si el bot ya dio cierre
    const texto = botResp.texto.toLowerCase();
    if (
      texto.includes("calendly.com") ||
      texto.includes("skool.com") ||
      texto.includes("youtu.be") ||
      texto.includes("youtube.com") ||
      texto.includes("video gratis") ||
      (botResp.media && botResp.media.length > 0)
    ) {
      // El bot ya entregó un recurso. Si el prospecto tiene más guión, puede seguir.
      // Marcamos parcialmente
      if (texto.includes("calendly.com") || texto.includes("skool.com")) {
        botDioCierre = true;
        console.log(`[${paso}] ✅ Bot entregó cierre (${texto.includes("calendly.com") ? "Calendly" : "Skool"})`);
      }
      if (texto.includes("youtu.be") || texto.includes("youtube.com") || texto.includes("video gratis")) {
        botDioCierre = true;
        console.log(`[${paso}] ✅ Bot entregó video gratis`);
      }
    }

    // Verificar si la conversación se estancó (bot repite)
    const repeticiones = historial.filter((h) => h.rol === "bot" && h.texto === botResp.texto);
    if (repeticiones.length > 2) {
      console.log(`[${paso}] ⚠️  Bot se está repitiendo. Terminando.`);
      break;
    }

    mensajeProspecto = null;

    // Pequeña pausa para no saturar el bot
    await new Promise((r) => setTimeout(r, 500));
  }

  // ── Validación ────────────────────────────────────────────────
  console.log(`\n🔍 Validando ${testCase.nombre}...`);
  const resultados = [];
  for (const assert of testCase.asserts) {
    const r = await validar(assert, historial);
    resultados.push({ assert, resultado: r });
    console.log(`  ${r.startsWith("PASS") ? "✅" : "❌"} ${assert}: ${r.substring(0, 80)}`);
  }

  return {
    id: testCase.id,
    nombre: testCase.nombre,
    grupo: testCase.grupo,
    pasos: paso,
    historial,
    resultados,
    passed: resultados.filter((r) => r.resultado.startsWith("PASS")).length,
    total: resultados.length,
  };
}

// ── Reporte ─────────────────────────────────────────────────────
function generarReporte(results) {
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed === r.total).length;

  console.log(`\n\n${"=".repeat(60)}`);
  console.log("📊 REPORTE FINAL");
  console.log(`${"=".repeat(60)}`);
  console.log(`\n✅ Tests completos: ${passedTests}/${totalTests}`);
  console.log(`❌ Tests con fallos: ${totalTests - passedTests}/${totalTests}`);

  // Por grupo
  const grupos = {};
  for (const r of results) {
    if (!grupos[r.grupo]) grupos[r.grupo] = { total: 0, passed: 0, tests: [] };
    grupos[r.grupo].total++;
    if (r.passed === r.total) grupos[r.grupo].passed++;
    grupos[r.grupo].tests.push(r);
  }

  console.log(`\n${"─".repeat(40)}`);
  console.log("RESUMEN POR GRUPO:");
  console.log(`${"─".repeat(40)}`);
  for (const [g, info] of Object.entries(grupos).sort()) {
    const emoji = info.passed === info.total ? "✅" : "⚠️";
    console.log(`  ${emoji} Grupo ${g}: ${info.passed}/${info.total} tests`);
    for (const t of info.tests) {
      const em = t.passed === t.total ? "✅" : "❌";
      console.log(`     ${em} ${t.id} - ${t.nombre} (${t.passed}/${t.total} asserts, ${t.pasos} pasos)`);
    }
  }

  // Tests fallados en detalle
  const fallados = results.filter((r) => r.passed !== r.total);
  if (fallados.length > 0) {
    console.log(`\n${"─".repeat(40)}`);
    console.log("DETALLE DE FALLOS:");
    console.log(`${"─".repeat(40)}`);
    for (const f of fallados) {
      console.log(`\n❌ ${f.id} - ${f.nombre}`);
      for (const r of f.resultados) {
        if (!r.resultado.startsWith("PASS")) {
          console.log(`  ${r.resultado}`);
        }
      }
    }
  }

  const archivoReporte = `tests/reporte-${Date.now()}.json`;
  const reporte = {
    timestamp: new Date().toISOString(),
    botUrl: BOT_URL,
    modelo: MODEL,
    totalTests,
    passedTests,
    resultados: results,
  };
  return { reporte, archivoReporte };
}

// ── Entry point ─────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error("❌ Necesitas DEEPSEEK_API_KEY o OPENAI_API_KEY en entorno");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const filtroGrupo = args.find((a) => a.startsWith("--grupo="))?.split("=")[1];
  const filtroCaso = args.find((a) => a.startsWith("--caso="))?.split("=")[1];

  let casos = TEST_CASES;
  if (filtroGrupo) casos = casos.filter((c) => c.grupo === filtroGrupo);
  if (filtroCaso) casos = casos.filter((c) => c.id === filtroCaso);

  if (casos.length === 0) {
    console.error("❌ No hay casos que coincidan con los filtros");
    process.exit(1);
  }

  console.log(`\n🤖 SISTEMA MULTIAGENTE DE PRUEBAS`);
  console.log(`📍 Bot URL: ${BOT_URL}`);
  console.log(`🧠 Modelo: ${MODEL}`);
  console.log(`🔬 Casos a ejecutar: ${casos.length} (${casos.map((c) => c.id).join(", ")})`);
  console.log(`\nComenzando en 3 segundos...`);
  await new Promise((r) => setTimeout(r, 3000));

  const results = [];
  for (const testCase of casos) {
    try {
      const result = await ejecutarTest(testCase);
      results.push(result);
    } catch (err) {
      console.error(`\n💥 Error en ${testCase.id}:`, err.message);
      results.push({
        id: testCase.id,
        nombre: testCase.nombre,
        grupo: testCase.grupo,
        pasos: 0,
        historial: [],
        resultados: [{ assert: "error", resultado: `FAIL: ${err.message}` }],
        passed: 0,
        total: 1,
      });
    }
  }

  const { reporte, archivoReporte } = generarReporte(results);
  // Guardar reporte
  const fs = await import("fs");
  fs.writeFileSync(archivoReporte, JSON.stringify(reporte, null, 2));
  console.log(`\n📁 Reporte guardado en: ${archivoReporte}`);

  // Exit code
  process.exit(results.every((r) => r.passed === r.total) ? 0 : 1);
}

main().catch((err) => {
  console.error("💥 Fatal:", err);
  process.exit(1);
});
