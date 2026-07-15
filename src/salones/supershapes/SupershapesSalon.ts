// Salón 1 — Formas Exóticas. Cuatro familias (pestañas):
//
//   · Clásica   — supershape cerrada (esférica).
//   · SuperFlor — superficie ABIERTA combinada (r1·r2) del proyecto supeFlower.
//   · Serpiente — cuerpo orgánico animado (ruido simplex + envolvente de vida)
//                 del mismo proyecto supeFlower. r1 en X, r2 en Y (separadas).
//   · Caracol   — concha paramétrica con variantes de piel: peludo, picos y moro.
//
// Cada figura tiene TRES modos de exposición: puntos, alambre y caras,
// más resolución variable y color — los atributos que heredan las fichas.
//
// ★ GPU: Clásica y SuperFlor son retículas (u,v) estáticas evaluadas en el
//   vertex/fragment shader desde uniforms; solo la RESOLUCIÓN regenera el grid.
// ★ GPU: la Serpiente hornea identidad por vértice y evalúa posición/color en
//   shaders desde uniforms, ruido y atributos estáticos.

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec3, vec4, uv, mix, abs, sin, cos, exp, max,
  clamp, select, normalize, cross, dot, faceDirection, modelWorldMatrix, attribute, mx_noise_float, fract,
} from 'three/tsl';
import type { Salon, Params, ParamDef, Pestana } from '../../core/Salon';

const PI = Math.PI;
const VISTA = { Puntos: 0, Alambre: 1, Caras: 2 };
const CARACOL = { Peludo: 0, Picos: 1, Moro: 2 };

export class SupershapesSalon implements Salon {
  id = 'supershapes';
  nombre = 'Formas Exóticas';

