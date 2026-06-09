// parse_whatsapp.js
// Procesa TODOS los .txt exportados de WhatsApp que estén en la carpeta ./data
// y genera archivos estructurados en ./data/salida:
//   - mensajes.csv             (cada mensaje: archivo, fecha, hora, remitente, texto)
//   - interesados_detectados.csv (mensajes con señales de venta: precio, dudas, agendar)
//   - resumen.txt              (estadísticas)
//
// Para qué sirve: minar TUS conversaciones reales de ventas y sacar las
// preguntas, objeciones y respuestas que mejor funcionan. Eso luego lo
// pegas en knowledge.js / llm.js para que el bot suene como tú cierras.
//
// Uso:  node parse_whatsapp.js   (no requiere dependencias externas)

const fs = require("fs");
const path = require("path");

const DIR_DATA = path.join(__dirname, "data");
const DIR_SALIDA = path.join(DIR_DATA, "salida");

// ── Detección de líneas de WhatsApp (Android e iOS, 12h/24h, con/sin corchetes) ──
//   12/06/24, 3:45 p. m. - Brayan: Hola
//   [12/06/24, 3:45:10 p. m.] Cliente: ¿precio?
const RE_LINEA = new RegExp(
  "^\\[?" +
    "(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4})" + // fecha
    ",?\\s+" +
    "(\\d{1,2}:\\d{2}(?::\\d{2})?)" + // hora
    "\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|AM|PM)?" + // am/pm opcional
    "\\]?\\s*[-–]?\\s*" +
    "([^:]{1,60}?):\\s" + // remitente
    "([\\s\\S]*)$" // mensaje
);

// Precios: $ 1.234.567 / 1,234,567 / 50000 / "50 mil" / "50k" / "200 dolares"
const RE_PRECIO =
  /\$\s?\d{1,3}(?:[.,]\d{3})+|\$\s?\d{4,}|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\s?(?:mil|k|usd|dolares|dólares)\b/gi;

// Palabras clave del negocio de E-Master (dudas, objeciones, intención de compra).
const TEMAS = [
  "precio", "cuesta", "vale", "inversion", "inversión", "pago", "pagos", "cuotas",
  "agendar", "llamada", "cita", "asesoria", "asesoría", "reunion", "reunión",
  "dropshipping", "ecommerce", "e-commerce", "tienda", "meta ads", "publicidad",
  "curso", "programa", "academy", "mentoria", "mentoría", "comunidad",
  "garantia", "garantía", "estafa", "real", "funciona", "experiencia",
  "tiempo", "capital", "dinero", "empezar", "cupo", "cupos", "interesa", "interesado",
];

function listarTxt() {
  if (!fs.existsSync(DIR_DATA)) return [];
  return fs
    .readdirSync(DIR_DATA)
    .filter((f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "leeme.txt");
}

function parsearArchivo(contenido) {
  const lineas = contenido.split(/\r?\n/);
  const mensajes = [];
  let actual = null;

  for (const linea of lineas) {
    const m = linea.match(RE_LINEA);
    if (m) {
      if (actual) mensajes.push(actual);
      actual = {
        fecha: m[1],
        hora: (m[2] + " " + (m[3] || "")).trim(),
        remitente: m[4].trim(),
        texto: (m[5] || "").trim(),
      };
    } else if (actual) {
      actual.texto += "\n" + linea; // continuación multilínea
    }
  }
  if (actual) mensajes.push(actual);
  return mensajes;
}

function detectarPrecios(texto) {
  const encontrados = texto.match(RE_PRECIO);
  return encontrados ? Array.from(new Set(encontrados.map((s) => s.trim()))) : [];
}

function detectarTemas(texto) {
  const t = texto.toLowerCase();
  return TEMAS.filter((p) => t.includes(p));
}

function csv(campo) {
  const s = String(campo == null ? "" : campo);
  return '"' + s.replace(/"/g, '""') + '"';
}

function main() {
  const archivos = listarTxt();
  if (archivos.length === 0) {
    console.log(
      "No encontré archivos .txt en la carpeta 'data'.\n" +
        "Exporta tus chats de WhatsApp (Exportar chat → Sin multimedia) y\n" +
        "deja los .txt dentro de la carpeta 'data'. Luego vuelve a correr este script."
    );
    return;
  }

  fs.mkdirSync(DIR_SALIDA, { recursive: true });

  const filasMensajes = [["archivo", "fecha", "hora", "remitente", "mensaje"]];
  const filasSenales = [
    ["archivo", "fecha", "hora", "remitente", "mensaje", "precios_detectados", "temas_detectados"],
  ];

  let totalMensajes = 0;
  let totalSenales = 0;
  const porArchivo = [];

  for (const archivo of archivos) {
    const contenido = fs.readFileSync(path.join(DIR_DATA, archivo), "utf8");
    const mensajes = parsearArchivo(contenido);
    totalMensajes += mensajes.length;

    let senalesEnArchivo = 0;
    for (const msg of mensajes) {
      filasMensajes.push([archivo, msg.fecha, msg.hora, msg.remitente, msg.texto]);

      const precios = detectarPrecios(msg.texto);
      const temas = detectarTemas(msg.texto);
      if (precios.length > 0 || temas.length > 0) {
        filasSenales.push([
          archivo,
          msg.fecha,
          msg.hora,
          msg.remitente,
          msg.texto,
          precios.join(" | "),
          temas.join(" | "),
        ]);
        senalesEnArchivo++;
        totalSenales++;
      }
    }
    porArchivo.push({ archivo, mensajes: mensajes.length, senales: senalesEnArchivo });
  }

  const aCSV = (filas) => filas.map((f) => f.map(csv).join(",")).join("\n");
  fs.writeFileSync(path.join(DIR_SALIDA, "mensajes.csv"), "﻿" + aCSV(filasMensajes), "utf8");
  fs.writeFileSync(
    path.join(DIR_SALIDA, "interesados_detectados.csv"),
    "﻿" + aCSV(filasSenales),
    "utf8"
  );

  let resumen = "RESUMEN DEL PROCESAMIENTO DE CHATS — E-MASTER\n";
  resumen += "=============================================\n\n";
  resumen += `Archivos procesados: ${archivos.length}\n`;
  resumen += `Mensajes totales: ${totalMensajes}\n`;
  resumen += `Mensajes con señales de venta (precio/dudas/agendar): ${totalSenales}\n\n`;
  resumen += "Detalle por archivo:\n";
  for (const a of porArchivo) {
    resumen += `  - ${a.archivo}: ${a.mensajes} mensajes, ${a.senales} con señales\n`;
  }
  fs.writeFileSync(path.join(DIR_SALIDA, "resumen.txt"), resumen, "utf8");

  console.log(resumen);
  console.log("Listo. Archivos generados en: data/salida/");
}

main();
