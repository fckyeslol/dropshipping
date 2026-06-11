// guion.js
// ───────────────────────────────────────────────────────────────
//  GUION DE VENTAS — todos los textos del bot, casi al pie de la
//  letra del workflow de Brayan. Persona: 100% Brayan (primera persona).
//
//  EDITA AQUÍ la copy. Los links se toman de variables de entorno
//  (BOOKING_LINK / CLUB_LINK); si no están, usan los del guion.
// ───────────────────────────────────────────────────────────────

// Limpia una URL de un posible prefijo "NOMBRE=" que se cuele al pegar en Railway
// (ej. si pegan "BOOKING_LINK=https://..." en el campo del valor).
function limpiarUrl(v) {
  return String(v || "").trim().replace(/^[A-Za-z_]+\s*=\s*/, "");
}

// Links (sobreescribibles por variables de entorno)
const CALENDLY_LINK =
  limpiarUrl(process.env.BOOKING_LINK) || "https://calendly.com/d/cxz9-jk3-tfp/e-master-brayan-hernandez";
const SKOOL_LINK =
  limpiarUrl(process.env.CLUB_LINK) || "https://www.skool.com/upgrade-project-6844/about";
const VIDEO_GRATIS_URL =
  limpiarUrl(process.env.VIDEO_GRATIS_URL) || "https://youtu.be/iBGLGsKrpk0";

// ── Apertura cuando alguien solo saluda (pido nombre y abro) ──
const SALUDO =
  "¡Hey! ¿Qué más? 🙌 Te escribe *Brayan*.\n" +
  "¿Con quién tengo el gusto? Cuéntame, ¿estás buscando arrancar con el dropshipping?";

// ── /upgrade — abre la calificación (cuando ya tengo el nombre) ──
const ABRIR_CALIFICACION =
  "Vi que estás interesado en empezar con dropshipping. Antes de explicarte todo, quiero entender un poco tu situación para ver si realmente esto es para ti y cómo ayudarte mejor.\n\n¿A qué te dedicas actualmente?";

// ── /inversion — cuando preguntan cuánto se necesita / el precio ──
const INVERSION =
  "Bueno bro, te explico: necesitas invertir tanto en la formación que te voy a brindar, para que seas un caso de éxito, como en la publicidad para poder cumplir con las ventas y que logres tener un ingreso real. Aparte, debes contar con una inversión para las plataformas que vas a necesitar para trabajar y capitalizar tu empresa.\n\nEl mínimo para iniciar son *$1,000 dólares*. ¿Contarías con eso?";

// ── /inicio — puente al club cuando NO cuenta con el capital ──
const PUENTE_CLUB =
  "Uf bro, te hablo claro: con ese capital sí puedes empezar, y lo bueno es que no de la forma tradicional que la mayoría intenta y donde casi todos fallan. Cuando se tiene poco capital, lo que necesitas es estrategia y guía; si no, ese dinero se va rápido y sigues igual.\n\nEstas opciones no se las muestro a cualquiera. Prefiero personas decididas, con hambre de avanzar, no gente que entra por emoción y abandona.\n\nEntonces dime con sinceridad: ¿de verdad quieres cambiar tu situación y empezar en serio, o solo estás mirando opciones?";

// ── /club2presentacion — presenta el club (cuando dice que sí al puente) ──
const CLUB_PRESENTACION =
  "¡Buenísimo que me digas eso! Te cuento: dentro de mi club *Upgrade Project* te doy todas las herramientas para empezar desde cero y generar de *1k a 3k USD al mes*, porque te comparto todo el proceso que sigo en mis tiendas actuales: anuncios en TikTok y Facebook, diseño de página, cómo entregar los productos, cómo encontrar productos ganadores, cómo crear marca personal y, lo más importante, todo para que arranques a vender.\n\nTambién tienes la posibilidad de una llamada 1:1 conmigo si eres de los que más aplican dentro del club.\n\n*Mi programa tiene un valor de $34 USD mensual.*\n\nEsto es un programa exclusivo y privado, donde doy información de mis programas de 2 mil dólares por este precio. Así que no me arriesgo a enseñárselo a alguien que no esté listo para dar ese paso.\n\nEntonces bro, ¿quieres aprovechar esta única oportunidad?";

// ── BLOQUE FINAL: agendar llamada (rama >= $1,000) — lo entrega la herramienta ──
const CALENDLY_BLOQUE =
  "Excelente. Mira, no me gusta explicarte todo por aquí porque se pierde mucha información, y lo importante es que aprendas a manejar todo.\n\n¿Qué te parece si agendamos una reunión con el equipo y te explicamos todo por dentro?\n\n👉 " +
  CALENDLY_LINK +
  "\n\nAgendas por ahí; el equipo te va a explicar absolutamente todo el proceso y así tienes todo mucho más claro.\n\nAvísame cuando agendes para confirmar 🙌";

// ── BLOQUE FINAL: entrar al club (rama < $1,000) — lo entrega la herramienta ──
const CLUB_BLOQUE =
  "Brooo, vamos a romperla durísimo 🔥\n\nIngresa aquí: " +
  SKOOL_LINK +
  "\n\nLe das en *Join*, sigues los pasos y quedas adentro de una vez.\n\nMándame la captura apenas ingreses para activarte de una 🙌";

// ── Off-ramp: NO tiene dinero ni para el club → video gratis + seguir el canal ──
const VIDEO_GRATIS =
  "Tranquilo bro, sin afán 🙌 Mírate este video y sígueme en mi canal, para que cuando puedas, ya tengas una idea de todo.\n\n" +
  VIDEO_GRATIS_URL +
  "\n\n¡Nos vemos pronto!";

module.exports = {
  CALENDLY_LINK,
  SKOOL_LINK,
  VIDEO_GRATIS_URL,
  SALUDO,
  ABRIR_CALIFICACION,
  INVERSION,
  PUENTE_CLUB,
  CLUB_PRESENTACION,
  CALENDLY_BLOQUE,
  CLUB_BLOQUE,
  VIDEO_GRATIS,
};
