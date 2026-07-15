// Salón — Trazo y Grafito: cross-hatching + sketchy pencil sobre modelos GLB.
//
// Referencias estéticas:
//   · spite/sketch (inktober 2020): tramado por niveles de luz, papel, grabado.
//   · Codrops "Sketchy Pencil Effect": temblor de línea + grano de papel.
//
// Técnica: en lugar del GLSL WebGL2 de las referencias, el tramado se hace
// procedural en TSL (compila a WGSL y GLSL a la vez). La iluminación lambert
// se cuantiza en 4 niveles; cada nivel activa una capa de rayado en espacio
// de pantalla con ángulo propio. El «temblor» perturba las coordenadas con
// ruido (lápiz), y el grano ensucia el papel.
//
// Camino de mejora (v2): contornos por detección de bordes sobre normales/
// profundidad con THREE.PostProcessing (el outline del efecto Codrops).

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec3, mix, dot, normalize, fract, abs,
  sin, cos, clamp, smoothstep, screenCoordinate, normalWorld, mx_noise_float,
} from 'three/tsl';
import { crearLoaderGLB, elegirYCargarGLB } from '../../core/CargadorGLB';
import type { Salon, Params, ParamDef, Accion, HiloFichaDef } from '../../core/Salon';

const VISTA = { Alambre: 1, Caras: 2, Ambos: 3 };

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

export class CrossHatchSalon implements Salon {
  id = 'crosshatch';
  nombre = 'Trazo y Grafito';

  hilosFicha: HiloFichaDef[] = [
    { clave: 'param.escala', etiqueta: 'escala de trama', categoria: 'material', min: 0.02, max: 0.4, velocidad: 'gesto', coste: 'barato', afinidades: ['textura', 'brillo'], legado: true },
    { clave: 'param.grosor', etiqueta: 'grosor de línea', categoria: 'material', min: 0.1, max: 0.95, velocidad: 'gesto', coste: 'barato', afinidades: ['energia'], legado: true },
    { clave: 'param.angulo', etiqueta: 'ángulo de trama', categoria: 'material', min: 0, max: 180, velocidad: 'frase', coste: 'barato', afinidades: ['armonia'], legado: true },
    { clave: 'param.temblor', etiqueta: 'temblor del trazo', categoria: 'expresion', min: 0, max: 1.5, velocidad: 'gesto', coste: 'barato', afinidades: ['textura', 'ataque'], porDefecto: true, legado: true },
    { clave: 'param.grano', etiqueta: 'grano del papel', categoria: 'material', min: 0, max: 1, velocidad: 'frase', coste: 'barato', afinidades: ['textura'], legado: true },
    { clave: 'param.intensidad', etiqueta: 'intensidad de tinta', categoria: 'material', min: 0, max: 2, velocidad: 'gesto', coste: 'barato', afinidades: ['energia', 'brillo'], porDefecto: true, legado: true },
    { clave: 'param.luzAzimut', etiqueta: 'azimut de luz', categoria: 'expresion', min: 0, max: 360, velocidad: 'frase', coste: 'barato', afinidades: ['armonia'], legado: true },
    { clave: 'param.luzAltura', etiqueta: 'altura de luz', categoria: 'expresion', min: -80, max: 80, velocidad: 'frase', coste: 'barato', afinidades: ['altura', 'brillo'], legado: true },
    { clave: 'param.giro', etiqueta: 'giro propio', categoria: 'movimiento', min: -2, max: 2, velocidad: 'gesto', coste: 'barato', afinidades: ['pulso'], legado: true },
  ];

  params: ParamDef[] = [
    { clave: 'escala',     etiqueta: 'escala trama',  valor: 0.12, min: 0.02, max: 0.4 },
    { clave: 'grosor',     etiqueta: 'grosor línea',  valor: 0.5,  min: 0.1,  max: 0.95 },
    { clave: 'angulo',     etiqueta: 'ángulo (°)',    valor: 45,   min: 0,    max: 180, paso: 1 },
    { clave: 'temblor',    etiqueta: 'temblor',       valor: 0.35, min: 0,    max: 1.5 },
    { clave: 'grano',      etiqueta: 'grano papel',   valor: 0.4,  min: 0,    max: 1 },
    { clave: 'intensidad', etiqueta: 'intensidad',    valor: 1,    min: 0,    max: 2 },
    { clave: 'luzAzimut',  etiqueta: 'luz azimut(°)', valor: 60,   min: 0,    max: 360, paso: 1 },
    { clave: 'luzAltura',  etiqueta: 'luz altura(°)', valor: 35,   min: -80,  max: 80,  paso: 1 },
    { clave: 'fondo',      etiqueta: 'fondo',          valor: 0xf3f0e8, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'tinta',      etiqueta: 'líneas',         valor: 0x21212b, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'invertir',   etiqueta: 'polaridad',      valor: 0, min: 0, max: 1, opciones: { normal: 0, invertida: 1 } },
    { clave: 'vista',      etiqueta: 'exposición',     valor: 2, min: 1, max: 3, opciones: VISTA },
    { clave: 'giro',       etiqueta: 'giro',           valor: 0, min: -2,   max: 2 },
  ];

