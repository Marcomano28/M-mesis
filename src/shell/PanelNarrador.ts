// Panel del Narrador — el órgano del tiempo (Etapa 7).
// Captura un repertorio de barnices por rol, ajusta los umbrales, y muestra en
// vivo el estado, las métricas de Frase y la BITÁCORA de decisiones en texto.
// La legibilidad es requisito: cada decisión del Narrador se lee aquí.

import { Pane } from 'tweakpane';
import { MotorNarrador, ROLES, type RolNarrador } from '../core/Narrador';

export class PanelNarrador {
  private pane: Pane;
  private bitacoraEl: HTMLDivElement;

  constructor(private motor: MotorNarrador) {
    const contenedor = document.createElement('div');
    contenedor.style.cssText =
      'position:fixed;bottom:40px;left:898px;width:320px;max-height:64vh;overflow:auto;z-index:10';
    document.body.appendChild(contenedor);
    this.pane = new Pane({ container: contenedor, title: '📖 Narrador (dramaturgia)', expanded: false });

    this.pane.addBinding(this.motor, 'activo', { label: 'dirige' }).on('change', (ev: { value: boolean }) => {
      if (ev.value) this.motor.activar(); else this.motor.desactivar();
    });

    const mon = this.pane.addFolder({ title: 'lo que escucha', expanded: true });
    mon.addBinding(this.motor, 'estado', { label: 'estado', readonly: true });
    mon.addBinding(this.motor.monitor, 'tension', { label: 'tensión', readonly: true, view: 'graph', min: 0, max: 1 });
    mon.addBinding(this.motor.monitor, 'densidad', { label: 'densidad', readonly: true });
    mon.addBinding(this.motor.monitor, 'meseta', { label: 'meseta', readonly: true });
    mon.addBinding(this.motor.monitor, 'sesgo', { label: 'sesgo temp.', readonly: true });

    // Repertorio: capturar el barniz activo como el barniz de cada rol.
    const rep = this.pane.addFolder({ title: 'repertorio de barnices', expanded: true });
    for (const rol of ROLES) {
      rep.addButton({ title: `capturar actual → ${rol}` }).on('click', () => this.motor.capturar(rol));
    }

    const cfg = this.pane.addFolder({ title: 'umbrales', expanded: false });
    cfg.addBinding(this.motor.config, 'umbralConstruccion', { label: 'despierta (tensión)', min: 0, max: 1, step: 0.01 });
    cfg.addBinding(this.motor.config, 'umbralClimax', { label: 'clímax (tensión)', min: 0, max: 1, step: 0.01 });
    cfg.addBinding(this.motor.config, 'umbralMeseta', { label: 'calma (meseta)', min: 0, max: 1, step: 0.01 });
    cfg.addBinding(this.motor.config, 'duracionTransicion', { label: 'fundido (s)', min: 0.5, max: 20, step: 0.5 });
    cfg.addBinding(this.motor.config, 'cooldownIniciativa', { label: 'cooldown (s)', min: 5, max: 120, step: 1 });

    // Bitácora en texto (DOM propio: Tweakpane no tiene un buen visor de log).
    const cab = document.createElement('div');
    cab.textContent = '📜 bitácora';
    cab.style.cssText = 'font:11px ui-monospace,monospace;color:#9fb;opacity:.8;margin:6px 2px 2px';
    contenedor.appendChild(cab);
    this.bitacoraEl = document.createElement('div');
    this.bitacoraEl.style.cssText =
      'font:11px ui-monospace,monospace;color:#cde;line-height:1.5;max-height:22vh;overflow:auto;' +
      'background:rgba(0,0,0,.25);border-radius:6px;padding:6px 8px';
    contenedor.appendChild(this.bitacoraEl);

    this.motor.onCambio(() => { this.pane.refresh(); this.pintarBitacora(); });
    // Refresco periódico de monitores y bitácora (cambian en cada deliberación).
    setInterval(() => { this.pane.refresh(); this.pintarBitacora(); }, 400);
    this.pintarBitacora();
  }

  private pintarBitacora(): void {
    const color: Record<string, string> = { estado: '#8fd', iniciativa: '#fd8', sistema: '#89b' };
    this.bitacoraEl.innerHTML = this.motor.bitacora.slice(0, 24).map((e) => {
      const t = e.tiempo.toFixed(0).padStart(3, ' ');
      return `<div><span style="opacity:.5">${t}s</span> ` +
        `<span style="color:${color[e.tipo]}">${escapar(e.texto)}</span></div>`;
    }).join('') || '<div style="opacity:.5">— sin decisiones aún —</div>';
  }
}

function escapar(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}
