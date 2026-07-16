// Galería — el shell: registro de salones, navegación, y depósito de fichas.
// Al cambiar de salón: dispose del anterior, init del nuevo, panel regenerado.

import { Pane } from 'tweakpane';
import {
  catalogoHilosFicha, hilosInicialesFicha, hilosLegadoFicha, materializarHilos,
  type Salon, type HiloModulable, type FichaParaSalon,
} from '../core/Salon';
import type { ParamBus } from '../core/ParamBus';
import type { Engine } from '../core/Engine';
import { AlmacenFichas, type Ficha } from '../core/Fichas';
import { crearPanel } from './Paneles';
import { Cajonera } from './Cajonera';
import { pedirTexto } from './DialogoTexto';
import { copiarGestos, type GestoPersonaje, type MotorGestos } from '../core/Gestos';

interface SesionRetoqueActor {
  actorId: string;
  fichaOriginal: FichaParaSalon;
  alDevolver: (ficha: FichaParaSalon) => void;
}

export class Galeria {
  private activo: Salon | null = null;
  private panel: Pane | null = null;
  private almacen = new AlmacenFichas();
  private cajonera: Cajonera;
  private nombresSalon: Map<string, string>;
  private seleccionHilos = new Map<string, Set<string>>();
  private gestosSalon = new Map<string, GestoPersonaje[]>();
  private escuchasDestinos = new Set<() => void>();
  private selectorPane: Pane | null = null;
  private selectorEstado = { salon: '' };
  private sesionRetoque: SesionRetoqueActor | null = null;

