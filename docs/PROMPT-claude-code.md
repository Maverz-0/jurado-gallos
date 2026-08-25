# Prompt para Claude Code — App de puntuación de batallas de gallos

---

## Contexto

Quiero construir en este repositorio una aplicación web para puntuar batallas de gallos (freestyle). La voy a usar desde mi iPhone, instalada en la pantalla de inicio como PWA, y se publicará gratis en GitHub Pages. Tienes acceso a `gh` (GitHub CLI) en este entorno.

Antes de escribir nada, lee el repositorio actual para ver qué hay. Si ya existe estructura, adáptate a ella; si está vacío, empieza de cero.

**Trabaja por fases. Al terminar cada fase, haz commit con un mensaje descriptivo y para a explicarme qué has hecho antes de seguir con la siguiente.** No hagas las cinco fases del tirón.

---

## Restricciones técnicas (importantes)

- **HTML, CSS y JavaScript puro. Sin frameworks, sin bundler, sin paso de compilación, sin `node_modules`.** Usa módulos ES nativos (`<script type="module">`). Si en algún momento crees que necesitas una dependencia, párate y pregúntame antes de añadirla.
- **Todas las rutas deben ser relativas** (`./app.js`, `./icons/icon-192.png`). La app se sirve desde `https://usuario.github.io/nombre-repo/`, es decir, desde un subdirectorio: cualquier ruta absoluta que empiece por `/` romperá la app en producción aunque funcione en local. Esto aplica también al `start_url` del manifest y al registro del service worker.
- Añade un archivo `.nojekyll` en la raíz para que GitHub Pages no procese el sitio con Jekyll.
- Nada de `localStorage` para los datos de las batallas: van en IndexedDB. `localStorage` sí puede usarse para preferencias sueltas (tema, última exportación).

### Estructura de archivos propuesta

```
index.html
styles.css
manifest.json
sw.js
.nojekyll
icons/
  icon-180.png   (apple-touch-icon)
  icon-192.png
  icon-512.png
  icon-512-maskable.png
js/
  app.js         punto de entrada, navegación entre vistas
  scoring.js     lógica de la batalla en curso (pura, sin DOM)
  storage.js     única capa que habla con IndexedDB
  history.js     vista de resultados anteriores
  transfer.js    exportar / importar
```

`scoring.js` debe ser lógica pura y testeable, sin tocar el DOM. `storage.js` es la **única** parte del código que conoce IndexedDB: expón funciones tipo `guardarBatalla()`, `listarBatallas()`, `obtenerBatalla(id)`, `borrarBatalla(id)`. Quiero poder cambiar el backend por uno en la nube más adelante tocando solo ese archivo.

---

## Fase 1 — Pantalla de puntuación

Es el corazón de la app. Que funcione bien esto antes que nada.

**Flujo:**

1. Pantalla de nueva batalla: dos campos de texto para los nombres de los batalleros (A y B).
2. Al empezar, aparece la pantalla de puntuación con ambos nombres, sus marcadores y un teclado numérico del **0 al 4**.
3. Hay un **cursor** que indica a qué batallero se le está puntuando. Empieza en A.
4. Al pulsar un número, se registra esa nota para el batallero del cursor y **el cursor salta automáticamente al otro**. Y así alternando.
5. **Botón de borrar:** deshace la última puntuación introducida, sea de quien sea. El cursor queda situado sobre el batallero cuya nota se acaba de borrar (que es justo el que toca volver a puntuar). Si se pulsa repetidamente, se van deshaciendo las puntuaciones en orden inverso al que se metieron, hasta vaciar la batalla. Si no queda nada que borrar, el botón no hace nada (deshabilitado visualmente).
6. En pantalla, para cada batallero: **suma total**, número de notas puestas y la secuencia de notas introducidas.
7. Botón **Guardar batalla**, que la persiste y vuelve al inicio. Si la batalla está vacía, no se guarda.

**Modelo de datos en memoria:** una lista ordenada por inserción, `[{ batallero: 'A'|'B', valor: 0-4, ts: número }]`. Esa ordenación es lo que hace trivial el deshacer; no uses dos arrays separados.

**Detalle de uso real:** voy a estar puntuando en directo, deprisa y a veces sin mirar. Los botones tienen que ser grandes y la respuesta inmediata. Nada de confirmaciones ni diálogos en el flujo de puntuación.

En esta fase puedo probar en el navegador del ordenador, así que déjala funcionando ahí antes de pasar a lo siguiente.

---

## Fase 2 — Persistencia e historial

**Almacenamiento:** IndexedDB. Escribe un envoltorio fino basado en promesas dentro de `storage.js`; no hace falta librería.

Esquema de una batalla guardada:

```js
{
  id: string,              // uuid o timestamp + aleatorio
  fecha: string,           // ISO 8601
  batalleroA: string,
  batalleroB: string,
  puntuaciones: [{ batallero, valor, ts }],
  totalA: number,
  totalB: number
}
```

Llama a `navigator.storage.persist()` al arrancar la app, para pedirle al sistema que no purgue estos datos.

**Vista "Resultados anteriores":**

- Lista de batallas ordenada de más reciente a más antigua: nombres, marcador final y fecha.
- Al tocar una, detalle con la secuencia completa de puntuaciones.
- Poder borrar una batalla (esto sí con confirmación).
- Estado vacío bien resuelto: cuando no hay batallas, un mensaje que invite a crear la primera, no una pantalla en blanco.

---

## Fase 3 — Exportar e importar

