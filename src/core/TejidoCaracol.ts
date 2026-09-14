/** Tejido persistente del ensayo Caracol. Sin DOM, Three.js, reloj ni azar global. */
export interface EstadoTejido {
  version: 1;
  semilla: number;
  columnas: number;
  filas: number;
  tiempo: number;
  resto: number;
  altura: number[];
  velocidad: number[];
  memoria: number[];
}

export const PASO_TEJIDO = 1 / 120;
export const suave = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Identidad estable por coordenada; nunca depende de la cadencia de render. */
export function azarCelda(id: number, semilla = 1729): number {
  let x = (id + Math.imul(semilla, 374761393)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export class TejidoCaracol {
  readonly altura: Float64Array;
  readonly velocidad: Float64Array;
  readonly memoria: Float64Array;
  private siguiente: Float64Array;
  private resto = 0;
  tiempo = 0;

  constructor(readonly columnas = 64, readonly filas = 32, readonly semilla = 1729) {
    const n = columnas * filas;
    this.altura = new Float64Array(n);
    this.velocidad = new Float64Array(n);
    this.memoria = new Float64Array(n);
    this.siguiente = new Float64Array(n);
  }

  /** Un impulso deposita velocidad, no desplaza el objeto ni toda su superficie. */
  tocar(u: number, v: number, fuerza = 4): void {
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

  /** Las pausas largas no se convierten en saltos físicos; la UI pausa al ocultarse. */
  avanzar(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.resto += Math.min(dt, 0.1);
    while (this.resto + 1e-10 >= PASO_TEJIDO) {
      this.paso();
      this.resto -= PASO_TEJIDO;
      if (this.resto < 0) this.resto = 0;
    }
  }

  private paso(): void {
    const h = PASO_TEJIDO;
    for (let x = 0; x < this.columnas; x++) {
      for (let y = 0; y < this.filas; y++) {
        const i = x * this.filas + y;
        // Extremos longitudinales sin flujo; costura transversal periódica.
        const a = Math.max(0, x - 1) * this.filas + y;
        const b = Math.min(this.columnas - 1, x + 1) * this.filas + y;
        const c = x * this.filas + (y + this.filas - 1) % this.filas;
        const d = x * this.filas + (y + 1) % this.filas;
        const z = this.altura[i];
        const lap = this.altura[a] + this.altura[b] + this.altura[c] + this.altura[d] - 4 * z;
        // Onda amortiguada; la memoria deja una huella lenta, independiente del instante.
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

  muestrear(u: number, v: number, memoria = false): number {
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

  get actividad(): number {
    let n = 0;
    for (const v of this.altura) n += v * v;
    return Math.sqrt(n / this.altura.length);
  }

  get huella(): number {
    let n = 0;
    for (const v of this.memoria) n += v;
    return n / this.memoria.length;
  }

  guardar(): EstadoTejido {
    return { version: 1, semilla: this.semilla, columnas: this.columnas, filas: this.filas,
      tiempo: this.tiempo, resto: this.resto, altura: Array.from(this.altura),
      velocidad: Array.from(this.velocidad), memoria: Array.from(this.memoria) };
  }

  restaurar(e: EstadoTejido): void {
    const n = this.altura.length;
    if (e.version !== 1 || e.semilla !== this.semilla || e.columnas !== this.columnas || e.filas !== this.filas
      || ![e.altura, e.velocidad, e.memoria].every(a => Array.isArray(a) && a.length === n && a.every(Number.isFinite))
      || !Number.isFinite(e.tiempo) || e.tiempo < 0 || !Number.isFinite(e.resto) || e.resto < 0 || e.resto >= PASO_TEJIDO) {
      throw new Error('El estado corporal no corresponde a este Caracol.');
    }
    this.altura.set(e.altura); this.velocidad.set(e.velocidad); this.memoria.set(e.memoria);
    this.tiempo = e.tiempo; this.resto = e.resto;
  }

  reiniciar(): void {
    this.altura.fill(0); this.velocidad.fill(0); this.memoria.fill(0);
    this.tiempo = 0; this.resto = 0;
  }
}

export interface RecetaCaracol { radio: number; vueltas: number; curvaZ: number }
export const RECETA_CARACOL: RecetaCaracol = { radio: 14, vueltas: 2, curvaZ: 1.4 };

/**
 * Misma fórmula de posCaracol en SupershapesSalon. A desarrollo=1 y excitación=0
 * coincide con el cuerpo original. El desarrollo abre longitud y sección por separado.
 * Es evaluación de un generador sobre soporte fijo; no escalado del Object3D.
 */
export function posicionCorporal(
  u: number, v: number, desarrollo: number, excitacion: number, memoria: number,
  out: { x: number; y: number; z: number }, receta = RECETA_CARACOL,
): void {
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
