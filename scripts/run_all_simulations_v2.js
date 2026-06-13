// run_all_simulations_v2.js
// Extended simulation runner — runs each profile until the bot delivers a link
// (Calendly, Skool, YouTube free video) or hits 20 turns.

const API_URL = "https://dropshipping-production-2fb2.up.railway.app/webhook";
const fs = require("fs");
const path = require("path");

const PROFILES_DIR = path.join(__dirname, "..", "profiles");
const RESULTS_DIR = path.join(__dirname, "..", "results");
const MAX_TURNS = 20;
const DELAY_BETWEEN_MS = 2000;

const profiles = fs.readdirSync(PROFILES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({
    file: f,
    ...JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, f), "utf-8")),
  }));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function detectOutcome(responses) {
  for (const r of responses) {
    const rl = r.toLowerCase();
    if (rl.includes("calendly.com")) return "llamada_agendada";
    if (rl.includes("skool.com")) return "club_enviado";
    if (rl.includes("youtu.be")) return "video_gratis";
  }
  return null;
}

function detectErrors(responses, history, profileName) {
  const issues = [];
  const allText = responses.join(" ").toLowerCase();
  const userText = history.map(m => m.content?.toLowerCase() || "").join(" ");

  // 1. Gender mismatch: female prospect + male-gendered words from bot
  const isFemale = profileName.includes("(Venezuela") || profileName.includes("(Chile") || profileName.includes("(México");
  if (isFemale) {
    const maleTerms = ["listo", "interesado", "decidido", "bienvenido", "hermano", "bro"];
    for (const term of maleTerms) {
      if (allText.includes(term) && !allText.includes(term.replace("o", "a"))) {
        // Only flag if the bot used male term but NOT the female version
        issues.push(`Gender issue: bot used "${term}" (male form) for a female prospect`);
        break;
      }
    }
  }

  // 2. Bot mentions club/Skool/$34 to someone who qualified for call
  if (/(club|skool|\$ ?34|34 d[oó]lares)/i.test(allText)) {
    // Check if user said they have $600+
    const hasHighCapital = /\b(\$?[6-9]\d{2,}|1\d{3,})\b/.test(userText);
    if (hasHighCapital) {
      issues.push("Rama cruzada: bot mentioned club/Skool to someone with $600+ capital");
    }
  }

  // 3. Bot mentions call/Calendly to someone with < $600
  if (/(llamada|reuni[oó]n|calendly|agendar)/i.test(allText)) {
    const hasLowCapital = /\b\$?[1-5]\d{2}\b/.test(userText) && !/\b(\$?[6-9]\d{2,}|1\d{3,})\b/.test(userText);
    if (hasLowCapital) {
      issues.push("Rama cruzada: bot mentioned call/meeting to someone with < $600 capital");
    }
  }

  // 4. Bot says "te falta" or asks to "consigue el resto" to someone with $600+
  if (/(te faltan?|lo que falta|consigue|est[aá]s cerca)/i.test(allText)) {
    const hasHighCapital = /\b(\$?[6-9]\d{2,}|1\d{3,})\b/.test(userText);
    if (hasHighCapital) {
      issues.push("Cebo: bot told someone with $600+ 'te falta' or 'consigue el resto'");
    }
  }

  // 5. Bot says "voy a agendarte" / "un segundo" / "te mando el link" instead of calling the tool
  if (/(voy|vamos|va) a agendar|te (la|lo) agendo|(ya|ahora) (te )?agendo|dame un segundo|un momento|te (env[ií]o|mando|paso) el (link|enlace)/i.test(allText)) {
    if (!responses.some(r => /calendly\.com|skool\.com|youtu\.be/i.test(r))) {
      issues.push("Anuncio sin entrega: bot announced it would do something but delivered no link");
    }
  }

  // 6. Bot says "vuelve a escribir" or reinicia the conversation
  if (/(vuelve|reiniciamos|empieza de nuevo|borro|chat nuevo)/i.test(allText)) {
    issues.push("Reinicio: bot asked to restart the conversation");
  }

  // 7. Bot asked for country again after already having it
  const countryAskedCount = (allText.match(/pa[íi]s/g) || []).length;
  if (countryAskedCount > 1) {
    issues.push("Repetición: bot asked for country more than once (or insisted)");
  }

  // 8. Bot uses emojis (blocked in system prompt)
  const emojis = allText.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu);
  if (emojis && emojis.length > 0) {
    issues.push(`Emoji violación: bot used ${emojis.length} emoji(s) despite rules`);
  }

  return issues;
}

