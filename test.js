// test.js
// Prueba la lógica de respuestas sin Twilio ni LLM.
// Ejecuta:  node test.js
//
// Sin OPENAI_API_KEY, las preguntas libres caen al respaldo (el saludo),
// así que aquí verificamos sobre todo los caminos deterministas:
// saludo, reinicio y bloque de resultados. Si defines la key, también
// verás respuestas reales del setter.

const { procesarMensaje } = require("./index");

async function conversacion(nombre, pasos) {
  const sesion = { historial: [], saludado: true, visto: Date.now() };
  console.log("\n===== " + nombre + " =====");
  let ok = true;
  for (const entrada of pasos) {
    const r = await procesarMensaje(entrada, sesion);
    const texto = typeof r === "string" ? r : r && r.texto;
    const valido = typeof texto === "string" && texto.length > 0;
    if (!valido) ok = false;
    console.log('> "' + entrada + '"  ->  ' + (texto || "(vacío)").split("\n")[0]);
  }
  return ok;
}

(async () => {
  let todoOk = true;

  todoOk = (await conversacion("Saludo y reinicio", [
    "Hola", "menú", "info",
  ])) && todoOk;

  todoOk = (await conversacion("Pide resultados / pruebas", [
    "¿tienes resultados?", "muéstrame testimonios", "esto es real?",
  ])) && todoOk;

  todoOk = (await conversacion("Preguntas libres (van al LLM, o al respaldo)", [
    "¿de qué se trata el programa?",
    "¿cuánto cuesta?",
    "no tengo experiencia",
    "quiero agendar",
  ])) && todoOk;

  console.log("\nResultado global: " + (todoOk ? "TODO OK ✅" : "HAY FALLOS ❌"));
  process.exit(todoOk ? 0 : 1);
})();
