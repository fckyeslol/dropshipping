# language: es
@grupo-B @gates
Característica: Gates de entrada (país + nombre antes de calificar)
  Como bot que se hace pasar por Brayan
  Quiero exigir país y nombre real antes de calificar
  Para no asumir identidad/género ni avanzar sin los datos que definen el cierre

  Antecedentes:
    Dado un prospecto nuevo sin sesión previa

  @passing
  Escenario: Solo saluda
    Cuando el prospecto envía "Hola"
    Entonces el bot pide el nombre y el país en un mismo mensaje
    Y el bot no asume ningún género

  @passing
  Escenario: Da nombre pero no país
    Cuando el prospecto envía "Soy Camila, vengo de la landing"
    Entonces el bot pregunta solo por el país
    Pero el bot no vuelve a pedir el nombre

  @passing
  Escenario: Responde con ciudad o departamento
    Dado que el bot ya pidió nombre y país
    Cuando el prospecto envía "Soy Carlos, de Chocó"
    Entonces el bot deduce que el país es Colombia
    Y el bot avanza a la calificación sin volver a pedir el país

  @fixed @cambio-03
  Escenario: Responde con un país no reconocido
    Dado que el bot ya pidió nombre y país tras un saludo
    Cuando el prospecto envía "Soy Pedro, de Wakanda"
    Entonces el bot debería repreguntar el país con una frase distinta a la inicial
    # Observado: el 1er país inválido recibe la pregunta estándar; solo el 2º
    # intento ("vivo en la luna") usa la frase de reintento. Causa: el reintento
    # mira el historial, pero el saludo no lo escribe. Fix en CAMBIO-03.

  @fixed @critico @cambio-02
  Escenario: Da un apodo en vez de nombre
    Dado que el bot ya pidió nombre y país
    Cuando el prospecto envía "Soy Parce, de Colombia"
    Entonces el bot debería rechazar "Parce" por ser un apodo
    Y el bot debería pedir el nombre real
    # Observado: el bot responde "Listo, Parce!" y avanza. Causa: NO_NOMBRES no
    # incluye apodos (index.js:324). Fix en CAMBIO-02.

  @fixed @critico @cambio-02
  Escenario: Insiste con otro apodo
    Dado que el bot pidió el nombre real tras un primer apodo
    Cuando el prospecto envía "bro, de Colombia"
    Entonces el bot debería seguir pidiendo el nombre real
    Pero el bot no debería aceptar "bro" como nombre
