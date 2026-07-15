// Salón — Triangulación de Delaunay.
//
// Triangula N puntos sobre un plano (Delaunator, CPU) y dibuja cada triángulo
// con copias anidadas escaladas/giradas hacia su centroide.
//
// ★ GPU: la triangulación es topología irregular → se calcula UNA vez en CPU
//   (barato: pocos puntos) y se hornea en buffers por-instancia. Lo pesado —la
//   repetición anidada y su giro animado— vive en el vertex shader (TSL) como
//   UNA sola geometría instanciada: instancias = triángulos × niveles.
//
//   El despliegue en «caras» (plano o cubo; otras figuras después) se reduce a
//   multiplicar las instancias por una lista de matrices de cara (uniformArray
//   `uCaras`, indexado por el atributo `iFace`). Añadir figura = añadir matrices.

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, uniformArray, attribute, float, vec2, vec3, vec4, int,
  sin, cos, mix, clamp,
} from 'three/tsl';
import Delaunator from 'delaunator';
import type { Salon, Params, ParamDef } from '../../core/Salon';

const MODO = { Lineal: 0, Exponencial: 1 };
const VISTA = { Puntos: 0, Alambre: 1, Caras: 2 };
const FIGURA = { Plano: 0, Room: 1 };
const EXTRUDE = { Fuera: 0, Dentro: 1 };
// Cara a apagar en la Room (índice en carasCubo) — −1 = ninguna (cubo cerrado).
const CARA = {
  Ninguna: -1, 'Frente (+Z)': 0, 'Fondo (−Z)': 1, 'Derecha (+X)': 2,
  'Izquierda (−X)': 3, 'Techo (+Y)': 4, 'Suelo (−Y)': 5,
};
const MAX_CARAS = 6; // la room; el plano usa 1

export class DelaunaySalon implements Salon {
  id = 'delaunay';
  nombre = 'Delaunay';

  params: ParamDef[] = [
    { clave: 'puntos',   etiqueta: 'puntos',       valor: 40,     min: 3,   max: 400, paso: 1 },
    { clave: 'semilla',  etiqueta: 'semilla',      valor: 1,      min: 1,   max: 999, paso: 1 },
    { clave: 'figura',   etiqueta: 'figura',       valor: 0,      min: 0,   max: 1,   opciones: FIGURA },
    { clave: 'caraOff',  etiqueta: 'cara apagada', valor: 0,      min: -1,  max: 5,   opciones: CARA },
    { clave: 'anidado',  etiqueta: 'anidado (máx)', valor: 8,     min: 1,   max: 30,  paso: 1 },
    { clave: 'umbral',   etiqueta: 'poda LOD',     valor: 0.05,   min: 0,   max: 0.5 },
    { clave: 'vista',    etiqueta: 'exposición',   valor: 1,      min: 0,   max: 2,   opciones: VISTA },
    { clave: 'modoEsc',  etiqueta: 'escala',       valor: 1,      min: 0,   max: 1,   opciones: MODO },
    { clave: 'giro',     etiqueta: 'giro/nivel',   valor: 0,      min: -2,  max: 2 },
    { clave: 'velGiro',  etiqueta: 'giro tiempo',  valor: 0,      min: 0,   max: 3 },
    { clave: 'sepZ',     etiqueta: 'separación Z',  valor: 0.03,  min: 0,   max: 0.3 },
    { clave: 'extrude',  etiqueta: 'extrude',      valor: 0,      min: 0,   max: 1,   opciones: EXTRUDE },
    { clave: 'escala',   etiqueta: 'escala global', valor: 2,     min: 0.2, max: 5 },
    { clave: 'color',    etiqueta: 'color',        valor: 0x8ab4ff, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'color2',   etiqueta: 'color 2 (degradado)', valor: 0xff5a8c, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'ampDeg',   etiqueta: 'amplitud degradado', valor: 0.7, min: 0, max: 1 },
    { clave: 'puntoTam', etiqueta: 'tamaño punto (export)', valor: 1.5, min: 0.3, max: 6 },
  ];

