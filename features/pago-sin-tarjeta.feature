# language: es
@grupo-D @pago
Característica: Sub-flujos de pago sin tarjeta (rama club)
  Como bot en la rama del club
  Quiero resolver la falta de tarjeta según el país
  Para cerrar el club o derivar con calidez

  Antecedentes:
    Dado un prospecto en la rama del club que aceptó el club de 34 USD

  @passing
  Escenario: Colombia sin tarjeta usa Nequi
    Dado un prospecto colombiano llamado Andrés
    Cuando dice "no tengo tarjeta, solo manejo efectivo"
    Entonces el bot le ofrece abrir Nequi gratis
    Cuando el prospecto confirma que ya tiene Nequi
    Entonces el bot entrega el link de Skool

  @passing
  Escenario: Fuera de Colombia, un familiar paga
    Dado un prospecto argentino llamado Roberto
    Cuando dice "no tengo tarjeta, solo efectivo"
    Entonces el bot pregunta si un familiar puede ayudarlo
    Cuando el prospecto dice "mi primo me puede prestar"
    Entonces el bot entrega el link de Skool

  @passing
  Escenario: Fuera de Colombia, nadie puede prestar
    Dado un prospecto chileno llamado Luis
    Cuando dice "no tengo tarjeta" y "nadie puede prestarme"
    Entonces el bot entrega el video gratis
    Pero el bot no sigue insistiendo en el pago

  @passing @critico
  Escenario: No ofrecer Nequi/familiar sin gatillo
    Dado un prospecto en la rama del club que no mencionó problemas de pago
    Cuando el prospecto acepta el club
    Entonces el bot entrega el club directo
    Pero el bot no ofrece Nequi ni familiar de forma proactiva
