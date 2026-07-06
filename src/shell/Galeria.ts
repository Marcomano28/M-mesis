// Galería — el shell: registro de salones, navegación, y depósito de fichas.
// Al cambiar de salón: dispose del anterior, init del nuevo, panel regenerado.

import { Pane } from 'tweakpane';
import type { Salon } from '../core/Salon';
import type { ParamBus } from '../core/ParamBus';
import type { Engine } from '../core/Engine';
import { AlmacenFichas, type Ficha } from '../core/Fichas';
import { crearPanel } from './Paneles';
import { Cajonera } from './Cajonera';

export class Galeria {
  private activo: Salon | null = null;
  private panel: Pane | null = null;
  private almacen = new AlmacenFichas();
  private cajonera: Cajonera;
  private nombresSalon: Map<string, string>;

  constructor(
    private salones: Salon[],
    private engine: Engine,
    private bus: ParamBus,
  ) {
    this.nombresSalon = new Map(salones.map((s) => [s.id, s.nombre]));
    this.cajonera = new Cajonera({
      alCargar: (f) => this.cargarFicha(f),
      alBorrar: (id) => { void this.borrarFicha(id); },
      alEscenario: salones.some((s) => s.recibirFicha)
        ? (f) => {
            this.activar('escenario');
            this.activo?.recibirFicha?.(f);
          }
        : undefined,
    });
    void this.refrescarCajonera();
    this.crearSelector();
    this.activar(salones[0].id);
  }

  get salonActivo(): Salon | null {
    return this.activo;
  }

  /** Parámetros modulables del salón activo (para los LFOs): solo sliders numéricos. */
  destinosModulables(): { etiqueta: string; dir: string; min: number; max: number }[] {
    const salon = this.activo;
    if (!salon) return [];
    const defs = [...salon.params, ...(salon.pestanas ?? []).flatMap((p) => p.params)];
    return defs
      .filter((d) => d.tipo !== 'color' && !d.opciones)
      .map((d) => ({
        etiqueta: `${salon.nombre} · ${d.etiqueta}`,
        dir: `${salon.id}.${d.clave}`,
        min: d.min,
        max: d.max,
      }));
  }

  activar(id: string): void {
    if (this.activo?.id === id) return;
    const salon = this.salones.find((s) => s.id === id);
    if (!salon) return;

    try {
      if (this.activo) {
        this.activo.dispose(this.engine.escena);
        this.panel?.dispose();
      }
      this.activo = null;
      salon.init(this.engine.escena, this.engine.camara);
      this.reconstruirPanel(salon);
      this.activo = salon;
    } catch (err) {
      console.error(`Fallo al activar el salón «${salon.nombre}»:`, err);
    }
  }

  // ————— Fichas —————

  private async guardarFicha(): Promise<void> {
    const salon = this.activo;
    if (!salon) return;
    const nombre = prompt('Nombre de la ficha:', salon.nombre);
    if (!nombre) return;
    const ficha: Ficha = {
      id: crypto.randomUUID(),
      nombre,
      salonId: salon.id,
      params: this.bus.baseDeSalon(salon.id), // la base, sin oscilación de LFOs
      miniatura: await this.engine.capturar(),
      fecha: Date.now(),
      extra: salon.estadoExtra?.(),
    };
    await this.almacen.guardar(ficha);
    await this.refrescarCajonera();
  }

  private cargarFicha(ficha: Ficha): void {
    const salon = this.salones.find((s) => s.id === ficha.salonId);
    if (!salon) {
      console.error(`La ficha «${ficha.nombre}» pertenece a un salón inexistente (${ficha.salonId}).`);
      return;
    }
    // Volcar los parámetros al bus ANTES de construir el panel, que los respeta
    for (const [clave, valor] of Object.entries(ficha.params)) {
      this.bus.set(`${ficha.salonId}.${clave}`, valor);
    }
    if (this.activo?.id !== ficha.salonId) {
      this.activar(ficha.salonId);
    } else {
      this.panel?.dispose();
      this.reconstruirPanel(salon);
    }
    // Estado extra (p.ej. una escena completa restaura sus actores)
    if (ficha.extra !== undefined) this.activo?.cargarEstadoExtra?.(ficha.extra);
  }

  private async borrarFicha(id: string): Promise<void> {
    await this.almacen.borrar(id);
    await this.refrescarCajonera();
  }

  private async refrescarCajonera(): Promise<void> {
    this.cajonera.pintar(await this.almacen.listar(), this.nombresSalon);
  }

  private reconstruirPanel(salon: Salon): void {
    this.panel = crearPanel(salon, this.bus, {
      alGuardarFicha: () => { void this.guardarFicha(); },
    });
  }

  // ————— Selector de salón (arriba a la izquierda) —————

  private crearSelector(): void {
    const contenedor = document.createElement('div');
    contenedor.style.cssText = 'position:fixed;top:8px;left:8px;width:240px;z-index:10';
    document.body.appendChild(contenedor);

    const pane = new Pane({ container: contenedor, title: 'MIA — Galería' });
    const estado = { salon: this.salones[0].id };
    pane
      .addBinding(estado, 'salon', {
        label: 'salón',
        options: Object.fromEntries(this.salones.map((s) => [s.nombre, s.id])),
      })
      .on('change', (ev: { value: string }) => this.activar(ev.value));
  }
}
