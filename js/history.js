/**
 * Vista de resultados anteriores: la lista de batallas guardadas y el detalle
 * de cada una.
 *
 * No sabe navegar ni preguntar por sí misma: app.js le pasa esas dos cosas al
 * construirla, para que aquí sólo viva lo que tiene que ver con el historial.
 */

import { listarBatallas, obtenerBatalla, borrarBatalla } from './storage.js';
import { comoSeEscribe } from './scoring.js';

const EN_LISTA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const EN_DETALLE = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const $ = (id) => document.getElementById(id);

export function crearHistorial({ empujar, sacar, confirmar }) {
  const el = {
    grupoLista: $('grupo-lista'),
    lista: $('lista-batallas'),
    vacia: $('lista-vacia'),
    avisoHistorial: $('aviso-historial'),

    fecha: $('detalle-fecha'),
    totales: $('detalle-totales'),
    secuencia: $('detalle-secuencia'),
    btnBorrar: $('btn-borrar-batalla'),
    avisoDetalle: $('aviso-detalle'),

    tplBatalla: $('tpl-batalla'),
    tplPaso: $('tpl-paso'),
    tplResultado: $('tpl-resultado'),
  };

  /** Batalla que se está mirando en el detalle. */
  let abierta = null;

  // ── Lista ────────────────────────────────────────────────────────────────

  /** Se pinta antes de entrar, para no enseñar la lista vacía un instante. */
  async function abrir() {
    await refrescarLista();
    empujar('vista-historial');
  }

  async function refrescarLista() {
    el.avisoHistorial.textContent = '';

    let batallas;
    try {
      batallas = await listarBatallas();
    } catch (error) {
      console.error('No se han podido leer las batallas:', error);
      el.grupoLista.hidden = true;
      el.vacia.hidden = true;
      el.avisoHistorial.textContent =
        'No se han podido leer las batallas guardadas.';
      return;
    }

    el.grupoLista.hidden = batallas.length === 0;
    el.vacia.hidden = batallas.length > 0;
    el.lista.replaceChildren(...batallas.map(filaDeBatalla));
  }

  function filaDeBatalla(batalla) {
    const fila = el.tplBatalla.content.firstElementChild.cloneNode(true);

    fila.dataset.id = batalla.id;
    fila.querySelector('.batalla__nombres').textContent = batalla.batalleros
      .map((batallero) => batallero.nombre)
      .join(' · ');
    fila.querySelector('.batalla__fecha').textContent = fechaLegible(
      batalla.fecha,
      EN_LISTA
    );
    fila.querySelector('.batalla__marcador').textContent = batalla.batalleros
      .map((batallero) => comoSeEscribe(batallero.total))
      .join(' · ');

    return fila;
  }

  // ── Detalle ──────────────────────────────────────────────────────────────

  async function abrirDetalle(id) {
    let batalla;
    try {
      batalla = await obtenerBatalla(id);
    } catch (error) {
      console.error('No se ha podido leer la batalla:', error);
      el.avisoHistorial.textContent = 'No se ha podido abrir esa batalla.';
      return;
    }

    // Puede haber desaparecido desde que se pintó la lista.
    if (!batalla) {
      await refrescarLista();
      return;
    }

    abierta = batalla;
    pintarDetalle(batalla);
    empujar('vista-detalle');
  }

  function pintarDetalle(batalla) {
    el.fecha.textContent = fechaLegible(batalla.fecha, EN_DETALLE);

    el.totales.replaceChildren(
      ...batalla.batalleros.map((batallero) => {
        const linea = el.tplResultado.content.firstElementChild.cloneNode(true);
        linea.querySelector('.resultado__nombre').textContent = batallero.nombre;
        linea.querySelector('.resultado__total').textContent = batallero.replica
          ? `${comoSeEscribe(batallero.total)} + ${comoSeEscribe(batallero.replica)}`
          : comoSeEscribe(batallero.total);
        return linea;
      })
    );

    const nombreDe = new Map(
      batalla.batalleros.map((batallero) => [batallero.id, batallero.nombre])
    );
    const tramoDe = new Map(
      batalla.tramos.map((tramo) => [tramo.id, comoSeLlamaElTramo(tramo)])
    );
    const variosTramos = batalla.tramos.length > 1;

    el.secuencia.replaceChildren(
      ...batalla.puntuaciones.map((puntuacion, i) => {
        const paso = el.tplPaso.content.firstElementChild.cloneNode(true);
        const quien = nombreDe.get(puntuacion.batallero) ?? '—';
        const donde = tramoDe.get(puntuacion.tramo);

        paso.querySelector('.paso__numero').textContent = `${i + 1}`;
        paso.querySelector('.paso__nombre').textContent =
          variosTramos && donde ? `${quien} · ${donde}` : quien;
        paso.querySelector('.paso__valor').textContent = comoSeEscribe(
          puntuacion.valor
        );
        return paso;
      })
    );

    el.avisoDetalle.textContent = '';
    el.btnBorrar.disabled = false;
  }

  async function borrar() {
    if (!abierta) return;

    const seguro = await confirmar({
      titulo: '¿Borrar la batalla?',
      texto: `Se borrará ${abierta.batalleros.map((b) => b.nombre).join(' · ')} y su puntuación. No se puede deshacer.`,
      aceptar: 'Borrar',
      cancelar: 'Conservar',
    });
    if (!seguro) return;

    el.btnBorrar.disabled = true;

    try {
      await borrarBatalla(abierta.id);
    } catch (error) {
      console.error('No se ha podido borrar la batalla:', error);
      el.avisoDetalle.textContent = 'No se ha podido borrar. Inténtalo otra vez.';
      el.btnBorrar.disabled = false;
      return;
    }

    abierta = null;
    sacar();
    await refrescarLista();
  }

  // ── Enlaces ──────────────────────────────────────────────────────────────

  el.lista.addEventListener('click', (evento) => {
    const fila = evento.target.closest('[data-id]');
    if (fila) abrirDetalle(fila.dataset.id);
  });

  el.btnBorrar.addEventListener('click', borrar);

  return { abrir, laQueEstaAbierta: () => abierta };
}

/** «4×4» para un N×N, y el nombre de la modalidad para el resto. */
function comoSeLlamaElTramo(tramo) {
  const base =
    tramo.modalidad === 'nxn'
      ? `${tramo.intervenciones}×${tramo.intervenciones}`
      : tramo.modalidad === 'minuto'
        ? `Minuto · ${tramo.intervenciones}`
        : 'Dinámica';

  return tramo.replica ? `Réplica · ${base}` : base;
}

/** Las fechas se guardan en ISO; aquí se muestran como las lee una persona. */
function fechaLegible(iso, formato) {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : formato.format(fecha);
}
