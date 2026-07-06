// Salón 1 — Formas Exóticas. Dos figuras (pestañas):
//
//   · Clásica   — supershape cerrada (esférica).
//   · SuperFlor — superficie ABIERTA combinada (r1·r2) del proyecto supeFlower.
//
// Cada figura tiene TRES modos de exposición: puntos, alambre y caras,
// más resolución variable y color — los atributos que heredan las fichas.
//
// ★ GPU: la geometría es una retícula (u,v) estática; las posiciones y
//   normales se evalúan en el vertex/fragment shader desde uniforms.
//   Solo el cambio de RESOLUCIÓN regenera la retícula (barata: es un grid).

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec3, vec4, uv, mix, abs, sin, cos, exp, max,
  clamp, select, normalize, cross, dot, faceDirection, modelWorldMatrix,
} from 'three/tsl';
import type { Salon, Params, ParamDef, Pestana } from '../../core/Salon';

const PI = Math.PI;
const VISTA = { Puntos: 0, Alambre: 1, Caras: 2 };

export class SupershapesSalon implements Salon {
  id = 'supershapes';
  nombre = 'Formas Exóticas';

  params: ParamDef[] = [
    { clave: 'escala',     etiqueta: 'escala',     valor: 2,    min: 0.2, max: 5 },
    { clave: 'giro',       etiqueta: 'giro',       valor: 0.15, min: -2,  max: 2 },
    { clave: 'resolucion', etiqueta: 'resolución', valor: 256,  min: 8,   max: 512, paso: 8 },
    { clave: 'vista',      etiqueta: 'exposición', valor: 0,    min: 0,   max: 2, opciones: VISTA },
    { clave: 'color',      etiqueta: 'color',      valor: 0xdfe6ff, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'puntoTam',   etiqueta: 'tamaño punto (WebGL)', valor: 0.02, min: 0.001, max: 0.1 },
  ];

