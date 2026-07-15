// Salón — Bajo Relieve: el modelo llega aplanado (casi 2D) y la estela del
// puntero lo revela, extruyendo el relieve a su paso mientras el color
// atraviesa 6 niveles de textura y una paleta cosenoidal (IQ palette).
//
// Portado del proyecto immersive (ssam + WebGPU) a la arquitectura MIA.
// Dos pestañas: Relieve (textura + paleta) y Wireframe (malla desnuda,
// coloreada por la propia extrusión).

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, varying, texture, uv, vec2, vec3, vec4, float,
  mix, smoothstep, cos, positionLocal, positionWorld,
  cameraProjectionMatrix, modelViewMatrix,
} from 'three/tsl';
import { crearLoaderGLB, elegirYCargarGLB } from '../../core/CargadorGLB';
import { Estela } from './Estela';
import type { Salon, Params, ParamDef, Pestana, Accion, HiloFichaDef } from '../../core/Salon';

const MODELO_DEFECTO = '/relieve.glb'; // vive en public/

/** El binario viaja en la ficha, igual que en Trazo y Grafito. */
interface ModeloGuardado {
  tipo: 'mia-glb';
  version: 1;
  nombre: string;
  datos: ArrayBuffer;
}

function modeloDesdeExtra(extra: unknown): ModeloGuardado | null {
  if (!extra || typeof extra !== 'object') return null;
  const modelo = extra as Partial<ModeloGuardado>;
  return modelo.tipo === 'mia-glb' && modelo.version === 1 && typeof modelo.nombre === 'string' &&
    modelo.datos instanceof ArrayBuffer ? modelo as ModeloGuardado : null;
}

export class BajoRelieveSalon implements Salon {
  id = 'bajorelieve';
  nombre = 'Bajo Relieve';

  hilosFicha: HiloFichaDef[] = [
    { clave: 'param.escala', etiqueta: 'respiración interna', categoria: 'expresion', min: 0.2, max: 4, velocidad: 'gesto', coste: 'barato', afinidades: ['energia'], legado: true },
    { clave: 'param.giro', etiqueta: 'giro propio', categoria: 'movimiento', min: -2, max: 2, velocidad: 'gesto', coste: 'barato', afinidades: ['pulso'], legado: true },
    { clave: 'param.aplanado', etiqueta: 'profundidad del relieve', categoria: 'expresion', min: 0.005, max: 1, velocidad: 'gesto', coste: 'barato', afinidades: ['energia', 'ataque'], porDefecto: true, legado: true },
    { clave: 'param.radio', etiqueta: 'radio de revelado', categoria: 'expresion', min: 0.02, max: 0.35, velocidad: 'gesto', coste: 'medio', afinidades: ['energia'], legado: true },
    { clave: 'param.estela', etiqueta: 'memoria de estela', categoria: 'expresion', min: 0.002, max: 0.2, velocidad: 'frase', coste: 'medio', afinidades: ['textura'], legado: true },
    { clave: 'param.ciclo', etiqueta: 'ciclo de paleta', categoria: 'material', min: 0.5, max: 6, velocidad: 'frase', coste: 'barato', afinidades: ['armonia'], legado: true },
    { clave: 'param.tono', etiqueta: 'tono de paleta', categoria: 'material', min: -1, max: 1, velocidad: 'frase', coste: 'barato', afinidades: ['armonia', 'brillo'], porDefecto: true, legado: true },
    { clave: 'param.opacidad', etiqueta: 'opacidad de alambre', categoria: 'material', min: 0.05, max: 1, velocidad: 'gesto', coste: 'barato', afinidades: ['energia'], legado: true },
  ];

  params: ParamDef[] = [
    { clave: 'escala', etiqueta: 'escala', valor: 1,  min: 0.2, max: 4 },
    { clave: 'giro',   etiqueta: 'giro',   valor: 0,  min: -2,  max: 2 },
  ];

