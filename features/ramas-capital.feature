# language: es
@grupo-A @ramas
Característica: Ramas de cierre según el capital (convertido a USD por el sistema)
  Como bot que califica al prospecto
  Quiero rutear determinísticamente por capital en USD
  Para entregar el cierre correcto y nunca cruzar ramas

  Antecedentes:
    Dado un prospecto que ya dio país y nombre
    Y que respondió las preguntas de calificación

  @passing @critico
  Escenario: Capital mayor a 1000 USD va a llamada VIP
    Dado un prospecto llamado Carlos que trabaja
    Cuando declara un capital de "1500 dólares"
    Entonces el bot entrega el bloque de Calendly VIP
    Y el bot pregunta si le queda mejor "hoy o mañana"
    Y el bot usa el nombre del prospecto
    Pero el bot nunca menciona el club, Skool ni los 34 USD

  @passing
  Escenario: Capital entre 600 y 1000 USD va a llamada normal
    Dado una prospecta llamada María que trabaja
    Cuando declara un capital de "700 dólares"
    Entonces el bot entrega el bloque de Calendly normal
    Pero el bot no dice "te faltan"
    Y el bot no menciona el club

  @passing
  Escenario: Capital menor a 600 USD va al club
    Dado un prospecto llamado Diego que trabaja
    Cuando declara un capital de "300 dólares"
    Entonces el bot hace el puente al club
    Cuando el prospecto confirma que quiere cambiar en serio
    Entonces el bot presenta el club por 34 USD al mes
    Y al aceptar el bot entrega el link de Skool
    Pero el bot no ofrece la llamada con el equipo

  @fixed @critico @cambio-01
  Escenario: Prospecto sin nada de dinero
    Dado una prospecta llamada Sofía que es estudiante y depende de sus papás
    Cuando declara "no tengo nada de dinero, ni los 34"
    Entonces el bot debería entregar el video gratis
    Y el bot no debería insistir en el pago
    # Observado: el bot ignora la señal, repite el link de Skool y entra en loop
    # ("¿Ya pudiste entrar al club?"). No hay rama terminal sin_dinero. Fix en CAMBIO-01.
