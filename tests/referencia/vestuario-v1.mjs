// Referencia congelada antes de optimizar el vestuario (2026-09-12). Solo pruebas/benchmark; no se importa en producción.

// src/salones/supershapes/CaracolVivo.ts
import * as THREE3 from "three/webgpu";

// src/core/TejidoCaracol.ts
var PASO_TEJIDO = 1 / 120;
var suave = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
var TejidoCaracol = class {
  constructor(columnas = 64, filas = 32, semilla = 1729) {
    this.columnas = columnas;
    this.filas = filas;
    this.semilla = semilla;
    const n = columnas * filas;
    this.altura = new Float64Array(n);
    this.velocidad = new Float64Array(n);
    this.memoria = new Float64Array(n);
    this.siguiente = new Float64Array(n);
  }
  columnas;
  filas;
  semilla;
  altura;
  velocidad;
  memoria;
  siguiente;
  resto = 0;
  tiempo = 0;
  /** Un impulso deposita velocidad, no desplaza el objeto ni toda su superficie. */
  tocar(u, v, fuerza = 4) {
    if (![u, v, fuerza].every(Number.isFinite)) return;
    u = Math.max(0, Math.min(1, u));
    v = (v % 1 + 1) % 1;
    fuerza = Math.max(-8, Math.min(8, fuerza));
    for (let x = 0; x < this.columnas; x++) {
      const du = (x / (this.columnas - 1) - u) / 0.038;
      if (Math.abs(du) > 4) continue;
      for (let y = 0; y < this.filas; y++) {
        const d = Math.abs(y / this.filas - v);
        const dv = Math.min(d, 1 - d) / 0.065;
        const i = x * this.filas + y;
        this.velocidad[i] = Math.max(-12, Math.min(
          12,
          this.velocidad[i] + fuerza * Math.exp(-0.5 * (du * du + dv * dv))
        ));
      }
    }
  }
  /** Las pausas largas no se convierten en saltos físicos; la UI pausa al ocultarse. */
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
    const y = (v % 1 + 1) % 1 * this.filas;
    const x0 = Math.floor(x), x1 = Math.min(x0 + 1, this.columnas - 1);
    const y0 = Math.floor(y) % this.filas, y1 = (y0 + 1) % this.filas;
    const fx = x - x0, fy = y - Math.floor(y);
    const a = datos[x0 * this.filas + y0] * (1 - fy) + datos[x0 * this.filas + y1] * fy;
    const b = datos[x1 * this.filas + y0] * (1 - fy) + datos[x1 * this.filas + y1] * fy;
    return a * (1 - fx) + b * fx;
  }
  get actividad() {
    let n = 0;
    for (const v of this.altura) n += v * v;
    return Math.sqrt(n / this.altura.length);
  }
  get huella() {
    let n = 0;
    for (const v of this.memoria) n += v;
    return n / this.memoria.length;
  }
  guardar() {
    return {
      version: 1,
      semilla: this.semilla,
      columnas: this.columnas,
      filas: this.filas,
      tiempo: this.tiempo,
      resto: this.resto,
      altura: Array.from(this.altura),
      velocidad: Array.from(this.velocidad),
      memoria: Array.from(this.memoria)
    };
  }
  restaurar(e) {
    const n = this.altura.length;
    if (e.version !== 1 || e.semilla !== this.semilla || e.columnas !== this.columnas || e.filas !== this.filas || ![e.altura, e.velocidad, e.memoria].every((a) => Array.isArray(a) && a.length === n && a.every(Number.isFinite)) || !Number.isFinite(e.tiempo) || e.tiempo < 0 || !Number.isFinite(e.resto) || e.resto < 0 || e.resto >= PASO_TEJIDO) {
      throw new Error("El estado corporal no corresponde a este Caracol.");
    }
    this.altura.set(e.altura);
    this.velocidad.set(e.velocidad);
    this.memoria.set(e.memoria);
    this.tiempo = e.tiempo;
    this.resto = e.resto;
  }
  reiniciar() {
    this.altura.fill(0);
    this.velocidad.fill(0);
    this.memoria.fill(0);
    this.tiempo = 0;
    this.resto = 0;
  }
};
var RECETA_CARACOL = { radio: 14, vueltas: 2, curvaZ: 1.4 };
function posicionCorporal(u, v, desarrollo, excitacion, memoria, out, receta = RECETA_CARACOL) {
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
  out.z = seccion * Math.sin(ph) - Math.pow(Math.max((th + 0.375) * Math.PI, 1e-3), receta.curvaZ) * 0.01 + q * apertura * 0.35;
}

