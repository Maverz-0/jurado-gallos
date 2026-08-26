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
import { compartirImagen, compartirTexto } from './share.js';
import { crearVistaFiltros } from './filters-view.js';

const { comoSeEscribe } = scoring;

/** Preferencia suelta: no son datos de batallas, así que va en localStorage. */
const CLAVE_PANTALLA = 'jurado-gallos:pantalla-encendida';

const RAIZ = 'vista-inicio';
const PUNTUACION = 'vista-puntuacion';

/** Las vistas que salen de la pila se deslizan por encima de las que revelan. */
const Z_FUERA_DE_PILA = 99;

/** Los gallos sin nombre se llaman por su letra. */
const LETRAS = 'ABCDEFGHIJ';

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

/** Lo que hace cada modalidad, dicho para quien la elige. */
const EXPLICACIONES = {
  dinamica:
    'Las intervenciones van saliendo según metes votos, sin número fijo.',
  nxn: 'Número fijo de intervenciones, alternando entre los gallos.',
  minuto:
    'Número fijo de intervenciones. Se puntúa a un gallo entero antes de pasar al siguiente.',
};

const $ = (id) => document.getElementById(id);

const el = {
  modo: $('modo'),
  formNueva: $('form-nueva'),
  formFiltros: $('form-filtros'),
  lista: $('lista-batalleros'),
  btnAnadir: $('btn-anadir'),
  listaTramos: $('lista-tramos'),
  btnAnadirTramo: $('btn-anadir-tramo'),
  notaMaxima: $('nota-maxima'),
  notaMenos: $('nota-menos'),
  notaMas: $('nota-mas'),
  opDecimales: $('op-decimales'),
  opPantalla: $('op-pantalla'),
  filaPantalla: $('fila-pantalla'),
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
  btnMedio: $('btn-medio'),
  teclado: $('teclado'),
  tecladoRejilla: $('teclado-rejilla'),
  turno: $('turno'),
  marcadores: $('marcadores'),
  desplazable: $('desplazable'),
  bloques: $('bloques'),
  btnTramoEnCurso: $('btn-tramo-en-curso'),
  btnReplica: $('btn-replica'),

  btnVolver: $('btn-volver'),
  btnGuardar: $('btn-guardar'),
  btnCompartir: $('btn-compartir'),
  btnCompartirDetalle: $('btn-compartir-detalle'),
  avisoGuardar: $('aviso-guardar'),
  finalBatalleros: $('final-batalleros'),

  veloCompartir: $('velo-compartir'),
  compartirImagen: $('compartir-imagen'),
  compartirTexto: $('compartir-texto'),
  compartirCancelar: $('compartir-cancelar'),
  compartirAviso: $('compartir-aviso'),

  btnCerrarHistorial: $('btn-cerrar-historial'),
  btnCerrarDetalle: $('btn-cerrar-detalle'),
  btnCerrarCopia: $('btn-cerrar-copia'),

  pila: $('pila'),
  velo: $('velo'),
  alertaTitulo: $('alerta-titulo'),
  alertaTexto: $('alerta-texto'),
  alertaSi: $('alerta-si'),
  alertaNo: $('alerta-no'),

  veloModalidad: $('velo-modalidad'),
  hojaTitulo: $('hoja-titulo'),
  hojaModalidad: $('hoja-modalidad'),
  hojaNota: $('hoja-nota'),
  hojaCuantas: $('hoja-cuantas'),
  hojaNumero: $('hoja-numero'),
  hojaMenos: $('hoja-menos'),
  hojaMas: $('hoja-mas'),
  hojaAceptar: $('hoja-aceptar'),
  hojaCancelar: $('hoja-cancelar'),

  tplBatallero: $('tpl-batallero'),
  tplTramo: $('tpl-tramo'),
  tplMarcador: $('tpl-marcador'),
  tplBloque: $('tpl-bloque'),
  tplEtiqueta: $('tpl-etiqueta'),
  tplOrdinal: $('tpl-ordinal'),
  tplFilaVotos: $('tpl-fila-votos'),
  tplVoto: $('tpl-voto'),
  tplTecla: $('tpl-tecla'),
  tplFinal: $('tpl-final'),
};

