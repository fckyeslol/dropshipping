// simulate_prospect.js
// Single prospect simulator — talks to the live bot API endpoint.
// Usage: node scripts/simulate_prospect.js <profile-json-file> > results/log-profile-name.txt

const API_URL = "https://dropshipping-production-2fb2.up.railway.app/webhook";
const fs = require("fs");
const path = require("path");

const profileFile = process.argv[2];
if (!profileFile) {
  console.error("Usage: node scripts/simulate_prospect.js <profile-json-file>");
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(profileFile, "utf-8"));
const FROM = "whatsapp:+1555" + Math.floor(1000000 + Math.random() * 8999999);

function log(msg) {
  console.log(`[${profile.name}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendMessage(text) {
  const body = new URLSearchParams({ Body: text, From: FROM });
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const xml = await res.text();
  const parts = [...xml.matchAll(/<Message>(.*?)<\/Message>/gs)].map((m) => m[1].trim()).filter(Boolean);
  return parts;
}

async function run() {
  log("=== Starting simulation ===");
  log(`Profile: ${JSON.stringify(profile, null, 2)}`);
  log("");

  const { script } = profile;
  let lastResponse = [];

  for (let i = 0; i < script.length; i++) {
    const step = script[i];
    const userMessage = typeof step === "string" ? step : step.message;

    log(`>>> USER: ${userMessage}`);
    const responses = await sendMessage(userMessage);
    lastResponse = responses;

    if (responses.length === 0) {
      log("(no immediate response - waiting for delayed saludo...)");
      // Wait up to 50s for the delayed greeting
      for (let w = 0; w < 100; w++) {
        await sleep(500);
        const retry = await sendMessage("...");
        if (retry.length > 0) {
          responses.push(...retry);
          break;
        }
      }
    }

    for (const r of responses) {
      log(`<<< BOT: ${r}`);
    }
    log("");

    // Wait between messages to feel human
    await sleep(1500 + Math.random() * 2000);

    // Check for tool outcomes in response
    for (const r of responses) {
      if (r.includes("calendly.com")) {
        log("*** ✅ OUTCOME: AGENDED CALL (Calendly link delivered) ***");
      }
      if (r.includes("skool.com")) {
        log("*** ✅ OUTCOME: CLUB LINK DELIVERED (Skool) ***");
      }
      if (r.includes("youtu.be") && (r.includes("gratis") || r.includes("free"))) {
        log("*** ✅ OUTCOME: FREE VIDEO DELIVERED (no money route) ***");
      }
    }
  }

  log("=== Simulation complete ===");
  log(`Total turns: ${script.length}`);
  log(`Last bot response: ${lastResponse.join(" | ")}`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
