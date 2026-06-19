# Flujos de conversacion del bot — E-Master (Brayan Hernandez)

Documento maestro de TODOS los flujos de conversacion mapeados hasta hoy.

Proposito: base para un sistema multiagentico (OpenClaw + API de DeepSeek) que
itere sobre este modelo. Cada flujo descrito aqui puede convertirse en un
**agente-prospecto** que conversa con el bot para probar una rama distinta y
verificar que el bot se comporta como debe.

> Nota de estilo del propio bot: NO usa emojis, NO dice "buena onda" ni
> "bacano". Este documento tampoco los usa.

---

## 1. Quien es el bot y como esta construido

- **Persona:** ES Brayan Hernandez, fundador de *E-Master Project*. Habla
  SIEMPRE en primera persona ("mi club", "mis tiendas", "conmigo"). Nunca admite
  ser bot/IA/asistente. Tono: colombiano, cercano, directo, con autoridad pero
  empatico.
- **Canal:** WhatsApp (via Twilio) y ManyChat (`/api/manychat`).
- **Estado:** en memoria, por numero de telefono. TTL 1 hora. Guarda:
  `historial`, `pais`, `nombre`, `capitalUSD`, `saludado`, `cerrado`.
- **Modelo:** cliente compatible con OpenAI. `OPENAI_MODEL` (default
  `gpt-4o-mini`) y `OPENAI_BASE_URL` configurables → **se puede apuntar a
  DeepSeek** cambiando base URL + modelo.
- **Arquitectura clave:** las decisiones criticas NO las toma el LLM. Se toman
  en codigo (deterministico) y se le pasan al LLM como "DATO YA CONFIRMADO". El
  LLM solo redacta y conversa. Ademas hay **redes de seguridad** que interceptan
  la salida del LLM y la corrigen.

### Archivos
| Archivo | Rol |
|---|---|
| `index.js` | Servidor, sesiones, gates deterministicos (pais, nombre, capital), anti-repeticion de cierre |
| `llm.js` | System prompt, herramientas (tools), redes de seguridad post-LLM |
| `guion.js` | Todos los textos fijos del bot + las 15 objeciones |
| `acciones.js` | Ejecucion de las 3 herramientas + registro de leads (webhook/tabla) |
| `knowledge.js` | RAG ligero: datos factuales de E-Master (contexto) |
| `resultados.js` | Bloque de testimonios reales |

### Datos de marca (knowledge.js)
- Marca: **E-Master Project** · Programa grande: **E-Master Academy VIP** ·
  Club: **Upgrade Project** (Skool, $34 USD/mes) · Fundador: **Brayan
  Hernandez** · IG: `@brayanher_`.

### Productos / precios
| Producto | Precio | Como se vende |
|---|---|---|
| Club Upgrade Project (Skool) | $34 USD/mes | Unico que el bot cierra por chat |
| Premium | $1.500 USD | SOLO en la reunion. Precio solo si lo preguntan directo |
| VIP | $2.500 USD | SOLO en la reunion. Precio solo si lo preguntan directo |

Premium y VIP **jamas** se venden ni cotizan por chat: se cierran en la llamada.

---

## 2. Las 3 herramientas (acciones finales)

El LLM no escribe los links: los entrega la herramienta, con texto EXACTO.

| Herramienta | Cuando | Entrega | Lead |
|---|---|---|---|
| `agendar_llamada` | Capital >= $600 USD (o consigue el minimo) | Bloque Calendly (normal o VIP) | rama `llamada`, va a la TABLA del 1:1 |
| `enviar_club` | Capital < $600, o confirma que no llega al minimo | Bloque Skool ($34) | rama `club` |
| `enviar_video_gratis` | No tiene NADA (ni los $34) | Video gratis + canal | rama `sin_dinero` |

- `agendar_llamada` entrega el **bloque VIP** si `capitalUSD > 1000` (lead con
  `prioridad: alta_vip`), si no el bloque normal.
- Requieren `nombre` valido (rechaza apodos/saludos/ocupaciones).

---

## 3. Gates deterministicos (en `index.js`, ANTES del LLM)

Orden de evaluacion de cada mensaje entrante:

```
1. Saludo / reinicio  → resetea sesion, manda SALUDO
2. Gate de PAIS       → detecta pais; si falta, lo pide (con nombre si falta)
3. Trigger RESULTADOS → si pide pruebas/testimonios, manda bloque de casos
4. Resto              → lo maneja el LLM (Brayan)
```

