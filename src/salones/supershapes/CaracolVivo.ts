import * as THREE from 'three/webgpu';
import { TejidoCaracol, posicionCorporal, RECETA_CARACOL } from '../../core/TejidoCaracol';
import { Vestuario, type CuerpoVestible, type MuestraCorporal } from '../../vestuario/AlmacenDisfraces';
import { almacenDisfraces } from '../../vestuario/disfraces';

/** Anatomía y adaptador corporal. Los disfraces no conocen la fórmula de Caracol. */
export class CaracolVivo {
  readonly tejido = new TejidoCaracol();
  readonly grupo = new THREE.Group();
  readonly superficie: THREE.Mesh;
  readonly germen: THREE.Mesh;
  readonly cuerpo: CuerpoVestible;
  readonly vestuario: Vestuario;
  desarrollo = 0.85;
  readonly receta = { ...RECETA_CARACOL };
  revelarTejido = false;
  private revision = 0;
  private ultimaEdad = NaN;
  private ultimoRadio = NaN;
  private ultimasVueltas = NaN;
  private ultimaZ = NaN;
  private readonly alturaAnterior = new Float64Array(64 * 32).fill(NaN);
  private readonly memoriaAnterior = new Float64Array(64 * 32);
  private estadoVertices = new Float32Array(129 * 65 * 2);
  private nx = 128;
  private ny = 64;
  private geometria!: THREE.BufferGeometry;
  private pos = new Float32Array(129 * 65 * 3);
  private readonly p = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly curva: THREE.Line;

