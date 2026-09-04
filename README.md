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

El precacheo pide los recursos con `cache: 'reload'`, que salta la caché del
navegador. Pages los sirve con `max-age=600`, así que sin eso la instalación se
llevaba lo que hubiera guardado el navegador y una versión nueva podía acabar
con archivos de la anterior dentro: decía ser nueva y corría código viejo.

El archivo `.nojekyll` de la raíz evita que Pages procese el sitio con Jekyll.

### Cómo llega una versión nueva

El service worker nuevo se instala y **se queda esperando** en vez de tomar el
relevo solo: recargar a mitad de una batalla la perdería. Mientras espera, el
inicio enseña el aviso, y el relevo lo pide el usuario con «Actualizar».

Lo que hace que llegue es **preguntar cada vez que se vuelve a la app**, no sólo
al cargarla. Instalada en el móvil casi nunca se recarga: se deja abierta y se
vuelve a ella al día siguiente sin que la página se cargue otra vez, de modo que
mirar sólo al registrar dejaba la versión nueva sin descubrir durante días. Se
mira en `visibilitychange` y en `pageshow`, como mucho una vez por minuto.

Al final de **Novedades** se ve qué versión está puesta. Se la pregunta al
service worker por `postMessage`, no se apunta a mano en otro sitio: sería otro
número que mantener y acabaría diciendo una cosa distinta.

## Iconos

Se generan con un script; sólo hay que volver a ejecutarlo si se cambia el
diseño, porque los PNG van versionados.

```sh
python tools/generar-iconos.py   # necesita Pillow
```

## Cómo está montado

```
index.html      las once vistas
styles.css      sistema de diseño iOS, con todos los valores en :root
sw.js           precacheo y aviso de versión nueva
manifest.json
js/
  app.js        punto de entrada, pila de navegación
  scoring.js    lógica de la batalla en curso: pura, sin DOM y testeable
  storage.js    la única parte que conoce IndexedDB
  history.js    resultados anteriores
  news.js       las notas de parche y su señal
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

**Batalla**, **Filtros**, **Resultados anteriores**, **Copia de seguridad** y
**Novedades**. Cada modo abre su propia pantalla de preparación, así que el
inicio no enseña nunca opciones de algo que todavía no has elegido.

## Novedades

Las notas de parche, escritas a mano en `news.js`, de lo más nuevo a lo más
viejo. Cada entrada lleva título, fecha y, al desplegarla, lo que cambió.

**Al añadir una entrada arriba, la señal se enciende sola** para todo el que
abra la app: lo que decide si hay aviso es el `id` de la primera comparado con
el que el usuario dio por leído. Ese `id` no se toca una vez publicado.

La señal —exclamación y borde naranja alrededor de la sección— se apaga de dos
maneras: entrando a leerla, o sola a los tres días de la primera vez que se
abrió la app con ella. Lo segundo hace falta porque quien no piense entrar
tampoco tiene por qué cargar con la exclamación para siempre. Las dos cosas se
recuerdan en `localStorage`: no son datos de batallas.

## Gallos

Se preparan en **Batalla**: entre 2 y 10, reordenables arrastrando por el
agarre de la derecha. El orden que quede es el turno de intervención. Los
nombres en blanco se llaman «Gallo A», «Gallo B»…

Puntuando, el gallo en turno se ve con el marcador relleno de azul y su fila
teñida, y además se resalta **la casilla exacta** donde va a caer la siguiente
nota. Tocar un marcador lleva el cursor a ese gallo; tocar un cuadrito ya
puesto lo marca para sustituirlo con la siguiente tecla, y mientras hay uno
marcado no se resalta ninguna casilla: la siguiente nota va a ese.

## Tramos y modalidades

Una batalla es una **secuencia de tramos**, cada uno con su modalidad. Puede
llevar un 8×8 y después un 4×4, y se pueden añadir tramos ya empezada.

La modalidad dice **en qué orden se pasa de un gallo a otro**, y nada más:

| Modalidad | Orden |
|---|---|
| 4×4 | alterna de uno en uno |
| 8×8 | alterna de dos en dos: dos seguidas a cada gallo |
| Minuto | agota un gallo antes de pasar al siguiente |

En un 8×8 los cuadritos se separan en parejas, para poder contarlas de un
vistazo sin ir siguiendo los ordinales.

**Cada tramo lo abre un gallo distinto**: el primero lo abre el primero, el
siguiente lo abre el segundo, y así dando la vuelta. Si un 8×8 lo abrió uno, el
4×4 que venga después lo abre el otro. En los tramos que quedan por delante se
marca flojito quién los abrirá.

**Las filas de cada tramo van en su orden de intervención**, no en el de la
lista: el que abre arriba y los demás detrás, dando la vuelta. Así el bloque se
lee de arriba abajo según van saliendo. Los marcadores de arriba no se mueven:
llevan el total de la batalla, que no va por tramos.

Eso lo aplican los tres caminos por los que se llega a un tramo: cuando se llena
el anterior, cuando se añade uno con la batalla empezada, y cuando se toca un
hueco suyo. Este último hace falta porque un tramo sin número fijo no se llena
nunca y por tanto no cede el turno solo: tocar un hueco de una modalidad que no
ha empezado dice «vamos con ésta», no a quién le toca. **Ya dentro de ella**, y
en cuanto tiene alguna nota, tocar un hueco o un marcador lleva el turno justo
ahí, que es la manera de saltarse el orden cuando hace falta.

**Cuántas intervenciones** hay se elige aparte, y por debajo del 1 está
**Indefinido**, que es lo que trae puesto: las intervenciones van saliendo
según se puntúa y el tramo no se llena nunca. Un tramo así enseña siempre una
casilla vacía de más, que es el sitio de la siguiente nota. Con un número fijo, en cambio,
cada gallo tiene su cupo, y cuando el tramo se llena el cursor salta solo al
siguiente. Si no queda hueco en ninguno, el teclado se apaga hasta que se añada
otro tramo o se termine.

Un **Minuto indefinido** no cede el turno solo, porque no hay cupo que agotar:
se pasa al siguiente gallo tocándolo, que es lo que uno hace cuando se acaba el
minuto.

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

### El esquema de datos ha cambiado tres veces

Primero, de dos batalleros sueltos (`batalleroA`, `totalA`…) a una lista.
Después, de una tirada de puntuaciones a una secuencia de tramos. Y por último,
la dinámica y el N×N pasaron a ser un 4×4 sin y con número de intervenciones:
en las dos se alternaba de uno en uno, así que la traducción no mueve ni una
nota. Las tres viven en `compat.js` y se aplican en dos sitios: al subir de
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
