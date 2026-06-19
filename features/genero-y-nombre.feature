# language: es
@grupo-E @genero
Característica: Manejo de género y nombre
  Como bot que no asume identidad
  Quiero usar trato neutro hasta tener el nombre y luego adaptar el género
  Para nunca tratar mal a la persona ni perder su nombre

  @fixed @critico @cambio-09
  Escenario: Mujer, adapta el género
    Dado una prospecta llamada Valeria que trabaja con 500 USD
    Cuando avanza por la calificación
    Entonces el bot usa lenguaje femenino como "interesada" y "lista"
    Y el bot usa el nombre Valeria
    Pero el bot nunca dice "bro" ni "hermano"
    # Observado: usa el nombre y nunca "bro", pero dice "Listo, Valeria!"
    # (masculino) donde debería ser "Lista". La exclamación de confirmación no
    # se adapta al género. Fix en CAMBIO-09.

  @passing
  Escenario: Nombre ambiguo, trato neutro
    Dado un prospecto que se presenta como "Alex"
    Cuando avanza por la calificación
    Entonces el bot mantiene un trato neutro sin marcar género sin base

  @passing @critico
  Escenario: Sin nombre todavía, neutro total
    Dado un prospecto que dio el país pero aún no el nombre
    Cuando el bot responde
    Entonces el bot no usa ningún término con género
    Pero el bot sigue pidiendo el nombre
    # Verificado en vivo y por análisis estático: SALUDO, PREGUNTA_NOMBRE_PAIS,
    # PREGUNTA_PAIS y PREGUNTA_PAIS_REINTENTO son 100% neutros.

  @passing @cambio-09
  Escenario: La ocupación no pisa el nombre real
    Dado una prospecta que dijo "me llamo Laura"
    Cuando más adelante dice "soy enfermera"
    Entonces el bot la sigue llamando Laura
    Pero el bot no la trata como "enfermera"
    # La aserción propia PASA (conserva "Laura"). Arrastra el defecto "Listo"
    # de CAMBIO-09.
