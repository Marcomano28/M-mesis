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
    return PLANTILLA_CARACOL_VIVO
      .replaceAll('__PARAMS__', JSON.stringify(p))
      .replaceAll('__ESTADO__', JSON.stringify(this.estadoExtra()));
  }
}

// HTML autocontenido (WebGPU + TSL vía CDN): tejido, vestuario y almacén de disfraces
// portados literalmente desde src/core/TejidoCaracol.ts y src/vestuario/*.ts, sin la
// ruta de buffer compartido (pensada para el actor único de esta página). Clic o
// arrastre acaricia el cuerpo, igual que en el camerino.
const PLANTILLA_CARACOL_VIVO = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — caracol vivo</title>
<style>html,body{margin:0;height:100%;background:#0d0d12;overflow:hidden}canvas{display:block;touch-action:none}</style>
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.js",
  "three/webgpu":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.js",
  "three/tsl":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.tsl.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { attribute, uniform, varying, vec2, vec3, vec4, mix, min, max, sin, abs, uv, float, fract, dot, length, clamp, smoothstep, dFdx, dFdy, Fn, If, Loop, Break, bool, texture, mod, sub, fwidth } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const P = __PARAMS__, E = __ESTADO__;

// ————— Tejido (idéntico a src/core/TejidoCaracol.ts) —————
const PASO_TEJIDO = 1 / 120;
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
class TejidoCaracol {
  constructor(columnas = 64, filas = 32, semilla = 1729) {
    this.columnas = columnas; this.filas = filas; this.semilla = semilla;
    const n = columnas * filas;
    this.altura = new Float64Array(n); this.velocidad = new Float64Array(n); this.memoria = new Float64Array(n);
    this.siguiente = new Float64Array(n); this.resto = 0; this.tiempo = 0;
  }
  tocar(u, v, fuerza = 4) {
    if (![u, v, fuerza].every(Number.isFinite)) return;
    u = Math.max(0, Math.min(1, u));
    v = ((v % 1) + 1) % 1;
    fuerza = Math.max(-8, Math.min(8, fuerza));
    for (let x = 0; x < this.columnas; x++) {
      const du = (x / (this.columnas - 1) - u) / 0.038;
      if (Math.abs(du) > 4) continue;
      for (let y = 0; y < this.filas; y++) {
        const d = Math.abs(y / this.filas - v);
        const dv = Math.min(d, 1 - d) / 0.065;
        const i = x * this.filas + y;
        this.velocidad[i] = Math.max(-12, Math.min(12,
          this.velocidad[i] + fuerza * Math.exp(-0.5 * (du * du + dv * dv))));
      }
    }
  }
  avanzar(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.resto += Math.min(dt, 0.1);
    while (this.resto + 1e-10 >= PASO_TEJIDO) {
      this.paso();
      this.resto -= PASO_TEJIDO;
      if (this.resto < 0) this.resto = 0;
    }
  }
  paso() {
    const h = PASO_TEJIDO;
    for (let x = 0; x < this.columnas; x++) {
      for (let y = 0; y < this.filas; y++) {
        const i = x * this.filas + y;
        const a = Math.max(0, x - 1) * this.filas + y;
        const b = Math.min(this.columnas - 1, x + 1) * this.filas + y;
        const c = x * this.filas + (y + this.filas - 1) % this.filas;
        const d = x * this.filas + (y + 1) % this.filas;
        const z = this.altura[i];
        const lap = this.altura[a] + this.altura[b] + this.altura[c] + this.altura[d] - 4 * z;
        const aceleracion = 92 * lap - 2.4 * this.velocidad[i] - 2.8 * z;
        const vel = this.velocidad[i] + h * aceleracion;
        this.siguiente[i] = vel;
      }
    }
    for (let i = 0; i < this.altura.length; i++) {
      this.velocidad[i] = this.siguiente[i];
      this.altura[i] += h * this.velocidad[i];
      this.memoria[i] += h * (Math.abs(this.altura[i]) * 0.85 - this.memoria[i] * 0.13);
    }
    this.tiempo += h;
  }
  muestrear(u, v, memoria = false) {
    const datos = memoria ? this.memoria : this.altura;
    const x = Math.max(0, Math.min(1, u)) * (this.columnas - 1);
    const y = (((v % 1) + 1) % 1) * this.filas;
    const x0 = Math.floor(x), x1 = Math.min(x0 + 1, this.columnas - 1);
    const y0 = Math.floor(y) % this.filas, y1 = (y0 + 1) % this.filas;
    const fx = x - x0, fy = y - Math.floor(y);
    const a = datos[x0 * this.filas + y0] * (1 - fy) + datos[x0 * this.filas + y1] * fy;
    const b = datos[x1 * this.filas + y0] * (1 - fy) + datos[x1 * this.filas + y1] * fy;
    return a * (1 - fx) + b * fx;
  }
  restaurar(e) {
    this.altura.set(e.altura); this.velocidad.set(e.velocidad); this.memoria.set(e.memoria);
    this.tiempo = e.tiempo; this.resto = e.resto;
  }
}

const RECETA_CARACOL = { radio: 14, vueltas: 2, curvaZ: 1.4 };
function posicionCorporal(u, v, desarrollo, excitacion, memoria, out, receta) {
  const largo = suave(0, 0.66, desarrollo);
  const apertura = suave(0.2, 0.92, desarrollo);
  const th = u * receta.vueltas * Math.PI * 2 * largo;
  const ph = (v * 2 - 1) * Math.PI;
  const q = excitacion * 0.32 + memoria * 0.1;
  const r = receta.radio * 0.01;
  const seccion = r * th * apertura * (1 + q * 0.32);
  const angulo = th + q * 0.18 * apertura;
  const distancia = r * th + seccion * Math.cos(ph) + q * apertura * 0.32;
  out.x = distancia * Math.cos(angulo);
  out.y = distancia * Math.sin(angulo);
  out.z = seccion * Math.sin(ph) - Math.pow(Math.max((th + 0.375) * Math.PI, 0.001), receta.curvaZ) * 0.01
    + q * apertura * 0.35;
}

// ————— Vestuario (idéntico a src/vestuario/AlmacenDisfraces.ts) —————
class AlmacenDisfraces {
  constructor() { this.catalogo = new Map(); }
  registrar(definicion) {
    if (this.catalogo.has(definicion.id)) throw new Error('Disfraz duplicado: ' + definicion.id);
    this.catalogo.set(definicion.id, definicion); return this;
  }
  listar() { return [...this.catalogo.values()]; }
  obtener(id) {
    const d = this.catalogo.get(id); if (!d) throw new Error('Disfraz desconocido: ' + id); return d;
  }
}
class Vestuario {
  constructor(almacen, cuerpo) {
    this.almacen = almacen; this.cuerpo = cuerpo;
    this.grupo = new THREE.Group();
    this.activas = new Map();
  }
  compatible(d) { return d.requiere.every(k => this.cuerpo[k] !== undefined); }
  configuracion() {
    return [...this.activas.values()].map(({ capa }) => ({ id: capa.id, intensidad: capa.intensidad, detalle: capa.detalle, ...(capa.parametros ? { parametros: { ...capa.parametros } } : {}) }));
  }
  guardar() {
    return { version: 1, capas: [...this.activas.values()].map(({ capa, prenda }) => ({
      ...capa, ...(capa.parametros ? { parametros: { ...capa.parametros } } : {}), estado: prenda.guardar?.(),
    })) };
  }
  parametros(id, valores) {
    const controles = this.almacen.obtener(id).controles ?? [];
    if (valores !== undefined && (!valores || typeof valores !== 'object' || Array.isArray(valores))) throw new Error('Parámetros de prenda inválidos');
    for (const clave of Object.keys(valores ?? {})) if (!controles.some(c => c.clave === clave)) throw new Error('Control desconocido: ' + clave);
    if (!controles.length) return undefined;
    const salida = {};
    for (const c of controles) {
      const n = valores?.[c.clave] ?? c.valor;
      if (!Number.isFinite(n) || n < c.min || n > c.max || (c.opciones && !c.opciones.some(o => o.valor === n))) throw new Error('Control fuera de rango: ' + c.clave);
      salida[c.clave] = n;
    }
    return salida;
  }
  restaurar(traje) {
    if (!traje || traje.version !== 1 || !Array.isArray(traje.capas)) throw new Error('Traje incompatible');
    const ids = new Set();
    for (const c of traje.capas) {
      if (!c || ids.has(c.id) || ![c.intensidad, c.detalle].every(n => Number.isFinite(n) && n >= 0 && n <= 1))
        throw new Error('Capa inválida');
      ids.add(c.id);
      this.parametros(c.id, c.parametros);
      if (!this.compatible(this.almacen.obtener(c.id))) throw new Error('El cuerpo no admite ' + c.id);
    }
    const nuevas = new Map();
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
  configurar(id, intensidad, detalle, valores) {
    const actual = this.activas.get(id);
    detalle ??= actual?.capa.detalle ?? this.almacen.obtener(id).detalleInicial ?? 0.65;
    const parametros = this.parametros(id, { ...actual?.capa.parametros, ...valores });
    if (![intensidad, detalle].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('Control fuera de rango');
    if (actual) { actual.capa.intensidad = intensidad; actual.capa.detalle = detalle; if (parametros) actual.capa.parametros = parametros; }
    else {
      const def = this.almacen.obtener(id);
      if (!this.compatible(def)) throw new Error('El cuerpo no admite ' + id);
      const prenda = def.crear(this.cuerpo);
      this.activas.set(id, { capa: { id, intensidad, detalle, ...(parametros ? { parametros } : {}) }, prenda }); this.grupo.add(prenda.objeto);
    }
    this.actualizar();
  }
  quitar(id) {
    const c = this.activas.get(id); if (!c) return;
    c.prenda.objeto.removeFromParent(); c.prenda.dispose(); this.activas.delete(id);
  }
  actualizar(dt = 0, diagnostico = false) {
    for (const { capa, prenda } of this.activas.values()) prenda.actualizar(capa, Math.max(0, Math.min(dt, 0.05)), diagnostico);
  }
  dispose() { for (const id of [...this.activas.keys()]) this.quitar(id); this.grupo.removeFromParent(); }
}

// ————— Disfraces base (idéntico a src/vestuario/disfraces.ts, sin la ruta compartida GPU) —————
const muestraCorporal = () => ({ posicion: new THREE.Vector3(), normal: new THREE.Vector3(), tangente: new THREE.Vector3(), excitacion: 0, memoria: 0 });
function azar(i, semilla) {
  let x = Math.imul(i + 1, 374761393) ^ semilla;
  x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const cobre = new THREE.Color('#ac6754'), nacarColor = new THREE.Color('#f1d4a8'), jade = new THREE.Color('#71cbbf');
function tono(m, color) {
  return color.copy(nacarColor).lerp(jade, Math.min(0.85, Math.max(0, m.excitacion + m.memoria * 2)));
}
function crearSuperficie(cuerpo, alambre) {
  const origen = cuerpo.malla;
  const posicionAttr = origen.getAttribute('position'), normalAttr = origen.getAttribute('normal'), uvAttr = origen.getAttribute('uv');
  if (!posicionAttr || !normalAttr || !uvAttr || posicionAttr.count !== normalAttr.count || posicionAttr.count !== uvAttr.count)
    throw new Error('La superficie requiere position, normal y uv compatibles');
  const geometria = origen.clone();
  const colores = new Float32Array(posicionAttr.count * 3);
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  const material = new THREE.MeshPhysicalNodeMaterial({ vertexColors: true, side: THREE.DoubleSide,
    wireframe: alambre, roughness: 0.46, metalness: 0.38, clearcoat: 0.65, transparent: true });
  const objeto = new THREE.Mesh(geometria, material);
  objeto.frustumCulled = false;
  const m = muestraCorporal(), color = new THREE.Color();
  return { objeto, actualizar(c) {
    material.opacity = c.intensidad; material.depthWrite = c.intensidad > 0.98;
    material.roughness = 0.15 + c.detalle * 0.7;
    objeto.visible = cuerpo.desarrollo > 0.22 && c.intensidad > 0;
    if (!objeto.visible) return;
    for (const nombre of ['position', 'normal']) {
      const fuente = origen.getAttribute(nombre), destino = geometria.getAttribute(nombre);
      destino.array.set(fuente.array); destino.needsUpdate = true;
    }
    for (let i = 0; i < posicionAttr.count; i++) {
      const u = uvAttr.getX(i), v = uvAttr.getY(i);
      cuerpo.muestrear(u, v, m);
      tono(m, color);
      if (!alambre) color.lerp(cobre, (0.4 + 0.3 * Math.sin(u * Math.PI * 44 + v * 7)) * c.detalle);
      color.toArray(colores, i * 3);
    }
    geometria.getAttribute('color').needsUpdate = true;
  }, dispose() { geometria.dispose(); material.dispose(); } };
}
function crearFibras(cuerpo, modo) {
  const n = modo === 'punteado' ? 2048 : 1000, tramos = modo === 'peludo' ? 4 : 1;
  const esLinea = modo === 'peludo' || modo === 'corriente';
  const posiciones = new Float32Array(n * (esLinea ? tramos * 2 : 1) * 3);
  const colores = new Float32Array(posiciones.length);
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3).setUsage(THREE.DynamicDrawUsage));
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3).setUsage(THREE.DynamicDrawUsage));
  const material = esLinea
    ? new THREE.LineBasicNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false })
    : new THREE.PointsNodeMaterial({ vertexColors: true, size: 0.035, sizeAttenuation: true, transparent: true, depthWrite: false });
  const objeto = esLinea ? new THREE.LineSegments(geometria, material) : new THREE.Points(geometria, material);
  objeto.frustumCulled = false;
  const uvArr = new Float64Array(n * 2);
  const variaciones = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    variaciones[i] = azar(i * 3 + 2, cuerpo.semilla);
    uvArr[i * 2] = modo === 'punteado' ? (Math.floor(i / 16) + 0.5) / 128 : 0.025 + azar(i * 3, cuerpo.semilla) * 0.95;
    uvArr[i * 2 + 1] = modo === 'punteado' ? (i % 16) / 16 : azar(i * 3 + 1, cuerpo.semilla);
  }
  const m = muestraCorporal(), otra = muestraCorporal(), velocidad = new THREE.Vector2(), color = new THREE.Color();
  const muestrear = modo === 'peludo' ? cuerpo.muestrear : (cuerpo.muestrearPosicion ?? cuerpo.muestrear);
  return { objeto, actualizar(c, dt) {
    const madurez = Math.max(0, Math.min(1, (cuerpo.desarrollo - 0.35) / 0.65));
    objeto.visible = cuerpo.desarrollo > 0.001 && c.intensidad > 0;
    material.opacity = c.intensidad;
    if (material instanceof THREE.PointsNodeMaterial) material.size = 0.012 + c.detalle * 0.065;
    for (let i = 0; i < n; i++) {
      if (modo === 'corriente' && dt > 0) {
        cuerpo.flujo(uvArr[i * 2], uvArr[i * 2 + 1], velocidad);
        uvArr[i * 2] = ((uvArr[i * 2] + velocidad.x * dt * (0.1 + c.detalle * 2)) % 1 + 1) % 1;
        uvArr[i * 2 + 1] = ((uvArr[i * 2 + 1] + velocidad.y * dt * (0.1 + c.detalle * 2)) % 1 + 1) % 1;
      }
      if (!objeto.visible) continue;
      const u = uvArr[i * 2], v = uvArr[i * 2 + 1]; muestrear(u, v, m);
      tono(m, color);
      if (!esLinea) { m.posicion.toArray(posiciones, i * 3); color.toArray(colores, i * 3); continue; }
      const largo = madurez * (0.035 + c.detalle * (0.08 + variaciones[i] * 0.3) + Math.abs(m.excitacion) * 0.45 + m.memoria * 0.2);
      if (modo === 'corriente') {
        cuerpo.flujo(u, v, velocidad);
        muestrear(Math.max(0, Math.min(1, u - velocidad.x * 0.12)), v - velocidad.y * 0.12, otra);
        color.multiplyScalar(Math.min(1, u * 30, (1 - u) * 30));
      }
      for (let s = 0; s < tramos; s++) for (let e = 0; e < 2; e++) {
        const t = (s + e) / tramos, j = (i * tramos * 2 + s * 2 + e) * 3;
        if (modo === 'corriente') (e ? otra.posicion : m.posicion).toArray(posiciones, j);
        else {
          posiciones[j] = m.posicion.x + m.normal.x * largo * t + m.tangente.x * m.excitacion * 0.28 * t * t;
          posiciones[j + 1] = m.posicion.y + m.normal.y * largo * t + m.tangente.y * m.excitacion * 0.28 * t * t;
          posiciones[j + 2] = m.posicion.z + m.normal.z * largo * t + m.tangente.z * m.excitacion * 0.28 * t * t;
        }
        color.toArray(colores, j);
      }
    }
    if (!objeto.visible) return;
    geometria.getAttribute('position').needsUpdate = true; geometria.getAttribute('color').needsUpdate = true;
    geometria.computeBoundingSphere();
  }, ...(modo === 'corriente' ? {
    guardar: () => Array.from(uvArr),
    restaurar(estado) {
      if (!Array.isArray(estado) || estado.length !== uvArr.length || !estado.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Corriente incompatible');
      uvArr.set(estado);
    },
  } : {}), dispose() { geometria.dispose(); material.dispose(); } };
}

