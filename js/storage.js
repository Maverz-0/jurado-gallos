/**
 * Única capa que habla con IndexedDB.
 *
 * Nadie más en la app debe conocer IndexedDB: si algún día las batallas pasan
 * a guardarse en la nube, se reescribe este archivo y el resto no se entera.
 * Todo lo que sale de aquí son promesas y objetos planos.
 *
 * Esquema de una batalla guardada:
 *   {
 *     id, fecha,
 *     batalleros: [{ id, nombre, total, replica }],
 *     tramos:     [{ id, modalidad, intervenciones, replica }],
 *     puntuaciones: [{ tramo, batallero, valor, ts }]
 *   }
 *
 * Aparte hay un segundo almacén con una sola entrada: la batalla que se está
 * puntuando ahora mismo, para que sobreviva a que la app se cierre a mitad.
 */

import { alDia } from './compat.js';

const DB_NOMBRE = 'jurado-gallos';
const DB_VERSION = 4;
const ALMACEN = 'batallas';
const BORRADOR = 'borrador';

/** El borrador es siempre uno solo, así que va bajo una clave fija. */
const EN_CURSO = 'en-curso';

let promesaDB = null;

/**
 * Abre la base de datos una sola vez y reutiliza la conexión.
 *
 * Cada almacén se crea sólo si falta y cada migración mira de qué versión se
 * viene, de modo que subir de versión añade lo nuevo y convierte lo viejo sin
 * perder nada por el camino.
 */
function abrirDB() {
  if (promesaDB) return promesaDB;

  promesaDB = new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);

    solicitud.onupgradeneeded = (evento) => {
      const db = solicitud.result;
      const transaccion = solicitud.transaction;

      if (!db.objectStoreNames.contains(ALMACEN)) {
        const almacen = db.createObjectStore(ALMACEN, { keyPath: 'id' });
        almacen.createIndex('fecha', 'fecha');
      }

      if (!db.objectStoreNames.contains(BORRADOR)) {
        db.createObjectStore(BORRADOR);
      }

      // v3: de dos batalleros sueltos a una lista.
      // v4: de una tirada de puntuaciones a una secuencia de tramos.
      // compat.js sabe traducir desde cualquiera de los dos, así que basta
      // con pasar por aquí una sola vez venga de la versión que venga.
      if (evento.oldVersion > 0 && evento.oldVersion < 4) {
        ponerAlDia(transaccion);
      }
    };

    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
    solicitud.onblocked = () =>
      rechazar(new Error('La base de datos está bloqueada por otra pestaña.'));
  });

  // Si falla la apertura, no dejamos cacheada la promesa rota: el siguiente
  // intento vuelve a probar.
  promesaDB.catch(() => {
    promesaDB = null;
  });

  return promesaDB;
}

/**
 * Envuelve una transacción y resuelve con el resultado de la solicitud, pero
 * sólo cuando la transacción ha terminado de verdad: en una escritura, que la
 * solicitud tenga éxito todavía no garantiza que el dato esté en disco.
 */
async function conTransaccion(nombre, modo, trabajo) {
  const db = await abrirDB();

  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(nombre, modo);
    const almacen = transaccion.objectStore(nombre);

    let solicitud;
    try {
      solicitud = trabajo(almacen);
    } catch (error) {
      transaccion.abort();
      rechazar(error);
      return;
    }

    transaccion.oncomplete = () => resolver(solicitud?.result);
    transaccion.onerror = () => rechazar(transaccion.error);
    transaccion.onabort = () => rechazar(transaccion.error);
  });
}

/**
 * Traduce lo guardado al esquema de hoy. Se hace dentro de la transacción de
 * actualización, así que o se convierte todo o no sube la versión: nunca queda
 * la base a medias.
 */
function ponerAlDia(transaccion) {
  const almacen = transaccion.objectStore(ALMACEN);
  almacen.openCursor().onsuccess = (evento) => {
    const cursor = evento.target.result;
    if (!cursor) return;

    const convertida = alDia(cursor.value);
    if (convertida !== cursor.value) cursor.update(convertida);
    cursor.continue();
  };

  // La batalla a medias, si la había, se convierte igual para no perderla.
  const borradores = transaccion.objectStore(BORRADOR);
  borradores.get(EN_CURSO).onsuccess = (evento) => {
    const guardado = evento.target.result;
    if (!guardado) return;

    const convertido = alDia(guardado);
    if (convertido !== guardado) borradores.put(convertido, EN_CURSO);
  };
}

function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Persiste una batalla terminada y devuelve el registro tal y como ha quedado
 * guardado. Recibe el estado en memoria de scoring.js más los totales ya
 * calculados, para no duplicar aquí esa lógica.
 */
