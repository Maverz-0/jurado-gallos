/**
 * Única capa que habla con IndexedDB.
 *
 * Nadie más en la app debe conocer IndexedDB: si algún día las batallas pasan
 * a guardarse en la nube, se reescribe este archivo y el resto no se entera.
 * Todo lo que sale de aquí son promesas y objetos planos.
 *
 * Esquema de una batalla guardada:
 *   { id, fecha, batalleroA, batalleroB, puntuaciones, totalA, totalB }
 */

const DB_NOMBRE = 'jurado-gallos';
const DB_VERSION = 1;
const ALMACEN = 'batallas';

let promesaDB = null;

/**
 * Abre la base de datos una sola vez y reutiliza la conexión.
 * El índice por fecha se crea ya aquí para poder listar el historial ordenado
 * sin tener que migrar el esquema más adelante.
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

/** Envuelve una transacción y resuelve cuando termina de escribirse de verdad. */
async function conTransaccion(modo, trabajo) {
  const db = await abrirDB();

  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(ALMACEN, modo);
    const almacen = transaccion.objectStore(ALMACEN);

    let resultado;
    try {
      resultado = trabajo(almacen);
    } catch (error) {
      transaccion.abort();
      rechazar(error);
      return;
    }

    transaccion.oncomplete = () => resolver(resultado);
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

  await conTransaccion('readwrite', (almacen) => almacen.add(registro));
  return registro;
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
