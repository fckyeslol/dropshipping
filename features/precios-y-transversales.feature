# language: es
@grupo-H @precios @transversales
Característica: Precios Premium/VIP y reglas transversales
  Como bot que solo cierra el club por chat
  Quiero no vender Premium/VIP por chat ni cruzar de rama ni inventar links
  Para mantener el guion y la integridad del cierre

  @fixed @cambio-04
  Escenario: Pregunta directa por el precio de Premium
    Dado un prospecto en rama VIP con 3000 USD
    Cuando pregunta directo "¿cuánto cuesta el programa Premium?"
    Entonces el bot puede dar el precio de Premium de 1500 USD
    Pero el bot reencauza a la reunión y no cierra Premium por chat
    Y el bot igual lo lleva a agendar la llamada VIP
    # Observado: el bot se niega del todo a cotizar ("no se da por chat, se
    # explica en la llamada") incluso ante pregunta directa. El reencauce sí
    # funciona y no cierra Premium por chat. Decisión de producto: ¿spec o bot?
    # Ver CAMBIO-04.

  @passing
  Escenario: Pregunta vaga por el precio total
    Dado un prospecto en rama VIP con 3000 USD
    Cuando pregunta vago "¿y cuánto vale todo eso?"
    Entonces el bot no suelta los precios de Premium ni VIP
    Y el bot habla de la reunión o del club de 34 USD

  @passing @critico
  Escenario: Anti-cruce de ramas en la rama de llamada
    Dado un prospecto en rama de llamada con 900 USD
    Cuando pide "algo más barato, tipo una mensualidad económica"
    Entonces el bot mantiene la rama de llamada
    Pero el bot no ofrece el club, Skool ni los 34 USD

  @passing
  Escenario: Pide pruebas o testimonios
    Dado una prospecta en la rama del club
    Cuando pide "muéstrame testimonios reales"
    Entonces el bot manda el bloque de casos o el Instagram con casos
    Pero el bot no manda el video gratis

  @passing @critico
  Escenario: Anti-link inventado
    Dado un prospecto en rama llamada VIP con 1200 USD que llega al cierre
    Cuando el bot entrega el cierre
    Entonces el link es un Calendly real de calendly.com
    Pero el bot no escribe un placeholder ni un dominio inventado
