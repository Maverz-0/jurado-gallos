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
const ROJO = '#ff3b30';
/* El amarillo del sistema sirve para teñir un fondo, pero sobre papel blanco
   no se lee: los números del empate van en un tono oscuro del mismo color. */
const AMARILLO = '#ffcc00';
const AMARILLO_TINTA = '#8a6a00';

const FUENTE = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
const FUENTE_FIRMA = 'ui-serif, "New York", Georgia, "Times New Roman", serif';

export const FIRMA = 'by Maverz';

/** El pie de todas las actas: el nombre de la app y la firma en cursiva. */
function pie(pincel, x, y) {
  pincel.fillStyle = TENUE;
  pincel.font = `400 18px ${FUENTE}`;
  pincel.fillText('Jurado de gallos', x, y);

  const ancho = pincel.measureText('Jurado de gallos').width;
  pincel.font = `italic 500 18px ${FUENTE_FIRMA}`;
  pincel.fillText(FIRMA, x + ancho + 10, y);
}

import { comoSeEscribe, comoSeLlamaElTramo, MODALIDADES } from './scoring.js';

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

/** El hueco de más que abre cada pareja de un 8×8, como en la pantalla. */
const HUECO_PAREJA = 14;

/** Cuánto se corre la columna `i` por las parejas que le quedan detrás. */
function correPorParejas(tramo, i) {
  const paso = MODALIDADES[tramo.modalidad]?.paso ?? 1;
  return paso > 1 ? Math.floor(i / paso) * HUECO_PAREJA : 0;
}

/** La x de una columna dentro de su tramo. */
function xDeColumna(tramo, i) {
  return (
    MARGEN + ANCHO_NOMBRE + i * (LADO_VOTO + HUECO_VOTO) + correPorParejas(tramo, i)
  );
}

/** Lo que ocupan de ancho los cuadritos de un tramo, huecos incluidos. */
function anchoEnPixeles(acta, tramo) {
  const columnas = anchoDeTramo(acta, tramo);
  if (columnas === 0) return 0;
  return (
    columnas * (LADO_VOTO + HUECO_VOTO) + correPorParejas(tramo, columnas - 1)
  );
}

// ── Imagen ─────────────────────────────────────────────────────────────────

export function dibujarActa(acta) {
  const cuadritos = acta.tramos.reduce(
    (maximo, tramo) => Math.max(maximo, anchoEnPixeles(acta, tramo)),
    0
  );

  const ancho = Math.max(
    ANCHO_MINIMO,
    MARGEN * 2 + ANCHO_NOMBRE + cuadritos
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
      pincel.fillText(`${i + 1}ª`, xDeColumna(tramo, i) + LADO_VOTO / 2, y);
    }
    pincel.textAlign = 'left';
    y += ALTO_ORDINALES;

    for (const batallero of acta.batalleros) {
      pincel.fillStyle = TINTA;
      pincel.font = `400 22px ${FUENTE}`;
      recortarTexto(pincel, batallero.nombre, MARGEN, y + LADO_VOTO / 2, ANCHO_NOMBRE - 16);

      votosDe(acta, tramo.id, batallero.id).forEach((valor, i) => {
        cuadrito(pincel, comoSeEscribe(valor), xDeColumna(tramo, i), y, LADO_VOTO);
      });

      y += ALTO_FILA;
    }

    y += 26;
  }

  pie(pincel, MARGEN, alto - MARGEN);
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

/**
 * Parte un texto en líneas que quepan. Se mide con un lienzo aparte para poder
 * calcular el alto del acta antes de empezar a dibujarla.
 */
