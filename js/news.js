/**
 * Novedades: qué ha ido cambiando en la app, y el aviso de que hay algo sin
 * leer.
 *
 * La lista se escribe a mano aquí, de lo más nuevo a lo más viejo. Al añadir
 * una entrada arriba, la señal se enciende sola para todo el que abra la app:
 * lo que decide si hay aviso es el `id` de la primera, comparado con el que el
 * usuario ya dio por leído.
 *
 * No sabe navegar: app.js le pasa esa parte al construirla, como al historial.
 */

import { $, clonar, poner } from './dom.js';

const FECHA = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Preferencias sueltas: no son datos de batallas, así que van en localStorage. */
const CLAVE_LEIDA = 'jurado-gallos:novedad-leida';
const CLAVE_DESDE = 'jurado-gallos:novedad-desde';

/** Lo que dura encendida la señal si no se entra a leerla. */
export const DIAS_DE_SENAL = 3;
const ESPERA = DIAS_DE_SENAL * 24 * 60 * 60 * 1000;

/**
 * De lo más nuevo a lo más viejo. El `id` de cada una es lo que se apunta como
 * leído, así que no se toca una vez publicada.
 */
export const NOVEDADES = [
  {
    id: '2026-09-04-novedades',
    fecha: '2026-09-04',
    titulo: 'Notas de parche',
    puntos: [
      'Nueva sección **Novedades** en el inicio: la lista de todo lo que ha ido cambiando, y cada entrada se despliega para ver el detalle.',
      'Cuando haya algo sin leer, la sección se enciende con una exclamación. Se apaga al entrar a leerla, o sola a los tres días.',
    ],
  },
  {
    id: '2026-09-04-turno',
    fecha: '2026-09-04',
    titulo: 'El turno se ve mejor',
    puntos: [
      'Cada tramo lo abre un gallo distinto: el primero lo abre el primero, el siguiente el segundo, y así dando la vuelta.',
      'Además de teñirse la fila del gallo al que le toca, se resalta la casilla exacta donde va a caer la siguiente nota.',
      'Un tramo con las intervenciones en indefinido enseña siempre una casilla vacía de más, que es el sitio de la siguiente.',
    ],
  },
  {
    id: '2026-09-04-modalidades',
    fecha: '2026-09-04',
    titulo: '4×4 y 8×8, y las intervenciones aparte',
    puntos: [
      'El N×N se parte en dos: **4×4** alterna de uno en uno y **8×8** de dos en dos, con los cuadritos separados en parejas.',
      'La dinámica deja de ser una modalidad y pasa a ser el valor **Indefinido** del contador de intervenciones, por debajo del 1.',
      'Las batallas guardadas antes se traducen solas, sin mover una nota.',
    ],
  },
  {
    id: '2026-08-27-inicio',
    fecha: '2026-08-27',
    titulo: 'Un inicio más despejado',
    puntos: [
      'La pantalla de inicio deja sólo cuatro cosas: Batalla, Filtros, Resultados anteriores y Copia de seguridad. Cada modo abre su propia preparación.',
      'En los filtros, **Guardar y cerrar** guarda y vuelve al inicio, y «Añadir jurado» y «Compartir» suben encima de la tabla.',
      'Los mandos de quitar y arrastrar se separan a lados opuestos del nombre, que pegados era fácil borrar a alguien queriendo moverlo.',
    ],
  },
  {
    id: '2026-08-27-corte',
    fecha: '2026-08-27',
    titulo: 'Filtros: el corte, los empates y los jurados',
    puntos: [
      'Una raya verde y roja separa a los que clasifican de los que no, y si hay empate justo en el corte se parte en dos y los empatados salen en amarillo.',
      'Los jurados llevan nombre, y se puede cambiar tocando su columna.',
      'Se puede puntuar a cada participante con una sola nota, sin desglosar por intervenciones.',
    ],
  },
  {
    id: '2026-08-27-guardar-filtros',
    fecha: '2026-08-27',
    titulo: 'Filtros: guardar y arrastrar entre grupos',
    puntos: [
      'Los filtros se guardan en Resultados anteriores y se pueden reabrir para seguir añadiéndoles jurados.',
      'Arrastrando se puede mover a alguien dentro de su grupo o a otro distinto, y sus notas viajan con él.',
      'La firma **by Maverz** acompaña al nombre de la app y a todo lo que se exporta.',
    ],
  },
  {
    id: '2026-08-27-filtros',
    fecha: '2026-08-27',
    titulo: 'Llegan los filtros',
    puntos: [
      'Un modo nuevo, aparte de las batallas: participantes repartidos en grupos, y clasifican los mejores del conjunto.',
      'La nota de cada uno es la media de sus intervenciones, redondeada a enteros o a medios.',
      'Tabla final con una columna por jurado, la suma y el puesto, y las casillas coloreadas según lo que habría pasado con cada jurado por separado.',
    ],
  },
  {
    id: '2026-08-26-escala',
    fecha: '2026-08-26',
    titulo: 'Escala a medida, compartir y pantalla encendida',
    puntos: [
      'La nota máxima se elige al preparar la batalla, y hay medios puntos si se quieren.',
      'El acta se comparte como imagen —en WhatsApp se ve como una foto— o como texto para pegar en un chat.',
      'Interruptor para que la pantalla del móvil no se apague mientras se puntúa.',
    ],
  },
  {
    id: '2026-08-26-tramos',
    fecha: '2026-08-26',
    titulo: 'Tramos, modalidades y réplica',
    puntos: [
      'Una batalla pasa a ser una secuencia de tramos, cada uno con su modalidad, y se pueden añadir con la batalla empezada.',
      'La réplica va aparte y nunca se suma al marcador.',
    ],
  },
  {
    id: '2026-08-26-gallos',
    fecha: '2026-08-26',
    titulo: 'Hasta diez gallos, y nada se pierde',
    puntos: [
      'De 2 a 10 batalleros, reordenables arrastrando: el orden es el turno.',
      'La batalla en curso se apunta en cada nota, así que una llamada o un cierre a mitad ya no se la llevan por delante.',
    ],
  },
  {
    id: '2026-08-26-primera',
    fecha: '2026-08-26',
    titulo: 'Primera versión',
    puntos: [
      'Puntuar una batalla en directo, intervención a intervención, desde el móvil.',
      'Los resultados se guardan en el propio dispositivo y se pueden consultar y exportar.',
      'Se instala en la pantalla de inicio y funciona sin conexión.',
    ],
  },
];