async function simulateOne(profile) {
  const phone = "whatsapp:+1555" + Math.floor(1000000 + Math.random() * 8999999);
  const lines = [];
  const history = [];

  function log(msg) {
    console.log(`[${profile.name}] ${msg}`);
    lines.push(msg);
  }

  log("========================================");
  log(`PROFILE: ${profile.name}`);
  log(`PHONE: ${phone}`);
  log(`PROFILE DATA: ${profile.profile}`);
  log("========================================");

  const { script } = profile;
  let outcome = "unknown";
  let finalOutcomeTurn = -1;
  let errors = [];
  let lastBotLines = [];

  for (let i = 0; i < Math.max(script.length, MAX_TURNS); i++) {
    // If we already delivered a link, stop
    if (outcome !== "unknown") break;
    if (i >= MAX_TURNS) {
      log(`\n⚠️ MAX TURNS REACHED (${MAX_TURNS}) without link delivery`);
      break;
    }

    const userMessage = i < script.length
      ? (typeof script[i] === "string" ? script[i] : script[i].message)
      : "Sí, sigo interesado"; // fallback continuing message

    log(`\n--- Turn ${i + 1} ---`);
    log(`>>> USER: ${userMessage}`);
    history.push({ role: "user", content: userMessage });

    const body = new URLSearchParams({ Body: userMessage, From: phone });
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const xml = await res.text();
    let responses = [...xml.matchAll(/<Message>(.*?)<\/Message>/gs)].map((m) => m[1].trim()).filter(Boolean);

    // Saludo diferido: first message may have a 20-45s delay
    if (responses.length === 0 && i === 0) {
      log("(saludo diferido activo — esperando...)");
      for (let w = 0; w < 120; w++) {
        await sleep(500);
        const retryBody = new URLSearchParams({ Body: "...", From: phone });
        const retryRes = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: retryBody,
        });
        const retryXml = await retryRes.text();
        const retryParts = [...retryXml.matchAll(/<Message>(.*?)<\/Message>/gs)].map((m) => m[1].trim()).filter(Boolean);
        if (retryParts.length > 0) {
          responses = retryParts;
          break;
        }
      }
    }

    lastBotLines = responses;

    for (const r of responses) {
      log(`<<< BOT: ${r}`);
      history.push({ role: "assistant", content: r });
    }

    // Check outcome
    const detected = detectOutcome(responses);
    if (detected) {
      outcome = detected;
      finalOutcomeTurn = i + 1;
      log(`\n*** ✅ OUTCOME: ${outcome} (turn ${finalOutcomeTurn}) ***`);
    }

    // Detect errors after turn
    const turnErrors = detectErrors(responses, history.slice(-6), profile.name);
    for (const err of turnErrors) {
      if (!errors.includes(err)) {
        errors.push(err);
        log(`⚠️ ISSUE: ${err}`);
      }
    }

    await sleep(DELAY_BETWEEN_MS + Math.random() * 2000);
  }

  // Analyze the conversation quality
  log(`\n=== FINAL OUTCOME: ${outcome} (turn ${finalOutcomeTurn}) ===`);
  log(`Scripted turns: ${script.length}, Total turns used: ${finalOutcomeTurn > 0 ? finalOutcomeTurn : script.length}`);

  if (errors.length > 0) {
    log(`\n⚠️  ISSUES FOUND (${errors.length}):`);
    for (const err of errors) {
      log(`  - ${err}`);
    }
  } else {
    log("\n✅ No issues detected");
  }

  // Save result file
  const resultFile = path.join(RESULTS_DIR, profile.file.replace(".json", ".txt"));
  fs.writeFileSync(resultFile, lines.join("\n"), "utf-8");

  return {
    name: profile.name,
    profile: profile.profile,
    outcome,
    turns: finalOutcomeTurn > 0 ? finalOutcomeTurn : script.length,
    errors,
  };
}

async function main() {
  console.log(`\n=== Running ${profiles.length} simulations (v2 - extended) ===\n`);
  const results = [];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    console.log(`\n📱 [${i + 1}/${profiles.length}] ${p.name}`);
    console.log("─".repeat(60));
    try {
      const result = await simulateOne(p);
      results.push(result);
    } catch (err) {
      console.error(`❌ Failed: ${p.name} — ${err.message}`);
      results.push({ name: p.name, profile: p.profile, outcome: `ERROR: ${err.message}`, turns: 0, errors: [] });
    }
    await sleep(5000);
  }

  // Write summary
  const csvLines = ["profile,turns,outcome,issues,notes"];
  for (const r of results) {
    const issuesStr = r.errors?.length > 0 ? r.errors.join("; ") : "none";
    csvLines.push(`"${r.name}",${r.turns},"${r.outcome}","${issuesStr}","${r.profile}"`);
  }
  const csvPath = path.join(RESULTS_DIR, "summary-v2.csv");
  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");

  // Print final results
  console.log("\n\n" + "=".repeat(70));
  console.log("📊 ALL SIMULATIONS COMPLETE");
  console.log("=".repeat(70));
  let passed = 0, failed = 0;
  for (const r of results) {
    const icon = r.outcome === "llamada_agendada" ? "📞" : r.outcome === "club_enviado" ? "🏠" : r.outcome === "video_gratis" ? "🎬" : "❌";
    const hasErrors = r.errors?.length > 0 ? ` ⚠️${r.errors.length} issue(s)` : "";
    const isGood = r.outcome !== "unknown" && r.errors?.length === 0;
    if (isGood) passed++; else failed++;
    console.log(`${icon} ${r.name}: ${r.outcome} (${r.turns} turns)${hasErrors}`);
  }
  console.log(`\n✅ Passed: ${passed} | ❌ Issues: ${failed}`);
  console.log(`\nDetailed results saved to: ${csvPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