// src/vestuario/AlmacenDisfraces.ts
import * as THREE from "three/webgpu";
var AlmacenDisfraces = class {
  catalogo = /* @__PURE__ */ new Map();
  registrar(definicion) {
    if (this.catalogo.has(definicion.id)) throw new Error(`Disfraz duplicado: ${definicion.id}`);
    this.catalogo.set(definicion.id, definicion);
    return this;
  }
  listar() {
    return [...this.catalogo.values()];
  }
  obtener(id) {
    const d = this.catalogo.get(id);
    if (!d) throw new Error(`Disfraz desconocido: ${id}`);
    return d;
  }
};
var Vestuario = class {
  constructor(almacen, cuerpo) {
    this.almacen = almacen;
    this.cuerpo = cuerpo;
  }
  almacen;
  cuerpo;
  grupo = new THREE.Group();
  activas = /* @__PURE__ */ new Map();
  compatible(d) {
    return d.requiere.every((k) => this.cuerpo[k] !== void 0);
  }
  guardar() {
    return { version: 1, capas: [...this.activas.values()].map(({ capa, prenda }) => ({
      ...capa,
      estado: prenda.guardar?.()
    })) };
  }
  /** Valida y construye antes de sustituir: un traje inválido conserva el actual. */
  restaurar(traje) {
    if (!traje || traje.version !== 1 || !Array.isArray(traje.capas)) throw new Error("Traje incompatible");
    const ids = /* @__PURE__ */ new Set();
    for (const c of traje.capas) {
      if (!c || ids.has(c.id) || ![c.intensidad, c.detalle].every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
        throw new Error("Capa inv\xE1lida");
      ids.add(c.id);
      if (!this.compatible(this.almacen.obtener(c.id))) throw new Error(`El cuerpo no admite ${c.id}`);
    }
    const nuevas = /* @__PURE__ */ new Map();
    try {
      for (const c of traje.capas) {
        const prenda = this.almacen.obtener(c.id).crear(this.cuerpo);
        nuevas.set(c.id, { capa: { id: c.id, intensidad: c.intensidad, detalle: c.detalle }, prenda });
        if (c.estado !== void 0) {
          if (!prenda.restaurar) throw new Error("Esta prenda no admite estado");
          prenda.restaurar(c.estado);
        }
      }
    } catch (error) {
      for (const { prenda } of nuevas.values()) prenda.dispose();
      throw error;
    }
    for (const { prenda } of this.activas.values()) {
      prenda.objeto.removeFromParent();
      prenda.dispose();
    }
    this.activas = nuevas;
    for (const { prenda } of nuevas.values()) this.grupo.add(prenda.objeto);
    this.actualizar();
  }
  configurar(id, intensidad, detalle = 0.65) {
    if (![intensidad, detalle].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error("Control fuera de rango");
    const actual = this.activas.get(id);
    if (actual) {
      actual.capa.intensidad = intensidad;
      actual.capa.detalle = detalle;
    } else {
      const def = this.almacen.obtener(id);
      if (!this.compatible(def)) throw new Error(`El cuerpo no admite ${id}`);
      const prenda = def.crear(this.cuerpo);
      this.activas.set(id, { capa: { id, intensidad, detalle }, prenda });
      this.grupo.add(prenda.objeto);
    }
    this.actualizar();
  }
  quitar(id) {
    const c = this.activas.get(id);
    if (!c) return;
    c.prenda.objeto.removeFromParent();
    c.prenda.dispose();
    this.activas.delete(id);
  }
  actualizar(dt = 0, diagnostico = false) {
    for (const { capa, prenda } of this.activas.values()) prenda.actualizar(capa, Math.max(0, Math.min(dt, 0.05)), diagnostico);
  }
  dispose() {
    for (const id of [...this.activas.keys()]) this.quitar(id);
    this.grupo.removeFromParent();
  }
};

// src/vestuario/disfraces.ts
import * as THREE2 from "three/webgpu";
var muestra = () => ({ posicion: new THREE2.Vector3(), normal: new THREE2.Vector3(), tangente: new THREE2.Vector3(), excitacion: 0, memoria: 0 });
function azar(i, semilla) {
  let x = Math.imul(i + 1, 374761393) ^ semilla;
  x = Math.imul(x ^ x >>> 13, 1274126177);
  return ((x ^ x >>> 16) >>> 0) / 4294967296;
}
var cobre = new THREE2.Color("#ac6754");
var nacar = new THREE2.Color("#f1d4a8");
var jade = new THREE2.Color("#71cbbf");
function tono(m, color, diagnostico) {
  return diagnostico ? color.setRGB(0.025 + Math.abs(m.excitacion) * 2.2, 0.06 + m.memoria * 3, 0.08 + Math.max(0, m.excitacion) * 1.9) : color.copy(nacar).lerp(jade, Math.min(0.85, Math.max(0, m.excitacion + m.memoria * 2)));
}
function superficie(cuerpo, alambre) {
  const geometria = cuerpo.malla.clone();
  const colores = new Float32Array(geometria.getAttribute("position").count * 3);
  geometria.setAttribute("color", new THREE2.BufferAttribute(colores, 3));
  const material = new THREE2.MeshPhysicalNodeMaterial({
    vertexColors: true,
    side: THREE2.DoubleSide,
    wireframe: alambre,
    roughness: 0.46,
    metalness: 0.38,
    clearcoat: 0.65,
    transparent: true
  });
  const objeto = new THREE2.Mesh(geometria, material);
  objeto.frustumCulled = false;
  const m = muestra(), color = new THREE2.Color();
  return { objeto, actualizar(c, _dt, diagnostico) {
    for (const nombre of ["position", "normal"]) {
      const origen = cuerpo.malla.getAttribute(nombre), destino = geometria.getAttribute(nombre);
      if (origen && destino) {
        destino.array.set(origen.array);
        destino.needsUpdate = true;
      }
    }
    const uv = geometria.getAttribute("uv");
    for (let i = 0; i < colores.length / 3; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      cuerpo.muestrear(u, v, m);
      tono(m, color, diagnostico);
      if (!diagnostico && !alambre) color.lerp(cobre, (0.4 + 0.3 * Math.sin(u * Math.PI * 44 + v * 7)) * c.detalle);
      color.toArray(colores, i * 3);
    }
    geometria.getAttribute("color").needsUpdate = true;
    material.opacity = c.intensidad;
    material.depthWrite = c.intensidad > 0.98;
    material.roughness = 0.15 + c.detalle * 0.7;
    objeto.visible = cuerpo.desarrollo > 0.22 && c.intensidad > 0;
  }, dispose() {
    geometria.dispose();
    material.dispose();
  } };
}
function fibras(cuerpo, modo) {
  const n = modo === "punteado" ? 2048 : 1e3, tramos = modo === "peludo" ? 4 : 1;
  const esLinea = modo === "peludo" || modo === "corriente";
  const posiciones = new Float32Array(n * (esLinea ? tramos * 2 : 1) * 3);
  const colores = new Float32Array(posiciones.length);
  const geometria = new THREE2.BufferGeometry();
  geometria.setAttribute("position", new THREE2.BufferAttribute(posiciones, 3).setUsage(THREE2.DynamicDrawUsage));
  geometria.setAttribute("color", new THREE2.BufferAttribute(colores, 3).setUsage(THREE2.DynamicDrawUsage));
  const material = esLinea ? new THREE2.LineBasicNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false }) : new THREE2.PointsNodeMaterial({ vertexColors: true, size: 0.035, sizeAttenuation: true, transparent: true, depthWrite: false });
  const objeto = esLinea ? new THREE2.LineSegments(geometria, material) : new THREE2.Points(geometria, material);
  objeto.frustumCulled = false;
  const uv = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = modo === "punteado" ? (Math.floor(i / 16) + 0.5) / 128 : 0.025 + azar(i * 3, cuerpo.semilla) * 0.95;
    uv[i * 2 + 1] = modo === "punteado" ? i % 16 / 16 : azar(i * 3 + 1, cuerpo.semilla);
  }
  const m = muestra(), otra = muestra(), velocidad = new THREE2.Vector2(), color = new THREE2.Color();
  return { objeto, actualizar(c, dt, diagnostico) {
    const madurez = Math.max(0, Math.min(1, (cuerpo.desarrollo - 0.35) / 0.65));
    objeto.visible = cuerpo.desarrollo > 1e-3 && c.intensidad > 0;
    material.opacity = c.intensidad;
    if (material instanceof THREE2.PointsNodeMaterial) material.size = 0.012 + c.detalle * 0.065;
    for (let i = 0; i < n; i++) {
      if (modo === "corriente" && dt > 0) {
        cuerpo.flujo(uv[i * 2], uv[i * 2 + 1], velocidad);
        uv[i * 2] = ((uv[i * 2] + velocidad.x * dt * (0.1 + c.detalle * 2)) % 1 + 1) % 1;
        uv[i * 2 + 1] = ((uv[i * 2 + 1] + velocidad.y * dt * (0.1 + c.detalle * 2)) % 1 + 1) % 1;
      }
      const u = uv[i * 2], v = uv[i * 2 + 1];
      cuerpo.muestrear(u, v, m);
      tono(m, color, diagnostico);
      if (!esLinea) {
        m.posicion.toArray(posiciones, i * 3);
        color.toArray(colores, i * 3);
        continue;
      }
      const largo = madurez * (0.035 + c.detalle * (0.08 + azar(i * 3 + 2, cuerpo.semilla) * 0.3) + Math.abs(m.excitacion) * 0.45 + m.memoria * 0.2);
      if (modo === "corriente") {
        cuerpo.flujo(u, v, velocidad);
        cuerpo.muestrear(Math.max(0, Math.min(1, u - velocidad.x * 0.12)), v - velocidad.y * 0.12, otra);
        color.multiplyScalar(Math.min(1, u * 30, (1 - u) * 30));
      }
      for (let s = 0; s < tramos; s++) for (let e = 0; e < 2; e++) {
        const t = (s + e) / tramos, j = (i * tramos * 2 + s * 2 + e) * 3;
        if (modo === "corriente") (e ? otra.posicion : m.posicion).toArray(posiciones, j);
        else {
          posiciones[j] = m.posicion.x + m.normal.x * largo * t + m.tangente.x * m.excitacion * 0.28 * t * t;
          posiciones[j + 1] = m.posicion.y + m.normal.y * largo * t + m.tangente.y * m.excitacion * 0.28 * t * t;
          posiciones[j + 2] = m.posicion.z + m.normal.z * largo * t + m.tangente.z * m.excitacion * 0.28 * t * t;
        }
        color.toArray(colores, j);
      }
    }
    geometria.getAttribute("position").needsUpdate = true;
    geometria.getAttribute("color").needsUpdate = true;
  }, ...modo === "corriente" ? {
    guardar: () => Array.from(uv),
    restaurar(estado) {
      if (!Array.isArray(estado) || estado.length !== uv.length || !estado.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error("Corriente incompatible");
      uv.set(estado);
    }
  } : {}, dispose() {
    geometria.dispose();
    material.dispose();
  } };
}
var almacenDisfraces = new AlmacenDisfraces().registrar({ id: "nacar", nombre: "N\xE1car", descripcion: "Piel continua con vetas que revelan la huella del contacto.", control: "Veta y rugosidad", requiere: ["malla", "muestrear"], crear: (c) => superficie(c, false) }).registrar({ id: "alambre", nombre: "Alambre", descripcion: "La trama de tri\xE1ngulos acompa\xF1a cada pliegue del cuerpo.", control: "Rugosidad", requiere: ["malla", "muestrear"], crear: (c) => superficie(c, true) });
for (const [id, nombre, descripcion, control] of [
  ["puntos", "Polvo de puntos", "Part\xEDculas ancladas a la piel conservan su lugar durante el crecimiento.", "Tama\xF1o"],
  ["punteado", "L\xEDneas de puntos", "Hileras recorren las coordenadas del cuerpo y se abren con \xE9l.", "Tama\xF1o"],
  ["peludo", "Peludo", "Fibras nacen de la superficie y se curvan con la excitaci\xF3n local.", "Longitud"],
  ["corriente", "Corriente", "Trazadores viajan por un campo corporal sensible a la memoria.", "Velocidad"]
]) almacenDisfraces.registrar({
  id,
  nombre,
  descripcion,
  control,
  requiere: id === "corriente" ? ["muestrear", "flujo"] : ["muestrear"],
  crear: (c) => fibras(c, id)
});

