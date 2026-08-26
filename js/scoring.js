/**
 * Lógica de la batalla en curso.
 *
 * Este módulo es puro: no toca el DOM, no lee relojes ni genera identificadores.
 * Todas las funciones reciben un estado y devuelven uno nuevo, sin mutar el que
 * les llega, de modo que se puede probar llamándolas directamente.
 *
 * Una batalla es una secuencia de TRAMOS. Cada tramo tiene su modalidad y, si
 * la modalidad la fija, su número de intervenciones. Una misma batalla puede
 * llevar un 8×8, luego un 4×4 y luego una réplica.
 *
 *   {
 *     batalleros:   [{ id, nombre }],           // entre 2 y 10, en orden
 *     tramos:       [{ id, modalidad, intervenciones, replica }],
 *     puntuaciones: [{ tramo, batallero, valor, ts }],   // por inserción
 *     cursor:       { tramo, batallero },
 *     marcada:      índice del voto a sustituir, o null
 *   }
 */

export const MIN_BATALLEROS = 2;
export const MAX_BATALLEROS = 10;

export const NOTA_MIN = 0;
export const NOTA_MAX = 4;

/** Las notas que ofrece el teclado, en el orden en que se pintan. */
export const NOTAS = [0, 1, 2, 3, 4];

export const MIN_INTERVENCIONES = 1;
export const MAX_INTERVENCIONES = 20;
export const INTERVENCIONES_POR_DEFECTO = 4;

/**
 * `fija`     — el número de intervenciones se decide de antemano.
 * `porGallo` — se recorren todas las intervenciones de un gallo antes de pasar
 *              al siguiente, en vez de ir alternando.
 */
export const MODALIDADES = {
  dinamica: { etiqueta: 'Dinámica', fija: false, porGallo: false },
  nxn: { etiqueta: 'N×N', fija: true, porGallo: false },
  minuto: { etiqueta: 'Minuto', fija: true, porGallo: true },
};

export const MODALIDAD_POR_DEFECTO = 'dinamica';

export function crearTramo({
  id,
  modalidad = MODALIDAD_POR_DEFECTO,
  intervenciones = INTERVENCIONES_POR_DEFECTO,
  replica = false,
} = {}) {
  const cual = MODALIDADES[modalidad] ? modalidad : MODALIDAD_POR_DEFECTO;

  return {
    id,
    modalidad: cual,
    intervenciones: MODALIDADES[cual].fija ? acotar(intervenciones) : null,
    replica: !!replica,
  };
}

export function acotar(intervenciones) {
  const entero = Math.round(Number(intervenciones) || 0);
  return Math.min(MAX_INTERVENCIONES, Math.max(MIN_INTERVENCIONES, entero));
}

export function crearBatalla(batalleros, tramos) {
  const limpios = batalleros.map(({ id, nombre }) => ({
    id,
    nombre: (nombre ?? '').trim(),
  }));

  return {
    batalleros: limpios,
    tramos: tramos.map((tramo) => crearTramo(tramo)),
    puntuaciones: [],
    cursor: { tramo: tramos[0]?.id ?? null, batallero: limpios[0]?.id ?? null },
    marcada: null,
  };
}

// ── Consultas ──────────────────────────────────────────────────────────────

export function tramoDe(batalla, idTramo) {
  return batalla.tramos.find((tramo) => tramo.id === idTramo) ?? null;
}

/** Los votos de un gallo en un tramo, con el índice que ocupan en la lista. */
export function votosDe(batalla, idTramo, idBatallero) {
  const votos = [];
  batalla.puntuaciones.forEach((puntuacion, indice) => {
    if (puntuacion.tramo === idTramo && puntuacion.batallero === idBatallero) {
      votos.push({ valor: puntuacion.valor, indice });
    }
  });
  return votos;
}

export function cuantasNotas(batalla, idTramo, idBatallero) {
  return batalla.puntuaciones.reduce(
    (cuenta, puntuacion) =>
      puntuacion.tramo === idTramo && puntuacion.batallero === idBatallero
        ? cuenta + 1
        : cuenta,
    0
  );
}

export function totalDeTramo(batalla, idTramo, idBatallero) {
  return batalla.puntuaciones.reduce(
    (suma, puntuacion) =>
      puntuacion.tramo === idTramo && puntuacion.batallero === idBatallero
        ? suma + puntuacion.valor
        : suma,
    0
  );
}

/** El marcador de la batalla: suma de los tramos que no son réplica. */
export function total(batalla, idBatallero) {
  return sumarTramos(batalla, idBatallero, (tramo) => !tramo.replica);
}

