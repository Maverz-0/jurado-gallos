/**
 * Lógica de unos filtros.
 *
 * Puro igual que scoring.js: no toca el DOM ni lee relojes.
 *
 * Un filtro no es una batalla. Aquí no compites contra tu grupo: todos los
 * participantes hacen las mismas intervenciones, se puntúa grupo a grupo, y al
 * final clasifican los mejores del conjunto. La nota de cada uno es la MEDIA de
 * sus intervenciones, no la suma.
 *
 *   {
 *     participantes: [{ id, nombre, grupo }],   // grupo es un número interno
 *     tamanoGrupo, intervenciones, notaMaxima, redondeo, clasifican,
 *     puntuaciones: [{ participante, valor, ts }],
 *     cursor:  id del participante al que toca, o null
 *     marcada: índice del voto a sustituir, o null
 *   }
 */

import { NOTA_MIN, acotarNotaMaxima, comoSeEscribe } from './scoring.js';

export { comoSeEscribe };

export const MIN_TAMANO_GRUPO = 2;
export const MAX_TAMANO_GRUPO = 12;
export const TAMANO_GRUPO_POR_DEFECTO = 4;

export const MIN_INTERVENCIONES = 1;
export const MAX_INTERVENCIONES = 20;
export const INTERVENCIONES_POR_DEFECTO = 3;

export const MIN_CLASIFICAN = 1;
export const MAX_CLASIFICAN = 64;
export const CLASIFICAN_POR_DEFECTO = 8;

/** A cuánto se ajusta la media de cada participante. */
export const REDONDEOS = {
  medios: { etiqueta: 'Medios', paso: 0.5 },
  unidades: { etiqueta: 'Enteros', paso: 1 },
};

export const REDONDEO_POR_DEFECTO = 'medios';

export function crearFiltros({
  participantes = [],
  tamanoGrupo = TAMANO_GRUPO_POR_DEFECTO,
  intervenciones = INTERVENCIONES_POR_DEFECTO,
  porIntervenciones = true,
  notaMaxima,
  redondeo = REDONDEO_POR_DEFECTO,
  clasifican = CLASIFICAN_POR_DEFECTO,
  jurado = '',
} = {}) {
  const limpios = participantes.map(({ id, nombre, grupo }) => ({
    id,
    nombre: (nombre ?? '').trim(),
    grupo,
  }));

  // Sin intervenciones sueltas, cada participante lleva una sola nota.
  const porTurnos = !!porIntervenciones;
  const cuantas = porTurnos
    ? entre(intervenciones, MIN_INTERVENCIONES, MAX_INTERVENCIONES, INTERVENCIONES_POR_DEFECTO)
    : 1;

  return {
    participantes: limpios,
    // El primero es quien puntúa en la app: su nota sale de las intervenciones.
    // Los demás se añaden al final y se les meten las notas a mano.
    jurados: [{ id: 'j1', nombre: (jurado ?? '').trim() || 'Jurado 1', propio: true }],
    notasExtra: {},
    tamanoGrupo: entre(tamanoGrupo, MIN_TAMANO_GRUPO, MAX_TAMANO_GRUPO, TAMANO_GRUPO_POR_DEFECTO),
    porIntervenciones: porTurnos,
    intervenciones: cuantas,
    notaMaxima: acotarNotaMaxima(notaMaxima),
    redondeo: REDONDEOS[redondeo] ? redondeo : REDONDEO_POR_DEFECTO,
    clasifican: entre(clasifican, MIN_CLASIFICAN, MAX_CLASIFICAN, CLASIFICAN_POR_DEFECTO),
    puntuaciones: [],
    cursor: limpios[0]?.id ?? null,
    marcada: null,
  };
}

/** Un cero es falsy, así que el valor por defecto se decide por NaN, no por `||`. */
export function entre(valor, minimo, maximo, porDefecto) {
  const numero = Number(valor);
  const entero = Number.isFinite(numero) ? Math.round(numero) : porDefecto;
  return Math.min(maximo, Math.max(minimo, entero));
}

// ── Grupos ─────────────────────────────────────────────────────────────────

