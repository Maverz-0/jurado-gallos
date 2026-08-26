/**
 * Traducción del esquema viejo, el de exactamente dos batalleros.
 *
 * Hace falta en dos sitios: al subir de versión la base de datos, para las
 * batallas ya guardadas, y al importar un .json exportado antes del cambio.
 *
 * Viejo:  { batalleroA, batalleroB, totalA, totalB, puntuaciones: [{ batallero: 'A'|'B', ... }] }
 * Nuevo:  { batalleros: [{ id, nombre, total }],    puntuaciones: [{ batallero: id, ... }] }
 *
 * Los identificadores 'A' y 'B' se conservan tal cual, así que las
 * puntuaciones no hay que tocarlas: siguen apuntando a quien apuntaban.
 */

const VIEJOS = [
  { id: 'A', campoNombre: 'batalleroA', campoTotal: 'totalA' },
  { id: 'B', campoNombre: 'batalleroB', campoTotal: 'totalB' },
];

/**
 * Devuelve el registro convertido, o null si no hay nada que convertir: o ya
 * viene con lista de batalleros, o no se parece a nada que sepamos leer.
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
    })),
    puntuaciones,
  };
}

/** Lo mismo, pero devolviendo el registro intacto cuando ya está al día. */
export function alDia(registro) {
  return aVariosBatalleros(registro) ?? registro;
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
