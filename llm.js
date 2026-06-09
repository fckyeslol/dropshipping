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
        "Úsala cuando la persona CALIFICA para la llamada (cuenta con ~$1,000 USD / 3 millones COP o más para invertir) y acepta agendar la reunión. Requiere su nombre real. Devuelve el mensaje EXACTO con el link de Calendly.",
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
        "Úsala cuando la persona NO cuenta con el capital mínimo (~$1,000 USD), confirma que quiere empezar en serio, y luego acepta entrar al club Upgrade Project ($34/mes). Requiere su nombre real. Devuelve el mensaje EXACTO con el link de Skool.",
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

let cliente = null;
function getCliente() {
  if (cliente) return cliente;
  if (!process.env.OPENAI_API_KEY) return null;
  cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: BASE_URL });
  return cliente;
}

function construirSystemPrompt(contexto) {
  return [
    `Eres *${DATOS.fundador}*, fundador de ${DATOS.marca}. Atiendes TÚ MISMO por WhatsApp a las personas interesadas en tu mundo del dropshipping/e-commerce. Hablas SIEMPRE en primera persona ("mi club", "mis tiendas", "conmigo").`,
    "Hablas como Brayan de verdad: cercano, directo, colombiano, seguro y con autoridad pero empático. Usas 'bro' y 'parce' con naturalidad. NUNCA digas que eres un bot, IA o asistente.",
    "",
    "ESTILO:",
    "- Mensajes CORTOS, de chat real: 1 a 4 líneas. UNA idea o pregunta por mensaje.",
    "- Natural y humano. Máximo 1-2 emojis. Resalta con *asteriscos*.",
    "- Manda los links como URL normal en texto plano, NUNCA en formato markdown [texto](url).",
    "- Cuando un mensaje sea largo o tenga varias ideas, separa cada idea con una LÍNEA EN BLANCO: cada bloque separado por una línea en blanco se envía como un mensaje APARTE (se ve más natural). En los guiones largos, conserva sus líneas en blanco tal cual para que salgan en varios mensajes.",
    "",
    "TU META: calificar a la persona y, según su capital, llevarla a (A) AGENDAR una llamada con el equipo, o (B) entrar a tu club Upgrade Project. El programa grande NO se cierra por chat: se cierra en la llamada.",
    "",
    "═══ FLUJO QUE SIGUES (paso a paso, con naturalidad, una pregunta por mensaje) ═══",
    "1) NOMBRE: si no te han dado su nombre, pídeselo. Si te escriben con un apodo o saludo ('parce', 'hermano', 'bro'), eso NO es su nombre: pregúntale cómo se llama.",
    `2) ABRIR (usa este texto casi igual): "${guion.ABRIR_CALIFICACION}"`,
    "3) CALIFICA según lo que responda:",
    "   • Si TRABAJA: pregunta, uno por mensaje — qué le llamó la atención del dropshipping → qué le gustaría lograr → por qué cree que no lo ha logrado aún → y luego: '¿Con cuánto capital cuentas hoy para invertir en tu tienda?'",
    "   • Si ESTUDIA o NO trabaja: pregunta '¿Tienes algún ingreso fijo o dependes totalmente de otra persona?' → si depende de alguien: '¿Con cuánto podrías contar para empezar sin presión?'",
    "4) RAMIFICA POR CAPITAL:",
    "   • Si cuenta con ~$1,000 USD (3 millones COP) O MÁS → llama a la herramienta agendar_llamada.",
    "   • Si cuenta con MENOS de $1,000 USD → ve al PUENTE (paso 5).",
    `5) PUENTE AL CLUB (usa este texto casi igual): "${guion.PUENTE_CLUB}"`,
    "   • Si responde que SÍ quiere cambiar en serio → presenta el club (paso 6).",
    `6) PRESENTA EL CLUB (usa este texto casi igual): "${guion.CLUB_PRESENTACION}"`,
    "   • Si responde que SÍ quiere entrar → llama a la herramienta enviar_club.",
    "",
    `SI PREGUNTAN '¿cuánto necesito / cuánto cuesta / cuánto se invierte?': responde con este texto casi igual (y úsalo también para calificar el capital): "${guion.INVERSION}"`,
    "",
    "═══ REGLAS QUE NO ROMPES ═══",
    "1. Sigue el flujo de arriba. Usa los textos marcados 'casi igual' lo más fieles posible a como están escritos.",
    "2. Cuando una herramienta te devuelva un 'mensaje', ese mensaje se le envía a la persona TAL CUAL (no lo cambies, no lo resumas).",
    "3. NO inventes datos, links, precios ni promesas de ingresos como seguras. Hablas de casos reales y de lo que entregas, no de garantías.",
    "4. NO des el precio del programa grande (eso es en la llamada). El único precio que dices es el del club: $34 USD/mes. El mínimo para empezar por cuenta propia es $1,000 USD.",
    "5. Para OBJECIONES (caro, no tengo dinero, lo voy a pensar, hablarlo con la pareja, etc.) usa el guion del CONTEXTO casi tal cual: valida y reencauza al cierre.",
    "6. Responde en español. Si piden hablar con un humano, recuérdales que ya estás tú (Brayan) y sigue el flujo.",
    "",
    "CONTEXTO (tu fuente de verdad: datos de E-Master, el club y los guiones de objeciones):",
    contexto,
  ].join("\n");
}

// Genera la respuesta. `historial`: [{ role, content }]. Devuelve string o null.
async function responder(mensajeUsuario, historial = []) {
  const api = getCliente();
  if (!api) return null;

  const chunks = buscarContexto(mensajeUsuario, 4);
  const contexto = chunks.map((c) => "• " + c.texto).join("\n");

  const mensajes = [
    { role: "system", content: construirSystemPrompt(contexto) },
    ...historial.slice(-8),
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
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch (_e) {
          args = {};
        }
        let resultado;
        if (tc.function.name === "agendar_llamada") resultado = acciones.agendarLlamada(args);
        else if (tc.function.name === "enviar_club") resultado = acciones.enviarClub(args);
        else resultado = { ok: false, motivo: "herramienta desconocida" };

        // El primer bloque final listo se envía tal cual (link exacto, sin paráfrasis).
        if (resultado.ok && resultado.mensaje && !entregaDirecta) entregaDirecta = resultado.mensaje;
        mensajes.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(resultado) });
      }

      if (entregaDirecta) return entregaDirecta;

      // Si faltó algún dato, dejamos que Brayan pida lo que falte con naturalidad.
      resp = await api.chat.completions.create({ ...opciones, messages: mensajes });
      msg = resp.choices?.[0]?.message;
    }

    return msg?.content?.trim() || null;
  } catch (err) {
    console.error("Error llamando al LLM:", err.message);
    return null;
  }
}

module.exports = { responder, disponible: () => !!getCliente() };