Ademas, en cada mensaje se detecta y guarda en sesion (sin frenar el flujo):
**nombre** y **capital en USD**.

### 3.1 Saludo / reinicio
Lista `SALUDOS`: hola, buenas, buenos dias, que tal, hey, hi, menu, inicio,
info, quiero informacion, etc. → resetea historial/pais/nombre/capital y manda
`SALUDO`.

### 3.2 Gate de PAIS (obligatorio antes de calificar)
- `detectarPais()` reconoce: paises, gentilicios (colombiano, mexicana...) y
  **lugares** (departamentos/ciudades): Choco, Antioquia, Medellin, Bogota,
  CDMX, Guadalajara, Lima, Buenos Aires, Santiago, etc.
- Si no hay pais aun:
  - Falta pais Y nombre → `PREGUNTA_NOMBRE_PAIS` (pide los dos juntos).
  - Falta solo el pais (ya hay nombre) → `PREGUNTA_PAIS`.
  - Ya se pregunto y la respuesta no se reconocio → `PREGUNTA_PAIS_REINTENTO`
    (frase distinta, no repite como robot).
- El pais es obligatorio porque define el cierre de pago del club (Nequi vs
  familiar).

### 3.3 Deteccion de NOMBRE (conservadora)
- Solo patrones explicitos: "me llamo X", "mi nombre es X", "soy X".
- Excluye apodos/saludos y **ocupaciones** (enfermera, mesero, ingeniero...) y
  genericos (interesado, estudiante...).
- El **primer** nombre capturado manda (un "soy enfermera" posterior no lo pisa).

### 3.4 Deteccion de CAPITAL y ruteo de rama (deterministico)
- `detectarCapitalUSD()` parsea monto + moneda y convierte a USD. Maneja
  multiplicadores (mil/millones/k). Tasas aprox: 1 USD ≈ 4.000 COP, 18 MXN,
  1.000 ARS, 3,7 PEN, 950 CLP, 5 BRL, 40 UYU, 7 BOB, etc.
- **Excluye metas:** "quiero ganar 3.000 al mes" NO es capital.
- `ramaPorCapital(usd)`:

| Capital USD | Rama | Cierre |
|---|---|---|
| > $1.000 | `llamada_vip` | Calendly VIP (prioridad alta) |
| $600 – $1.000 | `llamada` | Calendly normal |
| < $600 | `club` | Puente → club $34 |

- La rama se inyecta al system prompt como dato confirmado; el LLM NO la
  recalcula.

### 3.5 Trigger de resultados/pruebas
Palabras: testimonio(s), resultado(s), prueba(s), caso(s), estudiantes, es
real, funciona de verdad → manda el bloque de testimonios (`resultados.js`),
salvo que sea la objecion de garantia ("¿me aseguras resultados?"), que la
maneja el LLM.

---

## 4. Flujo principal de calificacion (paso a paso)

Lo ejecuta el LLM guiado por el system prompt. Regla transversal: **AVANZA,
NUNCA RETROCEDAS** (no repite preguntas ya respondidas; si la persona divaga,
reencauza al siguiente paso).

