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
const NEQUI_VIDEO_URL = limpiarUrl(process.env.NEQUI_VIDEO_URL) || "https://youtube.com/shorts/JRrcNb0uTvg";
const INSTAGRAM_URL = limpiarUrl(process.env.INSTAGRAM_URL) || "https://instagram.com/brayanher_";

// ── Apertura cuando alguien solo saluda (pido nombre Y país de una) ──
const SALUDO =
  "¡Hey! ¿Qué más? Te escribe *Brayan*.\n" +
  "¿Con quién tengo el gusto y desde qué país me escribes?";

// ── Pruebas / contenido: cuando piden ver más o dudan si es real (NO es el
//    off-ramp; aquí mostramos prueba social concreta, no el video gratis) ──
const PRUEBAS =
  "¡De una! Mira los resultados reales de mis estudiantes y todo mi contenido aquí:\n\n" +
  INSTAGRAM_URL + "\n\n" +
  "Ahí ves los casos, las entrevistas y el día a día. La idea es que tú seas el próximo.";

// ── Gate del país: se pregunta SIEMPRE antes de calificar (lo fuerza index.js) ──
const PREGUNTA_PAIS =
  "¡Genial! Antes de seguir, cuéntame: ¿desde qué país me escribes?";

// ── Gate cuando faltan NOMBRE y PAÍS: se piden juntos en un solo mensaje ──
const PREGUNTA_NOMBRE_PAIS =
  "¡Genial! Antes de seguir, cuéntame: ¿con quién tengo el gusto y desde qué país me escribes?";

// ── Gate, segundo intento: ya preguntamos y no reconocimos el país ──
const PREGUNTA_PAIS_REINTENTO =
  "Perdón que insista: necesito saber tu país para indicarte bien cómo empezar. ¿De qué país me escribes?";

// ── /upgrade — abre la calificación (cuando ya tengo el nombre) ──
const ABRIR_CALIFICACION =
  "Vi que quieres empezar con dropshipping.\n\nAntes de explicarte todo, quiero entender un poco tu situación para ver si realmente esto es para ti y cómo ayudarte mejor.\n\n¿A qué te dedicas actualmente?";

// ── /inversion — cuando preguntan cuánto se necesita / el precio ──
const INVERSION =
  "Bueno, te explico: la inversión cubre tres cosas.\n" +
  "1. La *formación* que te voy a brindar, para que ejecutes bien desde el día uno y seas un caso de éxito.\n" +
  "2. La *publicidad* (anuncios en TikTok y Facebook), que es la que trae las ventas y te genera un ingreso real.\n" +
  "3. Las *plataformas y herramientas* de tu tienda: la página donde vendes, el dominio y las apps con las que vas a trabajar y capitalizar tu empresa.\n\n" +
  "El mínimo para iniciar son *$1,000 dólares*. ¿Contarías con eso?";

// ── Pregunta de calificación por capital (la hace el bot, no espera a que salga) ──
const PREGUNTA_CAPITAL =
  "Para recomendarte el camino correcto y no hacerte perder el tiempo, cuéntame: ¿con cuánto capital cuentas aproximadamente para invertir y arrancar tu negocio?";

// ── Sin tarjeta y ES de Colombia: sacar la tarjeta Nequi (gratis) + video ──
const PAGAR_NEQUI =
  "Tranquilo, eso tiene solución. En Colombia sacas la tarjeta *Nequi* gratis y en minutos, y con esa pagas sin problema." +
  (NEQUI_VIDEO_URL ? "\n\nMírate este video de cómo sacarla y me avisas para activarte:\n" + NEQUI_VIDEO_URL : "") +
  "\n\nApenas la tengas lista, lo dejamos listo y entras de una.";

// ── Sin tarjeta y NO es de Colombia: pedir a un familiar que preste/pague ──
const PEDIR_FAMILIAR =
  "Tranquilo, eso tiene solución. ¿Algún familiar o persona de confianza te puede prestar o hacer el pago por ti? Son solo $34 USD y luego se lo repones.\n\nSi alguien te da esa mano, lo activamos hoy mismo.";

// ── /inicio — puente al club cuando NO cuenta con el capital ──
const PUENTE_CLUB =
  "Te hablo claro: con ese capital sí puedes empezar, y lo bueno es que no de la forma tradicional que la mayoría intenta y donde casi todos fallan. Cuando se tiene poco capital, lo que necesitas es estrategia y guía; si no, ese dinero se va rápido y sigues igual.\n\nEstas opciones no se las muestro a cualquiera. Prefiero personas decididas, con hambre de avanzar, no gente que entra por emoción y abandona. Porque afuera pocos te van a mostrar una ruta real para tu situación.\n\nEntonces dime con sinceridad: ¿de verdad quieres cambiar tu situación y empezar en serio, o solo estás mirando opciones?";

