# language: es
@grupo-C @moneda
Característica: Conversión de moneda a USD y ruteo determinístico
  Como sistema (no el LLM)
  Quiero convertir el capital a USD y excluir metas
  Para rutear a la rama correcta sin sobre/subestimar

  Antecedentes:
    Dado un prospecto que ya pasó el gate y la calificación
    Y que el bot le pregunta su capital

  @passing
  Escenario: Bolivianos a USD
    Cuando el prospecto declara "6000 bolivianos"
    Entonces el sistema lo convierte a unos 860 USD
    Y rutea a la rama de llamada normal
    Pero no lo rutea al club ni a VIP

  @passing
  Escenario: Pesos mexicanos a USD
    Cuando el prospecto declara "18 mil pesos mexicanos"
    Entonces el sistema lo convierte a unos 1000 USD
    Y rutea a la rama de llamada

  @passing @critico
  Escenario: Una meta no es capital
    Cuando el prospecto declara "quiero ganar 3000 al mes"
    Entonces el sistema no interpreta 3000 como capital disponible
    Y el bot vuelve a preguntar el capital real

  @passing
  Escenario: Pesos colombianos grandes a USD
    Cuando el prospecto declara "2 millones de pesos colombianos"
    Entonces el sistema lo convierte a unos 500 USD
    Y rutea a la rama del club