  acciones: Accion[] = [{ titulo: '📦 Cargar modelo GLB…', fn: () => this.cargarGLB() }];

  // Uniforms TSL: el puente entre el ParamBus y el shader.
  private u = {
    escala: uniform(0.12),
    grosor: uniform(0.5),
    angulo: uniform(Math.PI / 4),
    temblor: uniform(0.35),
    grano: uniform(0.4),
    intensidad: uniform(1),
    luzAzimut: uniform(Math.PI / 3),
    luzAltura: uniform(0.6),
    fondo: uniform(new THREE.Color(0xf3f0e8)),
    tinta: uniform(new THREE.Color(0x21212b)),
  };

  private grupo = new THREE.Group();
  private material!: THREE.MeshBasicNodeMaterial;
  private materialAlambre!: THREE.MeshBasicNodeMaterial;
  private caras: THREE.Mesh[] = [];
  private alambres: THREE.Mesh[] = [];
  private fondoPrevio: THREE.Color | THREE.Texture | null = null;
  private escena: THREE.Scene | null = null;
  private modeloGuardado: ModeloGuardado | null;

  constructor(extra?: unknown) {
    this.modeloGuardado = modeloDesdeExtra(extra);
  }

  init(escena: THREE.Scene): void {
    this.escena = escena;
    this.material = this.crearMaterial();
    this.materialAlambre = this.crearMaterial(true);

    // Modelo por defecto mientras no se carga un GLB.
    const defecto = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.35, 220, 36), this.material);
    this.grupo.add(defecto);
    this.prepararRepresentaciones(this.grupo);
    escena.add(this.grupo);

    this.fondoPrevio = escena.background as THREE.Color | null;
    escena.background = new THREE.Color(0xf3f0e8); // papel también fuera del modelo
    if (this.modeloGuardado) void this.restaurarModeloGuardado();
  }

  update(dt: number, _t: number, p: Params): void {
    const u = this.u;
    u.escala.value = p.escala;
    u.grosor.value = p.grosor;
    u.angulo.value = (p.angulo * Math.PI) / 180;
    u.temblor.value = p.temblor;
    u.grano.value = p.grano;
    u.intensidad.value = p.intensidad;
    u.luzAzimut.value = (p.luzAzimut * Math.PI) / 180;
    u.luzAltura.value = (p.luzAltura * Math.PI) / 180;
    const invertir = p.invertir === 1;
    const fondo = invertir ? (p.tinta ?? 0x21212b) : (p.fondo ?? 0xf3f0e8);
    const tinta = invertir ? (p.fondo ?? 0xf3f0e8) : (p.tinta ?? 0x21212b);
    u.fondo.value.setHex(fondo);
    u.tinta.value.setHex(tinta);
    if (this.escena) this.escena.background = new THREE.Color(fondo);
    const vista = p.vista === VISTA.Alambre ? VISTA.Alambre : p.vista === VISTA.Ambos ? VISTA.Ambos : VISTA.Caras;
    for (const malla of this.caras) malla.visible = vista !== VISTA.Alambre;
    for (const malla of this.alambres) malla.visible = vista !== VISTA.Caras;
    this.grupo.rotation.y += (p.giro ?? 0) * dt;
  }

  dispose(escena: THREE.Scene): void {
    escena.remove(this.grupo);
    this.liberarGeometrias();
    this.grupo.clear();
    this.material.dispose();
    this.materialAlambre.dispose();
    this.caras = [];
    this.alambres = [];
    escena.background = this.fondoPrevio;
    this.escena = null;
  }

  // ————— El material (corazón del salón) —————

  private crearMaterial(alambre = false): THREE.MeshBasicNodeMaterial {
    const u = this.u;
    const mat = new THREE.MeshBasicNodeMaterial({
      wireframe: alambre,
      transparent: alambre,
      opacity: alambre ? 0.65 : 1,
      depthWrite: !alambre,
    });

    mat.colorNode = Fn(() => {
      // Iluminación lambert con luz direccional propia (esférica → cartesiana)
      const L = normalize(vec3(
        cos(u.luzAltura).mul(cos(u.luzAzimut)),
        sin(u.luzAltura),
        cos(u.luzAltura).mul(sin(u.luzAzimut)),
      ));
      const lum = clamp(dot(normalWorld, L), 0.0, 1.0);

      // Coordenadas de pantalla + temblor de lápiz (ruido)
      const px = screenCoordinate.xy.mul(u.escala);
      const p = px.add(mx_noise_float(px.mul(0.5)).mul(u.temblor));

      // 4 capas de rayado: cuanto más oscuro el lambert, más capas se cruzan
      const umbrales = [0.8, 0.55, 0.32, 0.14];
      const desfases = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
      let tinta = float(0.0).add(0.0);
      for (let i = 0; i < 4; i++) {
        const ang = u.angulo.add(desfases[i]);
        const yr = p.x.mul(sin(ang)).add(p.y.mul(cos(ang)));            // coord rotada
        const dist = abs(fract(yr).sub(0.5)).mul(2.0);                   // 0 = centro de línea
        const linea = smoothstep(u.grosor.mul(0.55), u.grosor, dist).oneMinus();
        const sombra = smoothstep(umbrales[i] - 0.07, umbrales[i] + 0.07, lum).oneMinus();
        tinta = tinta.add(linea.mul(sombra));
      }
      const cubierta = clamp(tinta.mul(u.intensidad), 0.0, 1.0);

      // Papel con grano + grafito
      const ruidoPapel = mx_noise_float(screenCoordinate.xy.mul(0.9)).mul(0.5).add(0.5);
      const papel = u.fondo.sub(ruidoPapel.mul(u.grano).mul(0.14));
      const grafito = u.tinta;
      return mix(papel, grafito, cubierta);
    })();

    return mat;
  }

  // ————— Importación GLB —————

  private cargarGLB(): void {
    elegirYCargarGLB(({ escena, nombre, datos }) => {
      this.modeloGuardado = { tipo: 'mia-glb', version: 1, nombre, datos: datos.slice(0) };
      this.montarModelo(escena);
    });
  }

  estadoExtra(): unknown {
    if (!this.modeloGuardado) return undefined;
    return { ...this.modeloGuardado, datos: this.modeloGuardado.datos.slice(0) };
  }

  cargarEstadoExtra(extra: unknown): void {
    this.modeloGuardado = modeloDesdeExtra(extra);
    if (this.modeloGuardado && this.material) void this.restaurarModeloGuardado();
  }

  private async restaurarModeloGuardado(): Promise<void> {
    const modelo = this.modeloGuardado;
    if (!modelo) return;
    try {
      const gltf = await crearLoaderGLB().parseAsync(modelo.datos.slice(0), '');
      // Si se eligió otro archivo mientras se parseaba, no reemplazarlo.
      if (this.modeloGuardado === modelo) this.montarModelo(gltf.scene);
    } catch (err) {
      console.error(`No se pudo restaurar el GLB «${modelo.nombre}»:`, err);
    }
  }

  private montarModelo(modelo: THREE.Object3D): void {
    // Centrar y normalizar tamaño (que cualquier modelo quepa igual en escena)
    const caja = new THREE.Box3().setFromObject(modelo);
    const centro = caja.getCenter(new THREE.Vector3());
    const dimension = caja.getSize(new THREE.Vector3()).length() || 1;
    modelo.position.sub(centro);
    modelo.scale.setScalar(3.4 / dimension);

    this.liberarGeometrias();
    this.grupo.clear();
    this.grupo.add(modelo);
    this.prepararRepresentaciones(modelo);
  }

  /** Las dos representaciones comparten geometría; solo se duplica el draw call. */
  private prepararRepresentaciones(modelo: THREE.Object3D): void {
    this.caras = [];
    this.alambres = [];
    const meshes: THREE.Mesh[] = [];
    modelo.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
    for (const malla of meshes) {
      malla.material = this.material;
      const alambre = new THREE.Mesh(malla.geometry, this.materialAlambre);
      alambre.position.copy(malla.position);
      alambre.rotation.copy(malla.rotation);
      alambre.scale.copy(malla.scale);
      alambre.frustumCulled = malla.frustumCulled;
      malla.parent?.add(alambre);
      this.caras.push(malla);
      this.alambres.push(alambre);
    }
  }

  private liberarGeometrias(): void {
    const geometrias = new Set<THREE.BufferGeometry>();
    this.grupo.traverse((o) => { if (o instanceof THREE.Mesh) geometrias.add(o.geometry); });
    for (const geometria of geometrias) geometria.dispose();
  }

  // ————— Exportador —————

  exportar(p: Params): string {
    return PLANTILLA_EXPORT.replaceAll('__PARAMS__', JSON.stringify(p));
  }
}

