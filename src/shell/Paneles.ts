// Paneles autogenerados — el salón declara sus ParamDef y el panel aparece solo.
// Los controles NO tocan el salón: escriben en el ParamBus.
// Si el salón declara pestañas, cada una es un modo; la activa llega como `<id>.modo`.

import { Pane } from 'tweakpane';
import type { Salon, ParamDef } from '../core/Salon';
import type { ParamBus } from '../core/ParamBus';

export interface PanelExtras {
  alGuardarFicha?: () => void;
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
