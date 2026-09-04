/**
 * Service worker: deja la app entera guardada para que arranque sin red.
 *
 * SUBE LA VERSIÓN DE LA CACHÉ AL TOCAR CUALQUIER RECURSO DE LOS DE ABAJO.
 * Si no, los navegadores que ya tengan la versión vieja seguirán sirviéndola
 * desde la caché y no verán el cambio nunca.
 */

const CACHE = 'jurado-gallos-v18';

/** Todo lo que hace falta para arrancar. Rutas relativas: esto vive en un
    subdirectorio de github.io, donde una ruta absoluta se saldría del sitio. */
const RECURSOS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/app.js',
  './js/scoring.js',
  './js/storage.js',
  './js/history.js',
  './js/news.js',
  './js/transfer.js',
  './js/compat.js',
  './js/share.js',
  './js/dom.js',
  './js/filters.js',
  './js/filters-view.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      /**
       * `reload` salta la caché del navegador y va a la red de verdad.
       *
       * Sin esto la instalación se llevaba lo que hubiera en la caché HTTP, y
       * GitHub Pages sirve los recursos con diez minutos de validez: el service
       * worker nuevo acababa guardando dentro los archivos de la versión
       * anterior. Sale una versión que dice ser nueva y corre código viejo, que
       * es la peor forma posible de «actualizar».
       */
      cache.addAll(RECURSOS.map((ruta) => new Request(ruta, { cache: 'reload' })))
    )
  );
  // No se llama a skipWaiting(): la versión nueva espera a que la app avise y
  // sea el usuario quien decida recargar, para no cambiarle el suelo a mitad
  // de una batalla.
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith('jurado-gallos-') && nombre !== CACHE)
          .map((nombre) => caches.delete(nombre))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  evento.respondWith(responder(peticion));
});

/** Primero la caché: son recursos estáticos y así arranca igual sin red. */
async function responder(peticion) {
  const cache = await caches.open(CACHE);

  const guardada = await cache.match(peticion, { ignoreSearch: true });
  if (guardada) return guardada;

  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok && respuesta.type === 'basic') {
      cache.put(peticion, respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    // Sin red, cualquier navegación se resuelve con la página ya guardada.
    if (peticion.mode === 'navigate') {
      const inicio = await cache.match('./index.html');
      if (inicio) return inicio;
    }
    throw error;
  }
}

self.addEventListener('message', (evento) => {
  // La app pide el relevo cuando el usuario pulsa «Actualizar».
  if (evento.data?.tipo === 'ACTIVAR_YA') self.skipWaiting();

  // Y pregunta qué versión está sirviendo, para poder enseñarla en Novedades:
  // es la forma de salir de dudas cuando algo «no se ha actualizado».
  if (evento.data?.tipo === 'QUE_VERSION') {
    evento.source?.postMessage({ tipo: 'VERSION', version: CACHE });
  }
});