/**
 * Los grupos que hay, en orden y sin huecos: si un grupo se queda sin nadie
 * desaparece de la lista y los de después se renumeran para quien los mire.
 */
export function grupos(filtros) {
  const porNumero = new Map();

  for (const participante of filtros.participantes) {
    if (!porNumero.has(participante.grupo)) porNumero.set(participante.grupo, []);
    porNumero.get(participante.grupo).push(participante);
  }

  return [...porNumero.entries()]
    .sort(([a], [b]) => a - b)
    .map(([interno, miembros], i) => ({ interno, numero: i + 1, miembros }));
}

/**
 * Dónde entra alguien que llega tarde: al último grupo que no esté completo y,
 * si están todos llenos, a uno nuevo.
 */
export function grupoParaUnoNuevo(filtros) {
  const lista = grupos(filtros);

  for (let i = lista.length - 1; i >= 0; i -= 1) {
    if (lista[i].miembros.length < filtros.tamanoGrupo) return lista[i].interno;
  }

  return lista.length === 0
    ? 0
    : Math.max(...filtros.participantes.map((p) => p.grupo)) + 1;
}

export function participanteDe(filtros, id) {
  return filtros.participantes.find((p) => p.id === id) ?? null;
}

// ── Consultas ──────────────────────────────────────────────────────────────

export function votosDe(filtros, id) {
  const votos = [];
  filtros.puntuaciones.forEach((puntuacion, indice) => {
    if (puntuacion.participante === id) {
      votos.push({ valor: puntuacion.valor, indice });
    }
  });
  return votos;
}

export function cuantasNotas(filtros, id) {
  return filtros.puntuaciones.reduce(
    (cuenta, puntuacion) => (puntuacion.participante === id ? cuenta + 1 : cuenta),
    0
  );
}

/**
 * La nota de un participante: la media de sus intervenciones, ajustada al
 * redondeo elegido. Con «medios», un 3,4 se queda en 3,5.
 */
export function media(filtros, id) {
  const votos = votosDe(filtros, id);
  if (votos.length === 0) return 0;

  const suma = votos.reduce((total, voto) => total + voto.valor, 0);
  return redondear(suma / votos.length, filtros.redondeo);
}

export function redondear(valor, redondeo) {
  const paso = REDONDEOS[redondeo]?.paso ?? REDONDEOS[REDONDEO_POR_DEFECTO].paso;
  return Math.round(valor / paso) * paso;
}

/** La media sin redondear, que es la que desempata cuando dos coinciden. */
export function mediaExacta(filtros, id) {
  const votos = votosDe(filtros, id);
  if (votos.length === 0) return 0;
  return votos.reduce((total, voto) => total + voto.valor, 0) / votos.length;
}

export function tieneCupo(filtros, id) {
  return cuantasNotas(filtros, id) < filtros.intervenciones;
}

export function grupoCompleto(filtros, miembros) {
  return miembros.every((participante) => !tieneCupo(filtros, participante.id));
}

export function puedeAnotar(filtros) {
  if (filtros.marcada !== null) return true;
  return !!filtros.cursor && tieneCupo(filtros, filtros.cursor);
}

export function estaVacio(filtros) {
  return filtros.puntuaciones.length === 0;
}

export function esNotaValida(valor, filtros) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return false;
  if (valor < NOTA_MIN || valor > filtros.notaMaxima) return false;
  return Number.isInteger(valor);
}

// ── Movimiento del cursor ──────────────────────────────────────────────────

/**
 * Se turnan dentro del grupo hasta que todos han completado sus
 * intervenciones, y sólo entonces se pasa al grupo siguiente.
 */
function siguientePosicion(filtros, id) {
  const lista = grupos(filtros);
  const gActual = lista.findIndex((grupo) =>
    grupo.miembros.some((p) => p.id === id)
  );
  if (gActual < 0) return primeraPosicionLibre(filtros);

  const miembros = lista[gActual].miembros;
  const iActual = miembros.findIndex((p) => p.id === id);

  for (let salto = 1; salto <= miembros.length; salto += 1) {
    const candidato = miembros[(iActual + salto) % miembros.length];
    if (tieneCupo(filtros, candidato.id)) return candidato.id;
  }

  for (let g = gActual + 1; g < lista.length; g += 1) {
    for (const candidato of lista[g].miembros) {
      if (tieneCupo(filtros, candidato.id)) return candidato.id;
    }
  }

  return null;
}