// HTML autocontenido (WebGPU + TSL vía CDN, mismo shader).
// v1 exporta con el TorusKnot; para usar tu GLB, sirve el archivo junto al
// HTML y descomenta el bloque GLTFLoader señalado abajo.
const PLANTILLA_EXPORT = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — trazo y grafito</title>
<style>html,body{margin:0;height:100%;background:#f3f0e8;overflow:hidden}</style>
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.js",
  "three/webgpu":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.js",
  "three/tsl":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.tsl.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { Fn, uniform, float, vec3, mix, dot, normalize, fract, abs, sin, cos, clamp, smoothstep, screenCoordinate, normalWorld, mx_noise_float } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const P = __PARAMS__, rad = (g)=>g*Math.PI/180;
const invertida = P.invertir === 1;
const colorFondo = new THREE.Color(invertida ? (P.tinta ?? 0x21212b) : (P.fondo ?? 0xf3f0e8));
const colorTinta = new THREE.Color(invertida ? (P.fondo ?? 0xf3f0e8) : (P.tinta ?? 0x21212b));
const mat = new THREE.MeshBasicNodeMaterial();
mat.colorNode = Fn(() => {
  const L = normalize(vec3(Math.cos(rad(P.luzAltura))*Math.cos(rad(P.luzAzimut)), Math.sin(rad(P.luzAltura)), Math.cos(rad(P.luzAltura))*Math.sin(rad(P.luzAzimut))));
  const lum = clamp(dot(normalWorld, L), 0.0, 1.0);
  const px = screenCoordinate.xy.mul(P.escala);
  const p = px.add(mx_noise_float(px.mul(0.5)).mul(P.temblor));
  const umbrales = [0.8, 0.55, 0.32, 0.14], desfases = [0, Math.PI/2, Math.PI/4, -Math.PI/4];
  let tinta = float(0.0).add(0.0);
  for (let i = 0; i < 4; i++) {
    const a = rad(P.angulo) + desfases[i];
    const yr = p.x.mul(Math.sin(a)).add(p.y.mul(Math.cos(a)));
    const dist = abs(fract(yr).sub(0.5)).mul(2.0);
    const linea = smoothstep(P.grosor*0.55, P.grosor, dist).oneMinus();
    const sombra = smoothstep(umbrales[i]-0.07, umbrales[i]+0.07, lum).oneMinus();
    tinta = tinta.add(linea.mul(sombra));
  }
  const cubierta = clamp(tinta.mul(P.intensidad), 0.0, 1.0);
  const ruido = mx_noise_float(screenCoordinate.xy.mul(0.9)).mul(0.5).add(0.5);
  const papel = vec3(colorFondo.r, colorFondo.g, colorFondo.b).sub(ruido.mul(P.grano).mul(0.14));
  return mix(papel, vec3(colorTinta.r, colorTinta.g, colorTinta.b), cubierta);
})();
const grupo = new THREE.Group();
grupo.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, .35, 220, 36), mat));
// — Para usar tu modelo: —
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// new GLTFLoader().load('modelo.glb', (g) => { grupo.clear();
//   g.scene.traverse(o => { if (o.isMesh) o.material = mat; }); grupo.add(g.scene); });
const escena = new THREE.Scene(); escena.background = colorFondo; escena.add(grupo);
const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .1, 100); cam.position.z = 6;
const r = new THREE.WebGPURenderer({antialias:true}); await r.init();
r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.appendChild(r.domElement);
const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true;
const reloj = new THREE.Clock();
r.setAnimationLoop(()=>{ grupo.rotation.y += P.giro*reloj.getDelta(); ctl.update(); r.render(escena,cam); });
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth,innerHeight); });
</script></body></html>`;