  pestanas: Pestana[] = [
    {
      titulo: 'Clásica',
      params: [
        // — Perfil longitudinal (θ) —
        { clave: 'm1', etiqueta: 'θ · m',  valor: 7,   min: 0,    max: 20, paso: 1 },
        { clave: 'n1', etiqueta: 'θ · n1', valor: 0.2, min: 0.05, max: 5 },
        { clave: 'n2', etiqueta: 'θ · n2', valor: 1.7, min: 0.05, max: 5 },
        { clave: 'n3', etiqueta: 'θ · n3', valor: 1.7, min: 0.05, max: 5 },
        { clave: 'a1', etiqueta: 'θ · a',  valor: 1,   min: 0.1,  max: 3 },
        { clave: 'b1', etiqueta: 'θ · b',  valor: 1,   min: 0.1,  max: 3 },
        // — Perfil latitudinal (φ), independiente del longitudinal —
        { clave: 'm2',  etiqueta: 'φ · m',  valor: 3,   min: 0,    max: 20, paso: 1 },
        { clave: 'n1b', etiqueta: 'φ · n1', valor: 0.2, min: 0.05, max: 5 },
        { clave: 'n2b', etiqueta: 'φ · n2', valor: 1.7, min: 0.05, max: 5 },
        { clave: 'n3b', etiqueta: 'φ · n3', valor: 1.7, min: 0.05, max: 5 },
        { clave: 'a2',  etiqueta: 'φ · a',  valor: 1,   min: 0.1,  max: 3 },
        { clave: 'b2',  etiqueta: 'φ · b',  valor: 1,   min: 0.1,  max: 3 },
        // — Dominio angular (grados): abre superficies parciales / espirales —
        { clave: 'thMin', etiqueta: 'θ desde°', valor: -180, min: -360, max: 360, paso: 5 },
        { clave: 'thMax', etiqueta: 'θ hasta°', valor: 180,  min: -360, max: 360, paso: 5 },
        { clave: 'phMin', etiqueta: 'φ desde°', valor: -90,  min: -180, max: 180, paso: 5 },
        { clave: 'phMax', etiqueta: 'φ hasta°', valor: 90,   min: -180, max: 180, paso: 5 },
        // — Extras (Geometry Nodes) —
        { clave: 'factorZ',  etiqueta: 'factor Z',    valor: 1,    min: 0, max: 3 },
        { clave: 'nautilus', etiqueta: 'nautilus',    valor: 0,    min: 0, max: 1, opciones: { No: 0, 'Sí': 1 } },
        { clave: 'alfStep',  etiqueta: 'espiral (k)', valor: 0.15, min: 0, max: 1 },
      ],
    },
    {
      titulo: 'SuperFlor',
      params: [
        { clave: 'rmn',     etiqueta: 'amplitud hoja (rmn)', valor: 220,   min: 50,   max: 500,  paso: 1 },
        { clave: 'rmx',     etiqueta: 'radio bulbo (rmx)',   valor: 80,    min: 1,    max: 300,  paso: 1 },
        { clave: 'rat',     etiqueta: 'decaim. tallo (rat)', valor: 1.35,  min: 0.5,  max: 3 },
        { clave: 'K',       etiqueta: 'curvatura tallo (K)', valor: 1.667, min: 0.5,  max: 5 },
        { clave: 'easeExp', etiqueta: 'perfil hoja (ease)',  valor: 3,     min: 0.5,  max: 8 },
        { clave: 'r1m',  etiqueta: 'r1 · m',  valor: 2,   min: 1,    max: 20 },
        { clave: 'r1n1', etiqueta: 'r1 · n1', valor: 0.2, min: 0.01, max: 5 },
        { clave: 'r1n2', etiqueta: 'r1 · n2', valor: 1.7, min: 0.01, max: 5 },
        { clave: 'r1n3', etiqueta: 'r1 · n3', valor: 1.7, min: 0.01, max: 5 },
        { clave: 'r2m',  etiqueta: 'r2 · m',  valor: 7,   min: 1,    max: 20 },
        { clave: 'r2n1', etiqueta: 'r2 · n1', valor: 0.2, min: 0.01, max: 5 },
        { clave: 'r2n2', etiqueta: 'r2 · n2', valor: 1.7, min: 0.01, max: 5 },
        { clave: 'r2n3', etiqueta: 'r2 · n3', valor: 1.7, min: 0.01, max: 5 },
        { clave: 'zOffset', etiqueta: 'zOffset', valor: 120, min: 0,   max: 300,  paso: 1 },
        { clave: 'zCurva',  etiqueta: 'zCurva',  valor: 900, min: 100, max: 1200, paso: 1 },
        { clave: 'xOffset', etiqueta: 'xOffset', valor: 120, min: 0,   max: 300,  paso: 1 },
        { clave: 'yOffset', etiqueta: 'yOffset', valor: 200, min: 0,   max: 400,  paso: 1 },
        { clave: 'yBase',   etiqueta: 'yBase',   valor: 40,  min: 0,   max: 100,  paso: 1 },
      ],
    },
  ];

  // — Uniforms: el único canal CPU→GPU tras la carga inicial —
  private uC = {
    m1: uniform(7), n1: uniform(0.2), n2: uniform(1.7), n3: uniform(1.7), a1: uniform(1), b1: uniform(1),
    m2: uniform(3), n1b: uniform(0.2), n2b: uniform(1.7), n3b: uniform(1.7), a2: uniform(1), b2: uniform(1),
    thMin: uniform(-PI), thMax: uniform(PI), phMin: uniform(-PI / 2), phMax: uniform(PI / 2),
    factorZ: uniform(1), nautilus: uniform(0), alfStep: uniform(0.15),
  };
  private uF = {
    rmn: uniform(220), rmx: uniform(80), rat: uniform(1.35), K: uniform(1.667), easeExp: uniform(3),
    r1m: uniform(2), r1n1: uniform(0.2), r1n2: uniform(1.7), r1n3: uniform(1.7),
    r2m: uniform(7), r2n1: uniform(0.2), r2n2: uniform(1.7), r2n3: uniform(1.7),
    zOffset: uniform(120), zCurva: uniform(900), xOffset: uniform(120), yOffset: uniform(200), yBase: uniform(40),
  };
  private uColor = uniform(new THREE.Color(0xdfe6ff));

  private grupo = new THREE.Group();
  // 3 representaciones por figura, compartiendo retícula y grafo de posición
  private objC: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private objF: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private geoC: THREE.BufferGeometry | null = null;
  private geoF: THREE.BufferGeometry | null = null;
  private resActual = 0;

