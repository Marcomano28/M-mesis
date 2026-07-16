// Paneles autogenerados — el salón declara sus ParamDef y el panel aparece solo.
// Los controles NO tocan el salón: escriben en el ParamBus.
// Si el salón declara pestañas, cada una es un modo; la activa llega como `<id>.modo`.

import { Pane } from 'tweakpane';
import type { Salon, ParamDef, HiloFichaDef } from '../core/Salon';
import type { ParamBus } from '../core/ParamBus';
import type { CurvaGesto, FormaGesto, GestoPersonaje } from '../core/Gestos';

export interface PanelExtras {
  alGuardarFicha?: () => void;
  hilosFicha?: {
    catalogo: HiloFichaDef[];
    seleccion: Set<string>;
    alCambiar: () => void;
  };
  ensayo?: {
    gestos: GestoPersonaje[];
    hilos: HiloFichaDef[];
    alCrear: (gesto: GestoPersonaje) => void;
    alBorrar: (id: string) => void;
    alProbar: (gesto: GestoPersonaje) => void;
    alDetener: () => void;
  };
}

export function crearPanel(salon: Salon, bus: ParamBus, extras?: PanelExtras): Pane {
  const pane = new Pane({ title: salon.nombre });

  // Estado local espejo, solo para que Tweakpane tenga algo que enlazar.
  const espejo: Record<string, number> = {};

  const enlazar = (contenedor: { addBinding: Function }, def: ParamDef) => {
    const dir = `${salon.id}.${def.clave}`;
    // Si el bus ya trae un valor (ficha/preset cargado), el panel lo respeta
    const inicial = bus.get(dir, def.valor);
    espejo[def.clave] = inicial;
    bus.set(dir, inicial);
    bus.registrarRango(dir, def.min, def.max); // habilita clamp de modulaciones
    const opts: Record<string, unknown> = { label: def.etiqueta };
    if (def.tipo === 'color') {
      opts.view = 'color'; // hex numérico interpretado como color
    } else if (def.opciones) {
      opts.options = def.opciones; // lista desplegable
    } else {
      opts.min = def.min;
      opts.max = def.max;
      opts.step = def.paso ?? 0.01;
    }
    contenedor
      .addBinding(espejo, def.clave, opts)
      .on('change', (ev: { value: unknown }) => bus.set(dir, ev.value as number));
  };

  // — Parámetros comunes —
  for (const def of salon.params) enlazar(pane, def);

  // — Pestañas (modos del salón) —
  if (salon.pestanas?.length) {
    const dirModo = `${salon.id}.modo`;
    const modoInicial = Math.max(0, Math.min(bus.get(dirModo, 0), salon.pestanas.length - 1));
    bus.set(dirModo, modoInicial);
    const tab = pane.addTab({ pages: salon.pestanas.map((p) => ({ title: p.titulo })) });
    salon.pestanas.forEach((pest, i) => {
      for (const def of pest.params) enlazar(tab.pages[i], def);
    });
    if (modoInicial > 0) tab.pages[modoInicial].selected = true;
    // Tweakpane puede emitir select con índice -1 (p.ej. al destruir el panel): ignorarlo
    tab.on('select', (ev: { index: number }) => {
      if (ev.index >= 0) bus.set(dirModo, ev.index);
    });
  }

  // — Hilos que viajarán con la ficha —
  if (extras?.hilosFicha?.catalogo.length) {
    const { catalogo, seleccion, alCambiar } = extras.hilosFicha;
    const carpeta = pane.addFolder({ title: '🧵 Hilos de la ficha', expanded: false });
    const estado: Record<string, boolean> = {};
    const resumen = { activos: '' };
    const refrescarResumen = () => {
      resumen.activos = `${seleccion.size} de ${catalogo.length}`;
      carpeta.refresh();
      alCambiar();
    };
    carpeta.addBinding(resumen, 'activos', { label: 'seleccionados', readonly: true });
    carpeta.addButton({ title: 'Esenciales' }).on('click', () => {
      seleccion.clear();
      catalogo.forEach((hilo, i) => {
        const activo = hilo.porDefecto === true;
        estado[`h${i}`] = activo;
        if (activo) seleccion.add(hilo.clave);
      });
      refrescarResumen();
    });
    carpeta.addButton({ title: 'Ninguno' }).on('click', () => {
      seleccion.clear();
      catalogo.forEach((_hilo, i) => { estado[`h${i}`] = false; });
      refrescarResumen();
    });

    const titulos = {
      movimiento: 'Movimiento del actor',
      expresion: 'Expresión de la figura',
      material: 'Materia y apariencia',
      aparicion: 'Entrada y salida',
    };
    for (const categoria of ['movimiento', 'expresion', 'material', 'aparicion'] as const) {
      const hilos = catalogo.map((hilo, i) => ({ hilo, i })).filter(({ hilo }) => hilo.categoria === categoria);
      if (!hilos.length) continue;
      const grupo = carpeta.addFolder({ title: titulos[categoria], expanded: false });
      for (const { hilo, i } of hilos) {
        const claveEstado = `h${i}`;
        estado[claveEstado] = seleccion.has(hilo.clave);
        grupo.addBinding(estado, claveEstado, { label: hilo.etiqueta }).on('change', (ev: { value: boolean }) => {
          if (ev.value) seleccion.add(hilo.clave);
          else seleccion.delete(hilo.clave);
          refrescarResumen();
        });
      }
    }
    resumen.activos = `${seleccion.size} de ${catalogo.length}`;
    carpeta.refresh();
  }

  // — Camerino: repertorio corporal propio del personaje —
  if (extras?.ensayo) {
    crearEnsayoPersonaje(pane, salon, bus, extras.ensayo);
  }

  // — Acciones propias del salón (cargar modelos, etc.) —
  for (const accion of salon.acciones ?? []) {
    pane.addButton({ title: accion.titulo }).on('click', accion.fn);
  }

  // — Botones de fábrica —
  if (extras?.alGuardarFicha) {
    pane.addButton({ title: '☆ Guardar ficha' }).on('click', extras.alGuardarFicha);
  }
  pane.addButton({ title: '⎙ Imprimir (exportar código)' }).on('click', () => {
    // Se imprime la BASE (sin la oscilación instantánea de los LFOs)
    descargar(`${salon.id}.html`, salon.exportar(bus.baseDeSalon(salon.id)), 'text/html');
  });
  pane.addButton({ title: '↓ Guardar preset' }).on('click', () => {
    descargar(`${salon.id}.preset.json`, bus.exportarPreset(salon.id), 'application/json');
  });

  return pane;
}

