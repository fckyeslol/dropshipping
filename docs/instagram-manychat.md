# Instagram (DMs) con ManyChat → el cerebro del bot

ManyChat maneja los DMs de Instagram (ya está aprobado por Meta) y **llama al bot** por una API.
Así reutilizamos toda la lógica (calificación, ramas, guiones, tabla, seguimiento). El bot no
"habla" directo con Instagram: ManyChat recibe el DM, le pregunta al bot qué responder, y lo manda.

```
DM en Instagram → ManyChat → POST /api/manychat (el bot decide) → ManyChat manda la respuesta
```

## El contrato de la API (ya está desplegado)

- **URL:** `https://dropshipping-production-2fb2.up.railway.app/api/manychat`
- **Método:** POST · `Content-Type: application/json`
- **Body que ManyChat debe mandar:**
  ```json
  { "usuario": "{{User Id}}", "mensaje": "{{Last Text Input}}", "nombre": "{{First Name}}" }
  ```
- **Respuesta del bot (ManyChat la renderiza como burbujas):**
  ```json
  {
    "version": "v2",
    "content": { "messages": [ { "type": "text", "text": "..." }, { "type": "text", "text": "..." } ] },
    "respuesta": "todo junto por si lo quieres en un solo campo"
  }
  ```

Pruébalo tú mismo (debe devolver el saludo en JSON):
```bash
curl -X POST https://dropshipping-production-2fb2.up.railway.app/api/manychat \
  -H "Content-Type: application/json" -d '{"usuario":"123","mensaje":"hola"}'
```

## Pasos en ManyChat (plan Pro, por el "External Request")

1. **Conecta Instagram**: manychat.com → New → conecta la cuenta de Brayan (@brayanher_) vía Facebook.
   (Tu IG ya es Business y está vinculada a la página de FB, así que esto es directo.)
2. **Automation → Default Reply** (para que TODO DM entre al bot). Abre su flujo.
3. Agrega un paso **External Request** (Actions):
   - Method **POST**, URL la de arriba.
   - Header `Content-Type: application/json`.
   - Body: el JSON de arriba (usa los merge fields de ManyChat: *User Id*, *Last Text Input*, *First Name*).
4. **Renderizar la respuesta**: activa que la respuesta del request se use como **contenido dinámico**
   (ManyChat lee `content.messages` del formato v2 y manda cada mensaje como burbuja).
   - Si tu versión de ManyChat no soporta v2 dinámico, mapea el campo `respuesta` a un campo y
     mándalo con un paso "Send Message".
5. **Set Live**. Listo: cada DM lo atiende Brayan-bot con el mismo flujo de WhatsApp.

## Notas
- **Seguimiento/leads:** el bot ya marca el canal (`instagram`) en la hoja, igual que WhatsApp.
- **Ventana de 24h:** Instagram (vía Meta) solo deja responder libre dentro de 24h del último mensaje
  del usuario. El re-contacto fuera de 24h se hace con las herramientas de ManyChat (recordatorios,
  etiquetas), respetando las reglas de Meta.
- **TikTok:** no tiene API de DMs. Se usa para atraer → link en bio a WhatsApp/IG.
