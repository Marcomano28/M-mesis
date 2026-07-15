// Barra compacta del reloj de obra. Actualiza sus monitores a 10 Hz para no
// convertir el panel en trabajo por-frame innecesario.

import { Pane } from 'tweakpane';
import type { Transporte } from '../core/Transporte';

export class PanelTransporte {
  private pane: Pane;
  private ultimoRefresco = 0;
  private vista = {
    estado: 'parado',
    tiempo: '00:00.000',
    posicion: 0,
    compas: '1 · 1',
    bpm: 120,
    pulsos: 4,
    duracion: 60,
    bucle: true,
  };

  constructor(private transporte: Transporte) {
    const contenedor = document.createElement('div');
    contenedor.style.cssText =
      'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);width:310px;z-index:25';
    document.body.appendChild(contenedor);
    this.pane = new Pane({ container: contenedor, title: '♫ Transporte', expanded: false });

    this.pane.addBinding(this.vista, 'estado', { label: 'estado', readonly: true });
    this.pane.addBinding(this.vista, 'tiempo', { label: 'tiempo', readonly: true });
    this.pane.addBinding(this.vista, 'compas', { label: 'compás · pulso', readonly: true });
    this.pane.addBinding(this.vista, 'posicion', { label: 'posición (s)', min: 0, max: 3600, step: 0.01 })
      .on('change', (ev: { value: number }) => this.transporte.irA(ev.value));
    this.pane.addBinding(this.vista, 'bpm', { label: 'BPM', min: 20, max: 300, step: 1 })
      .on('change', (ev: { value: number }) => this.transporte.configurar({ bpm: ev.value }));
    this.pane.addBinding(this.vista, 'pulsos', { label: 'pulsos/compás', min: 1, max: 12, step: 1 })
      .on('change', (ev: { value: number }) => this.transporte.configurar({ pulsosPorCompas: ev.value }));
    this.pane.addBinding(this.vista, 'duracion', { label: 'duración (s)', min: 1, max: 3600, step: 1 })
      .on('change', (ev: { value: number }) => this.transporte.configurar({ duracion: ev.value }));
    this.pane.addBinding(this.vista, 'bucle', { label: 'bucle' })
      .on('change', (ev: { value: boolean }) => this.transporte.configurar({ bucle: ev.value }));
    this.pane.addButton({ title: 'Preparar audio' }).on('click', () => {
      void this.transporte.preparar().catch((err) => console.error('No se pudo preparar el transporte:', err));
    });
    this.pane.addButton({ title: '▶ Reproducir' }).on('click', () => {
      void this.transporte.reproducir().catch((err) => console.error('No se pudo iniciar el transporte:', err));
    });
    this.pane.addButton({ title: '■ Detener y volver a cero' }).on('click', () => this.transporte.detener());

    this.transporte.onCambio(() => this.refrescar(true));
    this.refrescar(true);
  }

  actualizar(): void {
    this.refrescar(false);
  }

  private refrescar(forzar: boolean): void {
    const ahora = performance.now();
    if (!forzar && ahora - this.ultimoRefresco < 100) return;
    this.ultimoRefresco = ahora;
    const marco = this.transporte.instantanea();
    const config = this.transporte.configuracion;
    this.vista.estado = marco.estado;
    this.vista.tiempo = formatearTiempo(marco.tiempo);
    this.vista.posicion = marco.tiempo;
    this.vista.compas = `${marco.compas} · ${marco.pulso}`;
    this.vista.bpm = config.bpm;
    this.vista.pulsos = config.pulsosPorCompas;
    this.vista.duracion = config.duracion;
    this.vista.bucle = config.bucle;
    this.pane.refresh();
  }
}

function formatearTiempo(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos - minutos * 60;
  return `${String(minutos).padStart(2, '0')}:${resto.toFixed(3).padStart(6, '0')}`;
}