/** Batalla en curso, o null si no hay ninguna. */
let batalla = null;

/** Batalla que quedó a medias de una sesión anterior, aún sin retomar. */
let aMedias = null;

/** Lo que se está preparando en la pantalla de inicio. */
let plantilla = [];
let plantillaTramos = [];
let opciones = {
  notaMaxima: scoring.NOTA_MAXIMA_POR_DEFECTO,
  decimales: false,
};
let contadorIds = 0;

/** El tramo que se estaba mirando la última vez que se pintó. */
let ultimoTramoVisto = null;

// ── Nombres ────────────────────────────────────────────────────────────────

function porDefecto(i) {
  return `Gallo ${LETRAS[i] ?? i + 1}`;
}

function comoSeLlama(batalleros, id) {
  const i = batalleros.findIndex((batallero) => batallero.id === id);
  return i < 0 ? '' : batalleros[i].nombre || porDefecto(i);
}

function todosLosNombres(batalleros) {
  return batalleros
    .map((batallero) => comoSeLlama(batalleros, batallero.id))
    .join(' · ');
}

/** «4×4» para un N×N, y el nombre de la modalidad para el resto. */
function comoSeLlamaElTramo(tramo) {
  const base =
    tramo.modalidad === 'nxn'
      ? `${tramo.intervenciones}×${tramo.intervenciones}`
      : scoring.MODALIDADES[tramo.modalidad].etiqueta +
        (tramo.intervenciones ? ` · ${tramo.intervenciones}` : '');

  return tramo.replica ? `Réplica · ${base}` : base;
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

// ── Utilidades de pintado ──────────────────────────────────────────────────

/**
 * Todo el pintado de la puntuación reaprovecha los nodos que ya están puestos
 * en vez de rehacerlos. Con diez batalleros y varios tramos son cientos de
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

// ── Preparar los batalleros ────────────────────────────────────────────────

function nuevoId(prefijo) {
  contadorIds += 1;
  return `${prefijo}${contadorIds}`;
}

function reiniciarPlantilla() {
  contadorIds = 0;
  plantilla = [
    { id: nuevoId('b'), nombre: '' },
    { id: nuevoId('b'), nombre: '' },
  ];
  plantillaTramos = [
    scoring.crearTramo({ id: nuevoId('t'), modalidad: scoring.MODALIDAD_POR_DEFECTO }),
  ];
  pintarPlantilla();
  pintarPlantillaTramos();
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
  const fila = clonar(el.tplBatallero);
  fila.dataset.id = batallero.id;

  const campo = fila.querySelector('.batallero__nombre');
  campo.value = batallero.nombre;
  campo.placeholder = porDefecto(i);
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
  plantilla.push({ id: nuevoId('b'), nombre: '' });
  pintarPlantilla();
  el.lista.lastElementChild?.querySelector('.batallero__nombre')?.focus();
}

function quitarBatallero(id) {
  if (plantilla.length <= scoring.MIN_BATALLEROS) return;
  plantilla = plantilla.filter((batallero) => batallero.id !== id);
  pintarPlantilla();
}

// ── Preparar las modalidades ───────────────────────────────────────────────

function pintarPlantillaTramos() {
  el.listaTramos.replaceChildren(...plantillaTramos.map(filaDeTramo));
}

function filaDeTramo(tramo, i) {
  const caja = clonar(el.tplTramo);

  poner(caja.querySelector('.tramo__titulo'), `Tramo ${i + 1}`);

  const quitar = caja.querySelector('.tramo__quitar');
  quitar.disabled = plantillaTramos.length <= 1;
  quitar.addEventListener('click', () => {
    plantillaTramos = plantillaTramos.filter((otro) => otro.id !== tramo.id);
    pintarPlantillaTramos();
  });

  for (const opcion of caja.querySelectorAll('.segmentado__opcion')) {
    const cual = opcion.dataset.modalidad;
    opcion.setAttribute('aria-pressed', String(cual === tramo.modalidad));
    opcion.addEventListener('click', () => {
      Object.assign(
        tramo,
        scoring.crearTramo({
          id: tramo.id,
          modalidad: cual,
          intervenciones: tramo.intervenciones ?? scoring.INTERVENCIONES_POR_DEFECTO,
        })
      );
      pintarPlantillaTramos();
    });
  }

  const cuantas = caja.querySelector('.tramo__cuantas');
  cuantas.hidden = tramo.intervenciones == null;

  if (tramo.intervenciones != null) {
    const cifra = caja.querySelector('.tramo__numero');
    poner(cifra, tramo.intervenciones);

    const mover = (paso) => {
      tramo.intervenciones = scoring.acotar(tramo.intervenciones + paso);
      pintarPlantillaTramos();
    };
    caja.querySelector('.tramo__menos').addEventListener('click', () => mover(-1));
    caja.querySelector('.tramo__mas').addEventListener('click', () => mover(1));
    caja.querySelector('.tramo__menos').disabled =
      tramo.intervenciones <= scoring.MIN_INTERVENCIONES;
    caja.querySelector('.tramo__mas').disabled =
      tramo.intervenciones >= scoring.MAX_INTERVENCIONES;
  }

  return caja;
}

// ── Escala de puntuación ───────────────────────────────────────────────────

function pintarOpciones() {
  poner(el.notaMaxima, opciones.notaMaxima);
  el.notaMenos.disabled = opciones.notaMaxima <= scoring.MIN_NOTA_MAXIMA;
  el.notaMas.disabled = opciones.notaMaxima >= scoring.MAX_NOTA_MAXIMA;
  el.opDecimales.checked = opciones.decimales;
}

function moverNotaMaxima(paso) {
  opciones.notaMaxima = scoring.acotarNotaMaxima(opciones.notaMaxima + paso);
  pintarOpciones();
}

// ── Pantalla siempre encendida ─────────────────────────────────────────────

/**
 * El sistema suelta el bloqueo solo en cuanto la app deja de verse, así que
 * hay que volver a pedirlo al regresar. La preferencia se recuerda aparte.
 */
let centinelaPantalla = null;

const sePuedeMantenerEncendida = () => 'wakeLock' in navigator;

function quierePantallaEncendida() {
  try {
    return localStorage.getItem(CLAVE_PANTALLA) === 'si';
  } catch {
    return false;
  }
}

function apuntarPreferenciaDePantalla(quiere) {
  try {
    localStorage.setItem(CLAVE_PANTALLA, quiere ? 'si' : 'no');
  } catch {
    // Sin almacenamiento la preferencia dura lo que dure la sesión. No pasa nada.
  }
}

async function mantenerPantallaEncendida() {
  if (!sePuedeMantenerEncendida() || centinelaPantalla) return;

  try {
    centinelaPantalla = await navigator.wakeLock.request('screen');
    centinelaPantalla.addEventListener('release', () => {
      centinelaPantalla = null;
    });
  } catch (error) {
    console.error('No se ha podido mantener la pantalla encendida:', error);
  }
}

async function dejarQueSeApague() {
  const centinela = centinelaPantalla;
  centinelaPantalla = null;
  try {
    await centinela?.release();
  } catch {
    // Si ya estaba suelto, no hay nada que hacer.
  }
}

function prepararPantalla() {
  if (!sePuedeMantenerEncendida()) return;

  el.filaPantalla.hidden = false;
  el.opPantalla.checked = quierePantallaEncendida();
  if (el.opPantalla.checked) mantenerPantallaEncendida();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && el.opPantalla.checked) {
      mantenerPantallaEncendida();
    }
  });
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

