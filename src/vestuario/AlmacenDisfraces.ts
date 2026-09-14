import * as THREE from 'three/webgpu';

/** Coordenadas materiales: siguen al cuerpo durante su desarrollo. */
export interface MuestraCorporal {
  posicion: THREE.Vector3; normal: THREE.Vector3; tangente: THREE.Vector3;
  excitacion: number; memoria: number;
}
export interface CuerpoVestible {
  readonly semilla: number;
  readonly desarrollo: number;
  readonly malla?: THREE.BufferGeometry;
  /** Opcionales. Se conserva el muestreo completo como fallback para adaptadores anteriores. */
  readonly revision?: number;
  /** Atributo vec2 (excitación, memoria), alineado con los vértices de malla; propiedad corporal. */
  readonly atributoEstado?: string;
  muestrearEstado?: (u: number, v: number, salida: Pick<MuestraCorporal, 'excitacion' | 'memoria'>) => void;
  muestrearPosicion?: (u: number, v: number, salida: MuestraCorporal) => void;
  muestrear?: (u: number, v: number, salida: MuestraCorporal) => void;
  /** Velocidad en coordenadas materiales por segundo. v es periódica; u pertenece a [0,1]. */
  flujo?: (u: number, v: number, salida: THREE.Vector2) => void;
}
export interface Capa { id: string; intensidad: number; detalle: number; estado?: number[]; parametros?: Record<string, number> }
export interface Traje { version: 1; capas: Capa[] }
export interface ControlPrenda { clave: string; nombre: string; min: number; max: number; paso: number; valor: number; oculto?: boolean; opciones?: readonly { nombre: string; valor: number }[] }
export interface Disfraz {
  id: string; nombre: string; descripcion: string; control: string;
  detalleInicial?: number;
  controles?: readonly ControlPrenda[];
  requiere: Array<'malla' | 'muestrear' | 'flujo'>;
  crear: (cuerpo: CuerpoVestible) => Prenda;
}
export interface Prenda {
  objeto: THREE.Object3D;
  actualizar(capa: Capa, dt: number, diagnostico: boolean): void;
  guardar?(): number[];
  restaurar?(estado: number[]): void;
  dispose(): void;
}

/** Catálogo de fábricas compartido; cada actor posee sus propios recursos y estado. */
export class AlmacenDisfraces {
  private readonly catalogo = new Map<string, Disfraz>();
  registrar(definicion: Disfraz): this {
    if (this.catalogo.has(definicion.id)) throw new Error(`Disfraz duplicado: ${definicion.id}`);
    this.catalogo.set(definicion.id, definicion); return this;
  }
  listar(): Disfraz[] { return [...this.catalogo.values()]; }
  obtener(id: string): Disfraz {
    const d = this.catalogo.get(id); if (!d) throw new Error(`Disfraz desconocido: ${id}`); return d;
  }
}

