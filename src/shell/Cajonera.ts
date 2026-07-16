// Cajonera — el depósito de obra: cards con miniatura de las fichas guardadas.
// Clic en una card = recargar esa figura con sus parámetros exactos.

import type { Ficha } from '../core/Fichas';
import { confirmar } from './DialogoTexto';

export interface CajoneraOpciones {
  alCargar: (ficha: Ficha) => void;
  alBorrar: (id: string) => void;
  /** Si existe, cada card muestra ➕ para mandar la ficha al Escenario. */
  alEscenario?: (ficha: Ficha) => void;
}

export class Cajonera {
  private boton: HTMLButtonElement;
  private panel: HTMLDivElement;
  private abierta = false;

  constructor(private opciones: CajoneraOpciones) {
    this.boton = document.createElement('button');
    this.boton.style.cssText =
      'position:fixed;bottom:8px;right:8px;z-index:30;padding:7px 14px;border:none;border-radius:8px;' +
      'background:#2a2a38;color:#d8d4e8;font:12px system-ui;cursor:pointer;opacity:0.9';
    this.boton.onclick = () => this.alternar();
    document.body.appendChild(this.boton);

    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'position:fixed;bottom:44px;right:8px;z-index:30;width:min(560px,90vw);max-height:46vh;overflow:auto;' +
      'display:none;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;padding:10px;' +
      'background:rgba(18,18,26,0.95);border:1px solid #333;border-radius:10px';
    document.body.appendChild(this.panel);

    this.pintar([], new Map());
  }

  private alternar(): void {
    this.abierta = !this.abierta;
    this.panel.style.display = this.abierta ? 'grid' : 'none';
  }

  pintar(fichas: Ficha[], nombresSalon: Map<string, string>): void {
    this.boton.textContent = `🗂 Fichas (${fichas.length})`;
    this.panel.textContent = '';

    if (!fichas.length) {
      const vacio = document.createElement('div');
      vacio.textContent = 'Aún no hay fichas. Encuentra una figura que te guste y pulsa «☆ Guardar ficha».';
      vacio.style.cssText = 'grid-column:1/-1;color:#8a8698;font:12px system-ui;padding:12px';
      this.panel.appendChild(vacio);
      return;
    }

    for (const f of fichas) {
      const card = document.createElement('div');
      card.style.cssText =
        'position:relative;background:#1c1c26;border-radius:8px;overflow:hidden;cursor:pointer;' +
        'border:1px solid #2e2e3c';
      card.title = `Cargar «${f.nombre}»`;

      const img = document.createElement('img');
      img.src = f.miniatura;
      img.style.cssText = 'width:100%;aspect-ratio:4/3;object-fit:cover;display:block';

      const pie = document.createElement('div');
      pie.style.cssText = 'padding:5px 7px;font:11px system-ui;color:#d8d4e8';
      pie.textContent = f.nombre;

      const etiqueta = document.createElement('div');
      etiqueta.style.cssText = 'padding:0 7px 6px;font:10px system-ui;color:#7f7a92';
      const salon = nombresSalon.get(f.salonId) ?? f.salonId;
      const repertorio = f.gestos?.length ? ` · 🎭 ${f.gestos.length}` : '';
      etiqueta.textContent = f.salonId === 'escenario'
        ? salon
        : `${salon} · 🧵 ${f.hilos?.length ?? 'anterior'}${repertorio}`;

      const borrar = document.createElement('button');
      borrar.textContent = '✕';
      borrar.title = 'Borrar ficha';
      borrar.style.cssText =
        'position:absolute;top:4px;right:4px;width:20px;height:20px;border:none;border-radius:5px;' +
        'background:rgba(0,0,0,0.55);color:#ff9a9a;font:11px system-ui;cursor:pointer';
      borrar.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmar('Borrar ficha', `¿Quieres borrar «${f.nombre}»? Esta acción no se puede deshacer.`)) {
          this.opciones.alBorrar(f.id);
        }
      };

      card.onclick = () => this.opciones.alCargar(f);
      card.append(img, pie, etiqueta, borrar);

      if (this.opciones.alEscenario) {
        const sumar = document.createElement('button');
        sumar.textContent = '➕';
        sumar.title = 'Añadir al Escenario';
        sumar.style.cssText =
          'position:absolute;top:4px;left:4px;width:22px;height:22px;border:none;border-radius:5px;' +
          'background:rgba(0,0,0,0.55);color:#9affc0;font:11px system-ui;cursor:pointer';
        sumar.onclick = (e) => {
          e.stopPropagation();
          this.opciones.alEscenario!(f);
        };
        card.appendChild(sumar);
      }
      this.panel.appendChild(card);
    }
  }
}