function pintarMarcadores() {
  const cuantos = batalla.batalleros.length;
  const reparto = REPARTO.find((r) => cuantos <= r.hasta) ?? REPARTO.at(-1);
  const conReplica = scoring.hayReplica(batalla);

  el.marcadores.style.setProperty('--columnas', reparto.columnas);
  el.marcadores.style.setProperty('--texto-marcador', reparto.cifra);
  ajustarHijos(el.marcadores, cuantos, () => clonar(el.tplMarcador));

  batalla.batalleros.forEach((batallero, i) => {
    const caja = el.marcadores.children[i];
    const activo = batalla.cursor.batallero === batallero.id;

    caja.dataset.id = batallero.id;
    caja.classList.toggle('marcador--activo', activo);
    caja.setAttribute('aria-pressed', String(activo));
    poner(
      caja.querySelector('.marcador__nombre'),
      comoSeLlama(batalla.batalleros, batallero.id)
    );
    poner(
      caja.querySelector('.marcador__total'),
      comoSeEscribe(scoring.total(batalla, batallero.id))
    );
    poner(
      caja.querySelector('.marcador__replica'),
      conReplica
        ? `réplica ${comoSeEscribe(scoring.totalDeReplica(batalla, batallero.id))}`
        : ''
    );
  });
}

