/**
 * Lógica de la batalla en curso.
 *
 * Este módulo es puro: no toca el DOM, no lee relojes ni genera identificadores.
 * Todas las funciones reciben un estado y devuelven uno nuevo, sin mutar el que
 * les llega, de modo que se puede probar llamándolas directamente.
 *
 * Una batalla es una secuencia de TRAMOS. Cada tramo tiene su modalidad, que
 * dice en qué orden se pasa de un gallo a otro, y su número de intervenciones,
 * que puede quedar sin fijar. Una misma batalla puede llevar un 8×8, luego un
 * 4×4 y luego una réplica.
 *
 *   {
 *     batalleros:   [{ id, nombre }],           // entre 2 y 10, en orden
 *     tramos:       [{ id, modalidad, intervenciones, replica }],
 *     puntuaciones: [{ tramo, batallero, valor, ts }],   // por inserción
 *     cursor:       { tramo, batallero },
 *     marcada:      índice del voto a sustituir, o null
 *     notaMaxima:   hasta dónde llega el teclado,
 *     decimales:    si se admiten medios puntos
 *   }
 */

export const MIN_BATALLEROS = 2;
export const MAX_BATALLEROS = 10;

export const NOTA_MIN = 0;

/** Hasta dónde puede llegar la escala que se elige al preparar la batalla. */
export const MIN_NOTA_MAXIMA = 1;
export const MAX_NOTA_MAXIMA = 10;
export const NOTA_MAXIMA_POR_DEFECTO = 4;

/** El paso cuando se admiten medios puntos. */
export const MEDIO = 0.5;

export const MIN_INTERVENCIONES = 1;
export const MAX_INTERVENCIONES = 20;

/** Un tramo nace sin número: las intervenciones que salgan. */
export const INTERVENCIONES_POR_DEFECTO = null;

/** Como se lee un tramo sin número fijo de intervenciones. */
export const INDEFINIDO = 'Indefinido';

/**
 * La modalidad dice sólo en qué orden se va pasando de un gallo a otro. Cuántas
 * intervenciones hay es cosa aparte, y puede quedar sin fijar.
 *
 * `paso`     — cuántas seguidas se le puntúan a un gallo antes de ceder el
 *              turno. Es lo único que separa un 4×4 de un 8×8.
 * `porGallo` — se le puntúan todas las suyas antes de pasar al siguiente, en
 *              vez de ir alternando.
 */
export const MODALIDADES = {
  '4x4': { etiqueta: '4×4', paso: 1, porGallo: false },
  '8x8': { etiqueta: '8×8', paso: 2, porGallo: false },
  minuto: { etiqueta: 'Minuto', paso: 1, porGallo: true },
};

export const MODALIDAD_POR_DEFECTO = '4x4';

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
    intervenciones: intervenciones == null ? null : acotar(intervenciones),
    replica: !!replica,
  };
}

export function acotar(intervenciones) {
  return entre(
    intervenciones,
    MIN_INTERVENCIONES,
    MAX_INTERVENCIONES,
    MIN_INTERVENCIONES
  );
}

/**
 * El contador de intervenciones va del indefinido al máximo, y el indefinido
 * queda justo por debajo del 1: es un valor más de la cuenta y no una casilla
 * aparte, así que se llega a él bajando desde uno.
 */
export function moverIntervenciones(intervenciones, paso) {
  if (intervenciones == null) return paso > 0 ? MIN_INTERVENCIONES : null;

  const siguiente = intervenciones + paso;
  return siguiente < MIN_INTERVENCIONES ? null : acotar(siguiente);
}

/** «4×4 · 6» cuando el número está fijado, y «4×4» a secas cuando no. */
export function comoSeLlamaElTramo(tramo) {
  const modalidad = MODALIDADES[tramo.modalidad] ?? MODALIDADES[MODALIDAD_POR_DEFECTO];
  const base =
    tramo.intervenciones == null
      ? modalidad.etiqueta
      : `${modalidad.etiqueta} · ${tramo.intervenciones}`;

  return tramo.replica ? `Réplica · ${base}` : base;
}

/** Un cero es falsy, así que el valor por defecto se decide por NaN, no por `||`. */
function entre(valor, minimo, maximo, porDefecto) {
  const numero = Number(valor);
  const entero = Number.isFinite(numero) ? Math.round(numero) : porDefecto;
  return Math.min(maximo, Math.max(minimo, entero));
}

export function crearBatalla(batalleros, tramos, opciones = {}) {
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
    notaMaxima: acotarNotaMaxima(opciones.notaMaxima),
    decimales: !!opciones.decimales,
  };
}

