/**
 * Compartir el acta de una batalla.
 *
 * Dos formatos: una imagen dibujada con Canvas, que en WhatsApp se ve como una
 * foto sin abrir nada, y el mismo acta en texto para pegarlo en un chat. Se
 * entregan por la hoja de compartir del sistema; si el navegador no la trae,
 * se descargan.
 *
 * Recibe siempre un registro con la forma de una batalla guardada:
 *   { fecha, batalleros: [{ id, nombre, total, replica }], tramos, puntuaciones }
 */

const FECHA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/* El acta se dibuja al doble de tamaño y se enseña a la mitad, para que no se
   vea pixelada en las pantallas de los móviles. */
const NITIDEZ = 2;

const MARGEN = 44;
const ANCHO_MINIMO = 760;
const ANCHO_NOMBRE = 190;
const LADO_VOTO = 50;
const HUECO_VOTO = 8;
const ALTO_FILA = 62;
const ALTO_ORDINALES = 30;
const ALTO_TITULO_TRAMO = 46;

const TINTA = '#000000';
const TENUE = '#8a8a8e';
const PAPEL = '#ffffff';
const CUADRO = '#f2f2f7';
const AZUL = '#007aff';
const NARANJA = '#ff9500';

const FUENTE = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

import { comoSeEscribe } from './scoring.js';

export function comoSeLlamaElTramo(tramo) {
  const base =
    tramo.modalidad === 'nxn'
      ? `${tramo.intervenciones}×${tramo.intervenciones}`
      : tramo.modalidad === 'minuto'
        ? `Minuto · ${tramo.intervenciones}`
        : 'Dinámica';

  return tramo.replica ? `Réplica · ${base}` : base;
}

function votosDe(acta, idTramo, idBatallero) {
  return acta.puntuaciones
    .filter(
      (puntuacion) =>
        puntuacion.tramo === idTramo && puntuacion.batallero === idBatallero
    )
    .map((puntuacion) => puntuacion.valor);
}

function anchoDeTramo(acta, tramo) {
  return acta.batalleros.reduce(
    (maximo, batallero) =>
      Math.max(maximo, votosDe(acta, tramo.id, batallero.id).length),
    0
  );
}

// ── Imagen ─────────────────────────────────────────────────────────────────

