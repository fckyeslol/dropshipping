# Estado del proyecto y pendientes

Bot de ventas con IA (persona Brayan) — multicanal WhatsApp + Instagram.

## ✅ Listo (del lado del bot / código)
- Bot conversacional: persona Brayan, calificación, ramificación por capital.
- Cierre doble: **Calendly** (≥ $1.000) / **club Upgrade Project $34** (< $1.000).
- Guiones casi al pie de la letra + 10 objeciones (RAG).
- Mensajes humanos (se parten los largos en varias burbujas).
- Captura de leads → Google Sheets, marcada por **canal** (whatsapp / instagram).
- Base de **seguimiento** (primer contacto `sin_agendar` → `agendó`/`club`).
- **WhatsApp** funcionando (Twilio).
- **Instagram**: endpoint `/api/manychat` listo y probado en vivo.
- Tarjeta **Nequi**: el bot la comparte si defines `NEQUI_VIDEO_URL`.
- Desplegado en Railway, auto-deploy desde GitHub.

## 👤 Falta de tu lado (cuentas / accesos / aprobaciones)
1. **Instagram en ManyChat** *(la pieza grande que falta)*
   - Cuenta **ManyChat Pro** (~$15/mes) — necesaria para el *External Request*.
   - Conectar la IG de Brayan.
   - Armar **1 flujo**: Default Reply → External Request a `/api/manychat` → render v2.
   - Guía: `docs/instagram-manychat.md`. Config exacta lista para copiar.
2. **Google Sheets (CRM)** — desplegar `docs/apps-script-todo-en-uno.gs` y poner su URL en `LEAD_WEBHOOK_URL` **y** `SEGUIMIENTO_WEBHOOK_URL`. *(El de 1:1 ya lo tienes andando.)*
3. **Audio del saludo** *(opcional)* — subir el `.ogg` a `public/` + `SALUDO_AUDIO_URL`.
4. **Video Nequi** *(opcional)* — `NEQUI_VIDEO_URL` con el link del video.
5. **WhatsApp de producción** — salir del Sandbox de Twilio (número propio + Meta Business). El Sandbox topa el volumen real.
6. **Seguimiento 24h** — automatización (Make/Zapier) + **plantillas aprobadas por Meta**. Textos listos en `docs/seguimiento-mensajes.md`.

## 💡 Opcional (no urgente)
- Capturar la hora agendada en la tabla → **no hace falta**: Calendly ya te avisa la hora de cada reserva.

## Variables de entorno (Railway) — resumen
| Variable | ¿Para qué? | ¿Obligatoria? |
|---|---|---|
| `OPENAI_API_KEY` | El cerebro (IA) | Sí |
| `TWILIO_*` | WhatsApp | Sí (WA) |
| `BOOKING_LINK` | Calendly | Sí |
| `CLUB_LINK` | Skool (club) | Sí |
| `LEAD_WEBHOOK_URL` | Tabla 1:1 | Recomendada |
| `SEGUIMIENTO_WEBHOOK_URL` | Tabla seguimiento | Recomendada |
| `SALUDO_AUDIO_URL` | Audio del saludo | Opcional |
| `NEQUI_VIDEO_URL` | Video Nequi (club/CO) | Opcional |