/**
 * Un bloque por tramo, uno debajo de otro. Dentro de cada uno, la fila de
 * ordinales arriba y una fila por gallo, con huecos donde todavía no ha
 * intervenido para que las columnas queden unas debajo de otras.
 */
function pintarBloques() {
  const cuantos = batalla.batalleros.length;
  ajustarHijos(el.bloques, batalla.tramos.length, () => clonar(el.tplBloque));

  batalla.tramos.forEach((tramo, t) => {
    const bloque = el.bloques.children[t];
    const ancho = scoring.anchoDeTramo(batalla, tramo);

    bloque.classList.toggle('bloque--replica', tramo.replica);
    poner(bloque.querySelector('.bloque__titulo'), comoSeLlamaElTramo(tramo));

    const ordinales = bloque.querySelector('.pista__ordinales');
    ajustarHijos(ordinales, ancho, () => clonar(el.tplOrdinal));
    for (let i = 0; i < ancho; i += 1) poner(ordinales.children[i], `${i + 1}ª`);

    // El primer hijo de cada columna es el hueco y la fila de ordinales.
    const etiquetas = bloque.querySelector('.pista__etiquetas');
    const filas = bloque.querySelector('.pista__filas');
    ajustarHijos(etiquetas, cuantos + 1, () => clonar(el.tplEtiqueta));
    ajustarHijos(filas, cuantos + 1, () => clonar(el.tplFilaVotos));

    batalla.batalleros.forEach((batallero, b) => {
      const nombre = comoSeLlama(batalla.batalleros, batallero.id);
      const activa =
        batalla.cursor.tramo === tramo.id &&
        batalla.cursor.batallero === batallero.id;

      const etiqueta = etiquetas.children[b + 1];
      poner(etiqueta, nombre);
      etiqueta.classList.toggle('pista__etiqueta--activo', activa);

      const fila = filas.children[b + 1];
      fila.classList.toggle('pista__fila--activa', activa);
      ajustarHijos(fila, ancho, () => clonar(el.tplVoto));

      const votos = scoring.votosDe(batalla, tramo.id, batallero.id);

      for (let i = 0; i < ancho; i += 1) {
        const cuadro = fila.children[i];
        const voto = votos[i];

        const entero = cuadro.querySelector('.voto__entero');
        const medio = cuadro.querySelector('.voto__medio');

        if (voto) {
          poner(entero, Math.trunc(voto.valor));
          poner(medio, Number.isInteger(voto.valor) ? '' : ',5');
          cuadro.dataset.indice = String(voto.indice);
          delete cuadro.dataset.tramo;
          delete cuadro.dataset.batallero;
          cuadro.classList.remove('voto--vacio');
          cuadro.classList.toggle('voto--marcado', batalla.marcada === voto.indice);
          cuadro.setAttribute(
            'aria-label',
            `${comoSeLlamaElTramo(tramo)}, intervención ${i + 1} de ${nombre}: ${comoSeEscribe(voto.valor)}`
          );
        } else {
          poner(entero, '');
          poner(medio, '');
          delete cuadro.dataset.indice;
          // Un hueco sirve para llevar el cursor a ese gallo y ese tramo.
          cuadro.dataset.tramo = tramo.id;
          cuadro.dataset.batallero = batallero.id;
          cuadro.classList.add('voto--vacio');
          cuadro.classList.remove('voto--marcado');
          cuadro.setAttribute(
            'aria-label',
            `${comoSeLlamaElTramo(tramo)}, intervención ${i + 1} de ${nombre}: sin puntuar`
          );
        }
      }
    });
  });
}

/**
 * Monta las teclas numéricas. Sólo hace falta al empezar o al retomar, porque
 * la escala se decide antes de la batalla y ya no cambia.
 */