  init(escena: THREE.Scene): void {
    this.objC = this.crearRepresentaciones(this.nodoPosClasica(), this.nodoColorClasica());
    this.objF = this.crearRepresentaciones(this.nodoPosFlor(), this.nodoColorFlor());
    this.objF.puntos.rotation.x = this.objF.alambre.rotation.x = this.objF.caras.rotation.x = 2.97;
    for (const o of [this.objC, this.objF]) this.grupo.add(o.puntos, o.alambre, o.caras);
    escena.add(this.grupo);
    this.resActual = 0; // fuerza regeneración de retícula en el primer update
  }

  update(dt: number, _t: number, p: Params): void {
    // — Retícula: solo se regenera si cambió la resolución —
    const res = Math.max(8, Math.round(p.resolucion ?? 256));
    if (res !== this.resActual) {
      this.resActual = res;
      this.regenerarReticulas(res);
    }

    // — Visibilidad: figura activa (pestaña) × modo de exposición —
    const modo = p.modo === 1 ? 1 : 0;
    const vista = p.vista === 1 ? 1 : p.vista === 2 ? 2 : 0;
    const aplicar = (o: typeof this.objC, activa: boolean) => {
      if (!o) return;
      o.puntos.visible = activa && vista === VISTA.Puntos;
      o.alambre.visible = activa && vista === VISTA.Alambre;
      o.caras.visible = activa && vista === VISTA.Caras;
    };
    aplicar(this.objC, modo === 0);
    aplicar(this.objF, modo === 1);

    // — Uniforms —
    const c = this.uC;
    if (p.m1 !== undefined) { // pestaña Clásica activa
      c.m1.value = p.m1; c.n1.value = p.n1; c.n2.value = p.n2; c.n3.value = p.n3;
      c.a1.value = p.a1 ?? 1; c.b1.value = p.b1 ?? 1;
      c.m2.value = p.m2;
      // Fichas antiguas sin set φ: hereda los n del perfil θ (comportamiento previo compartido).
      c.n1b.value = p.n1b ?? p.n1; c.n2b.value = p.n2b ?? p.n2; c.n3b.value = p.n3b ?? p.n3;
      c.a2.value = p.a2 ?? 1; c.b2.value = p.b2 ?? 1;
      c.thMin.value = (p.thMin ?? -180) * PI / 180; c.thMax.value = (p.thMax ?? 180) * PI / 180;
      c.phMin.value = (p.phMin ?? -90) * PI / 180; c.phMax.value = (p.phMax ?? 90) * PI / 180;
      c.factorZ.value = p.factorZ ?? 1;
      c.nautilus.value = p.nautilus ?? 0;
      c.alfStep.value = p.alfStep ?? 0.15;
    }
    for (const clave of Object.keys(this.uF) as (keyof typeof this.uF)[]) {
      if (p[clave] !== undefined) this.uF[clave].value = p[clave];
    }
    if (p.color !== undefined) this.uColor.value.setHex(p.color);

    this.grupo.scale.setScalar(p.escala ?? 2);
    this.grupo.rotation.y += (p.giro ?? 0) * dt;
  }

  dispose(escena: THREE.Scene): void {
    escena.remove(this.grupo);
    this.geoC?.dispose();
    this.geoF?.dispose();
    for (const o of [this.objC, this.objF]) {
      if (!o) continue;
      (o.puntos.material as THREE.Material).dispose();
      (o.alambre.material as THREE.Material).dispose();
      (o.caras.material as THREE.Material).dispose();
    }
    this.objC = this.objF = null;
    this.grupo.clear();
  }

  // ————— Construcción de representaciones —————

  private crearRepresentaciones(nodoPos: any, nodoColorCaras: any) {
    const geo = new THREE.BufferGeometry(); // se reemplaza en regenerarReticulas

    const matPuntos = new THREE.PointsNodeMaterial();
    matPuntos.positionNode = nodoPos;
    matPuntos.colorNode = this.uColor;

    const matAlambre = new THREE.MeshBasicNodeMaterial({ wireframe: true, transparent: true, opacity: 0.5 });
    matAlambre.positionNode = nodoPos;
    matAlambre.colorNode = this.uColor;

    const matCaras = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    matCaras.positionNode = nodoPos;
    matCaras.colorNode = nodoColorCaras;

    return {
      puntos: new THREE.Points(geo, matPuntos),
      alambre: new THREE.Mesh(geo, matAlambre),
      caras: new THREE.Mesh(geo, matCaras),
    };
  }