  params: ParamDef[] = [
    { clave: 'escala',     etiqueta: 'escala',     valor: 2,    min: 0.2, max: 5 },
    { clave: 'giro',       etiqueta: 'giro',       valor: 0, min: -2,  max: 2 },
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
    {
      titulo: 'Caracol',
      params: [
        { clave: 'cVariante', etiqueta: 'variante', valor: 0, min: 0, max: 2, opciones: CARACOL },
        { clave: 'cFase',     etiqueta: 'fase',     valor: 0,    min: 0,    max: 20 },
        { clave: 'cVel',      etiqueta: 'velocidad', valor: 0.2, min: 0,    max: 2 },
        { clave: 'cRadio',    etiqueta: 'radio',    valor: 14,   min: 4,    max: 40 },
        { clave: 'cVueltas',  etiqueta: 'vueltas',  valor: 2,    min: 0.5,  max: 5 },
        { clave: 'cZ',        etiqueta: 'curva Z',  valor: 1.4,  min: 0.5,  max: 2.5 },
        { clave: 'cPiel',     etiqueta: 'piel',     valor: 1,    min: 0,    max: 1, opciones: { No: 0, 'Sí': 1 } },
        { clave: 'cGotas',    etiqueta: 'gotas',    valor: 1,    min: 0,    max: 1, opciones: { No: 0, 'Sí': 1 } },
        { clave: 'cIntensidad', etiqueta: 'intensidad', valor: 1, min: -2,   max: 2 },
        { clave: 'cRuido',    etiqueta: 'ruido',    valor: 0.6,  min: 0,    max: 2 },
        { clave: 'cDensidad', etiqueta: 'densidad piel', valor: 0.7, min: 0.1, max: 1 },
        { clave: 'cGrosor',   etiqueta: 'grosor',   valor: 0.025, min: 0.002, max: 0.12 },
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
  // Serpiente: mismo modelo GPU que las demás. La geometría es estática (identidad
  // por vértice horneada en atributos); todo se evalúa en el shader desde estos uniforms.
  private uS = {
    fase: uniform(0), R: uniform(200), Z: uniform(1000), trn: uniform(3.4),
    MV: uniform(-0.15), MXV: uniform(1.35),
    N1: uniform(30), N: uniform(12), N2: uniform(80),
    r1m: uniform(5), r1n1: uniform(0.1), r1n2: uniform(1.7), r1n3: uniform(1.7),
    r2m: uniform(7), r2n1: uniform(0.3), r2n2: uniform(0.5), r2n3: uniform(0.5),
  };
  private uColor = uniform(new THREE.Color(0xdfe6ff));

  private grupo = new THREE.Group();
  // 3 representaciones por figura, compartiendo retícula y grafo de posición
  private objC: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private objF: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private objCar: {
    puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh;
    pelo: THREE.Mesh; gotas: THREE.Mesh; moro: THREE.Mesh;
  } | null = null;
  private geoC: THREE.BufferGeometry | null = null;
  private geoF: THREE.BufferGeometry | null = null;
  private geoCar: THREE.BufferGeometry | null = null;
  private geoCarPelo: THREE.BufferGeometry | null = null;
  private geoCarGotas: THREE.BufferGeometry | null = null;
  private geoCarMoro: THREE.BufferGeometry | null = null;
  private resActual = 0;

  // — Serpiente: geometría GPU. Solo el conteo derivado de resolución regenera atributos. —
  private objS: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private geoS: THREE.BufferGeometry | null = null;
  private serpCounts = { N1: 0, N: 0, N2: 0 };
  private uCar = {
    variante: uniform(0), fase: uniform(0), R: uniform(14), vueltas: uniform(2), zExp: uniform(1.4),
    piel: uniform(1), gotas: uniform(1), intensidad: uniform(1), ruido: uniform(0.6), densidad: uniform(0.7), grosor: uniform(0.025),
    nTh: uniform(56), nPh: uniform(26), kPelo: uniform(9),
  };
  private caracolCounts = { nTh: 0, nPh: 0 };
  private caracolFase = 0;

  /**
   * Sin argumento funciona como camerino y prepara las cuatro familias.
   * En El Escenario recibe la familia congelada de la ficha y construye solo
   * ese actor; evita reservar las otras tres geometrías y sus materiales.
   */
  constructor(private modoActor?: number) {}

  init(escena: THREE.Scene): void {
    const quiere = (modo: number) => this.modoActor === undefined || this.modoActor === modo;
    if (quiere(0)) {
      this.objC = this.crearRepresentaciones(this.nodoPosClasica(), this.nodoColorClasica());
      this.grupo.add(this.objC.puntos, this.objC.alambre, this.objC.caras);
    }
    if (quiere(1)) {
      this.objF = this.crearRepresentaciones(this.nodoPosFlor(), this.nodoColorFlor());
      this.objF.puntos.rotation.x = this.objF.alambre.rotation.x = this.objF.caras.rotation.x = 2.97;
      this.grupo.add(this.objF.puntos, this.objF.alambre, this.objF.caras);
    }
    if (quiere(2)) {
      this.objS = this.crearSerpiente();
      for (const o of [this.objS.puntos, this.objS.alambre, this.objS.caras]) {
        o.rotation.set(Math.PI * 0.9, Math.PI * 0.65, 0);
        o.frustumCulled = false; // las posiciones vienen del shader: la cota CPU no las conoce
      }
      this.regenerarSerpiente(...this.conteosSerpiente(256));
      this.grupo.add(this.objS.puntos, this.objS.alambre, this.objS.caras);
    }
    if (quiere(3)) {
      this.objCar = this.crearCaracol();
      for (const o of [this.objCar.puntos, this.objCar.alambre, this.objCar.caras, this.objCar.pelo, this.objCar.gotas, this.objCar.moro]) {
        o.rotation.set(-Math.PI * 0.56, 0, Math.PI * 0.95);
        o.frustumCulled = false;
      }
      this.regenerarCaracol(...this.conteosCaracol(256));
      this.grupo.add(
        this.objCar.puntos, this.objCar.alambre, this.objCar.caras,
        this.objCar.pelo, this.objCar.gotas, this.objCar.moro,
      );
    }
    escena.add(this.grupo);
    this.resActual = 0; // fuerza regeneración de retícula en el primer update
  }

  update(dt: number, _t: number, p: Params): void {
    // — Visibilidad: figura activa (pestaña) × modo de exposición —
    const modo = p.modo === 3 ? 3 : p.modo === 2 ? 2 : p.modo === 1 ? 1 : 0;
    const vista = p.vista === 1 ? 1 : p.vista === 2 ? 2 : 0;

    // — Retícula de Clásica/SuperFlor: solo se regenera si su resolución cambió.
    // Serpiente usa la misma resolución, pero con una topología propia.
    const res = Math.max(8, Math.round(p.resolucion ?? 256));
    if (modo !== 2 && res !== this.resActual) {
      this.resActual = res;
      this.regenerarReticulas(res);
    }

    const aplicar = (o: typeof this.objC, activa: boolean) => {
      if (!o) return;
      o.puntos.visible = activa && vista === VISTA.Puntos;
      o.alambre.visible = activa && vista === VISTA.Alambre;
      o.caras.visible = activa && vista === VISTA.Caras;
    };
    aplicar(this.objC, modo === 0);
    aplicar(this.objF, modo === 1);
    aplicar(this.objS, modo === 2);
    aplicar(this.objCar, modo === 3);

    // — Serpiente: solo actualiza uniforms y, si cambió la resolución, atributos estáticos —
    if (modo === 2) this.actualizarSerpiente(p, res);
    if (modo === 3) this.actualizarCaracol(dt, p, res);
    this.actualizarVisibilidadCaracol(modo, p);

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
    this.geoCar?.dispose();
    this.geoCarPelo?.dispose();
    this.geoCarGotas?.dispose();
    this.geoCarMoro?.dispose();
    for (const o of [this.objC, this.objF, this.objS]) {
      if (!o) continue;
      (o.puntos.material as THREE.Material).dispose();
      (o.alambre.material as THREE.Material).dispose();
      (o.caras.material as THREE.Material).dispose();
    }
    if (this.objCar) {
      (this.objCar.puntos.material as THREE.Material).dispose();
      (this.objCar.alambre.material as THREE.Material).dispose();
      (this.objCar.caras.material as THREE.Material).dispose();
      (this.objCar.pelo.material as THREE.Material).dispose();
      (this.objCar.gotas.material as THREE.Material).dispose();
      (this.objCar.moro.material as THREE.Material).dispose();
    }
    this.objC = this.objF = this.objS = this.objCar = null;
    this.geoS = this.geoCar = this.geoCarPelo = this.geoCarGotas = this.geoCarMoro = null;
    this.caracolCounts = { nTh: 0, nPh: 0 };
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
    this.geoC = this.objC ? new THREE.PlaneGeometry(1, 1, res, res) : null;
    this.geoF = this.objF ? new THREE.PlaneGeometry(1, 1, res, Math.max(6, Math.round(res * 0.75))) : null;
    if (this.objC && this.geoC) this.objC.puntos.geometry = this.objC.alambre.geometry = this.objC.caras.geometry = this.geoC;
    if (this.objF && this.geoF) this.objF.puntos.geometry = this.objF.alambre.geometry = this.objF.caras.geometry = this.geoF;
  }

  // ————— Caracol (GPU: identidad horneada, posición/color en shader) —————

  private crearCaracol() {
    const geo = new THREE.BufferGeometry();
    const pos = this.nodoPosCaracol();

    const matPuntos = new THREE.PointsNodeMaterial();
    matPuntos.positionNode = pos;
    matPuntos.colorNode = this.nodoColorCaracol();

    const matAlambre = new THREE.MeshBasicNodeMaterial({ wireframe: true, transparent: true, opacity: 0.5 });
    matAlambre.positionNode = pos;
    matAlambre.colorNode = this.uColor;

    const matCaras = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    matCaras.positionNode = pos;
    matCaras.colorNode = this.nodoColorCaracol();

    const matPelo = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false });
    matPelo.positionNode = this.nodoPosPeloCaracol();
    matPelo.colorNode = vec3(0.92, 0.94, 0.86);

    const matGotas = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    matGotas.positionNode = this.nodoPosGotaCaracol();
    matGotas.colorNode = this.nodoColorGotaCaracol();

    const matMoro = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false });
    matMoro.positionNode = this.nodoPosMoroCaracol();
    matMoro.colorNode = this.nodoColorMoroCaracol();