function montarTeclado() {
  const notas = scoring.notasDelTeclado(batalla);
  const teclas = notas.map((nota) => {
    const tecla = clonar(el.tplTecla);
    tecla.dataset.nota = String(nota);
    tecla.textContent = nota;
    return tecla;
  });

  // El botón de borrar cierra la rejilla, detrás del último número.
  el.tecladoRejilla.replaceChildren(...teclas, el.btnBorrar);

  const cuantas = teclas.length + 1;
  const porFila = cuantas <= 6 ? 3 : 4;
  const filas = Math.ceil(cuantas / porFila);
  const alto = filas <= 2 ? 68 : filas === 3 ? 58 : 50;

  // Si la última fila queda a medias, el botón de borrar se estira y la llena.
  const sobra = cuantas % porFila;
  el.btnBorrar.style.gridColumn = sobra === 0 ? '' : `span ${porFila - sobra + 1}`;

  el.teclado.style.setProperty('--teclas-por-fila', porFila);
  el.teclado.style.setProperty('--alto-tecla', `${alto}px`);

  el.btnMedio.hidden = !batalla.decimales;
}

function pintarPuntuacion({ seguirElTramo = true } = {}) {
  pintarMarcadores();
  pintarBloques();

  const sePuedeAnotar = scoring.puedeAnotar(batalla);
  for (const tecla of el.tecladoRejilla.querySelectorAll('[data-nota]')) {
    tecla.disabled = !sePuedeAnotar;
  }

  el.btnMedio.disabled = !scoring.puedeMediarPunto(batalla);
  el.btnBorrar.disabled = scoring.estaVacia(batalla);
  el.btnTerminar.disabled = scoring.estaVacia(batalla);
  el.turno.textContent = queTocaAhora(sePuedeAnotar);

  // Al cambiar de tramo, el nuevo se trae a la vista solo.
  if (seguirElTramo && batalla.cursor.tramo !== ultimoTramoVisto) {
    ultimoTramoVisto = batalla.cursor.tramo;
    asomarElTramo();
  }
}

/** Trae a la vista el bloque del tramo en curso. */
function asomarElTramo(idTramo = batalla.cursor.tramo) {
  const t = batalla.tramos.findIndex((tramo) => tramo.id === idTramo);
  const bloque = el.bloques.children[t];
  if (!bloque) return;

  // Se mueve sólo el contenedor de tramos, a mano. `scrollIntoView` arrastra
  // también a los ancestros y llega a descolocar la pila de vistas entera.
  el.desplazable.scrollTop +=
    bloque.getBoundingClientRect().top -
    el.desplazable.getBoundingClientRect().top;
}

function queTocaAhora(sePuedeAnotar) {
  if (batalla.marcada !== null) {
    return 'Corrigiendo: pulsa un número para sustituirlo';
  }
  if (!sePuedeAnotar) {
    return 'Todas las intervenciones puestas. Añade una modalidad o termina.';
  }

  const quien = comoSeLlama(batalla.batalleros, batalla.cursor.batallero);
  const tramo = scoring.tramoDe(batalla, batalla.cursor.tramo);
  const cual = tramo && batalla.tramos.length > 1 ? ` · ${comoSeLlamaElTramo(tramo)}` : '';

  return `Puntuando a ${quien}${cual}`;
}

/** Tras anotar, la pista del tramo activo se va al final del todo. */
function asomarElUltimoVoto() {
  const t = batalla.tramos.findIndex((tramo) => tramo.id === batalla.cursor.tramo);
  const carril = el.bloques.children[t]?.querySelector('.pista__carril');
  if (carril) carril.scrollLeft = carril.scrollWidth;
}