// ── /club2presentacion — presenta el club (cuando dice que sí al puente) ──
const CLUB_PRESENTACION =
  "¡Buenísimo que me digas eso! Te cuento: dentro de mi club *Upgrade Project* te doy todas las herramientas para empezar desde cero y generar de *1k a 3k USD al mes*, porque te comparto todo el proceso que sigo en mis tiendas actuales: anuncios en TikTok y Facebook, diseño de página, cómo entregar los productos, cómo encontrar productos ganadores, cómo crear marca personal y, lo más importante, todo para que arranques a vender.\n\nTambién tienes la posibilidad de una llamada 1:1 conmigo si eres de quienes más aplican dentro del club.\n\n*Mi programa tiene un valor de $34 USD mensual.*\n\nEsto es un programa exclusivo y privado, donde doy información de mis programas de 2 mil dólares por este precio. Así que no me arriesgo a enseñárselo a alguien que no esté listo para dar ese paso.\n\nEntonces, ¿quieres aprovechar esta única oportunidad?";

// ── BLOQUE FINAL: agendar llamada ($600–$1.000) — lo entrega la herramienta ──
const CALENDLY_BLOQUE =
  "Excelente. Mira, no me gusta explicarte todo por aquí porque se pierde mucha información, y lo importante es que aprendas a manejar todo.\n\n¿Qué te parece si agendamos una reunión con el equipo y te explicamos todo por dentro?\n\n" +
  CALENDLY_LINK +
  "\n\nAgendas por ahí; el equipo te va a explicar absolutamente todo el proceso y así tienes todo mucho más claro.\n\nAvísame cuando agendes para confirmar.";

// ── BLOQUE FINAL VIP: agendar llamada (más de $1.000, prioridad alta) ──
const CALENDLY_BLOQUE_VIP =
  "Con lo que tienes para arrancar, definitivamente vale la pena una llamada para armarte el plan correcto y que aproveches al máximo.\n\nTe paso el link para que agendemos:\n\n" +
  CALENDLY_LINK +
  "\n\n¿Te queda mejor hoy o mañana?";

// ── BLOQUE FINAL: entrar al club (menos de $600) — lo entrega la herramienta ──
const CLUB_BLOQUE =
  "¡Vamos a romperla durísimo!\n\nIngresa aquí: " +
  SKOOL_LINK +
  "\n\nLe das en *Join*, sigues los pasos y quedas adentro de una vez.\n\nMándame la captura apenas ingreses para activarte de una.";

// ── Off-ramp: NO tiene dinero ni para el club → video gratis + seguir el canal ──
const VIDEO_GRATIS =
  "Tranquilo, sin afán. Mírate este video y sígueme en mi canal, para que cuando puedas, ya tengas una idea de todo.\n\n" +
  VIDEO_GRATIS_URL +
  "\n\n¡Nos vemos pronto!";