export function dibujarActa(acta) {
  const columnas = acta.tramos.reduce(
    (maximo, tramo) => Math.max(maximo, anchoDeTramo(acta, tramo)),
    0
  );

  const ancho = Math.max(
    ANCHO_MINIMO,
    MARGEN * 2 + ANCHO_NOMBRE + columnas * (LADO_VOTO + HUECO_VOTO)
  );

  const altoCabecera = 190;
  const altoTotales = 40 + acta.batalleros.length * 46;
  const altoTramos = acta.tramos.reduce(
    (suma, tramo) =>
      suma +
      ALTO_TITULO_TRAMO +
      ALTO_ORDINALES +
      acta.batalleros.length * ALTO_FILA +
      26,
    0
  );
  // El último tramo ya deja su hueco: abajo sólo hace falta sitio para el pie.
  const alto = altoCabecera + altoTotales + altoTramos + 40;

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho * NITIDEZ;
  lienzo.height = alto * NITIDEZ;

  const pincel = lienzo.getContext('2d');
  pincel.scale(NITIDEZ, NITIDEZ);
  pincel.textBaseline = 'middle';

  pincel.fillStyle = PAPEL;
  pincel.fillRect(0, 0, ancho, alto);

  let y = MARGEN;

  // Cabecera
  pincel.fillStyle = TINTA;
  pincel.font = `700 40px ${FUENTE}`;
  y += 26;
  recortarTexto(pincel, nombresDe(acta), MARGEN, y, ancho - MARGEN * 2);

  pincel.fillStyle = TENUE;
  pincel.font = `400 22px ${FUENTE}`;
  y += 44;
  pincel.fillText(FECHA.format(new Date(acta.fecha)), MARGEN, y);

  y += 34;
  linea(pincel, MARGEN, y, ancho - MARGEN);
  y += 30;

  // Totales
  for (const batallero of acta.batalleros) {
    pincel.fillStyle = TINTA;
    pincel.font = `600 26px ${FUENTE}`;
    recortarTexto(pincel, batallero.nombre, MARGEN, y, ancho - MARGEN * 2 - 200);

    pincel.font = `700 34px ${FUENTE}`;
    pincel.textAlign = 'right';
    pincel.fillText(comoSeEscribe(batallero.total), ancho - MARGEN, y);

    if (batallero.replica) {
      pincel.fillStyle = NARANJA;
      pincel.font = `600 18px ${FUENTE}`;
      pincel.fillText(
        `réplica ${comoSeEscribe(batallero.replica)}`,
        ancho - MARGEN - 100,
        y
      );
    }

    pincel.textAlign = 'left';
    y += 46;
  }

  y += 16;

  // Un bloque por tramo
  for (const tramo of acta.tramos) {
    const columnasTramo = anchoDeTramo(acta, tramo);
    const color = tramo.replica ? NARANJA : AZUL;

    pastilla(pincel, comoSeLlamaElTramo(tramo).toUpperCase(), MARGEN, y, color);
    y += ALTO_TITULO_TRAMO;

    pincel.fillStyle = TENUE;
    pincel.font = `600 15px ${FUENTE}`;
    pincel.textAlign = 'center';
    for (let i = 0; i < columnasTramo; i += 1) {
      const x = MARGEN + ANCHO_NOMBRE + i * (LADO_VOTO + HUECO_VOTO);
      pincel.fillText(`${i + 1}ª`, x + LADO_VOTO / 2, y);
    }
    pincel.textAlign = 'left';
    y += ALTO_ORDINALES;

    for (const batallero of acta.batalleros) {
      pincel.fillStyle = TINTA;
      pincel.font = `400 22px ${FUENTE}`;
      recortarTexto(pincel, batallero.nombre, MARGEN, y + LADO_VOTO / 2, ANCHO_NOMBRE - 16);

      votosDe(acta, tramo.id, batallero.id).forEach((valor, i) => {
        const x = MARGEN + ANCHO_NOMBRE + i * (LADO_VOTO + HUECO_VOTO);
        cuadrito(pincel, comoSeEscribe(valor), x, y, LADO_VOTO);
      });

      y += ALTO_FILA;
    }

    y += 26;
  }

  pincel.fillStyle = TENUE;
  pincel.font = `400 18px ${FUENTE}`;
  pincel.fillText('Jurado de gallos', MARGEN, alto - MARGEN);

  return lienzo;
}

function nombresDe(acta) {
  return acta.batalleros.map((batallero) => batallero.nombre).join('  ·  ');
}

function linea(pincel, x1, y, x2) {
  pincel.strokeStyle = '#d8d8dc';
  pincel.lineWidth = 1;
  pincel.beginPath();
  pincel.moveTo(x1, y);
  pincel.lineTo(x2, y);
  pincel.stroke();
}

function pastilla(pincel, texto, x, y, color) {
  pincel.font = `700 16px ${FUENTE}`;
  const ancho = pincel.measureText(texto).width + 28;

  pincel.fillStyle = color;
  pincel.globalAlpha = 0.14;
  redondeado(pincel, x, y, ancho, 30, 15);
  pincel.fill();
  pincel.globalAlpha = 1;

  pincel.fillStyle = color;
  pincel.fillText(texto, x + 14, y + 16);
}

function cuadrito(pincel, texto, x, y, lado) {
  pincel.fillStyle = CUADRO;
  redondeado(pincel, x, y, lado, lado, 10);
  pincel.fill();

  pincel.fillStyle = TINTA;
  pincel.font = `600 22px ${FUENTE}`;
  pincel.textAlign = 'center';
  pincel.fillText(texto, x + lado / 2, y + lado / 2);
  pincel.textAlign = 'left';
}

