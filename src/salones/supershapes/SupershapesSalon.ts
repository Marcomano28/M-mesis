// Salón 1 — Formas Exóticas. Tres figuras (pestañas):
//
//   · Clásica   — supershape cerrada (esférica).
//   · SuperFlor — superficie ABIERTA combinada (r1·r2) del proyecto supeFlower.
//   · Serpiente — cuerpo orgánico animado (ruido simplex + envolvente de vida)
//                 del mismo proyecto supeFlower. r1 en X, r2 en Y (separadas).
//
// Cada figura tiene TRES modos de exposición: puntos, alambre y caras,
// más resolución variable y color — los atributos que heredan las fichas.
//
// ★ GPU: Clásica y SuperFlor son retículas (u,v) estáticas evaluadas en el
//   vertex/fragment shader desde uniforms; solo la RESOLUCIÓN regenera el grid.
// ★ CPU: la Serpiente es geometría reconstruida cada frame (ruido + azar por
//   instancia + scroll temporal), fiel al sketch original de Processing.

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec3, vec4, uv, mix, abs, sin, cos, exp, max,
  clamp, select, normalize, cross, dot, faceDirection, modelWorldMatrix, attribute,
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
    {
      titulo: 'Serpiente',
      params: [
        // fase = reloj del scroll. Base 0 → congelada mientras modelas (slider = posar).
        // En el Escenario cada actor avanza su propia fase (hidratación en escena).
        { clave: 'fase',      etiqueta: 'fase (posar)',    valor: 0,     min: 0,   max: 20 },
        { clave: 'velocidad', etiqueta: 'velocidad (escena)', valor: 0.3, min: 0,  max: 2 },
        { clave: 'sR',        etiqueta: 'radio (R)',       valor: 200,   min: 50,  max: 400,  paso: 1 },
        { clave: 'sZ',        etiqueta: 'largo (Z)',       valor: 1000,  min: 200, max: 2000, paso: 10 },
        { clave: 'sTrn',      etiqueta: 'giro perfil',     valor: 3.4,   min: 0,   max: 6.283 },
        { clave: 'sMV',       etiqueta: 'vida desde',      valor: -0.15, min: -1,  max: 0 },
        { clave: 'sMXV',      etiqueta: 'vida hasta',      valor: 1.35,  min: 0.5, max: 2 },
        // — Retícula de instancias (recrea buffers al cambiar) —
        { clave: 'sN1',       etiqueta: 'aros (N1)',       valor: 30,    min: 6,   max: 60,  paso: 1 },
        { clave: 'sN',        etiqueta: 'gajos (N)',       valor: 12,    min: 3,   max: 24,  paso: 1 },
        { clave: 'sN2',       etiqueta: 'longitud (N2)',   valor: 80,    min: 20,  max: 160, paso: 1 },
        // — Perfil r1 (eje X) —
        { clave: 'sr1m',  etiqueta: 'r1 · m',  valor: 5,   min: 1,    max: 20, paso: 1 },
        { clave: 'sr1n1', etiqueta: 'r1 · n1', valor: 0.1, min: 0.01, max: 5 },
        { clave: 'sr1n2', etiqueta: 'r1 · n2', valor: 1.7, min: 0.01, max: 5 },
        { clave: 'sr1n3', etiqueta: 'r1 · n3', valor: 1.7, min: 0.01, max: 5 },
        // — Perfil r2 (eje Y) —
        { clave: 'sr2m',  etiqueta: 'r2 · m',  valor: 7,   min: 1,    max: 20, paso: 1 },
        { clave: 'sr2n1', etiqueta: 'r2 · n1', valor: 0.3, min: 0.01, max: 5 },
        { clave: 'sr2n2', etiqueta: 'r2 · n2', valor: 0.5, min: 0.01, max: 5 },
        { clave: 'sr2n3', etiqueta: 'r2 · n3', valor: 0.5, min: 0.01, max: 5 },
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

  // — Serpiente: geometría CPU animada (no usa positionNode) —
  private objS: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private geoS: THREE.BufferGeometry | null = null;
  private posS: Float32Array | null = null;
  private colS: Float32Array | null = null;
  private noise2D = makeNoise2D();
  private instS: DtInstance[] = [];
  private serpCounts = { N1: 0, N: 0, N2: 0 };
  private serpFirma = ''; // evita reconstruir la malla si nada cambió (congelada = estática)

  init(escena: THREE.Scene): void {
    this.objC = this.crearRepresentaciones(this.nodoPosClasica(), this.nodoColorClasica());
    this.objF = this.crearRepresentaciones(this.nodoPosFlor(), this.nodoColorFlor());
    this.objF.puntos.rotation.x = this.objF.alambre.rotation.x = this.objF.caras.rotation.x = 2.97;
    this.objS = this.crearSerpiente();
    for (const o of [this.objS.puntos, this.objS.alambre, this.objS.caras]) {
      o.rotation.set(Math.PI * 0.9, Math.PI * 0.65, 0);
    }
    for (const o of [this.objC, this.objF, this.objS]) this.grupo.add(o.puntos, o.alambre, o.caras);
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
    const modo = p.modo === 2 ? 2 : p.modo === 1 ? 1 : 0;
    const vista = p.vista === 1 ? 1 : p.vista === 2 ? 2 : 0;
    const aplicar = (o: typeof this.objC, activa: boolean) => {
      if (!o) return;
      o.puntos.visible = activa && vista === VISTA.Puntos;
      o.alambre.visible = activa && vista === VISTA.Alambre;
      o.caras.visible = activa && vista === VISTA.Caras;
    };
    aplicar(this.objC, modo === 0);
    aplicar(this.objF, modo === 1);
    aplicar(this.objS, modo === 2);

    // — Serpiente: solo se reconstruye (CPU) mientras su pestaña está activa —
    if (modo === 2) this.actualizarSerpiente(p);

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
    this.geoS?.dispose();
    for (const o of [this.objC, this.objF, this.objS]) {
      if (!o) continue;
      (o.puntos.material as THREE.Material).dispose();
      (o.alambre.material as THREE.Material).dispose();
      (o.caras.material as THREE.Material).dispose();
    }
    this.objC = this.objF = this.objS = null;
    this.geoS = this.posS = this.colS = null;
    this.instS = [];
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

  // ————— Serpiente (CPU animada) —————

  private crearSerpiente() {
    const geo = new THREE.BufferGeometry(); // se dimensiona en regenerarSerpiente

    const matPuntos = new THREE.PointsNodeMaterial();
    matPuntos.colorNode = this.uColor;

    const matAlambre = new THREE.MeshBasicNodeMaterial({ wireframe: true, transparent: true, opacity: 0.5 });
    matAlambre.colorNode = this.uColor;

    const matCaras = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    matCaras.colorNode = attribute('color', 'vec3').mul(this.uColor); // color por vértice × tinte del panel

    return {
      puntos: new THREE.Points(geo, matPuntos),
      alambre: new THREE.Mesh(geo, matAlambre),
      caras: new THREE.Mesh(geo, matCaras),
    };
  }

  private regenerarSerpiente(N1: number, N: number, N2: number): void {
    const K = Math.ceil(N2 / N);
    const verts = N1 * N * K * 4 * 3; // instancias × K × 4 triángulos × 3 vértices
    this.geoS?.dispose();
    this.posS = new Float32Array(verts * 3);
    this.colS = new Float32Array(verts * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posS, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colS, 3));
    this.geoS = geo;
    if (this.objS) this.objS.puntos.geometry = this.objS.alambre.geometry = this.objS.caras.geometry = geo;
    this.instS = makeDtInstances(N1, N); // semillas/azar por instancia: se recalculan al cambiar el conteo
    this.serpCounts = { N1, N, N2 };
  }

  private actualizarSerpiente(p: Params): void {
    const N1 = Math.max(6, Math.round(p.sN1 ?? 30));
    const N = Math.max(3, Math.round(p.sN ?? 12));
    const N2 = Math.max(20, Math.round(p.sN2 ?? 80));
    if (N1 !== this.serpCounts.N1 || N !== this.serpCounts.N || N2 !== this.serpCounts.N2) {
      this.regenerarSerpiente(N1, N, N2);
    }
    // El scroll viene de la BASE `fase` (0 = congelada mientras modelas). El salón
    // NO tiene reloj propio: en el Escenario cada actor avanzará su fase (hidratación).
    const t = p.fase ?? 0;
    const cfg: SerpCfg = {
      R: p.sR ?? 200, Z: p.sZ ?? 1000, trn: p.sTrn ?? 3.4,
      MV: p.sMV ?? -0.15, MXV: p.sMXV ?? 1.35,
      N1, N, N2, K: Math.ceil(N2 / N),
      r1: [p.sr1m ?? 5, p.sr1n1 ?? 0.1, p.sr1n2 ?? 1.7, p.sr1n3 ?? 1.7],
      r2: [p.sr2m ?? 7, p.sr2n1 ?? 0.3, p.sr2n2 ?? 0.5, p.sr2n3 ?? 0.5],
    };
    // Congelada + parámetros sin tocar → no reconstruimos (malla estática, sin gasto CPU).
    const firma = `${t}|${N1},${N},${N2}|${cfg.R},${cfg.Z},${cfg.trn},${cfg.MV},${cfg.MXV}|${cfg.r1}|${cfg.r2}`;
    if (firma === this.serpFirma && this.geoS) return;
    this.serpFirma = firma;
    buildTriangles(this.instS, t, this.noise2D, this.posS!, this.colS!, cfg);
    (this.geoS!.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geoS!.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.geoS!.computeBoundingSphere();
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
    const modo = p.modo ?? 0;
    const plantilla = modo === 2 ? PLANTILLA_SERPIENTE : modo === 1 ? PLANTILLA_FLOR : PLANTILLA_CLASICA;
    return plantilla
      .replaceAll('__PARAMS__', JSON.stringify(p))
      .replaceAll('__RES__', '128')
      .replaceAll('__N1__', '60')
      .replaceAll('__N2__', '28');
  }
}

// ————— Serpiente: helpers CPU (port de supeFlower/Serpiente.tsx) —————

interface DtInstance { seed: number; off: number; di: number; i: number; j: number }

interface SerpCfg {
  R: number; Z: number; trn: number; MV: number; MXV: number;
  N1: number; N: number; N2: number; K: number;
  r1: [number, number, number, number];
  r2: [number, number, number, number];
}

/** Ruido simplex 2D inline (equivalente al OpenSimplexNoise del sketch original). */
function makeNoise2D(): (x: number, y: number) => number {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const grad3 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [1, 0], [-1, 0],
    [0, 1], [0, -1], [0, 1], [0, -1],
  ];
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = Array.from({ length: 512 }, (_, i) => p[i & 255]);

  return function noise2D(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const dot = (gi: number, x: number, y: number) => {
      const g = grad3[gi % 12];
      return g[0] * x + g[1] * y;
    };
    const gi0 = perm[ii + perm[jj]];
    const gi1 = perm[ii + i1 + perm[jj + j1]];
    const gi2 = perm[ii + 1 + perm[jj + 1]];
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot(gi0, x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot(gi1, x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot(gi2, x2, y2); }
    return 70 * (n0 + n1 + n2); // rango [-1, 1]
  };
}

function makeDtInstances(N1: number, N: number): DtInstance[] {
  const arr: DtInstance[] = [];
  for (let i = 0; i < N1; i++) {
    for (let j = 0; j < N; j++) {
      arr.push({
        seed: 10 + Math.random() * 990,
        off: 0.4 + 0.8 * (Math.random() * 2 - 1),
        di: 120 + Math.random() * 680,
        i, j,
      });
    }
  }
  return arr;
}

/** Superfórmula de Gielis canónica (m dentro de la trigonometría), como en el sketch. */
function supN(ang: number, m: number, n1: number, n2: number, n3: number): number {
  const t1 = Math.pow(Math.abs(Math.cos(ang * m / 4)), n2);
  const t2 = Math.pow(Math.abs(Math.sin(ang * m / 4)), n3);
  const r = Math.pow(t1 + t2, -1 / n1);
  return isFinite(r) ? r : 0;
}

function mapV(v: number, a: number, b: number, c: number, d: number): number {
  return c + (v - a) / (b - a) * (d - c);
}

function clampN(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

type Vec3 = [number, number, number];

/** pos(r, p, th): r1 modula X, r2 modula Y (perfiles independientes). */
function posSerp(r: number, p: number, th: number, cfg: SerpCfg): Vec3 {
  const r1 = supN(th, cfg.r1[0], cfg.r1[1], cfg.r1[2], cfg.r1[3]);
  const r2 = supN(th, cfg.r2[0], cfg.r2[1], cfg.r2[2], cfg.r2[3]);
  const x = r * r1 * Math.cos(th + cfg.trn) - Math.pow(1 - p, 2) * 500 + 200;
  const y = r * r2 * Math.sin(th + cfg.trn) + 100 * Math.sin(Math.PI * 2 * p);
  const z = -cfg.Z * (1 - p) + 50 * Math.sin(Math.PI * 2 * p) + 120;
  return [x, y, z];
}

function lerpV(a: Vec3, b: Vec3, q: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
}

/** Reconstruye todos los triángulos (equivale a show() de la clase dt en el sketch). */
function buildTriangles(
  instances: DtInstance[], t: number,
  noise2D: (x: number, y: number) => number,
  posArr: Float32Array, colArr: Float32Array, cfg: SerpCfg,
): void {
  const { R, MV, MXV, N1, N, N2, K } = cfg;
  const SC = 0.01; // la serpiente vive en cientos de unidades: la traemos a la escala del salón
  let idx = 0;

  for (const { seed, off, di, i, j } of instances) {
    for (let k = 0; k < K; k++) {
      const ind = j + (t + k) * N;
      const p0 = mapV(ind + 0.5, 0, N2, MV, MXV);
      const p1 = mapV(ind, 0, N2, MV, MXV);
      const p2 = mapV(ind + 1, 0, N2, MV, MXV);
      const th0 = Math.PI * 2 * (i + 0.5) / N1;
      const th1 = Math.PI * 2 * i / N1;
      const th2 = Math.PI * 2 * (i + 1) / N1;

      const parVal = Math.pow(1 - clampN(2 * p0 - off, 0, 1), 3.3); // envolvente de vida
      const rNoise = mapV(noise2D(seed + 2.0 * p0, 0), -1, 1, 0, 1);
      const rVal = R - 20 - 180 * Math.pow(rNoise, 5);
      const d = di * parVal;
      const q = clampN(parVal + 0.05, 0, 1);

      const v0 = posSerp(rVal + d, p0, th0, cfg);
      const v1 = lerpV(posSerp(R + d, p1, th1, cfg), v0, q);
      const v2 = lerpV(posSerp(R + d, p2, th1, cfg), v0, q);
      const v3 = lerpV(posSerp(R + d, p2, th2, cfg), v0, q);
      const v4 = lerpV(posSerp(R + d, p1, th2, cfg), v0, q);

      const coladd = 900 * Math.pow(mapV(noise2D(2 * seed + 2.5 * p0, 0), -1, 1, 0, 1), 8);
      const coladd2 = 200 * Math.pow(mapV(noise2D(2 * seed + 9.5 * p0, 0), -1, 1, 0, 1), 6);
      const bright = clampN((5 + 0.2 * coladd + 0.8 * coladd2 - (1 - p0) * 130) / 255, 0, 1);
      const cr = bright, cg = bright * 1.05, cb = bright * 0.75;

      const tris: Vec3[][] = [[v0, v1, v2], [v0, v3, v2], [v0, v3, v4], [v0, v1, v4]];
      for (const tri of tris) {
        for (const v of tri) {
          posArr[idx * 3] = v[0] * SC;
          posArr[idx * 3 + 1] = v[1] * SC;
          posArr[idx * 3 + 2] = v[2] * SC;
          colArr[idx * 3] = cr;
          colArr[idx * 3 + 1] = cg;
          colArr[idx * 3 + 2] = cb;
          idx++;
        }
      }
    }
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

const PLANTILLA_SERPIENTE = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — serpiente</title>
<style>html,body{margin:0;height:100%;background:#060608;overflow:hidden}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const P = __PARAMS__, SC = 0.01;
const N1 = Math.round(P.sN1 ?? 30), N = Math.round(P.sN ?? 12), N2 = Math.round(P.sN2 ?? 80), K = Math.ceil(N2/N);
const R = P.sR ?? 200, Z = P.sZ ?? 1000, TRN = P.sTrn ?? 3.4, MV = P.sMV ?? -0.15, MXV = P.sMXV ?? 1.35;
const R1 = [P.sr1m??5,P.sr1n1??0.1,P.sr1n2??1.7,P.sr1n3??1.7], R2 = [P.sr2m??7,P.sr2n1??0.3,P.sr2n2??0.5,P.sr2n3??0.5];
function makeNoise2D(){ const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
  const g3=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
  const pp=Array.from({length:256},(_,i)=>i); for(let i=255;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pp[i],pp[j]]=[pp[j],pp[i]];}
  const perm=Array.from({length:512},(_,i)=>pp[i&255]);
  return (xin,yin)=>{ const s=(xin+yin)*F2,i=Math.floor(xin+s),j=Math.floor(yin+s),t=(i+j)*G2;
    const x0=xin-(i-t),y0=yin-(j-t),i1=x0>y0?1:0,j1=x0>y0?0:1,x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255;
    const dot=(gi,x,y)=>{const g=g3[gi%12];return g[0]*x+g[1]*y;};
    const gi0=perm[ii+perm[jj]],gi1=perm[ii+i1+perm[jj+j1]],gi2=perm[ii+1+perm[jj+1]];
    let n0=0,n1=0,n2=0,t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0;n0=t0*t0*dot(gi0,x0,y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1;n1=t1*t1*dot(gi1,x1,y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2;n2=t2*t2*dot(gi2,x2,y2);}
    return 70*(n0+n1+n2); };
}
const noise2D = makeNoise2D();
const sup=(a,m,n1,n2,n3)=>{const r=(Math.abs(Math.cos(a*m/4))**n2+Math.abs(Math.sin(a*m/4))**n3)**(-1/n1);return isFinite(r)?r:0;};
const mapV=(v,a,b,c,d)=>c+(v-a)/(b-a)*(d-c), clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function pos(r,p,th){ const r1=sup(th,R1[0],R1[1],R1[2],R1[3]),r2=sup(th,R2[0],R2[1],R2[2],R2[3]);
  return new THREE.Vector3(r*r1*Math.cos(th+TRN)-(1-p)**2*500+200, r*r2*Math.sin(th+TRN)+100*Math.sin(Math.PI*2*p), -Z*(1-p)+50*Math.sin(Math.PI*2*p)+120); }
const inst=[]; for(let i=0;i<N1;i++)for(let j=0;j<N;j++) inst.push({seed:10+Math.random()*990,off:0.4+0.8*(Math.random()*2-1),di:120+Math.random()*680,i,j});
const V = N1*N*K*4*3, posArr = new Float32Array(V*3), colArr = new Float32Array(V*3);
function build(t){ let idx=0;
  for(const {seed,off,di,i,j} of inst){ for(let k=0;k<K;k++){ const ind=j+(t+k)*N;
    const p0=mapV(ind+0.5,0,N2,MV,MXV),p1=mapV(ind,0,N2,MV,MXV),p2=mapV(ind+1,0,N2,MV,MXV);
    const th0=Math.PI*2*(i+0.5)/N1,th1=Math.PI*2*i/N1,th2=Math.PI*2*(i+1)/N1;
    const par=(1-clamp(2*p0-off,0,1))**3.3, rn=mapV(noise2D(seed+2*p0,0),-1,1,0,1), rV=R-20-180*rn**5, d=di*par, q=clamp(par+0.05,0,1);
    const v0=pos(rV+d,p0,th0), v1=pos(R+d,p1,th1).lerp(v0,q), v2=pos(R+d,p2,th1).lerp(v0,q), v3=pos(R+d,p2,th2).lerp(v0,q), v4=pos(R+d,p1,th2).lerp(v0,q);
    const ca=900*mapV(noise2D(2*seed+2.5*p0,0),-1,1,0,1)**8, cb2=200*mapV(noise2D(2*seed+9.5*p0,0),-1,1,0,1)**6;
    const br=clamp((5+0.2*ca+0.8*cb2-(1-p0)*130)/255,0,1);
    for(const [a,b,c] of [[v0,v1,v2],[v0,v3,v2],[v0,v3,v4],[v0,v1,v4]]) for(const v of [a,b,c]){
      posArr[idx*3]=v.x*SC; posArr[idx*3+1]=v.y*SC; posArr[idx*3+2]=v.z*SC;
      colArr[idx*3]=br; colArr[idx*3+1]=br*1.05; colArr[idx*3+2]=br*0.75; idx++; }
  }}
}
const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.BufferAttribute(posArr,3));
geo.setAttribute('color',new THREE.BufferAttribute(colArr,3));
const malla=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
malla.rotation.set(Math.PI*0.9,Math.PI*0.65,0);
const grupo=new THREE.Group(); grupo.add(malla); grupo.scale.setScalar(P.escala);
const escena=new THREE.Scene(); escena.add(grupo);
const cam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,100); cam.position.z=6;
const r=new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.appendChild(r.domElement);
const ctl=new OrbitControls(cam,r.domElement); ctl.enableDamping=true;
const reloj=new THREE.Clock(); let t=P.fase??0;
r.setAnimationLoop(()=>{ const dt=reloj.getDelta(); t+=dt*(P.velocidad??0.3); build(t);
  geo.getAttribute('position').needsUpdate=true; geo.getAttribute('color').needsUpdate=true; geo.computeBoundingSphere();
  grupo.rotation.y += (P.giro??0)*dt; ctl.update(); r.render(escena,cam); });
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth,innerHeight); });
</script></body></html>`;
