/**
 * Pantalla de filtros: preparación en el inicio y votación.
 *
 * No sabe navegar ni preguntar por sí misma: app.js le pasa esas dos cosas al
 * construirla, igual que al historial.
 */

import * as filtros from './filters.js';
import { $, clonar, ajustarHijos, poner } from './dom.js';
import {
  compartirClasificacionImagen,
  compartirClasificacionTexto,
} from './share.js';
import { guardarFiltros, guardarBorrador, olvidarBorrador } from './storage.js';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Cuántas columnas de cuadros del grupo en curso. Van en pequeño y en una
 * línea: aquí no se decide nada, sólo sirven para orientarse, y el sitio lo
 * necesitan las filas de votación.
 */
const COLUMNAS = [
  { hasta: 3, columnas: 1 },
  { hasta: 8, columnas: 2 },
  { hasta: 12, columnas: 3 },
];

export function crearVistaFiltros({
  empujar,
  sacar,
  volverAlaRaiz,
  confirmar,
  compartir,
}) {
  const el = {
    form: $('form-filtros'),
    lista: $('lista-aspirantes'),
    btnAnadirAspirante: $('btn-anadir-aspirante'),
    grupoCuantos: $('grupo-cuantos'),
    grupoMenos: $('grupo-menos'),
    grupoMas: $('grupo-mas'),
    interCuantas: $('inter-cuantas'),
    interMenos: $('inter-menos'),
    interMas: $('inter-mas'),
    clasificanCuantos: $('clasifican-cuantos'),
    clasificanMenos: $('clasifican-menos'),
    clasificanMas: $('clasifican-mas'),
    notaMaxima: $('fnota-maxima'),
    notaMenos: $('fnota-menos'),
    notaMas: $('fnota-mas'),
    redondeo: $('redondeo'),

    vista: $('vista-filtros'),
    grupoTitulo: $('fgrupo-titulo'),
    marcadores: $('fmarcadores'),
    turno: $('fturno'),
    desplazable: $('fdesplazable'),
    bloques: $('fbloques'),
    vacio: $('fvacio'),
    btnAnadir: $('fbtn-anadir'),
    btnEditar: $('fbtn-editar'),
    btnCancelar: $('fbtn-cancelar'),
    btnTerminar: $('fbtn-terminar'),
    teclado: $('fteclado'),
    tecladoRejilla: $('fteclado-rejilla'),
    btnBorrar: $('fbtn-borrar'),

    velo: $('velo-aspirante'),
    aspiranteTitulo: $('aspirante-titulo'),
    aspiranteNombre: $('aspirante-nombre'),
    aspiranteFilaGrupo: $('aspirante-fila-grupo'),
    aspiranteGrupo: $('aspirante-grupo'),
    aspiranteMenos: $('aspirante-menos'),
    aspiranteMas: $('aspirante-mas'),
    aspiranteNota: $('aspirante-nota'),
    aspiranteAceptar: $('aspirante-aceptar'),
    aspiranteCancelar: $('aspirante-cancelar'),

    orden: $('orden'),
    corte: $('corte'),
    leyenda: $('leyenda'),
    btnJurado: $('cbtn-jurado'),
    btnGuardar: $('cbtn-guardar'),
    btnAviso: $('cbtn-aviso'),
    btnCompartir: $('cbtn-compartir'),
    ctecla: $('cteclado'),
    ctecladoRejilla: $('cteclado-rejilla'),
    cturno: $('cturno'),
    btnSalir: $('cbtn-salir'),
    aspiranteAntes: $('aspirante-antes'),
    tablaNombres: $('tabla-nombres'),
    tablaCuerpo: $('tabla-cuerpo'),
    tablaCabecera: $('tabla-cabecera'),
    btnVolverTabla: $('cbtn-volver'),

    pila: $('pila'),
    tplTablaNombre: $('tpl-tabla-nombre'),
    tplTablaFila: $('tpl-tabla-fila'),
    tplTablaCelda: $('tpl-tabla-celda'),
    tplTablaColumna: $('tpl-tabla-columna'),
    tplAspirante: $('tpl-aspirante'),
    tplTecla: $('tpl-tecla'),
    tplMarcador: $('tpl-marcador'),
    tplBloque: $('tpl-bloque'),
    tplEtiqueta: $('tpl-etiqueta-participante'),
    tplOrdinal: $('tpl-ordinal'),
    tplFila: $('tpl-fila-participante'),
    tplVoto: $('tpl-voto'),
  };

  /** Lo que se prepara en el inicio. */
  let plantilla = {
    aspirantes: [],
    tamanoGrupo: filtros.TAMANO_GRUPO_POR_DEFECTO,
    intervenciones: filtros.INTERVENCIONES_POR_DEFECTO,
    clasifican: filtros.CLASIFICAN_POR_DEFECTO,
    notaMaxima: 4,
    redondeo: filtros.REDONDEO_POR_DEFECTO,
  };

  /** Los filtros en curso, o null. */
  let ahora = null;
  let editando = false;
  let contador = 0;
  let ultimoGrupoVisto = null;
  let orden = 'puntuacion';

  /** Mientras se rellenan las notas de un jurado: { jurado, participante }. */
  let apuntando = null;

  /** Si vienen del historial o ya se guardaron, su id: guardar sobrescribe. */
  let guardadoComo = null;

  /** Mientras se reabre algo, el pintado no debe apuntarlo como pendiente. */
  let restaurando = false;

  const nuevoId = () => `p${(contador += 1)}`;

  // ── Preparación ──────────────────────────────────────────────────────────

  function pintarPreparacion() {
    el.lista.replaceChildren(...plantilla.aspirantes.map(filaDeAspirante));
    el.lista.hidden = plantilla.aspirantes.length === 0;

    contarEn(el.grupoCuantos, el.grupoMenos, el.grupoMas, plantilla.tamanoGrupo,
      filtros.MIN_TAMANO_GRUPO, filtros.MAX_TAMANO_GRUPO);
    contarEn(el.interCuantas, el.interMenos, el.interMas, plantilla.intervenciones,
      filtros.MIN_INTERVENCIONES, filtros.MAX_INTERVENCIONES);
    contarEn(el.clasificanCuantos, el.clasificanMenos, el.clasificanMas, plantilla.clasifican,
      filtros.MIN_CLASIFICAN, filtros.MAX_CLASIFICAN);
    contarEn(el.notaMaxima, el.notaMenos, el.notaMas, plantilla.notaMaxima, 1, 10);

    for (const opcion of el.redondeo.children) {
      opcion.setAttribute(
        'aria-pressed',
        String(opcion.dataset.redondeo === plantilla.redondeo)
      );
    }
  }

  function contarEn(cifra, menos, mas, valor, minimo, maximo) {
    poner(cifra, valor);
    menos.disabled = valor <= minimo;
    mas.disabled = valor >= maximo;
  }

  function filaDeAspirante(aspirante, i) {
    const fila = clonar(el.tplAspirante);
    poner(fila.querySelector('.aspirante__nombre'), aspirante.nombre || `Participante ${i + 1}`);
    poner(
      fila.querySelector('.aspirante__grupo'),
      `Grupo ${Math.floor(i / plantilla.tamanoGrupo) + 1}`
    );
    fila.querySelector('.signo--quitar').addEventListener('click', () => {
      plantilla.aspirantes = plantilla.aspirantes.filter((otro) => otro.id !== aspirante.id);
      pintarPreparacion();
    });
    return fila;
  }

  function mover(campo, paso, minimo, maximo) {
    plantilla[campo] = filtros.entre(plantilla[campo] + paso, minimo, maximo, plantilla[campo]);
    pintarPreparacion();
  }

  // ── Empezar ──────────────────────────────────────────────────────────────

  function empezar(evento) {
    evento.preventDefault();
    document.activeElement?.blur?.();

    ahora = filtros.crearFiltros({
      participantes: plantilla.aspirantes.map((aspirante, i) => ({
        id: aspirante.id,
        nombre: aspirante.nombre,
        grupo: Math.floor(i / plantilla.tamanoGrupo),
      })),
      tamanoGrupo: plantilla.tamanoGrupo,
      intervenciones: plantilla.intervenciones,
      notaMaxima: plantilla.notaMaxima,
      redondeo: plantilla.redondeo,
      clasifican: plantilla.clasifican,
    });

    editando = false;
    ultimoGrupoVisto = null;
    montarTeclado();
    pintar();
    empujar('vista-filtros');

    // Empezar sin nadie es normal: se apuntan sobre la marcha.
    if (ahora.participantes.length === 0) pedirAspirante();
  }

  function montarTeclado() {
    const notas = Array.from({ length: ahora.notaMaxima + 1 }, (_, i) => i);
    const teclas = notas.map((nota) => {
      const tecla = clonar(el.tplTecla);
      tecla.dataset.nota = String(nota);
      tecla.textContent = nota;
      return tecla;
    });

    el.tecladoRejilla.replaceChildren(...teclas, el.btnBorrar);

    const cuantas = teclas.length + 1;
    const porFila = cuantas <= 6 ? 3 : 4;
    const filas = Math.ceil(cuantas / porFila);
    const sobra = cuantas % porFila;

    el.btnBorrar.style.gridColumn = sobra === 0 ? '' : `span ${porFila - sobra + 1}`;
    el.teclado.style.setProperty('--teclas-por-fila', porFila);
    el.teclado.style.setProperty(
      '--alto-tecla',
      `${filas <= 2 ? 68 : filas === 3 ? 58 : 50}px`
    );
  }

  // ── Pintado ──────────────────────────────────────────────────────────────

  function comoSeLlama(participante, i) {
    return participante.nombre || `Participante ${LETRAS[i] ?? i + 1}`;
  }

  /** El grupo al que pertenece quien tiene el turno. */
  function grupoEnCurso() {
    const lista = filtros.grupos(ahora);
    return (
      lista.find((grupo) => grupo.miembros.some((p) => p.id === ahora.cursor)) ??
      lista[0] ??
      null
    );
  }

  function pintar({ seguirElGrupo = true } = {}) {
    const lista = filtros.grupos(ahora);
    const hayGente = ahora.participantes.length > 0;

    el.vacio.hidden = hayGente;
    el.vista.classList.toggle('editando', editando);
    el.btnEditar.textContent = editando ? 'Hecho' : 'Editar';

    pintarMarcadores();
    pintarBloques(lista);

    const sePuede = filtros.puedeAnotar(ahora) && !editando;
    for (const tecla of el.tecladoRejilla.querySelectorAll('[data-nota]')) {
      tecla.disabled = !sePuede;
    }
    el.btnBorrar.disabled = filtros.estaVacio(ahora) || editando;
    el.btnTerminar.disabled = filtros.estaVacio(ahora);
    el.turno.textContent = queToca(sePuede, hayGente);

    const grupo = grupoEnCurso();
    if (seguirElGrupo && grupo && grupo.interno !== ultimoGrupoVisto) {
      ultimoGrupoVisto = grupo.interno;
      asomarElGrupo(grupo.interno);
    }

    // Todos los cambios pasan por aquí, así que basta con apuntar al final.
    if (!restaurando) apuntarBorrador();
  }

  function queToca(sePuede, hayGente) {
    if (!hayGente) return 'Apunta a alguien para empezar';
    if (editando) return 'Quita o reordena; pulsa «Hecho» al terminar';
    if (ahora.marcada !== null) return 'Corrigiendo: pulsa un número para sustituirlo';
    if (!sePuede) return 'Todas las intervenciones puestas. Puedes terminar.';

    const i = ahora.participantes.findIndex((p) => p.id === ahora.cursor);
    return `Puntuando a ${comoSeLlama(ahora.participantes[i], i)}`;
  }

  function pintarMarcadores() {
    const grupo = grupoEnCurso();
    const miembros = grupo?.miembros ?? [];
    const reparto = COLUMNAS.find((r) => miembros.length <= r.hasta) ?? COLUMNAS.at(-1);

    poner(el.grupoTitulo, grupo ? `Grupo ${grupo.numero}` : '');
    el.grupoTitulo.hidden = !grupo;
    el.marcadores.classList.add('marcadores--mini');
    el.marcadores.style.setProperty('--columnas', reparto.columnas);
    ajustarHijos(el.marcadores, miembros.length, () => clonar(el.tplMarcador));

    miembros.forEach((participante, i) => {
      const caja = el.marcadores.children[i];
      const activo = ahora.cursor === participante.id;
      const puestos = filtros.cuantasNotas(ahora, participante.id);
      const donde = ahora.participantes.findIndex((p) => p.id === participante.id);

      caja.dataset.id = participante.id;
      caja.classList.toggle('marcador--activo', activo);
      caja.setAttribute('aria-pressed', String(activo));
      poner(caja.querySelector('.marcador__nombre'), comoSeLlama(participante, donde));
      poner(
        caja.querySelector('.marcador__total'),
        filtros.comoSeEscribe(filtros.media(ahora, participante.id))
      );
      poner(
        caja.querySelector('.marcador__replica'),
        `${puestos}/${ahora.intervenciones}`
      );
    });
  }

  function pintarBloques(lista) {
    ajustarHijos(el.bloques, lista.length, () => clonar(el.tplBloque));

    lista.forEach((grupo, g) => {
      const bloque = el.bloques.children[g];
      const cuantos = grupo.miembros.length;

      poner(bloque.querySelector('.bloque__titulo'), `Grupo ${grupo.numero}`);
      bloque.dataset.grupo = String(grupo.interno);

      const ordinales = bloque.querySelector('.pista__ordinales');
      ajustarHijos(ordinales, ahora.intervenciones, () => clonar(el.tplOrdinal));
      for (let i = 0; i < ahora.intervenciones; i += 1) {
        poner(ordinales.children[i], `${i + 1}ª`);
      }

      const etiquetas = bloque.querySelector('.pista__etiquetas');
      const filas = bloque.querySelector('.pista__filas');
      ajustarHijos(etiquetas, cuantos + 1, () => clonar(el.tplEtiqueta));
      ajustarHijos(filas, cuantos + 1, () => clonar(el.tplFila));

      grupo.miembros.forEach((participante, b) => {
        const donde = ahora.participantes.findIndex((p) => p.id === participante.id);
        const nombre = comoSeLlama(participante, donde);
        const activa = ahora.cursor === participante.id;

        const etiqueta = etiquetas.children[b + 1];
        etiqueta.dataset.id = participante.id;
        poner(etiqueta.querySelector('.pista__nombre'), nombre);
        etiqueta.classList.toggle('pista__etiqueta--activo', activa);

        const fila = filas.children[b + 1];
        fila.dataset.id = participante.id;
        fila.classList.toggle('pista__fila--activa', activa);
        ajustarHijos(fila, ahora.intervenciones, () => clonar(el.tplVoto));

        const votos = filtros.votosDe(ahora, participante.id);

        for (let i = 0; i < ahora.intervenciones; i += 1) {
          const cuadro = fila.children[i];
          const voto = votos[i];
          const entero = cuadro.querySelector('.voto__entero');

          poner(cuadro.querySelector('.voto__medio'), '');

          if (voto) {
            poner(entero, voto.valor);
            cuadro.dataset.indice = String(voto.indice);
            cuadro.classList.remove('voto--vacio');
            cuadro.classList.toggle('voto--marcado', ahora.marcada === voto.indice);
            cuadro.setAttribute('aria-label', `Intervención ${i + 1} de ${nombre}: ${voto.valor}`);
          } else {
            poner(entero, '');
            delete cuadro.dataset.indice;
            cuadro.classList.add('voto--vacio');
            cuadro.classList.remove('voto--marcado');
            cuadro.setAttribute('aria-label', `Intervención ${i + 1} de ${nombre}: sin puntuar`);
          }
        }
      });
    });
  }

  function asomarElGrupo(interno) {
    const bloque = [...el.bloques.children].find(
      (nodo) => nodo.dataset.grupo === String(interno)
    );
    if (!bloque) return;

    // Se mueve sólo el contenedor de grupos, a mano. `scrollIntoView` arrastra
    // también a los ancestros y llega a descolocar la pila de vistas entera.
    el.desplazable.scrollTop +=
      bloque.getBoundingClientRect().top -
      el.desplazable.getBoundingClientRect().top;
  }

  // ── Guardar y recuperar ──────────────────────────────────────────────────

  /**
   * Se apunta lo que hay en cada cambio, igual que en una batalla: una llamada
   * entrante no puede llevarse por delante unos filtros enteros.
   */
  let apuntandoBorrador = false;
  let quedaPorApuntar = false;

  function apuntarBorrador() {
    if (!ahora) return;

    if (apuntandoBorrador) {
      quedaPorApuntar = true;
      return;
    }

    apuntandoBorrador = true;
    guardarBorrador({ tipo: 'filtros', ...ahora, guardadoComo })
      .catch((error) => console.error('No se han podido apuntar los filtros:', error))
      .finally(() => {
        apuntandoBorrador = false;
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

  async function guardar() {
    el.btnGuardar.disabled = true;
    el.btnAviso.textContent = '';

    try {
      const registro = await guardarFiltros(ahora, guardadoComo);
      guardadoComo = registro.id;
      el.btnAviso.textContent = 'Guardado en Resultados anteriores.';
      poner(el.btnGuardar, 'Guardar cambios');
      apuntarBorrador();
    } catch (error) {
      console.error('No se han podido guardar los filtros:', error);
      el.btnAviso.textContent = 'No se ha podido guardar. Inténtalo otra vez.';
    } finally {
      el.btnGuardar.disabled = false;
    }
  }

  /** Los abre desde el historial, directamente en su tabla. */
  function abrirGuardados(registro) {
    const restaurado = filtros.restaurar(registro);
    if (!restaurado) return;

    ahora = restaurado;
    guardadoComo = registro.id;
    editando = false;
    apuntando = null;
    ultimoGrupoVisto = null;
    contador = Math.max(contador, registro.participantes.length);

    restaurando = true;
    montarTeclado();
    pintar({ seguirElGrupo: false });
    poner(el.btnGuardar, 'Guardar cambios');
    el.btnAviso.textContent = '';
    pintarTabla();
    restaurando = false;

    empujar('vista-clasificacion');
  }

  /** Retoma lo que quedó a medias, en la pantalla de votar. */
  function retomarLoQueQuedoAMedias(datos) {
    const restaurado = filtros.restaurar(datos);
    if (!restaurado) return false;

    ahora = restaurado;
    guardadoComo = datos.guardadoComo ?? null;
    editando = false;
    apuntando = null;
    ultimoGrupoVisto = null;
    contador = Math.max(contador, datos.participantes.length);

    montarTeclado();
    poner(el.btnGuardar, guardadoComo ? 'Guardar cambios' : 'Guardar');
    pintar();
    empujar('vista-filtros');
    return true;
  }

  // ── Clasificación ────────────────────────────────────────────────────────

  function terminar() {
    pintarTabla();
    empujar('vista-clasificacion');
  }

  /**
   * Filas por participante, una columna por jurado y el puesto al final. El
   * puesto lo decide siempre la suma; el selector sólo cambia el orden de las
   * filas, no quién clasifica.
   */
  function pintarTabla() {
    const filas = filtros.clasificacion(ahora, { orden });
    const jurados = ahora.jurados;
    const conTotal = jurados.length > 1;
    const columnas = [
      ...jurados.map((jurado) => jurado.nombre),
      ...(conTotal ? ['Total'] : []),
      '#',
    ];

    // A quién le habría dado el corte cada jurado, si contase él solo.
    const segunCadaUno = new Map(
      jurados.map((jurado) => [jurado.id, filtros.clasificariaSegun(ahora, jurado.id)])
    );

    for (const opcion of el.orden.children) {
      opcion.setAttribute('aria-pressed', String(opcion.dataset.orden === orden));
    }
    poner(
      el.corte,
      filas.length
        ? `Clasifican los ${ahora.clasifican} primeros de ${filas.length}.`
        : 'Todavía no hay a quién clasificar.'
    );

    ajustarHijos(el.tablaCabecera, columnas.length, () => clonar(el.tplTablaColumna));
    columnas.forEach((texto, i) => poner(el.tablaCabecera.children[i], texto));

    // El primer hijo de cada columna es el título y la cabecera.
    ajustarHijos(el.tablaNombres, filas.length + 1, () => clonar(el.tplTablaNombre));
    ajustarHijos(el.tablaCuerpo, filas.length + 1, () => clonar(el.tplTablaFila));

    filas.forEach((fila, i) => {
      const donde = ahora.participantes.findIndex((p) => p.id === fila.participante.id);
      poner(el.tablaNombres.children[i + 1], comoSeLlama(fila.participante, donde));

      const nodo = el.tablaCuerpo.children[i + 1];
      ajustarHijos(nodo, columnas.length, () => clonar(el.tplTablaCelda));

      jurados.forEach((jurado, j) => {
        const celda = nodo.children[j];
        const nota = filtros.notaDe(ahora, jurado.id, fila.participante.id);
        const habriaPasado = segunCadaUno.get(jurado.id).has(fila.participante.id);

        celda.dataset.jurado = jurado.id;
        celda.dataset.participante = fila.participante.id;
        poner(celda, nota === null ? '—' : filtros.comoSeEscribe(nota));
        celda.classList.toggle('celda--verde', habriaPasado && fila.clasifica);
        celda.classList.toggle('celda--ambar', habriaPasado && !fila.clasifica);
        // Se decide aquí y no aparte, para que al salir del modo se limpie sola.
        celda.classList.toggle(
          'celda--apuntando',
          apuntando?.jurado === jurado.id &&
            apuntando?.participante === fila.participante.id
        );
      });

      if (conTotal) {
        const total = nodo.children[jurados.length];
        total.classList.add('celda--total');
        poner(total, filtros.comoSeEscribe(fila.total));
      }

      const puesto = nodo.children[columnas.length - 1];
      puesto.className = 'celda tabular celda--puesto';
      puesto.classList.toggle('celda--pasa', fila.clasifica);
      poner(puesto, fila.posicion);

      el.tablaNombres.children[i + 1].classList.toggle(
        'tabla__nombre--apuntando',
        apuntando?.participante === fila.participante.id
      );
    });

    pintarLeyenda(conTotal);
    pintarTecladoDeJurado();
    if (!restaurando) apuntarBorrador();
  }

  function pintarLeyenda(conTotal) {
    const marca = (clase, texto) =>
      `<span class="leyenda__marca leyenda__marca--${clase}"></span> ${texto}`;

    el.leyenda.innerHTML = [
      `Notas de 0 a ${ahora.notaMaxima}; la de cada uno es la media de sus ${ahora.intervenciones} intervenciones, redondeada a ${ahora.redondeo === 'medios' ? 'medios' : 'enteros'}.`,
      marca('verde', 'habría clasificado con ese jurado, y clasifica.'),
      marca('ambar', `habría clasificado con ese jurado, pero no ${conTotal ? 'en la suma' : 'al final'}.`),
    ].join('<br>');
  }

  // ── Notas de un jurado añadido ───────────────────────────────────────────

  function pintarTecladoDeJurado() {
    el.ctecla.hidden = !apuntando;
    if (!apuntando) return;

    const jurado = ahora.jurados.find((j) => j.id === apuntando.jurado);
    const i = ahora.participantes.findIndex((p) => p.id === apuntando.participante);
    const quien = i < 0 ? '' : comoSeLlama(ahora.participantes[i], i);
    poner(el.cturno, `${jurado?.nombre ?? ''}: nota para ${quien}`);
  }

  function montarTecladoDeJurado() {
    const teclas = Array.from({ length: ahora.notaMaxima + 1 }, (_, n) => {
      const tecla = clonar(el.tplTecla);
      tecla.dataset.nota = String(n);
      tecla.textContent = n;
      return tecla;
    });

    el.ctecladoRejilla.replaceChildren(...teclas, el.btnSalir);

    const cuantas = teclas.length + 1;
    const porFila = cuantas <= 6 ? 3 : 4;
    const sobra = cuantas % porFila;
    el.btnSalir.style.gridColumn = sobra === 0 ? '' : `span ${porFila - sobra + 1}`;
    el.ctecla.style.setProperty('--teclas-por-fila', porFila);
    el.ctecla.style.setProperty(
      '--alto-tecla',
      `${Math.ceil(cuantas / porFila) <= 2 ? 62 : 52}px`
    );
  }

  async function anadirJurado() {
    const nombre = await nombreSuelto({
      titulo: 'Añadir jurado',
      antes: 'Le meterás su nota para cada participante, uno detrás de otro.',
      marcador: `Jurado ${ahora.jurados.length + 1}`,
    });
    if (nombre === null) return;

    const id = `j${ahora.jurados.length + 1}`;
    ahora = filtros.anadirJurado(ahora, {
      id,
      nombre: nombre.trim() || `Jurado ${ahora.jurados.length + 1}`,
    });

    montarTecladoDeJurado();
    apuntando = { jurado: id, participante: ahora.participantes[0]?.id ?? null };
    if (!apuntando.participante) apuntando = null;
    pintarTabla();
  }

  function anotarDeJurado(valor) {
    if (!apuntando) return;

    ahora = filtros.ponerNotaDeJurado(
      ahora,
      apuntando.jurado,
      apuntando.participante,
      valor
    );

    // Al siguiente que le falte, y si no queda nadie se sale del modo.
    const pendientes = filtros.sinNotaDe(ahora, apuntando.jurado);
    apuntando = pendientes.length
      ? { jurado: apuntando.jurado, participante: pendientes[0].id }
      : null;

    pintarTabla();
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  function anotar(valor) {
    if (editando) return;
    ahora = filtros.anotar(ahora, valor, Date.now());
    pintar();
  }

  function borrar() {
    if (editando || filtros.estaVacio(ahora)) return;
    ahora = filtros.deshacer(ahora);
    pintar();
  }

  function apuntarA(id) {
    ahora = filtros.moverCursor(ahora, id);
    pintar();
  }

  function marcarVoto(indice) {
    ahora = filtros.marcarVoto(ahora, indice);
    pintar({ seguirElGrupo: false });
  }

  async function quitar(id) {
    const i = ahora.participantes.findIndex((p) => p.id === id);
    if (i < 0) return;

    const nombre = comoSeLlama(ahora.participantes[i], i);
    const cuantas = filtros.cuantasNotas(ahora, id);

    const seguro = await confirmar({
      titulo: `¿Quitar a ${nombre}?`,
      texto: cuantas
        ? `Se irá con sus ${cuantas === 1 ? '1 nota' : `${cuantas} notas`}, y dejará de contar en la clasificación.`
        : 'Todavía no tiene ninguna nota.',
      aceptar: 'Quitar',
      cancelar: 'Conservar',
    });
    if (!seguro) return;

    ahora = filtros.quitarParticipante(ahora, id);
    pintar({ seguirElGrupo: false });
  }

  async function pedirAspirante() {
    const sugerido = ahora ? filtros.grupoParaUnoNuevo(ahora) : 0;
    const elegido = await hojaDeAspirante(sugerido);
    if (!elegido) return;

    ahora = filtros.anadirParticipante(ahora, {
      id: nuevoId(),
      nombre: elegido.nombre,
      grupo: elegido.grupo,
    });
    pintar({ seguirElGrupo: false });
    asomarElGrupo(elegido.grupo);
  }

  /** Devuelve { nombre, grupo } o null. */
  function hojaDeAspirante(sugerido) {
    return new Promise((resolver) => {
      const focoPrevio = document.activeElement;
      const cuantos = ahora ? filtros.grupos(ahora).length : 0;
      let grupo = sugerido;

      const numeroDe = (interno) => {
        const encontrado = filtros.grupos(ahora).find((g) => g.interno === interno);
        return encontrado ? encontrado.numero : cuantos + 1;
      };

      const pintarHoja = () => {
        poner(el.aspiranteGrupo, numeroDe(grupo));
        el.aspiranteMenos.disabled = grupo <= 0;
        el.aspiranteMas.disabled = grupo >= cuantos;
        const miembros =
          filtros.grupos(ahora).find((g) => g.interno === grupo)?.miembros.length ?? 0;
        el.aspiranteNota.textContent =
          miembros >= ahora.tamanoGrupo
            ? `Ese grupo ya está completo con ${miembros}. Se puede meter igual.`
            : `Ese grupo tiene ${miembros} de ${ahora.tamanoGrupo}.`;
      };

      const cerrar = (respuesta) => {
        el.velo.hidden = true;
        el.pila.inert = false;
        el.aspiranteMenos.removeEventListener('click', alMenos);
        el.aspiranteMas.removeEventListener('click', alMas);
        el.aspiranteAceptar.removeEventListener('click', alAceptar);
        el.aspiranteCancelar.removeEventListener('click', alCancelar);
        el.aspiranteNombre.removeEventListener('keydown', alTeclearNombre);
        document.removeEventListener('keydown', alTeclear);
        focoPrevio?.focus?.();
        resolver(respuesta);
      };

      const alMenos = () => { grupo -= 1; pintarHoja(); };
      const alMas = () => { grupo += 1; pintarHoja(); };
      const alAceptar = () => cerrar({ nombre: el.aspiranteNombre.value, grupo });
      const alCancelar = () => cerrar(null);
      const alTeclear = (evento) => { if (evento.key === 'Escape') cerrar(null); };
      const alTeclearNombre = (evento) => {
        if (evento.key === 'Enter') { evento.preventDefault(); alAceptar(); }
      };

      el.aspiranteMenos.addEventListener('click', alMenos);
      el.aspiranteMas.addEventListener('click', alMas);
      el.aspiranteAceptar.addEventListener('click', alAceptar);
      el.aspiranteCancelar.addEventListener('click', alCancelar);
      el.aspiranteNombre.addEventListener('keydown', alTeclearNombre);
      document.addEventListener('keydown', alTeclear);

      el.aspiranteNombre.value = '';
      pintarHoja();
      el.pila.inert = true;
      el.velo.hidden = false;
      el.aspiranteNombre.focus();
    });
  }

  async function cancelar() {
    if (!filtros.estaVacio(ahora)) {
      const cuantas = ahora.puntuaciones.length;
      const seguro = await confirmar({
        titulo: '¿Descartar los filtros?',
        texto: `Se perderán las ${cuantas} notas que has metido.`,
        aceptar: 'Descartar',
        cancelar: 'Seguir puntuando',
      });
      if (!seguro) return;
    }

    ahora = null;
    guardadoComo = null;
    plantilla.aspirantes = [];
    soltarBorrador();
    pintarPreparacion();
    volverAlaRaiz();
  }

  // ── Reordenar, sólo en modo edición ──────────────────────────────────────

  let arrastre = null;

  /** Cuánto hay que acercarse a un borde para que la lista empiece a moverse. */
  const ORILLA = 64;

  /**
   * Los sitios donde puede caer alguien: antes de cada fila y **también** al
   * final de cada grupo.
   *
   * Ese último hace falta porque «el final del grupo 1» y «el principio del
   * grupo 2» son dos sitios distintos aunque estén pegados en pantalla, y sin
   * distinguirlos la raya señalaba uno y se metía en el otro.
   */
  function medirHuecos() {
    const huecos = [];

    for (const grupo of filtros.grupos(ahora)) {
      let ultima = null;

      grupo.miembros.forEach((miembro, j) => {
        const nodo = el.bloques.querySelector(
          `.pista__etiqueta--participante[data-id="${miembro.id}"]`
        );
        if (!nodo) return;

        const caja = nodo.getBoundingClientRect();
        huecos.push({
          grupo: grupo.interno,
          posicion: j,
          y: caja.top,
          id: miembro.id,
          borde: 'arriba',
        });
        ultima = { id: miembro.id, caja };
      });

      if (ultima) {
        huecos.push({
          grupo: grupo.interno,
          posicion: grupo.miembros.length,
          y: ultima.caja.bottom,
          id: ultima.id,
          borde: 'abajo',
        });
      }
    }

    return huecos;
  }

  function empezarArrastre(evento) {
    const agarre = evento.target.closest('.mando__agarre');
    if (!agarre || arrastre || !editando) return;
    evento.preventDefault();

    const etiqueta = agarre.closest('.pista__etiqueta--participante');
    if (!etiqueta) return;

    const id = etiqueta.dataset.id;
    const suyo = filtros.participanteDe(ahora, id);
    const suGrupo = filtros.grupos(ahora).find((g) => g.interno === suyo?.grupo);
    if (!suGrupo) return;

    arrastre = {
      id,
      grupoOriginal: suyo.grupo,
      posicionOriginal: suGrupo.miembros.findIndex((m) => m.id === id),
      huecos: medirHuecos(),
      scroll0: el.desplazable.scrollTop,
      y0: evento.clientY,
      yAhora: evento.clientY,
      elegido: null,
      agarre,
      puntero: evento.pointerId,
      etiqueta,
      fila: el.bloques.querySelector(`.pista__fila--participante[data-id="${id}"]`),
      tic: 0,
    };

    etiqueta.classList.add('participante--arrastrando');
    arrastre.fila?.classList.add('participante--arrastrando');

    agarre.setPointerCapture(evento.pointerId);
    agarre.addEventListener('pointermove', moverArrastre);
    agarre.addEventListener('pointerup', soltarArrastre);
    agarre.addEventListener('pointercancel', soltarArrastre);

    // Un temporizador y no requestAnimationFrame: aquí no hace falta ir al
    // ritmo del repintado, y así el desplazamiento no depende de que el
    // navegador considere la pestaña digna de animar.
    arrastre.tic = setInterval(latido, 16);
    refrescarArrastre();
  }

  function moverArrastre(evento) {
    if (!arrastre) return;
    arrastre.yAhora = evento.clientY;
    refrescarArrastre();
  }

  /** Recoloca lo arrastrado y decide dónde caería si se soltara ahora. */
  function refrescarArrastre() {
    const desplazado = el.desplazable.scrollTop - arrastre.scroll0;
    // Se compensa el desplazamiento para que la fila siga pegada al dedo.
    const recorrido = arrastre.yAhora - arrastre.y0 + desplazado;

    arrastre.etiqueta.style.transform = `translateY(${recorrido}px)`;
    if (arrastre.fila) arrastre.fila.style.transform = `translateY(${recorrido}px)`;

    let elegido = null;
    let masCerca = Infinity;

    for (const hueco of arrastre.huecos) {
      const distancia = Math.abs(hueco.y - desplazado - arrastre.yAhora);
      if (distancia < masCerca) {
        masCerca = distancia;
        elegido = hueco;
      }
    }

    if (elegido !== arrastre.elegido) {
      arrastre.elegido = elegido;
      marcarDestino(elegido);
    }
  }

  /** Un hueco que deja a alguien donde ya estaba no se señala. */
  function esSuSitio(hueco) {
    return (
      hueco.grupo === arrastre.grupoOriginal &&
      (hueco.posicion === arrastre.posicionOriginal ||
        hueco.posicion === arrastre.posicionOriginal + 1)
    );
  }

  function marcarDestino(hueco) {
    for (const nodo of el.bloques.querySelectorAll('.destino-arriba, .destino-abajo')) {
      nodo.classList.remove('destino-arriba', 'destino-abajo');
    }
    if (!hueco || esSuSitio(hueco)) return;

    const clase = hueco.borde === 'arriba' ? 'destino-arriba' : 'destino-abajo';
    for (const nodo of el.bloques.querySelectorAll(`[data-id="${hueco.id}"]`)) {
      nodo.classList.add(clase);
    }
  }

  /**
   * Cerca de un borde, la lista se va moviendo sola mientras se arrastra: sin
   * esto no se puede sacar a nadie de la parte visible con el dedo ocupado.
   * Cuanto más se arrima al borde, más deprisa corre.
   */
  function latido() {
    if (!arrastre) return;

    const caja = el.desplazable.getBoundingClientRect();
    const y = arrastre.yAhora;
    let paso = 0;

    if (y < caja.top + ORILLA) paso = -(caja.top + ORILLA - y) / 5;
    else if (y > caja.bottom - ORILLA) paso = (y - (caja.bottom - ORILLA)) / 5;
    if (!paso) return;

    const antes = el.desplazable.scrollTop;
    el.desplazable.scrollTop += Math.max(-20, Math.min(20, paso));
    if (el.desplazable.scrollTop !== antes) refrescarArrastre();
  }

  function soltarArrastre() {
    if (!arrastre) return;

    const { agarre, puntero, id, elegido, grupoOriginal, posicionOriginal, tic } =
      arrastre;
    clearInterval(tic);
    agarre.releasePointerCapture?.(puntero);
    agarre.removeEventListener('pointermove', moverArrastre);
    agarre.removeEventListener('pointerup', soltarArrastre);
    agarre.removeEventListener('pointercancel', soltarArrastre);

    const mueve = elegido && !esSuSitio(elegido);
    arrastre = null;

    if (mueve) {
      // Si sale de más arriba del mismo grupo, al quitarlo todo sube un puesto.
      const baja =
        elegido.grupo === grupoOriginal && posicionOriginal < elegido.posicion;

      ahora = filtros.moverParticipante(ahora, id, {
        grupo: elegido.grupo,
        hasta: elegido.posicion - (baja ? 1 : 0),
      });
    }

    // Repintar deja las filas limpias de clases y transforms.
    el.bloques.replaceChildren();
    pintar({ seguirElGrupo: false });
  }

  // ── Enlaces ──────────────────────────────────────────────────────────────

  el.form.addEventListener('submit', empezar);

  el.btnAnadirAspirante.addEventListener('click', async () => {
    const nombre = await nombreSuelto();
    if (nombre === null) return;
    plantilla.aspirantes.push({ id: nuevoId(), nombre });
    pintarPreparacion();
  });

  /** Sólo un nombre: para el inicio, donde aún no hay grupos, y para jurados. */
  function nombreSuelto({
    titulo = 'Añadir participante',
    nota = 'Se repartirán en grupos por orden.',
    antes = '',
    marcador = 'Nombre',
  } = {}) {
    return new Promise((resolver) => {
      const focoPrevio = document.activeElement;
      el.aspiranteTitulo.textContent = titulo;
      el.aspiranteFilaGrupo.hidden = true;
      el.aspiranteNota.textContent = nota;
      el.aspiranteAntes.textContent = antes;
      el.aspiranteAntes.hidden = !antes;
      el.aspiranteNombre.placeholder = marcador;

      const cerrar = (respuesta) => {
        el.velo.hidden = true;
        el.pila.inert = false;
        el.aspiranteFilaGrupo.hidden = false;
        el.aspiranteAntes.hidden = true;
        el.aspiranteTitulo.textContent = 'Añadir participante';
        el.aspiranteNombre.placeholder = 'Nombre';
        el.aspiranteAceptar.removeEventListener('click', alAceptar);
        el.aspiranteCancelar.removeEventListener('click', alCancelar);
        el.aspiranteNombre.removeEventListener('keydown', alTeclearNombre);
        document.removeEventListener('keydown', alTeclear);
        focoPrevio?.focus?.();
        resolver(respuesta);
      };

      const alAceptar = () => cerrar(el.aspiranteNombre.value);
      const alCancelar = () => cerrar(null);
      const alTeclear = (evento) => { if (evento.key === 'Escape') cerrar(null); };
      const alTeclearNombre = (evento) => {
        if (evento.key === 'Enter') { evento.preventDefault(); alAceptar(); }
      };

      el.aspiranteAceptar.addEventListener('click', alAceptar);
      el.aspiranteCancelar.addEventListener('click', alCancelar);
      el.aspiranteNombre.addEventListener('keydown', alTeclearNombre);
      document.addEventListener('keydown', alTeclear);

      el.aspiranteNombre.value = '';
      el.pila.inert = true;
      el.velo.hidden = false;
      el.aspiranteNombre.focus();
    });
  }

  el.grupoMenos.addEventListener('click', () => mover('tamanoGrupo', -1, filtros.MIN_TAMANO_GRUPO, filtros.MAX_TAMANO_GRUPO));
  el.grupoMas.addEventListener('click', () => mover('tamanoGrupo', 1, filtros.MIN_TAMANO_GRUPO, filtros.MAX_TAMANO_GRUPO));
  el.interMenos.addEventListener('click', () => mover('intervenciones', -1, filtros.MIN_INTERVENCIONES, filtros.MAX_INTERVENCIONES));
  el.interMas.addEventListener('click', () => mover('intervenciones', 1, filtros.MIN_INTERVENCIONES, filtros.MAX_INTERVENCIONES));
  el.clasificanMenos.addEventListener('click', () => mover('clasifican', -1, filtros.MIN_CLASIFICAN, filtros.MAX_CLASIFICAN));
  el.clasificanMas.addEventListener('click', () => mover('clasifican', 1, filtros.MIN_CLASIFICAN, filtros.MAX_CLASIFICAN));
  el.notaMenos.addEventListener('click', () => mover('notaMaxima', -1, 1, 10));
  el.notaMas.addEventListener('click', () => mover('notaMaxima', 1, 1, 10));

  el.redondeo.addEventListener('click', (evento) => {
    const opcion = evento.target.closest('[data-redondeo]');
    if (!opcion) return;
    plantilla.redondeo = opcion.dataset.redondeo;
    pintarPreparacion();
  });

  el.tecladoRejilla.addEventListener('click', (evento) => {
    const tecla = evento.target.closest('[data-nota]');
    if (tecla) anotar(Number(tecla.dataset.nota));
  });

  el.btnBorrar.addEventListener('click', borrar);
  el.btnCancelar.addEventListener('click', cancelar);
  el.btnTerminar.addEventListener('click', terminar);
  el.btnVolverTabla.addEventListener('click', sacar);

  el.orden.addEventListener('click', (evento) => {
    const opcion = evento.target.closest('[data-orden]');
    if (!opcion) return;
    orden = opcion.dataset.orden;
    pintarTabla();
  });

  el.btnJurado.addEventListener('click', anadirJurado);
  el.btnGuardar.addEventListener('click', guardar);

  el.btnCompartir.addEventListener('click', () => {
    compartir(actaDeLaClasificacion(), {
      imagen: compartirClasificacionImagen,
      texto: compartirClasificacionTexto,
    });
  });

  /** Lo que se comparte: la tabla ya resuelta, con sus colores y su leyenda. */
  function actaDeLaClasificacion() {
    const filas = filtros.clasificacion(ahora, { orden });
    const conTotal = ahora.jurados.length > 1;
    const segunCadaUno = new Map(
      ahora.jurados.map((j) => [j.id, filtros.clasificariaSegun(ahora, j.id)])
    );

    return {
      fecha: new Date().toISOString(),
      clasifican: ahora.clasifican,
      conTotal,
      jurados: ahora.jurados.map((jurado) => ({ id: jurado.id, nombre: jurado.nombre })),
      escala: `Notas de 0 a ${ahora.notaMaxima}. La de cada uno es la media de sus ${ahora.intervenciones} intervenciones, redondeada a ${ahora.redondeo === 'medios' ? 'medios puntos' : 'enteros'}.`,
      colores: [
        { color: 'verde', texto: 'Habría clasificado con ese jurado, y clasifica.' },
        {
          color: 'ambar',
          texto: `Habría clasificado con ese jurado, pero no ${conTotal ? 'en la suma' : 'al final'}.`,
        },
      ],
      filas: filas.map((fila) => {
        const donde = ahora.participantes.findIndex((p) => p.id === fila.participante.id);
        return {
          nombre: comoSeLlama(fila.participante, donde),
          posicion: String(fila.posicion),
          clasifica: fila.clasifica,
          total: filtros.comoSeEscribe(fila.total),
          notas: ahora.jurados.map((jurado) => {
            const nota = filtros.notaDe(ahora, jurado.id, fila.participante.id);
            const habria = segunCadaUno.get(jurado.id).has(fila.participante.id);
            return {
              texto: nota === null ? '—' : filtros.comoSeEscribe(nota),
              verde: habria && fila.clasifica,
              ambar: habria && !fila.clasifica,
            };
          }),
        };
      }),
    };
  }

  el.ctecladoRejilla.addEventListener('click', (evento) => {
    const tecla = evento.target.closest('[data-nota]');
    if (tecla) anotarDeJurado(Number(tecla.dataset.nota));
  });

  el.btnSalir.addEventListener('click', () => {
    apuntando = null;
    pintarTabla();
  });

  // Tocar la casilla de un jurado añadido la pone en cola para corregirla.
  el.tablaCuerpo.addEventListener('click', (evento) => {
    const celda = evento.target.closest('[data-jurado]');
    if (!celda) return;

    const jurado = ahora.jurados.find((j) => j.id === celda.dataset.jurado);
    if (!jurado || jurado.propio) return;

    montarTecladoDeJurado();
    apuntando = { jurado: jurado.id, participante: celda.dataset.participante };
    pintarTabla();
  });
  el.btnAnadir.addEventListener('click', pedirAspirante);
  el.btnEditar.addEventListener('click', () => {
    editando = !editando;
    ahora = filtros.desmarcar(ahora);
    pintar({ seguirElGrupo: false });
  });

  el.marcadores.addEventListener('click', (evento) => {
    const caja = evento.target.closest('[data-id]');
    if (caja && !editando) apuntarA(caja.dataset.id);
  });

  el.bloques.addEventListener('click', (evento) => {
    if (evento.target.closest('.mando__quitar')) {
      quitar(evento.target.closest('[data-id]').dataset.id);
      return;
    }
    if (editando) return;

    const cuadro = evento.target.closest('.voto');
    if (cuadro?.dataset.indice !== undefined) {
      marcarVoto(Number(cuadro.dataset.indice));
      return;
    }

    const fila = evento.target.closest('.pista__fila--participante, .pista__etiqueta--participante');
    if (fila?.dataset.id) apuntarA(fila.dataset.id);
  });

  el.bloques.addEventListener('pointerdown', empezarArrastre);

  pintarPreparacion();

  return {
    abrirGuardados,
    retomarLoQueQuedoAMedias,
    /** Para el aviso del inicio, sin tener que restaurarlos del todo. */
    resumirLoQueQuedoAMedias(datos) {
      const restaurado = filtros.restaurar(datos);
      if (!restaurado || restaurado.puntuaciones.length === 0) return null;

      const cuantos = restaurado.participantes.length;
      const cuantas = restaurado.puntuaciones.length;
      return `Dejaste a medias unos filtros de ${cuantos} participantes, con ${cuantas === 1 ? '1 nota' : `${cuantas} notas`}.`;
    },
  };
}