function redondeado(pincel, x, y, ancho, alto, radio) {
  pincel.beginPath();
  pincel.moveTo(x + radio, y);
  pincel.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  pincel.arcTo(x + ancho, y + alto, x, y + alto, radio);
  pincel.arcTo(x, y + alto, x, y, radio);
  pincel.arcTo(x, y, x + ancho, y, radio);
  pincel.closePath();
}

/** Un nombre largo se corta con puntos suspensivos en vez de salirse. */
function recortarTexto(pincel, texto, x, y, ancho) {
  let salida = texto;
  if (pincel.measureText(salida).width > ancho) {
    while (salida.length > 1 && pincel.measureText(`${salida}…`).width > ancho) {
      salida = salida.slice(0, -1);
    }
    salida += '…';
  }
  pincel.fillText(salida, x, y);
}

// ── Texto ──────────────────────────────────────────────────────────────────

export function comoTexto(acta) {
  const lineas = [
    nombresDe(acta).toUpperCase(),
    FECHA.format(new Date(acta.fecha)),
    '',
    'TOTAL',
    ...acta.batalleros.map(
      (batallero) =>
        `  ${batallero.nombre}: ${comoSeEscribe(batallero.total)}` +
        (batallero.replica
          ? `   (réplica ${comoSeEscribe(batallero.replica)})`
          : '')
    ),
  ];

  for (const tramo of acta.tramos) {
    lineas.push('', comoSeLlamaElTramo(tramo).toUpperCase());
    for (const batallero of acta.batalleros) {
      const votos = votosDe(acta, tramo.id, batallero.id).map(comoSeEscribe);
      const suma = votosDe(acta, tramo.id, batallero.id).reduce(
        (total, voto) => total + voto,
        0
      );
      lineas.push(
        `  ${batallero.nombre}: ${votos.length ? votos.join(' · ') : 'sin notas'}  =  ${comoSeEscribe(suma)}`
      );
    }
  }

  return `${lineas.join('\n')}\n`;
}

// ── Entrega ────────────────────────────────────────────────────────────────

function comoSeLlamaElFichero(acta) {
  const fecha = new Date(acta.fecha);
  const dosCifras = (numero) => String(numero).padStart(2, '0');
  const dia = [
    fecha.getFullYear(),
    dosCifras(fecha.getMonth() + 1),
    dosCifras(fecha.getDate()),
  ].join('-');

  const quienes = acta.batalleros
    .map((batallero) => batallero.nombre)
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  return `${dia}-${quienes || 'batalla'}`;
}

/**
 * Devuelve 'compartido', 'descargado' o 'cancelado'. Cancelar la hoja del
 * sistema no es un fallo: el usuario ha cambiado de idea y ya está.
 */
export async function compartirImagen(acta) {
  const lienzo = dibujarActa(acta);
  const blob = await new Promise((resolver) =>
    lienzo.toBlob(resolver, 'image/png')
  );
  if (!blob) throw new Error('No se ha podido generar la imagen.');

  const fichero = new File([blob], `${comoSeLlamaElFichero(acta)}.png`, {
    type: 'image/png',
  });

  return entregar({ files: [fichero] }, blob, fichero.name);
}

export async function compartirTexto(acta) {
  const texto = comoTexto(acta);
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });

  return entregar({ text: texto }, blob, `${comoSeLlamaElFichero(acta)}.txt`);
}

async function entregar(carga, blob, nombre) {
  const sePuede = carga.files
    ? navigator.canShare?.(carga)
    : typeof navigator.share === 'function';

  if (sePuede) {
    try {
      await navigator.share(carga);
      return 'compartido';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelado';
      // Si la hoja falla por lo que sea, todavía queda descargarlo.
      console.error('No se ha podido compartir:', error);
    }
  }

  descargar(blob, nombre);
  return 'descargado';
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
