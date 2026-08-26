/**
 * Lógica de la batalla en curso.
 *
 * Este módulo es puro: no toca el DOM, no lee relojes ni genera identificadores.
 * Todas las funciones reciben un estado y devuelven uno nuevo, sin mutar el que
 * les llega, de modo que se puede probar llamándolas directamente.
 *
 * Estado de una batalla:
 *   {
 *     batalleros:   [{ id, nombre }],   // entre 2 y 10, en el orden elegido
 *     puntuaciones: [{ batallero, valor, ts }],  // ordenadas por inserción
 *     cursor:       id del que se está puntuando,
 *     marcada:      índice del voto que se va a sustituir, o null
 *   }
 */

export const MIN_BATALLEROS = 2;
export const MAX_BATALLEROS = 10;

export const NOTA_MIN = 0;
export const NOTA_MAX = 4;

/** Las notas que ofrece el teclado, en el orden en que se pintan. */
export const NOTAS = [0, 1, 2, 3, 4];

export function crearBatalla(batalleros) {
  const limpios = batalleros.map(({ id, nombre }) => ({
    id,
    nombre: (nombre ?? '').trim(),
  }));

  return {
    batalleros: limpios,
    puntuaciones: [],
    cursor: limpios[0]?.id ?? null,
    marcada: null,
  };
}

/** El siguiente en el orden elegido; del último se vuelve al primero. */
export function siguiente(batalla, id) {
  const i = indiceDe(batalla, id);
  if (i < 0) return batalla.batalleros[0]?.id ?? null;
  return batalla.batalleros[(i + 1) % batalla.batalleros.length].id;
}

/**
 * Registra una nota, o sustituye la que estuviera marcada.
 *
 * Al anotar normal el cursor pasa al siguiente. Al sustituir no se mueve: sigue
 * donde estaba, que es donde toca seguir puntuando en cuanto se corrige el voto.
 */
export function anotar(batalla, valor, ts) {
  if (!esNotaValida(valor)) return batalla;

  if (batalla.marcada !== null) {
    const puntuaciones = batalla.puntuaciones.map((puntuacion, i) =>
      i === batalla.marcada ? { ...puntuacion, valor } : puntuacion
    );
    return { ...batalla, puntuaciones, marcada: null };
  }

  if (!batalla.cursor) return batalla;

  return {
    ...batalla,
    puntuaciones: [
      ...batalla.puntuaciones,
      { batallero: batalla.cursor, valor, ts },
    ],
    cursor: siguiente(batalla, batalla.cursor),
  };
}

/**
 * Deshace la última nota introducida, sea de quien sea, y deja el cursor
 * sobre el batallero al que pertenecía: es el que vuelve a tocar.
 *
 * Con un voto marcado no borra nada: sale del modo corrección, que es lo que
 * uno espera al pulsar «borrar» habiendo tocado un cuadrito por error.
 */
export function deshacer(batalla) {
  if (batalla.marcada !== null) return desmarcar(batalla);
  if (batalla.puntuaciones.length === 0) return batalla;

  const ultima = batalla.puntuaciones[batalla.puntuaciones.length - 1];

  return {
    ...batalla,
    puntuaciones: batalla.puntuaciones.slice(0, -1),
    cursor: ultima.batallero,
  };
}

/** Coloca el cursor sobre un batallero concreto. */
export function moverCursor(batalla, id) {
  if (indiceDe(batalla, id) < 0) return batalla;
  if (batalla.cursor === id && batalla.marcada === null) return batalla;

  return { ...batalla, cursor: id, marcada: null };
}

/** Marca un voto ya puesto para sustituirlo. Volver a tocarlo lo desmarca. */
export function marcarVoto(batalla, indice) {
  if (!Number.isInteger(indice)) return batalla;
  if (indice < 0 || indice >= batalla.puntuaciones.length) return batalla;

  return { ...batalla, marcada: batalla.marcada === indice ? null : indice };
}

export function desmarcar(batalla) {
  return batalla.marcada === null ? batalla : { ...batalla, marcada: null };
}

/**
 * Los votos de un batallero, cada uno con el índice que ocupa en la lista
 * completa: es lo que permite marcar un cuadrito suelto para corregirlo.
 */
export function votosDe(batalla, id) {
  const votos = [];
  batalla.puntuaciones.forEach((puntuacion, indice) => {
    if (puntuacion.batallero === id) {
      votos.push({ valor: puntuacion.valor, indice });
    }
  });
  return votos;
}

/** Suma de las notas de un batallero. */
export function total(batalla, id) {
  return batalla.puntuaciones.reduce(
    (suma, puntuacion) =>
      puntuacion.batallero === id ? suma + puntuacion.valor : suma,
    0
  );
}

/** Cuántas notas se le han puesto a un batallero. */
export function cuantasNotas(batalla, id) {
  return batalla.puntuaciones.reduce(
    (cuenta, puntuacion) => (puntuacion.batallero === id ? cuenta + 1 : cuenta),
    0
  );
}

/** El que más votos lleva: marca cuántos cuadritos de ancho tiene la pista. */
export function intervenciones(batalla) {
  return batalla.batalleros.reduce(
    (maximo, batallero) => Math.max(maximo, cuantasNotas(batalla, batallero.id)),
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

function indiceDe(batalla, id) {
  return batalla.batalleros.findIndex((batallero) => batallero.id === id);
}

/**
 * Reconstruye una batalla a partir de lo que se dejó apuntado al cerrarse la
 * app. Devuelve null si lo guardado no cuadra: más vale no ofrecer nada que
 * ofrecer una batalla a medio restaurar con notas que no estaban.
 */
export function restaurarBatalla(datos) {
  if (!datos || typeof datos !== 'object') return null;
  if (!Array.isArray(datos.batalleros) || !Array.isArray(datos.puntuaciones)) {
    return null;
  }

  const batalleros = datos.batalleros.filter(esBatalleroGuardado);
  if (batalleros.length !== datos.batalleros.length) return null;
  if (batalleros.length < MIN_BATALLEROS) return null;

  const ids = new Set(batalleros.map((batallero) => batallero.id));
  if (ids.size !== batalleros.length) return null;

  const valeElVoto = (puntuacion) =>
    !!puntuacion &&
    typeof puntuacion === 'object' &&
    ids.has(puntuacion.batallero) &&
    esNotaValida(puntuacion.valor);

  if (!datos.puntuaciones.every(valeElVoto)) return null;

  return {
    batalleros: batalleros.map(({ id, nombre }) => ({ id, nombre })),
    puntuaciones: datos.puntuaciones.map(({ batallero, valor, ts }) => ({
      batallero,
      valor,
      ts,
    })),
    cursor: ids.has(datos.cursor) ? datos.cursor : batalleros[0].id,
    marcada: null,
  };
}

function esBatalleroGuardado(batallero) {
  return (
    !!batallero &&
    typeof batallero === 'object' &&
    typeof batallero.id === 'string' &&
    batallero.id.length > 0 &&
    typeof batallero.nombre === 'string'
  );
}
