#!/usr/bin/env node
/**
 * E2E POST-CIERRE (CAMBIO-12/13) — a prueba de loops.
 * Tras entregar el cierre (Calendly/Skool), NINGUNA pregunta/objeción debe caer
 * en el loop "¿ya agendaste?/¿ya entraste?": el bot debe RESPONDER la duda.
 *
 * Requiere un bot corriendo (con OPENAI_API_KEY). Uso:
 *   BOT_URL=http://localhost:3000 node tests/postcierre-e2e.js
 *   (por defecto apunta al deploy de producción)
 */
const BASE = (process.env.BOT_URL || "https://dropshipping-production-2fb2.up.railway.app") + "/webhook";
async function bot(p, b) {
  const r = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: `whatsapp:+${p}`, Body: b }) });
  const x = await r.text();
  return [...x.matchAll(/<Message>(.*?)<\/Message>/gs)].map((m) => m[1].trim()).join("\n");
}
const LOOP = /ya pudiste agendar|ya pudiste entrar al club/i;
const ph = () => "159" + Math.floor(10000000 + Math.random() * 89999999);
const Q = ["trabajo en ventas", "la libertad", "ganar mas", "me falta guia"];
const setup = async (p, t) => { for (const x of t) await bot(p, x); };
let f = 0;
const ok = (c, m, e = "") => { console.log((c ? "PASS " : "FAIL ") + m + (c ? "" : "  >> " + e)); if (!c) f++; };
const PROBES = [
  "me lo tengo que pensar", "y cuanto cuesta?", "me atiendes tu o alguien de tu equipo?",
  "me garantizas resultados?", "que incluye?", "cuanto dura?", "y si no me funciona?",
  "es presencial o virtual?", "por que tan caro?", "oye no sera estafa?", "es confiable esto?",
  "es legal?", "no me vayas a robar", "y como se que es real?", "tienes testimonios?",
  "puedo pagar despues?", "y si me arrepiento?", "quien eres tu exactamente?",
];
async function suite(nombre, t) {
  console.log(`\n== ${nombre} ==`);
  const p = ph(); await setup(p, t);
  for (const q of PROBES) {
    const r = await bot(p, q);
    ok(!LOOP.test(r) && r.length > 20, `${nombre} | "${q}"`, r.slice(0, 70).replace(/\n/g, " "));
  }
}
(async () => {
  await suite("LLAMADA $800", ["hola", "Soy Pedro, de Colombia", ...Q, "tengo 800 dolares"]);
  await suite("VIP $1500", ["hola", "Soy Carlos, de Colombia", ...Q, "tengo 1500 dolares"]);
  await suite("CLUB $300", ["hola", "Soy Diego, de Colombia", ...Q, "tengo 300 dolares", "si quiero en serio", "si lo quiero, como pago"]);
  console.log(`\n${f === 0 ? "✅ POST-CIERRE OK: 0 loops" : "❌ " + f + " loops/fallos"}`);
  process.exit(f ? 1 : 0);
})();
