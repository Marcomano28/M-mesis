// Panel de la Semilla — la ontogénesis visual (Etapa 3).
// El diafragma de manifestación: etapa actual, apertura, modo auto/manual y los
// ejes que germinan. En auto, el Narrador (si dirige) manda sobre la apertura.

import { Pane } from 'tweakpane';
import { MotorSemilla } from '../core/Semilla';

export class PanelSemilla {
  private pane: Pane;

  constructor(
    private motor: MotorSemilla,
    private ejesDelSalon: () => string[],
  ) {
    const contenedor = document.createElement('div');
    contenedor.style.cssText =
      'position:fixed;bottom:40px;left:1224px;width:280px;max-height:60vh;overflow:auto;z-index:10';
    document.body.appendChild(contenedor);
    this.pane = new Pane({ container: contenedor, title: '🌱 Semilla (manifestación)', expanded: false });

    this.pane.addBinding(this.motor, 'activo', { label: 'activa' }).on('change', (ev: { value: boolean }) => {
      if (ev.value) this.motor.encender(); else this.motor.apagar();
    });

    const mon = this.pane.addFolder({ title: 'germinación', expanded: true });
    mon.addBinding(this.motor, 'etapa', { label: 'etapa', readonly: true });
    mon.addBinding(this.motor, 'apertura', { label: 'apertura', readonly: true, view: 'graph', min: 0, max: 1 });

    this.pane.addBinding(this.motor, 'modo', {
      label: 'modo', options: { 'auto (música/Narrador)': 'auto', 'manual (slider)': 'manual' },
    });
    this.pane.addBinding(this.motor, 'aperturaManual', { label: 'apertura manual', min: 0, max: 1, step: 0.01 });

    const cfg = this.pane.addFolder({ title: 'protocolo', expanded: false });
    cfg.addBinding(this.motor, 'piso', { label: 'piso (colapso)', min: 0, max: 1, step: 0.01 });
    cfg.addBinding(this.motor, 'tasaSubida', { label: 'germina (1/s)', min: 0.02, max: 1, step: 0.01 });
    cfg.addBinding(this.motor, 'tasaBajada', { label: 'repliega (1/s)', min: 0.02, max: 1, step: 0.01 });

    this.pane.addButton({ title: '🌱 Tomar ejes del salón activo' }).on('click', () => {
      const ejes = this.ejesDelSalon();
      this.motor.fijarEjes(ejes);
      if (!ejes.length) console.warn('Semilla: no hay direcciones con rango para manifestar.');
      else this.motor.encender();
    });
    this.pane.addBinding({ n: 0 }, 'n', {
      label: 'ejes', readonly: true, format: () => String(this.motor.ejes.length),
    });

    this.motor.onCambio(() => this.pane.refresh());
    setInterval(() => { if (this.motor.activo) this.pane.refresh(); }, 200);
  }
}
