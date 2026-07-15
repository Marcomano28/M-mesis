// Panel de Sinestesia — primera UI de la matriz de mapeo.
// MVP: rutas fuente → destino con curva/rango/suavizado.

import { Pane } from 'tweakpane';
import type { MotorSinestesia, FuenteSinestesia, CurvaSinestesia } from '../core/Sinestesia';
import type { DestinoModulable } from './PanelModuladores';

const FUENTES: Record<string, FuenteSinestesia> = {
  'audio nivel': 'audioNivel',
  'audio ataque': 'audioAtaque',
  'MIDI nota': 'midiNota',
  'MIDI velocidad': 'midiVelocidad',
  'MIDI mod wheel': 'midiMod',
  'MIDI pitch bend': 'midiBend',
  'raton X': 'ratonX',
  'raton Y': 'ratonY',
  pulso: 'pulso',
  presion: 'presion',
};

const CURVAS: Record<string, CurvaSinestesia> = {
  lineal: 'lineal',
  suave: 'suave',
  exponencial: 'exponencial',
  log: 'log',
};

export class PanelSinestesia {
  private pane: Pane;
  private carpetas: { dispose(): void }[] = [];

  constructor(
    private motor: MotorSinestesia,
    private destinos: () => DestinoModulable[],
  ) {
    const contenedor = document.createElement('div');
    contenedor.style.cssText =
      'position:fixed;bottom:40px;left:286px;width:300px;max-height:55vh;overflow:auto;z-index:10';
    document.body.appendChild(contenedor);
    this.pane = new Pane({ container: contenedor, title: '◇ Mesa de Sinestesia', expanded: false });
    this.pane.addBinding(this.motor.estado, 'audio', { label: 'audio', readonly: true });
    this.pane.addBinding(this.motor.estado, 'midi', { label: 'MIDI', readonly: true });
    this.pane.addButton({ title: 'Activar micrófono' }).on('click', () => {
      void this.motor.activarAudio()
        .catch((err) => {
          this.motor.estado.audio = 'audio bloqueado';
          console.error('No se pudo activar audio:', err);
        })
        .finally(() => this.pane.refresh());
    });
    this.pane.addButton({ title: 'Activar MIDI' }).on('click', () => {
      void this.motor.activarMIDI()
        .catch((err) => {
          this.motor.estado.midi = 'MIDI bloqueado';
          console.error('No se pudo activar MIDI:', err);
        })
        .finally(() => this.pane.refresh());
    });
    this.pane.addButton({ title: '➕ Añadir ruta (al salón activo)' }).on('click', () => this.agregar());
    this.motor.onCambio(() => this.reconstruirRutas());
    this.reconstruirRutas();
  }

  private agregar(): void {
    const destinos = this.destinos();
    if (!destinos.length) return;
    const primero = destinos[0];
    this.motor.crear(primero.dir, primero.min, primero.max);
  }

  private reconstruirRutas(): void {
    for (const carpeta of this.carpetas) carpeta.dispose();
    this.carpetas = [];
    for (const ruta of this.motor.rutas) {
      const disponibles = this.destinos();
      if (!disponibles.some((d) => d.dir === ruta.destino)) {
        disponibles.push({
          etiqueta: `destino guardado · ${ruta.destino}`,
          dir: ruta.destino,
          min: ruta.min,
          max: ruta.max,
        });
      }
      const actual = disponibles.find((d) => d.dir === ruta.destino) ?? disponibles[0];

      const folder = this.pane.addFolder({ title: `Ruta — ${ruta.id}` });
      this.carpetas.push(folder);
      folder.addBinding(ruta, 'activo', { label: 'activo' });
      folder.addBinding(ruta, 'fuente', { label: 'fuente', options: FUENTES });
      folder.addBinding(ruta, 'destino', {
        label: 'destino',
        options: Object.fromEntries(disponibles.map((d) => [d.etiqueta, d.dir])),
      }).on('change', (ev: { value: string }) => {
        const destino = disponibles.find((d) => d.dir === ev.value);
        if (!destino) return;
        ruta.min = destino.min;
        ruta.max = destino.max;
        folder.refresh();
      });
      folder.addBinding(ruta, 'curva', { label: 'curva', options: CURVAS });
      folder.addBinding(ruta, 'min', { label: 'mín', min: -5000, max: 5000, step: paso(actual) });
      folder.addBinding(ruta, 'max', { label: 'máx', min: -5000, max: 5000, step: paso(actual) });
      folder.addBinding(ruta, 'ataque', { label: 'ataque', min: 0, max: 1, step: 0.01 });
      folder.addBinding(ruta, 'caida', { label: 'caída', min: 0, max: 3, step: 0.01 });
      folder.addBinding(ruta, 'valor', { label: 'valor', min: 0, max: 1, step: 0.001, readonly: true });
      folder.addButton({ title: '✕ Quitar' }).on('click', () => this.motor.quitar(ruta.id));
    }
  }
}

function paso(destino: DestinoModulable): number {
  const rango = destino.max - destino.min;
  return rango > 10 ? 0.1 : 0.001;
}
