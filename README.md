# Bot de WhatsApp · E-Master Project (Brayan Hernández)

Bot que atiende por WhatsApp a los interesados en el programa de Brayan, los **califica** (entiende su caso) y los lleva a **agendar una llamada** con el equipo. Habla como una persona real del equipo —nunca como un bot— con mensajes cortos y tono cercano.

No vende ni da precios por chat: su trabajo es **conectar, generar confianza con los resultados reales, resolver dudas y agendar la llamada**, que es donde se cierra.

```
Interesado escribe  →  el equipo saluda  →  conversa y califica
                    →  conecta su caso con testimonios reales
                    →  resuelve objeciones  →  AGENDA la llamada
```

---

## 📁 Archivos (qué edita cada uno)

| Archivo            | Para qué sirve |
|--------------------|----------------|
| `knowledge.js`     | **La base de conocimiento.** Todo lo que el bot sabe de E-Master (qué es, qué incluye, testimonios, objeciones). El bot SOLO responde con esto; no inventa. |
| `oferta.js`        | El **saludo**, el resumen del programa y las **preguntas para calificar**. |
| `resultados.js`    | El bloque de **testimonios/resultados** (y, cuando los tengas, los links de YouTube). |
| `agenda.js`        | El **link para agendar** la llamada y la captura de leads (logs / tu CRM). |
| `llm.js`           | El "cerebro": la **personalidad** del setter y las reglas. |
| `index.js`         | El servidor que recibe los mensajes de Twilio y responde. |
| `parse_whatsapp.js`| Minador de tus **chats reales** para mejorar las respuestas. |
| `.env.example`     | Plantilla de variables (Twilio, IA, link de agenda). |
| `test.js`          | Prueba la lógica sin Twilio. |

> Para cambiar lo que el bot sabe o cómo habla, editas `knowledge.js`, `oferta.js` y `resultados.js`. Casi nunca necesitas tocar `index.js`.

---

## ⚙️ Lo que TIENES que completar (marcadores)

El bot ya funciona, pero hay datos reales que debes poner cuando los tengas:

1. **Link de agenda** → variable `BOOKING_LINK` (Calendly, Cal.com, Google Form o un `wa.me` a un asesor). Sin él, el bot toma los datos y dice que el equipo contacta a la persona.
2. **Precio / planes** → **a propósito NO están**. El bot nunca da precio; deriva a la llamada. (Si algún día quieres que sí los diga, se agregan en `knowledge.js`.)
3. **Links de testimonios en YouTube** → en `resultados.js`, campo `video` de cada caso.
4. **Contacto/redes** → en `knowledge.js` (`DATOS`): Instagram ya está; web/email si aplican.

---

## 🚀 Puesta en marcha (igual que el otro bot)

### 1. Twilio Sandbox de WhatsApp (gratis, para probar)
- Crea cuenta en <https://www.twilio.com/try-twilio>.
- Consola → **Messaging → Try it out → Send a WhatsApp message**.
- Activa el **Sandbox**: te da un número (ej. `+1 415 523 8886`) y un código `join algo-algo`. Envía ese código desde tu WhatsApp para vincularte.

### 2. Subir el código a GitHub
- Crea un repo y sube esta carpeta **menos** `.env` y `data/` (ya están en `.gitignore`).

### 3. Desplegar en Railway ($5/mes, no se "duerme")
- <https://railway.app> → **New Project → Deploy from GitHub repo**.
- Railway detecta Node solo (usa `npm install` + `npm start`). No fijes `PORT`.
- En **Variables**, agrega lo del `.env.example` que vayas a usar (mínimo `OPENAI_API_KEY`; y `TWILIO_*` + `BOOKING_LINK` cuando los tengas).
- **Settings → Networking → Generate Domain** → te da una URL pública.

### 4. Conectar Twilio con tu servidor
- En la config del Sandbox, campo **"When a message comes in"** pega:
  ```
  https://TU-URL.up.railway.app/webhook
  ```
  Método **HTTP POST**. Guarda.

### 5. Probar
- Escribe **"Hola"** al número del sandbox y sigue la conversación. 🎉

---

## 🧪 Probar localmente

```bash
npm install
npm test       # verifica la lógica (saludo, resultados, respaldo)
npm start      # levanta el servidor en http://localhost:3000
```

Simular un mensaje entrante:

```bash
curl -X POST http://localhost:3000/webhook --data-urlencode "Body=Hola"
```

> Sin `OPENAI_API_KEY`, las preguntas libres caen al saludo de respaldo (no se rompe). Con la key, ya responde el setter de verdad.

---

## 🤖 La IA (OpenAI o DeepSeek)

Las respuestas humanas las da un **LLM anclado** a `knowledge.js` (no inventa). Funciona con **OpenAI** o **DeepSeek** (mismo SDK; DeepSeek es más económico para volumen).

- **OpenAI:** `OPENAI_API_KEY=sk-...` y `OPENAI_MODEL=gpt-4o-mini`.
- **DeepSeek:** `OPENAI_API_KEY=sk-...`, `OPENAI_BASE_URL=https://api.deepseek.com`, `OPENAI_MODEL=deepseek-v4-flash`.

El bot calcula que la persona quiere agendar y usa la herramienta `agendar_llamada` para entregar el link y registrar el lead.

---

## 👤 Captura de leads

Cada vez que alguien agenda, el lead se guarda en los **logs**. Si pones `LEAD_WEBHOOK_URL` (Google Apps Script, Make, Zapier, n8n o tu CRM), el bot le hace `POST` con los datos para que caigan en una hoja/CRM automáticamente.

---

## 📈 Mejorar el bot con tus chats reales

Lo que hace que cierre como tú es entrenar el contenido con **tus conversaciones reales**:
1. Exporta chats de ventas (ver `data/LEEME.txt`) y déjalos en `data/`.
2. Corre `node parse_whatsapp.js`.
3. Revisa `data/salida/interesados_detectados.csv`: ahí están las dudas, objeciones y respuestas que funcionan.
4. Pega las mejores en `knowledge.js` (como nuevos chunks) y ajusta el tono en `llm.js`.

---

## ⚠️ Nota importante (responsable)

El bot **no promete ingresos** ni resultados como seguros: habla de lo que ofrece el programa y de **casos reales**, y aclara que los resultados dependen de cada persona. Esto protege la marca y es lo correcto. Si necesitas un texto legal/condiciones específico, agrégalo en `knowledge.js`.
