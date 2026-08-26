/**
 * Punto de entrada: enlaza la lógica de scoring.js con la interfaz y gobierna
 * la navegación entre vistas.
 *
 * Las vistas se manejan como una pila, igual que la navegación push de iOS:
 *   inicio → puntuación → resultado
 *   inicio → resultados anteriores → detalle
 */

import * as scoring from './scoring.js';
import {
  guardarBatalla,
  pedirPersistencia,
  guardarBorrador,
  leerBorrador,
  olvidarBorrador,
} from './storage.js';
import { crearHistorial } from './history.js';
import { crearCopia } from './transfer.js';

const NOMBRES_POR_DEFECTO = {
  [scoring.A]: 'Batallero A',
  [scoring.B]: 'Batallero B',
};

const RAIZ = 'vista-inicio';
const PUNTUACION = 'vista-puntuacion';

/** Las vistas que salen de la pila se deslizan por encima de las que revelan. */
const Z_FUERA_DE_PILA = 99;

const $ = (id) => document.getElementById(id);

const el = {
  formNueva: $('form-nueva'),
  nombreA: $('nombre-a'),
  nombreB: $('nombre-b'),
  btnHistorial: $('btn-historial'),
  btnCopia: $('btn-copia'),
  btnAvisoCopia: $('btn-aviso-copia'),
  avisoVersion: $('aviso-version'),
  btnActualizar: $('btn-actualizar'),
  avisoBorrador: $('aviso-borrador'),
  avisoBorradorTexto: $('aviso-borrador-texto'),
  btnRetomar: $('btn-retomar'),

  btnCancelar: $('btn-cancelar'),
  btnTerminar: $('btn-terminar'),
  btnBorrar: $('btn-borrar'),
  teclado: $('teclado'),
  turno: $('turno'),

  btnVolver: $('btn-volver'),
  btnGuardar: $('btn-guardar'),
  avisoGuardar: $('aviso-guardar'),

  btnCerrarHistorial: $('btn-cerrar-historial'),
  btnCerrarDetalle: $('btn-cerrar-detalle'),
  btnCerrarCopia: $('btn-cerrar-copia'),

  pila: $('pila'),
  velo: $('velo'),
  alertaTitulo: $('alerta-titulo'),
  alertaTexto: $('alerta-texto'),
  alertaSi: $('alerta-si'),
  alertaNo: $('alerta-no'),
};

/** Referencias de cada marcador, agrupadas por batallero. */
const marcador = {
  [scoring.A]: {
    caja: $('marcador-a'),
    nombre: $('marcador-a-nombre'),
    total: $('marcador-a-total'),
    notas: $('marcador-a-notas'),
    secuencia: $('marcador-a-secuencia'),
  },
  [scoring.B]: {
    caja: $('marcador-b'),
    nombre: $('marcador-b-nombre'),
    total: $('marcador-b-total'),
    notas: $('marcador-b-notas'),
    secuencia: $('marcador-b-secuencia'),
  },
};

const finalDe = {
  [scoring.A]: {
    nombre: $('final-a-nombre'),
    total: $('final-a-total'),
    secuencia: $('final-a-secuencia'),
  },
  [scoring.B]: {
    nombre: $('final-b-nombre'),
    total: $('final-b-total'),
    secuencia: $('final-b-secuencia'),
  },
};

/** Batalla en curso, o null si no hay ninguna. */
let batalla = null;

/** Batalla que quedó a medias de una sesión anterior, aún sin retomar. */
let aMedias = null;

// ── Navegación ─────────────────────────────────────────────────────────────

let pila = [RAIZ];
let navegando = false;
let finDeTransicion = 0;

function pintarPila({ bloquear = true } = {}) {
  const cima = pila.length - 1;

  for (const vista of document.querySelectorAll('.vista')) {
    const i = pila.indexOf(vista.id);
    const activa = i === cima;

    vista.classList.toggle('vista--activa', activa);
    vista.classList.toggle('vista--atras', i >= 0 && i < cima);
    vista.style.zIndex = i >= 0 ? String(i + 1) : String(Z_FUERA_DE_PILA);
    vista.inert = !activa;
  }

  // El recordatorio de copia vive en el inicio: se recalcula cada vez que se
  // vuelve, que es por donde se pasa después de guardar, borrar o importar.
  if (enCima(RAIZ)) copia.refrescarAviso();

  if (bloquear) bloquearDuranteLaTransicion();
}

