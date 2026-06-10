/**
 * TABLA DEL SERVICIO 1:1 — E-Master
 * Recibe los POST del bot de WhatsApp (LEAD_WEBHOOK_URL) y agrega una fila
 * por cada persona que AGENDA la llamada (rama "llamada").
 *
 * ── CÓMO INSTALARLO ──────────────────────────────────────────────
 * 1. Crea una hoja en https://sheets.google.com  (ej. "Leads E-Master 1:1").
 * 2. Menú: Extensiones → Apps Script.
 * 3. Borra lo que haya y pega TODO este archivo. Guarda (💾).
 * 4. Implementar → Nueva implementación → tipo "Aplicación web":
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier persona      ← IMPORTANTE
 *    Implementar → autoriza con tu cuenta → copia la "URL de la app web".
 * 5. En Railway → Variables:  LEAD_WEBHOOK_URL = (esa URL)
 * 6. Prueba: abre la URL en el navegador (debe decir "Tabla 1:1 ... lista ✅"),
 *    o agenda una llamada de prueba con el bot y mira que aparezca la fila.
 *
 * ⚠️ Si EDITAS este código luego, debes "Implementar → Gestionar implementaciones
 *    → editar (lápiz) → Versión: Nueva versión → Implementar" para que tome el cambio.
 */

// Columnas de la hoja (orden de izquierda a derecha).
var COLUMNAS = ["Fecha", "Nombre", "Teléfono", "País", "Ocupación", "Capital", "Rama", "Notas", "Evento"];

function doPost(e) {
  try {
    var datos = {};
    if (e && e.postData && e.postData.contents) {
      datos = JSON.parse(e.postData.contents);
    }

    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Encabezados la primera vez.
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(COLUMNAS);
      hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight("bold");
      hoja.setFrozenRows(1);
    }

    // Fecha legible en hora de Colombia.
    var fecha = datos.ts
      ? Utilities.formatDate(new Date(datos.ts), "America/Bogota", "yyyy-MM-dd HH:mm")
      : Utilities.formatDate(new Date(), "America/Bogota", "yyyy-MM-dd HH:mm");

    hoja.appendRow([
      fecha,
      datos.nombre || "",
      datos.telefono || "",
      datos.pais || "",
      datos.ocupacion || "",
      datos.capital || "",
      datos.rama || "",
      datos.notas || "",
      datos.evento || "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Para probar en el navegador.
function doGet() {
  return ContentService.createTextOutput("Tabla 1:1 de E-Master lista ✅");
}
