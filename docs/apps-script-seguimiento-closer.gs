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
 *   - sin dinero (off-ramp)   → "Sin dinero" (Próximo paso: Re-contactar cuando tenga capital)
 *
 * ── 1 FILA POR PERSONA (no duplica) ──
 * Busca por teléfono comparando SOLO DÍGITOS (a prueba de que Sheets guarde el
 * número en otro formato) y usa LockService para que dos mensajes que llegan casi
 * a la vez NO creen dos filas. Nunca baja de "Agendó"/"Club" a "Nuevo".
 *
 * ── ACTUALIZAR (IMPORTANTE: tienes una versión vieja desplegada) ──
 * Abre el spreadsheet → Extensiones → Apps Script → pega ESTO (reemplaza todo) →
 * Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión →
 * Implementar.  (La URL se mantiene, no toques Railway.)
 */
var TZ = "America/Bogota";

function doPost(e) {
  // Serializa las escrituras: si llegan dos POST casi simultáneos (primer
  // contacto + conversión), se procesan uno tras otro y NO se duplica la fila.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (errLock) { /* seguimos igual; mejor escribir que perder el dato */ }
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
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Normaliza un teléfono a SOLO dígitos, para comparar sin importar el formato
// (número vs texto, con/sin "whatsapp:", espacios, signos, etc.).
function soloDigitos(v) {
  return String(v == null ? "" : v).replace(/[^0-9]/g, "");
}

function guardarSeguimiento(ss, d, ahora) {
  var h = ss.getSheetByName("Seguimiento");
  if (!h) return;
  var tel = soloDigitos(d.telefono);
  var nombre = String(d.nombre || "").trim();
  var canal = String(d.canal || "").trim();
  if (!tel) return; // sin teléfono no podemos deduplicar; no escribimos basura

  var estado, paso;
  if (d.estado === "agendo" || d.rama === "llamada") { estado = "Agendó"; paso = "Confirmar cita (Calendly)"; }
  else if (d.estado === "club") { estado = "Club"; paso = "Confirmar pago del club"; }
  else if (d.estado === "sin_dinero") { estado = "Sin dinero"; paso = "Re-contactar cuando tenga capital"; }
  else { estado = "Nuevo"; paso = "Calificar"; }

  var ultima = ahora + (canal ? " (" + canal + ")" : "");

  // upsert por Contacto (columna B), comparando SOLO dígitos.
  var fila = 0;
  if (h.getLastRow() > 1) {
    var tels = h.getRange(2, 2, h.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < tels.length; i++) {
      if (soloDigitos(tels[i][0]) === tel) { fila = i + 2; break; }
    }
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
    // Nueva persona. El teléfono va como TEXTO (apóstrofo) para que Sheets no lo
    // reformatee como número y el upsert lo siga encontrando.
    h.appendRow([nombre, "'" + tel, estado, ultima, paso, ""]); // Nombre | Contacto | Estado | Última | Próximo paso | Tiempo
  }
}

function doGet() { return ContentService.createTextOutput("Bot → seguimiento-closer (Seguimiento): OK ✅"); }
