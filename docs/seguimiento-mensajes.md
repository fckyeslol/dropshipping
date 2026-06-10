# Mensajes de seguimiento / re-contacto (24h)

Estos son los textos para re-contactar a quien **no agendó / no entró al club**. El bot ya
reporta a la hoja de *Seguimiento* (`estado: sin_agendar`); una automatización (Make/Zapier)
los manda a las 24h. Como son mensajes **proactivos** (fuera de la ventana de 24h de WhatsApp),
deben ir como **plantillas aprobadas por Meta** en Twilio/Meta. En Instagram los manda ManyChat.

> Copia estos textos al crear tus plantillas. Reemplaza `{{nombre}}` por la variable de la plantilla.

---

## Rama CLUB — urgencia (quien vio el club y no entró)

**Seguimiento 1 (a las ~24h):**
> Bro, esto es un programa exclusivo, no trabajo con cualquiera. Si decides que es lo que buscas, solo tienes 24 horas para ingresar. ¿Le entras?

**Seguimiento 2 (vence hoy):**
> De una, {{nombre}}: recuerda que tu acceso vence hoy. Es un programa solo para los más comprometidos, que pasaron el proceso de admisión. ¡A darle! 🔥

**Pasos de ingreso (cuando va a pagar):**
> Le das en *Join*, creas tu usuario, llenas tus datos, pones la tarjeta y listo: ¡estás dentro! Estoy atento al comprobante para darte la bienvenida que te mereces.

---

## Rama LLAMADA (1:1) — quien no agendó

**Seguimiento 1:**
> {{nombre}}, te dejé el link para agendar la llamada con el equipo. ¿Lo viste? Avísame y te aparto el cupo.

**Seguimiento 2:**
> Dime si sigues interesado para apartarte el puesto. Los cupos son limitados y se llenan rápido.

---

## Genéricos (sirven para ambas ramas)

- "Avísame apenas lo revises para activarte el acceso."
- "Te dejé toda la info lista, solo falta que me confirmes."
- "¿Seguimos? Cuéntame qué te detiene y lo resolvemos."

---

## Lógica de la automatización (Make / Zapier / Apps Script con trigger de tiempo)
1. Una vez al día, revisa la hoja **Seguimiento**.
2. Filtra filas con `Estado = sin_agendar` **y** `Actualizado` de hace +24h **y** `Seguimiento enviado` vacío.
3. Manda la **plantilla** correspondiente (por su canal: WhatsApp/Twilio o Instagram/ManyChat).
4. Marca `Seguimiento enviado = sí` (o la fecha).