function pintarFinal() {
  const conReplica = scoring.hayReplica(batalla);

  el.finalBatalleros.replaceChildren(
    ...batalla.batalleros.map((batallero) => {
      const bloque = clonar(el.tplFinal);
      const porTramo = batalla.tramos.map(
        (tramo) =>
          `${comoSeLlamaElTramo(tramo)}: ${comoSeEscribe(scoring.totalDeTramo(batalla, tramo.id, batallero.id))}`
      );

      bloque.querySelector('.resultado__nombre').textContent = comoSeLlama(
        batalla.batalleros,
        batallero.id
      );
      bloque.querySelector('.resultado__total').textContent = comoSeEscribe(
        scoring.total(batalla, batallero.id)
      );
      bloque.querySelector('.fila__valor').textContent = porTramo.join('  ·  ');
      bloque.querySelector('.fila__etiqueta').textContent = conReplica
        ? 'Tramos (la réplica no suma)'
        : 'Tramos';

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

// ── Hoja para elegir modalidad ─────────────────────────────────────────────

/** Devuelve { modalidad, intervenciones } o null si se cancela. */
function pedirModalidad({ titulo, aceptar }) {
  return new Promise((resolver) => {
    const focoPrevio = document.activeElement;
    let modalidad = scoring.MODALIDAD_POR_DEFECTO;
    let cuantas = scoring.INTERVENCIONES_POR_DEFECTO;

    el.hojaTitulo.textContent = titulo;
    el.hojaAceptar.textContent = aceptar;

    const pintar = () => {
      for (const opcion of el.hojaModalidad.children) {
        opcion.setAttribute(
          'aria-pressed',
          String(opcion.dataset.modalidad === modalidad)
        );
      }
      el.hojaNota.textContent = EXPLICACIONES[modalidad];
      el.hojaCuantas.hidden = !scoring.MODALIDADES[modalidad].fija;
      el.hojaNumero.textContent = cuantas;
      el.hojaMenos.disabled = cuantas <= scoring.MIN_INTERVENCIONES;
      el.hojaMas.disabled = cuantas >= scoring.MAX_INTERVENCIONES;
    };

    const alElegir = (evento) => {
      const opcion = evento.target.closest('[data-modalidad]');
      if (!opcion) return;
      modalidad = opcion.dataset.modalidad;
      pintar();
    };
    const alMenos = () => {
      cuantas = scoring.acotar(cuantas - 1);
      pintar();
    };
    const alMas = () => {
      cuantas = scoring.acotar(cuantas + 1);
      pintar();
    };
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') cerrar(null);
    };

    const cerrar = (respuesta) => {
      el.veloModalidad.hidden = true;
      el.pila.inert = false;
      el.hojaModalidad.removeEventListener('click', alElegir);
      el.hojaMenos.removeEventListener('click', alMenos);
      el.hojaMas.removeEventListener('click', alMas);
      el.hojaAceptar.removeEventListener('click', alAceptar);
      el.hojaCancelar.removeEventListener('click', alCancelar);
      document.removeEventListener('keydown', alTeclear);
      focoPrevio?.focus?.();
      resolver(respuesta);
    };

    const alAceptar = () => cerrar({ modalidad, intervenciones: cuantas });
    const alCancelar = () => cerrar(null);

    el.hojaModalidad.addEventListener('click', alElegir);
    el.hojaMenos.addEventListener('click', alMenos);
    el.hojaMas.addEventListener('click', alMas);
    el.hojaAceptar.addEventListener('click', alAceptar);
    el.hojaCancelar.addEventListener('click', alCancelar);
    document.addEventListener('keydown', alTeclear);

    pintar();
    el.pila.inert = true;
    el.veloModalidad.hidden = false;
    el.hojaAceptar.focus();
  });
}

const historial = crearHistorial({ empujar, sacar, confirmar });
const copia = crearCopia({ empujar });
const vistaFiltros = crearVistaFiltros({
  empujar,
  sacar,
  volverAlaRaiz,
  confirmar,
  compartir,
});

// ── Batalla o filtros ──────────────────────────────────────────────────────

function elegirModo(cual) {
  const filtros = cual === 'filtros';
  el.formNueva.hidden = filtros;
  el.formFiltros.hidden = !filtros;

  for (const opcion of el.modo.children) {
    opcion.setAttribute('aria-pressed', String(opcion.dataset.modo === cual));
  }
}

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
  ultimoTramoVisto = batalla.cursor.tramo;
  montarTeclado();
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

  batalla = scoring.crearBatalla(plantilla, plantillaTramos, opciones);
  ultimoTramoVisto = batalla.cursor.tramo;
  montarTeclado();
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

function medioPunto() {
  batalla = scoring.medioPunto(batalla);
  pintarPuntuacion({ seguirElTramo: false });
  apuntarBorrador();
}

function borrar() {
  if (scoring.estaVacia(batalla)) return;
  batalla = scoring.deshacer(batalla);
  pintarPuntuacion();
  apuntarBorrador();
}

function apuntarA(idTramo, idBatallero) {
  batalla = scoring.moverCursor(batalla, idTramo, idBatallero);
  pintarPuntuacion();
  apuntarBorrador();
}

function marcarVoto(indice) {
  batalla = scoring.marcarVoto(batalla, indice);
  pintarPuntuacion();
}

async function anadirTramoEnCurso({ replica }) {
  const elegido = await pedirModalidad({
    titulo: replica ? 'Añadir réplica' : 'Añadir modalidad',
    aceptar: replica ? 'Añadir réplica' : 'Añadir',
  });
  if (!elegido) return;

  const nuevo = nuevoId('t');
  batalla = scoring.anadirTramo(batalla, {
    id: nuevo,
    modalidad: elegido.modalidad,
    intervenciones: elegido.intervenciones,
    replica,
  });
  pintarPuntuacion({ seguirElTramo: false });
  // Recién añadido, lo que se quiere ver es el tramo nuevo.
  ultimoTramoVisto = batalla.cursor.tramo;
  asomarElTramo(nuevo);
  apuntarBorrador();
}

async function anadirTramoAlaPlantilla() {
  const elegido = await pedirModalidad({
    titulo: 'Añadir modalidad',
    aceptar: 'Añadir',
  });
  if (!elegido) return;

  plantillaTramos.push(
    scoring.crearTramo({
      id: nuevoId('t'),
      modalidad: elegido.modalidad,
      intervenciones: elegido.intervenciones,
    })
  );
  pintarPlantillaTramos();
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
        replica: scoring.totalDeReplica(batalla, batallero.id),
      })),
      tramos: batalla.tramos,
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
  ultimoTramoVisto = null;
  soltarBorrador();
  reiniciarPlantilla();
  volverAlaRaiz();
}