  private regenerarReticulas(res: number): void {
    this.geoC?.dispose();
    this.geoF?.dispose();
    this.geoC = new THREE.PlaneGeometry(1, 1, res, res);
    this.geoF = new THREE.PlaneGeometry(1, 1, res, Math.max(6, Math.round(res * 0.75)));
    if (this.objC) this.objC.puntos.geometry = this.objC.alambre.geometry = this.objC.caras.geometry = this.geoC;
    if (this.objF) this.objF.puntos.geometry = this.objF.alambre.geometry = this.objF.caras.geometry = this.geoF;
  }

  // ————— Grafos TSL —————

  /** Superfórmula de Gielis en el shader, con divisores de eje a,b (por defecto 1). */
  private sr(ang: any, m: any, n1: any, n2: any, n3: any, a?: any, b?: any): any {
    const aa = a ?? float(1);
    const bb = b ?? float(1);
    const t1 = abs(cos(ang.mul(m).mul(0.25)).div(aa)).pow(n2);
    const t2 = abs(sin(ang.mul(m).mul(0.25)).div(bb)).pow(n3);
    return max(t1.add(t2), 1e-8).pow(float(-1).div(n1));
  }

  /** Clásica: pos(θ,φ) sobre la esfera paramétrica. Perfiles θ y φ independientes. */
  private posClasica(th: any, ph: any): any {
    const u = this.uC;
    const r1 = this.sr(th, u.m1, u.n1, u.n2, u.n3, u.a1, u.b1);
    const r2 = this.sr(ph, u.m2, u.n1b, u.n2b, u.n3b, u.a2, u.b2);
    // Nautilus: crecimiento radial exponencial con θ → espiral logarítmica.
    const r1e = mix(r1, r1.mul(exp(u.alfStep.mul(th))), u.nautilus);
    return vec3(
      r1e.mul(cos(th)).mul(r2).mul(cos(ph)),
      r1e.mul(sin(th)).mul(r2).mul(cos(ph)),
      r2.mul(sin(ph)).mul(u.factorZ),
    );
  }

  private coordsClasica(): { th: any; ph: any } {
    const u = this.uC;
    return {
      th: mix(u.thMin, u.thMax, uv().x),
      ph: mix(u.phMin, u.phMax, uv().y),
    };
  }

  private nodoPosClasica(): any {
    return Fn(() => {
      const { th, ph } = this.coordsClasica();
      return this.posClasica(th, ph);
    })();
  }

  /** Caras de la clásica: normal por diferencias finitas + lambert + color. */
  private nodoColorClasica(): any {
    return Fn(() => {
      const { th, ph } = this.coordsClasica();
      const e = 0.001;
      const a = this.posClasica(th, ph);
      const b = this.posClasica(th.add(e), ph);
      const c = this.posClasica(th, ph.add(e));
      return this.lambert(a, b, c).mul(this.uColor);
    })();
  }

  /** pos(t,θ) de la SuperFlor (reutilizable en posición, normal y color). */
  private posFlor(t: any, th: any): any {
    const u = this.uF;
    const sft = (q: any, p: any) => {
      const qq = p.add(q);
      return select(
        qq.lessThanEqual(0), float(0),
        select(qq.greaterThanEqual(p.mul(2)), qq.sub(p), qq.mul(qq).div(p.mul(4))),
      );
    };
    const ease = (x: any, g: any) => select(
      x.lessThan(0.5),
      x.mul(2).pow(g).mul(0.5),
      float(1).sub(float(1).sub(x).mul(2).pow(g).mul(0.5)),
    );

    const r1 = this.sr(th, u.r1m, u.r1n1, u.r1n2, u.r1n3);
    const r2 = this.sr(th, u.r2m, u.r2n1, u.r2n2, u.r2n3);
    const pp = u.rat.pow(t.mul(u.K));
    const f = ease(clamp(t.div(0.9), 0, 1), u.easeExp);
    const r = u.rmn.mul(f).add(sft(pp.mul(4), u.rmx).mul(f));
    const z = sft(pp, u.rmx).negate().add(u.zOffset).sub(u.zCurva.mul(float(1).sub(pp).pow(2)));
    const sinMap = sin(t.mul(2 * PI)).add(1).mul(0.5);
    const x = r.mul(r1).mul(cos(th)).mul(r2).mul(sin(th))
      .sub(sinMap.mul(float(1).sub(t)).pow(2).mul(u.xOffset));
    const y = r.mul(r1).mul(sin(th)).mul(r2).mul(sin(th))
      .sub(float(1).sub(t).pow(3).mul(u.yOffset)).sub(u.yBase);
    return vec3(x, y, z).mul(0.01); // la flor original vive en cientos de unidades
  }