```
PASO 1 — ENTRADA: PAIS + NOMBRE (obligatorios)
  Faltan ambos → pide los dos juntos
  Falta pais   → pide solo pais
  Falta nombre → pide nombre (apodo no cuenta)
        │ (ya hay pais y nombre)
        ▼
PASO 2 — ABRIR (texto ABRIR_CALIFICACION, abriendo con su nombre)
  "Vi que quieres empezar con dropshipping... ¿A que te dedicas?"
        ▼
PASO 3 — CALIFICAR (una pregunta por mensaje, reaccion breve permitida)
  Si TRABAJA, en ORDEN y LITERAL:
    1. ¿Que te llamo la atencion del dropshipping?
    2. ¿Que te gustaria lograr con esto?
    3. ¿Por que crees que no lo has logrado aun?
    4. PREGUNTA_CAPITAL ("Para recomendarte el camino correcto...")
  Si ESTUDIA / NO trabaja:
    ¿Tienes ingreso fijo o dependes de alguien? → ¿Con cuanto podrias contar?
        ▼
PASO 4 — RAMIFICA POR CAPITAL (USD ya convertido por el sistema)
  > $1.000      → agendar_llamada (VIP / prioridad alta)
  $600–$1.000   → agendar_llamada (normal)
  < $600        → PASO 5 (puente al club)
        │
        ├─ (>= $600) → CALENDLY → fin rama LLAMADA
        ▼
PASO 5 — PUENTE AL CLUB (texto PUENTE_CLUB)
  "¿De verdad quieres cambiar, o solo estas mirando opciones?"
  Si SI quiere en serio → PASO 6
        ▼
PASO 6 — PRESENTA EL CLUB (texto CLUB_PRESENTACION, $34/mes)
  Si acepta / "quiero pagar" / "como pago" → enviar_club (link Skool)
  Si dice que NO tiene tarjeta / no sabe como pagar → sub-flujo de pago:
        ▼
SUB-FLUJO PAGO SIN TARJETA (ramifica por pais)
  COLOMBIA  → PAGAR_NEQUI (saca Nequi gratis) → al confirmar → enviar_club
  NO Colombia → PEDIR_FAMILIAR (que un familiar preste/pague)
        ├─ familiar paga → enviar_club
        └─ nadie puede   → enviar_video_gratis
        ▼
PASO 7 — NO TIENE NI PARA EL CLUB ($34)
  Deja claro que no tiene nada → enviar_video_gratis (sin insistir)

PASO 8 (transversal) — PIDE PRUEBAS / DUDA SI ES REAL
  Comparte Instagram con casos (texto PRUEBAS). NUNCA el video gratis aqui.
```

---

## 5. Las cuatro ramas de cierre (resumen)

### Rama A — LLAMADA VIP (> $1.000 USD)
- Prioridad alta, candidato a VIP.
- Cierre: `CALENDLY_BLOQUE_VIP` → "Con lo que tienes para arrancar,
  definitivamente vale la pena una llamada... ¿Te queda mejor hoy o manana?"
- Lead: rama `llamada`, prioridad `alta_vip`, va a la tabla del 1:1.

### Rama B — LLAMADA NORMAL ($600 – $1.000 USD)
- En la reunion el equipo define Premium o VIP.
- Cierre: `CALENDLY_BLOQUE` → "...¿Que te parece si agendamos una reunion con
  el equipo? [link] Avisame cuando agendes."
- Lead: rama `llamada`, prioridad `normal`.

### Rama C — CLUB ($34, < $600 USD)
- Puente (PUENTE_CLUB) → presentacion (CLUB_PRESENTACION) → `enviar_club`.
- Cierre: `CLUB_BLOQUE` → "Brooo, vamos a romperla durisimo. Ingresa aqui:
  [Skool]... Mandame la captura."
- Sub-flujos de pago sin tarjeta: Nequi (Colombia) / familiar (resto).

### Rama D — VIDEO GRATIS (no tiene nada, ni $34)
- Off-ramp con calidez: `VIDEO_GRATIS` → "Tranquilo bro, sin afan. Mirate este
  video y sigueme en mi canal... ¡Nos vemos pronto!"
- Lead: rama `sin_dinero`.

---

## 6. Reglas que el bot NUNCA rompe

1. Sigue el flujo; usa los textos "casi igual".
2. El mensaje que devuelve una herramienta se envia TAL CUAL.
3. No inventa datos, links, precios ni garantias de ingresos.
4. **Nunca escribe un link de Calendly/Skool a mano** (seria falso): solo via
   herramienta.
5. Premium ($1.500) y VIP ($2.500) no se venden por chat; precio solo si lo
   preguntan directo, y aun asi reencauza a la reunion. Unico precio que ofrece:
   club $34/mes.
6. **No cruza ramas:** al de la llamada jamas le menciona club/Skool/$34/"1k a
   3k al mes"; al del club no le ofrece la llamada con el equipo.
7. Una vez entregado el cierre, no repite el link; si confirma ("listo",
   "agende") responde corto.
8. Responde en espanol. Si piden un humano, recuerda que ya esta el (Brayan).
9. **No asume genero:** neutro hasta tener el nombre; luego adapta TODAS las
   palabras (interesada/interesado, etc.).
10. **Usa el nombre** en momentos clave. Una conversacion entera sin decirlo
    esta mal.
11. **Ejecuta la herramienta, no la anuncia:** prohibido "voy a agendar", "un
    segundo", "el equipo te contactara". El link sale en el mismo turno.
12. Sin emojis. Sin "buena onda" ni "bacano". Mensajes cortos (1-4 lineas),
    una idea por burbuja, links en texto plano, separados por linea en blanco.

---

## 7. Redes de seguridad (post-LLM, en `llm.js`)