function primeraPosicionLibre(filtros) {
  for (const grupo of grupos(filtros)) {
    for (const participante of grupo.miembros) {
      if (tieneCupo(filtros, participante.id)) return participante.id;
    }
  }
  return null;
}

// ── Cambios de estado ──────────────────────────────────────────────────────

export function anotar(filtros, valor, ts) {
  if (!esNotaValida(valor, filtros)) return filtros;

  if (filtros.marcada !== null) {
    const puntuaciones = filtros.puntuaciones.map((puntuacion, i) =>
      i === filtros.marcada ? { ...puntuacion, valor } : puntuacion
    );
    return { ...filtros, puntuaciones, marcada: null };
  }

  const participante = filtros.cursor;
  if (!participante || !tieneCupo(filtros, participante)) return filtros;

  const conLaNota = {
    ...filtros,
    puntuaciones: [...filtros.puntuaciones, { participante, valor, ts }],
  };

  return { ...conLaNota, cursor: siguientePosicion(conLaNota, participante) ?? participante };
}

export function deshacer(filtros) {
  if (filtros.marcada !== null) return desmarcar(filtros);
  if (filtros.puntuaciones.length === 0) return filtros;

  const ultima = filtros.puntuaciones[filtros.puntuaciones.length - 1];

  return {
    ...filtros,
    puntuaciones: filtros.puntuaciones.slice(0, -1),
    cursor: ultima.participante,
  };
}

export function moverCursor(filtros, id) {
  if (!participanteDe(filtros, id)) return filtros;
  return { ...filtros, cursor: id, marcada: null };
}

export function marcarVoto(filtros, indice) {
  if (!Number.isInteger(indice)) return filtros;
  if (indice < 0 || indice >= filtros.puntuaciones.length) return filtros;

  return { ...filtros, marcada: filtros.marcada === indice ? null : indice };
}

export function desmarcar(filtros) {
  return filtros.marcada === null ? filtros : { ...filtros, marcada: null };
}

/** Se apunta al grupo que se le diga o, si no se dice, al que le toque. */
export function anadirParticipante(filtros, { id, nombre, grupo }) {
  const donde = Number.isInteger(grupo) ? grupo : grupoParaUnoNuevo(filtros);
  const conEl = {
    ...filtros,
    participantes: [...filtros.participantes, { id, nombre: (nombre ?? '').trim(), grupo: donde }],
  };

  // Si nadie tenía el turno (se empezó sin gente), lo coge el primero que entra.
  return conEl.cursor ? conEl : { ...conEl, cursor: id };
}

/**
 * Quien se va, se va con sus votos: si abandona a mitad no tiene sentido que
 * siga apareciendo en la clasificación con media a medias.
 */
export function quitarParticipante(filtros, id) {
  const sinEl = {
    ...filtros,
    participantes: filtros.participantes.filter((p) => p.id !== id),
    puntuaciones: filtros.puntuaciones.filter((p) => p.participante !== id),
    marcada: null,
  };

  if (filtros.cursor !== id) return sinEl;
  return { ...sinEl, cursor: primeraPosicionLibre(sinEl) ?? sinEl.participantes[0]?.id ?? null };
}

/**
 * Lo coloca en un sitio concreto: puede quedarse en su grupo cambiando el
 * turno, o pasar a otro grupo distinto.
 *
 * `hasta` es la posición dentro del grupo de destino, contando ya sin el
 * arrastrado si venía de ese mismo grupo.
 */