  pestanas: Pestana[] = [
    {
      titulo: 'Relieve',
      params: [
        { clave: 'aplanado', etiqueta: 'aplanado base',   valor: 0.03,  min: 0.005, max: 1 },
        { clave: 'radio',    etiqueta: 'radio estela',    valor: 0.1,   min: 0.02,  max: 0.35 },
        { clave: 'estela',   etiqueta: 'desvanecimiento', valor: 0.02,  min: 0.002, max: 0.2 },
        { clave: 'ciclo',    etiqueta: 'ciclo paleta',    valor: 2.883, min: 0.5,   max: 6 },
        { clave: 'tono',     etiqueta: 'tono paleta',     valor: 0,     min: -1,    max: 1 },
      ],
    },
    {
      titulo: 'Wireframe',
      params: [
        { clave: 'opacidad', etiqueta: 'opacidad', valor: 0.6, min: 0.05, max: 1 },
      ],
    },
  ];

  acciones: Accion[] = [{ titulo: '📦 Cargar modelo GLB…', fn: () => this.cargarGLB() }];

  private u = {
    aplanado: uniform(0.03),
    ciclo: uniform(2.883),
    tono: uniform(0),
    opacidad: uniform(0.6),
  };

  private grupo = new THREE.Group();
  private estela!: Estela;
  private texturaEstela!: THREE.CanvasTexture;
  private mallas: { malla: THREE.Mesh; relieve: THREE.NodeMaterial; alambre: THREE.NodeMaterial }[] = [];
  private puntero: { x: number; y: number } | null = null;
  private modoActual = -1;
  private fondoPrevio: THREE.Color | THREE.Texture | null = null;
  private quitarEventos: (() => void) | null = null;
  private modeloGuardado: ModeloGuardado | null;
  /** Impide que una carga antigua (p.ej. el GLB por defecto) pise una nueva. */
  private generacionModelo = 0;

  constructor(extra?: unknown) {
    this.modeloGuardado = modeloDesdeExtra(extra);
  }

  init(escena: THREE.Scene): void {
    this.estela = new Estela(innerWidth, innerHeight);
    this.texturaEstela = new THREE.CanvasTexture(this.estela.canvas);
    this.texturaEstela.flipY = false;

    escena.add(this.grupo);
    this.fondoPrevio = escena.background as THREE.Color | null;
    escena.background = new THREE.Color(0x000000);

    const alMover = (e: PointerEvent) => { this.puntero = { x: e.clientX, y: e.clientY }; };
    const alRedimensionar = () => this.estela.redimensionar(innerWidth, innerHeight);
    addEventListener('pointermove', alMover);
    addEventListener('resize', alRedimensionar);
    this.quitarEventos = () => {
      removeEventListener('pointermove', alMover);
      removeEventListener('resize', alRedimensionar);
    };

    if (this.modeloGuardado) void this.restaurarModeloGuardado();
    else this.cargarModelo(MODELO_DEFECTO);
  }

  update(dt: number, _t: number, p: Params): void {
    // La estela vive en CPU: velado por frame + círculo si el puntero se movió
    this.estela.radio = (p.radio ?? 0.1) * innerWidth;
    this.estela.desvanecer = p.estela ?? 0.02;
    this.estela.update(this.puntero ?? undefined);
    this.puntero = null;
    this.texturaEstela.needsUpdate = true;

    this.u.aplanado.value = p.aplanado ?? 0.03;
    this.u.ciclo.value = p.ciclo ?? 2.883;
    this.u.tono.value = p.tono ?? 0;
    this.u.opacidad.value = p.opacidad ?? 0.6;

    const modo = p.modo ?? 0;
    if (modo !== this.modoActual) {
      this.modoActual = modo;
      for (const m of this.mallas) m.malla.material = modo === 0 ? m.relieve : m.alambre;
    }

    this.grupo.scale.setScalar(p.escala ?? 1);
    this.grupo.rotation.y += (p.giro ?? 0) * dt;
  }