// ————— Girih · Moro (idéntico a src/vestuario/Girih.ts) —————
function motivoHankin(angulo, delta, salida = new Float64Array(32)) {
  const theta = angulo * Math.PI / 180, separacion = delta / 100;
  const largo = (0.5 + separacion) * Math.sin(Math.PI / 4) / Math.sin(Math.PI - theta - Math.PI / 4);
  const cs = Math.cos(theta) * largo, sn = Math.sin(theta) * largo;
  for (let lado = 0; lado < 4; lado++) for (let rayo = 0; rayo < 2; rayo++) {
    let ax = 0.5 + (rayo === 0 ? separacion : -separacion), ay = 0;
    let bx = ax + (rayo === 0 ? -cs : cs), by = sn;
    for (let giro = 0; giro < lado; giro++) { const x = ax; ax = 1 - ay; ay = x; const y = bx; bx = 1 - by; by = y; }
    const i = (lado * 2 + rayo) * 4; salida[i] = ax; salida[i + 1] = ay; salida[i + 2] = bx; salida[i + 3] = by;
  }
  return salida;
}
function crearGirih(cuerpo) {
  const geometria = cuerpo.malla;
  const position = geometria?.getAttribute('position'), coords = geometria?.getAttribute('uv');
  if (!position || !coords || coords.itemSize !== 2 || coords.count !== position.count) throw new Error('Girih requiere malla con UV compatibles');
  const reticula = uniform(new THREE.Vector2(50, 18)), grosor = uniform(2), presencia = uniform(1);
  const segmentos = Array.from({ length: 8 }, () => uniform(new THREE.Vector4()));
  const pGlobal = uv().mul(reticula), p = fract(pGlobal);
  const dx = dFdx(pGlobal), dy = dFdy(pGlobal);
  let distancia = min(float(1e6), float(1e6));
  for (const segmento of segmentos) {
    const a = segmento.xy, ab = segmento.zw.sub(a), ap = p.sub(a);
    const t = clamp(dot(ap, ab).div(max(dot(ab, ab), 1e-12))), residuo = ap.sub(ab.mul(t));
    const d = length(residuo), normal = residuo.div(max(d, 1e-8));
    const pixel = max(length(vec2(dot(dx, normal), dot(dy, normal))), 1e-6);
    distancia = min(distancia, d.div(pixel));
  }
  const cobertura = float(1).sub(smoothstep(grosor.mul(0.5).sub(0.5), grosor.mul(0.5).add(0.5), distancia));
  const material = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('rgb(248,158,79)'), transparent: true,
    depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, alphaTest: 0.001 });
  material.opacityNode = cobertura.mul(presencia);
  const objeto = new THREE.Mesh(geometria, material); objeto.renderOrder = 1;
  objeto.frustumCulled = !!cuerpo.atributoEstado;
  const patron = new Float64Array(32); let anteriorAngulo = NaN, anteriorDelta = NaN;
  return { objeto, actualizar(c) {
    const angulo = c.parametros?.angulo ?? 75, delta = c.parametros?.delta ?? 10;
    reticula.value.set(Math.round(c.parametros?.longitudinal ?? 50), Math.round(c.parametros?.transversal ?? 18));
    grosor.value = 0.5 + c.detalle * 2.5; presencia.value = c.intensidad;
    objeto.visible = cuerpo.desarrollo > 0.001 && c.intensidad > 0;
    if (angulo !== anteriorAngulo || delta !== anteriorDelta) {
      motivoHankin(angulo, delta, patron);
      for (let i = 0; i < 8; i++) segmentos[i].value.fromArray(patron, i * 4);
      anteriorAngulo = angulo; anteriorDelta = delta;
    }
  }, dispose() { material.dispose(); } };
}
const disfrazGirih = {
  id: 'girih', nombre: 'Girih · Moro',
  descripcion: 'Trama Hankin regular, construida en cada celda y adherida a la piel. Ángulo y separación transforman el motivo; puede combinarse con Nácar.',
  control: 'Grosor del trazo', detalleInicial: 0.6,
  controles: [
    { clave: 'angulo', nombre: 'Ángulo (grados)', min: 0, max: 90, paso: 1, valor: 75 },
    { clave: 'delta', nombre: 'Separación · delta', min: 0, max: 25, paso: 0.5, valor: 10 },
    { clave: 'longitudinal', nombre: 'Celdas longitudinales', min: 8, max: 100, paso: 1, valor: 50 },
    { clave: 'transversal', nombre: 'Celdas transversales', min: 4, max: 48, paso: 1, valor: 18 },
    { clave: 'cerrar', nombre: 'Contorno anterior', min: 0, max: 1, paso: 1, valor: 0, oculto: true },
  ],
  requiere: ['malla'], crear: crearGirih,
};