/** Las réplicas van aparte y no se mezclan nunca con lo anterior. */
export function totalDeReplica(batalla, idBatallero) {
  return sumarTramos(batalla, idBatallero, (tramo) => tramo.replica);
}

export function hayReplica(batalla) {
  return batalla.tramos.some((tramo) => tramo.replica);
}

function sumarTramos(batalla, idBatallero, cuenta) {
  const validos = new Set(
    batalla.tramos.filter(cuenta).map((tramo) => tramo.id)
  );

  return batalla.puntuaciones.reduce(
    (suma, puntuacion) =>
      puntuacion.batallero === idBatallero && validos.has(puntuacion.tramo)
        ? suma + puntuacion.valor
        : suma,
    0
  );
}

/**
 * Cuántas columnas tiene un tramo: las que fije su modalidad o, en dinámica,
 * las que se lleven metidas.
 */
export function anchoDeTramo(batalla, tramo) {
  if (tramo.intervenciones != null) return tramo.intervenciones;

  return batalla.batalleros.reduce(
    (maximo, batallero) =>
      Math.max(maximo, cuantasNotas(batalla, tramo.id, batallero.id)),
    0
  );
}

/** En un tramo de número fijo, cada gallo tiene un cupo que no puede pasar. */
export function tieneCupo(batalla, tramo, idBatallero) {
  if (!tramo) return false;
  if (tramo.intervenciones == null) return true;
  return cuantasNotas(batalla, tramo.id, idBatallero) < tramo.intervenciones;
}

export function tramoCompleto(batalla, tramo) {
  if (tramo.intervenciones == null) return false;
  return batalla.batalleros.every(
    (batallero) => !tieneCupo(batalla, tramo, batallero.id)
  );
}

/** Si no queda hueco en ninguna parte, el teclado no tiene nada que hacer. */
export function puedeAnotar(batalla) {
  if (batalla.marcada !== null) return true;
  return tieneCupo(batalla, tramoDe(batalla, batalla.cursor.tramo), batalla.cursor.batallero);
}

// ── Movimiento del cursor ──────────────────────────────────────────────────

/**
 * El siguiente sitio con hueco: primero el resto del tramo en curso, dando la
 * vuelta por los gallos, y si el tramo se ha llenado, el tramo siguiente.
 */
function siguientePosicion(batalla, cursor) {
  const iTramo = batalla.tramos.findIndex((tramo) => tramo.id === cursor.tramo);
  const iBatallero = batalla.batalleros.findIndex(
    (batallero) => batallero.id === cursor.batallero
  );
  if (iTramo < 0 || iBatallero < 0) return null;

  const cuantos = batalla.batalleros.length;

  for (let salto = 1; salto <= cuantos; salto += 1) {
    const batallero = batalla.batalleros[(iBatallero + salto) % cuantos];
    if (tieneCupo(batalla, batalla.tramos[iTramo], batallero.id)) {
      return { tramo: cursor.tramo, batallero: batallero.id };
    }
  }

  for (let t = iTramo + 1; t < batalla.tramos.length; t += 1) {
    for (const batallero of batalla.batalleros) {
      if (tieneCupo(batalla, batalla.tramos[t], batallero.id)) {
        return { tramo: batalla.tramos[t].id, batallero: batallero.id };
      }
    }
  }

  return null;
}

/** El primer hueco de toda la batalla, mirando desde el principio. */
function primeraPosicionLibre(batalla) {
  for (const tramo of batalla.tramos) {
    for (const batallero of batalla.batalleros) {
      if (tieneCupo(batalla, tramo, batallero.id)) {
        return { tramo: tramo.id, batallero: batallero.id };
      }
    }
  }
  return null;
}

function avanzar(batalla, cursor) {
  const tramo = tramoDe(batalla, cursor.tramo);
  if (!tramo) return cursor;

  // En «minuto» un gallo agota sus intervenciones antes de ceder el turno.
  if (
    MODALIDADES[tramo.modalidad].porGallo &&
    tieneCupo(batalla, tramo, cursor.batallero)
  ) {
    return cursor;
  }

  return siguientePosicion(batalla, cursor) ?? cursor;
}

// ── Cambios de estado ──────────────────────────────────────────────────────

/**
 * Registra una nota, o sustituye la que estuviera marcada.
 *
 * Al anotar normal el cursor avanza según la modalidad del tramo. Al sustituir
 * no se mueve: sigue donde estaba, que es donde toca seguir puntuando en
 * cuanto se corrige el voto.
 */
