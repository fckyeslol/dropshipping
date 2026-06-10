/**
 * TABLA DE SEGUIMIENTO — E-Master
 * Recibe los POST del bot (SEGUIMIENTO_WEBHOOK_URL): el PRIMER contacto de cada
 * persona (estado "sin_agendar") y luego su conversión ("agendo" / "club").
 *
 * NO duplica: busca por teléfono y ACTUALIZA el estado de esa persona.
 * Así, los que sigan en "sin_agendar" después de 24h son a quienes hay que
 * re-contactar (eso lo hace tu automatización, Make/Zapier, con plantillas de Meta).
 *
 * ── INSTALARLO (igual que la tabla del 1:1, pero en OTRA hoja) ──
 * 1. Crea OTRA hoja en sheets.google.com (ej. "Seguimiento E-Master").
 * 2. Extensiones → Apps Script. Pega TODO esto. Guarda.
 * 3. Implementar → Nueva implementación → Aplicación web:
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier persona
 *    Implementar → autoriza → copia la URL.
 * 4. En Railway → Variables:  SEGUIMIENTO_WEBHOOK_URL = (esa URL)
 *
 * ⚠️ Si editas el código luego: Implementar → Gestionar implementaciones →
 *    editar (lápiz) → Versión: Nueva versión → Implementar.
 */

var COLUMNAS = ["Teléfono", "Nombre", "Estado", "Primer contacto", "Actualizado", "Seguimiento enviado"];

function doPost(e) {
  try {
    var datos = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    var tel = String(datos.telefono || "").trim();
    var estado = String(datos.estado || "sin_agendar").trim();
    var nombre = String(datos.nombre || "").trim();

    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    if (hoja.getLastRow() === 0) {
      hoja.appendRow(COLUMNAS);
      hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight("bold");
      hoja.setFrozenRows(1);
    }

    var ahora = datos.ts
      ? Utilities.formatDate(new Date(datos.ts), "America/Bogota", "yyyy-MM-dd HH:mm")
      : Utilities.formatDate(new Date(), "America/Bogota", "yyyy-MM-dd HH:mm");

    // Buscar fila existente por teléfono.
    var fila = 0;
    if (tel && hoja.getLastRow() > 1) {
      var tels = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < tels.length; i++) {
        if (String(tels[i][0]).trim() === tel) { fila = i + 2; break; }
      }
    }

    var esConversion = (estado === "agendo" || estado === "club");

    if (fila > 0) {
      // Actualiza la fila existente (sin "bajar" de agendó/club a sin_agendar).
      var estadoActual = String(hoja.getRange(fila, 3).getValue()).trim();
      var yaConvirtio = (estadoActual === "agendo" || estadoActual === "club");
      if (esConversion || !yaConvirtio) {
        hoja.getRange(fila, 3).setValue(estado);
      }
      hoja.getRange(fila, 5).setValue(ahora); // Actualizado
      if (nombre && !String(hoja.getRange(fila, 2).getValue()).trim()) {
        hoja.getRange(fila, 2).setValue(nombre);
      }
    } else {
      // Nueva persona.
      hoja.appendRow([tel, nombre, estado, ahora, ahora, ""]);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("Tabla de SEGUIMIENTO de E-Master lista ✅");
}