// ————— Girih II · Trenzado (idéntico a src/vestuario/Girih2.ts + TexturaGirih2.ts) —————
let recursoGirih2, usuariosGirih2 = 0;
function adquirirTexturaGirih2() {
  if (!recursoGirih2) {
    const n = 512, datos = new Uint8Array(n * n * 4);
    const colores = [[209, 161, 90], [240, 195, 116], [95, 224, 214], [138, 106, 58], [201, 106, 78]];
    const fondo = [[23, 19, 16], [58, 44, 24], [11, 9, 8]];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const t = (x + y + 1) / (2 * n), tramo = t < 0.55 ? 0 : 1, f = tramo === 0 ? t / 0.55 : (t - 0.55) / 0.45;
      const i = (y * n + x) * 4;
      for (let k = 0; k < 3; k++) datos[i + k] = Math.round(fondo[tramo][k] * (1 - f) + fondo[tramo + 1][k] * f);
      datos[i + 3] = 255;
    }
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let j = 0; j < 46; j++) {
      const cx = rnd() * n, cy = rnd() * n, r = 16 + rnd() * 68, alpha = 0.45 + rnd() * 0.35, c = colores[j % colores.length];
      for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(n, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(n, Math.ceil(cx + r)); x++) {
          const a = Math.max(0, 1 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r) * alpha, i = (y * n + x) * 4;
          for (let k = 0; k < 3; k++) datos[i + k] = Math.round(datos[i + k] * (1 - a) + c[k] * a);
        }
    }
    recursoGirih2 = new THREE.DataTexture(datos, n, n, THREE.RGBAFormat);
    recursoGirih2.wrapS = recursoGirih2.wrapT = THREE.RepeatWrapping;
    recursoGirih2.magFilter = THREE.LinearFilter; recursoGirih2.minFilter = THREE.LinearMipmapLinearFilter;
    recursoGirih2.generateMipmaps = true; recursoGirih2.flipY = true; recursoGirih2.needsUpdate = true;
  }
  usuariosGirih2++; const textura = recursoGirih2; let liberada = false;
  return { textura, liberar() { if (liberada) return; liberada = true; if (--usuariosGirih2 === 0) { textura.dispose(); recursoGirih2 = undefined; } } };
}
function crearGirih2(cuerpo) {
  const geometria = cuerpo.malla, p = geometria?.getAttribute('position'), coord = geometria?.getAttribute('uv');
  if (!p || !coord || coord.itemSize !== 2 || coord.count !== p.count) throw new Error('Girih II requiere malla con UV compatibles');
  const fondo = adquirirTexturaGirih2();
  const zoom = uniform(3.5), k = uniform(1), punto = uniform(new THREE.Vector2(0.309, 0.951));
  const colorFondo = uniform(0.2);
  const grosor = uniform(0.05), drift = uniform(0), plegado = uniform(1), repeticion = uniform(1), bordes = uniform(1);
  const invertir = uniform(0), swapX = uniform(0), swapY = uniform(0);
  const color = Fn(() => {
    const original = uv().mul(2).sub(1).mul(zoom);
    const px = max(fwidth(length(original)), 1e-5);
    const z = original.toVar(), paridad = float(0).toVar();
    If(repeticion.greaterThan(0.5), () => { z.assign(mod(z.add(1), 2).sub(1)); });
    If(plegado.greaterThan(0.5), () => {
      Loop(100, () => {
        const cambio = bool(false).toVar();
        If(z.y.lessThan(0), () => { z.y.assign(z.y.negate()); cambio.assign(bool(true)); });
        const d = k.sub(z.x).sub(k.mul(z.y)).toVar();
        If(d.lessThan(0), () => { z.addAssign(vec2(1, k).mul(d.mul(2).div(k.mul(k).add(1)))); cambio.assign(bool(true)); });
        If(z.x.lessThan(0), () => { z.x.assign(z.x.negate()); cambio.assign(bool(true)); });
        If(cambio.not(), () => { Break(); });
        paridad.assign(float(1).sub(paridad));
      });
    });
    If(invertir.greaterThan(0.5), () => { paridad.assign(float(1).sub(paridad)); });
    const col = texture(fondo.textura, z.add(vec2(drift, drift.mul(0.618)))).rgb.pow(2.2).toVar();
    col.assign(mix(vec3(0.018, 0.023, 0.02), col, colorFondo));
    If(bordes.greaterThan(0.5), () => {
      const d = min(abs(k.mul(z.y)), min(abs(k.sub(z.x).sub(k.mul(z.y))), abs(z.x)));
      col.assign(mix(vec3(0.5), col, smoothstep(0, px, d)));
    });
    const ancho = grosor.mul(float(1).add(length(texture(fondo.textura, z).rgb).mul(0.1)));
    const pa = vec2(punto.x, punto.y.negate());
    const pb = punto.add(vec2(1, k).mul(k.sub(punto.x).sub(k.mul(punto.y)).mul(2).div(k.mul(k).add(1))));
    const q = vec2(0), s = vec2(k.mul(0.618), 0.382);
    const distancia = (a, b) => {
      const ba = sub(b, a), v = z.sub(a), t = clamp(dot(v, ba).div(max(dot(ba, ba), 1e-12)));
      return length(v.sub(ba.mul(t)));
    };
    const d = vec4(distancia(pa, q), distancia(punto, q),
      distancia(pb, s), distancia(punto, s)).toVar();
    If(swapX.greaterThan(0.5), () => { d.assign(d.yxzw); });
    If(swapY.greaterThan(0.5), () => { d.assign(d.xywz); });
    If(paridad.greaterThan(0.5), () => { d.assign(d.wzyx); });
    for (const distancia2 of [d.x, d.y, d.z, d.w]) {
      col.assign(mix(vec3(0.01), col, smoothstep(0, px, distancia2.sub(ancho))));
      col.assign(mix(vec3(1), col, smoothstep(0, px, abs(distancia2.sub(ancho)))));
    }
    return col;
  })();
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, forceSinglePass: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  material.colorNode = color;
  const objeto = new THREE.Mesh(geometria, material); objeto.renderOrder = 1; objeto.frustumCulled = !!cuerpo.atributoEstado;
  return { objeto, actualizar(c) {
    const a = c.parametros ?? {};
    colorFondo.value = a.colorFondo ?? 0.2;
    zoom.value = a.zoom ?? 3.5; k.value = (a.grupo ?? 0) >= 0.5 ? Math.sqrt(3) : 1;
    punto.value.set(a.puntoX ?? 0.309, a.puntoY ?? 0.951); grosor.value = 0.01 + c.detalle * 0.14; drift.value = a.desplazamiento ?? 0;
    plegado.value = a.plegado ?? 1; repeticion.value = a.repeticion ?? 1; bordes.value = a.bordes ?? 1;
    invertir.value = a.invertir ?? 0; swapX.value = a.cruceX ?? 0; swapY.value = a.cruceY ?? 0;
    material.opacity = c.intensidad; material.depthWrite = c.intensidad > 0.98;
    objeto.visible = cuerpo.desarrollo > 0.001 && c.intensidad > 0;
  }, dispose() { material.dispose(); fondo.liberar(); } };
}
const siNo = [{ nombre: 'No', valor: 0 }, { nombre: 'Sí', valor: 1 }];
const disfrazGirih2 = {
  id: 'girih2', nombre: 'Girih II · Trenzado',
  descripcion: 'Cintas entrelazadas y fondo de manchas: simetría cuadrada o hexagonal, con cruces alternados. Viste la piel completa.',
  control: 'Grosor del hilo', detalleInicial: 2 / 7, requiere: ['malla'], crear: crearGirih2,
  controles: [
    { clave: 'grupo', nombre: 'Simetría', min: 0, max: 1, paso: 1, valor: 0, opciones: [{ nombre: 'Cuadrada · 2,4,4', valor: 0 }, { nombre: 'Hexagonal · 2,3,6', valor: 1 }] },
    { clave: 'puntoX', nombre: 'Origen del trenzado · X', min: -2, max: 2, paso: 0.001, valor: 0.309 },
    { clave: 'puntoY', nombre: 'Origen del trenzado · Y', min: -2, max: 2, paso: 0.001, valor: 0.951 },
    { clave: 'zoom', nombre: 'Escala del patrón', min: 0.25, max: 32, paso: 0.05, valor: 3.5 },
    { clave: 'colorFondo', nombre: 'Color del fondo', min: 0, max: 1, paso: 0.01, valor: 0.2 },
    { clave: 'desplazamiento', nombre: 'Desplazamiento de textura', min: -3, max: 3, paso: 0.01, valor: 0 },
    ...[{ clave: 'bordes', nombre: 'Bordes de celda', valor: 1 }, { clave: 'invertir', nombre: 'Invertir el tejido', valor: 0 },
      { clave: 'cruceX', nombre: 'Intercambiar primer par', valor: 0 }, { clave: 'cruceY', nombre: 'Intercambiar segundo par', valor: 0 },
      { clave: 'plegado', nombre: 'Plegado', valor: 1 }, { clave: 'repeticion', nombre: 'Repetición', valor: 1 }]
      .map(c => ({ ...c, min: 0, max: 1, paso: 1, opciones: siNo })),
  ],
};

