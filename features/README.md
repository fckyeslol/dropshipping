# SDD — Especificaciones Gherkin del bot E-Master (Brayan)

Especificación ejecutable derivada de `FLUJOS_CONVERSACION.md` y de las pruebas
multiagente (10 agentes-prospecto Sonnet 4.6 conversando con el bot de
producción). Cada `.feature` describe la **conducta esperada**; los tags marcan
el estado real observado.

## Convención de tags

| Tag | Significado |
|---|---|
| `@passing` | Verificado: el bot cumple el escenario. |
| `@bug` | Verificado: el bot NO cumple. Dispara un cambio estructural. |
| `@fixed` | Fix aplicado en código; pendiente re-test end-to-end con agente-prospecto. |
| `@parcial` | Cumple lo esencial pero con un desvío menor o ruido de infra. |
| `@pendiente-verificacion` | Spec escrito, aún no confirmado. |
| `@critico` | Riesgo alto (cruce de ramas, link inventado, género, $0, identidad). |
| `@infra` | El desvío observado es de infraestructura, no de lógica. |

## Resultado final de las pruebas (10 agentes, grupos A–H)

| Grupo | Feature | Resultado |
|---|---|---|
| A — Ramas de capital | `ramas-capital.feature` | 3/4 · A4 `@bug` (CAMBIO-01) |
| B — Gates de entrada | `gates-entrada.feature` | 3/5 · B4 (CAMBIO-03), B5 `@bug` (CAMBIO-02) |
| C — Conversión de moneda | `conversion-moneda.feature` | 4/4 |
| D — Pago sin tarjeta | `pago-sin-tarjeta.feature` | 3/3 |
| E — Género y nombre | `genero-y-nombre.feature` | 1 `@bug` (CAMBIO-09) · 3 OK con defecto compartido |
| F — Disciplina de cierre | `disciplina-cierre.feature` | 3/3 |
| G — Objeciones (15) | `objeciones.feature` | 12 PASS · G5 `@parcial`(infra) · G11, G15 `@parcial` |
| H — Precios + transversales | `precios-y-transversales.feature` | 4/5 · H1 `@bug` (CAMBIO-04) |

**Lo que el bot hace bien (no tocar):** conversión de moneda y ruteo de rama
(C 4/4), sub-flujos de pago Nequi/familiar/video (D 3/3), disciplina de cierre
y anti-anuncio (F 3/3), distinción crítica objeción 6 vs 7, anti-cruce de ramas
y anti-link inventado (transversales).

## Estado de implementación

