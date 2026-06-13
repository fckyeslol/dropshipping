// run_all_simulations.js
// Runs all prospect profiles sequentially against the live bot.
// Each gets a unique phone number so the bot treats it as a new conversation.
// Results are saved to profiles/*.txt and a summary CSV.

const API_URL = "https://dropshipping-production-2fb2.up.railway.app/webhook";
const fs = require("fs");
const path = require("path");

const PROFILES_DIR = path.join(__dirname, "..", "profiles");
const RESULTS_DIR = path.join(__dirname, "..", "results");

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

async function simulateOne(profile) {
  const phone = "whatsapp:+1555" + Math.floor(1000000 + Math.random() * 8999999);
  const lines = [];
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
  let lastResponses = [];
  let outcome = "unknown";

  for (let i = 0; i < script.length; i++) {
    const step = script[i];
    const userMessage = typeof step === "string" ? step : step.message;

    log(`\n--- Turn ${i + 1} ---`);
    log(`>>> USER: ${userMessage}`);

    const body = new URLSearchParams({ Body: userMessage, From: phone });
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const xml = await res.text();
    let responses = [...xml.matchAll(/<Message>(.*?)<\/Message>/gs)].map((m) => m[1].trim()).filter(Boolean);

    if (responses.length === 0 && i === 0) {
      log("(saludo diferido activo — esperando respuesta...)");
      // The bot has a 20-45s delay on first message. Wait up to 60s.
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

    lastResponses = responses;

    for (const r of responses) {
      log(`<<< BOT: ${r}`);
    }
    log("");

    // Detect outcome
    for (const r of responses) {
      const rl = r.toLowerCase();
      if (rl.includes("calendly.com")) {
        outcome = "llamada_agendada";
      } else if (rl.includes("skool.com")) {
        outcome = "club_enviado";
      } else if (rl.includes("youtu.be") && (rl.includes("gratis") || rl.includes("canal"))) {
        outcome = "video_gratis";
      }
    }

    // Human-like delay between turns
    await sleep(2000 + Math.random() * 3000);
  }

  log(`\n=== FINAL OUTCOME: ${outcome} ===`);
  log(`Total turns: ${script.length}`);

  // Save result file
  const resultFile = path.join(RESULTS_DIR, profile.file.replace(".json", ".txt"));
  fs.writeFileSync(resultFile, lines.join("\n"), "utf-8");

  return {
    name: profile.name,
    profile: profile.profile,
    turns: script.length,
    outcome,
    phone: phone,
  };
}

async function main() {
  console.log(`\n=== Running ${profiles.length} simulations ===\n`);
  const results = [];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    console.log(`\n📱 [${i + 1}/${profiles.length}] ${p.name}`);
    try {
      const result = await simulateOne(p);
      results.push(result);
    } catch (err) {
      console.error(`❌ Failed: ${p.name} — ${err.message}`);
      results.push({ name: p.name, profile: p.profile, turns: p.script.length, outcome: `ERROR: ${err.message}`, phone: "N/A" });
    }
    // Wait between profiles to avoid rate limiting
    await sleep(5000);
  }

  // Write summary CSV
  const csvLines = ["profile,turns,outcome,notes"];
  for (const r of results) {
    csvLines.push(`"${r.name}",${r.turns},"${r.outcome}","${r.profile}"`);
  }
  const csvPath = path.join(RESULTS_DIR, "summary.csv");
  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");

  console.log("\n========================================");
  console.log("📊 ALL SIMULATIONS COMPLETE");
  console.log("========================================");
  for (const r of results) {
    const icon = r.outcome === "llamada_agendada" ? "📞" : r.outcome === "club_enviado" ? "🏠" : r.outcome === "video_gratis" ? "🎬" : "❓";
    console.log(`${icon} ${r.name}: ${r.outcome}`);
  }
  console.log(`\nSummary saved to: ${csvPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
