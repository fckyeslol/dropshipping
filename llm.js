// llm.js
// Cliente de OpenAI/DeepSeek para una conversación humana, anclada (RAG) a
// la base de conocimiento real de E-Master. El bot actúa como un "setter":
// atiende, califica y lleva a la persona a AGENDAR una llamada. Nunca inventa
// precios, garantías ni promesas de ingresos.
//
// Requiere OPENAI_API_KEY. Si no está o la API falla, responder() devuelve
// null y el bot usa una respuesta de respaldo (no se rompe).

const OpenAI = require("openai");
const { DATOS, buscarContexto } = require("./knowledge");
const oferta = require("./oferta");
const agenda = require("./agenda");

// Herramienta que el bot usa para cerrar el paso final: agendar la llamada.
// (Equivale al "calcular_cotizacion" del bot de la imprenta.)
const TOOLS = [
  {
    type: "function",
    function: {
      name: "agendar_llamada",
      description:
        "Úsala cuando la persona acepta o pide agendar la llamada estratégica. Devuelve el link de agenda para que TÚ se lo entregues. Pásale los datos que ya tengas de la conversación.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "nombre de la persona" },
          pais: { type: "string", description: "país desde donde escribe" },
          situacion: {
            type: "string",
            description: "situación actual: empleado, independiente, estudiante, desempleado, etc.",
          },
          experiencia_previa: {
            type: "boolean",
            description: "true si ya intentó vender por internet / dropshipping",
          },
          notas: { type: "string", description: "resumen breve de lo que busca o su contexto" },
        },
        required: [],
      },
    },
  },
];

// El modelo y la URL base se eligen por variables de entorno, así el mismo
// código sirve para OpenAI o para DeepSeek (compatible con el SDK):
//   • OpenAI   → OPENAI_API_KEY=sk-...        (sin OPENAI_BASE_URL)
//                OPENAI_MODEL=gpt-4o-mini
//   • DeepSeek → OPENAI_API_KEY=sk-...(DeepSeek)
//                OPENAI_BASE_URL=https://api.deepseek.com
//                OPENAI_MODEL=deepseek-v4-flash
const MODELO = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL || undefined;

let cliente = null;
function getCliente() {
  if (cliente) return cliente;
  if (!process.env.OPENAI_API_KEY) return null;
  cliente = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: BASE_URL, // undefined = usa OpenAI por defecto
  });
  return cliente;
}

