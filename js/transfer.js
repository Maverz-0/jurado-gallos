/**
 * Exportar e importar.
 *
 * En el iPhone una web no puede quedarse conectada a una carpeta del sistema
 * (Safari no trae los selectores de la File System Access API), así que la
 * copia es manual: se genera un fichero y se suelta en la hoja de compartir.
 */

import { listarBatallas, importarBatallas } from './storage.js';
import { alDia } from './compat.js';

/** Fecha de la última copia de seguridad, en ISO. */
const CLAVE_ULTIMA_COPIA = 'jurado-gallos:ultima-copia';

/** A partir de cuántas batallas sin copia avisamos en la pantalla de inicio. */
const UMBRAL_AVISO = 10;

const FECHA_LARGA = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const FECHA_CORTA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const $ = (id) => document.getElementById(id);

export function crearCopia({ empujar }) {
  const el = {
    btnJson: $('btn-exportar-json'),
    btnTxt: $('btn-exportar-txt'),
    fichero: $('fichero-importar'),
    estado: $('estado-copia'),

    aviso: $('aviso-copia'),
    avisoTexto: $('aviso-copia-texto'),
  };

  function abrir() {
    el.estado.textContent = '';
    empujar('vista-copia');
  }

  // ── Exportar ─────────────────────────────────────────────────────────────

  async function exportar(formato) {
    let batallas;
    try {
      batallas = await listarBatallas();
    } catch (error) {
      console.error('No se han podido leer las batallas:', error);
      el.estado.textContent = 'No se han podido leer las batallas.';
      return;
    }

    if (batallas.length === 0) {
      el.estado.textContent = 'Todavía no hay ninguna batalla que exportar.';
      return;
    }

    const ahora = new Date();
    const esCopia = formato === 'json';
    const contenido = esCopia
      ? comoJson(batallas, ahora)
      : comoTexto(batallas, ahora);

    descargar(
      contenido,
      `jurado-gallos-${enNombreDeFichero(ahora)}.${formato}`,
      esCopia ? 'application/json' : 'text/plain'
    );

    // Sólo el .json vale para restaurar, así que sólo él cuenta como copia.
    if (esCopia) apuntarUltimaCopia(listonDeLaCopia(batallas, ahora));

    el.estado.textContent = esCopia
      ? `Copia de seguridad generada con ${cuantasBatallas(batallas.length)}.`
      : `Texto generado con ${cuantasBatallas(batallas.length)}.`;

    await refrescarAviso();
  }

  // ── Importar ─────────────────────────────────────────────────────────────

  async function importar(fichero) {
    el.estado.textContent = '';

    let sobre;
    try {
      sobre = JSON.parse(await fichero.text());
    } catch {
      el.estado.textContent = 'Ese fichero no es un .json válido.';
      return;
    }

    const crudas = Array.isArray(sobre?.batallas) ? sobre.batallas : null;
    if (!crudas) {
      el.estado.textContent =
        'Ese .json no parece una copia de Jurado de gallos.';
      return;
    }

    // Una copia hecha antes del cambio trae dos batalleros sueltos; se traduce
    // al vuelo para que las copias viejas se sigan pudiendo restaurar.
    const buenas = crudas.map(alDia).filter(esBatallaValida);
    const ilegibles = crudas.length - buenas.length;

    let resultado;
    try {
      resultado = await importarBatallas(buenas);
    } catch (error) {
      console.error('No se han podido importar las batallas:', error);
      el.estado.textContent = 'No se ha podido importar. Inténtalo otra vez.';
      return;
    }

    el.estado.textContent = resumenDeImportacion({ ...resultado, ilegibles });
    await refrescarAviso();
  }

  // ── Aviso de la pantalla de inicio ───────────────────────────────────────

  async function refrescarAviso() {
    let batallas;
    try {
      batallas = await listarBatallas();
    } catch {
      el.aviso.hidden = true;
      return;
    }

    const desde = leerUltimaCopia();
    const sinCopia = desde
      ? batallas.filter((batalla) => batalla.fecha > desde).length
      : batallas.length;

    el.aviso.hidden = sinCopia <= UMBRAL_AVISO;
    if (!el.aviso.hidden) {
      el.avisoTexto.textContent = `Tienes ${cuantasBatallas(sinCopia)} sin copia de seguridad.`;
    }
  }

  // ── Enlaces ──────────────────────────────────────────────────────────────

  el.btnJson.addEventListener('click', () => exportar('json'));
  el.btnTxt.addEventListener('click', () => exportar('txt'));

  el.fichero.addEventListener('change', () => {
    const [fichero] = el.fichero.files;
    if (fichero) importar(fichero);
    // Se vacía para poder volver a elegir el mismo fichero después.
    el.fichero.value = '';
  });

  return { abrir, refrescarAviso };
}

// ── Formatos ───────────────────────────────────────────────────────────────

/** La copia completa: se guarda tal cual está en la base, para poder volver. */
function comoJson(batallas, ahora) {
  return JSON.stringify(
    {
      app: 'jurado-gallos',
      version: 1,
      exportado: ahora.toISOString(),
      batallas,
    },
    null,
    2
  );
}

