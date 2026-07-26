// Panel del Barniz — el paisaje de coherencia (biblia, Anexo I).
// Monitores en vivo de la energía y sus términos, constantes editables,
// encendido/apagado, y el slider de interpolación entre dos barnices.

import { Pane } from 'tweakpane';
import { MotorBarniz, fichaBarnizPorDefecto, mezclarFichas, type FichaBarniz } from '../core/Barniz';
import type { EjeVector } from '../core/VectorEstado';

export class PanelBarniz {
  private pane: Pane;
  private carpetaConstantes: { dispose(): void } | null = null;
  /** Segundo barniz para interpolar; se captura al pulsar "guardar como B". */
  private fichaB: FichaBarniz | null = null;
  private mezcla = { activa: false, t: 0 };
  private fichaBase: FichaBarniz | null = null; // A, antes de mezclar

  constructor(
    private motor: MotorBarniz,
    private armar: () => EjeVector[],
  ) {
    const contenedor = document.createElement('div');
    contenedor.style.cssText =
      'position:fixed;bottom:40px;left:592px;width:300px;max-height:60vh;overflow:auto;z-index:10';
    document.body.appendChild(contenedor);
    this.pane = new Pane({ container: contenedor, title: '◈ Barniz (paisaje)', expanded: false });

    this.pane.addButton({ title: '◈ Armar sobre el salón activo' }).on('click', () => {
      const ejes = this.armar();
      if (!ejes.length) { console.warn('Barniz: no hay direcciones con rango para armar.'); return; }
      this.motor.aplicar(fichaBarnizPorDefecto(ejes));
      this.motor.encender();
    });

    this.motor.onCambio(() => this.reconstruir());
    this.reconstruir();

    // Refresco de monitores a ritmo suave (los valores cambian cada tick lento).
    setInterval(() => { if (this.motor.activo) this.pane.refresh(); }, 200);
  }

  private reconstruir(): void {
    this.carpetaConstantes?.dispose();
    this.carpetaConstantes = null;
    const f = this.motor.ficha;
    if (!f) return;

    const folder = this.pane.addFolder({ title: `◈ ${f.nombre} · ${f.ejes.length} ejes` });
    this.carpetaConstantes = folder;

    folder.addBinding(this.motor, 'activo', { label: 'encendido' }).on('change', (ev: { value: boolean }) => {
      if (ev.value) this.motor.encender(); else this.motor.apagar();
    });

    // — Monitores en vivo —
    const mon = folder.addFolder({ title: 'monitores', expanded: true });
    mon.addBinding(this.motor.monitor, 'E', { label: 'E total', readonly: true, view: 'graph', min: 0, max: 5 });
    mon.addBinding(this.motor.monitor, 'e2', { label: 'E₂ paleta', readonly: true });
    mon.addBinding(this.motor.monitor, 'e3', { label: 'E₃ carga', readonly: true });
    mon.addBinding(this.motor.monitor, 'e4', { label: 'E₄ inercia', readonly: true });
    mon.addBinding(this.motor.monitor, 'temp', { label: 'temperatura', readonly: true, view: 'graph', min: 0, max: 0.1 });
    mon.addBinding(this.motor.monitor, 'correccion', { label: '‖corrección‖', readonly: true });

    // — Las dos perillas que importan (biblia, Anexo I §III y plan F6) —
    const claves = folder.addFolder({ title: 'afinación', expanded: true });
    claves.addBinding(f.k, 'e4', { label: 'k₄ inercia', min: 0, max: 20, step: 0.1 });
    claves.addBinding(f, 'paso', { label: 'paso descenso', min: 0.005, max: 0.2, step: 0.005 });
    claves.addBinding(f, 'presupuesto', { label: 'presupuesto', min: 0.01, max: 0.5, step: 0.01 });
    claves.addBinding(f, 'tempMax', { label: 'temp. máx (clímax)', min: 0, max: 0.2, step: 0.005 });

    // — Identidad cromática —
    const paleta = folder.addFolder({ title: 'paleta (E₂)', expanded: false });
    paleta.addBinding(f.k, 'e2', { label: 'fuerza pozo', min: 0, max: 10, step: 0.1 });
    paleta.addBinding(f.k, 'e2b', { label: 'anti-arcoíris', min: 0, max: 10, step: 0.1 });
    f.anclasTono.forEach((_, i) => {
      paleta.addBinding(f.anclasTono, i as unknown as keyof typeof f.anclasTono, {
        label: `ancla ${i + 1}`, min: 0, max: 1, step: 0.001,
      });
    });

    // — Carga perceptual —
    const carga = folder.addFolder({ title: 'carga (E₃)', expanded: false });
    carga.addBinding(f.k, 'e3', { label: 'fuerza banda', min: 0, max: 6, step: 0.1 });
    carga.addBinding(f, 'bandaCarga', { label: 'banda deseada', min: 0, max: 1, step: 0.01 });

    // — Interpolación entre dos barnices —
    const inter = folder.addFolder({ title: 'transición A↔B', expanded: false });
    inter.addButton({ title: 'fijar barniz actual como B' }).on('click', () => {
      this.fichaB = this.motor.exportar();
      this.fichaBase = this.motor.exportar();
    });
    inter.addBinding(this.mezcla, 't', { label: 'A → B', min: 0, max: 1, step: 0.01 }).on('change', () => {
      if (!this.fichaB || !this.fichaBase) return;
      // El paisaje se deforma; el estado rueda solo hacia el valle nuevo.
      this.motor.aplicar(mezclarFichas(this.fichaBase, this.fichaB, this.mezcla.t));
      this.motor.encender();
    });

    folder.addButton({ title: '✕ Soltar barniz' }).on('click', () => this.motor.apagar());
  }
}