| Cambio | Estado | Verificación |
|---|---|---|
| CAMBIO-01 · off-ramp `sin_dinero` | ✅ aplicado | unit 13/13 (dispara con "nada/ni los 34", no con obj#2/sin-tarjeta) |
| CAMBIO-02 · apodos en `NO_NOMBRES` | ✅ aplicado | unit OK (Parce/bro rechazados, Camila aceptado) |
| CAMBIO-03 · contador `vecesPidioPais` | ✅ aplicado | unit OK (reintento tras saludo, conserva "faltan ambos") |
| CAMBIO-04 · precio Premium directo | ✅ aplicado (prompt) | decisión: cumplir spec — da $1.500 si preguntan directo + reencauza |
| CAMBIO-05 · retry 429 | ✅ aplicado (código) | backoff 3x ante 429/5xx en `llm.js`; ya no cae a SALUDO por rate-limit |
| CAMBIO-05b · sesión compartida (Redis) | ✅ en producción | `sesionStore.js` + REDIS_URL en Railway. Persistencia confirmada (6 turnos sin reinicio entre pods) |
| CAMBIO-10 · pago sin tarjeta CO → Nequi | ✅ aplicado (código) | gate determinístico en `index.js`: Colombia + rama club + "sin tarjeta" → Nequi → confirma → Skool. El LLM lo confundía con la objeción de efectivo. D1/D2/D3/A3 verificados |
| CAMBIO-11 · objeción "estafa" post-cierre | ✅ aplicado (código) | "estafa"/legitimidad agregadas al trigger de pruebas: responde casos+Instagram en cualquier rama y aun tras el cierre. Antes, en rama llamada, el bot ignoraba la objeción y repetía "¿ya agendaste?" |
| CAMBIO-12 · prompt consciente del cierre | ✅ en producción | `meta.cerrado` → el LLM responde dudas post-cierre sin re-pegar el link. Redujo (no eliminó) los loops |
| CAMBIO-13 · garantía anti-loop post-cierre | ✅ en producción | `responderSinCierre()` (LLM sin herramientas) cuando la anti-repetición detecta re-cierre sobre una pregunta. **60/60 objeciones post-cierre sin loop** (llamada/VIP/club). Test: `tests/postcierre-e2e.js` |
| CAMBIO-06 · regex `detectarPais` | ❎ no reproducible → cerrado | 9/9 frases nombre+país detectan bien; era CAMBIO-05 |
| CAMBIO-07 · obj 11 → Instagram | ✅ aplicado (guion) | re-test con agente |
| CAMBIO-08 · obj 15 → sin "equipo" | ✅ aplicado (guion) | re-test con agente |
| CAMBIO-09 · "Listo/Lista" género | ✅ aplicado (prompt) | re-test con agente |

**Confirmación end-to-end (build local con todos los fixes): 8/8 escenarios
`@fixed` PASS** — B5 apodo, B4 país, A4 off-ramp, H1 precio Premium + reencauce,
G11 Instagram, G15 sin "equipo", E1 "Listo/Lista". Nota: CAMBIO-07 se resolvió
en `resultados.js` (el trigger determinista de testimonios interceptaba
"¿esto es real?" antes del LLM; ahora el bloque de testimonios incluye el
Instagram). Falta únicamente **desplegar a Railway** para que producción quede
igual al build verificado.

Las pruebas unitarias deterministas viven en `tests/cambios-deterministicos.js`
(gate, off-ramp, detector): 17/17. La verificación e2e se corre levantando el
bot local y conversando contra `/webhook`.

## Backlog de cambios estructurales

Orden de ataque: primero `@critico`/infra (01, 05, 02), luego el resto.

### CAMBIO-01 · Rama terminal "sin dinero / ni los $34"  `@critico`
- Escenario: `ramas-capital.feature` → "Prospecto sin nada de dinero".
- Síntoma: al decir "no tengo nada, ni los $34" el bot insiste con Skool y
  entra en loop; el video gratis solo sale por reset accidental.
- Causa: no hay detección determinística de incapacidad de pago ni estado
  terminal `sin_dinero`; la rama club no sale a `enviar_video_gratis`.
- Fix: detector determinístico en `index.js` ("no tengo nada / ni los 34 / sin
  dinero / no puedo pagar") → rama `sin_dinero` → forzar `enviar_video_gratis`;
  red de seguridad en `llm.js` que corte el loop de Skool tras negar el pago.

### CAMBIO-02 · Apodos aceptados como nombre real  `@critico`
- Escenario: `gates-entrada.feature` → "Da un apodo en vez de nombre".
- Síntoma: "Soy Parce" / "bro" se aceptan ("Listo, Parce!").
- Causa: `NO_NOMBRES` (`index.js:324`) no incluye apodos; `detectarNombre`
  (`index.js:339`) corre antes del LLM.
- Fix: agregar apodos a `NO_NOMBRES`: parce, parcero, bro, brother, broder,
  hermano, mano, pana, compa, compadre, loco, men, papi, rey, crack, capo,
  jefe, amigo, amiga, socio, llave, primo, vale, mijo, mija.

### CAMBIO-03 · Reintento de país no dispara en el 1er país inválido
- Escenario: `gates-entrada.feature` → "Responde con un país no reconocido".
- Causa: el reintento (`index.js:390-396`) mira el último `assistant` del
  historial, pero el branch de saludo (`index.js:365-371`) no escribe historial.
- Fix: contador `sesion.vecesPidioPais`; si ≥1 y sigue sin país →
  `PREGUNTA_PAIS_REINTENTO`.

### CAMBIO-04 · Precio de Premium ante pregunta directa  ✅ RESUELTO
- Decisión de producto: **cumplir el spec** — dar $1.500 (y $2.500 VIP) SOLO si
  lo preguntan directo, y reencauzar a la reunión (sin cerrar por chat).
- Causa: el prompt se contradecía ("JAMÁS se cotizan" en regla 4 de ramas vs
  "dilo si preguntan directo" en regla 4 de NUNCA ROMPER); el modelo resolvía
  negándose.
- Fix aplicado en `llm.js`: reconciliadas las 4 instrucciones (ramas llamada/
  VIP con excepción explícita, regla de cierre re-redactada). Re-test con agente.

### CAMBIO-05 · Manejo de 429  ✅ RESUELTO (código)
- Fix aplicado en `llm.js`: `crearConReintento` con backoff (3x: 400/800/1600ms)
  ante 429 y 5xx, en las 3 llamadas al LLM. Ya no se pierde la respuesta (ni el
  contexto) por un rate-limit puntual.

### CAMBIO-05b · Sesión compartida  `@critico`  ✅ CÓDIGO LISTO (falta env en Railway)
- Reportado por C, D, E, G de forma independiente.
- Síntoma: estado en memoria (Map JS) + 2 pods en Railway sin sticky sessions →
  turnos consecutivos caen en pods distintos y la sesión se reinicia.
- Fix aplicado: nuevo `sesionStore.js` con API async (`cargar`/`guardar`/
  `limpiar`). Si hay `REDIS_URL` usa Redis (TTL 1h, compartido entre pods); si
  no, cae a memoria (idéntico al comportamiento previo). `index.js` ahora
  carga/guarda la sesión por cada mensaje en ambos webhooks. Dependencia `redis`
  añadida. Persistencia e2e verificada (memoria): el 2º turno recuerda el
  nombre/país, ya no re-saluda.
- PASO FINAL (tú, en Railway): crear un Redis (plugin de Railway, 1 clic) y
  pegar su `REDIS_URL` en las variables. Sin esa env var sigue en memoria; el
  parche gratis alternativo es escalar a 1 pod.

### CAMBIO-06 · `detectarPais` con nombre+país  ❎ CERRADO (no reproducible)
- Probado con 9 frases nombre+país ("soy carlos de colombia", "Soy Camila, de
  Colombia", "me llamo Juan y soy de Colombia", etc.): TODAS detectan el país.
- Conclusión: la pérdida de país que vio el agente era por reinicio de sesión
  (CAMBIO-05b), mal atribuida al regex. No se toca `detectarPais`.

### CAMBIO-07 · Objeción 11 debe invitar al Instagram
- Escenario: `objeciones.feature` → "11 ¿Esto es real o es estafa?".
- Síntoma: manda casos reales pero cierra invitando a llamada; el IG solo sale
  si lo piden explícito.
- Fix: ajustar el guion de la objeción 11 para incluir el IG con casos.

### CAMBIO-08 · Objeción 15 minimizar mención de "equipo"
- Escenario: `objeciones.feature` → "15 ¿Me atiendes tú o tu equipo?".
- Síntoma: afirma 1ª persona pero menciona "el equipo" 2 veces → ambigüedad.
- Fix: endurecer el guion 15 para reducir/encuadrar la mención de "equipo".

### CAMBIO-09 · Confirmación "Listo/Lista" no adapta género  `@critico`
- Escenarios: `genero-y-nombre.feature` → E1 (`@bug`), arrastrado por E4.
- Síntoma: "Listo, Valeria!" (masculino) con nombre claramente femenino.
- Causa: la exclamación de confirmación no se adapta al género del prospecto.
- Fix: instrucción en el prompt (`llm.js`) y/o helper de género para usar
  "Lista" con nombres femeninos; revisar textos estáticos en `guion.js`.

## Cómo verificar tras los cambios
Re-correr los agentes-prospecto sobre cada escenario `@bug`/`@parcial`; un
arreglo correcto mueve el tag a `@passing`. La lógica determinística (gates,
conversión, ruteo) puede verificarse directo invocando funciones de `index.js`
sin depender del HTTP inestable (ver CAMBIO-05).
