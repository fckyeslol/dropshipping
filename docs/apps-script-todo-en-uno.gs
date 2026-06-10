/**
 * E-MASTER — TODO EN UNO (un spreadsheet, dos pestañas, UNA sola URL)
 *
 *   • Pestaña "Leads 1:1"   → los que AGENDAN la llamada (nombre, tel, ocupación, capital).
 *   • Pestaña "Seguimiento" → TODOS los contactos (sin_agendar / agendó / club), 1 fila por persona.
 *
 * El script reparte solo según lo que llega: si el dato trae "estado" → Seguimiento; si no → Lead 1:1.
 *
 * ── INSTALAR ──────────────────────────────────────────────────────
 * 1. Crea una hoja NUEVA en sheets.google.com (ej. "E-Master CRM").
 * 2. Extensiones → Apps Script. Borra todo y pega ESTE archivo. Guarda (💾).
 * 3. Implementar → Nueva implementación → Aplicación web:
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier persona     ← IMPORTANTE
 *    Implementar → autoriza → copia la URL de la app web.
 * 4. En Railway → Variables, pon la MISMA URL en las dos:
 *      LEAD_WEBHOOK_URL        = (esa URL)
 *      SEGUIMIENTO_WEBHOOK_URL = (la misma URL)
 * 5. Las pestañas "Leads 1:1" y "Seguimiento" se crean solas con el primer dato.
 *    Puedes borrar la pestaña vacía "Hoja 1" que viene por defecto.
 *
 * ⚠️ Si editas el código luego: Implementar → Gestionar implementaciones →
 *    editar (lápiz) → Versión: Nueva versión → Implementar.
 */

var COL_LEADS = ["Fecha", "Nombre", "Teléfono", "País", "Ocupación", "Capital", "Rama", "Notas", "Evento"];
var COL_SEG = ["Teléfono", "Nombre", "Estado", "Primer contacto", "Actualizado", "Seguimiento enviado"];

function doPost(e) {
  try {
    var datos = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ahora = datos.ts
      ? Utilities.formatDate(new Date(datos.ts), "America/Bogota", "yyyy-MM-dd HH:mm")
      : Utilities.formatDate(new Date(), "America/Bogota", "yyyy-MM-dd HH:mm");

    if (datos.estado) guardarSeguimiento(ss, datos, ahora); // trae "estado" → seguimiento
    else guardarLead(ss, datos, ahora);                     // si no → lead del 1:1

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Devuelve la pestaña (creándola con encabezados si no existe).
function hoja(ss, nombre, cols) {
  var h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.appendRow(cols);
    h.getRange(1, 1, 1, cols.length).setFontWeight("bold");
    h.setFrozenRows(1);
  }
  return h;
}

function guardarLead(ss, datos, ahora) {
  var h = hoja(ss, "Leads 1:1", COL_LEADS);
  h.appendRow([
    ahora, datos.nombre || "", datos.telefono || "", datos.pais || "",
    datos.ocupacion || "", datos.capital || "", datos.rama || "",
    datos.notas || "", datos.evento || ""
  ]);
}

function guardarSeguimiento(ss, datos, ahora) {
  var h = hoja(ss, "Seguimiento", COL_SEG);
  var tel = String(datos.telefono || "").trim();
  var estado = String(datos.estado || "sin_agendar").trim();
  var nombre = String(datos.nombre || "").trim();

  // Buscar la fila de esa persona (por teléfono) para ACTUALIZAR, no duplicar.
  var fila = 0;
  if (tel && h.getLastRow() > 1) {
    var tels = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < tels.length; i++) {
      if (String(tels[i][0]).trim() === tel) { fila = i + 2; break; }
    }
  }

  var esConversion = (estado === "agendo" || estado === "club");
  if (fila > 0) {
    var actual = String(h.getRange(fila, 3).getValue()).trim();
    var yaConvirtio = (actual === "agendo" || actual === "club");
    if (esConversion || !yaConvirtio) h.getRange(fila, 3).setValue(estado); // no baja de agendó/club
    h.getRange(fila, 5).setValue(ahora);
    if (nombre && !String(h.getRange(fila, 2).getValue()).trim()) h.getRange(fila, 2).setValue(nombre);
  } else {
    h.appendRow([tel, nombre, estado, ahora, ahora, ""]);
  }
}

function doGet() {
  return ContentService.createTextOutput("E-Master CRM (Leads 1:1 + Seguimiento) listo ✅");
}