  dispose(escena: THREE.Scene): void {
    this.generacionModelo++;
    this.quitarEventos?.();
    escena.remove(this.grupo);
    for (const m of this.mallas) {
      m.malla.geometry.dispose();
      m.relieve.dispose();
      m.alambre.dispose();
    }
    this.mallas = [];
    this.grupo.clear();
    this.texturaEstela.dispose();
    escena.background = this.fondoPrevio;
    this.modoActual = -1;
  }

  // ————— Materiales (corazón del salón) —————

  /** Paleta cosenoidal de Íñigo Quílez, con ciclo y tono modulables. */
  private paleta(t: any): any {
    const a = vec3(0.25, 0.25, 0.7);
    const b = vec3(0.4, 0.29, 1.4);
    const c = vec3(0.18, 1.64, 0.8);
    const d = vec3(0.27, 1.35, 0.27);
    return a.add(b.mul(cos(this.u.ciclo.mul(c.mul(float(t).add(this.u.tono)).add(d)))));
  }

  /**
   * positionNode compartido: proyecta el vértice a UV de pantalla, muestrea
   * la estela y aplasta la Z local salvo donde la estela lo revela.
   * Devuelve también la varying uvscreen para usarla en el colorNode.
   */
  private nodoPosicion() {
    const uvPantalla = varying(vec2(0, 0));
    const posicion = Fn(() => {
      const pos = positionLocal.toVar();
      const ndc = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(pos, 1.0));
      const s = ndc.xy.div(ndc.w).add(1.0).div(2.0);
      uvPantalla.assign(vec2(s.x, s.y.oneMinus()));
      const extrude = texture(this.texturaEstela, uvPantalla).r;
      pos.z.mulAssign(mix(this.u.aplanado, 1.0, extrude));
      return pos;
    })();
    return { posicion, uvPantalla };
  }

  private crearMaterialRelieve(tex1: THREE.Texture, tex2: THREE.Texture): THREE.NodeMaterial {
    // OJO: NodeMaterial base es abstracto desde r167 — usar siempre una subclase
    const mat = new THREE.MeshBasicNodeMaterial();
    const { posicion, uvPantalla } = this.nodoPosicion();
    mat.positionNode = posicion;
    mat.colorNode = Fn(() => {
      const extrude = texture(this.texturaEstela, uvPantalla).r;
      const tt1 = texture(tex1, uv());
      const tt2 = texture(tex2, uv());
      // 6 niveles de detalle guardados en los canales de las dos texturas
      let final: any = tt2.b;
      final = mix(final, tt2.g, smoothstep(0.0, 0.2, extrude));
      final = mix(final, tt2.r, smoothstep(0.2, 0.4, extrude));
      final = mix(final, tt1.b, smoothstep(0.4, 0.6, extrude));
      final = mix(final, tt1.g, smoothstep(0.6, 0.8, extrude));
      final = mix(final, tt1.r, smoothstep(0.8, 1.0, extrude));
      return vec4(this.paleta(final), 1.0);
    })();
    return mat;
  }

  private crearMaterialAlambre(): THREE.NodeMaterial {
    const mat = new THREE.MeshBasicNodeMaterial();
    const { posicion, uvPantalla } = this.nodoPosicion();
    mat.positionNode = posicion;
    mat.wireframe = true;
    mat.transparent = true;
    mat.colorNode = Fn(() => {
      // El alambre se colorea con la propia extrusión: dormido oscuro, vivo al paso
      const extrude = texture(this.texturaEstela, uvPantalla).r;
      return vec4(this.paleta(extrude), 1.0);
    })();
    mat.opacityNode = this.u.opacidad;
    return mat;
  }

  // ————— Carga de modelos —————

  private cargarModelo(url: string): void {
    const generacion = ++this.generacionModelo;
    crearLoaderGLB().load(url, (gltf) => {
      if (generacion === this.generacionModelo) this.montarModelo(gltf.scene);
    }, undefined,
      (err) => console.error('Error cargando GLB:', err));
  }

  private cargarGLB(): void {
    elegirYCargarGLB(({ escena, nombre, datos }) => {
      this.modeloGuardado = { tipo: 'mia-glb', version: 1, nombre, datos: datos.slice(0) };
      this.generacionModelo++;
      this.montarModelo(escena);
    });
  }

  estadoExtra(): unknown {
    if (!this.modeloGuardado) return undefined;
    return { ...this.modeloGuardado, datos: this.modeloGuardado.datos.slice(0) };
  }

  cargarEstadoExtra(extra: unknown): void {
    this.modeloGuardado = modeloDesdeExtra(extra);
    if (this.modeloGuardado && this.texturaEstela) void this.restaurarModeloGuardado();
  }

  private async restaurarModeloGuardado(): Promise<void> {
    const modelo = this.modeloGuardado;
    if (!modelo) return;
    const generacion = ++this.generacionModelo;
    try {
      const gltf = await crearLoaderGLB().parseAsync(modelo.datos.slice(0), '');
      if (generacion === this.generacionModelo && this.modeloGuardado === modelo) {
        this.montarModelo(gltf.scene);
      }
    } catch (err) {
      console.error(`No se pudo restaurar el GLB «${modelo.nombre}»:`, err);
    }
  }

  private montarModelo(modelo: THREE.Object3D): void {
    // Limpiar el modelo anterior
    for (const m of this.mallas) { m.malla.geometry.dispose(); m.relieve.dispose(); m.alambre.dispose(); }
    this.mallas = [];
    this.grupo.clear();

    const porDefecto = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
    porDefecto.needsUpdate = true;

    modelo.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      // Los GLB pueden traer material único o array: tomar el primero
      const matOriginal = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial;
      const tex1 = matOriginal?.map ?? porDefecto;
      const tex2 = matOriginal?.emissiveMap ?? porDefecto;
      const relieve = this.crearMaterialRelieve(tex1, tex2);
      const alambre = this.crearMaterialAlambre();
      o.material = relieve;
      this.mallas.push({ malla: o, relieve, alambre });
    });

    // Auto-orientar: el efecto aplasta el eje Z local, así que el eje MÁS
    // DELGADO del modelo (la profundidad del relieve) debe mirar a cámara.
    // Sin esto, un relieve con la profundidad en Y queda visto de canto.
    const cajaLocal = new THREE.Box3().setFromObject(modelo);
    const tam = cajaLocal.getSize(new THREE.Vector3());
    if (tam.x <= tam.y && tam.x <= tam.z) {
      modelo.rotation.y = Math.PI / 2;  // profundidad en X → girar a Z
    } else if (tam.y <= tam.x && tam.y <= tam.z) {
      modelo.rotation.x = -Math.PI / 2; // profundidad en Y → girar a Z
    }
    modelo.updateMatrixWorld(true);

    // Centrar y normalizar tamaño (tras la rotación)
    const caja = new THREE.Box3().setFromObject(modelo);
    const centro = caja.getCenter(new THREE.Vector3());
    const factor = 7 / (caja.getSize(new THREE.Vector3()).length() || 1);
    modelo.scale.setScalar(factor);
    modelo.position.copy(centro).multiplyScalar(-factor);

    this.grupo.add(modelo);
    this.modoActual = -1; // fuerza reasignación de material según pestaña activa
  }

  // ————— Exportador —————

  exportar(p: Params): string {
    return PLANTILLA_EXPORT.replaceAll('__PARAMS__', JSON.stringify(p));
  }
}

