/**
 * Punto de entrada: enlaza la lógica de scoring.js con la interfaz y gobierna
 * la navegación entre vistas.
 *
 * Las vistas se manejan como una pila, igual que la navegación push de iOS:
 *   inicio → puntuación → resultado
 *   inicio → resultados anteriores → detalle
 *   inicio → copia de seguridad
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

const RAIZ = 'vista-inicio';
const PUNTUACION = 'vista-puntuacion';

/** Las vistas que salen de la pila se deslizan por encima de las que revelan. */
const Z_FUERA_DE_PILA = 99;

/**
 * Cómo se reparten los marcadores según cuántos batalleros haya. Con dos las
 * cifras caben enormes; con diez hay que apretarlas para que sigan viéndose
 * todas a la vez, que es lo que un jurado quiere mirar.
 */
const REPARTO = [
  { hasta: 2, columnas: 2, cifra: 'clamp(40px, 13vw, 60px)' },
  { hasta: 3, columnas: 3, cifra: 'clamp(30px, 9vw, 40px)' },
  { hasta: 4, columnas: 2, cifra: 'clamp(34px, 11vw, 48px)' },
  { hasta: 6, columnas: 3, cifra: 'clamp(28px, 8vw, 36px)' },
  { hasta: 8, columnas: 4, cifra: 'clamp(22px, 6vw, 30px)' },
  { hasta: 10, columnas: 5, cifra: 'clamp(19px, 5vw, 26px)' },
];

const $ = (id) => document.getElementById(id);

const el = {
  formNueva: $('form-nueva'),
  lista: $('lista-batalleros'),
  btnAnadir: $('btn-anadir'),
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
  marcadores: $('marcadores'),
  pistaCarril: $('pista-carril'),
  pistaEtiquetas: $('pista-etiquetas'),
  pistaFilas: $('pista-filas'),

  btnVolver: $('btn-volver'),
  btnGuardar: $('btn-guardar'),
  avisoGuardar: $('aviso-guardar'),
  finalBatalleros: $('final-batalleros'),

  btnCerrarHistorial: $('btn-cerrar-historial'),
  btnCerrarDetalle: $('btn-cerrar-detalle'),
  btnCerrarCopia: $('btn-cerrar-copia'),

  pila: $('pila'),
  velo: $('velo'),
  alertaTitulo: $('alerta-titulo'),
  alertaTexto: $('alerta-texto'),
  alertaSi: $('alerta-si'),
  alertaNo: $('alerta-no'),

  tplBatallero: $('tpl-batallero'),
  tplMarcador: $('tpl-marcador'),
  tplEtiqueta: $('tpl-etiqueta'),
  tplFilaVotos: $('tpl-fila-votos'),
  tplVoto: $('tpl-voto'),
  tplFinal: $('tpl-final'),
};

/** Batalla en curso, o null si no hay ninguna. */
let batalla = null;

/** Batalla que quedó a medias de una sesión anterior, aún sin retomar. */
let aMedias = null;

/** Los batalleros que se están preparando en la pantalla de inicio. */
let plantilla = [];
let contadorIds = 0;

// ── Nombres ────────────────────────────────────────────────────────────────

/** Un nombre en blanco se numera por la posición que ocupa. */
function comoSeLlama(batalleros, id) {
  const i = batalleros.findIndex((batallero) => batallero.id === id);
  return i < 0 ? '' : batalleros[i].nombre || `Batallero ${i + 1}`;
}

function todosLosNombres(batalleros) {
  return batalleros
    .map((batallero) => comoSeLlama(batalleros, batallero.id))
    .join(' · ');
}

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

// ── Preparar los batalleros ────────────────────────────────────────────────

function nuevoBatallero() {
  contadorIds += 1;
  return { id: `b${contadorIds}`, nombre: '' };
}

function reiniciarPlantilla() {
  contadorIds = 0;
  plantilla = [nuevoBatallero(), nuevoBatallero()];
  pintarPlantilla();
}

function pintarPlantilla() {
  el.lista.replaceChildren(...plantilla.map(filaDeBatallero));
  el.btnAnadir.disabled = plantilla.length >= scoring.MAX_BATALLEROS;

  // Por debajo del mínimo no se puede bajar: siempre hacen falta dos.
  const sePuedeQuitar = plantilla.length > scoring.MIN_BATALLEROS;
  for (const boton of el.lista.querySelectorAll('.signo--quitar')) {
    boton.disabled = !sePuedeQuitar;
  }
}

