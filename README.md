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
index.html      las cinco vistas
styles.css      sistema de diseño iOS, con todos los valores en :root
sw.js           precacheo y aviso de versión nueva
manifest.json
js/
  app.js        punto de entrada, pila de navegación
  scoring.js    lógica de la batalla en curso: pura, sin DOM y testeable
  storage.js    la única parte que conoce IndexedDB
  history.js    resultados anteriores
  transfer.js   exportar e importar
  compat.js     traducción del esquema viejo, el de sólo dos batalleros
```

`scoring.js` no toca el DOM ni lee el reloj: recibe un estado y devuelve otro.
`storage.js` es la única frontera con IndexedDB, de modo que cambiar el
almacenamiento por uno en la nube es reescribir ese archivo y nada más.

## Batalleros y modalidad

Se preparan en la pantalla de inicio: entre 2 y 10, reordenables arrastrando
por el agarre de la derecha. El orden que quede es el turno de intervención.

Puntuando, el cursor pasa solo al siguiente y del último vuelve al primero;
tocando un marcador se lleva a quien sea. Cada intervención aparece como un
cuadrito en la fila de su batallero, y tocar uno lo marca para sustituirlo con
la siguiente tecla.

La **modalidad dinámica** es la única por ahora: los cuadritos van saliendo
según se meten votos, sin número fijo de intervenciones.

### El esquema de datos ha cambiado

Antes una batalla eran dos batalleros sueltos (`batalleroA`, `totalA`…) y ahora
es una lista. La conversión vive en `compat.js` y se aplica en dos sitios: al
subir de versión la base de datos, y al importar un `.json` exportado antes del
cambio. Los identificadores `A` y `B` se conservan, así que las puntuaciones
antiguas siguen apuntando a quien apuntaban.

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