/** La versión para leer o compartir. No se reimporta. */
function comoTexto(batallas, ahora) {
  const raya = '-'.repeat(52);

  const cabecera = [
    'JURADO DE GALLOS',
    `Copia exportada el ${FECHA_CORTA.format(ahora)}`,
    cuantasBatallas(batallas.length),
  ].join('\n');

  const cuerpo = batallas.map((batalla, i) => {
    const nombres = batalla.batalleros.map((batallero) => batallero.nombre);

    const lineas = batalla.batalleros.map((batallero) => {
      const notas = notasDe(batalla, batallero.id);
      return `   ${batallero.nombre}: ${notas.length ? notas.join(' · ') : 'sin notas'}  =  ${batallero.total}`;
    });

    return [
      `${i + 1}. ${nombres.join(' · ')}`,
      `   ${FECHA_LARGA.format(new Date(batalla.fecha))}`,
      '',
      ...lineas,
    ].join('\n');
  });

  return [cabecera, ...cuerpo].join(`\n\n${raya}\n\n`) + '\n';
}

function notasDe(batalla, id) {
  return batalla.puntuaciones
    .filter((puntuacion) => puntuacion.batallero === id)
    .map((puntuacion) => puntuacion.valor);
}

// ── Descarga ───────────────────────────────────────────────────────────────

/**
 * Un Blob y un <a download>: en iOS eso acaba en la hoja de compartir, que es
 * la única vía para sacar el fichero de la app.
 */
function descargar(contenido, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();

  // Safari necesita que la URL siga viva mientras arranca la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Validación de lo que llega de fuera ────────────────────────────────────

function esBatallaValida(batalla) {
  if (!batalla || typeof batalla !== 'object') return false;
  if (typeof batalla.id !== 'string' || batalla.id.length === 0) return false;
  if (typeof batalla.fecha !== 'string') return false;
  if (Number.isNaN(Date.parse(batalla.fecha))) return false;
  if (!Array.isArray(batalla.batalleros)) return false;
  if (batalla.batalleros.length < 2) return false;
  if (!batalla.batalleros.every(esBatalleroValido)) return false;
  if (!Array.isArray(batalla.puntuaciones)) return false;

  const ids = new Set(batalla.batalleros.map((batallero) => batallero.id));
  if (ids.size !== batalla.batalleros.length) return false;

  return batalla.puntuaciones.every(
    (puntuacion) =>
      !!puntuacion &&
      typeof puntuacion === 'object' &&
      ids.has(puntuacion.batallero) &&
      Number.isInteger(puntuacion.valor)
  );
}

function esBatalleroValido(batallero) {
  return (
    !!batallero &&
    typeof batallero === 'object' &&
    typeof batallero.id === 'string' &&
    batallero.id.length > 0 &&
    typeof batallero.nombre === 'string' &&
    Number.isFinite(batallero.total)
  );
}

// ── Última copia ───────────────────────────────────────────────────────────

function leerUltimaCopia() {
  try {
    return localStorage.getItem(CLAVE_ULTIMA_COPIA);
  } catch {
    return null; // navegación privada, o almacenamiento bloqueado
  }
}

function apuntarUltimaCopia(iso) {
  try {
    localStorage.setItem(CLAVE_ULTIMA_COPIA, iso);
  } catch {
    // Si no se puede recordar, el aviso saldrá de más. No es grave.
  }
}

/**
 * Marca de agua de la copia: la hora a la que se hizo o, si alguna batalla
 * lleva fecha por delante del reloj, la de esa batalla. Sin esto, una copia
 * traída de un dispositivo adelantado dejaría el aviso encendido para siempre,
 * porque sus batallas seguirían contando como posteriores a toda copia nueva.
 */
function listonDeLaCopia(batallas, ahora) {
  return batallas.reduce(
    (tope, batalla) => (batalla.fecha > tope ? batalla.fecha : tope),
    ahora.toISOString()
  );
}

// ── Textos ─────────────────────────────────────────────────────────────────

function cuantasBatallas(cuantas) {
  return cuantas === 1 ? '1 batalla' : `${cuantas} batallas`;
}

function resumenDeImportacion({ anadidas, repetidas, ilegibles }) {
  if (anadidas === 0 && repetidas === 0 && ilegibles === 0) {
    return 'Ese fichero no traía ninguna batalla.';
  }

  const partes = [
    anadidas === 0
      ? 'No se ha añadido ninguna batalla.'
      : `Se ${anadidas === 1 ? 'ha añadido 1 batalla' : `han añadido ${anadidas} batallas`}.`,
  ];

  if (repetidas > 0) {
    partes.push(
      repetidas === 1 ? '1 ya la tenías.' : `${repetidas} ya las tenías.`
    );
  }

  if (ilegibles > 0) {
    partes.push(
      ilegibles === 1
        ? '1 venía mal y se ha dejado fuera.'
        : `${ilegibles} venían mal y se han dejado fuera.`
    );
  }

  return partes.join(' ');
}

function enNombreDeFichero(fecha) {
  const dosCifras = (numero) => String(numero).padStart(2, '0');
  return [
    fecha.getFullYear(),
    dosCifras(fecha.getMonth() + 1),
    dosCifras(fecha.getDate()),
  ].join('-');
}
