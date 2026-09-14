import * as THREE from 'three/webgpu';
import type { Salon, Params, ParamDef, HiloFichaDef } from '../../core/Salon';
import { CaracolVivo } from './CaracolVivo';
import { TejidoCaracol, type EstadoTejido } from '../../core/TejidoCaracol';
import { Vestuario, type Traje } from '../../vestuario/AlmacenDisfraces';
import { crearPanelVestuario } from '../../vestuario/PanelVestuario';

export interface EstadoCaracolSalon {
  version: 1;
  tipo: 'caracol-vivo';
  tejido: EstadoTejido;
  vestuario: Traje;
}

/** Camerino normal y fábrica escénica del mismo cuerpo utilizado por el ensayo. */
export class CaracolSalon implements Salon {
  id = 'caracol';
  nombre = 'Caracol vivo · Camerino';
  conservarEstadoVivo = true;
  params: ParamDef[] = [
    { clave: 'desarrollo', etiqueta: 'desarrollo', valor: 1, min: 0, max: 1 },
    { clave: 'estimulo', etiqueta: 'estímulo local', valor: 0, min: -1, max: 1 },
    { clave: 'regionU', etiqueta: 'estímulo · lugar longitudinal', valor: 0.77, min: 0, max: 1 },
    { clave: 'regionV', etiqueta: 'estímulo · lugar en contorno', valor: 0.3, min: 0, max: 1 },
    { clave: 'resolucionU', etiqueta: 'resolución · longitud', valor: 128, min: 8, max: 256, paso: 1 },
    { clave: 'resolucionV', etiqueta: 'resolución · contorno', valor: 64, min: 4, max: 128, paso: 1 },
    { clave: 'radio', etiqueta: 'radio', valor: 14, min: 4, max: 40 },
    { clave: 'vueltas', etiqueta: 'vueltas', valor: 2, min: 0.5, max: 5 },
    { clave: 'curvaZ', etiqueta: 'curva Z', valor: 1.4, min: 0.5, max: 2.5 },
    { clave: 'escala', etiqueta: 'escala de presentación', valor: 0.45, min: 0.2, max: 3 },
  ];
  hilosFicha: HiloFichaDef[] = [
    { clave: 'param.desarrollo', etiqueta: 'desarrollo corporal', categoria: 'aparicion', min: 0, max: 1, velocidad: 'frase', coste: 'medio', afinidades: ['energia'], porDefecto: true },
    { clave: 'param.estimulo', etiqueta: 'excitación de una región', categoria: 'expresion', min: -1, max: 1, velocidad: 'gesto', coste: 'medio', afinidades: ['ataque', 'energia'], porDefecto: true },
    { clave: 'param.regionU', etiqueta: 'lugar del estímulo · longitud', categoria: 'expresion', min: 0, max: 1, velocidad: 'gesto', coste: 'barato', afinidades: ['altura'] },
    { clave: 'param.regionV', etiqueta: 'lugar del estímulo · contorno', categoria: 'expresion', min: 0, max: 1, velocidad: 'gesto', coste: 'barato', afinidades: ['textura'] },
  ];
  acciones = [
    { titulo: '♧ Almacén de disfraces', fn: () => this.abrirVestuario() },
    { titulo: 'Tocar la región elegida', fn: () => this.actor?.tejido.tocar(this.regionU, this.regionV, 5) },
    { titulo: 'Limpiar memoria corporal', fn: () => { this.actor?.tejido.reiniciar(); this.actor?.actualizar(); } },
  ];
  private actor: CaracolVivo | null = null;
  private estado: EstadoCaracolSalon | null = null;
  private panel: ReturnType<typeof crearPanelVestuario> | null = null;
  private readonly raiz = new THREE.Group();
  private regionU = 0.77;
  private regionV = 0.3;
  private quitarPuntero?: () => void;

  constructor(extra?: unknown) { if (extra !== undefined) this.cargarEstadoExtra(extra); }