export function moverParticipante(filtros, id, { grupo, hasta }) {
  const participante = participanteDe(filtros, id);
  if (!participante) return filtros;

  const destino = Number.isInteger(grupo) ? grupo : participante.grupo;
  const resto = filtros.participantes.filter((p) => p.id !== id);
  const enDestino = resto.filter((p) => p.grupo === destino);
  const donde = Math.min(enDestino.length, Math.max(0, hasta));

  // La lista se reconstruye grupo a grupo, en el mismo orden en que estaban,
  // para que sólo cambie lo que se ha movido.
  const movido = { ...participante, grupo: destino };
  const porGrupo = new Map();

  for (const otro of resto) {
    if (!porGrupo.has(otro.grupo)) porGrupo.set(otro.grupo, []);
    porGrupo.get(otro.grupo).push(otro);
  }

  if (!porGrupo.has(destino)) porGrupo.set(destino, []);
  porGrupo.get(destino).splice(donde, 0, movido);

  return {
    ...filtros,
    participantes: [...porGrupo.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([, miembros]) => miembros),
  };
}

/**
 * Reconstruye unos filtros guardados o dejados a medias. Devuelve null si lo
 * guardado no cuadra, igual que con las batallas.
 */
export function restaurar(datos) {
  if (!datos || typeof datos !== 'object') return null;
  if (!Array.isArray(datos.participantes)) return null;
  if (!Array.isArray(datos.puntuaciones)) return null;

  const participantes = datos.participantes.filter(
    (p) =>
      !!p &&
      typeof p.id === 'string' &&
      p.id.length > 0 &&
      typeof p.nombre === 'string' &&
      Number.isInteger(p.grupo)
  );
  if (participantes.length !== datos.participantes.length) return null;

  const ids = new Set(participantes.map((p) => p.id));
  if (ids.size !== participantes.length) return null;

  const base = crearFiltros({
    tamanoGrupo: datos.tamanoGrupo,
    intervenciones: datos.intervenciones,
    porIntervenciones: datos.porIntervenciones !== false,
    notaMaxima: datos.notaMaxima,
    redondeo: datos.redondeo,
    clasifican: datos.clasifican,
  });

  if (!datos.puntuaciones.every((p) => !!p && ids.has(p.participante) && esNotaValida(p.valor, base))) {
    return null;
  }

  const jurados = Array.isArray(datos.jurados) && datos.jurados.length
    ? datos.jurados.map((j) => ({
        id: j.id,
        nombre: j.nombre,
        propio: !!j.propio,
      }))
    : base.jurados;

  return {
    ...base,
    participantes: participantes.map(({ id, nombre, grupo }) => ({ id, nombre, grupo })),
    jurados,
    notasExtra: datos.notasExtra && typeof datos.notasExtra === 'object'
      ? datos.notasExtra
      : {},
    puntuaciones: datos.puntuaciones.map(({ participante, valor, ts }) => ({
      participante,
      valor,
      ts,
    })),
    cursor: ids.has(datos.cursor) ? datos.cursor : participantes[0]?.id ?? null,
    marcada: null,
  };
}

/** Todos en el orden en que se votan: grupo a grupo y dentro, por turno. */
export function enOrdenDeVoto(filtros) {
  return grupos(filtros).flatMap((grupo) =>
    grupo.miembros.map((participante) => ({
      participante,
      grupo: grupo.interno,
    }))
  );
}

// ── Clasificación ──────────────────────────────────────────────────────────

// ── Jurados ────────────────────────────────────────────────────────────────

/**
 * Lo que un jurado le ha puesto a alguien. El de la app no vota una nota
 * suelta: la suya es la media de las intervenciones que fue metiendo.
 */
export function notaDe(filtros, idJurado, idParticipante) {
  const jurado = filtros.jurados.find((j) => j.id === idJurado);
  if (!jurado) return null;
  if (jurado.propio) return media(filtros, idParticipante);

  const suya = filtros.notasExtra[idJurado]?.[idParticipante];
  return suya === undefined ? null : suya;
}

export function anadirJurado(filtros, { id, nombre }) {
  return {
    ...filtros,
    jurados: [...filtros.jurados, { id, nombre: (nombre ?? '').trim(), propio: false }],
    notasExtra: { ...filtros.notasExtra, [id]: {} },
  };
}

