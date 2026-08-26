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
  notaMaxima,
  redondeo = REDONDEO_POR_DEFECTO,
  clasifican = CLASIFICAN_POR_DEFECTO,
} = {}) {
  const limpios = participantes.map(({ id, nombre, grupo }) => ({
    id,
    nombre: (nombre ?? '').trim(),
    grupo,
  }));

  return {
    participantes: limpios,
    tamanoGrupo: entre(tamanoGrupo, MIN_TAMANO_GRUPO, MAX_TAMANO_GRUPO, TAMANO_GRUPO_POR_DEFECTO),
    intervenciones: entre(intervenciones, MIN_INTERVENCIONES, MAX_INTERVENCIONES, INTERVENCIONES_POR_DEFECTO),
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

/** Reordena dentro de su grupo: cambia el turno, no el grupo. */
export function moverParticipante(filtros, id, hasta) {
  const participante = participanteDe(filtros, id);
  if (!participante) return filtros;

  const delGrupo = filtros.participantes.filter((p) => p.grupo === participante.grupo);
  const desde = delGrupo.findIndex((p) => p.id === id);
  const destino = Math.min(delGrupo.length - 1, Math.max(0, hasta));
  if (desde === destino) return filtros;

  const reordenado = [...delGrupo];
  reordenado.splice(destino, 0, ...reordenado.splice(desde, 1));

  // Se reconstruye la lista completa metiendo el grupo ya reordenado en su sitio.
  let siguiente = 0;
  const participantes = filtros.participantes.map((otro) =>
    otro.grupo === participante.grupo ? reordenado[siguiente++] : otro
  );

  return { ...filtros, participantes };
}

// ── Clasificación ──────────────────────────────────────────────────────────

/**
 * Todos ordenados de mejor a peor, con su puesto y si pasa el corte.
 * Desempata la media sin redondear; si también empatan, el orden de llegada.
 */
export function clasificacion(filtros) {
  const conNota = filtros.participantes.map((participante, orden) => ({
    participante,
    orden,
    nota: media(filtros, participante.id),
    exacta: mediaExacta(filtros, participante.id),
    votos: cuantasNotas(filtros, participante.id),
  }));

  conNota.sort(
    (a, b) => b.nota - a.nota || b.exacta - a.exacta || a.orden - b.orden
  );

  return conNota.map((fila, i) => ({
    ...fila,
    posicion: i + 1,
    clasifica: i < filtros.clasifican,
  }));
}
