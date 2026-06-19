#!/usr/bin/env node
/**
 * Pruebas de regresión DETERMINÍSTICAS de los cambios estructurales del SDD
 * (features/README.md). No tocan el LLM: ejercitan los gates de index.js que
 * retornan antes de llamar al modelo. Correr con:  node tests/cambios-deterministicos.js
 */
process.env.SEGUIMIENTO_WEBHOOK_URL = "";
process.env.LEAD_WEBHOOK_URL = "";
process.env.OPENAI_API_KEY = ""; // fuerza llm.responder -> null (sin red)

const { procesarMensaje } = require("../index.js");
const G = require("../guion.js");

const t = (s) => (typeof s === "string" ? s : (s && s.text) || JSON.stringify(s));
const nueva = (extra = {}) => ({ historial: [], pais: null, nombre: null, capitalUSD: null, ...extra });

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; };

(async () => {
  // ── CAMBIO-02: apodos NO se capturan como nombre; nombre real sí ──
  let s = nueva(); await procesarMensaje("Soy Parce", s);
  ok(s.nombre === null, "CAMBIO-02 apodo 'Parce' rechazado");
  s = nueva(); await procesarMensaje("bro", s);
  ok(s.nombre === null, "CAMBIO-02 apodo 'bro' rechazado");
  s = nueva(); await procesarMensaje("Soy Camila", s);
  ok(s.nombre === "Camila", "CAMBIO-02 nombre real 'Camila' capturado");

  // ── CAMBIO-03: reintento de país por contador de sesión ──
  s = nueva();
  ok(t(await procesarMensaje("Soy Pedro, de Wakanda", s)) === G.PREGUNTA_PAIS,
    "CAMBIO-03 1er país inválido (con nombre, sin saludo) usa PREGUNTA_PAIS");
  ok(t(await procesarMensaje("vivo en la luna", s)) === G.PREGUNTA_PAIS_REINTENTO,
    "CAMBIO-03 2do país inválido usa REINTENTO");
  s = nueva(); await procesarMensaje("hola", s);
  ok(s.vecesPidioPais === 1, "CAMBIO-03 saludo setea vecesPidioPais=1");
  ok(t(await procesarMensaje("Soy Pedro, de Wakanda", s)) === G.PREGUNTA_PAIS_REINTENTO,
    "CAMBIO-03 tras saludo, 1er país inválido usa REINTENTO (fix B4)");
  s = nueva();
  ok(t(await procesarMensaje("quiero info algo", s)) === G.PREGUNTA_NOMBRE_PAIS,
    "CAMBIO-03 faltan ambos -> PREGUNTA_NOMBRE_PAIS");

  // ── CAMBIO-01: off-ramp determinístico "sin nada" (con país ya capturado) ──
  const conPais = () => nueva({ pais: "Colombia", nombre: "Sofia", cerrado: null, vecesPidioPais: 2 });
  for (const frase of [
    "no tengo nada de dinero, ni los $34",
    "ni para el club",
    "no tengo ni para los 34",
    "uff no me alcanza ni para eso",
    "estoy en cero bro",
  ]) {
    const ss = conPais();
    const r = t(await procesarMensaje(frase, ss));
    ok(r === G.VIDEO_GRATIS && ss.cerrado === "video", `CAMBIO-01 off-ramp dispara: "${frase}"`);
  }
  // NO debe disparar el off-ramp en objeción #2 / sin-tarjeta (caen al LLM->null->SALUDO)
  for (const frase of ["ahorita no tengo el dinero", "no tengo tarjeta, solo efectivo"]) {
    const ss = conPais();
    const r = t(await procesarMensaje(frase, ss));
    ok(r !== G.VIDEO_GRATIS, `CAMBIO-01 NO off-ramp en: "${frase}"`);
  }

  console.log(fails === 0 ? "\n✅ TODO OK" : `\n❌ ${fails} FALLOS`);
  process.exit(fails === 0 ? 0 : 1);
})();