function filaDeBatallero(batallero, i) {
  const fila = el.tplBatallero.content.firstElementChild.cloneNode(true);
  fila.dataset.id = batallero.id;

  const campo = fila.querySelector('.batallero__nombre');
  campo.value = batallero.nombre;
  campo.placeholder = `Batallero ${i + 1}`;
  // Sólo se apunta el nombre: repintar aquí costaría el foco a media palabra.
  campo.addEventListener('input', () => {
    batallero.nombre = campo.value;
  });

  fila
    .querySelector('.signo--quitar')
    .addEventListener('click', () => quitarBatallero(batallero.id));
  fila
    .querySelector('.agarre')
    .addEventListener('pointerdown', (evento) => empezarArrastre(evento, fila));

  return fila;
}

function anadirBatallero() {
  if (plantilla.length >= scoring.MAX_BATALLEROS) return;
  plantilla.push(nuevoBatallero());
  pintarPlantilla();
  el.lista.lastElementChild?.querySelector('.batallero__nombre')?.focus();
}

function quitarBatallero(id) {
  if (plantilla.length <= scoring.MIN_BATALLEROS) return;
  plantilla = plantilla.filter((batallero) => batallero.id !== id);
  pintarPlantilla();
}

// ── Reordenar arrastrando ──────────────────────────────────────────────────

/**
 * Arrastre a mano, sin librerías. Como todas las filas miden lo mismo, basta
 * con dividir el desplazamiento vertical entre el alto de una fila para saber
 * a qué posición va; las de en medio se apartan con un transform.
 */
let arrastre = null;

function empezarArrastre(evento, fila) {
  if (arrastre || plantilla.length < 2) return;
  evento.preventDefault();

  const filas = [...el.lista.children];
  const desde = filas.indexOf(fila);
  if (desde < 0) return;

  const agarre = evento.currentTarget;
  arrastre = {
    fila,
    filas,
    desde,
    hasta: desde,
    alto: fila.getBoundingClientRect().height,
    y0: evento.clientY,
    agarre,
    puntero: evento.pointerId,
  };

  fila.classList.add('batallero--arrastrando');
  for (const otra of filas) {
    if (otra !== fila) otra.classList.add('batallero--apartada');
  }

  agarre.setPointerCapture(evento.pointerId);
  agarre.addEventListener('pointermove', moverArrastre);
  agarre.addEventListener('pointerup', soltarArrastre);
  agarre.addEventListener('pointercancel', soltarArrastre);
}

function moverArrastre(evento) {
  if (!arrastre) return;

  const { fila, filas, desde, alto } = arrastre;
  const recorrido = evento.clientY - arrastre.y0;
  const tope = filas.length - 1;
  const hasta = Math.min(tope, Math.max(0, desde + Math.round(recorrido / alto)));

  arrastre.hasta = hasta;
  fila.style.transform = `translateY(${recorrido}px)`;

  filas.forEach((otra, i) => {
    if (otra === fila) return;
    let aparta = 0;
    if (desde < hasta && i > desde && i <= hasta) aparta = -alto;
    else if (desde > hasta && i >= hasta && i < desde) aparta = alto;
    otra.style.transform = aparta ? `translateY(${aparta}px)` : '';
  });
}

function soltarArrastre() {
  if (!arrastre) return;

  const { desde, hasta, agarre, puntero } = arrastre;
  agarre.releasePointerCapture?.(puntero);
  agarre.removeEventListener('pointermove', moverArrastre);
  agarre.removeEventListener('pointerup', soltarArrastre);
  agarre.removeEventListener('pointercancel', soltarArrastre);
  arrastre = null;

  if (desde !== hasta) {
    const [movido] = plantilla.splice(desde, 1);
    plantilla.splice(hasta, 0, movido);
  }

  // Repintar deja las filas limpias de clases y transforms.
  pintarPlantilla();
}

// ── Pintado de la puntuación ───────────────────────────────────────────────

/**
 * Todo el pintado de la puntuación reaprovecha los nodos que ya están puestos
 * en vez de rehacerlos. Con diez batalleros y una pista larga son cientos de
 * cuadritos, y esto se ejecuta en cada tecla: crearlos de nuevo cada vez se
 * notaría justo donde no puede notarse.
 */