const almacenDisfraces = new AlmacenDisfraces()
  .registrar({ id: 'nacar', nombre: 'Nácar', descripcion: 'Piel continua con vetas que revelan la huella del contacto.', control: 'Veta y rugosidad', requiere: ['malla', 'muestrear'], crear: c => crearSuperficie(c, false) })
  .registrar({ id: 'alambre', nombre: 'Alambre', descripcion: 'La trama de triángulos acompaña cada pliegue del cuerpo.', control: 'Rugosidad', requiere: ['malla', 'muestrear'], crear: c => crearSuperficie(c, true) });
for (const [id, nombre, descripcion, control] of [
  ['puntos', 'Polvo de puntos', 'Partículas ancladas a la piel conservan su lugar durante el crecimiento.', 'Tamaño'],
  ['punteado', 'Líneas de puntos', 'Hileras recorren las coordenadas del cuerpo y se abren con él.', 'Tamaño'],
  ['peludo', 'Peludo', 'Fibras nacen de la superficie y se curvan con la excitación local.', 'Longitud'],
  ['corriente', 'Corriente', 'Trazadores viajan por un campo corporal sensible a la memoria.', 'Velocidad'],
]) almacenDisfraces.registrar({ id, nombre, descripcion, control,
  requiere: id === 'corriente' ? ['muestrear', 'flujo'] : ['muestrear'], crear: c => crearFibras(c, id) });
