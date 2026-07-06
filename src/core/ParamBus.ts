// ParamBus — el sistema nervioso de MIA.
// Las fuentes (sliders, presets, LFOs, y en el Acto II audio/MIDI) ESCRIBEN.
// Los salones LEEN. Nadie se conoce entre sí: solo direcciones tipo "salon.param".
//
// Dos planos:
//   · BASE        — lo que fijan los sliders y las fichas (persiste).
//   · MODULACIÓN  — desplazamientos que fuentes vivas (LFOs, guitarra) SUMAN
//                   a la base al leer. Apagar una fuente devuelve la base intacta.

type Escucha = (valor: number) => void;

export class ParamBus {
  private valores = new Map<string, number>();
  private escuchas = new Map<string, Set<Escucha>>();
  /** dir → (fuenteId → desplazamiento). Varias fuentes se apilan sumando. */
  private modulaciones = new Map<string, Map<string, number>>();
  /** Rangos conocidos (de los ParamDef) para clamp del valor compuesto. */
  private rangos = new Map<string, { min: number; max: number }>();

  set(direccion: string, valor: number): void {
    this.valores.set(direccion, valor);
    this.escuchas.get(direccion)?.forEach((fn) => fn(valor));
  }

  /** Valor BASE (sin modulación) — lo que ven los sliders y las fichas. */
  get(direccion: string, porDefecto = 0): number {
    return this.valores.get(direccion) ?? porDefecto;
  }

  registrarRango(direccion: string, min: number, max: number): void {
    this.rangos.set(direccion, { min, max });
  }

  // ————— Plano de modulación —————

  modular(direccion: string, fuente: string, desplazamiento: number): void {
    if (!this.modulaciones.has(direccion)) this.modulaciones.set(direccion, new Map());
    this.modulaciones.get(direccion)!.set(fuente, desplazamiento);
  }

  quitarModulacion(direccion: string, fuente: string): void {
    this.modulaciones.get(direccion)?.delete(fuente);
  }

  /** Retira una fuente de TODAS las direcciones (al borrar un LFO, p.ej.). */
  limpiarFuente(fuente: string): void {
    for (const mapa of this.modulaciones.values()) mapa.delete(fuente);
  }

  /** Valor final = base + Σ modulaciones, con clamp al rango si se conoce. */
  valorFinal(direccion: string, porDefecto = 0): number {
    let v = this.valores.get(direccion) ?? porDefecto;
    const mods = this.modulaciones.get(direccion);
    if (mods) for (const d of mods.values()) v += d;
    const rango = this.rangos.get(direccion);
    if (rango) v = Math.max(rango.min, Math.min(rango.max, v));
    return v;
  }

  /** Suscripción a cambios de la BASE. Devuelve función para desuscribir. */
  on(direccion: string, fn: Escucha): () => void {
    if (!this.escuchas.has(direccion)) this.escuchas.set(direccion, new Set());
    this.escuchas.get(direccion)!.add(fn);
    return () => this.escuchas.get(direccion)?.delete(fn);
  }

  /** Valores COMPUESTOS de un salón (base + modulación) — lo que consume update(). */
  deSalon(salonId: string): Record<string, number> {
    const out: Record<string, number> = {};
    const prefijo = salonId + '.';
    for (const dir of this.valores.keys()) {
      if (dir.startsWith(prefijo)) out[dir.slice(prefijo.length)] = this.valorFinal(dir);
    }
    return out;
  }

  /** Valores BASE de un salón — lo que se guarda en fichas y presets. */
  baseDeSalon(salonId: string): Record<string, number> {
    const out: Record<string, number> = {};
    const prefijo = salonId + '.';
    for (const [dir, v] of this.valores) {
      if (dir.startsWith(prefijo)) out[dir.slice(prefijo.length)] = v;
    }
    return out;
  }

  /** Serializa el estado BASE de un salón → preset JSON. */
  exportarPreset(salonId: string): string {
    return JSON.stringify({ salon: salonId, version: 1, params: this.baseDeSalon(salonId) }, null, 2);
  }

  importarPreset(json: string): void {
    const p = JSON.parse(json) as { salon: string; params: Record<string, number> };
    for (const [clave, v] of Object.entries(p.params)) this.set(`${p.salon}.${clave}`, v);
  }
}
