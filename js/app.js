/**
 * Punto de entrada: enlaza la lógica de scoring.js con la interfaz y gobierna
 * la navegación entre las tres vistas (inicio → puntuación → resultado).
 */

import * as scoring from './scoring.js';
import { guardarBatalla, pedirPersistencia } from './storage.js';

const NOMBRES_POR_DEFECTO = {
  [scoring.A]: 'Batallero A',
  [scoring.B]: 'Batallero B',
};

const VISTAS = ['vista-inicio', 'vista-puntuacion', 'vista-final'];
const INICIO = 0;
const PUNTUACION = 1;
const FINAL = 2;

const $ = (id) => document.getElementById(id);

const el = {
  formNueva: $('form-nueva'),
  nombreA: $('nombre-a'),
  nombreB: $('nombre-b'),

  btnCancelar: $('btn-cancelar'),
  btnTerminar: $('btn-terminar'),
  btnBorrar: $('btn-borrar'),
  teclado: $('teclado'),
  turno: $('turno'),

  btnVolver: $('btn-volver'),
  btnGuardar: $('btn-guardar'),
  avisoGuardar: $('aviso-guardar'),

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
let nivel = INICIO;

// ── Navegación ─────────────────────────────────────────────────────────────

function irA(destino) {
  nivel = destino;

  VISTAS.forEach((id, i) => {
    const vista = $(id);
    vista.classList.toggle('vista--activa', i === destino);
    vista.classList.toggle('vista--atras', i < destino);
    vista.inert = i !== destino;
  });
}

// ── Nombres ────────────────────────────────────────────────────────────────

function nombreDe(bat) {
  const propio = bat === scoring.A ? batalla.batalleroA : batalla.batalleroB;
  return propio || NOMBRES_POR_DEFECTO[bat];
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

// ── Acciones ───────────────────────────────────────────────────────────────

function empezarBatalla(evento) {
  evento.preventDefault();
  document.activeElement?.blur?.(); // cierra el teclado de iOS

  batalla = scoring.crearBatalla(el.nombreA.value, el.nombreB.value);
  pintarPuntuacion();
  irA(PUNTUACION);
}

function anotar(valor) {
  batalla = scoring.anotar(batalla, valor, Date.now());
  pintarPuntuacion();
}

function borrar() {
  if (scoring.estaVacia(batalla)) return;
  batalla = scoring.deshacer(batalla);
  pintarPuntuacion();
}

function apuntarA(bat) {
  batalla = scoring.moverCursor(batalla, bat);
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

  volverAlInicio();
}

function terminar() {
  if (scoring.estaVacia(batalla)) return;
  pintarFinal();
  irA(FINAL);
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
    volverAlInicio();
  } catch (error) {
    console.error('No se ha podido guardar la batalla:', error);
    el.avisoGuardar.textContent =
      'No se ha podido guardar. Inténtalo otra vez.';
    el.btnGuardar.disabled = false;
  }
}

function volverAlInicio() {
  batalla = null;
  el.formNueva.reset();
  irA(INICIO);
}

// ── Enlaces ────────────────────────────────────────────────────────────────

el.formNueva.addEventListener('submit', empezarBatalla);

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
el.btnVolver.addEventListener('click', () => irA(PUNTUACION));
el.btnGuardar.addEventListener('click', guardar);

marcador[scoring.A].caja.addEventListener('click', () => apuntarA(scoring.A));
marcador[scoring.B].caja.addEventListener('click', () => apuntarA(scoring.B));

// ── Arranque ───────────────────────────────────────────────────────────────

irA(INICIO);
pedirPersistencia();
