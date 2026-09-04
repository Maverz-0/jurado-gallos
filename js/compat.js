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
 *   3. La dinámica dejó de ser una modalidad y pasó a ser el número de
 *      intervenciones sin fijar, y el N×N se partió en 4×4 y 8×8.
 *      { modalidad: 'dinamica' | 'nxn' }  →  { modalidad: '4x4' }
 *
 * Los identificadores se conservan siempre, así que las puntuaciones antiguas
 * siguen apuntando a quien apuntaban.
 */

const VIEJOS = [
  { id: 'A', campoNombre: 'batalleroA', campoTotal: 'totalA' },
  { id: 'B', campoNombre: 'batalleroB', campoTotal: 'totalB' },
];

/** Lo que era una batalla entera pasa a ser su único tramo, sin número fijo. */
const TRAMO_UNICO = 't1';

/**
 * Las dos modalidades que ya no existen, y en qué se convierten. Un «dinámica»
 * era un 4×4 sin número de intervenciones fijado, y un «nxn» era un 4×4 con el
 * suyo: en las dos se alternaba de uno en uno, así que nada cambia de sitio.
 */
const MODALIDADES_VIEJAS = {
  dinamica: { modalidad: '4x4', intervenciones: null },
  nxn: { modalidad: '4x4' },
};

/** Deja un registro en el esquema de hoy, venga de donde venga. */
export function alDia(registro) {
  // Unos filtros no pasan por ninguna de las dos traducciones: son de otro tipo.
  if (registro?.tipo === 'filtros') return registro;

  const puesto = aTramos(aVariosBatalleros(registro) ?? registro) ?? registro;
  const nombrado = aModalidadesDeHoy(puesto) ?? puesto;

  // Todo lo guardado antes de que hubiera filtros era una batalla.
  return nombrado?.tipo ? nombrado : { ...nombrado, tipo: 'batalla' };
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

/** Paso 2. Mete todo lo que había en un único tramo sin número fijo. */
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
        modalidad: '4x4',
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

/**
 * Paso 3. Renombra las modalidades que ya no existen. Devuelve null si no hay
 * ninguna que traducir, para no rehacer el registro por gusto.
 */
export function aModalidadesDeHoy(registro) {
  if (!Array.isArray(registro?.tramos)) return null;

  const hayQueTocar = registro.tramos.some(
    (tramo) => MODALIDADES_VIEJAS[tramo?.modalidad]
  );
  if (!hayQueTocar) return null;

  return {
    ...registro,
    tramos: registro.tramos.map((tramo) => {
      const nueva = MODALIDADES_VIEJAS[tramo?.modalidad];
      return nueva ? { ...tramo, ...nueva } : tramo;
    }),
  };
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
