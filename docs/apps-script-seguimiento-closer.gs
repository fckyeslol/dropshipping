/**
 * BOT → spreadsheet "seguimiento-closer"
 * El bot SOLO alimenta la hoja "Seguimiento" (1 fila por persona, se actualiza).
 * La hoja "Agendas" la llena CALENDLY (vía Zapier/Make) con fecha/hora/asesor REALES.
 * No toca "Cierres" ni "Tablero".
 *
 * Estados en Seguimiento:
 *   - primer contacto         → "Nuevo"   (Próximo paso: Calificar)
 *   - agendó la llamada (1:1) → "Agendó"  (Próximo paso: Confirmar cita en Calendly)
 *   - club enviado            → "Club"    (Próximo paso: Confirmar pago del club)
 *
 * ── ACTUALIZAR (ya tienes una versión vieja desplegada) ──
 * Abre el spreadsheet → Extensiones → Apps Script → pega ESTO (reemplaza todo) →
 * Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión →
 * Implementar.  (La URL se mantiene, no toques Railway.)
 */
var TZ = "America/Bogota";

function doPost(e) {
  try {
    var d = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ahora = d.ts
      ? Utilities.formatDate(new Date(d.ts), TZ, "yyyy-MM-dd HH:mm")
      : Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
    guardarSeguimiento(ss, d, ahora);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function guardarSeguimiento(ss, d, ahora) {
  var h = ss.getSheetByName("Seguimiento");
  if (!h) return;
  var tel = String(d.telefono || "").trim();
  var nombre = String(d.nombre || "").trim();
  var canal = String(d.canal || "").trim();

  var estado, paso;
  if (d.estado === "agendo" || d.rama === "llamada") { estado = "Agendó"; paso = "Confirmar cita (Calendly)"; }
  else if (d.estado === "club") { estado = "Club"; paso = "Confirmar pago del club"; }
  else if (d.estado === "sin_dinero") { estado = "Sin dinero"; paso = "Re-contactar cuando tenga capital"; }
  else { estado = "Nuevo"; paso = "Calificar"; }

  var ultima = ahora + (canal ? " (" + canal + ")" : "");

  // upsert por Contacto (columna B)
  var fila = 0;
  if (tel && h.getLastRow() > 1) {
    var tels = h.getRange(2, 2, h.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < tels.length; i++) if (String(tels[i][0]).trim() === tel) { fila = i + 2; break; }
  }
  if (fila > 0) {
    var actual = String(h.getRange(fila, 3).getValue()).trim().toLowerCase();
    var yaAvanzo = (actual === "agendó" || actual === "agendo" || actual === "club");
    if (estado === "Agendó" || estado === "Club" || !yaAvanzo) {
      h.getRange(fila, 3).setValue(estado);  // Estado
      h.getRange(fila, 5).setValue(paso);    // Próximo paso
    }
    h.getRange(fila, 4).setValue(ultima);    // Última conversación
    if (nombre && !String(h.getRange(fila, 1).getValue()).trim()) h.getRange(fila, 1).setValue(nombre);
  } else {
    h.appendRow([nombre, tel, estado, ultima, paso, ""]); // Nombre | Contacto | Estado | Última | Próximo paso | Tiempo
  }
}

function doGet() { return ContentService.createTextOutput("Bot → seguimiento-closer (Seguimiento): OK ✅"); }