/** La más nueva es la que decide si hay algo que avisar. */
export const ULTIMA = NOVEDADES[0]?.id ?? null;

/**
 * Si la señal debe verse.
 *
 * Se apaga de dos maneras: entrando a leerla, que apunta la última como leída,
 * o sola a los tres días de la primera vez que se abrió la app con ella. Lo
 * segundo hace falta porque quien no piense entrar tampoco tiene por qué
 * cargar con la exclamación para siempre.
 */
export function hayQueAvisar({ ultima, leida, desde, ahora }) {
  if (!ultima || leida === ultima) return false;
  if (!Number.isFinite(desde)) return true;
  return ahora - desde < ESPERA;
}

export function crearNovedades({ empujar, sacar }) {
  const el = {
    tarjeta: $('tarjeta-novedades'),
    boton: $('btn-novedades'),
    senal: $('senal-novedades'),
    cerrar: $('btn-cerrar-novedades'),
    lista: $('lista-novedades'),
    tpl: $('tpl-novedad'),
    tplPunto: $('tpl-novedad-punto'),
  };

  let pintada = false;

  /**
   * Cuándo se vio por primera vez la novedad de ahora. Si la que hay es otra,
   * la cuenta de los tres días empieza de cero.
   */
  function desdeCuando() {
    const guardado = leer(CLAVE_DESDE);
    const [id, ts] = (guardado ?? '').split('|');

    if (id === ULTIMA && Number.isFinite(Number(ts))) return Number(ts);

    const ahora = Date.now();
    apuntar(CLAVE_DESDE, `${ULTIMA}|${ahora}`);
    return ahora;
  }

  function refrescarSenal() {
    const avisar = hayQueAvisar({
      ultima: ULTIMA,
      leida: leer(CLAVE_LEIDA),
      desde: desdeCuando(),
      ahora: Date.now(),
    });

    el.senal.hidden = !avisar;
    el.tarjeta.classList.toggle('tarjeta--avisa', avisar);
  }

  function abrir() {
    apuntar(CLAVE_LEIDA, ULTIMA);
    refrescarSenal();

    // La lista no cambia mientras la app está abierta: se pinta una vez.
    if (!pintada) {
      el.lista.replaceChildren(...NOVEDADES.map(comoFila));
      pintada = true;
    }

    empujar('vista-novedades');
  }

  /** La primera viene abierta: es a lo que se entra a mirar. */
  function comoFila(novedad, i) {
    const caja = clonar(el.tpl);
    const cabecera = caja.querySelector('.novedad__cabecera');
    const puntos = caja.querySelector('.novedad__puntos');

    poner(caja.querySelector('.novedad__titulo'), novedad.titulo);
    poner(
      caja.querySelector('.novedad__fecha'),
      FECHA.format(new Date(`${novedad.fecha}T00:00:00`))
    );

    puntos.replaceChildren(...novedad.puntos.map(comoPunto));
    puntos.id = `novedad-${novedad.id}`;
    cabecera.setAttribute('aria-controls', puntos.id);

    desplegar(cabecera, puntos, i === 0);
    cabecera.addEventListener('click', () => {
      desplegar(cabecera, puntos, puntos.hidden);
    });

    return caja;
  }

  /**
   * El texto lleva **negritas** para destacar el nombre de lo que cambió. Se
   * parte por los asteriscos y se pone trozo a trozo: nada de innerHTML.
   */
  function comoPunto(texto) {
    const punto = clonar(el.tplPunto);

    texto.split('**').forEach((trozo, i) => {
      if (!trozo) return;

      if (i % 2 === 0) {
        punto.append(trozo);
        return;
      }

      const fuerte = document.createElement('strong');
      fuerte.textContent = trozo;
      punto.append(fuerte);
    });

    return punto;
  }

  function desplegar(cabecera, puntos, abierta) {
    puntos.hidden = !abierta;
    cabecera.setAttribute('aria-expanded', String(abierta));
    cabecera.classList.toggle('novedad__cabecera--abierta', abierta);
  }

  el.boton.addEventListener('click', abrir);
  el.cerrar.addEventListener('click', sacar);
  refrescarSenal();
}

function leer(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null; // navegación privada, o almacenamiento bloqueado
  }
}

function apuntar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento la señal saldrá de más. No es grave.
  }
}