export function acotarNotaMaxima(notaMaxima) {
  return entre(
    notaMaxima,
    MIN_NOTA_MAXIMA,
    MAX_NOTA_MAXIMA,
    NOTA_MAXIMA_POR_DEFECTO
  );
}

/** 3 se escribe «3»; 3,5 con coma, que es como se lee en español. */
export function comoSeEscribe(valor) {
  return Number.isInteger(valor)
    ? String(valor)
    : String(valor).replace('.', ',');
}

/** Los números que ofrece el teclado, de cero al máximo elegido. */
export function notasDelTeclado(batalla) {
  return Array.from({ length: batalla.notaMaxima + 1 }, (_, i) => i);
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
 * Cuántas columnas tiene un tramo: las que tenga fijadas o, si no las tiene,
 * las que se lleven metidas y una más.
 *
 * Esa de más es el sitio de la siguiente nota. Sin ella, cuando todos van
 * igualados no habría dónde señalar a quién le toca, ni dónde tocar para
 * llevarle el cursor.
 */
export function anchoDeTramo(batalla, tramo) {
  if (tramo.intervenciones != null) return tramo.intervenciones;

  const metidas = batalla.batalleros.reduce(
    (maximo, batallero) =>
      Math.max(maximo, cuantasNotas(batalla, tramo.id, batallero.id)),
    0
  );

  return metidas + 1;
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
 * Con quién abre un tramo: el primero abre el primer gallo, el siguiente abre
 * el segundo, y así dando la vuelta. Si un 8×8 lo abre uno, el 4×4 que venga
 * después lo abre el otro, que es como se hace.
 */
function quienAbre(batalla, iTramo) {
  return iTramo % batalla.batalleros.length;
}

/** El primer gallo con hueco de un tramo, empezando por el que le toca abrir. */
function quienEmpiezaEn(batalla, iTramo) {
  const cuantos = batalla.batalleros.length;
  const abre = quienAbre(batalla, iTramo);

  for (let salto = 0; salto < cuantos; salto += 1) {
    const batallero = batalla.batalleros[(abre + salto) % cuantos];
    if (tieneCupo(batalla, batalla.tramos[iTramo], batallero.id)) {
      return { tramo: batalla.tramos[iTramo].id, batallero: batallero.id };
    }
  }

  return null;
}

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
    const sitio = quienEmpiezaEn(batalla, t);
    if (sitio) return sitio;
  }

  return null;
}

/** El primer hueco de toda la batalla, mirando desde el principio. */
function primeraPosicionLibre(batalla) {
  for (let t = 0; t < batalla.tramos.length; t += 1) {
    const sitio = quienEmpiezaEn(batalla, t);
    if (sitio) return sitio;
  }
  return null;
}