  // — Uniforms: único canal CPU→GPU tras hornear la triangulación —
  // (los niveles por triángulo viajan como atributo por-instancia `iMax`)
  private u = {
    modo:    uniform(1),
    giro:    uniform(0),
    velGiro: uniform(0),
    sepZ:    uniform(0.03),
    dir:     uniform(1), // +1 extrude hacia afuera, −1 hacia adentro
    ampDeg:  uniform(0.7), // amplitud del degradado color→color2 por nivel
    tiempo:  uniform(0),
  };
  private uColor = uniform(new THREE.Color(0x8ab4ff));
  private uColor2 = uniform(new THREE.Color(0xff5a8c));

  private grupo = new THREE.Group();
  // 3 representaciones compartiendo geometría instanciada y grafo de posición.
  private objs: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private geo: THREE.InstancedBufferGeometry | null = null;
  // Firma de la última topología horneada (para regenerar solo si cambia)
  private firma = '';

  // Caras de despliegue: el shader coloca cada instancia con la matriz de su cara.
  // Se guardan MAX_CARAS slots (identidad de relleno) para un uniformArray fijo;
  // el plano usa 1, el cubo 6. Indexadas por el atributo por-instancia `iFace`.
  private matCaras: THREE.Matrix4[] = Array.from({ length: MAX_CARAS }, () => new THREE.Matrix4());
  private uCaras = uniformArray(this.matCaras, 'mat4');