  private coordsFlor(): { t: any; th: any } {
    return { t: uv().y, th: uv().x.mul(2 * PI) };
  }

  private nodoPosFlor(): any {
    return Fn(() => {
      const { t, th } = this.coordsFlor();
      return this.posFlor(t, th);
    })();
  }

  /** Caras de la flor: degradado verde × lambert × tinte de color. */
  private nodoColorFlor(): any {
    const u = this.uF;
    return Fn(() => {
      const { t, th } = this.coordsFlor();
      const e = 0.001;
      const a = this.posFlor(t, th);
      const b = this.posFlor(t.add(e), th);
      const c = this.posFlor(t, th.add(e));
      const luz = this.lambert(a, b, c);
      // Degradado verde: oscuro en base → vivo en punta (por Z local)
      const g = clamp(a.z.mul(100).add(u.rmx).div(u.rmn.mul(1.5)), 0, 1);
      const base = vec3(
        g.mul(0.18).add(0.04),
        g.mul(0.65).add(0.25),
        g.mul(0.1).add(0.04),
      );
      // El color del panel tiñe: blanco = degradado puro
      return base.mul(luz).mul(this.uColor);
    })();
  }

  /** Lambert manual (2 direccionales + ambiente) con normal por diferencias finitas. */
  private lambert(a: any, b: any, c: any): any {
    const nLocal = normalize(cross(b.sub(a), c.sub(a)));
    const nMundo = normalize(modelWorldMatrix.mul(vec4(nLocal, 0)).xyz).mul(faceDirection);
    const L1 = normalize(vec3(1, 3, 2));
    const L2 = normalize(vec3(-2, -1, 1));
    return vec3(0.8, 1.0, 0.867).mul(max(dot(nMundo, L1), 0).mul(1.2))
      .add(vec3(0.2, 0.4, 1.0).mul(max(dot(nMundo, L2), 0).mul(0.4)))
      .add(0.35);
  }

  // ————— Exportador (plantillas autocontenidas; siguen siendo CPU, válido para piezas sueltas) —————

  exportar(p: Params): string {
    const plantilla = (p.modo ?? 0) === 0 ? PLANTILLA_CLASICA : PLANTILLA_FLOR;
    return plantilla
      .replaceAll('__PARAMS__', JSON.stringify(p))
      .replaceAll('__RES__', '128')
      .replaceAll('__N1__', '60')
      .replaceAll('__N2__', '28');
  }
}

// ————— Plantillas del exportador (HTML autocontenido vía CDN) —————