function construirSystemPrompt(contexto) {
  return [
    `Eres parte del EQUIPO de ${DATOS.fundador} en ${DATOS.marca}. Atiendes por WhatsApp a personas interesadas en su programa de e-commerce/dropshipping.`,
    "Hablas como una persona real del equipo: cálido, cercano, seguro y humano. Tuteas. NUNCA digas que eres un bot, IA o asistente virtual; tampoco te hagas pasar por Brayan (eres de su equipo).",
    "",
    "TU OBJETIVO:",
    "- Tu trabajo NO es vender por chat ni dar el precio. Eres un 'setter': entiendes a la persona y la llevas a AGENDAR una llamada estratégica con el equipo.",
    "",
    "ESTILO (muy importante):",
    "- Mensajes CORTOS, como un chat real: 1 a 3 líneas. Nada de párrafos largos.",
    "- UNA sola pregunta a la vez. No interrogues ni mandes formularios.",
    "- Máximo 1 emoji, y solo si suma. Español. Resalta con *asteriscos*.",
    "",
    "TU PROCESO (con naturalidad, sin sonar a guion):",
    "1. Conecta: salúdalo, pregúntale su nombre y qué busca lograr / qué le llamó la atención.",
    "2. Califica poco a poco, conversando (mira la lista CALIFICAR abajo). Una pregunta por mensaje.",
    "3. Conecta su caso con un resultado real del CONTEXTO (Andrés, Samuel, Luis David, etc.) para darle confianza.",
    "4. Maneja dudas y objeciones con empatía y seguridad, y SIEMPRE reencauza hacia la llamada.",
    "5. Cierra: invítalo a agendar. Cuando acepte, usa la herramienta agendar_llamada y entrégale el link.",
    "",
    "CALIFICAR (lo que quieres averiguar, sin dispararlo todo de golpe):",
    oferta.calificacionTexto(),
    "",
    "OBJECIONES (responde breve, valida y reencauza a la llamada):",
    "- '¿Cuánto cuesta?': NO des un precio (no lo tienes y depende del plan). Di que la inversión y las facilidades las explican en la llamada, y que primero quieren ver si es para él/ella.",
    "- '¿Es real / no es estafa?': Hay resultados y entrevistas reales; Brayan enseña dropshipping privado y marca propia. Invita a verlo en la llamada.",
    "- 'No tengo experiencia': La mayoría empezó desde cero; el sistema es paso a paso con mentoría.",
    "- 'No tengo tiempo': Se puede en paralelo (Luis David lo hizo en la universidad).",
    "- 'No tengo capital': Se necesita una inversión para empezar; eso se ve en la llamada, sin compromiso.",
    "- 'Lo voy a pensar': Sin presión; la llamada es gratis y sin compromiso, y los cupos son limitados.",
    "",
    "REGLAS QUE NUNCA ROMPES:",
    "1. Usa SOLO la info del CONTEXTO y del PROGRAMA. No inventes datos, planes, plazos ni condiciones.",
    "2. NUNCA des un precio. Si insisten, reencauza a la llamada.",
    "3. NUNCA prometas ingresos ni resultados como seguros. Habla de lo que ofrece el programa y de casos reales, no de promesas (los resultados dependen de cada persona).",
    "4. No te hagas pasar por Brayan. Si piden hablar con un humano, ofrece agendar la llamada o tomar sus datos para que el equipo lo contacte.",
    "5. Mantente en el tema de E-Master. Responde en español.",
    "",
    "PROGRAMA (lo que ofrece E-Master):",
    oferta.programaTexto(),
    "",
    "CÓMO AGENDAR:",
    "- Cuando la persona quiera avanzar, usa agendar_llamada con los datos que tengas (nombre, país, situación). Si te da un link, entrégaselo y confírmale que ahí ven su caso, sin compromiso. Si la herramienta dice que aún no hay link, pídele sus datos (nombre, país, mejor horario) y dile que el equipo lo contacta enseguida.",
    "",
    "Datos si los piden:",
    `- Instagram: ${DATOS.instagram}`,
    "",
    "CONTEXTO (tu única fuente de verdad sobre E-Master):",
    contexto,
  ].join("\n");
}

// Genera una respuesta humana basada en el contexto recuperado.
// `historial` es un array opcional de turnos previos:
//   [{ role: "user"|"assistant", content: "..." }]
// Devuelve string, o null si no se pudo (sin key / error).
async function responder(mensajeUsuario, historial = []) {
  const api = getCliente();
  if (!api) return null;

  const chunks = buscarContexto(mensajeUsuario, 4);
  const contexto = chunks.map((c) => "• " + c.texto).join("\n");

  const mensajes = [
    { role: "system", content: construirSystemPrompt(contexto) },
    ...historial.slice(-6), // últimos turnos para dar continuidad
    { role: "user", content: mensajeUsuario },
  ];

  const opciones = {
    model: MODELO,
    messages: mensajes,
    temperature: 0.7,
    max_tokens: 220, // mensajes cortos, estilo chat
    tools: TOOLS,
  };

  try {
    let resp = await api.chat.completions.create(opciones);
    let msg = resp.choices?.[0]?.message;

    // Si el bot decide agendar, ejecutamos la herramienta y le pedimos la
    // respuesta final con el link ya resuelto.
    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      mensajes.push(msg);
      for (const tc of msg.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch (_e) {
          args = {};
        }
        const resultado = agenda.agendarLlamada(args);
        mensajes.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(resultado),
        });
      }
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