function crearEnsayoPersonaje(
  pane: Pane,
  salon: Salon,
  bus: ParamBus,
  ensayo: NonNullable<PanelExtras['ensayo']>,
): void {
  const carpeta = pane.addFolder({ title: '🎭 Ensayo del personaje', expanded: false });
  if (!ensayo.hilos.length) {
    const aviso = { texto: 'Este salón no tiene hilos internos.' };
    carpeta.addBinding(aviso, 'texto', { label: 'estado', readonly: true });
    return;
  }

  const porClave = new Map(ensayo.hilos.map((hilo) => [hilo.clave, hilo]));
  const hiloInicial = ensayo.hilos[0];
  const posicionBase = (hilo: HiloFichaDef): number => {
    const clave = hilo.clave.slice('param.'.length);
    const valor = bus.get(`${salon.id}.${clave}`, hilo.min);
    return hilo.max === hilo.min ? 0 : limitar((valor - hilo.min) / (hilo.max - hilo.min), 0, 1);
  };
  const borrador: {
    nombre: string;
    hilo: string;
    forma: FormaGesto;
    curva: CurvaGesto;
    duracion: number;
    desde: number;
    hasta: number;
  } = {
    nombre: 'gesto nuevo',
    hilo: hiloInicial.clave,
    forma: 'envolvente',
    curva: 'suave',
    duracion: 2,
    desde: posicionBase(hiloInicial),
    hasta: limitar(posicionBase(hiloInicial) + 0.3, 0, 1),
  };

  carpeta.addBinding(borrador, 'nombre', { label: 'nombre' });
  carpeta.addBinding(borrador, 'hilo', {
    label: 'hilo que mueve',
    options: Object.fromEntries(ensayo.hilos.map((hilo) => [hilo.etiqueta, hilo.clave])),
  }).on('change', (ev: { value: string }) => {
    const hilo = porClave.get(ev.value);
    if (!hilo) return;
    borrador.desde = posicionBase(hilo);
    borrador.hasta = limitar(borrador.desde + 0.3, 0, 1);
    carpeta.refresh();
  });
  carpeta.addBinding(borrador, 'forma', {
    label: 'evolución',
    options: {
      'Lineal (queda en pose)': 'lineal',
      'Ida y regreso': 'envolvente',
      'Bucle': 'loop',
    },
  });
  carpeta.addBinding(borrador, 'curva', {
    label: 'carácter',
    options: { Suave: 'suave', Recto: 'lineal' },
  });
  carpeta.addBinding(borrador, 'duracion', { label: 'duración (s)', min: 0.1, max: 30, step: 0.1 });
  carpeta.addBinding(borrador, 'desde', { label: 'reposo', min: 0, max: 1, step: 0.01 });
  carpeta.addBinding(borrador, 'hasta', { label: 'acción', min: 0, max: 1, step: 0.01 });
  carpeta.addButton({ title: '＋ Guardar gesto' }).on('click', () => {
    const hilo = porClave.get(borrador.hilo);
    if (!hilo) return;
    ensayo.alCrear({
      id: crypto.randomUUID(),
      nombre: borrador.nombre.trim() || 'gesto sin nombre',
      forma: borrador.forma,
      curva: borrador.curva,
      duracion: borrador.duracion,
      canales: [{
        hilo: hilo.clave,
        etiqueta: hilo.etiqueta,
        min: hilo.min,
        max: hilo.max,
        desde: borrador.desde,
        hasta: borrador.hasta,
      }],
    });
  });

  if (ensayo.gestos.length) {
    const repertorio = carpeta.addFolder({ title: `Repertorio (${ensayo.gestos.length})`, expanded: true });
    for (const gesto of ensayo.gestos) {
      const grupo = repertorio.addFolder({ title: gesto.nombre, expanded: false });
      const resumen = {
        descripcion: `${etiquetaForma(gesto.forma)} · ${gesto.duracion.toFixed(1)} s · ${gesto.canales.length} hilo${gesto.canales.length === 1 ? '' : 's'}`,
      };
      grupo.addBinding(resumen, 'descripcion', { label: 'partitura', readonly: true });
      grupo.addButton({ title: '▶ Probar' }).on('click', () => ensayo.alProbar(gesto));
      grupo.addButton({ title: '■ Detener' }).on('click', ensayo.alDetener);
      grupo.addButton({ title: '✕ Borrar gesto' }).on('click', () => ensayo.alBorrar(gesto.id));
    }
  }
}

function etiquetaForma(forma: FormaGesto): string {
  if (forma === 'envolvente') return 'ida y regreso';
  if (forma === 'loop') return 'bucle';
  return 'lineal';
}

function limitar(valor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valor));
}

function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  // Algunos navegadores no alcanzan a consumir la URL si se revoca en la
  // misma pila del click. Montar el enlace y liberarlo en el siguiente turno
  // hace la descarga fiable sin conservar blobs innecesariamente.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