/**
 * Mientras una vista se desliza, los botones no están donde se ven. Durante
 * ese tercio de segundo no aceptamos ni toques ni teclas, para que una
 * pulsación a destiempo no acabe en el botón equivocado.
 */
function bloquearDuranteLaTransicion() {
  const ms = duracionDeLaTransicion();
  if (ms < 1) return; // con movimiento reducido no hay nada que esperar

  navegando = true;
  el.pila.classList.add('pila--navegando');

  clearTimeout(finDeTransicion);
  finDeTransicion = setTimeout(() => {
    navegando = false;
    el.pila.classList.remove('pila--navegando');
  }, ms);
}

/** La duración la manda el CSS, que es quien sabe de `prefers-reduced-motion`. */
function duracionDeLaTransicion() {
  const vista = document.querySelector('.vista');
  return parseFloat(getComputedStyle(vista).transitionDuration) * 1000;
}

function empujar(id) {
  if (pila.includes(id)) return;
  pila.push(id);
  pintarPila();
}

function sacar() {
  if (pila.length < 2) return;
  pila.pop();
  pintarPila();
}

function volverAlaRaiz() {
  pila = [RAIZ];
  pintarPila();
}

const enCima = (id) => pila[pila.length - 1] === id;

// ── Nombres ────────────────────────────────────────────────────────────────

function nombreDe(bat, cual = batalla) {
  const propio = bat === scoring.A ? cual.batalleroA : cual.batalleroB;
  return propio || NOMBRES_POR_DEFECTO[bat];
}

function comoSeLlaman(cual) {
  return `${nombreDe(scoring.A, cual)} · ${nombreDe(scoring.B, cual)}`;
}

// ── Pintado ────────────────────────────────────────────────────────────────

function pintarSecuencia(contenedor, notas) {
  contenedor.replaceChildren(
    ...notas.map((valor) => {
      const nota = document.createElement('span');
      nota.className = 'nota';
      nota.textContent = valor;
      return nota;
    })
  );
}

function pintarPuntuacion() {
  for (const bat of [scoring.A, scoring.B]) {
    const vista = marcador[bat];
    const cuantas = scoring.cuantasNotas(batalla, bat);
    const activo = batalla.cursor === bat;

    vista.nombre.textContent = nombreDe(bat);
    vista.total.textContent = scoring.total(batalla, bat);
    vista.notas.textContent = cuantas === 1 ? '1 nota' : `${cuantas} notas`;
    vista.caja.classList.toggle('marcador--activo', activo);
    vista.caja.setAttribute('aria-pressed', String(activo));
    pintarSecuencia(vista.secuencia, scoring.notasDe(batalla, bat));
  }

  const vacia = scoring.estaVacia(batalla);
  el.btnBorrar.disabled = vacia;
  el.btnTerminar.disabled = vacia;
  el.turno.textContent = `Puntuando a ${nombreDe(batalla.cursor)}`;
}

function pintarFinal() {
  for (const bat of [scoring.A, scoring.B]) {
    const vista = finalDe[bat];
    const notas = scoring.notasDe(batalla, bat);

    vista.nombre.textContent = nombreDe(bat);
    vista.total.textContent = scoring.total(batalla, bat);
    vista.secuencia.textContent = notas.length ? notas.join(' · ') : 'Ninguna';
  }

  el.avisoGuardar.textContent = '';
  el.btnGuardar.disabled = false;
}

// ── Alerta de confirmación ─────────────────────────────────────────────────

function confirmar({ titulo, texto, aceptar, cancelar }) {
  return new Promise((resolver) => {
    const focoPrevio = document.activeElement;

    el.alertaTitulo.textContent = titulo;
    el.alertaTexto.textContent = texto;
    el.alertaSi.textContent = aceptar;
    el.alertaNo.textContent = cancelar;

    el.pila.inert = true;
    el.velo.hidden = false;
    el.alertaNo.focus();

    const cerrar = (respuesta) => {
      el.velo.hidden = true;
      el.pila.inert = false;
      el.alertaSi.removeEventListener('click', alAceptar);
      el.alertaNo.removeEventListener('click', alCancelar);
      document.removeEventListener('keydown', alTeclear);
      focoPrevio?.focus?.();
      resolver(respuesta);
    };

    const alAceptar = () => cerrar(true);
    const alCancelar = () => cerrar(false);
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') cerrar(false);
    };

    el.alertaSi.addEventListener('click', alAceptar);
    el.alertaNo.addEventListener('click', alCancelar);
    document.addEventListener('keydown', alTeclear);
  });
}