  constructor(
    private salones: Salon[],
    private engine: Engine,
    private bus: ParamBus,
    private motorGestos: MotorGestos,
  ) {
    this.nombresSalon = new Map(salones.map((s) => [s.id, s.nombre]));
    this.cajonera = new Cajonera({
      alCargar: (f) => this.cargarFicha(f),
      alBorrar: (id) => { void this.borrarFicha(id); },
      alEscenario: salones.some((s) => s.recibirFicha)
        ? (f) => {
            this.activar('escenario');
            this.activo?.recibirFicha?.(this.fichaPreparada(f));
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

  /** Abre en su camerino una copia de un actor que mantiene su lugar en escena. */
  iniciarRetoqueActor(
    actorId: string,
    ficha: FichaParaSalon,
    alDevolver: (ficha: FichaParaSalon) => void,
  ): void {
    const salon = this.salones.find((s) => s.id === ficha.salonId && s.id !== 'escenario');
    if (!salon?.hilosFicha) {
      console.error(`No existe un camerino editable para «${ficha.nombre}».`);
      return;
    }
    const hilos = ficha.hilos ?? hilosLegadoFicha(salon);
    this.seleccionHilos.set(salon.id, new Set(hilos.map((hilo) => hilo.clave)));
    this.gestosSalon.set(salon.id, copiarGestos(ficha.gestos));
    for (const [clave, valor] of Object.entries(ficha.params)) {
      this.bus.set(`${salon.id}.${clave}`, valor);
    }
    this.sesionRetoque = { actorId, fichaOriginal: ficha, alDevolver };
    if (this.activo?.id === salon.id) {
      this.panel?.dispose();
      this.reconstruirPanel(salon);
    } else {
      this.activar(salon.id);
    }
    if (ficha.extra !== undefined) salon.cargarEstadoExtra?.(ficha.extra);
    this.emitirCambioDestinos();
  }

  /** Parámetros modulables del salón activo (para los LFOs): solo sliders numéricos. */
  destinosModulables(): HiloModulable[] {
    const salon = this.activo;
    if (!salon) return [];
    const catalogo = catalogoHilosFicha(salon);
    const seleccion = this.obtenerSeleccion(salon);
    const propios = catalogo.length
      ? catalogo
          .filter((hilo) => seleccion.has(hilo.clave) && hilo.clave.startsWith('param.'))
          .map((hilo) => ({
            etiqueta: `${salon.nombre} · ${hilo.etiqueta}`,
            dir: `${salon.id}.${hilo.clave.slice('param.'.length)}`,
            min: hilo.min,
            max: hilo.max,
          }))
      : [...salon.params, ...(salon.pestanas ?? []).flatMap((p) => p.params)]
          .filter((d) => d.tipo !== 'color' && !d.opciones)
          .map((d) => ({ etiqueta: `${salon.nombre} · ${d.etiqueta}`, dir: `${salon.id}.${d.clave}`, min: d.min, max: d.max }));
    return [...propios, ...(salon.hilosModulables?.() ?? [])];
  }

  onCambioDestinos(fn: () => void): () => void {
    this.escuchasDestinos.add(fn);
    return () => this.escuchasDestinos.delete(fn);
  }

  activar(id: string): void {
    if (this.activo?.id === id) {
      this.sincronizarSelector(id);
      return;
    }
    const salon = this.salones.find((s) => s.id === id);
    if (!salon) return;

    try {
      if (this.activo) {
        this.motorGestos.detenerAmbito(this.ambitoSalon(this.activo.id));
        this.activo.dispose(this.engine.escena);
        this.panel?.dispose();
      }
      this.activo = null;
      salon.init(this.engine.escena, this.engine.camara);
      this.reconstruirPanel(salon);
      this.activo = salon;
      this.sincronizarSelector(id);
      this.emitirCambioDestinos();
    } catch (err) {
      console.error(`Fallo al activar el salón «${salon.nombre}»:`, err);
    }
  }

  // ————— Fichas —————

  private async guardarFicha(): Promise<void> {
    const salon = this.activo;
    if (!salon) return;
    const nombre = await pedirTexto(
      salon.id === 'escenario' ? 'Nombre de la puesta en escena' : 'Nombre del personaje',
      salon.nombre,
    );
    if (!nombre) return;
    // Congelar la ficha antes de esperar por la captura GPU. Así la miniatura
    // puede tardar varios frames sin que una edición posterior cambie la
    // partitura, los hilos o los parámetros que el usuario decidió guardar.
    const params = this.bus.baseDeSalon(salon.id);
    const hilos = salon.hilosFicha ? materializarHilos(
      catalogoHilosFicha(salon).filter((hilo) => this.obtenerSeleccion(salon).has(hilo.clave)),
    ) : undefined;
    const extra = salon.estadoExtra?.();
    const gestos = salon.hilosFicha ? copiarGestos(this.obtenerGestos(salon.id)) : undefined;
    const miniatura = await this.engine.capturar();
    const ficha: Ficha = {
      id: crypto.randomUUID(),
      nombre,
      salonId: salon.id,
      params, // la base, sin oscilación de LFOs
      miniatura,
      fecha: Date.now(),
      hilos,
      gestos,
      extra,
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
    if (salon.hilosFicha) {
      const hilos = ficha.hilos ?? hilosLegadoFicha(salon);
      this.seleccionHilos.set(salon.id, new Set(hilos.map((hilo) => hilo.clave)));
      this.gestosSalon.set(salon.id, copiarGestos(ficha.gestos));
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
    this.emitirCambioDestinos();
  }

  private async borrarFicha(id: string): Promise<void> {
    await this.almacen.borrar(id);
    await this.refrescarCajonera();
  }

  private async refrescarCajonera(): Promise<void> {
    this.cajonera.pintar(await this.almacen.listar(), this.nombresSalon);
  }

  private reconstruirPanel(salon: Salon): void {
    const catalogo = catalogoHilosFicha(salon);
    const gestos = this.obtenerGestos(salon.id);
    this.panel = crearPanel(salon, this.bus, {
      alGuardarFicha: () => { void this.guardarFicha(); },
      retoqueActor: this.sesionRetoque?.fichaOriginal.salonId === salon.id ? {
        nombre: this.sesionRetoque.fichaOriginal.nombre,
        alDevolver: () => this.devolverRetoque(salon),
        alCancelar: () => this.cancelarRetoque(),
      } : undefined,
      hilosFicha: catalogo.length ? {
        catalogo,
        seleccion: this.obtenerSeleccion(salon),
        alCambiar: () => this.emitirCambioDestinos(),
      } : undefined,
      ensayo: salon.hilosFicha ? {
        gestos,
        hilos: catalogo.filter((hilo) => hilo.clave.startsWith('param.')),
        alCrear: (gesto) => {
          gestos.push(gesto);
          for (const canal of gesto.canales) this.obtenerSeleccion(salon).add(canal.hilo);
          this.reconstruirPanelDiferido(salon);
        },
        alBorrar: (id) => {
          const i = gestos.findIndex((gesto) => gesto.id === id);
          if (i >= 0) gestos.splice(i, 1);
          this.motorGestos.detenerAmbito(this.ambitoSalon(salon.id));
          this.reconstruirPanelDiferido(salon);
        },
        alProbar: (gesto) => this.motorGestos.reproducir(
          this.ambitoSalon(salon.id),
          gesto,
          (hilo) => hilo.startsWith('param.') ? `${salon.id}.${hilo.slice('param.'.length)}` : null,
        ),
        alDetener: () => this.motorGestos.detenerAmbito(this.ambitoSalon(salon.id)),
      } : undefined,
    });
  }

  private devolverRetoque(salon: Salon): void {
    const sesion = this.sesionRetoque;
    if (!sesion || sesion.fichaOriginal.salonId !== salon.id) return;
    const ficha: FichaParaSalon = {
      salonId: salon.id,
      nombre: sesion.fichaOriginal.nombre,
      params: this.bus.baseDeSalon(salon.id),
      hilos: materializarHilos(
        catalogoHilosFicha(salon).filter((hilo) => this.obtenerSeleccion(salon).has(hilo.clave)),
      ),
      gestos: copiarGestos(this.obtenerGestos(salon.id)),
      extra: salon.estadoExtra?.(),
    };
    try {
      sesion.alDevolver(ficha);
      this.sesionRetoque = null;
      this.activar('escenario');
    } catch (err) {
      console.error(`No se pudo devolver «${ficha.nombre}» al Escenario:`, err);
    }
  }

  private cancelarRetoque(): void {
    if (!this.sesionRetoque) return;
    this.sesionRetoque = null;
    this.activar('escenario');
  }

  private reconstruirPanelDiferido(salon: Salon): void {
    queueMicrotask(() => {
      if (this.activo?.id !== salon.id) return;
      this.panel?.dispose();
      this.reconstruirPanel(salon);
      this.emitirCambioDestinos();
    });
  }

  private obtenerGestos(salonId: string): GestoPersonaje[] {
    let gestos = this.gestosSalon.get(salonId);
    if (!gestos) {
      gestos = [];
      this.gestosSalon.set(salonId, gestos);
    }
    return gestos;
  }

  private ambitoSalon(salonId: string): string {
    return `salon:${salonId}`;
  }

  private obtenerSeleccion(salon: Salon): Set<string> {
    let seleccion = this.seleccionHilos.get(salon.id);
    if (!seleccion && salon.hilosFicha) {
      seleccion = new Set(hilosInicialesFicha(salon).map((hilo) => hilo.clave));
      this.seleccionHilos.set(salon.id, seleccion);
    }
    return seleccion ?? new Set<string>();
  }

  private fichaPreparada(ficha: Ficha): FichaParaSalon {
    if (ficha.hilos) return ficha;
    const salon = this.salones.find((s) => s.id === ficha.salonId);
    return salon?.hilosFicha ? { ...ficha, hilos: hilosLegadoFicha(salon) } : ficha;
  }

  private emitirCambioDestinos(): void {
    for (const fn of this.escuchasDestinos) fn();
  }

  // ————— Selector de salón (arriba a la izquierda) —————

  private crearSelector(): void {
    const contenedor = document.createElement('div');
    contenedor.style.cssText = 'position:fixed;top:8px;left:8px;width:240px;z-index:10';
    document.body.appendChild(contenedor);

    this.selectorPane = new Pane({ container: contenedor, title: 'MIA — Galería' });
    this.selectorEstado.salon = this.salones[0].id;
    this.selectorPane
      .addBinding(this.selectorEstado, 'salon', {
        label: 'salón',
        options: Object.fromEntries(this.salones.map((s) => [s.nombre, s.id])),
      })
      .on('change', (ev: { value: string }) => this.activar(ev.value));
  }

  private sincronizarSelector(id: string): void {
    this.selectorEstado.salon = id;
    this.selectorPane?.refresh();
  }
}
