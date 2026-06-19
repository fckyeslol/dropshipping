# language: es
@grupo-F @cierre
Característica: Disciplina de cierre (rama llamada)
  Como bot en la rama de llamada
  Quiero entregar el link en el turno y no cruzar de rama
  Para cerrar sin anunciar ni repetir

  Antecedentes:
    Dado un prospecto en la rama de llamada

  @passing @critico
  Escenario: Pide explicación antes de agendar
    Dado un prospecto llamado Javier con 800 USD
    Cuando dice "antes de agendar, explícame bien de qué trata todo"
    Entonces el bot habla de la reunión y sus opciones
    Pero el bot no presenta el club ni menciona los 34 USD

  @passing @critico
  Escenario: Anti-anuncio, entrega el link en el mismo turno
    Dado un prospecto llamado Ricardo con 900 USD
    Cuando llega el momento de agendar
    Entonces el bot entrega el link de Calendly en ese mismo turno
    Pero el bot no dice "voy a agendar" ni "un segundo" ni "el equipo te contactará"

  @passing
  Escenario: Confirma después del cierre
    Dado un prospecto llamado Daniel con 1200 USD que ya recibió el Calendly
    Cuando dice "listo, ya agendé"
    Entonces el bot responde corto
    Pero el bot no repite el link de Calendly
