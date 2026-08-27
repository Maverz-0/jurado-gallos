# Jurado de gallos

App para puntuar batallas de gallos en directo, intervención a intervención,
con entre 2 y 10 batalleros. Pensada para usarse desde el iPhone, instalada en
la pantalla de inicio.

**https://maverz-0.github.io/jurado-gallos/**

HTML, CSS y JavaScript puro: sin frameworks, sin dependencias y sin paso de
compilación. Las batallas se guardan en IndexedDB, en el propio dispositivo.

## Ejecutarla en local

Hace falta servirla por HTTP. Abriendo el `index.html` a pelo (`file://`) no
funcionan ni los módulos ES, ni IndexedDB, ni el service worker.

```sh
python -m http.server 8080
```

Y abrir <http://127.0.0.1:8080/>. Vale cualquier servidor estático; `127.0.0.1`
cuenta como contexto seguro, así que el service worker se registra igual.

**Al tocar código, ojo con el service worker.** Va primero a la caché, así que
seguirá sirviendo la versión anterior por mucho que recargues. Mientras
desarrollas, lo más rápido es limpiarlo desde la consola del navegador:

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const n of await caches.keys()) await caches.delete(n);
location.reload();
```

## Desplegarla

GitHub Pages sirve la rama `main` desde la raíz: **basta con hacer push**.

```sh
git push
```

Dos cosas que hay que respetar para no romper la versión publicada:

- **Todas las rutas, relativas** (`./app.js`, nunca `/app.js`). El sitio se
  sirve desde un subdirectorio, así que una ruta absoluta se saldría fuera.
  Esto vale también para `start_url` y `scope` del manifest.
- **Subir la versión de la caché en `sw.js`** al tocar cualquier recurso. Si no,
  quien ya tenga la versión antigua la seguirá viendo desde su caché.

El archivo `.nojekyll` de la raíz evita que Pages procese el sitio con Jekyll.

## Iconos

Se generan con un script; sólo hay que volver a ejecutarlo si se cambia el
diseño, porque los PNG van versionados.

```sh
python tools/generar-iconos.py   # necesita Pillow
```

## Cómo está montado

```
index.html      las diez vistas
styles.css      sistema de diseño iOS, con todos los valores en :root
sw.js           precacheo y aviso de versión nueva
manifest.json
js/
  app.js        punto de entrada, pila de navegación
  scoring.js    lógica de la batalla en curso: pura, sin DOM y testeable
  storage.js    la única parte que conoce IndexedDB
  history.js    resultados anteriores
  transfer.js   exportar e importar
  share.js      el acta y la clasificación, en imagen o en texto
  compat.js     traducción de los esquemas anteriores
  filters.js    lógica de unos filtros: pura, como scoring.js
  filters-view.js  sus pantallas: preparar, votar y clasificar
  dom.js        cuatro utilidades de pintado compartidas
