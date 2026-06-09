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
        "Llámala SIN DUDARLO apenas se cumplan AMBAS: (a) la persona acepta o pide agendar/avanzar (incluye 'sí', 'dale', 'agendemos', 'quiero la llamada'), y (b) ya tienes su NOMBRE REAL (no un saludo ni apodo como 'parce'/'hermano') y su PAÍS. NO pidas confirmaciones extra ni preguntes si 'está listo' ni pidas un horario. Si te falta el nombre o el país, NO la llames: pide ese dato primero. Pasa solo datos reales; nunca inventes.",
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
    "REGLA DE CIERRE (MÁXIMA PRIORIDAD): apenas la persona exprese que quiere avanzar o agendar (p. ej. 'sí', 'dale', 'listo', 'agendemos', 'quiero la llamada') y YA tengas su NOMBRE y su PAÍS, tu única acción correcta es llamar a agendar_llamada y entregarle el link. NO hagas ni una pregunta más, NO le pidas que 'confirme que está listo', NO pidas un horario. Solo si te falta el nombre o el país, pide ese dato primero (uno por mensaje).",
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
    "5. Cierra: apenas tengas su nombre real y su país Y la persona acepte agendar, llama agendar_llamada DE INMEDIATO y entrégale el link. NO le pidas un horario ni más datos: en el link de Calendly la persona elige el día y la hora. No agendes antes de tener nombre y país.",
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
    "CAPTURA DE DATOS (clave: no registres basura):",
    "- NOMBRE: si te escriben con un saludo o apodo ('parce', 'hermano', 'bro', 'amigo', 'llave', 'mor'...), eso NO es su nombre. Pregúntale '¿cómo te llamas?' y usa lo que te diga. Nunca asumas el nombre.",
    "- PAÍS: pregúntalo explícito ('¿desde qué país me escribes?'). No lo adivines.",
    "- Si dudas de un dato, PREGÚNTALO. Nunca lo rellenes con un saludo ni con suposiciones.",
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
    "- Apenas tengas su NOMBRE real y su PAÍS y la persona acepte, llama agendar_llamada y entrégale el link SIN pedir más datos (en Calendly elige el horario). Si la herramienta te dice que falta un dato, pídeselo con naturalidad y reintenta. Si te da el link, entrégaselo y confírmale que ahí ven su caso, sin compromiso. Si dice que aún no hay link configurado, toma su nombre, país y mejor horario y dile que el equipo lo contacta enseguida.",
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
    temperature: 0.6,
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