const clonar = (plantillaHTML) =>
  plantillaHTML.content.firstElementChild.cloneNode(true);

function ajustarHijos(contenedor, cuantos, crear) {
  while (contenedor.children.length > cuantos) {
    contenedor.lastElementChild.remove();
  }
  while (contenedor.children.length < cuantos) {
    contenedor.append(crear());
  }
}

function poner(nodo, texto) {
  const valor = String(texto);
  if (nodo.textContent !== valor) nodo.textContent = valor;
}

function pintarMarcadores() {
  const cuantos = batalla.batalleros.length;
  const reparto = REPARTO.find((r) => cuantos <= r.hasta) ?? REPARTO.at(-1);

  el.marcadores.style.setProperty('--columnas', reparto.columnas);
  el.marcadores.style.setProperty('--texto-marcador', reparto.cifra);
  ajustarHijos(el.marcadores, cuantos, () => clonar(el.tplMarcador));

  batalla.batalleros.forEach((batallero, i) => {
    const caja = el.marcadores.children[i];
    const activo = batalla.cursor === batallero.id;

    caja.dataset.id = batallero.id;
    caja.classList.toggle('marcador--activo', activo);
    caja.setAttribute('aria-pressed', String(activo));
    poner(
      caja.querySelector('.marcador__nombre'),
      comoSeLlama(batalla.batalleros, batallero.id)
    );
    poner(
      caja.querySelector('.marcador__total'),
      scoring.total(batalla, batallero.id)
    );
  });
}

/**
 * La pista de intervenciones. Todas las filas se pintan del mismo ancho, con
 * huecos donde alguien todavía no ha intervenido, para que las columnas
 * queden a la vista unas debajo de otras.
 */
function pintarPista() {
  const ancho = scoring.intervenciones(batalla);
  const cuantos = batalla.batalleros.length;

  ajustarHijos(el.pistaEtiquetas, cuantos, () => clonar(el.tplEtiqueta));
  ajustarHijos(el.pistaFilas, cuantos, () => clonar(el.tplFilaVotos));

  batalla.batalleros.forEach((batallero, f) => {
    const nombre = comoSeLlama(batalla.batalleros, batallero.id);

    const etiqueta = el.pistaEtiquetas.children[f];
    poner(etiqueta, nombre);
    etiqueta.classList.toggle(
      'pista__etiqueta--activo',
      batalla.cursor === batallero.id
    );

    const fila = el.pistaFilas.children[f];
    ajustarHijos(fila, ancho, () => clonar(el.tplVoto));

    const votos = scoring.votosDe(batalla, batallero.id);

    for (let i = 0; i < ancho; i += 1) {
      const cuadro = fila.children[i];
      const voto = votos[i];

      if (voto) {
        poner(cuadro, voto.valor);
        cuadro.dataset.indice = String(voto.indice);
        cuadro.disabled = false;
        cuadro.classList.remove('voto--vacio');
        cuadro.classList.toggle('voto--marcado', batalla.marcada === voto.indice);
        cuadro.setAttribute(
          'aria-label',
          `Intervención ${i + 1} de ${nombre}: ${voto.valor}`
        );
      } else {
        poner(cuadro, '');
        delete cuadro.dataset.indice;
        cuadro.disabled = true;
        cuadro.classList.add('voto--vacio');
        cuadro.classList.remove('voto--marcado');
        cuadro.removeAttribute('aria-label');
      }
    }
  });
}

function pintarPuntuacion() {
  pintarMarcadores();
  pintarPista();

  el.btnBorrar.disabled = scoring.estaVacia(batalla);
  el.btnTerminar.disabled = scoring.estaVacia(batalla);

  const quien = comoSeLlama(batalla.batalleros, batalla.cursor);
  el.turno.textContent =
    batalla.marcada === null
      ? `Puntuando a ${quien}`
      : 'Corrigiendo: pulsa un número para sustituirlo';
}

/** Tras anotar, la pista se va al final para que se vea el último cuadrito. */
function asomarElUltimoVoto() {
  el.pistaCarril.scrollLeft = el.pistaCarril.scrollWidth;
}