export function anotar(batalla, valor, ts) {
  if (!esNotaValida(valor)) return batalla;

  if (batalla.marcada !== null) {
    const puntuaciones = batalla.puntuaciones.map((puntuacion, i) =>
      i === batalla.marcada ? { ...puntuacion, valor } : puntuacion
    );
    return { ...batalla, puntuaciones, marcada: null };
  }

  const { tramo, batallero } = batalla.cursor;
  if (!tramo || !batallero) return batalla;
  if (!tieneCupo(batalla, tramoDe(batalla, tramo), batallero)) return batalla;

  const conLaNota = {
    ...batalla,
    puntuaciones: [...batalla.puntuaciones, { tramo, batallero, valor, ts }],
  };

  return { ...conLaNota, cursor: avanzar(conLaNota, batalla.cursor) };
}

/**
 * Deshace la última nota introducida, sea de quien sea, y deja el cursor
 * sobre el sitio del que se ha quitado: es el que vuelve a tocar.
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
    cursor: { tramo: ultima.tramo, batallero: ultima.batallero },
  };
}

export function moverCursor(batalla, idTramo, idBatallero) {
  const tramo = tramoDe(batalla, idTramo);
  const existe = batalla.batalleros.some(
    (batallero) => batallero.id === idBatallero
  );
  if (!tramo || !existe) return batalla;

  return {
    ...batalla,
    cursor: { tramo: idTramo, batallero: idBatallero },
    marcada: null,
  };
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
 * Añade un tramo al final, ya empezada la batalla. Si el cursor estaba parado
 * porque no quedaba hueco, se lleva al sitio recién abierto.
 */
export function anadirTramo(batalla, tramo) {
  const conElTramo = {
    ...batalla,
    tramos: [...batalla.tramos, crearTramo(tramo)],
  };

  if (puedeAnotar(conElTramo)) return conElTramo;

  return {
    ...conElTramo,
    cursor: primeraPosicionLibre(conElTramo) ?? conElTramo.cursor,
    marcada: null,
  };
}

export function estaVacia(batalla) {
  return batalla.puntuaciones.length === 0;
}

export function esNotaValida(valor) {
  return Number.isInteger(valor) && valor >= NOTA_MIN && valor <= NOTA_MAX;
}

// ── Restaurar lo que quedó a medias ────────────────────────────────────────

/**
 * Reconstruye una batalla a partir de lo que se dejó apuntado al cerrarse la
 * app. Devuelve null si lo guardado no cuadra: más vale no ofrecer nada que
 * ofrecer una batalla a medio restaurar con notas que no estaban.
 */
export function restaurarBatalla(datos) {
  if (!datos || typeof datos !== 'object') return null;
  if (!Array.isArray(datos.batalleros)) return null;
  if (!Array.isArray(datos.tramos) || datos.tramos.length === 0) return null;
  if (!Array.isArray(datos.puntuaciones)) return null;

  const batalleros = datos.batalleros.filter(esBatalleroGuardado);
  if (batalleros.length !== datos.batalleros.length) return null;
  if (batalleros.length < MIN_BATALLEROS) return null;

  const idsBatalleros = new Set(batalleros.map((batallero) => batallero.id));
  if (idsBatalleros.size !== batalleros.length) return null;

  const tramos = datos.tramos.filter(esTramoGuardado).map((tramo) =>
    crearTramo(tramo)
  );
  if (tramos.length !== datos.tramos.length) return null;

  const idsTramos = new Set(tramos.map((tramo) => tramo.id));
  if (idsTramos.size !== tramos.length) return null;

  const valeElVoto = (puntuacion) =>
    !!puntuacion &&
    typeof puntuacion === 'object' &&
    idsTramos.has(puntuacion.tramo) &&
    idsBatalleros.has(puntuacion.batallero) &&
    esNotaValida(puntuacion.valor);

  if (!datos.puntuaciones.every(valeElVoto)) return null;

  const cursor = datos.cursor ?? {};
  const cursorVale =
    idsTramos.has(cursor.tramo) && idsBatalleros.has(cursor.batallero);

  return {
    batalleros: batalleros.map(({ id, nombre }) => ({ id, nombre })),
    tramos,
    puntuaciones: datos.puntuaciones.map(({ tramo, batallero, valor, ts }) => ({
      tramo,
      batallero,
      valor,
      ts,
    })),
    cursor: cursorVale
      ? { tramo: cursor.tramo, batallero: cursor.batallero }
      : { tramo: tramos[0].id, batallero: batalleros[0].id },
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

function esTramoGuardado(tramo) {
  return (
    !!tramo &&
    typeof tramo === 'object' &&
    typeof tramo.id === 'string' &&
    tramo.id.length > 0 &&
    typeof tramo.modalidad === 'string' &&
    Object.hasOwn(MODALIDADES, tramo.modalidad)
  );
}