    return {
      puntos: new THREE.Points(geo, matPuntos),
      alambre: new THREE.Mesh(geo, matAlambre),
      caras: new THREE.Mesh(geo, matCaras),
      pelo: new THREE.Mesh(new THREE.BufferGeometry(), matPelo),
      gotas: new THREE.Mesh(new THREE.BufferGeometry(), matGotas),
      moro: new THREE.Mesh(new THREE.BufferGeometry(), matMoro),
    };
  }

  private actualizarCaracol(dt: number, p: Params, res: number): void {
    const [nTh, nPh] = this.conteosCaracol(res);
    if (nTh !== this.caracolCounts.nTh || nPh !== this.caracolCounts.nPh) {
      this.regenerarCaracol(nTh, nPh);
    }
    this.caracolFase += dt * (p.cVel ?? 0.2);
    const u = this.uCar;
    u.variante.value = p.cVariante === 2 ? 2 : p.cVariante === 1 ? 1 : 0;
    u.fase.value = (p.cFase ?? 0) + this.caracolFase;
    u.R.value = p.cRadio ?? 14;
    u.vueltas.value = p.cVueltas ?? 2;
    u.zExp.value = p.cZ ?? 1.4;
    u.piel.value = p.cPiel ?? 1;
    u.gotas.value = p.cGotas ?? 1;
    u.intensidad.value = p.cIntensidad ?? 1;
    u.ruido.value = p.cRuido ?? 0.6;
    u.densidad.value = p.cDensidad ?? 0.7;
    u.grosor.value = p.cGrosor ?? 0.025;
    u.nTh.value = nTh;
    u.nPh.value = nPh;
  }

  private actualizarVisibilidadCaracol(modo: number, p: Params): void {
    if (!this.objCar) return;
    const variante = p.cVariante === 2 ? 2 : p.cVariante === 1 ? 1 : 0;
    const piel = (p.cPiel ?? 1) > 0.001;
    const gotas = (p.cGotas ?? 1) > 0.001;
    this.objCar.pelo.visible = modo === 3 && variante === 0 && piel;
    this.objCar.gotas.visible = modo === 3 && variante === 0 && piel && gotas;
    this.objCar.moro.visible = modo === 3 && variante === 2 && piel;
  }

  private conteosCaracol(res: number): [number, number] {
    return [
      Math.max(24, Math.min(110, Math.round(res * 0.22))),
      Math.max(12, Math.min(60, Math.round(res * 0.1))),
    ];
  }

  private regenerarCaracol(nTh: number, nPh: number): void {
    // Indexada: cada celda tiene 5 vértices únicos (v0..v4); los 4 triángulos los
    // reusan vía índices. Antes se emitían 12 vértices/celda (2.4× más trabajo de shader).
    const TRI = [0, 1, 2, 0, 3, 2, 0, 3, 4, 0, 1, 4]; // v0..v4 por triángulo (índices locales)
    const celdas = nTh * nPh;
    const verts = celdas * 5;
    const position = new Float32Array(verts * 3);
    const aCar = new Float32Array(verts * 4); // (i, j, esquina, seed)
    const idx = new Uint32Array(celdas * TRI.length);
    let vi = 0, ii = 0;
    for (let i = 0; i < nTh; i++) {
      for (let j = 0; j < nPh; j++) {
        const seed = 10 + Math.random() * 990;
        const base = vi; // primer vértice (v0) de esta celda
        for (let esquina = 0; esquina < 5; esquina++) {
          aCar[vi * 4] = i;
          aCar[vi * 4 + 1] = j;
          aCar[vi * 4 + 2] = esquina;
          aCar[vi * 4 + 3] = seed;
          vi++;
        }
        for (const local of TRI) idx[ii++] = base + local;
      }
    }
    this.geoCar?.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aCar', new THREE.BufferAttribute(aCar, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    this.geoCar = geo;
    if (this.objCar) this.objCar.puntos.geometry = this.objCar.alambre.geometry = this.objCar.caras.geometry = geo;
    this.caracolCounts = { nTh, nPh };
    this.regenerarPeloYGotasCaracol(Math.max(160, Math.min(1500, Math.round(nTh * nPh * 0.85))), 9);
    this.regenerarMoroCaracol(nTh, nPh);
  }

  private regenerarPeloYGotasCaracol(nPelo: number, kPelo: number): void {
    const hairIdxLocal = [0, 2, 1, 2, 3, 1];
    const octa = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];
    const octaIdxLocal = [
      4, 0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0,
      5, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3,
    ];
    const segmentos = nPelo * kPelo;
    const hairVerts = segmentos * 4;
    const dropVerts = segmentos * octa.length;
    const hairPos = new Float32Array(hairVerts * 3);
    const hair = new Float32Array(hairVerts * 4);     // (k, extremo 0/1, lado -1/1, semilla)
    const hairData = new Float32Array(hairVerts * 4); // (offset, theta01, tamaño, profundidad)
    const hairIdx = new Uint32Array(segmentos * hairIdxLocal.length);
    const dropPos = new Float32Array(dropVerts * 3);
    const drop = new Float32Array(dropVerts * 4);      // (k, 0, 0, semilla)
    const dropData = new Float32Array(dropVerts * 4);  // (offset, theta01, tamaño, profundidad)
    const dropLocal = new Float32Array(dropVerts * 3);
    const dropIdx = new Uint32Array(segmentos * octaIdxLocal.length);
    let hv = 0, hi = 0, dv = 0, di = 0;
    for (let i = 0; i < nPelo; i++) {
      const seed = 10 + Math.random() * 990;
      const offset = Math.random();
      const theta01 = Math.random();
      const tam = 0.35 + 2.65 * Math.pow(Math.random(), 2.5);
      const profundidad = 0.25 + 0.75 * Math.random();
      for (let k = 0; k < kPelo; k++) {
        const hBase = hv;
        for (let v = 0; v < 4; v++) {
          const extremo = v < 2 ? 0 : 1;
          const lado = v === 0 || v === 2 ? 1 : -1;
          hair[hv * 4] = k;
          hair[hv * 4 + 1] = extremo;
          hair[hv * 4 + 2] = lado;
          hair[hv * 4 + 3] = seed;
          hairData[hv * 4] = offset;
          hairData[hv * 4 + 1] = theta01;
          hairData[hv * 4 + 2] = tam;
          hairData[hv * 4 + 3] = profundidad;
          hv++;
        }
        for (const local of hairIdxLocal) hairIdx[hi++] = hBase + local;

        const dBase = dv;
        for (const local of octa) {
          drop[dv * 4] = k;
          drop[dv * 4 + 3] = seed;
          dropData[dv * 4] = offset;
          dropData[dv * 4 + 1] = theta01;
          dropData[dv * 4 + 2] = tam;
          dropData[dv * 4 + 3] = profundidad;
          dropLocal[dv * 3] = local[0];
          dropLocal[dv * 3 + 1] = local[1];
          dropLocal[dv * 3 + 2] = local[2];
          dv++;
        }
        for (const local of octaIdxLocal) dropIdx[di++] = dBase + local;
      }
    }

    this.geoCarPelo?.dispose();
    this.geoCarGotas?.dispose();
    const geoPelo = new THREE.BufferGeometry();
    geoPelo.setAttribute('position', new THREE.BufferAttribute(hairPos, 3));
    geoPelo.setAttribute('aPelo', new THREE.BufferAttribute(hair, 4));
    geoPelo.setAttribute('aPeloData', new THREE.BufferAttribute(hairData, 4));
    geoPelo.setIndex(new THREE.BufferAttribute(hairIdx, 1));
    geoPelo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    const geoGotas = new THREE.BufferGeometry();
    geoGotas.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
    geoGotas.setAttribute('aGota', new THREE.BufferAttribute(drop, 4));
    geoGotas.setAttribute('aGotaData', new THREE.BufferAttribute(dropData, 4));
    geoGotas.setAttribute('aGotaLocal', new THREE.BufferAttribute(dropLocal, 3));
    geoGotas.setIndex(new THREE.BufferAttribute(dropIdx, 1));
    geoGotas.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    this.geoCarPelo = geoPelo;
    this.geoCarGotas = geoGotas;
    if (this.objCar) {
      this.objCar.pelo.geometry = geoPelo;
      this.objCar.gotas.geometry = geoGotas;
    }
    this.uCar.kPelo.value = kPelo;
  }

  private regenerarMoroCaracol(nTh: number, nPh: number): void {
    const segIdxLocal = [0, 2, 1, 2, 3, 1];
    const segmentos = nTh * nPh * 4;
    const verts = segmentos * 4;
    const position = new Float32Array(verts * 3);
    const aMoro = new Float32Array(verts * 4);  // (i, j, borde, extremo)
    const aMoro2 = new Float32Array(verts * 4); // (lado, semilla, _, _)
    const idx = new Uint32Array(segmentos * segIdxLocal.length);
    let vi = 0, ii = 0;
    for (let i = 0; i < nTh; i++) {
      for (let j = 0; j < nPh; j++) {
        const seed = 10 + Math.random() * 990;
        for (let borde = 0; borde < 4; borde++) {
          const base = vi;
          for (let v = 0; v < 4; v++) {
            aMoro[vi * 4] = i;
            aMoro[vi * 4 + 1] = j;
            aMoro[vi * 4 + 2] = borde;
            aMoro[vi * 4 + 3] = v < 2 ? 0 : 1;
            aMoro2[vi * 4] = v === 0 || v === 2 ? 1 : -1;
            aMoro2[vi * 4 + 1] = seed;
            vi++;
          }
          for (const local of segIdxLocal) idx[ii++] = base + local;
        }
      }
    }
    this.geoCarMoro?.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aMoro', new THREE.BufferAttribute(aMoro, 4));
    geo.setAttribute('aMoro2', new THREE.BufferAttribute(aMoro2, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    this.geoCarMoro = geo;
    if (this.objCar) this.objCar.moro.geometry = geo;
  }

  private posCaracol(r: any, ph: any, th: any): any {
    const u = this.uCar;
    const shell = cos(ph).add(1);
    const zSeed = max(th.add(0.375).mul(PI), 0.001);
    return vec3(
      r.mul(th).mul(cos(th)).mul(shell),
      r.mul(th).mul(sin(th)).mul(shell),
      r.mul(th).mul(sin(ph)).sub(zSeed.pow(u.zExp)),
    ).mul(0.01);
  }

  private normalCaracol(r: any, ph: any, th: any): any {
    const e = 0.004;
    const a = this.posCaracol(r, ph, th);
    const b = this.posCaracol(r, ph.add(e), th);
    const c = this.posCaracol(r, ph, th.add(e));
    return normalize(cross(b.sub(a), c.sub(a)));
  }

  private nodoPosCaracol(): any {
    const u = this.uCar;
    return Fn(() => {
      const id = attribute('aCar', 'vec4');
      const i = id.x, j = id.y, corner = id.z, seed = id.w;
      const thMax = u.vueltas.mul(2 * PI);
      const th0 = i.div(u.nTh).mul(thMax);
      const th1 = i.add(1).div(u.nTh).mul(thMax);
      const ph0 = j.div(u.nPh).mul(2 * PI).sub(PI);
      const ph1 = j.add(1).div(u.nPh).mul(2 * PI).sub(PI);
      const thC = th0.add(th1).mul(0.5);
      const phC = ph0.add(ph1).mul(0.5);
      const c1 = corner.lessThan(1.5);
      const c2 = corner.lessThan(2.5);
      const c3 = corner.lessThan(3.5);
      const phV = select(corner.lessThan(0.5), phC, select(c1, ph0, select(c2, ph1, select(c3, ph1, ph0))));
      const thV = select(corner.lessThan(0.5), thC, select(c1, th0, select(c2, th0, th1)));
      const base = this.posCaracol(u.R, phV, thV);
      const centro = this.posCaracol(u.R, phC, thC);
      const ruido = this.snoise01(seed.add(thC.mul(u.ruido)).add(u.fase.mul(0.2)));
      const env = sin(phC).mul(0.5).add(0.5);

      const picoR = u.R.add(u.R.mul(0.85).mul(u.intensidad).mul(env).mul(ruido.pow(2.4)));
      const picoCentro = this.posCaracol(picoR, phC, thC);
      const pico = select(corner.lessThan(0.5), picoCentro, base);

      const concha = mix(base, centro, select(corner.lessThan(0.5), 0.05, 0));
      return select(u.variante.lessThan(1.5), select(u.variante.lessThan(0.5), concha, pico), concha);
    })();
  }

  private nodoColorCaracol(): any {
    const u = this.uCar;
    return Fn(() => {
      const id = attribute('aCar', 'vec4');
      const i = id.x, j = id.y, seed = id.w;
      const q = i.div(max(u.nTh.sub(1), 1));
      const ruido = this.snoise01(seed.add(j.mul(0.31)).add(u.fase.mul(0.2)));
      const peludo = vec3(0.85, 0.86, 0.78).mul(ruido.mul(0.35).add(0.65));
      const picos = vec3(0.18, 0.16, 0.12).add(vec3(0.55, 0.48, 0.36).mul(ruido));
      const moroA = vec3(0.36, 0.82, 1.0);
      const moroB = vec3(0.72, 0.62, 1.0);
      const moro = select(this.snoise01(i.mul(3.7).add(j.mul(9.1))).greaterThan(0.5), moroB, moroA);
      const base = select(u.variante.lessThan(0.5), peludo, select(u.variante.lessThan(1.5), picos, moro));
      return base.mul(q.mul(0.25).add(0.8)).mul(this.uColor);
    })();
  }

  private marcoPeloCaracol(id: any, data: any): { superficie: any; gota: any; lado: any; ancho: any; tamGota: any; activo: any } {
    const u = this.uCar;
    const k = id.x, seed = id.w;
    const offset = data.x, theta01 = data.y, tam = data.z, profundidad = data.w;
    const p = fract(k.add(u.fase.mul(0.75)).add(offset).div(u.kPelo));
    const ph = p.mul(2 * PI).sub(PI);
    const th = theta01.mul(u.vueltas).mul(2 * PI);
    const n = this.normalCaracol(u.R, ph, th);
    const superficie = this.posCaracol(u.R, ph, th);
    const lenRuido = this.snoise01(seed.add(p.mul(7))).mul(0.75).add(0.25).pow(4);
    const largo = u.R.mul(0.01).mul(abs(u.intensidad).mul(2.25).add(0.35)).mul(lenRuido).mul(profundidad);
    const gota = superficie.sub(n.mul(largo));
    const lado = normalize(vec3(n.y, n.x.negate(), 0));
    const activo = select(fract(seed.mul(0.017)).lessThan(u.densidad), u.piel, 0);
    const szRuido = this.snoise01(seed.add(p.mul(17))).mul(0.9).add(0.5);
    return {
      superficie,
      gota,
      lado,
      ancho: tam.mul(szRuido).mul(0.0026).mul(activo),
      tamGota: tam.mul(szRuido).mul(0.0065).mul(activo).mul(u.gotas),
      activo,
    };
  }

  private nodoPosPeloCaracol(): any {
    return Fn(() => {
      const id = attribute('aPelo', 'vec4');
      const data = attribute('aPeloData', 'vec4');
      const marco = this.marcoPeloCaracol(id, data);
      const centro = mix(marco.superficie, marco.gota, id.y);
      return centro.add(marco.lado.mul(marco.ancho).mul(id.z));
    })();
  }

  private nodoPosGotaCaracol(): any {
    return Fn(() => {
      const id = attribute('aGota', 'vec4');
      const data = attribute('aGotaData', 'vec4');
      const local = attribute('aGotaLocal', 'vec3');
      const marco = this.marcoPeloCaracol(id, data);
      return marco.gota.add(local.mul(marco.tamGota));
    })();
  }

  private nodoColorGotaCaracol(): any {
    return Fn(() => {
      const id = attribute('aGota', 'vec4');
      const brillo = this.snoise01(id.w.mul(0.71).add(this.uCar.fase.mul(0.35))).mul(0.25).add(0.75);
      return vec3(0.9, 0.96, 1.0).mul(brillo);
    })();
  }

  private esquinasMoro(i: any, j: any): { a: any; b: any; c: any; d: any; centro: any; n: any } {
    const u = this.uCar;
    const thMax = u.vueltas.mul(2 * PI);
    const th0 = i.div(u.nTh).mul(thMax);
    const th1 = i.add(1).div(u.nTh).mul(thMax);
    const ph0 = j.div(u.nPh).mul(2 * PI).sub(PI);
    const ph1 = j.add(1).div(u.nPh).mul(2 * PI).sub(PI);
    const phC = ph0.add(ph1).mul(0.5);
    const thC = th0.add(th1).mul(0.5);
    const a = this.posCaracol(u.R.mul(1.006), ph0, th0);
    const b = this.posCaracol(u.R.mul(1.006), ph1, th0);
    const c = this.posCaracol(u.R.mul(1.006), ph1, th1);
    const d = this.posCaracol(u.R.mul(1.006), ph0, th1);
    return { a, b, c, d, centro: a.add(b).add(c).add(d).mul(0.25), n: this.normalCaracol(u.R, phC, thC) };
  }

  private puntoBordeMoro(edge: any, a: any, b: any, c: any, d: any): any {
    return select(edge.lessThan(0.5), a,
      select(edge.lessThan(1.5), b, select(edge.lessThan(2.5), c, d)));
  }

  private nodoPosMoroCaracol(): any {
    const u = this.uCar;
    return Fn(() => {
      const id = attribute('aMoro', 'vec4');
      const extra = attribute('aMoro2', 'vec4');
      const edge = id.z;
      const esq = this.esquinasMoro(id.x, id.y);
      const a0 = this.puntoBordeMoro(edge, esq.a, esq.b, esq.c, esq.d);
      const a1 = this.puntoBordeMoro(edge.add(1).sub(select(edge.greaterThan(2.5), 4, 0)), esq.a, esq.b, esq.c, esq.d);
      const b0 = this.puntoBordeMoro(edge.add(1).sub(select(edge.greaterThan(2.5), 4, 0)), esq.a, esq.b, esq.c, esq.d);
      const b1 = this.puntoBordeMoro(edge.add(2).sub(select(edge.greaterThan(1.5), 4, 0)), esq.a, esq.b, esq.c, esq.d);
      const inicio = a0.add(a1).mul(0.5);
      const siguiente = b0.add(b1).mul(0.5);
      const interior = mix(esq.centro, siguiente, 0.72);
      const centro = mix(inicio, interior, id.w);
      const dir = normalize(interior.sub(inicio));
      const lado = normalize(cross(esq.n, dir));
      const ancho = u.R.mul(u.grosor).mul(0.0028).mul(u.piel);
      return centro.add(esq.n.mul(0.006)).add(lado.mul(ancho).mul(extra.x));
    })();
  }

  private nodoColorMoroCaracol(): any {
    return Fn(() => {
      const id = attribute('aMoro', 'vec4');
      const extra = attribute('aMoro2', 'vec4');
      const ruido = this.snoise01(extra.y.add(id.x.mul(2.3)).add(id.y.mul(5.1)));
      const violeta = vec3(0.4, 0.32, 1.0);
      const cyan = vec3(0.18, 0.82, 1.0);
      const blanco = vec3(0.92, 0.95, 1.0);
      return select(ruido.greaterThan(0.72), blanco, select(ruido.greaterThan(0.38), cyan, violeta));
    })();
  }

  // ————— Serpiente (GPU animada) —————

  private crearSerpiente() {
    const geo = new THREE.BufferGeometry(); // se dimensiona en regenerarSerpiente
    const pos = this.nodoPosSerp();

    const matPuntos = new THREE.PointsNodeMaterial();
    matPuntos.positionNode = pos;
    matPuntos.colorNode = this.uColor;

    const matAlambre = new THREE.MeshBasicNodeMaterial({ wireframe: true, transparent: true, opacity: 0.5 });
    matAlambre.positionNode = pos;
    matAlambre.colorNode = this.uColor;

    const matCaras = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    matCaras.positionNode = pos;
    matCaras.colorNode = this.nodoColorSerp();

    return {
      puntos: new THREE.Points(geo, matPuntos),
      alambre: new THREE.Mesh(geo, matAlambre),
      caras: new THREE.Mesh(geo, matCaras),
    };
  }

  /**
   * Hornea la IDENTIDAD de cada vértice (instancia i,j · segmento k · esquina · semilla).
   * Es lo único estático: como la retícula de la flor, solo se rehace al cambiar el conteo.
   * Las posiciones NO se guardan aquí — las calcula el shader desde `fase` y los uniforms.
   * Semillas aleatorias por instancia → variación orgánica nueva en cada regeneración/montaje.
   */
  private regenerarSerpiente(N1: number, N: number, N2: number): void {
    // Indexada, igual que el caracol: 5 vértices únicos (v0..v4) por celda (instancia × k),
    // reusados por los 4 triángulos. Antes eran 12 vértices/celda (2.4× más trabajo de shader).
    const K = Math.ceil(N2 / N);
    const TRI = [0, 1, 2, 0, 3, 2, 0, 3, 4, 0, 1, 4]; // v0..v4 por triángulo (índices locales)
    const celdas = N1 * N * K;
    const verts = celdas * 5;
    this.geoS?.dispose();
    const position = new Float32Array(verts * 3); // dummy: positionNode lo sobreescribe
    const aIJK = new Float32Array(verts * 3);     // (i, j, k)
    const aInst = new Float32Array(verts * 4);    // (esquina 0..4, seed, off, di)
    const idx = new Uint32Array(celdas * TRI.length);
    let vi = 0, ii = 0;
    for (let i = 0; i < N1; i++) {
      for (let j = 0; j < N; j++) {
        const seed = 10 + Math.random() * 990;
        const off = 0.4 + 0.8 * (Math.random() * 2 - 1);
        const di = 120 + Math.random() * 680;
        for (let k = 0; k < K; k++) {
          const base = vi; // primer vértice (v0) de esta celda
          for (let esquina = 0; esquina < 5; esquina++) {
            aIJK[vi * 3] = i; aIJK[vi * 3 + 1] = j; aIJK[vi * 3 + 2] = k;
            aInst[vi * 4] = esquina; aInst[vi * 4 + 1] = seed; aInst[vi * 4 + 2] = off; aInst[vi * 4 + 3] = di;
            vi++;
          }
          for (const local of TRI) idx[ii++] = base + local;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aIJK', new THREE.BufferAttribute(aIJK, 3));
    geo.setAttribute('aInst', new THREE.BufferAttribute(aInst, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20); // el shader mueve todo: cota amplia
    this.geoS = geo;
    if (this.objS) this.objS.puntos.geometry = this.objS.alambre.geometry = this.objS.caras.geometry = geo;
    this.serpCounts = { N1, N, N2 };
  }

  private conteosSerpiente(res: number): [number, number, number] {
    const k = Math.max(8, res) / 256;
    const N1 = Math.max(6, Math.min(60, Math.round(30 * k)));
    const N = Math.max(3, Math.min(24, Math.round(12 * k)));
    const N2 = Math.max(20, Math.min(160, Math.round(80 * k)));
    return [N1, N, N2];
  }

  /** Un tick: solo mueve uniforms (incluida `fase`). Sin reconstrucción de geometría. */
  private actualizarSerpiente(p: Params, res: number): void {
    const [N1, N, N2] = this.conteosSerpiente(res);
    if (N1 !== this.serpCounts.N1 || N !== this.serpCounts.N || N2 !== this.serpCounts.N2) {
      this.regenerarSerpiente(N1, N, N2);
    }
    const u = this.uS;
    // `fase` = reloj del scroll. Base 0 → congelada al modelar; el Escenario la avanza por actor.
    u.fase.value = p.fase ?? 0;
    u.R.value = p.sR ?? 200; u.Z.value = p.sZ ?? 1000; u.trn.value = p.sTrn ?? 3.4;
    u.MV.value = p.sMV ?? -0.15; u.MXV.value = p.sMXV ?? 1.35;
    u.N1.value = N1; u.N.value = N; u.N2.value = N2;
    u.r1m.value = p.sr1m ?? 5; u.r1n1.value = p.sr1n1 ?? 0.1; u.r1n2.value = p.sr1n2 ?? 1.7; u.r1n3.value = p.sr1n3 ?? 1.7;
    u.r2m.value = p.sr2m ?? 7; u.r2n1.value = p.sr2n1 ?? 0.3; u.r2n2.value = p.sr2n2 ?? 0.5; u.r2n3.value = p.sr2n3 ?? 0.5;
  }

  // ————— Grafos TSL de la Serpiente —————

  /** Ruido suave GPU en [0,1] a lo largo de una recta (equivale al simplex por semilla del sketch). */
  private snoise01(x: any): any {
    return clamp(mx_noise_float(vec3(x, 0, 0)).mul(0.5).add(0.5), 0, 1);
  }

  /** pos(r, p, th): r1 modula X, r2 modula Y (perfiles Gielis independientes). */
  private posSerp(r: any, p: any, th: any): any {
    const u = this.uS;
    const r1 = this.sr(th, u.r1m, u.r1n1, u.r1n2, u.r1n3);
    const r2 = this.sr(th, u.r2m, u.r2n1, u.r2n2, u.r2n3);
    const ang = th.add(u.trn);
    const twoPiP = p.mul(2 * PI);
    const x = r.mul(r1).mul(cos(ang)).sub(float(1).sub(p).pow(2).mul(500)).add(200);
    const y = r.mul(r2).mul(sin(ang)).add(sin(twoPiP).mul(100));
    const z = u.Z.negate().mul(float(1).sub(p)).add(sin(twoPiP).mul(50)).add(120);
    return vec3(x, y, z);
  }

  private nodoPosSerp(): any {
    const u = this.uS;
    return Fn(() => {
      const ijk = attribute('aIJK', 'vec3');
      const inst = attribute('aInst', 'vec4');
      const i = ijk.x, j = ijk.y, k = ijk.z;
      const esquina = inst.x, seed = inst.y, off = inst.z, di = inst.w;

      const ind = j.add(u.fase.add(k).mul(u.N));
      const map = (v: any) => u.MV.add(v.div(u.N2).mul(u.MXV.sub(u.MV))); // mapV(v,0,N2,MV,MXV)
      const p0 = map(ind.add(0.5)), p1 = map(ind), p2 = map(ind.add(1));
      const th0 = i.add(0.5).mul(2 * PI).div(u.N1);
      const th1 = i.mul(2 * PI).div(u.N1);
      const th2 = i.add(1).mul(2 * PI).div(u.N1);

      // Magnitudes compartidas por los 5 vértices (dependen del centro p0):
      const parVal = float(1).sub(clamp(p0.mul(2).sub(off), 0, 1)).pow(3.3); // envolvente de vida
      const rVal = u.R.sub(20).sub(this.snoise01(seed.add(p0.mul(2))).pow(5).mul(180));
      const d = di.mul(parVal);
      const q = clamp(parVal.add(0.05), 0, 1);

      const v0 = this.posSerp(rVal.add(d), p0, th0); // centro (radio con ruido)

      // p, th y radio de ESTE vértice según su esquina (0→v0, 1→v1 … 4→v4):
      const c = esquina;
      const pV = select(c.lessThan(0.5), p0,
        select(c.lessThan(1.5), p1, select(c.lessThan(2.5), p2, select(c.lessThan(3.5), p2, p1))));
      const thV = select(c.lessThan(0.5), th0,
        select(c.lessThan(1.5), th1, select(c.lessThan(2.5), th1, th2)));
      const rV = select(c.lessThan(0.5), rVal.add(d), u.R.add(d));
      const propio = this.posSerp(rV, pV, thV);

      // v0 es el centro; los del borde se atraen hacia v0 por q (colapso de la envolvente).
      const fin = select(c.lessThan(0.5), v0, mix(propio, v0, q));
      return fin.mul(0.01); // la serpiente vive en cientos de unidades
    })();
  }

  private nodoColorSerp(): any {
    const u = this.uS;
    return Fn(() => {
      const ijk = attribute('aIJK', 'vec3');
      const inst = attribute('aInst', 'vec4');
      const j = ijk.y, k = ijk.z, seed = inst.y;
      const ind = j.add(u.fase.add(k).mul(u.N));
      const p0 = u.MV.add(ind.add(0.5).div(u.N2).mul(u.MXV.sub(u.MV)));
      const coladd = this.snoise01(seed.mul(2).add(p0.mul(2.5))).pow(8).mul(900);
      const coladd2 = this.snoise01(seed.mul(2).add(p0.mul(9.5))).pow(6).mul(200);
      const bright = clamp(
        float(5).add(coladd.mul(0.2)).add(coladd2.mul(0.8)).sub(float(1).sub(p0).mul(130)).div(255),
        0, 1);
      return vec3(bright, bright.mul(1.05), bright.mul(0.75)).mul(this.uColor);
    })();
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
    const plantilla = modo === 3 ? PLANTILLA_CARACOL : modo === 2 ? PLANTILLA_SERPIENTE : modo === 1 ? PLANTILLA_FLOR : PLANTILLA_CLASICA;
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

const PLANTILLA_CARACOL = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — caracol</title>
<style>html,body{margin:0;height:100%;background:#050507;overflow:hidden}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const P=__PARAMS__, PI=Math.PI, RES=Math.max(8,Math.round(P.resolucion??128));
const cfg={r:P.cRadio??14,vueltas:P.cVueltas??2,zExp:P.cZ??1.4,piel:(P.cPiel??1)>0.5,intensidad:P.cIntensidad??1,ruido:P.cRuido??0.6,densidad:P.cDensidad??0.7,grosor:P.cGrosor??0.025,nTh:Math.max(24,Math.min(110,Math.round(RES*.22))),nPh:Math.max(12,Math.min(60,Math.round(RES*.1)))};
const rnd=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453123;return s-Math.floor(s);};
const pos=(r,ph,th)=>{const sh=Math.cos(ph)+1,zs=Math.max(.001,(th+.375)*PI);return new THREE.Vector3(r*th*Math.cos(th)*sh,r*th*Math.sin(th)*sh,r*th*Math.sin(ph)-Math.pow(zs,cfg.zExp)).multiplyScalar(.01);};
const nrm=(r,ph,th)=>{const e=.004,a=pos(r,ph,th),b=pos(r,ph+e,th),c=pos(r,ph,th+e);return b.sub(a).cross(c.sub(a)).normalize();};
const ps=[],cs=[]; function tri(a,b,c,col){for(const v of [a,b,c])ps.push(v.x,v.y,v.z);for(let i=0;i<3;i++)cs.push(col[0],col[1],col[2]);}
function strip(a,b,w,col){const d=b.clone().sub(a),s=new THREE.Vector3(-d.y,d.x,0);if(s.lengthSq()<1e-5)s.set(1,0,0);s.normalize().multiplyScalar(w*.01);tri(a.clone().add(s),b.clone().add(s),b.clone().sub(s),col);tri(a.clone().add(s),b.clone().sub(s),a.clone().sub(s),col);}
function needle(base,n,len,w,col){const tip=base.clone().add(n.clone().multiplyScalar(len*.01)),s=new THREE.Vector3(n.y,-n.x,0);if(s.lengthSq()<1e-5)s.set(1,0,0);s.normalize().multiplyScalar(w*.01);tri(base.clone().add(s),tip,base.clone().sub(s),col);}
function base(variante){const tm=cfg.vueltas*2*PI;for(let i=0;i<cfg.nTh;i++){const t0=tm*i/cfg.nTh,t1=tm*(i+1)/cfg.nTh;for(let j=0;j<cfg.nPh;j++){const p0=-PI+2*PI*j/cfg.nPh,p1=-PI+2*PI*(j+1)/cfg.nPh,a=pos(cfg.r,p0,t0),b=pos(cfg.r,p1,t0),c=pos(cfg.r,p1,t1),d=pos(cfg.r,p0,t1),q=i/Math.max(1,cfg.nTh-1),co=variante===2?[.08+q*.14,.1+q*.08,.24+q*.28]:[.04+q*.08,.04+q*.07,.055+q*.09];tri(a,b,c,co);tri(a,c,d,co);}}}
function picos(t){const tm=cfg.vueltas*2*PI;for(let i=0;i<cfg.nTh;i++){const t0=tm*i/cfg.nTh,t1=tm*(i+1)/cfg.nTh,th=(t0+t1)*.5;for(let j=0;j<cfg.nPh;j++){const p0=-PI+2*PI*j/cfg.nPh,p1=-PI+2*PI*(j+1)/cfg.nPh,ph=(p0+p1)*.5,s=rnd(i*1.9+t*.7,j*2.7+cfg.ruido*11),env=.35+.65*Math.max(0,Math.sin(ph)),dr=cfg.r*.8*cfg.intensidad*env*Math.pow(s,2.4),v0=pos(cfg.r+dr,ph,th),v1=pos(cfg.r,p0,t0),v2=pos(cfg.r,p1,t0),v3=pos(cfg.r,p1,t1),v4=pos(cfg.r,p0,t1),br=.18+.55*s,co=[br,br*.92,br*.78];tri(v0,v1,v2,co);tri(v0,v2,v3,co);tri(v0,v3,v4,co);tri(v0,v4,v1,co);}}}
function peludo(t){if(!cfg.piel)return;const tm=cfg.vueltas*2*PI,st=Math.max(1,Math.round(3-cfg.densidad*2)),sp=Math.max(1,Math.round(4-cfg.densidad*3));for(let i=0;i<=cfg.nTh;i+=st){const th=tm*i/cfg.nTh;for(let j=0;j<=cfg.nPh;j+=sp){const pk=rnd(i*12.17,j*5.31);if(pk>cfg.densidad)continue;const ph=-PI+2*PI*((j+t*.7+pk)%cfg.nPh)/cfg.nPh,b=pos(cfg.r,ph,th),n=nrm(cfg.r,ph,th),len=cfg.r*(.35+2.4*cfg.intensidad)*Math.pow(rnd(i+t,j+cfg.ruido*19),3),w=cfg.r*cfg.grosor*(.5+pk);needle(b,n,len,w,[.85,.86,.78]);}}}
function moro(){if(!cfg.piel)return;const tm=cfg.vueltas*2*PI,w=cfg.r*cfg.grosor*.55,mid=(a,b)=>a.clone().add(b).multiplyScalar(.5);for(let i=0;i<cfg.nTh;i++){const t0=tm*i/cfg.nTh,t1=tm*(i+1)/cfg.nTh;for(let j=0;j<cfg.nPh;j++){const p0=-PI+2*PI*j/cfg.nPh,p1=-PI+2*PI*(j+1)/cfg.nPh,a=pos(cfg.r*1.006,p0,t0),b=pos(cfg.r*1.006,p1,t0),c=pos(cfg.r*1.006,p1,t1),d=pos(cfg.r*1.006,p0,t1),co=(i+j)%2?[.36,.82,1]:[.72,.62,1];strip(mid(a,b),mid(c,d),w,co);if((i+j)%3===0)strip(mid(d,a),mid(b,c),w*.8,[.95,.95,1]);}}}
function build(t){ps.length=0;cs.length=0;const v=P.cVariante===2?2:P.cVariante===1?1:0;if(v===1)picos(t);else{base(v);if(v===0)peludo(t);else moro();}geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));geo.computeBoundingSphere();}
const geo=new THREE.BufferGeometry(); const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
mesh.rotation.set(-Math.PI*.56,0,Math.PI*.95); const grupo=new THREE.Group(); grupo.add(mesh); grupo.scale.setScalar(P.escala??2);
const escena=new THREE.Scene(); escena.add(grupo); const cam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,100); cam.position.z=6;
const r=new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2)); document.body.appendChild(r.domElement);
const ctl=new OrbitControls(cam,r.domElement); ctl.enableDamping=true; const reloj=new THREE.Clock(); let t=P.cFase??0;
r.setAnimationLoop(()=>{const dt=reloj.getDelta();t+=dt*(P.cVel??.2);build(t);grupo.rotation.y+=(P.giro??0)*dt;ctl.update();r.render(escena,cam);});
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();r.setSize(innerWidth,innerHeight);});
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
const RES = Math.max(8, Math.round(P.resolucion ?? 256)), KR = RES / 256;
const N1 = Math.max(6, Math.min(60, Math.round(30 * KR)));
const N = Math.max(3, Math.min(24, Math.round(12 * KR)));
const N2 = Math.max(20, Math.min(160, Math.round(80 * KR)));
const K = Math.ceil(N2/N);
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