almacenDisfraces.registrar(disfrazGirih);
almacenDisfraces.registrar(disfrazGirih2);

// ————— Cuerpo del Caracol (equivalente estático a CaracolVivo, sin edición de resolución en vivo) —————
const nx = Math.round(Math.max(8, Math.min(256, P.resolucionU ?? 128)));
const ny = Math.round(Math.max(4, Math.min(128, P.resolucionV ?? 64)));
function prepararGeometria(nx, ny) {
  const cantidad = (nx + 1) * (ny + 1);
  const posArr = new Float32Array(cantidad * 3);
  const uvArr = new Float32Array(cantidad * 2), indices = [];
  for (let x = 0; x <= nx; x++) for (let y = 0; y <= ny; y++) {
    const i = x * (ny + 1) + y;
    uvArr[i * 2] = x / nx; uvArr[i * 2 + 1] = y / ny;
    if (x < nx && y < ny) { const j = i + ny + 1; indices.push(i, j, i + 1, i + 1, j, j + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(posArr.length), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  geo.setIndex(indices);
  return geo;
}
const geometria = prepararGeometria(nx, ny);
const receta = { radio: P.radio ?? 14, vueltas: P.vueltas ?? 2, curvaZ: P.curvaZ ?? 1.4 };
const desarrollo = Math.max(0, Math.min(1, P.desarrollo ?? 1));

const tejido = new TejidoCaracol(E.tejido.columnas, E.tejido.filas, E.tejido.semilla);
tejido.restaurar(E.tejido);

const pTmp = new THREE.Vector3(), aTmp = new THREE.Vector3(), bTmp = new THREE.Vector3();
function posicion(u, v, out) {
  posicionCorporal(u, v, desarrollo, tejido.muestrear(u, v), tejido.muestrear(u, v, true), out, receta);
  return out;
}
function muestrearCuerpo(u, v, salida) {
  posicion(u, v, salida.posicion);
  const paso = u > 0.999 ? -0.001 : 0.001;
  posicion(u + paso, v, aTmp).sub(salida.posicion).multiplyScalar(1 / paso);
  posicion(u, v + 0.001, bTmp).sub(salida.posicion);
  salida.normal.crossVectors(aTmp, bTmp).normalize();
  salida.tangente.copy(aTmp).normalize();
  salida.excitacion = tejido.muestrear(u, v);
  salida.memoria = tejido.muestrear(u, v, true);
}

const germen = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicNodeMaterial({ color: '#ffddad' }));
germen.position.z = -Math.pow(0.375 * Math.PI, 1.4) * 0.01;
const geoCurva = new THREE.BufferGeometry();
geoCurva.setAttribute('position', new THREE.BufferAttribute(new Float32Array((nx + 1) * 3), 3));
const curva = new THREE.Line(geoCurva, new THREE.LineBasicNodeMaterial({ color: '#f1d4a8' }));

function actualizarGeometria() {
  const pos = geometria.getAttribute('position');
  const curvaPos = curva.geometry.getAttribute('position');
  for (let x = 0; x <= nx; x++) {
    posicion(x / nx, 0.5, pTmp); curvaPos.setXYZ(x, pTmp.x, pTmp.y, pTmp.z);
    for (let y = 0; y <= ny; y++) {
      const u = x / nx, v = y / ny, i = x * (ny + 1) + y;
      posicion(u, v, pTmp);
      pos.setXYZ(i, pTmp.x, pTmp.y, pTmp.z);
    }
  }
  pos.needsUpdate = true; curvaPos.needsUpdate = true;
  geometria.computeVertexNormals(); geometria.computeBoundingSphere();
  germen.visible = desarrollo < 0.2; curva.visible = desarrollo < 0.23;
}
actualizarGeometria();

const cuerpo = {
  semilla: tejido.semilla,
  desarrollo,
  malla: geometria,
  muestrear: muestrearCuerpo,
  muestrearPosicion(u, v, salida) {
    salida.excitacion = tejido.muestrear(u, v);
    salida.memoria = tejido.muestrear(u, v, true);
    posicionCorporal(u, v, desarrollo, salida.excitacion, salida.memoria, salida.posicion, receta);
  },
  flujo(u, v, salida) {
    salida.set(0.025 + 0.015 * Math.sin(v * Math.PI * 2), 0.08 + tejido.muestrear(u, v) * 0.3 + tejido.muestrear(u, v, true) * 0.2);
  },
};

const vestuario = new Vestuario(almacenDisfraces, cuerpo);
const superficieRaycast = new THREE.Mesh(geometria, new THREE.MeshBasicNodeMaterial({ visible: false }));
const cuerpoGrupo = new THREE.Group();
cuerpoGrupo.add(superficieRaycast, germen, curva, vestuario.grupo);
cuerpoGrupo.rotation.set(Math.PI * 0.1, -Math.PI * 0.16, 0);
for (const o of cuerpoGrupo.children) o.frustumCulled = false;
cuerpoGrupo.visible = desarrollo > 0.0001;

vestuario.restaurar(E.vestuario);

// ————— Escena —————
const raiz = new THREE.Group();
raiz.add(cuerpoGrupo);
raiz.add(new THREE.HemisphereLight('#f5ead4', '#214339', 2));
const luz = new THREE.DirectionalLight('#ffe1c2', 3); luz.position.set(2, 4, 5); raiz.add(luz);
raiz.scale.setScalar(P.escala ?? 0.45);
const escena = new THREE.Scene();
escena.add(raiz);
const camara = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camara.position.set(0, 0, 6);

const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true;

const ray = new THREE.Raycaster(), xy = new THREE.Vector2();
function tocarPuntero(ev) {
  if (ev.button !== undefined && ev.button !== 0) return;
  const r = renderer.domElement.getBoundingClientRect();
  xy.set((ev.clientX - r.left) / r.width * 2 - 1, 1 - (ev.clientY - r.top) / r.height * 2);
  raiz.updateMatrixWorld(true); camara.updateMatrixWorld(true); ray.setFromCamera(xy, camara);
  const hit = ray.intersectObject(superficieRaycast)[0];
  if (hit?.uv) tejido.tocar(hit.uv.x, hit.uv.y, 4);
}
renderer.domElement.addEventListener('pointerdown', tocarPuntero);

const estimulo = P.estimulo ?? 0, regionU = P.regionU ?? 0.77, regionV = P.regionV ?? 0.3;
const reloj = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.max(0, Math.min(reloj.getDelta(), 0.05));
  if (dt > 0 && estimulo !== 0) tejido.tocar(regionU, regionV, estimulo * dt * 12);
  tejido.avanzar(dt);
  actualizarGeometria();
  vestuario.actualizar(dt, false);
  controles.update();
  renderer.render(escena, camara);
});
addEventListener('resize', () => {
  camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
</script></body></html>
`;