  constructor() {
    this.geometria = this.prepararGeometria();
    this.superficie = new THREE.Mesh(this.geometria, new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }));
    this.superficie.visible = false; // Conserva el raycast aunque se vista solamente de puntos.
    this.germen = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicNodeMaterial({ color: '#ffddad' }));
    this.germen.position.z = -Math.pow(0.375 * Math.PI, 1.4) * 0.01;
    const geoCurva = new THREE.BufferGeometry();
    geoCurva.setAttribute('position', new THREE.BufferAttribute(new Float32Array(129 * 3), 3));
    this.curva = new THREE.Line(geoCurva, new THREE.LineBasicNodeMaterial({ color: '#f1d4a8' }));
    const actor = this;
    this.cuerpo = {
      get semilla() { return actor.tejido.semilla; },
      get desarrollo() { return actor.desarrollo; },
      get malla() { return actor.geometria; },
      atributoEstado: 'miaEstado',
      get revision() { return actor.revision; },
      muestrearEstado: (u, v, salida) => {
        salida.excitacion = this.tejido.muestrear(u, v);
        salida.memoria = this.tejido.muestrear(u, v, true);
      },
      muestrearPosicion: (u, v, salida) => {
        salida.excitacion = this.tejido.muestrear(u, v);
        salida.memoria = this.tejido.muestrear(u, v, true);
        posicionCorporal(u, v, this.desarrollo, salida.excitacion, salida.memoria, salida.posicion, this.receta);
      },
      muestrear: (u, v, salida) => this.muestrear(u, v, salida),
      flujo: (u, v, salida) => salida.set(0.025 + 0.015 * Math.sin(v * Math.PI * 2),
        0.08 + this.tejido.muestrear(u, v) * 0.3 + this.tejido.muestrear(u, v, true) * 0.2),
    };
    this.vestuario = new Vestuario(almacenDisfraces, this.cuerpo);
    this.grupo.add(this.superficie, this.germen, this.curva, this.vestuario.grupo);
    // Acostado: la boca (u=1) abre hacia +X mundo y el hundimiento de curvaZ crece hacia -Z (adentro de la escena, no hacia abajo).
    this.grupo.rotation.set(Math.PI * 0.1, -Math.PI * 0.16, 0);
    for (const obj of this.grupo.children) obj.frustumCulled = false;
    this.actualizar();
    this.vestuario.restaurar({ version: 1, capas: [
      { id: 'alambre', intensidad: 1, detalle: 0.65 },
    ] });
  }
  /** Crea una geometría nueva: reutilizar una ya dispuesta confunde al backend WebGPU. */
  private prepararGeometria(): THREE.BufferGeometry {
    const cantidad = (this.nx + 1) * (this.ny + 1);
    this.pos = new Float32Array(cantidad * 3);
    this.estadoVertices = new Float32Array(cantidad * 2);
    const uv = new Float32Array((this.nx + 1) * (this.ny + 1) * 2), indices: number[] = [];
    for (let x = 0; x <= this.nx; x++) for (let y = 0; y <= this.ny; y++) {
      const i = x * (this.ny + 1) + y;
      uv[i * 2] = x / this.nx; uv[i * 2 + 1] = y / this.ny;
      if (x < this.nx && y < this.ny) {
        const j = i + this.ny + 1; indices.push(i, j, i + 1, i + 1, j, j + 1);
      }
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometria.setAttribute('miaEstado', new THREE.BufferAttribute(this.estadoVertices, 2).setUsage(THREE.DynamicDrawUsage));
    geometria.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.pos.length), 3));
    geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometria.setIndex(indices);
    return geometria;
  }
  /** Cambia el soporte visual, conservando tejido y estado de cada prenda. */
  configurarResolucion(longitud: number, contorno: number): void {
    if (!Number.isFinite(longitud) || !Number.isFinite(contorno)) throw new Error('Resolución inválida');
    const nx = Math.round(Math.max(8, Math.min(256, longitud)));
    const ny = Math.round(Math.max(4, Math.min(128, contorno)));
    if (nx === this.nx && ny === this.ny) return;
    const traje = this.vestuario.guardar();
    for (const capa of traje.capas) this.vestuario.quitar(capa.id);
    // Nunca reutilizar una BufferGeometry ya dispuesta: se reemplaza el objeto entero
    // (igual que SupershapesSalon.regenerarCaracol), no solo sus atributos.
    this.geometria.dispose();
    this.nx = nx; this.ny = ny;
    this.geometria = this.prepararGeometria();
    this.superficie.geometry = this.geometria;
    this.curva.geometry.dispose();
    this.curva.geometry = new THREE.BufferGeometry();
    this.curva.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((nx + 1) * 3), 3));
    this.ultimaEdad = NaN;
    this.actualizar();
    this.vestuario.restaurar(traje);
    this.vestuario.actualizar(0, this.revelarTejido);
  }
  /** Compatibilidad con los instantes v1 del ensayo anterior. */
  get faceta(): number { return this.vestuario.configuracion().find(c => c.id === 'peludo')?.detalle ?? 0.65; }
  set faceta(valor: number) { this.vestuario.configurar('peludo', 0.8, valor); }
  private posicion(u: number, v: number, out: THREE.Vector3): THREE.Vector3 {
    posicionCorporal(u, v, this.desarrollo, this.tejido.muestrear(u, v), this.tejido.muestrear(u, v, true), out, this.receta); return out;
  }
  private muestrear(u: number, v: number, salida: MuestraCorporal): void {
    this.posicion(u, v, salida.posicion);
    const paso = u > 0.999 ? -0.001 : 0.001;
    this.posicion(u + paso, v, this.a).sub(salida.posicion).multiplyScalar(1 / paso);
    this.posicion(u, v + 0.001, this.b).sub(salida.posicion);
    salida.normal.crossVectors(this.a, this.b).normalize(); salida.tangente.copy(this.a).normalize();
    salida.excitacion = this.tejido.muestrear(u, v); salida.memoria = this.tejido.muestrear(u, v, true);
  }
  actualizar(dt = 0): void {
    this.grupo.visible = this.desarrollo > 0.0001;
    this.germen.visible = this.desarrollo < 0.2;
    this.curva.visible = this.desarrollo < 0.23;
    let cambio = this.ultimaEdad !== this.desarrollo || this.ultimoRadio !== this.receta.radio
      || this.ultimasVueltas !== this.receta.vueltas || this.ultimaZ !== this.receta.curvaZ;
    // Los arrays del tejido son públicos: detectar también cambios externos y restauraciones.
    for (let i = 0; i < this.alturaAnterior.length && !cambio; i++) {
      cambio = this.alturaAnterior[i] !== this.tejido.altura[i] || this.memoriaAnterior[i] !== this.tejido.memoria[i];
    }
    if (!cambio) { this.vestuario.actualizar(dt, this.revelarTejido); return; }
    this.ultimaEdad = this.desarrollo; this.ultimoRadio = this.receta.radio;
    this.ultimasVueltas = this.receta.vueltas; this.ultimaZ = this.receta.curvaZ;
    this.alturaAnterior.set(this.tejido.altura); this.memoriaAnterior.set(this.tejido.memoria);
    const curva = this.curva.geometry.getAttribute('position');
    for (let x = 0; x <= this.nx; x++) {
      this.posicion(x / this.nx, 0.5, this.p); curva.setXYZ(x, this.p.x, this.p.y, this.p.z);
      for (let y = 0; y <= this.ny; y++) {
        const u = x / this.nx, v = y / this.ny, i = x * (this.ny + 1) + y;
        const z = this.tejido.muestrear(u, v), m = this.tejido.muestrear(u, v, true);
        this.estadoVertices[i * 2] = z; this.estadoVertices[i * 2 + 1] = m;
        posicionCorporal(u, v, this.desarrollo, z, m, this.p, this.receta);
        this.p.toArray(this.pos, i * 3);
      }
    }
    curva.needsUpdate = true;
    this.geometria.getAttribute('miaEstado').needsUpdate = true;
    this.revision++;
    this.geometria.getAttribute('position').needsUpdate = true;
    this.geometria.computeVertexNormals(); this.geometria.computeBoundingSphere();
    this.vestuario.actualizar(dt, this.revelarTejido);
  }
  dispose(): void {
    this.vestuario.dispose();
    for (const o of [this.superficie, this.germen, this.curva]) {
      o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
    this.grupo.removeFromParent();
  }
}