// ── Compartir el acta ──────────────────────────────────────────────────────

/** La batalla en curso, con la misma forma que tiene una ya guardada. */
function actaDeLaBatalla() {
  return {
    fecha: new Date().toISOString(),
    batalleros: batalla.batalleros.map((batallero) => ({
      id: batallero.id,
      nombre: comoSeLlama(batalla.batalleros, batallero.id),
      total: scoring.total(batalla, batallero.id),
      replica: scoring.totalDeReplica(batalla, batallero.id),
    })),
    tramos: batalla.tramos,
    puntuaciones: batalla.puntuaciones,
  };
}

async function compartir(
  acta,
  como = { imagen: compartirImagen, texto: compartirTexto }
) {
  const focoPrevio = document.activeElement;
  el.compartirAviso.textContent = '';
  el.pila.inert = true;
  el.veloCompartir.hidden = false;
  el.compartirImagen.focus();

  const cerrar = () => {
    el.veloCompartir.hidden = true;
    el.pila.inert = false;
    el.compartirImagen.removeEventListener('click', conImagen);
    el.compartirTexto.removeEventListener('click', conTexto);
    el.compartirCancelar.removeEventListener('click', cerrar);
    document.removeEventListener('keydown', alTeclear);
    focoPrevio?.focus?.();
  };

  const entregar = async (como) => {
    el.compartirImagen.disabled = true;
    el.compartirTexto.disabled = true;
    el.compartirAviso.textContent = 'Preparando…';

    try {
      const que = await como(acta);
      if (que === 'descargado') {
        el.compartirAviso.textContent = 'Descargado: no se puede compartir desde aquí.';
        return;
      }
    } catch (error) {
      console.error('No se ha podido compartir:', error);
      el.compartirAviso.textContent = 'No se ha podido preparar. Inténtalo otra vez.';
      return;
    } finally {
      el.compartirImagen.disabled = false;
      el.compartirTexto.disabled = false;
    }

    cerrar();
  };

  const conImagen = () => entregar(como.imagen);
  const conTexto = () => entregar(como.texto);
  const alTeclear = (evento) => {
    if (evento.key === 'Escape') cerrar();
  };

  el.compartirImagen.addEventListener('click', conImagen);
  el.compartirTexto.addEventListener('click', conTexto);
  el.compartirCancelar.addEventListener('click', cerrar);
  document.addEventListener('keydown', alTeclear);
}

