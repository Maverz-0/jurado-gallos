/**
 * Cuatro utilidades de pintado que comparten las pantallas que se repintan en
 * cada tecla.
 *
 * La idea es siempre la misma: reaprovechar los nodos que ya están puestos en
 * vez de rehacerlos. Con muchos participantes y muchas intervenciones son
 * cientos de cuadritos, y esto se ejecuta en cada pulsación.
 */

export const $ = (id) => document.getElementById(id);

export const clonar = (plantilla) =>
  plantilla.content.firstElementChild.cloneNode(true);

/** Deja el contenedor con exactamente `cuantos` hijos, creando o quitando. */
export function ajustarHijos(contenedor, cuantos, crear) {
  while (contenedor.children.length > cuantos) {
    contenedor.lastElementChild.remove();
  }
  while (contenedor.children.length < cuantos) {
    contenedor.append(crear());
  }
}

/** Escribe sólo si cambia, para no provocar reflows de balde. */
export function poner(nodo, texto) {
  const valor = String(texto);
  if (nodo.textContent !== valor) nodo.textContent = valor;
}