```

`scoring.js` no toca el DOM ni lee el reloj: recibe un estado y devuelve otro.
`storage.js` es la única frontera con IndexedDB, de modo que cambiar el
almacenamiento por uno en la nube es reescribir ese archivo y nada más.

## El inicio

Sólo cuatro cosas: **Batalla**, **Filtros**, **Resultados anteriores** y **Copia
de seguridad**. Cada modo abre su propia pantalla de preparación, así que el
inicio no enseña nunca opciones de algo que todavía no has elegido.

## Gallos

Se preparan en **Batalla**: entre 2 y 10, reordenables arrastrando por el
agarre de la derecha. El orden que quede es el turno de intervención. Los
nombres en blanco se llaman «Gallo A», «Gallo B»…

Puntuando, el gallo en turno se ve con el cuadro relleno de azul y su fila
teñida. Tocar un marcador lleva el cursor a ese gallo; tocar un cuadrito ya
puesto lo marca para sustituirlo con la siguiente tecla.

## Tramos y modalidades

Una batalla es una **secuencia de tramos**, cada uno con su modalidad. Puede
llevar un 8×8 y después un 4×4, y se pueden añadir tramos ya empezada.

| Modalidad | Intervenciones | Orden |
|---|---|---|
| Dinámica | van saliendo según se puntúa | alterna entre gallos |
| N×N | fijas, se eligen (un 4×4 son 4) | alterna entre gallos |
| Minuto | fijas, se eligen | agota un gallo antes de pasar al siguiente |

Cuando un tramo se llena, el cursor salta solo al siguiente. Si no queda hueco
en ninguno, el teclado se apaga hasta que se añada otro tramo o se termine.

La **réplica** es un tramo más, marcado aparte: nunca se suma al marcador de la
batalla; se muestra debajo, en su propia línea.

Los totales se quedan fijos arriba y sólo se desliza la lista de tramos, que
además se coloca sola en el tramo en curso cada vez que se cambia de uno a otro.

## Escala

La **nota máxima** va de 1 a 10 y se elige al preparar la batalla; el teclado se
monta con las teclas que hagan falta. Con **medios puntos** activados aparece
una tecla «,5» que suma o quita medio punto a la última nota metida (o a la que
esté marcada), sin mover el turno.

La **pantalla siempre encendida** usa la Screen Wake Lock API, disponible en
Safari desde iOS 16.4. Si el navegador no la trae, el interruptor no aparece.
El sistema suelta el bloqueo al salir de la app, así que se vuelve a pedir al
regresar.

## Filtros

El otro modo del inicio. No es una batalla: hay un número indefinido de
participantes repartidos en grupos, todos hacen las mismas intervenciones y al
final clasifican los mejores **del conjunto**, no de su grupo.

- La nota de cada uno es la **media** de sus intervenciones, redondeada a medios
  o a enteros (con medios, un 3,4 se queda en 3,5). También se puede apagar el
  desglose y ponerle a cada participante **una sola nota**.
- Se puntúa alternando dentro de un grupo hasta que todos completan sus
  intervenciones, y sólo entonces se pasa al siguiente.
- Se puede empezar **sin nadie** y apuntar sobre la marcha. Quien llega tarde va
  al último grupo incompleto o abre uno nuevo, y también se le puede meter a la
  fuerza en uno lleno.
- **Editar** saca los mandos de quitar y arrastrar, uno a cada lado del nombre
  para no borrar a nadie queriendo moverlo. Fuera de ese modo no hay nada que
  tocar sin querer junto a los cuadritos. El arrastre cruza grupos: se puede
  cambiar el turno dentro de uno o pasar a otro distinto, y las notas viajan
  con quien se mueve.
- Se guardan y se recuperan como las batallas: van a **Resultados anteriores**,
  se pueden reabrir para seguir añadiéndoles jurados, y lo que quede a medias se
  ofrece al volver a abrir la app.

### Clasificación

Filas por participante, una columna por jurado y el puesto al final. El puesto
lo decide siempre la suma de los jurados: el selector Puntuación/Participación
sólo cambia el orden de las filas. Desempata la media sin redondear y luego el
orden de llegada.

**Añadir jurado** abre un teclado para meter su nota a cada participante, uno
detrás de otro; tocar una casilla suya vuelve a ella para corregirla. Con más de
un jurado aparece la columna de suma.

Cada casilla se colorea según lo que habría pasado contando **sólo a ese
jurado**: verde si además clasifica de verdad, azul si no. Es lo que enseña
dónde discrepan los jurados.

Entre el último que pasa y el primero que no hay una raya, verde por arriba y
roja por abajo. Y si los dos llevan la misma puntuación, el corte lo ha decidido
el desempate y no la nota: los empatados salen en **amarillo** y la raya se
parte en dos, la verde por encima del primero y la roja por debajo del último,
de modo que se ve de un vistazo a quiénes les cabe discusión.

**Guardar y cerrar** los deja en Resultados anteriores y vuelve al inicio.
Reabrirlos desde allí y volver a guardar sobrescribe el mismo registro.

## Compartir

Desde el resultado o desde el detalle del historial, en dos formatos:

- **Imagen**: un PNG con el acta dibujada con Canvas, sin librerías. En WhatsApp
  se ve como una foto, sin que nadie tenga que abrir nada.
- **Texto**: el mismo acta para pegar en un chat.

La clasificación de unos filtros se comparte con lo mismo que se ve en
pantalla: los colores de cada casilla, la raya del corte —partida si hay
empate— y la leyenda que los explica. La raya sale de `rayasDelCorte`, en
`filters.js`, que es de donde la saca también la tabla: si sólo lo supiera una
de las dos, la imagen acabaría contando otra cosa.

Se entregan por `navigator.share`; donde no exista, se descargan.

### El esquema de datos ha cambiado dos veces

Primero, de dos batalleros sueltos (`batalleroA`, `totalA`…) a una lista.
Después, de una tirada de puntuaciones a una secuencia de tramos. Las dos
traducciones viven en `compat.js` y se aplican en dos sitios: al subir de
versión la base de datos, y al importar un `.json` exportado antes del cambio.
Los identificadores se conservan siempre, así que las puntuaciones antiguas
siguen apuntando a quien apuntaban.

## La batalla en curso

Se apunta en cada nota, en un almacén aparte de IndexedDB, para que una llamada
entrante o un cierre a mitad no se lleven por delante una batalla entera. Al
abrir la app, si quedó algo a medias, el inicio ofrece retomarlo.

Nunca hay más de una escritura en vuelo: si llegan notas mientras se está
guardando, se anota que hay que repetir al terminar. Puntuar no espera nunca a
la base de datos.

## Copias de seguridad

En el iPhone una web no puede quedarse conectada a una carpeta del sistema, así
que la copia es manual, desde **Copia de seguridad**:

- El `.json` lleva todo y es el único que se puede reimportar. Al importarlo,
  las batallas que ya existan se descartan por `id`, así que no se duplica nada.
- El `.txt` es para leer o compartir.

Pasadas 10 batallas sin copia, la pantalla de inicio lo recuerda.