// src/salones/supershapes/CaracolVivo.ts
var CaracolVivo = class {
  tejido = new TejidoCaracol();
  grupo = new THREE3.Group();
  superficie;
  germen;
  cuerpo;
  vestuario;
  desarrollo = 0.85;
  receta = { ...RECETA_CARACOL };
  revelarTejido = false;
  nx = 128;
  ny = 64;
  geometria = new THREE3.BufferGeometry();
  pos = new Float32Array(129 * 65 * 3);
  p = new THREE3.Vector3();
  a = new THREE3.Vector3();
  b = new THREE3.Vector3();
  curva;
  constructor() {
    const uv = new Float32Array(129 * 65 * 2), indices = [];
    for (let x = 0; x <= this.nx; x++) for (let y = 0; y <= this.ny; y++) {
      const i = x * (this.ny + 1) + y;
      uv[i * 2] = x / this.nx;
      uv[i * 2 + 1] = y / this.ny;
      if (x < this.nx && y < this.ny) {
        const j = i + this.ny + 1;
        indices.push(i, j, i + 1, i + 1, j, j + 1);
      }
    }
    this.geometria.setAttribute("position", new THREE3.BufferAttribute(this.pos, 3).setUsage(THREE3.DynamicDrawUsage));
    this.geometria.setAttribute("normal", new THREE3.BufferAttribute(new Float32Array(this.pos.length), 3));
    this.geometria.setAttribute("uv", new THREE3.BufferAttribute(uv, 2));
    this.geometria.setIndex(indices);
    this.superficie = new THREE3.Mesh(this.geometria, new THREE3.MeshBasicNodeMaterial({ side: THREE3.DoubleSide }));
    this.superficie.visible = false;
    this.germen = new THREE3.Mesh(new THREE3.SphereGeometry(0.025, 12, 8), new THREE3.MeshBasicNodeMaterial({ color: "#ffddad" }));
    this.germen.position.z = -Math.pow(0.375 * Math.PI, 1.4) * 0.01;
    const geoCurva = new THREE3.BufferGeometry();
    geoCurva.setAttribute("position", new THREE3.BufferAttribute(new Float32Array(129 * 3), 3));
    this.curva = new THREE3.Line(geoCurva, new THREE3.LineBasicNodeMaterial({ color: "#f1d4a8" }));
    const actor = this;
    this.cuerpo = {
      get semilla() {
        return actor.tejido.semilla;
      },
      get desarrollo() {
        return actor.desarrollo;
      },
      malla: this.geometria,
      muestrear: (u, v, salida) => this.muestrear(u, v, salida),
      flujo: (u, v, salida) => salida.set(
        0.025 + 0.015 * Math.sin(v * Math.PI * 2),
        0.08 + this.tejido.muestrear(u, v) * 0.3 + this.tejido.muestrear(u, v, true) * 0.2
      )
    };
    this.vestuario = new Vestuario(almacenDisfraces, this.cuerpo);
    this.grupo.add(this.superficie, this.germen, this.curva, this.vestuario.grupo);
    this.grupo.rotation.set(-Math.PI * 0.56, 0, Math.PI * 0.95);
    for (const obj of this.grupo.children) obj.frustumCulled = false;
    this.actualizar();
    this.vestuario.restaurar({ version: 1, capas: [
      { id: "nacar", intensidad: 1, detalle: 0.65 },
      { id: "peludo", intensidad: 0.8, detalle: 0.65 }
    ] });
  }
  /** Compatibilidad con los instantes v1 del ensayo anterior. */
  get faceta() {
    return this.vestuario.guardar().capas.find((c) => c.id === "peludo")?.detalle ?? 0.65;
  }
  set faceta(valor) {
    this.vestuario.configurar("peludo", 0.8, valor);
  }
  posicion(u, v, out) {
    posicionCorporal(u, v, this.desarrollo, this.tejido.muestrear(u, v), this.tejido.muestrear(u, v, true), out, this.receta);
    return out;
  }
  muestrear(u, v, salida) {
    this.posicion(u, v, salida.posicion);
    const paso = u > 0.999 ? -1e-3 : 1e-3;
    this.posicion(u + paso, v, this.a).sub(salida.posicion).multiplyScalar(1 / paso);
    this.posicion(u, v + 1e-3, this.b).sub(salida.posicion);
    salida.normal.crossVectors(this.a, this.b).normalize();
    salida.tangente.copy(this.a).normalize();
    salida.excitacion = this.tejido.muestrear(u, v);
    salida.memoria = this.tejido.muestrear(u, v, true);
  }
  actualizar(dt = 0) {
    this.grupo.visible = this.desarrollo > 1e-4;
    this.germen.visible = this.desarrollo < 0.2;
    this.curva.visible = this.desarrollo < 0.23;
    const curva = this.curva.geometry.getAttribute("position");
    for (let x = 0; x <= this.nx; x++) {
      this.posicion(x / this.nx, 0.5, this.p);
      curva.setXYZ(x, this.p.x, this.p.y, this.p.z);
      for (let y = 0; y <= this.ny; y++) this.posicion(x / this.nx, y / this.ny, this.p).toArray(this.pos, (x * (this.ny + 1) + y) * 3);
    }
    curva.needsUpdate = true;
    this.geometria.getAttribute("position").needsUpdate = true;
    this.geometria.computeVertexNormals();
    this.geometria.computeBoundingSphere();
    this.vestuario.actualizar(dt, this.revelarTejido);
  }
  dispose() {
    this.vestuario.dispose();
    for (const o of [this.superficie, this.germen, this.curva]) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
    this.grupo.removeFromParent();
  }
};
export {
  CaracolVivo
};
