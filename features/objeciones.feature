# language: es
@grupo-G @objeciones
Característica: Las 15 objeciones (valida y reencauza al cierre)
  Como bot que recibe objeciones
  Quiero validar cada objeción y reencauzar al cierre del club
  Para no rendirme, no cruzar de rama ni inventar descuentos

  Antecedentes:
    Dado un prospecto en la rama del club al que ya se le presentó el club

  @passing
  Escenario: 1 Me parece muy costoso
    Cuando el prospecto dice "me parece muy costoso"
    Entonces el bot valida y reencauza al cierre del club

  @passing
  Escenario: 2 No tengo el dinero
    Cuando el prospecto dice "ahorita no tengo el dinero"
    Entonces el bot valida y reencauza al cierre del club

  @passing
  Escenario: 3 Me lo tengo que pensar
    Cuando el prospecto dice "me lo tengo que pensar"
    Entonces el bot valida y reencauza al cierre del club

  @passing
  Escenario: 4 Conozco algo más barato
    Cuando el prospecto dice "conozco algo más barato, quiero ver otras opciones"
    Entonces el bot defiende el valor y reencauza al cierre del club

  @parcial @infra
  Escenario: 5 En un rato hago el pago
    Cuando el prospecto dice "en un rato hago el pago"
    Entonces el bot busca cerrar ya y deja claro el siguiente paso
    # Lógica correcta (reta a no aplazar). PARCIAL atribuible a inestabilidad de
    # infra (429 / pérdida de sesión), no al guion. Ver CAMBIO-05.

  @passing @critico
  Escenario: 6 Hablarlo con la pareja (adulto que decide su dinero) presiona
    Dado un prospecto adulto que decide su propio dinero
    Cuando dice "déjame hablarlo con mi esposa primero"
    Entonces el bot presiona suavemente a decidir y pagar ya

  @passing @critico
  Escenario: 7 Permiso de los papás (dependiente) empatiza
    Dado un prospecto que depende de sus papás
    Cuando dice "mi mamá no me deja, necesito permiso"
    Entonces el bot empatiza y no presiona el pago
    Y el bot le ayuda con un plan para presentarlo en casa

  @passing
  Escenario: 8 Tengo el dinero en efectivo
    Cuando el prospecto dice "tengo el dinero pero en efectivo, no en tarjeta"
    Entonces el bot guía cómo pagar igual
    Pero el bot no rechaza ni se rinde

  @passing
  Escenario: 9 Ahora no es el momento
    Cuando el prospecto dice "ahorita no puedo, no es el momento"
    Entonces el bot crea urgencia suave y reencauza con un siguiente paso

  @passing
  Escenario: 10 Pide descuento
    Cuando el prospecto dice "¿no me haces un descuento?"
    Entonces el bot justifica el valor de los 34 USD
    Pero el bot no regala precios arbitrarios

  @fixed @critico @cambio-07
  Escenario: 11 ¿Esto es real o es estafa?
    Cuando el prospecto dice "¿esto es real o es una estafa?"
    Entonces el bot menciona casos reales e invita al Instagram con casos
    Pero el bot no manda el video gratis
    # Observado: manda los 8 casos reales (no video gratis), pero cierra
    # invitando a una llamada en vez de al Instagram; el IG solo sale si lo
    # piden explícito. Ajustar el guion de la objeción 11 para invitar al IG.

  @passing @critico
  Escenario: 12 ¿Me garantizas resultados?
    Cuando el prospecto dice "¿me aseguras que voy a lograrlo?"
    Entonces el bot no promete ni garantiza ingresos
    Y el bot reencauza al cierre
    Pero el bot no manda el video gratis

  @passing
  Escenario: 13 Te pago la quincena
    Cuando el prospecto dice "te pago el día que me paguen, la quincena"
    Entonces el bot busca comprometer con un siguiente paso concreto

  @passing
  Escenario: 14 Prefiero empezar por mi cuenta
    Cuando el prospecto dice "mejor empiezo por mi cuenta, desde abajo"
    Entonces el bot argumenta el valor de la guía frente a hacerlo solo
    Y el bot reencauza al club

  @fixed @critico @cambio-08
  Escenario: 15 ¿Me atiendes tú o tu equipo?
    Cuando el prospecto dice "¿me atiendes tú directamente o alguien de tu equipo?"
    Entonces el bot afirma que es él mismo, Brayan, quien atiende
    Pero el bot no se delata como bot ni asistente
    # Observado: afirma en 1ª persona ("soy yo quien te responde"), pero menciona
    # "el equipo se encarga de lo operativo" 2 veces, lo que abre ambigüedad.
    # Endurecer el guion 15 para minimizar mención de "equipo".