  init(escena: THREE.Scene, camara: THREE.PerspectiveCamera): void {
    this.actor = new CaracolVivo();
    if (this.estado) this.aplicarEstado(this.estado);
    this.raiz.add(this.actor.grupo);
    // Luces locales a la instancia: se retiran junto con ella.
    this.raiz.add(new THREE.HemisphereLight('#f5ead4', '#214339', 2));
    const luz = new THREE.DirectionalLight('#ffe1c2', 3); luz.position.set(2, 4, 5); this.raiz.add(luz);
    escena.add(this.raiz);
    // Los actores del Escenario reciben un Group; solo el camerino escucha el lienzo.
    if (escena.isScene && typeof document !== 'undefined') {
      const canvas = document.querySelector<HTMLCanvasElement>('#lienzo canvas');
      if (canvas) {
        const ray = new THREE.Raycaster(), xy = new THREE.Vector2();
        const tocar = (ev: PointerEvent) => {
          if (!this.actor || ev.button !== 0) return;
          const r = canvas.getBoundingClientRect();
          xy.set((ev.clientX - r.left) / r.width * 2 - 1, 1 - (ev.clientY - r.top) / r.height * 2);
          this.raiz.updateMatrixWorld(true); camara.updateMatrixWorld(true); ray.setFromCamera(xy, camara);
          const hit = ray.intersectObject(this.actor.superficie)[0];
          if (hit?.uv) this.actor.tejido.tocar(hit.uv.x, hit.uv.y, 4);
        };
        canvas.addEventListener('pointerdown', tocar);
        this.quitarPuntero = () => canvas.removeEventListener('pointerdown', tocar);
      }
    }
  }

  update(dt: number, _tiempo: number, p: Params): void {
    if (!this.actor) return;
    const acotar = (clave: string) => {
      const d = this.params.find(d => d.clave === clave)!;
      return Math.max(d.min, Math.min(d.max, Number.isFinite(p[clave]) ? p[clave] : d.valor));
    };
    this.actor.desarrollo = acotar('desarrollo');
    this.actor.receta.radio = acotar('radio'); this.actor.receta.vueltas = acotar('vueltas'); this.actor.receta.curvaZ = acotar('curvaZ');
    this.actor.configurarResolucion(acotar('resolucionU'), acotar('resolucionV'));
    this.raiz.scale.setScalar(acotar('escala'));
    this.regionU = acotar('regionU'); this.regionV = acotar('regionV');
    const paso = Math.max(0, Math.min(dt, 0.05));
    const fuerza = acotar('estimulo');
    if (paso > 0 && fuerza !== 0) this.actor.tejido.tocar(this.regionU, this.regionV, fuerza * paso * 12);
    this.actor.tejido.avanzar(paso); this.actor.actualizar(paso);
  }

  private abrirVestuario(): void {
    if (!this.actor) return;
    this.panel ??= crearPanelVestuario(this.actor.vestuario, () => this.actor?.actualizar());
    this.panel.abrir();
  }

  estadoExtra(): EstadoCaracolSalon | undefined {
    if (this.actor) return { version: 1, tipo: 'caracol-vivo', tejido: this.actor.tejido.guardar(), vestuario: this.actor.vestuario.guardar() };
    return this.estado ? structuredClone(this.estado) : undefined;
  }

  cargarEstadoExtra(extra: unknown): void {
    if (extra === undefined) {
      const nuevo = new CaracolVivo();
      try { this.estado = { version: 1, tipo: 'caracol-vivo', tejido: nuevo.tejido.guardar(), vestuario: nuevo.vestuario.guardar() }; }
      finally { nuevo.dispose(); }
    } else {
      const e = extra as EstadoCaracolSalon;
      if (!e || e.version !== 1 || e.tipo !== 'caracol-vivo') throw new Error('Ficha de Caracol incompatible');
      // Validación aislada: un documento inválido no modifica la instancia activa.
      const tejido = new TejidoCaracol(); tejido.restaurar(e.tejido);
      const prueba = new CaracolVivo();
      const ropa = new Vestuario(prueba.vestuario.almacen, prueba.cuerpo);
      try { ropa.restaurar(e.vestuario); } finally { ropa.dispose(); prueba.dispose(); }
      this.estado = structuredClone(e);
    }
    if (this.actor && this.estado) this.aplicarEstado(this.estado);
    this.panel?.dispose(); this.panel = null;
  }
  private aplicarEstado(e: EstadoCaracolSalon): void {
    this.actor!.vestuario.restaurar(e.vestuario); this.actor!.tejido.restaurar(e.tejido); this.actor!.actualizar();
  }
  dispose(escena: THREE.Scene): void {
    this.estado = this.estadoExtra() ?? null;
    this.quitarPuntero?.(); this.quitarPuntero = undefined;
    this.panel?.dispose(); this.panel = null;
    this.actor?.dispose(); this.actor = null;
    this.raiz.clear(); escena.remove(this.raiz);
  }
  exportar(p: Params): string {
    return `// Módulo para ejecutar dentro del proyecto MIA.\nimport { CaracolSalon } from '/src/salones/supershapes/CaracolSalon.ts';\nconst salon = new CaracolSalon(${JSON.stringify(this.estadoExtra())});\nconst params = ${JSON.stringify(p)};\n// Conecta al Engine de MIA:\n// salon.init(engine.escena, engine.camara);\n// engine.arrancar((dt, t) => salon.update(dt, t, params));\nexport { salon, params };`;
  }
}
