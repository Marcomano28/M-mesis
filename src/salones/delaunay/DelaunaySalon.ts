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
  Fn, uniform, uniformArray, attribute, float, vec3, vec4, int,
  sin, cos, mix, clamp,
} from 'three/tsl';
import Delaunator from 'delaunator';
import type { Salon, Params, ParamDef, HiloFichaDef } from '../../core/Salon';

const MODO = { Lineal: 0, Exponencial: 1 };
const VISTA = { Puntos: 0, Alambre: 1, Caras: 2, Ambos: 3 };
const TRAMA = { Triángulos: 0, 'Celdas Room': 1 };
const RELLENO_CARAS = { Degradado: 0, 'Room clara': 1 };
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

  hilosFicha: HiloFichaDef[] = [
    { clave: 'param.giro', etiqueta: 'giro por nivel', categoria: 'movimiento', min: -2, max: 2, velocidad: 'gesto', coste: 'barato', afinidades: ['pulso'], legado: true },
    { clave: 'param.velGiro', etiqueta: 'velocidad de giro', categoria: 'movimiento', min: 0, max: 3, velocidad: 'frase', coste: 'barato', afinidades: ['energia', 'pulso'], legado: true },
    { clave: 'param.sepZ', etiqueta: 'separación de capas', categoria: 'expresion', min: 0, max: 0.3, velocidad: 'gesto', coste: 'barato', afinidades: ['ataque', 'altura'], porDefecto: true, legado: true },
    { clave: 'param.escala', etiqueta: 'respiración interna', categoria: 'expresion', min: 0.2, max: 5, velocidad: 'gesto', coste: 'barato', afinidades: ['energia'], legado: true },
    { clave: 'param.ampDeg', etiqueta: 'amplitud del degradado', categoria: 'material', min: 0, max: 1, velocidad: 'frase', coste: 'barato', afinidades: ['armonia', 'brillo'], porDefecto: true, legado: true },
    { clave: 'param.puntoTam', etiqueta: 'tamaño de punto', categoria: 'material', min: 0.3, max: 6, velocidad: 'impulso', coste: 'barato', afinidades: ['ataque', 'brillo'], legado: true },
  ];

  params: ParamDef[] = [
    { clave: 'puntos',   etiqueta: 'puntos',       valor: 40,     min: 3,   max: 400, paso: 1 },
    { clave: 'semilla',  etiqueta: 'semilla',      valor: 1,      min: 1,   max: 999, paso: 1 },
    { clave: 'figura',   etiqueta: 'figura',       valor: 0,      min: 0,   max: 1,   opciones: FIGURA },
    { clave: 'trama',    etiqueta: 'trama',        valor: 1,      min: 0,   max: 1,   opciones: TRAMA },
    { clave: 'caraOff',  etiqueta: 'cara apagada', valor: 0,      min: -1,  max: 5,   opciones: CARA },
    { clave: 'anidado',  etiqueta: 'anidado (máx)', valor: 8,     min: 1,   max: 30,  paso: 1 },
    { clave: 'umbral',   etiqueta: 'poda LOD',     valor: 0.05,   min: 0,   max: 0.5 },
    { clave: 'vista',    etiqueta: 'exposición',   valor: 1,      min: 0,   max: 3,   opciones: VISTA },
    { clave: 'modoEsc',  etiqueta: 'escala',       valor: 1,      min: 0,   max: 1,   opciones: MODO },
    { clave: 'giro',     etiqueta: 'giro/nivel',   valor: 0,      min: -2,  max: 2 },
    { clave: 'velGiro',  etiqueta: 'giro tiempo',  valor: 0,      min: 0,   max: 3 },
    { clave: 'sepZ',     etiqueta: 'separación Z',  valor: 0.03,  min: 0,   max: 0.3 },
    { clave: 'extrude',  etiqueta: 'extrude',      valor: 0,      min: 0,   max: 1,   opciones: EXTRUDE },
    { clave: 'escala',   etiqueta: 'escala global', valor: 2,     min: 0.2, max: 5 },
    { clave: 'color',    etiqueta: 'color',        valor: 0x8ab4ff, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'color2',   etiqueta: 'color 2 (degradado)', valor: 0xff5a8c, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'rellenoCaras', etiqueta: 'relleno caras', valor: 1, min: 0, max: 1, opciones: RELLENO_CARAS },
    // La pareja procede del tema claro de Room.js: la luz no es un color plano,
    // sino el extremo claro de una escala calculada para cada celda y nivel.
    { clave: 'colorRelleno', etiqueta: 'luz Room', valor: 0xf0faec, min: 0, max: 0xffffff, tipo: 'color' },
    { clave: 'colorSombra', etiqueta: 'sombra Room', valor: 0x000000, min: 0, max: 0xffffff, tipo: 'color' },
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
    rellenoCaras: uniform(1), // 0 = degradado existente, 1 = paleta procedimental Room
    tiempo:  uniform(0),
  };
  private uColor = uniform(new THREE.Color(0x8ab4ff));
  private uColor2 = uniform(new THREE.Color(0xff5a8c));
  private uColorRelleno = uniform(new THREE.Color(0xf0faec));
  private uColorSombra = uniform(new THREE.Color(0x000000));

  private grupo = new THREE.Group();
  // 3 representaciones compartiendo geometría instanciada y grafo de posición.
  private objs: { puntos: THREE.Points; alambre: THREE.Mesh; caras: THREE.Mesh } | null = null;
  private geo: THREE.InstancedBufferGeometry | null = null;
  // Firma de la última topología horneada (para regenerar solo si cambia)
  private firma = '';
  private materialRoom: boolean | null = null;

  // Caras de despliegue: el shader coloca cada instancia con la matriz de su cara.
  // Se guardan MAX_CARAS slots (identidad de relleno) para un uniformArray fijo;
  // el plano usa 1, el cubo 6. Indexadas por el atributo por-instancia `iFace`.
  private matCaras: THREE.Matrix4[] = Array.from({ length: MAX_CARAS }, () => new THREE.Matrix4());
  private uCaras = uniformArray(this.matCaras, 'mat4');

  init(escena: THREE.Scene): void {
    // Grafos TSL compartidos por las tres representaciones.
    const pos = this.nodoPos();
    const color = this.nodoColor();
    const colorCaras = this.nodoColorCaras();
    const colorAlambre = this.nodoColorAlambre();
    const opac = this.nodoOpacidad();
    const opacCaras = this.nodoOpacidadCaras();
    const opacAlambre = this.nodoOpacidadAlambre();
    const geo = this.geoBase();

    const matPuntos = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false });
    matPuntos.positionNode = pos; matPuntos.colorNode = color; matPuntos.opacityNode = opac;

    const matAlambre = new THREE.MeshBasicNodeMaterial({ wireframe: true, transparent: true, depthWrite: false });
    matAlambre.positionNode = pos; matAlambre.colorNode = colorAlambre; matAlambre.opacityNode = opacAlambre;

    const matCaras = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
    matCaras.positionNode = pos; matCaras.colorNode = colorCaras; matCaras.opacityNode = opacCaras;

    this.objs = {
      puntos: new THREE.Points(geo, matPuntos),
      alambre: new THREE.Mesh(geo, matAlambre),
      caras: new THREE.Mesh(geo, matCaras),
    };
    for (const o of [this.objs.puntos, this.objs.alambre, this.objs.caras]) {
      o.frustumCulled = false; // el positionNode reubica los vértices
      this.grupo.add(o);
    }
    // En la variante Room, el contorno cálido forma parte de las caras, como
    // en el sketch original; se dibuja por encima de los planos opacos.
    this.objs.caras.renderOrder = 1;
    this.objs.alambre.renderOrder = 2;
    escena.add(this.grupo);
    this.firma = ''; // fuerza horneado en el primer update
  }

  update(_dt: number, tiempo: number, p: Params): void {
    // — Topología: se rehornea solo si cambian puntos / semilla / anidado —
    const puntos = Math.max(3, Math.round(p.puntos ?? 40));
    const semilla = Math.round(p.semilla ?? 1);
    const niveles = Math.max(1, Math.round(p.anidado ?? 8));
    const figura = p.figura === 1 ? 1 : 0;
    const trama = p.trama === 0 ? 0 : 1;
    const caraOff = Math.round(p.caraOff ?? -1);
    const umbral = Math.max(0, p.umbral ?? 0.05);
    const firma = `${figura}|${trama}|${caraOff}|${umbral.toFixed(3)}|${puntos}|${semilla}|${niveles}`;
    if (firma !== this.firma) {
      this.firma = firma;
      this.hornear(figura, trama, caraOff, umbral, puntos, semilla, niveles);
    }

    // — Exposición: solo la representación activa es visible —
    const vista = p.vista === 3 ? 3 : p.vista === 2 ? 2 : p.vista === 0 ? 0 : 1;
    const esRoom = p.rellenoCaras === 1;
    if (this.objs) {
      this.objs.puntos.visible = vista === VISTA.Puntos;
      this.objs.alambre.visible = vista === VISTA.Alambre || vista === VISTA.Ambos || (vista === VISTA.Caras && esRoom);
      this.objs.caras.visible = vista === VISTA.Caras || vista === VISTA.Ambos;

      if (this.materialRoom !== esRoom) {
        const material = this.objs.caras.material as THREE.MeshBasicNodeMaterial;
        material.transparent = !esRoom;
        material.depthWrite = esRoom;
        material.needsUpdate = true;
        this.materialRoom = esRoom;
      }
    }

    // — Uniforms —
    this.u.modo.value = p.modoEsc === 0 ? 0 : 1;
    this.u.giro.value = p.giro ?? 0;
    this.u.velGiro.value = p.velGiro ?? 0;
    this.u.sepZ.value = p.sepZ ?? 0.03;
    this.u.dir.value = p.extrude === 1 ? -1 : 1;
    this.u.ampDeg.value = p.ampDeg ?? 0.7;
    this.u.rellenoCaras.value = esRoom ? 1 : 0;
    this.u.tiempo.value = tiempo;
    if (p.color !== undefined) this.uColor.value.setHex(p.color);
    if (p.color2 !== undefined) this.uColor2.value.setHex(p.color2);
    if (p.colorRelleno !== undefined) this.uColorRelleno.value.setHex(p.colorRelleno);
    if (p.colorSombra !== undefined) this.uColorSombra.value.setHex(p.colorSombra);

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
  private hornear(figura: number, trama: number, caraOff: number, umbral: number, puntos: number, semilla: number, niveles: number): void {
    const rnd = mulberry32(semilla);
    // Esquinas del plano [-1,1]² → cobertura total; luego puntos aleatorios.
    const xy: number[] = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < puntos; i++) xy.push(rnd() * 2 - 1, rnd() * 2 - 1);

    const del = new Delaunator(xy);
    const tri = del.triangles;    // índices, longitud = 3·nTri
    const half = del.halfedges;   // media-arista opuesta (o −1 en el borde)
    const nTri = tri.length / 3;

    // — Parches a instanciar —
    // Un «parche» es el triángulo 2D que replica el anidado, junto con el centro
    // hacia el que se contrae y el tamaño (perímetro) que decide su LOD y su luz.
    // · Triángulos: 1 parche por triángulo de Delaunay.
    // · Celdas Room: el teselado dual del sketch. Cada arista interior compartida
    //   por dos triángulos genera un cuadrilátero [centroA, u, centroB, v] (los
    //   centros de ambos triángulos y los extremos u,v de la arista). Ese quad se
    //   parte en dos parches que comparten centro y tamaño, así el anidado escala
    //   la celda como una sola pieza (como drawShapeByMeanOffset en Room.js).
    type Parche = {
      ax: number; ay: number; bx: number; by: number; cx: number; cy: number;
      gx: number; gy: number; size: number;
    };
    const parches: Parche[] = [];
    let maxSize = 0;

    if (trama === TRAMA['Celdas Room']) {
      const cenX = new Float32Array(nTri), cenY = new Float32Array(nTri);
      for (let t = 0; t < nTri; t++) {
        const a = tri[t * 3], b = tri[t * 3 + 1], d = tri[t * 3 + 2];
        cenX[t] = (xy[a * 2] + xy[b * 2] + xy[d * 2]) / 3;
        cenY[t] = (xy[a * 2 + 1] + xy[b * 2 + 1] + xy[d * 2 + 1]) / 3;
      }
      for (let e = 0; e < tri.length; e++) {
        const opp = half[e];
        if (opp < 0 || e > opp) continue; // borde (sin celda) o arista ya tratada
        const tA = (e / 3) | 0, tB = (opp / 3) | 0;
        const u = tri[e], v = tri[e % 3 === 2 ? e - 2 : e + 1]; // extremos de la arista
        const gAx = cenX[tA], gAy = cenY[tA], gBx = cenX[tB], gBy = cenY[tB];
        const ux = xy[u * 2], uy = xy[u * 2 + 1], vx = xy[v * 2], vy = xy[v * 2 + 1];
        const gx = (gAx + ux + gBx + vx) / 4, gy = (gAy + uy + gBy + vy) / 4;
        const size = dist(gAx, gAy, ux, uy) + dist(ux, uy, gBx, gBy) +
                     dist(gBx, gBy, vx, vy) + dist(vx, vy, gAx, gAy);
        if (size > maxSize) maxSize = size;
        parches.push({ ax: gAx, ay: gAy, bx: ux, by: uy, cx: gBx, cy: gBy, gx, gy, size });
        parches.push({ ax: gAx, ay: gAy, bx: gBx, by: gBy, cx: vx, cy: vy, gx, gy, size });
      }
    } else {
      for (let t = 0; t < nTri; t++) {
        const a = tri[t * 3], b = tri[t * 3 + 1], d = tri[t * 3 + 2];
        const ax = xy[a * 2], ay = xy[a * 2 + 1];
        const bx = xy[b * 2], by = xy[b * 2 + 1];
        const cx = xy[d * 2], cy = xy[d * 2 + 1];
        const gx = (ax + bx + cx) / 3, gy = (ay + by + cy) / 3;
        const size = dist(ax, ay, bx, by) + dist(bx, by, cx, cy) + dist(cx, cy, ax, ay);
        if (size > maxSize) maxSize = size;
        parches.push({ ax, ay, bx, by, cx, cy, gx, gy, size });
      }
    }
    maxSize = maxSize || 1; // evita /0 con nubes degeneradas

    // Matrices de cara → uniformArray (relleno con identidad hasta MAX_CARAS).
    // La Room omite la cara `caraOff` para poder ver dentro; el plano usa 1.
    const caras = figura === FIGURA.Room
      ? carasCubo().filter((_, i) => i !== caraOff)
      : [IDENTIDAD];
    const nCaras = caras.length;
    for (let i = 0; i < MAX_CARAS; i++) this.matCaras[i].copy(caras[i] ?? IDENTIDAD);

    // LOD: niveles por parche según su tamaño (perímetro). Grandes → hasta
    // `niveles`; pequeños → menos, evitando anidar detalle sub-píxel.
    // `umbral` = tamaño mínimo de copia que vale la pena anidar (0 = sin poda).
    const lv = new Uint16Array(parches.length);
    let porCara = 0;
    for (let i = 0; i < parches.length; i++) {
      lv[i] = umbral > 0
        ? Math.max(1, Math.min(niveles, Math.round(parches[i].size / (umbral * K_LOD))))
        : niveles;
      porCara += lv[i];
    }

    const N = porCara * nCaras;
    // Atributos empaquetados en vec4 para no exceder el máximo de 8 vertex buffers
    // de WebGPU (position + 3 buffers instanciados = 4):
    //   iAB = [ax, ay, bx, by]           iCG = [cx, cy, centroX, centroY]
    //   iMeta = [nivel, iMax, cara, tamañoN]
    const iAB = new Float32Array(N * 4);
    const iCG = new Float32Array(N * 4);
    const iMeta = new Float32Array(N * 4);

    let k = 0;
    for (let c = 0; c < nCaras; c++) {
      for (let i = 0; i < parches.length; i++) {
        const P = parches[i];
        const sizeN = P.size / maxSize; // (0,1] → luz Room
        const m = lv[i];
        for (let l = 0; l < m; l++) {
          iAB[k * 4] = P.ax; iAB[k * 4 + 1] = P.ay; iAB[k * 4 + 2] = P.bx; iAB[k * 4 + 3] = P.by;
          iCG[k * 4] = P.cx; iCG[k * 4 + 1] = P.cy; iCG[k * 4 + 2] = P.gx; iCG[k * 4 + 3] = P.gy;
          iMeta[k * 4] = l; iMeta[k * 4 + 1] = m; iMeta[k * 4 + 2] = c; iMeta[k * 4 + 3] = sizeN;
          k++;
        }
      }
    }

    const geo = this.geoBase();
    geo.setAttribute('iAB', new THREE.InstancedBufferAttribute(iAB, 4));
    geo.setAttribute('iCG', new THREE.InstancedBufferAttribute(iCG, 4));
    geo.setAttribute('iMeta', new THREE.InstancedBufferAttribute(iMeta, 4));
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
      const AB = attribute('iAB', 'vec4');
      const CG = attribute('iCG', 'vec4');
      const meta = attribute('iMeta', 'vec4');
      const A = AB.xy, B = AB.zw, C = CG.xy;
      const level = meta.x;
      const iMax = meta.y; // niveles de ESTE parche (LOD)
      const face = meta.z;

      const p2 = A.mul(bary.x).add(B.mul(bary.y)).add(C.mul(bary.z));
      // Centro compartido del parche (centroide del triángulo o de la celda dual):
      // los sub-triángulos de una misma celda se contraen hacia el mismo punto.
      const centro = CG.zw;

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
      const meta = attribute('iMeta', 'vec4');
      const level = meta.x, iMax = meta.y;
      // Degradado a lo largo del anidado (= profundidad del extrude), con amplitud.
      const f = clamp(level.div(iMax), 0, 1).mul(u.ampDeg);
      return mix(this.uColor, this.uColor2, f);
    })();
  }

  /** Escala de la copia (idéntica a la de `nodoPos`): expo 1/(l+1) o lin 1−l/iMax.
   *  Se recalcula aquí para que la paleta Room comparta el mismo `s` sin atributos. */
  private nodoS(): any {
    const meta = attribute('iMeta', 'vec4');
    const level = meta.x, iMax = meta.y;
    const lin = float(1).sub(level.div(iMax));
    const expo = float(1).div(level.add(1));
    return mix(lin, expo, this.u.modo);
  }

  /** Valor gris procedimental del tema claro de Room (col = lerp(1−s, tam/s, 0.3)):
   *  crece con lo interno de la copia y con el tamaño de la celda. */
  private nodoRoomColN(): any {
    const s = this.nodoS();
    const size = attribute('iMeta', 'vec4').w;
    return mix(float(1).sub(s), size.mul(K_VOL).div(s), 0.3);
  }

  /** Luz de la celda ∈ [0,1] (fill = s − col en Room.js): copias grandes/externas
   *  tienden a la luz; las internas se hunden a la sombra (los huecos negros). */
  private nodoRoomFill(): any {
    return clamp(this.nodoS().sub(this.nodoRoomColN()), 0, 1);
  }

  /** Caras: degradado estructural (rellenoCaras=0) o la paleta luz/sombra de Room (1). */
  private nodoColorCaras(): any {
    const degradado = this.nodoColor();
    const room = mix(this.uColorSombra, this.uColorRelleno, this.nodoRoomFill());
    return Fn(() => mix(degradado, room, this.u.rellenoCaras))();
  }

  /** Alambre: en Room es el contorno cálido translúcido (girishCol del sketch:
   *  R>G>B), superpuesto a los planos; en degradado, el color estructural normal. */
  private nodoColorAlambre(): any {
    const degradado = this.nodoColor();
    const s = this.nodoS();
    const c = this.nodoRoomColN();
    const warm = vec3(
      clamp(s.mul(0.1).add(c.mul(0.5)), 0, 1),
      clamp(c.mul(s), 0, 1),
      clamp(c.mul(s).sub(c.div(3)), 0, 1),
    );
    return Fn(() => mix(degradado, warm, this.u.rellenoCaras))();
  }

  /** Opacidad estructural por nivel (base de puntos, caras y alambre). */
  private nodoOpacidad(): any {
    return Fn(() => {
      const meta = attribute('iMeta', 'vec4');
      const level = meta.x, iMax = meta.y;
      return float(1).sub(clamp(level.div(iMax), 0, 1).mul(0.8));
    })();
  }

  /** Caras: opacas en Room (planos que se ocluyen), degradadas en el modo normal. */
  private nodoOpacidadCaras(): any {
    return Fn(() => mix(this.nodoOpacidad(), float(1), this.u.rellenoCaras))();
  }

  /** Alambre: contorno translúcido (α≈80/255) en Room, degradado en el modo normal. */
  private nodoOpacidadAlambre(): any {
    return Fn(() => mix(this.nodoOpacidad(), float(0.32), this.u.rellenoCaras))();
  }

  // ————— Exportador (plano 2D autocontenido) —————

  exportar(p: Params): string {
    return PLANTILLA.replaceAll('__PARAMS__', JSON.stringify(p));
  }
}

const IDENTIDAD = new THREE.Matrix4();

// Perímetro ≈ K_LOD·(tamaño característico): traduce el `umbral` (pensado sobre
// √área de un triángulo) a la escala del perímetro de un parche.
const K_LOD = 3;
// Peso del tamaño de celda en el oscurecimiento de la paleta Room (el `volume/s`
// del sketch, ya con el tamaño normalizado a (0,1]).
const K_VOL = 0.8;

/** Distancia euclídea 2D — usada al medir perímetros de parches en el horneado. */
function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

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
        if (P.vista === 2 || P.vista === 3) { ctx.fillStyle = col; ctx.fill(); }
        if (P.vista === 1 || P.vista === 3) { ctx.strokeStyle = col; ctx.stroke(); }
      }
    }
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
</script></body></html>`;
