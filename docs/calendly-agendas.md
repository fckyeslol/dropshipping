# Calendly → hoja "Agendas" (Zapier o Make)

Cuando alguien **reserva en Calendly**, se crea/llena la fila en la hoja **Agendas** con la
fecha, hora y asesor REALES. El bot ya NO escribe en Agendas (solo en Seguimiento).

> Requiere un plan de Calendly que permita integraciones/webhooks (Standard+). Si el
> formulario de Calendly pide el **teléfono**, agrégalo como pregunta para tenerlo en la hoja.

## Opción A — Zapier (más simple)
1. **Trigger:** Calendly → *"Invitee Created"* (alguien agendó). Conecta tu cuenta de Calendly.
2. *(Opcional)* **Formatter by Zapier → Date/Time** para separar la fecha y la hora del inicio
   del evento, en zona horaria **America/Bogota** (una para "fecha", otra para "hora").
3. **Action:** Google Sheets → *"Create Spreadsheet Row"*.
   - Spreadsheet: **seguimiento-closer** · Worksheet: **Agendas**.
   - Mapea las columnas:

| Columna (Agendas) | Campo de Calendly |
|---|---|
| Fecha en que agendó | *Created At* (cuándo reservó) |
| Nombre | *Invitee Name* (+ *Phone* si lo pides en el form) |
| Fecha de la cita | *Event Start Time* → formato fecha (ej. "12 de junio") |
| Hora de la cita | *Event Start Time* → formato hora (ej. "3:00 pm") |
| Asesor comercial | *Event Host / Organizer* (si usan team/round-robin) |
| Estado | texto fijo: **Agendó** |

4. Publica el Zap. Listo: cada reserva cae sola en Agendas con todos los datos.

## Opción B — Make.com
- Módulo **Calendly → "Watch Events"** (o un webhook de Calendly) como disparador.
- Módulo **Google Sheets → "Add a Row"** a la hoja Agendas, con el mismo mapeo.
- Usa las funciones de fecha de Make (`formatDate`) para fecha y hora en America/Bogota.

## Resultado
- **Seguimiento** (bot): todos los leads + su estado (Nuevo / Agendó / Club).
- **Agendas** (Calendly): solo citas confirmadas, con fecha + hora + asesor reales.
- **Cierres / Tablero**: como hoy (pagos manuales + fórmulas).