export async function guardarBatalla({ batalleros, tramos, puntuaciones }) {
  const registro = {
    id: nuevoId(),
    fecha: new Date().toISOString(),
    tipo: 'batalla',
    batalleros: batalleros.map(({ id, nombre, total, replica }) => ({
      id,
      nombre,
      total,
      replica,
    })),
    tramos: tramos.map(({ id, modalidad, intervenciones, replica }) => ({
      id,
      modalidad,
      intervenciones,
      replica,
    })),
    puntuaciones: puntuaciones.map(({ tramo, batallero, valor, ts }) => ({
      tramo,
      batallero,
      valor,
      ts,
    })),
  };

  await conTransaccion(ALMACEN, 'readwrite', (almacen) => almacen.add(registro));
  return registro;
}

/**
 * Guarda unos filtros enteros: participantes, jurados y notas. Se guarda el
 * estado completo, no la tabla ya resuelta, para poder reabrirlos y seguir
 * añadiéndoles jurados más tarde.
 *
 * Con `id` sobrescribe los que ya estaban; sin él, crea unos nuevos.
 */
export async function guardarFiltros(filtros, id = null) {
  const registro = {
    ...filtros,
    id: id ?? nuevoId(),
    fecha: filtros.fecha ?? new Date().toISOString(),
    tipo: 'filtros',
    cursor: null,
    marcada: null,
  };

  await conTransaccion(ALMACEN, 'readwrite', (almacen) => almacen.put(registro));
  return registro;
}

/**
 * Todo lo guardado, de lo más reciente a lo más antiguo. Recorre el índice
 * por fecha hacia atrás, así que el orden lo pone la base de datos y no hace
 * falta ordenar nada después.
 */
export async function listarBatallas() {
  const db = await abrirDB();

  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(ALMACEN, 'readonly');
    const indice = transaccion.objectStore(ALMACEN).index('fecha');
    const batallas = [];

    indice.openCursor(null, 'prev').onsuccess = (evento) => {
      const cursor = evento.target.result;
      if (!cursor) return;
      batallas.push(cursor.value);
      cursor.continue();
    };

    transaccion.oncomplete = () => resolver(batallas);
    transaccion.onerror = () => rechazar(transaccion.error);
    transaccion.onabort = () => rechazar(transaccion.error);
  });
}

/** Una batalla por su id, o undefined si ya no está. */
export function obtenerBatalla(id) {
  return conTransaccion(ALMACEN, 'readonly', (almacen) => almacen.get(id));
}

export async function borrarBatalla(id) {
  await conTransaccion(ALMACEN, 'readwrite', (almacen) => almacen.delete(id));
}

/**
 * Añade batallas venidas de una importación y devuelve cuántas han entrado.
 *
 * Se usa `add`, que falla si ya existe una batalla con ese id: ese fallo es
 * justo la señal de que ya la teníamos. Se marca como tratado con
 * preventDefault() para que no tire abajo el resto de la transacción.
 */
export async function importarBatallas(batallas) {
  const db = await abrirDB();

  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(ALMACEN, 'readwrite');
    const almacen = transaccion.objectStore(ALMACEN);
    let anadidas = 0;
    let repetidas = 0;

    for (const batalla of batallas) {
      const solicitud = almacen.add(batalla);
      solicitud.onsuccess = () => {
        anadidas += 1;
      };
      solicitud.onerror = (evento) => {
        repetidas += 1;
        evento.preventDefault();
        evento.stopPropagation();
      };
    }

    transaccion.oncomplete = () => resolver({ anadidas, repetidas });
    transaccion.onerror = () => rechazar(transaccion.error);
    transaccion.onabort = () => rechazar(transaccion.error);
  });
}

// ── Batalla en curso ───────────────────────────────────────────────────────

/**
 * Apunta la batalla que se está puntuando. Se llama en cada nota, así que hace
 * lo mínimo: una escritura sobre una única entrada, sin leer nada antes.
 */
export async function guardarBorrador(estado) {
  // Se guarda tal cual: aquí puede caer una batalla o unos filtros, y cada uno
  // sabe releer lo suyo. Lo único que se añade es cuándo se apuntó.
  const borrador = { ...estado, actualizado: new Date().toISOString() };

  await conTransaccion(BORRADOR, 'readwrite', (almacen) =>
    almacen.put(borrador, EN_CURSO)
  );
}

/** La batalla que quedó a medias, o undefined si no hay ninguna. */
export function leerBorrador() {
  return conTransaccion(BORRADOR, 'readonly', (almacen) =>
    almacen.get(EN_CURSO)
  );
}

export async function olvidarBorrador() {
  await conTransaccion(BORRADOR, 'readwrite', (almacen) =>
    almacen.delete(EN_CURSO)
  );
}

/**
 * Pide al sistema que no purgue estos datos cuando ande justo de espacio.
 * Es una petición, no una garantía: si el navegador la deniega seguimos igual.
 */
export async function pedirPersistencia() {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
