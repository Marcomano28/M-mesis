// Panel de Moduladores — UI global de LFOs (abajo a la izquierda).
// Al crear un LFO se le ofrecen como destino los parámetros modulables
// del salón activo en ese momento.

import { Pane } from 'tweakpane';
import type { MotorLFO } from '../core/Moduladores';

export interface DestinoModulable {
  etiqueta: string; // "Formas Exóticas · n2"
  dir: string;      // "supershapes.n2"
  min: number;
  max: number;
}

export class PanelModuladores {
  private pane: Pane;

  constructor(
    private motor: MotorLFO,
    private destinos: () => DestinoModulable[],
  ) {
    const contenedor = document.createElement('div');
    contenedor.style.cssText =
      'position:fixed;bottom:40px;left:8px;width:270px;max-height:55vh;overflow:auto;z-index:10';
    document.body.appendChild(contenedor);
    this.pane = new Pane({ container: contenedor, title: '〰 Moduladores', expanded: false });
    this.pane.addButton({ title: '➕ Añadir LFO (al salón activo)' }).on('click', () => this.agregar());
  }

  private agregar(): void {
    const destinos = this.destinos();
    if (!destinos.length) return;
    const primero = destinos[0];
    // Amplitud inicial: 15% del rango del primer destino
    const lfo = this.motor.crear(primero.dir, (primero.max - primero.min) * 0.15);
    const ampMax = Math.max(...destinos.map((d) => (d.max - d.min) / 2));

    const folder = this.pane.addFolder({ title: `LFO — ${lfo.id}` });
    folder.addBinding(lfo, 'activo', { label: 'activo' });
    folder.addBinding(lfo, 'destino', {
      label: 'destino',
      options: Object.fromEntries(destinos.map((d) => [d.etiqueta, d.dir])),
    });
    folder.addBinding(lfo, 'forma', {
      label: 'forma',
      options: { seno: 'seno', triángulo: 'triangulo', sierra: 'sierra', cuadrada: 'cuadrada', ruido: 'ruido' },
    });
    folder.addBinding(lfo, 'frecuencia', { label: 'frecuencia (Hz)', min: 0.01, max: 8, step: 0.01 });
    folder.addBinding(lfo, 'amplitud', { label: 'amplitud', min: 0, max: ampMax, step: 0.001 });
    folder.addBinding(lfo, 'fase', { label: 'fase', min: 0, max: 1, step: 0.01 });
    folder.addButton({ title: '✕ Quitar' }).on('click', () => {
      this.motor.quitar(lfo.id);
      folder.dispose();
    });
  }
}