// HTML autocontenido (WebGPU + TSL vía CDN). Copia tu .glb junto al HTML
// con el nombre modelo.glb (o edita la constante URL_MODELO).
const PLANTILLA_EXPORT = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — bajo relieve</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}</style>
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.js",
  "three/webgpu":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.js",
  "three/tsl":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.tsl.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { Fn, varying, texture, uv, vec2, vec3, vec4, float, mix, smoothstep, cos, positionLocal, cameraProjectionMatrix, modelViewMatrix } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const P = __PARAMS__, URL_MODELO = 'modelo.glb';
// — estela —
const cv = document.createElement('canvas'); cv.width = innerWidth; cv.height = innerHeight;
const cx = cv.getContext('2d'); cx.fillStyle = 'black'; cx.fillRect(0,0,cv.width,cv.height);
let puntero = null;
addEventListener('pointermove', e => puntero = {x:e.clientX, y:e.clientY});
function pasoEstela(){
  cx.fillStyle = 'rgba(0,0,0,' + P.estela + ')'; cx.fillRect(0,0,cv.width,cv.height);
  if (puntero){ const R = P.radio*innerWidth;
    const g = cx.createRadialGradient(puntero.x,puntero.y,0,puntero.x,puntero.y,R);
    g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.8)');
    g.addColorStop(0.8,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(puntero.x,puntero.y,R,0,Math.PI*2); cx.fill();
    puntero = null; }
  texEstela.needsUpdate = true;
}
const texEstela = new THREE.CanvasTexture(cv); texEstela.flipY = false;
// — material —
const paleta = (t) => {
  const a=vec3(0.25,0.25,0.7), b=vec3(0.4,0.29,1.4), c=vec3(0.18,1.64,0.8), d=vec3(0.27,1.35,0.27);
  return a.add(b.mul(cos(float(P.ciclo).mul(c.mul(float(t).add(P.tono)).add(d)))));
};
function crearMaterial(tex1, tex2){
  const mat = new THREE.MeshBasicNodeMaterial();
  const uvP = varying(vec2(0,0));
  mat.positionNode = Fn(() => {
    const pos = positionLocal.toVar();
    const ndc = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(pos,1));
    const s = ndc.xy.div(ndc.w).add(1).div(2);
    uvP.assign(vec2(s.x, s.y.oneMinus()));
    pos.z.mulAssign(mix(P.aplanado, 1, texture(texEstela, uvP).r));
    return pos;
  })();
  mat.colorNode = Fn(() => {
    const ex = texture(texEstela, uvP).r;
    const t1 = texture(tex1, uv()), t2 = texture(tex2, uv());
    let f = t2.b;
    f = mix(f, t2.g, smoothstep(0,0.2,ex));   f = mix(f, t2.r, smoothstep(0.2,0.4,ex));
    f = mix(f, t1.b, smoothstep(0.4,0.6,ex)); f = mix(f, t1.g, smoothstep(0.6,0.8,ex));
    f = mix(f, t1.r, smoothstep(0.8,1,ex));
    return vec4(paleta(f), 1);
  })();
  if (P.modo === 1){ mat.wireframe = true; mat.transparent = true;
    mat.colorNode = Fn(() => vec4(paleta(texture(texEstela, uvP).r), 1))();
    mat.opacityNode = float(P.opacidad); }
  return mat;
}
// — escena —
const escena = new THREE.Scene(); escena.background = new THREE.Color(0x000000);
const grupo = new THREE.Group(); grupo.scale.setScalar(P.escala); escena.add(grupo);
const gris = new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1,THREE.RGBAFormat); gris.needsUpdate = true;
const draco = new DRACOLoader(); draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
loader.load(URL_MODELO, (g) => {
  g.scene.traverse(o => { if (o.isMesh) o.material = crearMaterial(o.material?.map ?? gris, o.material?.emissiveMap ?? gris); });
  const caja = new THREE.Box3().setFromObject(g.scene);
  const centro = caja.getCenter(new THREE.Vector3());
  const dim = caja.getSize(new THREE.Vector3()).length() || 1;
  g.scene.position.sub(centro); g.scene.scale.setScalar(7/dim);
  grupo.add(g.scene);
});
const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .1, 100); cam.position.z = 6;
const r = new THREE.WebGPURenderer({antialias:true}); await r.init();
r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.appendChild(r.domElement);
const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true;
const reloj = new THREE.Clock();
r.setAnimationLoop(()=>{ pasoEstela(); grupo.rotation.y += P.giro*reloj.getDelta(); ctl.update(); r.render(escena,cam); });
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth,innerHeight); });
</script></body></html>`;