function avanzar(batalla, cursor) {
  const tramo = tramoDe(batalla, cursor.tramo);
  if (!tramo) return cursor;

  // Sin hueco para otra suya, el turno se va de todas formas.
  if (!tieneCupo(batalla, tramo, cursor.batallero)) {
    return siguientePosicion(batalla, cursor) ?? cursor;
  }

  const { porGallo, paso } = MODALIDADES[tramo.modalidad];

  // En «minuto» un gallo agota sus intervenciones antes de ceder el turno.
  if (porGallo) return cursor;

  // En un 8×8 van de dos en dos: el turno sólo pasa al cerrar la pareja. Se
  // sabe contando las que lleva, así que no hay que recordar nada aparte.
  if (cuantasNotas(batalla, tramo.id, cursor.batallero) % paso !== 0) return cursor;

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
  if (!esNotaValida(valor, batalla)) return batalla;

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

/**
 * Quién abre un tramo en el que todavía no ha puntuado nadie, o null si ya
 * está empezado: entonces no hay nada que decidir, manda lo que ya hay.
 */
export function quienAbreElTramo(batalla, idTramo) {
  const iTramo = batalla.tramos.findIndex((tramo) => tramo.id === idTramo);
  if (iTramo < 0) return null;

  const empezado = batalla.puntuaciones.some(
    (puntuacion) => puntuacion.tramo === idTramo
  );
  if (empezado) return null;

  return batalla.batalleros[quienAbre(batalla, iTramo)]?.id ?? null;
}

/**
 * Lleva el cursor a un sitio concreto, que es lo que hace tocar un hueco.
 *
 * Entrar en una modalidad que no ha empezado lleva a quien le toca abrirla: el
 * cuadrito que se toque ahí sólo dice «vamos con ésta», no a quién le toca, y
 * sin esto una modalidad sin número fijo de intervenciones no cedería el turno
 * nunca y siempre acabaría abriéndola el primero de la lista. Ya dentro, y en
 * cuanto tiene alguna nota, el cuadrito manda.
 */
export function moverCursor(batalla, idTramo, idBatallero) {
  const tramo = tramoDe(batalla, idTramo);
  const existe = batalla.batalleros.some(
    (batallero) => batallero.id === idBatallero
  );
  if (!tramo || !existe) return batalla;

  const entrando = idTramo !== batalla.cursor.tramo;
  const abre = entrando ? quienAbreElTramo(batalla, idTramo) : null;

  return {
    ...batalla,
    cursor: { tramo: idTramo, batallero: abre ?? idBatallero },
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
/**
 * Añade un tramo al final y decide si el turno se muda a él.
 *
 * Con número fijo de intervenciones se sigue donde se estaba: el cursor saltará
 * solo en cuanto ese tramo se llene. Pero un tramo sin número no se llena
 * nunca, así que nunca cedería el turno por su cuenta: ahí, añadir otro es la
 * señal de que ya se ha pasado a él. Y quien lo abre es el que le toque por el
 * sitio que ocupa, como en cualquier otro.
 */
export function anadirTramo(batalla, tramo) {
  const conElTramo = {
    ...batalla,
    tramos: [...batalla.tramos, crearTramo(tramo)],
  };

  const enCurso = tramoDe(conElTramo, conElTramo.cursor.tramo);
  if (enCurso?.intervenciones != null && puedeAnotar(conElTramo)) return conElTramo;

  const abre = quienEmpiezaEn(conElTramo, conElTramo.tramos.length - 1);

  return {
    ...conElTramo,
    cursor: abre ?? primeraPosicionLibre(conElTramo) ?? conElTramo.cursor,
    marcada: null,
  };
}

/**
 * Suma o quita medio punto a la última nota metida (o a la que esté marcada).
 * Pulsarla dos veces lo deja como estaba: se mete la nota y se matiza después,
 * que es más rápido que tener que decidirlo antes de puntuar.
 */
export function medioPunto(batalla) {
  if (!batalla.decimales) return batalla;
  if (batalla.puntuaciones.length === 0) return batalla;

  const i = batalla.marcada ?? batalla.puntuaciones.length - 1;
  const puntuacion = batalla.puntuaciones[i];
  const conMedio = Number.isInteger(puntuacion.valor);
  const valor = conMedio
    ? puntuacion.valor + MEDIO
    : puntuacion.valor - MEDIO;

  if (!esNotaValida(valor, batalla)) return batalla;

  return {
    ...batalla,
    puntuaciones: batalla.puntuaciones.map((otra, j) =>
      j === i ? { ...otra, valor } : otra
    ),
  };
}

/** Si no hay nada que matizar, la tecla del medio punto no pinta nada. */
export function puedeMediarPunto(batalla) {
  if (!batalla.decimales) return false;
  if (batalla.puntuaciones.length === 0) return false;

  const i = batalla.marcada ?? batalla.puntuaciones.length - 1;
  const valor = batalla.puntuaciones[i].valor;
  const destino = Number.isInteger(valor) ? valor + MEDIO : valor - MEDIO;

  return esNotaValida(destino, batalla);
}

export function estaVacia(batalla) {
  return batalla.puntuaciones.length === 0;
}

export function esNotaValida(valor, batalla) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return false;
  if (valor < NOTA_MIN || valor > batalla.notaMaxima) return false;

  // Con decimales valen los múltiplos de medio punto; sin ellos, sólo enteros.
  return batalla.decimales
    ? Number.isInteger(valor / MEDIO)
    : Number.isInteger(valor);
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

  const escala = {
    notaMaxima: acotarNotaMaxima(datos.notaMaxima),
    decimales: !!datos.decimales,
  };

  const valeElVoto = (puntuacion) =>
    !!puntuacion &&
    typeof puntuacion === 'object' &&
    idsTramos.has(puntuacion.tramo) &&
    idsBatalleros.has(puntuacion.batallero) &&
    esNotaValida(puntuacion.valor, escala);

  if (!datos.puntuaciones.every(valeElVoto)) return null;

  const cursor = datos.cursor ?? {};
  const cursorVale =
    idsTramos.has(cursor.tramo) && idsBatalleros.has(cursor.batallero);

  return {
    ...escala,
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