// ── Enlaces ────────────────────────────────────────────────────────────────

el.formNueva.addEventListener('submit', empezarBatalla);
el.modo.addEventListener('click', (evento) => {
  const opcion = evento.target.closest('[data-modo]');
  if (opcion) elegirModo(opcion.dataset.modo);
});
el.btnAnadir.addEventListener('click', anadirBatallero);
el.btnAnadirTramo.addEventListener('click', anadirTramoAlaPlantilla);
el.notaMenos.addEventListener('click', () => moverNotaMaxima(-1));
el.notaMas.addEventListener('click', () => moverNotaMaxima(1));
el.opDecimales.addEventListener('change', () => {
  opciones.decimales = el.opDecimales.checked;
});
el.opPantalla.addEventListener('change', () => {
  const quiere = el.opPantalla.checked;
  apuntarPreferenciaDePantalla(quiere);
  if (quiere) mantenerPantallaEncendida();
  else dejarQueSeApague();
});
el.btnHistorial.addEventListener('click', () => historial.abrir());
el.btnCopia.addEventListener('click', () => copia.abrir());
el.btnAvisoCopia.addEventListener('click', () => copia.abrir());
el.btnRetomar.addEventListener('click', retomar);

el.tecladoRejilla.addEventListener('click', (evento) => {
  const tecla = evento.target.closest('[data-nota]');
  if (tecla) anotar(Number(tecla.dataset.nota));
});

el.btnMedio.addEventListener('click', medioPunto);

el.marcadores.addEventListener('click', (evento) => {
  const caja = evento.target.closest('[data-id]');
  if (caja) apuntarA(batalla.cursor.tramo, caja.dataset.id);
});

el.bloques.addEventListener('click', (evento) => {
  const cuadro = evento.target.closest('.voto');
  if (!cuadro) return;

  if (cuadro.dataset.indice !== undefined) {
    marcarVoto(Number(cuadro.dataset.indice));
  } else if (cuadro.dataset.tramo) {
    apuntarA(cuadro.dataset.tramo, cuadro.dataset.batallero);
  }
});

el.btnTramoEnCurso.addEventListener('click', () =>
  anadirTramoEnCurso({ replica: false })
);
el.btnReplica.addEventListener('click', () =>
  anadirTramoEnCurso({ replica: true })
);

el.btnBorrar.addEventListener('click', borrar);
el.btnCancelar.addEventListener('click', cancelar);
el.btnTerminar.addEventListener('click', terminar);
el.btnVolver.addEventListener('click', sacar);
el.btnGuardar.addEventListener('click', guardar);
el.btnCompartir.addEventListener('click', () => compartir(actaDeLaBatalla()));
el.btnCompartirDetalle.addEventListener('click', () => {
  const abierta = historial.laQueEstaAbierta();
  if (abierta) compartir(abierta);
});

el.btnCerrarHistorial.addEventListener('click', sacar);
el.btnCerrarDetalle.addEventListener('click', sacar);
el.btnCerrarCopia.addEventListener('click', sacar);

/** Teclado físico, para poder puntuar cómodo desde el ordenador. */
document.addEventListener('keydown', (evento) => {
  if (navegando || !enCima(PUNTUACION) || !batalla) return;
  if (!el.velo.hidden || !el.veloModalidad.hidden || !el.veloCompartir.hidden) return;
  if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

  // Con nota máxima por encima de nueve, el 10 se teclea con la 'a'.
  const nota =
    evento.key >= '0' && evento.key <= '9'
      ? Number(evento.key)
      : evento.key.toLowerCase() === 'a'
        ? 10
        : null;

  if (nota !== null && nota <= batalla.notaMaxima) {
    evento.preventDefault();
    anotar(nota);
  } else if (evento.key === 'Backspace' || evento.key === 'Delete') {
    evento.preventDefault();
    borrar();
  } else if (evento.key === ',' || evento.key === '.') {
    evento.preventDefault();
    medioPunto();
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
pintarOpciones();
prepararPantalla();
pintarPila({ bloquear: false });
pedirPersistencia();
buscarLoQueQuedoAMedias();
vigilarVersiones();