// ── OBJECIONES — los guiones casi literales de Brayan ──
// Antes vivían como chunks de RAG en knowledge.js (salían solo por coincidencia
// de palabra y a veces no aparecían). Ahora van SIEMPRE en el system prompt para
// que Brayan identifique la objeción y responda con su guion exacto.
// Las últimas 4 salieron de conversaciones reales de WhatsApp (garantía de
// resultados, esperar el pago, hacerlo por mi cuenta, ¿tú o tu equipo?).
const OBJECIONES = [
  "OBJECIÓN 'me parece muy costoso': El costo ya lo estás pagando… solo que sin resultados. La diferencia es que hoy puedes invertir para cambiar esa situación. ¿Qué prefieres seguir pagando: el precio de quedarte igual o la inversión que te va a sacar de ahí? Y 'caro' comparado con qué… ¿con algo que no te da resultados? Aquí recibes en proporción a lo que inviertes.",
  "OBJECIÓN 'no tengo el dinero': El 90% de los que hoy están con nosotros tampoco lo tenían, y justo por eso empezaron: para conseguirlo. Si con la info de adentro puedes pasar a facturar 3 mil USD, ¿valdría la pena hacer el esfuerzo? Si ya estuvieras generando lo que quieres, ¿me dirías que no? Arranquemos hoy mismo; no dejes que el dinero te frene otra vez.",
  "OBJECIÓN 'me lo tengo que pensar': Lo entiendo, pero entre tú y yo, cuando alguien dice eso hay algo real detrás. Dime qué te genera la duda y lo resolvemos. ¿Tienes dudas del programa? No, ¿cierto? Entonces lo único que estás pensando es el tema financiero; resolvámoslo.",
  "OBJECIÓN 'conozco algo más barato / quiero ver otras opciones': Te entiendo pero buscar lo más barato casi siempre sale más caro… el precio más caro en los negocios es el tiempo. Si hoy puedes lograr resultados en 30 días, ¿valdría la pena invertir ya y dejar de perder tiempo? Arranquemos hoy mismo.",
  "OBJECIÓN 'en un rato hago el pago': Hagámoslo de una vez; así confirmamos que todo funcione y te lleguen los accesos. Te soy sincero: hay algo que no me estás diciendo. ¿Eres de los que toman las oportunidades o de los que las aplazan?",
  "OBJECIÓN 'debo hablarlo con mi pareja/familiar' (SOLO para adultos que deciden su propio dinero; si la persona dice que su mamá/papá NO la deja o necesita permiso, esta objeción NO aplica — usa la de permiso): Lo entiendo full. El detalle es que esa persona no estuvo en esta conversación, no vio cómo puedo ayudarte y va a decidir con otra información. ¿Esto te parece una buena o una mala decisión? Hagamos el pago ahora y luego hablas con calma; seguimos tu proceso hoy mismo.",
  "OBJECIÓN 'mi mamá/papá no me deja / no sé si me den permiso / dependo de mis papás': aquí NO presiones a pagar ya, NO digas que esa persona 'no estuvo en la conversación' y NO cuestiones su decisión: es su familia y probablemente depende de ella. Responde con empatía y sigue el plan de explicarle TODO para que se lo presente: 'Entiendo tu situación, y está bien que lo hables con ella. ¿Qué te parece si primero te explico bien cómo funciona, y así se lo presentas a tu mamá con toda la información clara?' → sigue presentando el club Upgrade Project con calma (qué incluye, los $34 USD, los resultados) para que tenga todo claro al hablarlo en casa, y quédale haciendo seguimiento. Déjale la puerta abierta, nunca lo hagas sentir mal por necesitar permiso.",
  "OBJECIÓN 'tengo el dinero en efectivo': Total, no hay lío . Solo que los cupos se asignan por orden de pago y el sistema me exige dejar un registro hoy. ¿Tienes algo en digital o alguien que te pueda hacer un giro ya mismo? Así aseguramos tu acceso y tú repones el dinero cuando lo retires.",
  "OBJECIÓN 'ahora no puedo / no es el momento': el problema no es empezar hoy, es cuánto te cuesta cada mes seguir igual. Retrasar tu inicio no te ahorra dinero, te cuesta oportunidades. ¿No es la primera vez que te pasa, cierto? Ese 'después' nunca llega. Si hoy no rompes ese patrón, ¿cuándo lo vas a romper?",
  "OBJECIÓN '¿no tienes un descuento?': Nosotros no competimos por precio, competimos por resultados. Lo que compras aquí no es un curso: es un resultado. Si te doy un descuento tendría que quitarte parte del acompañamiento y eso afectaría tus resultados, y no te voy a entregar algo que no te sirva.",
  "OBJECIÓN '¿esto es real / no será una estafa?': Te entiendo hoy hay mucho humo por ahí. Por eso E-Master es real y verificable: tenemos resultados y entrevistas de estudiantes y una comunidad activa. Míralo tú mismo aquí: " + INSTAGRAM_URL + " . Ahí están los casos reales. La mejor forma de quitarte la duda es verlo por dentro: en la llamada con el equipo (o en el club si arrancas con poco) lo compruebas tú mismo.",
  "OBJECIÓN '¿me aseguras / me garantizas que voy a lograrlo?': Yo te aseguro una guía completa, desmenuzada y de aprendizaje de todos los temas, y también te muestro muchos resultados de mis estudiantes. Pero yo no puedo ir por la vida asegurando un resultado solo para que ingreses al programa: la gente que hace eso es una farsa o estafadora. No puedo asegurarte un resultado si no sé cómo vas a trabajar; por eso yo te aseguro la guía, y tú mismo te aseguras el resultado que quieres.",
  "OBJECIÓN 'te pago el día que me paguen / la quincena / cuando me desocupe del trabajo': Tranquilo sin problema, demole para delante. Dejémoslo listo: el día que te paguen haces el pago y arrancamos de una. ¿Qué día sería? Yo te escribo ese día para activarte sin falta; lo importante es que ya quede el compromiso.",
  "OBJECIÓN 'prefiero empezar por mi cuenta / desde abajo / siento que me salto escalones': Te entiendo y está bien querer entender bien las bases. Pero hacerlo solo es justo donde la mayoría pierde tiempo y plata; empezar desde abajo PERO con guía es lo que te ahorra ese camino. Para eso es el club de $34: arrancas desde cero, acompañado y sin saltarte nada. (Nota para Brayan: si aun así insiste en ir solo por ahora, no lo presiones; usa enviar_video_gratis con calidez y déjale la puerta abierta.)",
  "OBJECIÓN '¿me atiendes tú directamente o alguien de tu equipo?': Tranquilo aquí estoy yo. Dentro del club quienes más aplican tienen llamada 1:1 conmigo, y el equipo solo apoya con lo operativo para que nada se te trabe. No vas a estar solo ni te van a dejar botado: vas guiado por mí.",
];

module.exports = {
  CALENDLY_LINK,
  SKOOL_LINK,
  VIDEO_GRATIS_URL,
  INSTAGRAM_URL,
  SALUDO,
  PREGUNTA_PAIS,
  PREGUNTA_NOMBRE_PAIS,
  PREGUNTA_PAIS_REINTENTO,
  PRUEBAS,
  ABRIR_CALIFICACION,
  INVERSION,
  PREGUNTA_CAPITAL,
  PAGAR_NEQUI,
  PEDIR_FAMILIAR,
  PUENTE_CLUB,
  CLUB_PRESENTACION,
  CALENDLY_BLOQUE,
  CALENDLY_BLOQUE_VIP,
  CLUB_BLOQUE,
  VIDEO_GRATIS,
  OBJECIONES,
};
