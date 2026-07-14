// Panel de fuentes vivas — LFOs (oscilan) y Acumuladores (recuerdan).
// Ambos escriben en el plano de modulación del bus. Al crear uno, se le
// ofrecen como destino los parámetros modulables del salón activo.

import { Pane } from 'tweakpane';
import type { MotorLFO } from '../core/Moduladores';
import { FUENTE_ACTIVIDAD, type MotorAcumuladores } from '../core/Acumuladores';

export interface DestinoModulable {
  etiqueta: string; // "Formas Exóticas · n2"
  dir: string;      // "supershapes.n2"
  min: number;
  max: number;
}

export class PanelModuladores {
  private pane: Pane;

  constructor(
    private motorLFO: MotorLFO,
    private motorAcum: MotorAcumuladores,
    private destinos: () => DestinoModulable[],
  ) {
    const contenedor = document.createElement('div');
    contenedor.style.cssText =
      'position:fixed;bottom:40px;left:8px;width:280px;max-height:60vh;overflow:auto;z-index:10';
    document.body.appendChild(contenedor);
    this.pane = new Pane({ container: contenedor, title: '〰 Moduladores', expanded: false });
    this.pane.addButton({ title: '➕ LFO (oscila)' }).on('click', () => this.agregarLFO());
    this.pane.addButton({ title: '➕ Acumulador (recuerda)' }).on('click', () => this.agregarAcumulador());
  }

  private opcionesDestino(destinos: DestinoModulable[]): Record<string, string> {
    return Object.fromEntries(destinos.map((d) => [d.etiqueta, d.dir]));
  }

  private agregarLFO(): void {
    const destinos = this.destinos();
    if (!destinos.length) return;
    const primero = destinos[0];
    const lfo = this.motorLFO.crear(primero.dir, (primero.max - primero.min) * 0.15);
    const ampMax = Math.max(...destinos.map((d) => (d.max - d.min) / 2));

    const folder = this.pane.addFolder({ title: `〰 ${lfo.id}` });
    folder.addBinding(lfo, 'activo', { label: 'activo' });
    folder.addBinding(lfo, 'destino', { label: 'destino', options: this.opcionesDestino(destinos) });
    folder.addBinding(lfo, 'forma', {
      label: 'forma',
      options: { seno: 'seno', triángulo: 'triangulo', sierra: 'sierra', cuadrada: 'cuadrada', ruido: 'ruido' },
    });
    folder.addBinding(lfo, 'frecuencia', { label: 'frecuencia (Hz)', min: 0.01, max: 8, step: 0.01 });
    folder.addBinding(lfo, 'amplitud', { label: 'amplitud', min: 0, max: ampMax, step: 0.001 });
    folder.addBinding(lfo, 'fase', { label: 'fase', min: 0, max: 1, step: 0.01 });
    folder.addBinding(lfo, 'rugosidad', {
      label: 'rugosidad H (ruido)', min: 0, max: 1, step: 0.01,
    }); // H=1 deriva montañosa · H=0 temblor de lluvia (fBM, IQ)
    folder.addButton({ title: '✕ Quitar' }).on('click', () => {
      this.motorLFO.quitar(lfo.id);
      folder.dispose();
    });
  }

  private agregarAcumulador(): void {
    const destinos = this.destinos();
    if (!destinos.length) return;
    const primero = destinos[0];
    const acum = this.motorAcum.crear(primero.dir, (primero.max - primero.min) * 0.3);
    const ampMax = Math.max(...destinos.map((d) => d.max - d.min));

    const folder = this.pane.addFolder({ title: `⏳ ${acum.id}` });
    folder.addBinding(acum, 'activo', { label: 'activo' });
    folder.addBinding(acum, 'fuente', {
      label: 'escucha a',
      options: { '— actividad global (sliders/ratón)': FUENTE_ACTIVIDAD, ...this.opcionesDestino(destinos) },
    });
    folder.addBinding(acum, 'proceso', {
      label: 'memoria',
      options: {
        'tensión (acumula y olvida)': 'tension',
        'densidad (eventos/seg)': 'densidad',
        'meseta (crece en la quietud)': 'meseta',
      },
    });
    folder.addBinding(acum, 'fuga', { label: 'fuga/velocidad', min: 0.02, max: 2, step: 0.01 });
    folder.addBinding(acum, 'destino', { label: 'destino', options: this.opcionesDestino(destinos) });
    folder.addBinding(acum, 'amplitud', { label: 'amplitud', min: 0, max: ampMax, step: 0.001 });
    folder.addBinding(acum, 'valor', { label: 'memoria viva', readonly: true, view: 'graph', min: 0, max: 1 });
    folder.addButton({ title: '✕ Quitar' }).on('click', () => {
      this.motorAcum.quitar(acum.id);
      folder.dispose();
    });
  }
}