Interceptan la salida del LLM y la corrigen aunque desobedezca al prompt:

| Red | Dispara cuando | Accion |
|---|---|---|
| Anti-link-inventado | El texto trae una URL calendly/skool escrita por el LLM | Fuerza la herramienta real; si no, reemplaza por el link real |
| Anti-rama | rama es llamada/llamada_vip y el texto menciona club/Skool/$34/"1k a 3k"/puente/"te faltan" | Fuerza `agendar_llamada` (Calendly si o si) |
| Anti-'te faltan' inventado | Dice "te faltan $X" y la persona nunca dio una cifra | Si dijo que puede conseguirlo → llamada; si no, pregunta el capital |
| Anti-anuncio | Anuncia accion ("voy a agendar", "un segundo") sin link | Fuerza la herramienta; ultimo recurso, entrega el bloque |
| Escalera de capital | Texto "te falta/estas cerca/consigue" y capital estimado >= $600 | Fuerza `agendar_llamada` |
| Familiar/Nequi sin gatillo | Ofrece familiar/Nequi sin que la persona dijera que no tiene tarjeta | Entrega el club directo |

---

## 8. Las 15 objeciones (guion casi literal)

El bot identifica cual aplica y responde con su guion (valida + reencauza al
cierre). Cada una es un caso de prueba independiente.

1. "me parece muy costoso"
2. "no tengo el dinero"
3. "me lo tengo que pensar"
4. "conozco algo mas barato / quiero ver otras opciones"
5. "en un rato hago el pago"
6. "debo hablarlo con mi pareja/familiar" (SOLO adultos que deciden su dinero)
7. "mi mama/papa no me deja / necesito permiso / dependo de mis papas"
   (empatia; NO presionar pago; explicarle para que lo presente en casa)
8. "tengo el dinero en efectivo"
9. "ahora no puedo / no es el momento"
10. "¿no tienes un descuento?"
11. "¿esto es real / no sera una estafa?"
12. "¿me aseguras / me garantizas que voy a lograrlo?"
13. "te pago el dia que me paguen / la quincena"
14. "prefiero empezar por mi cuenta / desde abajo"
15. "¿me atiendes tu directamente o alguien de tu equipo?"

Diferencia clave 6 vs 7: la 6 presiona a pagar ya; la 7 (permiso de
padres/dependencia) NO presiona, da empatia y plan para presentarlo en casa.

---

## 9. Bloque de testimonios (cuando piden pruebas)

`resultados.js` arma una lista de casos reales (Andres Galindez +10K, Cristian
Lozano +10K, David Montoya +10K, Kevin & Carlos +20K, Luis David +50K, Lucas
Valderruten +10K, Samuel Cabrera +10K, Liz & German +10K) y cierra invitando a
ver "tu caso" en una llamada. Tambien existe el texto `PRUEBAS` (Instagram con
casos) para cuando dudan si es real.

---

## 10. Agentes-prospecto para iterar (multiagentico)

Cada item es un **agente-prospecto** que conversa con el bot. Incluye el guion
del prospecto y lo que el bot DEBE hacer. Sirven como casos de regresion.

### Grupo A — Ramas de capital (camino feliz)

**A1. VIP (> $1.000)**
- Prospecto: da nombre + pais, trabaja, responde las 4 preguntas, capital
  "tengo $1.500".
- Esperado: bot usa el nombre, hace las 4 preguntas literales, al dar capital
  entrega `CALENDLY_BLOQUE_VIP` ("¿hoy o manana?"). Nunca menciona el club.

**A2. Llamada normal ($600–$1.000)**
- Prospecto: capital "700 dolares" / "3.400 soles" / "18 mil pesos mexicanos".
- Esperado: entrega `CALENDLY_BLOQUE`. No dice "te faltan". No menciona el club.

**A3. Club (< $600)**
- Prospecto: capital "300 dolares" / "2 millones de pesos colombianos".
- Esperado: PUENTE_CLUB → si dice que quiere en serio → CLUB_PRESENTACION → si
  acepta → `enviar_club` (link Skool).

**A4. Video gratis (sin nada)**
- Prospecto: "no tengo nada de dinero, ni los $34".
- Esperado: `enviar_video_gratis`, sin insistir.

### Grupo B — Gates de entrada