function partir(texto, ancho, tamano) {
  const regla = document.createElement('canvas').getContext('2d');
  regla.font = `400 ${tamano}px ${FUENTE}`;

  const lineas = [];
  let actual = '';

  for (const palabra of texto.split(' ')) {
    const probada = actual ? `${actual} ${palabra}` : palabra;
    if (actual && regla.measureText(probada).width > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = probada;
    }
  }

  if (actual) lineas.push(actual);
  return lineas;
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

// ── Clasificación de unos filtros ──────────────────────────────────────────

const VERDE = '#34c759';
const ANCHO_PUESTO = 56;
const ALTO_RAYA = 20;

/**
 * La raya del corte, degradada hacia fuera para que no parezca un borde más:
 * verde por el lado de los que pasan y roja por el de los que no. Cuando el
 * corte lo ha decidido un desempate viene partida, y entonces cada mitad va
 * de un solo color.
 */
function rayaDelCorte(pincel, x, y, ancho, cual) {
  const arriba = cual === 'rojo' ? ROJO : VERDE;
  const abajo = cual === 'verde' ? VERDE : ROJO;

  const tinte = pincel.createLinearGradient(0, y, 0, y + ALTO_RAYA);
  tinte.addColorStop(0, `${arriba}00`);
  tinte.addColorStop(0.44, arriba);
  tinte.addColorStop(0.56, abajo);
  tinte.addColorStop(1, `${abajo}00`);

  pincel.fillStyle = tinte;
  pincel.fillRect(x, y, ancho, ALTO_RAYA);
}

/**
 * El acta de unos filtros es una tabla, no una lista de tramos, así que se
 * dibuja aparte. Lleva su leyenda: hasta dónde llegaban las notas y qué
 * significa cada color, que si no la imagen suelta no se entiende.
 */
export function dibujarClasificacion(acta) {
  const columnas = acta.jurados.length + (acta.conTotal ? 1 : 0);
  const anchoCelda = 96;
  const ancho = Math.max(
    ANCHO_MINIMO,
    MARGEN * 2 + ANCHO_NOMBRE + columnas * anchoCelda + ANCHO_PUESTO
  );

  const altoCabecera = 150;
  const cuantasRayas = acta.filas.filter((fila) => fila.raya).length;
  const altoTabla = 52 + acta.filas.length * 56 + cuantasRayas * ALTO_RAYA;
  // La escala puede ocupar varias líneas, así que hay que medirla antes.
  const lineasEscala = partir(acta.escala, ancho - MARGEN * 2, 19);
  const altoLeyenda = 60 + lineasEscala.length * 26 + acta.colores.length * 28 + 50;
  const alto = altoCabecera + altoTabla + altoLeyenda;

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho * NITIDEZ;
  lienzo.height = alto * NITIDEZ;

  const pincel = lienzo.getContext('2d');
  pincel.scale(NITIDEZ, NITIDEZ);
  pincel.textBaseline = 'middle';
  pincel.fillStyle = PAPEL;
  pincel.fillRect(0, 0, ancho, alto);

  let y = MARGEN + 20;
  pincel.fillStyle = TINTA;
  pincel.font = `700 38px ${FUENTE}`;
  pincel.fillText('Clasificación', MARGEN, y);

  y += 40;
  pincel.fillStyle = TENUE;
  pincel.font = `400 21px ${FUENTE}`;
  pincel.fillText(
    `${FECHA.format(new Date(acta.fecha))}  ·  pasan ${acta.clasifican} de ${acta.filas.length}`,
    MARGEN,
    y
  );

  y += 40;
  const xDe = (i) => MARGEN + ANCHO_NOMBRE + i * anchoCelda;

  // Cabecera
  pincel.fillStyle = TENUE;
  pincel.font = `600 16px ${FUENTE}`;
  pincel.fillText('PARTICIPANTE', MARGEN, y);
  pincel.textAlign = 'center';
  acta.jurados.forEach((jurado, i) => {
    recortarTexto(pincel, jurado.nombre.toUpperCase(), xDe(i) + anchoCelda / 2, y, anchoCelda - 8);
  });
  if (acta.conTotal) {
    pincel.fillText('TOTAL', xDe(acta.jurados.length) + anchoCelda / 2, y);
  }
  pincel.fillText('#', xDe(columnas) + ANCHO_PUESTO / 2, y);
  pincel.textAlign = 'left';

  y += 22;
  linea(pincel, MARGEN, y, ancho - MARGEN);
  y += 10;

  for (const fila of acta.filas) {
    if (fila.raya) {
      rayaDelCorte(pincel, MARGEN, y, ancho - MARGEN * 2, fila.raya);
      y += ALTO_RAYA;
    }

    const centro = y + 28;

    pincel.fillStyle = fila.empate ? AMARILLO_TINTA : TINTA;
    pincel.font = `400 23px ${FUENTE}`;
    recortarTexto(pincel, fila.nombre, MARGEN, centro, ANCHO_NOMBRE - 16);

    pincel.textAlign = 'center';
    fila.notas.forEach((nota, i) => {
      const x = xDe(i);
      if (nota.verde || nota.azul) {
        pincel.fillStyle = nota.verde ? VERDE : AZUL;
        pincel.globalAlpha = 0.2;
        redondeado(pincel, x + 14, y + 6, anchoCelda - 28, 44, 9);
        pincel.fill();
        pincel.globalAlpha = 1;
      }
      pincel.fillStyle = nota.verde ? VERDE : nota.azul ? AZUL : TINTA;
      pincel.font = `600 23px ${FUENTE}`;
      pincel.fillText(nota.texto, x + anchoCelda / 2, centro);
    });

    if (acta.conTotal) {
      pincel.fillStyle = TINTA;
      pincel.font = `700 23px ${FUENTE}`;
      pincel.fillText(fila.total, xDe(acta.jurados.length) + anchoCelda / 2, centro);
    }

    const xPuesto = xDe(columnas);
    if (fila.empate) {
      pincel.fillStyle = AMARILLO;
      pincel.globalAlpha = 0.26;
      redondeado(pincel, xPuesto + 6, y + 6, ANCHO_PUESTO - 12, 44, 7);
      pincel.fill();
      pincel.globalAlpha = 1;
    }
    pincel.fillStyle = fila.empate ? AMARILLO_TINTA : fila.clasifica ? VERDE : TENUE;
    pincel.font = `700 23px ${FUENTE}`;
    pincel.fillText(fila.posicion, xPuesto + ANCHO_PUESTO / 2, centro);
    pincel.textAlign = 'left';

    y += 56;
    pincel.strokeStyle = '#ededf0';
    pincel.beginPath();
    pincel.moveTo(MARGEN, y);
    pincel.lineTo(ancho - MARGEN, y);
    pincel.stroke();
  }

  // Leyenda
  y += 30;
  pincel.fillStyle = TENUE;
  pincel.font = `400 19px ${FUENTE}`;
  for (const linea of lineasEscala) {
    pincel.fillText(linea, MARGEN, y);
    y += 26;
  }

  y += 10;
  const MARCAS = { verde: VERDE, azul: AZUL, amarillo: AMARILLO };
  for (const { color, texto } of acta.colores) {
    pincel.fillStyle = MARCAS[color] ?? TENUE;
    pincel.globalAlpha = 0.45;
    redondeado(pincel, MARGEN, y - 9, 18, 18, 5);
    pincel.fill();
    pincel.globalAlpha = 1;

    pincel.fillStyle = TENUE;
    pincel.fillText(texto, MARGEN + 28, y);
    y += 28;
  }

  pie(pincel, MARGEN, alto - MARGEN);
  return lienzo;
}

/** En texto la raya del corte se dibuja con guiones, que es lo que hay. */
const RAYA_EN_TEXTO = {
  ambos: '——————— corte ———————',
  verde: '——————— corte, con empate ———————',
  rojo: '——————— fin del empate ———————',
};

export function clasificacionComoTexto(acta) {
  const lineas = [
    'CLASIFICACIÓN',
    `${FECHA.format(new Date(acta.fecha))}  ·  pasan ${acta.clasifican} de ${acta.filas.length}`,
    '',
  ];

  for (const fila of acta.filas) {
    if (fila.raya) lineas.push(RAYA_EN_TEXTO[fila.raya]);
    const notas = fila.notas
      .map((nota, i) => `${acta.jurados[i].nombre}: ${nota.texto}`)
      .join('  ');
    lineas.push(
      `${fila.posicion}${fila.clasifica ? '*' : ' '} ${fila.nombre}  —  ${notas}` +
        (acta.conTotal ? `  ·  total ${fila.total}` : '')
    );
  }

  lineas.push('', '* clasifica');
  if (acta.hayEmpate) {
    lineas.push('Los que van entre las dos rayas empatan justo en el corte:');
    lineas.push('ahí lo ha decidido el desempate y no la puntuación.');
  }
  lineas.push(acta.escala, '', `Jurado de gallos · ${FIRMA}`);
  return `${lineas.join('\n')}\n`;
}

export async function compartirClasificacionImagen(acta) {
  const lienzo = dibujarClasificacion(acta);
  const blob = await new Promise((r) => lienzo.toBlob(r, 'image/png'));
  if (!blob) throw new Error('No se ha podido generar la imagen.');

  const fichero = new File([blob], `clasificacion-${diaDe(acta.fecha)}.png`, {
    type: 'image/png',
  });
  return entregar({ files: [fichero] }, blob, fichero.name);
}

export async function compartirClasificacionTexto(acta) {
  const texto = clasificacionComoTexto(acta);
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  return entregar({ text: texto }, blob, `clasificacion-${diaDe(acta.fecha)}.txt`);
}

function diaDe(iso) {
  const fecha = new Date(iso);
  const dosCifras = (n) => String(n).padStart(2, '0');
  return [
    fecha.getFullYear(),
    dosCifras(fecha.getMonth() + 1),
    dosCifras(fecha.getDate()),
  ].join('-');
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

  lineas.push('', `Jurado de gallos · ${FIRMA}`);
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
