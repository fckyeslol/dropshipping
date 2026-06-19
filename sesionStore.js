// sesionStore.js
// ───────────────────────────────────────────────────────────────
//  Almacén de sesiones de conversación (CAMBIO-05b).
//
//  Problema: con varias réplicas (pods) en Railway, una sesión en memoria
//  vive solo en el pod que la creó; si el siguiente mensaje cae en otro pod,
//  la conversación "se reinicia" (vuelve a pedir nombre/país).
//
//  Solución: si hay REDIS_URL, las réplicas comparten la sesión en Redis.
//  Si NO hay REDIS_URL (o el paquete no está), cae a un Map en memoria —
//  idéntico al comportamiento anterior, sin romper nada.
//
//  La API es async (cargar/guardar/limpiar) para que ambos backends encajen.
// ───────────────────────────────────────────────────────────────

const SESION_TTL_MS = 60 * 60 * 1000; // 1 hora
const SESION_TTL_S = 60 * 60;

function nuevaSesion() {
  return { historial: [], saludado: false, visto: Date.now() };
}

// ── Backend en memoria (default) ──
const mem = new Map();
const memStore = {
  backend: "memoria",
  async cargar(id) {
    let s = mem.get(id);
    if (!s) {
      s = nuevaSesion();
      mem.set(id, s);
    }
    s.visto = Date.now();
    return s;
  },
  async guardar(id, s) {
    mem.set(id, s);
  },
  limpiar() {
    const ahora = Date.now();
    for (const [id, s] of mem) {
      if (ahora - s.visto > SESION_TTL_MS) mem.delete(id);
    }
  },
};

// ── Backend Redis (compartido entre pods) ──
function crearRedisStore(url) {
  let redis;
  try {
    redis = require("redis");
  } catch (_e) {
    console.warn("[sesiones] REDIS_URL definida pero el paquete 'redis' no está instalado; uso memoria.");
    return null;
  }

  const client = redis.createClient({ url });
  let listo = false;
  client.on("error", (e) => console.error("[sesiones] Redis error:", e.message));
  client.on("ready", () => { listo = true; });
  client.connect().catch((e) => console.error("[sesiones] Redis connect:", e.message));

  const clave = (id) => `sesion:${id}`;

  return {
    backend: "redis",
    async cargar(id) {
      if (!listo) return nuevaSesion(); // aún conectando: degradación segura
      try {
        const raw = await client.get(clave(id));
        const s = raw ? JSON.parse(raw) : nuevaSesion();
        s.visto = Date.now();
        return s;
      } catch (e) {
        console.error("[sesiones] Redis cargar:", e.message);
        return nuevaSesion();
      }
    },
    async guardar(id, s) {
      if (!listo) return;
      try {
        await client.set(clave(id), JSON.stringify(s), { EX: SESION_TTL_S });
      } catch (e) {
        console.error("[sesiones] Redis guardar:", e.message);
      }
    },
    limpiar() {
      /* Redis expira solo por TTL (EX); nada que limpiar a mano. */
    },
  };
}

let store = memStore;
if (process.env.REDIS_URL) {
  const r = crearRedisStore(process.env.REDIS_URL);
  if (r) store = r;
}
console.log(`[sesiones] backend: ${store.backend}`);

module.exports = store;