function pintarFinal() {
  el.finalBatalleros.replaceChildren(
    ...batalla.batalleros.map((batallero) => {
      const bloque = clonar(el.tplFinal);
      const notas = scoring
        .votosDe(batalla, batallero.id)
        .map((voto) => voto.valor);

      bloque.querySelector('.resultado__nombre').textContent = comoSeLlama(
        batalla.batalleros,
        batallero.id
      );
      bloque.querySelector('.resultado__total').textContent = scoring.total(
        batalla,
        batallero.id
      );
      bloque.querySelector('.fila__valor').textContent = notas.length
        ? notas.join(' · ')
        : 'Ninguna';

      return bloque;
    })
  );

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
    `Dejaste a medias ${todosLosNombres(restaurada.batalleros)}, con ${cuantas === 1 ? '1 nota' : `${cuantas} notas`}.`;
  el.avisoBorrador.hidden = false;
}

function retomar() {
  if (!aMedias) return;

  batalla = aMedias;
  olvidarLoQueQuedoAMedias();
  pintarPuntuacion();
  empujar(PUNTUACION);
  asomarElUltimoVoto();
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
      texto: `Se perderá ${todosLosNombres(aMedias.batalleros)}, que dejaste a medias.`,
      aceptar: 'Empezar otra',
      cancelar: 'Retomar la de antes',
    });
    if (!otra) {
      retomar();
      return;
    }
    olvidarLoQueQuedoAMedias();
  }

  batalla = scoring.crearBatalla(plantilla);
  pintarPuntuacion();
  empujar(PUNTUACION);
  apuntarBorrador();
}

function anotar(valor) {
  const corregia = batalla.marcada !== null;
  batalla = scoring.anotar(batalla, valor, Date.now());
  pintarPuntuacion();
  if (!corregia) asomarElUltimoVoto();
  apuntarBorrador();
}

function borrar() {
  if (scoring.estaVacia(batalla)) return;
  batalla = scoring.deshacer(batalla);
  pintarPuntuacion();
  apuntarBorrador();
}

function apuntarA(id) {
  batalla = scoring.moverCursor(batalla, id);
  pintarPuntuacion();
  apuntarBorrador();
}

function marcarVoto(indice) {
  batalla = scoring.marcarVoto(batalla, indice);
  pintarPuntuacion();
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
      batalleros: batalla.batalleros.map((batallero) => ({
        id: batallero.id,
        nombre: comoSeLlama(batalla.batalleros, batallero.id),
        total: scoring.total(batalla, batallero.id),
      })),
      puntuaciones: batalla.puntuaciones,
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
  reiniciarPlantilla();
  volverAlaRaiz();
}

// ── Enlaces ────────────────────────────────────────────────────────────────

el.formNueva.addEventListener('submit', empezarBatalla);
el.btnAnadir.addEventListener('click', anadirBatallero);
el.btnHistorial.addEventListener('click', () => historial.abrir());
el.btnCopia.addEventListener('click', () => copia.abrir());
el.btnAvisoCopia.addEventListener('click', () => copia.abrir());
el.btnRetomar.addEventListener('click', retomar);

el.teclado.addEventListener('click', (evento) => {
  const tecla = evento.target.closest('[data-nota]');
  if (tecla) anotar(Number(tecla.dataset.nota));
});

el.marcadores.addEventListener('click', (evento) => {
  const caja = evento.target.closest('[data-id]');
  if (caja) apuntarA(caja.dataset.id);
});

el.pistaFilas.addEventListener('click', (evento) => {
  const cuadro = evento.target.closest('[data-indice]');
  if (cuadro) marcarVoto(Number(cuadro.dataset.indice));
});

el.btnBorrar.addEventListener('click', borrar);
el.btnCancelar.addEventListener('click', cancelar);
el.btnTerminar.addEventListener('click', terminar);
el.btnVolver.addEventListener('click', sacar);
el.btnGuardar.addEventListener('click', guardar);

el.btnCerrarHistorial.addEventListener('click', sacar);
el.btnCerrarDetalle.addEventListener('click', sacar);
el.btnCerrarCopia.addEventListener('click', sacar);

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

reiniciarPlantilla();
pintarPila({ bloquear: false });
pedirPersistencia();
buscarLoQueQuedoAMedias();
vigilarVersiones();