/** Un jurado añadido pone una nota por participante, no por intervención. */
export function ponerNotaDeJurado(filtros, idJurado, idParticipante, valor) {
  const jurado = filtros.jurados.find((j) => j.id === idJurado);
  if (!jurado || jurado.propio) return filtros;
  if (!esNotaValida(valor, filtros)) return filtros;
  if (!participanteDe(filtros, idParticipante)) return filtros;

  return {
    ...filtros,
    notasExtra: {
      ...filtros.notasExtra,
      [idJurado]: { ...filtros.notasExtra[idJurado], [idParticipante]: valor },
    },
  };
}

/** A quién le falta todavía la nota de este jurado, en orden de participación. */
export function sinNotaDe(filtros, idJurado) {
  return filtros.participantes.filter(
    (participante) => notaDe(filtros, idJurado, participante.id) === null
  );
}

/** La suma de lo que le ha puesto cada jurado. */
export function totalDe(filtros, idParticipante) {
  return filtros.jurados.reduce(
    (suma, jurado) => suma + (notaDe(filtros, jurado.id, idParticipante) ?? 0),
    0
  );
}

// ── Clasificación ──────────────────────────────────────────────────────────

/**
 * Todos, con su puesto y si pasan el corte.
 *
 * El puesto lo decide siempre la suma de los jurados, mire uno la tabla como
 * la mire; `orden` sólo cambia cómo se enseñan las filas. Desempata la media
 * sin redondear y, si también empatan, el orden de llegada.
 */
export function clasificacion(filtros, { orden = 'puntuacion' } = {}) {
  const conNota = filtros.participantes.map((participante, llegada) => ({
    participante,
    llegada,
    nota: media(filtros, participante.id),
    total: totalDe(filtros, participante.id),
    exacta: mediaExacta(filtros, participante.id),
    votos: cuantasNotas(filtros, participante.id),
  }));

  const porPuntuacion = [...conNota].sort(
    (a, b) => b.total - a.total || b.exacta - a.exacta || a.llegada - b.llegada
  );

  /**
   * Empate justo en la raya: si el último que pasa y el primero que no llevan
   * lo mismo, el corte no lo decide la puntuación sino el desempate, y eso hay
   * que enseñarlo. Se marcan todos los que lleven esa puntuación.
   */
  const corte = filtros.clasifican;
  const enLaRaya =
    corte > 0 &&
    corte < porPuntuacion.length &&
    porPuntuacion[corte - 1].total === porPuntuacion[corte].total
      ? porPuntuacion[corte].total
      : null;

  const puestos = new Map(
    porPuntuacion.map((fila, i) => [
      fila.participante.id,
      {
        posicion: i + 1,
        clasifica: i < corte,
        empatadoEnLaRaya: enLaRaya !== null && fila.total === enLaRaya,
        /** El último que pasa: donde va la línea de corte. */
        ultimoQuePasa: i === corte - 1 && corte < porPuntuacion.length,
      },
    ])
  );

  const filas = orden === 'participacion' ? conNota : porPuntuacion;

  return filas.map((fila) => ({ ...fila, ...puestos.get(fila.participante.id) }));
}

export function renombrarJurado(filtros, idJurado, nombre) {
  const limpio = (nombre ?? '').trim();
  if (!limpio) return filtros;

  return {
    ...filtros,
    jurados: filtros.jurados.map((jurado) =>
      jurado.id === idJurado ? { ...jurado, nombre: limpio } : jurado
    ),
  };
}

/**
 * Si sólo contase este jurado, ¿habría entrado? Es lo que colorea su casilla:
 * verde cuando además clasifica de verdad, y amarillo cuando no.
 */
export function clasificariaSegun(filtros, idJurado) {
  const conNota = filtros.participantes
    .map((participante, llegada) => ({
      id: participante.id,
      llegada,
      nota: notaDe(filtros, idJurado, participante.id) ?? 0,
      exacta: mediaExacta(filtros, participante.id),
    }))
    .sort((a, b) => b.nota - a.nota || b.exacta - a.exacta || a.llegada - b.llegada);

  return new Set(
    conNota.slice(0, filtros.clasifican).map((fila) => fila.id)
  );
}