const PLANTILLA_CLASICA = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — supershape</title>
<style>html,body{margin:0;height:100%;background:#0d0d12;overflow:hidden}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const P = __PARAMS__, RES = __RES__, D = Math.PI/180;
const sr = (t,m,n1,n2,n3,a=1,b=1) => { const r = (Math.abs(Math.cos(m*t/4)/a)**n2 + Math.abs(Math.sin(m*t/4)/b)**n3)**(-1/n1); return isFinite(r) ? r : 0; };
const thMin=(P.thMin??-180)*D, thMax=(P.thMax??180)*D, phMin=(P.phMin??-90)*D, phMax=(P.phMax??90)*D;
const naut = P.nautilus?1:0, k = P.alfStep??0.15, fZ = P.factorZ??1;
const pos = new Float32Array(RES*RES*3); let i = 0;
for (let a=0;a<RES;a++){ const th=thMin+(thMax-thMin)*a/(RES-1), r1=sr(th,P.m1,P.n1,P.n2,P.n3,P.a1,P.b1), r1e=naut?r1*Math.exp(k*th):r1;
  for (let b=0;b<RES;b++){ const ph=phMin+(phMax-phMin)*b/(RES-1), r2=sr(ph,P.m2,P.n1b??P.n1,P.n2b??P.n2,P.n3b??P.n3,P.a2,P.b2);
    pos[i++]=r1e*Math.cos(th)*r2*Math.cos(ph); pos[i++]=r1e*Math.sin(th)*r2*Math.cos(ph); pos[i++]=r2*Math.sin(ph)*fZ; }}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
const puntos = new THREE.Points(geo, new THREE.PointsMaterial({color:P.color ?? 0xdfe6ff,size:P.puntoTam,sizeAttenuation:true}));
puntos.scale.setScalar(P.escala);
const escena = new THREE.Scene(); escena.add(puntos);
const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .1, 100); cam.position.z = 6;
const r = new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.appendChild(r.domElement);
const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true;
const reloj = new THREE.Clock();
r.setAnimationLoop(()=>{ puntos.rotation.y += P.giro*reloj.getDelta(); ctl.update(); r.render(escena,cam); });
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth,innerHeight); });
</script></body></html>`;

const PLANTILLA_FLOR = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — superflor</title>
<style>html,body{margin:0;height:100%;background:#060608;overflow:hidden}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const P = __PARAMS__, N1 = __N1__, N2 = __N2__, E = 0.01;
const sr = (t,m,n1,n2,n3) => { const r = (Math.abs(Math.cos(m*t/4))**n2 + Math.abs(Math.sin(m*t/4))**n3)**(-1/n1); return isFinite(r) ? r : 0; };
const sft = (q,p) => { const qq=p+q; return qq<=0 ? 0 : qq>=2*p ? qq-p : qq*qq/(4*p); };
const ease = (p,g) => p<0.5 ? 0.5*(2*p)**g : 1-0.5*(2*(1-p))**g;
function pos(t, th) {
  const r1 = sr(th,P.r1m,P.r1n1,P.r1n2,P.r1n3), r2 = sr(th,P.r2m,P.r2n1,P.r2n2,P.r2n3);
  const pp = P.rat**(t*P.K), f = ease(Math.max(0,Math.min(1,t/0.9)), P.easeExp);
  const r = P.rmn*f + sft(4*pp,P.rmx)*f;
  const z = -sft(pp,P.rmx) + P.zOffset - P.zCurva*(1-pp)**2;
  const sm = (Math.sin(Math.PI*2*t)+1)/2;
  return [ (r*r1*Math.cos(th)*r2*Math.sin(th) - (sm*(1-t))**2*P.xOffset)*E,
           (r*r1*Math.sin(th)*r2*Math.sin(th) - (1-t)**3*P.yOffset - P.yBase)*E,
           z*E ];
}
function nor(t, th) {
  const e=0.001, a=pos(t,th), b=pos(t+e,th), c=pos(t,th+e);
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const n=[u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
  const L=Math.hypot(...n)||1; return n.map(v=>v/L);
}
const ps=[], ns=[], cs=[];
const put = (v,t,th) => { ps.push(...v); ns.push(...nor(t,th));
  const g = Math.max(0,Math.min(1,(v[2]/E+P.rmx)/(P.rmn*1.5)));
  cs.push(0.04+0.18*g, 0.25+0.65*g, 0.04+0.1*g); };
for (let i=0;i<N1;i++){ const t1=i/N1, t2=(i+1)/N1;
  for (let j=0;j<N2;j++){ const th=Math.PI*2*j/N2, tn=Math.PI*2*(j+1)/N2;
    const A=pos(t1,th),B=pos(t2,th),C=pos(t1,tn),D=pos(t2,tn);
    put(A,t1,th); put(B,t2,th); put(C,t1,tn); put(B,t2,th); put(D,t2,tn); put(C,t1,tn); }}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(ps,3));
geo.setAttribute('normal',   new THREE.Float32BufferAttribute(ns,3));
geo.setAttribute('color',    new THREE.Float32BufferAttribute(cs,3));
const flor = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({vertexColors:true, side:THREE.DoubleSide, shininess:80, specular:new THREE.Color(0x335533)}));
flor.rotation.x = 2.97;
const grupo = new THREE.Group(); grupo.add(flor); grupo.scale.setScalar(P.escala);
const escena = new THREE.Scene(); escena.add(grupo);
escena.add(new THREE.AmbientLight(0xffffff, 0.35));
const l1 = new THREE.DirectionalLight(0xccffdd, 1.2); l1.position.set(1,3,2); escena.add(l1);
const l2 = new THREE.DirectionalLight(0x3366ff, 0.4); l2.position.set(-2,-1,1); escena.add(l2);
const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .1, 100); cam.position.z = 6;
const r = new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.appendChild(r.domElement);
const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true;
const reloj = new THREE.Clock();
r.setAnimationLoop(()=>{ grupo.rotation.y += P.giro*reloj.getDelta(); ctl.update(); r.render(escena,cam); });
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth,innerHeight); });
</script></body></html>`;