**B1. Solo saluda** → bot pide nombre + pais juntos.
**B2. Da nombre, no pais** ("soy Camila, vengo de la landing") → pide solo pais.
**B3. Responde con ciudad/departamento** ("vengo del Choco", "de Medellin", "de
Guadalajara") → bot deduce el pais y avanza.
**B4. Da un pais no reconocido / responde raro** → segunda pregunta con frase
distinta (no repite igual).
**B5. Da apodo en vez de nombre** ("soy parce/bro") → pide el nombre real.

### Grupo C — Conversion de moneda (deterministica)

**C1.** 6.000 bolivianos → ~$860 → llamada (NO $1.600, NO club).
**C2.** 18.000 MXN → ~$1.000 → llamada.
**C3.** "quiero ganar 3.000 al mes" → NO se interpreta como capital (es meta).

### Grupo D — Sub-flujos de pago (rama club, sin tarjeta)

**D1. Colombia sin tarjeta** → PAGAR_NEQUI (Nequi gratis) → al confirmar →
enviar_club.
**D2. No-Colombia sin tarjeta, familiar paga** → PEDIR_FAMILIAR → enviar_club.
**D3. No-Colombia sin tarjeta, nadie presta** → enviar_video_gratis.

### Grupo E — Genero y nombre

**E1. Mujer (Camila)** → adapta genero ("interesada", "lista"), usa el nombre,
nunca "bro/hermano".
**E2. Nombre ambiguo** → trato neutro.
**E3. Sin nombre aun** → neutro total, cero terminos con genero.
**E4. "Soy enfermera"** despues del nombre → no pisa el nombre real.

### Grupo F — Disciplina de cierre

**F1. Pide explicacion antes de agendar** (rama llamada): "explicame de que
trata todo" → bot habla de la reunion (opcion personalizada/semipersonalizada),
NO presenta el club.
**F2. Anti-anuncio:** el bot debe entregar el link en el turno, nunca "voy a
agendarlo / un segundo".
**F3. Confirma despues del cierre** ("listo, ya agende") → respuesta corta, sin
repetir el link.

### Grupo G — Objeciones
Un agente por cada una de las 15 objeciones (seccion 8). Verifica que use el
guion correcto y reencauce al cierre. Caso critico: distinguir objecion 6
(pareja, presiona) de la 7 (permiso de padres, empatiza).

### Grupo H — Precios Premium/VIP

**H1.** "¿cuanto cuesta el premium?" → da $1.500 SOLO porque lo pregunto
directo, pero reencauza a la reunion (no vende por chat).
**H2.** "¿cuanto vale todo?" sin especificar → no suelta precios de
Premium/VIP; habla de la reunion / del minimo $1.000 / del club $34.

---

## 11. Como conectar a DeepSeek (OpenClaw)

- El cliente es OpenAI-compatible. Para DeepSeek:
  - `OPENAI_BASE_URL=https://api.deepseek.com`
  - `OPENAI_MODEL=deepseek-chat` (o el modelo que uses)
  - `OPENAI_API_KEY=<tu key de DeepSeek>`
- Las herramientas (function calling) deben estar soportadas por el modelo
  elegido: el flujo de cierre depende de que el modelo emita `tool_calls`. Si el
  modelo no las soporta bien, las redes de seguridad de la seccion 7 sirven de
  respaldo, pero conviene validar function calling primero.

---

## 12. Resumen de textos fijos (en `guion.js`)

| Constante | Uso |
|---|---|
| `SALUDO` | Apertura cuando solo saludan |
| `PREGUNTA_PAIS` / `PREGUNTA_NOMBRE_PAIS` / `PREGUNTA_PAIS_REINTENTO` | Gate de entrada |
| `ABRIR_CALIFICACION` | Paso 2 |
| `PREGUNTA_CAPITAL` | Pregunta 4 de calificacion |
| `INVERSION` | "¿cuanto necesito?" (formacion + publicidad + plataformas) |
| `PUENTE_CLUB` | Paso 5 |
| `CLUB_PRESENTACION` | Paso 6 ($34/mes) |
| `CALENDLY_BLOQUE` | Cierre llamada normal |
| `CALENDLY_BLOQUE_VIP` | Cierre llamada VIP |
| `CLUB_BLOQUE` | Cierre club (Skool) |
| `PAGAR_NEQUI` / `PEDIR_FAMILIAR` | Pago sin tarjeta |
| `VIDEO_GRATIS` | Off-ramp |
| `PRUEBAS` | Instagram con casos |
| `OBJECIONES[]` | Las 15 objeciones |
