/**
 * Única capa que habla con IndexedDB.
 *
 * Nadie más en la app debe conocer IndexedDB: si algún día las batallas pasan
 * a guardarse en la nube, se reescribe este archivo y el resto no se entera.
 * Todo lo que sale de aquí son promesas y objetos planos.
 *
 * Esquema de una batalla guardada:
 *   { id, fecha, batalleroA, batalleroB, puntuaciones, totalA, totalB }
 *
 * Aparte hay un segundo almacén con una sola entrada: la batalla que se está
 * puntuando ahora mismo, para que sobreviva a que la app se cierre a mitad.
 */

const DB_NOMBRE = 'jurado-gallos';
const DB_VERSION = 2;
const ALMACEN = 'batallas';
const BORRADOR = 'borrador';

/** El borrador es siempre uno solo, así que va bajo una clave fija. */
const EN_CURSO = 'en-curso';

let promesaDB = null;

/**
 * Abre la base de datos una sola vez y reutiliza la conexión.
 *
 * Cada almacén se crea sólo si falta, de modo que subir de versión añade lo
 * nuevo sin tocar las batallas que ya estén guardadas.
 */
function abrirDB() {
  if (promesaDB) return promesaDB;

  promesaDB = new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;

      if (!db.objectStoreNames.contains(ALMACEN)) {
        const almacen = db.createObjectStore(ALMACEN, { keyPath: 'id' });
        almacen.createIndex('fecha', 'fecha');
      }

      if (!db.objectStoreNames.contains(BORRADOR)) {
        db.createObjectStore(BORRADOR);
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

function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Persiste una batalla terminada y devuelve el registro tal y como ha quedado
 * guardado. Recibe el estado en memoria de scoring.js más los totales ya
 * calculados, para no duplicar aquí esa lógica.
 */
export async function guardarBatalla({
  batalleroA,
  batalleroB,
  puntuaciones,
  totalA,
  totalB,
}) {
  const registro = {
    id: nuevoId(),
    fecha: new Date().toISOString(),
    batalleroA,
    batalleroB,
    puntuaciones: puntuaciones.map(({ batallero, valor, ts }) => ({
      batallero,
      valor,
      ts,
    })),
    totalA,
    totalB,
  };

  await conTransaccion(ALMACEN, 'readwrite', (almacen) => almacen.add(registro));
  return registro;
}

/**
 * Todas las batallas, de la más reciente a la más antigua. Recorre el índice
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
export async function guardarBorrador({
  batalleroA,
  batalleroB,
  puntuaciones,
  cursor,
}) {
  const borrador = {
    batalleroA,
    batalleroB,
    cursor,
    puntuaciones: puntuaciones.map(({ batallero, valor, ts }) => ({
      batallero,
      valor,
      ts,
    })),
    actualizado: new Date().toISOString(),
  };

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