const historial = crearHistorial({ empujar, sacar, confirmar });
const copia = crearCopia({ empujar });

// ── Batalla en curso a salvo ───────────────────────────────────────────────

/**
 * La batalla en curso se apunta en cada cambio, para que una llamada entrante
 * o un cierre a mitad no se lleven por delante una batalla entera.
 *
 * Nunca hay más de una escritura en vuelo: si llegan notas mientras se está
 * guardando, se anota que hay que repetir al terminar. Así puntuar deprisa no
 * encola decenas de transacciones, y lo último que se pulsó siempre acaba
 * escrito. El pintado va por delante y no espera a esto.
 */
let apuntando = false;
let quedaPorApuntar = false;

function apuntarBorrador() {
  if (!batalla) return;

  if (apuntando) {
    quedaPorApuntar = true;
    return;
  }

  apuntando = true;
  guardarBorrador(batalla)
    .catch((error) => console.error('No se ha podido apuntar la batalla:', error))
    .finally(() => {
      apuntando = false;
      if (quedaPorApuntar) {
        quedaPorApuntar = false;
        apuntarBorrador();
      }
    });
}

function soltarBorrador() {
  quedaPorApuntar = false;
  olvidarBorrador().catch((error) =>
    console.error('No se ha podido soltar el borrador:', error)
  );
}

/** Al arrancar: si quedó algo a medias, se ofrece sin imponer nada. */
async function buscarLoQueQuedoAMedias() {
  let restaurada;
  try {
    restaurada = scoring.restaurarBatalla(await leerBorrador());
  } catch (error) {
    console.error('No se ha podido leer la batalla a medias:', error);
    return;
  }

  if (!restaurada || scoring.estaVacia(restaurada)) return;

  aMedias = restaurada;
  const cuantas = restaurada.puntuaciones.length;
  el.avisoBorradorTexto.textContent =
    `Dejaste a medias ${comoSeLlaman(restaurada)}, con ${cuantas === 1 ? '1 nota' : `${cuantas} notas`}.`;
  el.avisoBorrador.hidden = false;
}

function retomar() {
  if (!aMedias) return;

  batalla = aMedias;
  olvidarLoQueQuedoAMedias();
  pintarPuntuacion();
  empujar(PUNTUACION);
}

function olvidarLoQueQuedoAMedias() {
  aMedias = null;
  el.avisoBorrador.hidden = true;
}

// ── Acciones ───────────────────────────────────────────────────────────────

async function empezarBatalla(evento) {
  evento.preventDefault();
  document.activeElement?.blur?.(); // cierra el teclado de iOS

  // Empezar otra encima de una a medias la borraría sin más: mejor preguntar.
  if (aMedias) {
    const otra = await confirmar({
      titulo: '¿Empezar otra batalla?',
      texto: `Se perderá ${comoSeLlaman(aMedias)}, que dejaste a medias.`,
      aceptar: 'Empezar otra',
      cancelar: 'Retomar la de antes',
    });
    if (!otra) {
      retomar();
      return;
    }
    olvidarLoQueQuedoAMedias();
  }

  batalla = scoring.crearBatalla(el.nombreA.value, el.nombreB.value);
  pintarPuntuacion();
  empujar(PUNTUACION);
  apuntarBorrador();
}

function anotar(valor) {
  batalla = scoring.anotar(batalla, valor, Date.now());
  pintarPuntuacion();
  apuntarBorrador();
}

function borrar() {
  if (scoring.estaVacia(batalla)) return;
  batalla = scoring.deshacer(batalla);
  pintarPuntuacion();
  apuntarBorrador();
}

function apuntarA(bat) {
  batalla = scoring.moverCursor(batalla, bat);
  pintarPuntuacion();
  apuntarBorrador();
}

async function cancelar() {
  if (!scoring.estaVacia(batalla)) {
    const cuantas = batalla.puntuaciones.length;
    const seguro = await confirmar({
      titulo: '¿Descartar la batalla?',
      texto:
        cuantas === 1
          ? 'Se perderá la nota que has metido.'
          : `Se perderán las ${cuantas} notas que has metido.`,
      aceptar: 'Descartar',
      cancelar: 'Seguir puntuando',
    });
    if (!seguro) return;
  }

  soltarBatalla();
}