  init(escena: THREE.Scene): void {
    // Grafos TSL compartidos por las tres representaciones.
    const pos = this.nodoPos();
    const color = this.nodoColor();
    const opac = this.nodoOpacidad();
    const geo = this.geoBase();

    const matPuntos = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false });
    matPuntos.positionNode = pos; matPuntos.colorNode = color; matPuntos.opacityNode = opac;

    const matAlambre = new THREE.MeshBasicNodeMaterial({ wireframe: true, transparent: true, depthWrite: false });
    matAlambre.positionNode = pos; matAlambre.colorNode = color; matAlambre.opacityNode = opac;

    const matCaras = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
    matCaras.positionNode = pos; matCaras.colorNode = color; matCaras.opacityNode = opac;

    this.objs = {
      puntos: new THREE.Points(geo, matPuntos),
      alambre: new THREE.Mesh(geo, matAlambre),
      caras: new THREE.Mesh(geo, matCaras),
    };
    for (const o of [this.objs.puntos, this.objs.alambre, this.objs.caras]) {
      o.frustumCulled = false; // el positionNode reubica los vértices
      this.grupo.add(o);
    }
    escena.add(this.grupo);
    this.firma = ''; // fuerza horneado en el primer update
  }

  update(_dt: number, tiempo: number, p: Params): void {
    // — Topología: se rehornea solo si cambian puntos / semilla / anidado —
    const puntos = Math.max(3, Math.round(p.puntos ?? 40));
    const semilla = Math.round(p.semilla ?? 1);
    const niveles = Math.max(1, Math.round(p.anidado ?? 8));
    const figura = p.figura === 1 ? 1 : 0;
    const caraOff = Math.round(p.caraOff ?? -1);
    const umbral = Math.max(0, p.umbral ?? 0.05);
    const firma = `${figura}|${caraOff}|${umbral.toFixed(3)}|${puntos}|${semilla}|${niveles}`;
    if (firma !== this.firma) {
      this.firma = firma;
      this.hornear(figura, caraOff, umbral, puntos, semilla, niveles);
    }

    // — Exposición: solo la representación activa es visible —
    const vista = p.vista === 0 ? 0 : p.vista === 2 ? 2 : 1;
    if (this.objs) {
      this.objs.puntos.visible = vista === VISTA.Puntos;
      this.objs.alambre.visible = vista === VISTA.Alambre;
      this.objs.caras.visible = vista === VISTA.Caras;
    }

    // — Uniforms —
    this.u.modo.value = p.modoEsc === 0 ? 0 : 1;
    this.u.giro.value = p.giro ?? 0;
    this.u.velGiro.value = p.velGiro ?? 0;
    this.u.sepZ.value = p.sepZ ?? 0.03;
    this.u.dir.value = p.extrude === 1 ? -1 : 1;
    this.u.ampDeg.value = p.ampDeg ?? 0.7;
    this.u.tiempo.value = tiempo;
    if (p.color !== undefined) this.uColor.value.setHex(p.color);
    if (p.color2 !== undefined) this.uColor2.value.setHex(p.color2);

    this.grupo.scale.setScalar(p.escala ?? 2);
  }

  dispose(escena: THREE.Scene): void {
    escena.remove(this.grupo);
    this.geo?.dispose();
    if (this.objs) {
      (this.objs.puntos.material as THREE.Material).dispose();
      (this.objs.alambre.material as THREE.Material).dispose();
      (this.objs.caras.material as THREE.Material).dispose();
    }
    this.objs = null;
    this.grupo.clear();
  }

  // ————— Geometría —————

  /** Triángulo plantilla: `position` sirve de selector baricéntrico (cada vértice
   *  es una esquina). La posición real la calcula el shader mezclando con los
   *  vértices por-instancia. Se reusa `position` como bary → un buffer menos. */
  private geoBase(): THREE.InstancedBufferGeometry {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
    geo.setIndex([0, 1, 2]);
    geo.instanceCount = 0;
    this.geo = geo;
    return geo;
  }

  /** Recalcula la triangulación (CPU) y hornea los atributos por-instancia.
   *  Los vértices quedan en 2D local; la cara los coloca en 3D en el shader. */
  private hornear(figura: number, caraOff: number, umbral: number, puntos: number, semilla: number, niveles: number): void {
    const rnd = mulberry32(semilla);
    // Esquinas del plano [-1,1]² → cobertura total; luego puntos aleatorios.
    const xy: number[] = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < puntos; i++) xy.push(rnd() * 2 - 1, rnd() * 2 - 1);

    const tri = new Delaunator(xy).triangles; // índices, longitud = 3·nTri
    const nTri = tri.length / 3;

    // Matrices de cara → uniformArray (relleno con identidad hasta MAX_CARAS).
    // La Room omite la cara `caraOff` para poder ver dentro; el plano usa 1.
    const caras = figura === FIGURA.Room
      ? carasCubo().filter((_, i) => i !== caraOff)
      : [new THREE.Matrix4()];
    const nCaras = caras.length;
    for (let i = 0; i < MAX_CARAS; i++) this.matCaras[i].copy(caras[i] ?? IDENTIDAD);

    // LOD: niveles por triángulo según su tamaño (√área). Grandes → hasta
    // `niveles`; pequeños → menos, evitando anidar detalle sub-píxel.
    // `umbral` = tamaño mínimo de copia que vale la pena anidar (0 = sin poda).
    const lv = new Uint16Array(nTri);
    let porCara = 0;
    for (let t = 0; t < nTri; t++) {
      const a = tri[t * 3], b = tri[t * 3 + 1], d = tri[t * 3 + 2];
      const area = Math.abs(
        (xy[b * 2] - xy[a * 2]) * (xy[d * 2 + 1] - xy[a * 2 + 1]) -
        (xy[d * 2] - xy[a * 2]) * (xy[b * 2 + 1] - xy[a * 2 + 1]),
      ) * 0.5;
      lv[t] = umbral > 0
        ? Math.max(1, Math.min(niveles, Math.round(Math.sqrt(area) / umbral)))
        : niveles;
      porCara += lv[t];
    }

    const N = porCara * nCaras;
    const iA = new Float32Array(N * 2);
    const iB = new Float32Array(N * 2);
    const iC = new Float32Array(N * 2);
    const iLevel = new Float32Array(N);
    const iMax = new Float32Array(N);
    const iFace = new Float32Array(N);

    let k = 0;
    for (let c = 0; c < nCaras; c++) {
      for (let t = 0; t < nTri; t++) {
        const a = tri[t * 3], b = tri[t * 3 + 1], d = tri[t * 3 + 2];
        const ax = xy[a * 2], ay = xy[a * 2 + 1];
        const bx = xy[b * 2], by = xy[b * 2 + 1];
        const cx = xy[d * 2], cy = xy[d * 2 + 1];
        const m = lv[t];
        for (let l = 0; l < m; l++) {
          iA[k * 2] = ax; iA[k * 2 + 1] = ay;
          iB[k * 2] = bx; iB[k * 2 + 1] = by;
          iC[k * 2] = cx; iC[k * 2 + 1] = cy;
          iLevel[k] = l;
          iMax[k] = m;
          iFace[k] = c;
          k++;
        }
      }
    }

    const geo = this.geoBase();
    geo.setAttribute('iA', new THREE.InstancedBufferAttribute(iA, 2));
    geo.setAttribute('iB', new THREE.InstancedBufferAttribute(iB, 2));
    geo.setAttribute('iC', new THREE.InstancedBufferAttribute(iC, 2));
    geo.setAttribute('iLevel', new THREE.InstancedBufferAttribute(iLevel, 1));
    geo.setAttribute('iMax', new THREE.InstancedBufferAttribute(iMax, 1));
    geo.setAttribute('iFace', new THREE.InstancedBufferAttribute(iFace, 1));
    geo.instanceCount = N;

    if (this.objs) {
      const previa = this.objs.alambre.geometry;
      this.objs.puntos.geometry = geo;
      this.objs.alambre.geometry = geo;
      this.objs.caras.geometry = geo;
      if (previa && previa !== geo) previa.dispose();
    }
  }

  // ————— Grafos TSL —————

  /** Vértice anidado: esquina → escalado + giro hacia el centroide + apilado en Z
   *  (local a la cara), y luego colocado en 3D por la matriz de su cara. */
  private nodoPos(): any {
    const u = this.u;
    return Fn(() => {
      const bary = attribute('position', 'vec3'); // reusa position como baricéntrica
      const A = attribute('iA', 'vec2');
      const B = attribute('iB', 'vec2');
      const C = attribute('iC', 'vec2');
      const level = attribute('iLevel', 'float');
      const iMax = attribute('iMax', 'float'); // niveles de ESTE triángulo (LOD)
      const face = attribute('iFace', 'float');

      const p2 = A.mul(bary.x).add(B.mul(bary.y)).add(C.mul(bary.z));
      const centro = A.add(B).add(C).div(3);

      // Escala del nivel: exponencial 1/(l+1) o lineal 1 − l/iMax (por triángulo).
      const lin = float(1).sub(level.div(iMax));
      const expo = float(1).div(level.add(1));
      const s = mix(lin, expo, u.modo);

      const ang = level.mul(u.giro).add(u.tiempo.mul(u.velGiro));
      const rel = p2.sub(centro).mul(s);
      const rx = rel.x.mul(cos(ang)).sub(rel.y.mul(sin(ang)));
      const ry = rel.x.mul(sin(ang)).add(rel.y.mul(cos(ang)));

      // Posición local a la cara. El apilado en Z sigue `dir`: +1 hacia afuera
      // (normal de la cara) o −1 hacia adentro (dentro de la room).
      const local = vec3(rx.add(centro.x), ry.add(centro.y), level.mul(u.sepZ).mul(u.dir));
      // Coloca en 3D según la cara (identidad = plano).
      return this.uCaras.element(int(face)).mul(vec4(local, 1)).xyz;
    })();
  }

  private nodoColor(): any {
    const u = this.u;
    return Fn(() => {
      const level = attribute('iLevel', 'float');
      const iMax = attribute('iMax', 'float');
      // Degradado a lo largo del anidado (= profundidad del extrude), con amplitud.
      const f = clamp(level.div(iMax), 0, 1).mul(u.ampDeg);
      return mix(this.uColor, this.uColor2, f);
    })();
  }

  private nodoOpacidad(): any {
    return Fn(() => {
      const level = attribute('iLevel', 'float');
      const iMax = attribute('iMax', 'float');
      return float(1).sub(clamp(level.div(iMax), 0, 1).mul(0.8));
    })();
  }

  // ————— Exportador (plano 2D autocontenido) —————

  exportar(p: Params): string {
    return PLANTILLA.replaceAll('__PARAMS__', JSON.stringify(p));
  }
}

