# Bot de WhatsApp · E-Master (habla como Brayan)

Bot que atiende por WhatsApp **como Brayan Hernández** (primera persona), sigue su workflow de ventas, **califica** a la persona y, según su capital, la lleva a una de **dos** salidas:

```
Entra un interesado → pide nombre → "¿A qué te dedicas?"
   │
   ├─ CALIFICA (si trabaja: interés → objetivo → bloqueo → capital)
   │           (si estudia/no trabaja: ingreso fijo → con cuánto cuenta)
   │
   └─ RAMIFICA POR CAPITAL
        • ≥ $1,000 USD  → AGENDA llamada (Calendly)     ← programa grande, se cierra en la llamada
        • < $1,000 USD  → CLUB Upgrade Project ($34/mes, Skool)
```

Maneja objeciones con tus guiones (caro, no tengo dinero, lo voy a pensar, hablarlo con la pareja, etc.) y siempre reencauza al cierre.

---

## 📁 Archivos (qué edita cada uno)

| Archivo         | Para qué sirve |
|-----------------|----------------|
| `guion.js`      | **Toda la copy**, casi al pie de la letra de tu workflow: saludo, apertura, /inversión, puente, presentación del club y los bloques con los links. **Aquí editas los textos.** |
| `knowledge.js`  | Datos reales (Brayan, E-Master, el club, el mínimo de $1.000) **+ los 10 guiones de objeciones** (se traen solos cuando la persona objeta). |
| `acciones.js`   | Las 2 acciones finales: `agendarLlamada` (Calendly) y `enviarClub` (Skool) + captura de leads (logs / tu CRM). |
| `llm.js`        | El cerebro: la personalidad de Brayan y el flujo paso a paso. |
| `index.js`      | El servidor que recibe los mensajes de Twilio y responde. |
| `parse_whatsapp.js` | Minador de tus chats reales para afinar la copy. |
| `.env.example`  | Plantilla de variables (Twilio, IA, los 2 links). |

> Para cambiar lo que dice el bot, editas **`guion.js`** (copy) y **`knowledge.js`** (datos + objeciones).

---

## ⚙️ Lo que tienes que poner (variables en Railway)

| Variable | Qué es |
|----------|--------|
| `OPENAI_API_KEY` | Tu key de OpenAI (o DeepSeek). **Obligatoria** para que converse. |
| `BOOKING_LINK` | Link de **Calendly** (rama ≥ $1.000). Hoy está tu Calendly de prueba; pon el de E-Master cuando quieras. |
| `CLUB_LINK` | Link del **club en Skool** (rama < $1.000). |
| `TWILIO_*` | Cuenta + número de WhatsApp de Twilio. |
| `LEAD_WEBHOOK_URL` | *(opcional)* URL para mandar cada lead a tu hoja/CRM. |

Si `BOOKING_LINK` / `CLUB_LINK` quedan vacíos, el bot usa los del guion por defecto.

---

## 🚀 Puesta en marcha

1. **Twilio Sandbox** → Messaging → Try it out → Send a WhatsApp message → activa el sandbox y vincula tu número con `join <código>`.
2. **GitHub + Railway**: sube esta carpeta (menos `.env` y `data/`), conéctala en Railway, agrega las Variables de arriba.
3. **Webhook de Twilio**: en *Sandbox settings* → "When a message comes in" pon `https://TU-URL.up.railway.app/webhook` (método **POST**).
4. Escríbele **"Hola"** y sigue la conversación.

> Verifica que está vivo abriendo la URL raíz: debe decir *"Bot de WhatsApp de E-Master ... activo ✅ (v6-workflow)"*.

---

## 🧪 Probar localmente

```bash
npm install
npm test       # lógica básica sin Twilio ni IA
npm start      # servidor en http://localhost:3000
```

Sin `OPENAI_API_KEY`, las preguntas libres caen al saludo de respaldo (no se rompe). Con la key, conversa el flujo completo.

---

## 🤖 La IA (OpenAI o DeepSeek)

La conversación la lleva un LLM **anclado** a `knowledge.js` (no inventa). Funciona con **OpenAI** (`OPENAI_MODEL=gpt-4o-mini`) o **DeepSeek** (`OPENAI_BASE_URL=https://api.deepseek.com`, `OPENAI_MODEL=deepseek-v4-flash`, más económico).

Los **links salen exactos** porque los entregan las herramientas (`acciones.js`), no la IA. Cada cierre registra el lead con su rama (`llamada` o `club`).

---

## 📈 Afinar con tus chats reales

1. Exporta chats de ventas (ver `data/LEEME.txt`) → carpeta `data/`.
2. `node parse_whatsapp.js` → revisa `data/salida/interesados_detectados.csv`.
3. Pega las mejores respuestas/objeciones en `guion.js` y `knowledge.js`.

---

## ⚠️ Nota

El bot habla como Brayan en primera persona y maneja precios/objeciones según tu guion. Mantiene una regla: **no promete ingresos como seguros** (habla de casos reales y de lo que entregas). Ajusta los textos en `guion.js` cuando quieras.
