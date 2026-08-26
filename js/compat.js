/**
 * Traducción de los esquemas anteriores.
 *
 * Hace falta en dos sitios: al subir de versión la base de datos, para las
 * batallas ya guardadas, y al importar un .json exportado hace tiempo.
 *
 * Han pasado dos cosas, en este orden:
 *
 *   1. De dos batalleros sueltos a una lista.
 *      { batalleroA, totalA, … }  →  { batalleros: [{ id, nombre, total }] }
 *
 *   2. De una tirada de puntuaciones a una secuencia de tramos.
 *      { puntuaciones: [{ batallero, … }] }
 *        →  { tramos: [{ id, modalidad, … }], puntuaciones: [{ tramo, … }] }
 *
 * Los identificadores se conservan siempre, así que las puntuaciones antiguas
 * siguen apuntando a quien apuntaban.
 */

const VIEJOS = [
  { id: 'A', campoNombre: 'batalleroA', campoTotal: 'totalA' },
  { id: 'B', campoNombre: 'batalleroB', campoTotal: 'totalB' },
];

/** Lo que era una batalla entera pasa a ser su único tramo, en dinámica. */
const TRAMO_UNICO = 't1';

/** Deja un registro en el esquema de hoy, venga de donde venga. */
export function alDia(registro) {
  return aTramos(aVariosBatalleros(registro) ?? registro) ?? registro;
}

/**
 * Paso 1. Devuelve el registro convertido, o null si no hay nada que hacer:
 * o ya viene con lista de batalleros, o no se parece a nada que sepamos leer.
 */
export function aVariosBatalleros(registro) {
  if (!registro || typeof registro !== 'object') return null;
  if (Array.isArray(registro.batalleros)) return null;
  if (!Array.isArray(registro.puntuaciones)) return null;

  const tieneLosDos = VIEJOS.every(
    ({ campoNombre }) => typeof registro[campoNombre] === 'string'
  );
  if (!tieneLosDos) return null;

  const {
    batalleroA,
    batalleroB,
    totalA,
    totalB,
    puntuaciones,
    ...resto
  } = registro;

  return {
    ...resto,
    batalleros: VIEJOS.map(({ id, campoNombre, campoTotal }) => ({
      id,
      nombre: registro[campoNombre],
      total: Number.isFinite(registro[campoTotal])
        ? registro[campoTotal]
        : sumaDe(puntuaciones, id),
      replica: 0,
    })),
    puntuaciones,
  };
}

/** Paso 2. Mete todo lo que había en un único tramo dinámico. */
export function aTramos(registro) {
  if (!registro || typeof registro !== 'object') return null;
  if (Array.isArray(registro.tramos)) return null;
  if (!Array.isArray(registro.batalleros)) return null;
  if (!Array.isArray(registro.puntuaciones)) return null;

  const convertido = {
    ...registro,
    batalleros: registro.batalleros.map((batallero) => ({
      ...batallero,
      replica: Number.isFinite(batallero.replica) ? batallero.replica : 0,
    })),
    tramos: [
      {
        id: TRAMO_UNICO,
        modalidad: 'dinamica',
        intervenciones: null,
        replica: false,
      },
    ],
    puntuaciones: registro.puntuaciones.map((puntuacion) => ({
      ...puntuacion,
      tramo: TRAMO_UNICO,
    })),
  };

  // En una batalla a medias el cursor era sólo el id del gallo; ahora dice
  // también en qué tramo está. Sin esto se perdería el turno al actualizar.
  if (typeof registro.cursor === 'string') {
    convertido.cursor = { tramo: TRAMO_UNICO, batallero: registro.cursor };
  }

  return convertido;
}

function sumaDe(puntuaciones, id) {
  return puntuaciones.reduce(
    (suma, puntuacion) =>
      puntuacion?.batallero === id && Number.isFinite(puntuacion.valor)
        ? suma + puntuacion.valor
        : suma,
    0
  );
}