const IDENTIDAD = new THREE.Matrix4();

/** Las 6 caras de un cubo [-1,1]³: cada matriz lleva el +Z local (donde se apila
 *  el anidado) a la normal exterior de la cara, y la traslada a su centro. */
function carasCubo(): THREE.Matrix4[] {
  const M = () => new THREE.Matrix4();
  return [
    M().setPosition(0, 0, 1),                                // +Z
    M().makeRotationX(Math.PI).setPosition(0, 0, -1),        // −Z
    M().makeRotationY(Math.PI / 2).setPosition(1, 0, 0),     // +X
    M().makeRotationY(-Math.PI / 2).setPosition(-1, 0, 0),   // −X
    M().makeRotationX(-Math.PI / 2).setPosition(0, 1, 0),    // +Y
    M().makeRotationX(Math.PI / 2).setPosition(0, -1, 0),    // −Y
  ];
}

/** PRNG determinista (mulberry32) → misma semilla, misma nube de puntos. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLANTILLA = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — Delaunay</title>
<style>html,body{margin:0;height:100%;background:#0d0d12;overflow:hidden}canvas{display:block}</style>
</head><body><script type="module">
import Delaunator from 'https://cdn.jsdelivr.net/npm/delaunator@5/+esm';
const P = __PARAMS__;
const cv = document.createElement('canvas'); document.body.appendChild(cv);
const ctx = cv.getContext('2d');
const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
resize(); addEventListener('resize', resize);
const rng = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const r = rng((P.semilla|0) >>> 0);
const xy = [-1,-1, 1,-1, 1,1, -1,1];
for (let i = 0; i < P.puntos; i++) xy.push(r()*2-1, r()*2-1);
const tri = new Delaunator(xy).triangles;
const R1=(P.color>>16)&255, G1=(P.color>>8)&255, B1=P.color&255;
const R2=(P.color2>>16)&255, G2=(P.color2>>8)&255, B2=P.color2&255;
const amp = P.ampDeg == null ? 0.7 : P.ampDeg;
const umbral = P.umbral == null ? 0.05 : P.umbral;
const frame = (ms) => {
  const t0 = ms * 0.001;
  ctx.fillStyle = '#0d0d12'; ctx.fillRect(0, 0, cv.width, cv.height);
  const S = Math.min(cv.width, cv.height) * 0.45 * (P.escala/2), cx = cv.width/2, cy = cv.height/2;
  ctx.lineWidth = 0.7;
  for (let k = 0; k < tri.length; k += 3) {
    const a = tri[k], b = tri[k+1], c = tri[k+2];
    const ax = xy[a*2], ay = xy[a*2+1], bx = xy[b*2], by = xy[b*2+1], cx2 = xy[c*2], cy2 = xy[c*2+1];
    const gx = (ax+bx+cx2)/3, gy = (ay+by+cy2)/3;
    const area = Math.abs((bx-ax)*(cy2-ay)-(cx2-ax)*(by-ay))*0.5;
    const lv = umbral>0 ? Math.max(1, Math.min(P.anidado, Math.round(Math.sqrt(area)/umbral))) : P.anidado;
    for (let l = 0; l < lv; l++) {
      const s = P.modoEsc ? 1/(l+1) : 1 - l/lv;
      const ang = l*P.giro + t0*P.velGiro;
      const f = (l/lv)*amp;
      const R = Math.round(R1+(R2-R1)*f), G = Math.round(G1+(G2-G1)*f), B = Math.round(B1+(B2-B1)*f);
      const col = 'rgba('+R+','+G+','+B+','+(1 - l/lv*0.85)+')';
      const pt = (vx, vy) => { const rx=(vx-gx)*s, ry=(vy-gy)*s; return [cx + (rx*Math.cos(ang)-ry*Math.sin(ang)+gx)*S, cy - (rx*Math.sin(ang)+ry*Math.cos(ang)+gy)*S]; };
      const p0 = pt(ax,ay), p1 = pt(bx,by), p2 = pt(cx2,cy2);
      if (P.vista === 0) { // Puntos
        ctx.fillStyle = col;
        for (const q of [p0, p1, p2]) { ctx.beginPath(); ctx.arc(q[0], q[1], P.puntoTam, 0, 2*Math.PI); ctx.fill(); }
      } else {
        ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.closePath();
        if (P.vista === 2) { ctx.fillStyle = col; ctx.fill(); } // Caras
        else { ctx.strokeStyle = col; ctx.stroke(); }          // Alambre
      }
    }
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
</script></body></html>`;