En iPhone no existe forma de que una web se conecte de manera permanente a una carpeta del sistema (Safari no implementa los selectores de la File System Access API), así que la copia de seguridad es manual:

- **Exportar:** genera un archivo y lo pasa a la hoja de compartir de iOS mediante un `Blob` y un `<a download>`. Dos botones: uno de `.txt` legible por humanos (batalla, fecha, nombres, secuencia de notas, totales) y otro de `.json` completo, pensado para reimportar.
- **Importar:** un `<input type="file">` que lee un `.json` exportado antes y fusiona las batallas, **descartando las que ya existan por `id`** para no duplicar.
- **Aviso de copia:** guarda en `localStorage` la fecha de la última exportación. Si hay más de 10 batallas nuevas desde entonces, muestra un aviso discreto y no bloqueante en la pantalla de inicio, con acceso directo a exportar.

---

## Fase 4 — Convertirla en PWA

- `manifest.json`: nombre, nombre corto, `display: "standalone"`, `start_url: "./"`, `scope: "./"`, colores de tema y fondo, e iconos 192 y 512 (más una variante maskable).
- Genera tú los iconos con un script (Python + Pillow vale) a partir de un diseño simple: quiero algo sobrio y legible en la pantalla de inicio, coherente con el estilo Apple de la interfaz. Nada de emojis.
- Meta tags en `index.html`:
  - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  - `<link rel="apple-touch-icon" href="./icons/icon-180.png">`
  - `<meta name="mobile-web-app-capable" content="yes">` y `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- **Service worker** con precacheo de todos los recursos. Ojo aquí, que es la fuente número uno de problemas:
  - Versiona el nombre de la caché con una constante en lo alto de `sw.js`, y limpia las cachés antiguas en el evento `activate`.
  - Estrategia cache-first para los recursos estáticos.
  - Cuando haya una versión nueva esperando, muéstrame un aviso en la app con un botón para recargar. **No quiero quedarme atrapado en una versión antigua sin enterarme.**

---

## Fase 5 — Publicación

Usando `gh`:

1. Comprueba que el repositorio existe y es público (Pages gratuito lo requiere).
2. Activa GitHub Pages sobre la rama `main`, carpeta raíz.
3. Haz push y confírmame la URL final.
4. Explícame en dos líneas cómo añadirla a la pantalla de inicio desde Safari.

---

## Dirección de diseño: estilo Apple

Quiero que la interfaz parezca una app nativa de iOS, no una web. Sigue las Human Interface Guidelines de Apple de forma literal: en este punto no busco originalidad, busco que se sienta como algo hecho por Apple. Define los valores como variables CSS en `:root` y no metas colores sueltos por el código.

**Tipografía.** La pila de sistema: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`. Nada de Google Fonts. Respeta la escala tipográfica de iOS: título grande 34px bold, título de sección 22px semibold, cuerpo 17px, nota al pie 13px. Los números del marcador piden cifras tabulares: `font-variant-numeric: tabular-nums` para que no bailen al cambiar.

**Color.** Los colores del sistema iOS, con soporte de modo claro y oscuro vía `prefers-color-scheme`:

- Fondo agrupado: `#F2F2F7` en claro, `#000000` en oscuro.
- Superficie de tarjeta: `#FFFFFF` en claro, `#1C1C1E` en oscuro.
- Azul del sistema `#007AFF` como color de acento y acción.
- Rojo del sistema `#FF3B30` para borrar y acciones destructivas.
- Texto secundario y separadores con las opacidades del sistema, no grises inventados.

**Layout.** Tarjetas agrupadas al estilo de la app Ajustes: bloques redondeados de 10–12px de radio sobre el fondo gris, con separadores finos entre filas que no llegan al borde izquierdo. Barra de navegación superior con título grande. Espaciado generoso y consistente, en múltiplos de 4.

**Controles táctiles.**

- Teclado numérico: botones de al menos 60px de lado, en rejilla, cómodos para el pulgar.
- Realimentación al pulsar: `:active` con un ligero escalado (0.96) y cambio de opacidad, con una transición de unos 100ms. Debe sentirse instantáneo.
- `touch-action: manipulation` y `user-select: none` en todos los botones, para eliminar el retardo del doble toque y evitar que se seleccione texto al puntuar rápido.
- Los `<input>` con `font-size: 16px` como mínimo, o iOS hará zoom automático al enfocarlos.
- Respeta las zonas seguras: `padding: env(safe-area-inset-top)` y equivalentes, para que el notch y la barra inferior no tapen nada.

**Movimiento.** Transiciones sutiles entre vistas, al estilo de la navegación push de iOS. Sin animaciones decorativas. Respeta `prefers-reduced-motion`.

**Textos de la interfaz.** En español, en tono llano y sin florituras. Los botones dicen exactamente lo que hacen ("Guardar batalla", no "Enviar"), y el nombre de una acción se mantiene igual en todo el flujo.

**Suelo de calidad, sin anunciarlo:** foco de teclado visible, contraste suficiente, y que se vea bien tanto en un iPhone estrecho como en una ventana de escritorio.

---

## Cómo quiero que trabajes

- Una fase, un commit, y paras a contarme qué has hecho.
- Si algo de este documento es ambiguo o contradictorio, pregúntame en vez de decidir por tu cuenta.
- No añadas funcionalidades que no te he pedido. Si se te ocurre algo que crees que mejoraría la app, propónmelo al final de la fase en lugar de implementarlo.
- Escribe un `README.md` breve al final con cómo ejecutarla en local y cómo desplegarla.