export class Vestuario {
  readonly grupo = new THREE.Group();
  private activas = new Map<string, { capa: Capa; prenda: Prenda }>();
  constructor(readonly almacen: AlmacenDisfraces, readonly cuerpo: CuerpoVestible) {}
  compatible(d: Disfraz): boolean { return d.requiere.every(k => this.cuerpo[k] !== undefined); }
  /** Solo controles: no serializa partículas ni historia. Copias para edición segura. */
  configuracion(): Omit<Capa, 'estado'>[] {
    return [...this.activas.values()].map(({ capa }) => ({ id: capa.id, intensidad: capa.intensidad, detalle: capa.detalle, ...(capa.parametros ? { parametros: { ...capa.parametros } } : {}) }));
  }
  guardar(): Traje {
    return { version: 1, capas: [...this.activas.values()].map(({ capa, prenda }) => ({
      ...capa, ...(capa.parametros ? { parametros: { ...capa.parametros } } : {}), estado: prenda.guardar?.(),
    })) };
  }
  private parametros(id: string, valores?: Record<string, number>): Record<string, number> | undefined {
    const controles = this.almacen.obtener(id).controles ?? [];
    if (valores !== undefined && (!valores || typeof valores !== 'object' || Array.isArray(valores))) throw new Error('Parámetros de prenda inválidos');
    for (const clave of Object.keys(valores ?? {})) if (!controles.some(c => c.clave === clave)) throw new Error(`Control desconocido: ${clave}`);
    if (!controles.length) return undefined;
    const salida: Record<string, number> = {};
    for (const c of controles) {
      const n = valores?.[c.clave] ?? c.valor;
      if (!Number.isFinite(n) || n < c.min || n > c.max || (c.opciones && !c.opciones.some(o => o.valor === n))) throw new Error(`Control fuera de rango: ${c.clave}`);
      salida[c.clave] = n;
    }
    return salida;
  }
  /** Valida y construye antes de sustituir: un traje inválido conserva el actual. */
  restaurar(traje: Traje): void {
    if (!traje || traje.version !== 1 || !Array.isArray(traje.capas)) throw new Error('Traje incompatible');
    const ids = new Set<string>();
    for (const c of traje.capas) {
      if (!c || ids.has(c.id) || ![c.intensidad, c.detalle].every(n => Number.isFinite(n) && n >= 0 && n <= 1))
        throw new Error('Capa inválida');
      ids.add(c.id);
      this.parametros(c.id, c.parametros);
      if (!this.compatible(this.almacen.obtener(c.id))) throw new Error(`El cuerpo no admite ${c.id}`);
    }
    const nuevas: typeof this.activas = new Map();
    try {
      for (const c of traje.capas) {
        const prenda = this.almacen.obtener(c.id).crear(this.cuerpo);
        nuevas.set(c.id, { capa: { id: c.id, intensidad: c.intensidad, detalle: c.detalle, ...(this.parametros(c.id, c.parametros) ? { parametros: this.parametros(c.id, c.parametros) } : {}) }, prenda });
        if (c.estado !== undefined) {
          if (!prenda.restaurar) throw new Error('Esta prenda no admite estado');
          prenda.restaurar(c.estado);
        }
      }
    } catch (error) { for (const { prenda } of nuevas.values()) prenda.dispose(); throw error; }
    for (const { prenda } of this.activas.values()) { prenda.objeto.removeFromParent(); prenda.dispose(); }
    this.activas = nuevas;
    for (const { prenda } of nuevas.values()) this.grupo.add(prenda.objeto);
    this.actualizar();
  }
  configurar(id: string, intensidad: number, detalle?: number, valores?: Record<string, number>): void {
    const actual = this.activas.get(id);
    detalle ??= actual?.capa.detalle ?? this.almacen.obtener(id).detalleInicial ?? 0.65;
    const parametros = this.parametros(id, { ...actual?.capa.parametros, ...valores });
    if (![intensidad, detalle].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('Control fuera de rango');
    if (actual) { actual.capa.intensidad = intensidad; actual.capa.detalle = detalle; if (parametros) actual.capa.parametros = parametros; }
    else {
      const def = this.almacen.obtener(id);
      if (!this.compatible(def)) throw new Error(`El cuerpo no admite ${id}`);
      const prenda = def.crear(this.cuerpo);
      this.activas.set(id, { capa: { id, intensidad, detalle, ...(parametros ? { parametros } : {}) }, prenda }); this.grupo.add(prenda.objeto);
    }
    this.actualizar();
  }
  quitar(id: string): void {
    const c = this.activas.get(id); if (!c) return;
    c.prenda.objeto.removeFromParent(); c.prenda.dispose(); this.activas.delete(id);
  }
  actualizar(dt = 0, diagnostico = false): void {
    for (const { capa, prenda } of this.activas.values()) prenda.actualizar(capa, Math.max(0, Math.min(dt, 0.05)), diagnostico);
  }
  dispose(): void { for (const id of [...this.activas.keys()]) this.quitar(id); this.grupo.removeFromParent(); }
}