function terminar() {
  if (scoring.estaVacia(batalla)) return;
  pintarFinal();
  empujar('vista-final');
}

async function guardar() {
  if (!batalla || scoring.estaVacia(batalla)) return;

  el.btnGuardar.disabled = true;
  el.avisoGuardar.textContent = '';

  try {
    await guardarBatalla({
      batalleroA: nombreDe(scoring.A),
      batalleroB: nombreDe(scoring.B),
      puntuaciones: batalla.puntuaciones,
      totalA: scoring.total(batalla, scoring.A),
      totalB: scoring.total(batalla, scoring.B),
    });
    soltarBatalla();
  } catch (error) {
    console.error('No se ha podido guardar la batalla:', error);
    el.avisoGuardar.textContent =
      'No se ha podido guardar. Inténtalo otra vez.';
    el.btnGuardar.disabled = false;
  }
}

function soltarBatalla() {
  batalla = null;
  soltarBorrador();
  el.formNueva.reset();
  volverAlaRaiz();
}

// ── Enlaces ────────────────────────────────────────────────────────────────

el.formNueva.addEventListener('submit', empezarBatalla);
el.btnHistorial.addEventListener('click', () => historial.abrir());

// El campo A anuncia «siguiente» en el teclado de iOS: que lo cumpla.
el.nombreA.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter') {
    evento.preventDefault();
    el.nombreB.focus();
  }
});

el.teclado.addEventListener('click', (evento) => {
  const tecla = evento.target.closest('[data-nota]');
  if (tecla) anotar(Number(tecla.dataset.nota));
});

el.btnBorrar.addEventListener('click', borrar);
el.btnCancelar.addEventListener('click', cancelar);
el.btnTerminar.addEventListener('click', terminar);
el.btnVolver.addEventListener('click', sacar);
el.btnGuardar.addEventListener('click', guardar);

el.btnCerrarHistorial.addEventListener('click', sacar);
el.btnCerrarDetalle.addEventListener('click', sacar);
el.btnCerrarCopia.addEventListener('click', sacar);

el.btnCopia.addEventListener('click', () => copia.abrir());
el.btnAvisoCopia.addEventListener('click', () => copia.abrir());
el.btnRetomar.addEventListener('click', retomar);

marcador[scoring.A].caja.addEventListener('click', () => apuntarA(scoring.A));
marcador[scoring.B].caja.addEventListener('click', () => apuntarA(scoring.B));

/** Teclado físico, para poder puntuar cómodo desde el ordenador. */
document.addEventListener('keydown', (evento) => {
  if (navegando || !enCima(PUNTUACION) || !el.velo.hidden) return;
  if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

  if (evento.key >= '0' && evento.key <= '4') {
    evento.preventDefault();
    anotar(Number(evento.key));
  } else if (evento.key === 'Backspace' || evento.key === 'Delete') {
    evento.preventDefault();
    borrar();
  }
});

// ── Versiones nuevas ───────────────────────────────────────────────────────

/**
 * El service worker nuevo se queda esperando en vez de tomar el relevo solo:
 * recargar a mitad de una batalla la perdería. En cuanto hay uno esperando se
 * enciende el aviso del inicio, que es el único sitio donde recargar no cuesta
 * nada, y el relevo lo pide el usuario.
 */
function vigilarVersiones() {
  if (!('serviceWorker' in navigator)) return;

  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((registro) => {
      // Puede haber quedado uno esperando de una visita anterior.
      anunciarSiEspera(registro.waiting);

      registro.addEventListener('updatefound', () => {
        const entrante = registro.installing;
        entrante?.addEventListener('statechange', () => {
          if (entrante.state === 'installed') anunciarSiEspera(entrante);
        });
      });
    })
    .catch((error) => {
      console.error('No se ha podido registrar el service worker:', error);
    });
}

function anunciarSiEspera(trabajador) {
  // Sin controller es la primera instalación: no hay versión vieja que relevar.
  if (!trabajador || !navigator.serviceWorker.controller) return;

  el.avisoVersion.hidden = false;
  el.btnActualizar.onclick = () => {
    el.btnActualizar.disabled = true;
    trabajador.postMessage({ tipo: 'ACTIVAR_YA' });
  };
}

// ── Arranque ───────────────────────────────────────────────────────────────

pintarPila({ bloquear: false });
pedirPersistencia();
buscarLoQueQuedoAMedias();
vigilarVersiones();
