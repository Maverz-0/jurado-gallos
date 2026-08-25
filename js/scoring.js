/**
 * Lógica de la batalla en curso.
 *
 * Este módulo es puro: no toca el DOM, no lee relojes ni genera identificadores.
 * Todas las funciones reciben un estado y devuelven uno nuevo, sin mutar el que
 * les llega, de modo que se puede probar llamándolas directamente.
 */

export const A = 'A';
export const B = 'B';

export const NOTA_MIN = 0;
export const NOTA_MAX = 4;

/** Las notas que ofrece el teclado, en el orden en que se pintan. */
export const NOTAS = [0, 1, 2, 3, 4];

/** Devuelve el batallero contrario al que se le pasa. */
export function contrario(batallero) {
  return batallero === A ? B : A;
}

/**
 * Estado inicial de una batalla. Los nombres se guardan tal cual llegan
 * (recortados); quien los muestre decide qué poner cuando vienen vacíos.
 */
export function crearBatalla(nombreA = '', nombreB = '') {
  return {
    batalleroA: nombreA.trim(),
    batalleroB: nombreB.trim(),
    puntuaciones: [],
    cursor: A,
  };
}

/**
 * Registra una nota para el batallero sobre el que está el cursor y lo pasa
 * al contrario. Las puntuaciones se guardan en una única lista ordenada por
 * inserción: esa ordenación es lo que hace trivial deshacer.
 */
export function anotar(batalla, valor, ts) {
  if (!esNotaValida(valor)) return batalla;

  const puntuacion = { batallero: batalla.cursor, valor, ts };
  return {
    ...batalla,
    puntuaciones: [...batalla.puntuaciones, puntuacion],
    cursor: contrario(batalla.cursor),
  };
}

/**
 * Deshace la última nota introducida, sea de quien sea, y deja el cursor
 * sobre el batallero al que pertenecía: es el que vuelve a tocar.
 */
export function deshacer(batalla) {
  if (batalla.puntuaciones.length === 0) return batalla;

  const puntuaciones = batalla.puntuaciones.slice(0, -1);
  const ultima = batalla.puntuaciones[batalla.puntuaciones.length - 1];

  return { ...batalla, puntuaciones, cursor: ultima.batallero };
}

/** Coloca el cursor sobre un batallero concreto. */
export function moverCursor(batalla, batallero) {
  if (batallero !== A && batallero !== B) return batalla;
  if (batalla.cursor === batallero) return batalla;

  return { ...batalla, cursor: batallero };
}

/** Notas de un batallero, en el orden en que se metieron. */
export function notasDe(batalla, batallero) {
  return batalla.puntuaciones
    .filter((p) => p.batallero === batallero)
    .map((p) => p.valor);
}

/** Suma de las notas de un batallero. */
export function total(batalla, batallero) {
  return batalla.puntuaciones.reduce(
    (suma, p) => (p.batallero === batallero ? suma + p.valor : suma),
    0
  );
}

/** Cuántas notas se le han puesto a un batallero. */
export function cuantasNotas(batalla, batallero) {
  return batalla.puntuaciones.reduce(
    (cuenta, p) => (p.batallero === batallero ? cuenta + 1 : cuenta),
    0
  );
}

/** Una batalla sin ninguna nota no se puede deshacer, ni terminar, ni guardar. */
export function estaVacia(batalla) {
  return batalla.puntuaciones.length === 0;
}

export function esNotaValida(valor) {
  return Number.isInteger(valor) && valor >= NOTA_MIN && valor <= NOTA_MAX;
}
