// Barniz — el paisaje de coherencia (Anexo I de la biblia).
//
// Escribe a mano una energía E(s) sobre el vector de estado normalizado: sus
// valles son las configuraciones que pertenecen al mundo del autor. Cada tick
// lento corrige el estado un paso cuesta abajo (−paso·∇E) y le añade un
// vagabundeo cuya amplitud gobierna la tensión musical (temperatura). Cero ML.
//
// Contrato idéntico a los demás motores (tick / exportar / restaurar / onCambio),
// para que la ficha de barniz viaje en DocumentoEscena v3 como rutas y LFOs.

import type { ParamBus } from './ParamBus';
import { VectorEstado, type EjeVector, envolver01 } from './VectorEstado';

/** Un par de acoplamiento de E1: `gasto` hay que pagarlo con `pago`. */
export interface Acoplamiento {
  gasto: string;   // dirección del eje que "cuesta"
  pago: string;    // dirección del eje que lo "compensa"
  k: number;
}

/** Ficha de barniz: la gramática estética hecha números. Todo persiste. */
export interface FichaBarniz {
  nombre: string;
  ejes: EjeVector[];
  /** Tonos ancla (0..1 circular) que SON la paleta. La energía tira al más cercano. */
  anclasTono: number[];
  acoplamientos: Acoplamiento[];
  /** Pesos de E3 por dirección de eje (cuánto suma a la carga percibida). */
  pesosCarga: Record<string, number>;
  bandaCarga: number;   // centro de la banda de carga deseada (0..1)
  k: { e1: number; e1b: number; e2: number; e2b: number; e3: number; e4: number };
  paso: number;         // tamaño del paso de descenso
  presupuesto: number;  // norma máxima de corrección por tick (protege el gesto del autor)
  tempMax: number;      // amplitud máxima del vagabundeo en el clímax
}

export function fichaBarnizPorDefecto(ejes: EjeVector[]): FichaBarniz {
  return {
    nombre: 'Barniz',
    ejes,
    anclasTono: [0.08, 0.52, 0.75], // ámbar · verde-azul · violeta (placeholder editable)
    acoplamientos: [],
    pesosCarga: {},
    bandaCarga: 0.45,
    k: { e1: 1, e1b: 8, e2: 3, e2b: 2, e3: 1.5, e4: 6 },
    paso: 0.05,
    presupuesto: 0.15,
    tempMax: 0.06,
  };
}

const HZ_LENTO = 15;          // el paisaje corrige a ~15 Hz, diezmado del frame
const H_GRAD = 0.01;          // paso de las diferencias finitas

/**
 * Interpola dos barnices (biblia, Anexo I §VI): NO mezcla imágenes — deforma el
 * paisaje bajo el estado, que rueda solo hacia el valle nuevo. Interpola anclas
 * y constantes; conserva los ejes de A (la escena no cambia de dimensiones).
 */
export function mezclarFichas(a: FichaBarniz, b: FichaBarniz, t: number): FichaBarniz {
  const u = Math.max(0, Math.min(1, t));
  const lerp = (x: number, y: number) => x + (y - x) * u;
  const n = Math.max(a.anclasTono.length, b.anclasTono.length);
  const anclasTono: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = a.anclasTono[i] ?? a.anclasTono[a.anclasTono.length - 1] ?? 0;
    const y = b.anclasTono[i] ?? b.anclasTono[b.anclasTono.length - 1] ?? 0;
    anclasTono.push(lerp(x, y));
  }
  return {
    ...a,
    nombre: `${a.nombre}↔${b.nombre}`,
    anclasTono,
    bandaCarga: lerp(a.bandaCarga, b.bandaCarga),
    k: {
      e1: lerp(a.k.e1, b.k.e1), e1b: lerp(a.k.e1b, b.k.e1b),
      e2: lerp(a.k.e2, b.k.e2), e2b: lerp(a.k.e2b, b.k.e2b),
      e3: lerp(a.k.e3, b.k.e3), e4: lerp(a.k.e4, b.k.e4),
    },
    paso: lerp(a.paso, b.paso),
    presupuesto: lerp(a.presupuesto, b.presupuesto),
    tempMax: lerp(a.tempMax, b.tempMax),
  };
}

export class MotorBarniz {
  activo = false;
  ficha: FichaBarniz | null = null;
  /** Monitores en vivo (para el panel de la Fase 4). */
  monitor = { E: 0, e1: 0, e2: 0, e3: 0, e4: 0, temp: 0, correccion: 0 };

  private vector: VectorEstado | null = null;
  private sPrevio: number[] | null = null;
  private acumulador = 0;       // acumula dt hasta completar un tick lento
  private tension = 0;          // fuente de temperatura (0..1), inyectada desde fuera
  private escuchasCambio = new Set<() => void>();

  constructor(private bus: ParamBus) {}

  /** Instala una ficha: reconstruye el vector y limpia el estado previo. */
  aplicar(ficha: FichaBarniz): void {
    this.vector?.soltar();
    this.ficha = ficha;
    this.vector = new VectorEstado(this.bus, ficha.ejes);
    this.sPrevio = null;
    if (this.vector.rechazadas.length) {
      console.warn('Barniz: direcciones sin rango, ignoradas:', this.vector.rechazadas);
    }
    this.emitirCambio();
  }

  encender(): void { this.activo = true; this.emitirCambio(); }

  /**
   * Funde la ficha ACTIVA hacia `destino` una fracción `alpha` (0..1), mutando
   * en sitio: no reconstruye el vector ni reinicia la inercia, así el fundido
   * es continuo. Lo usa el Narrador para transiciones sin corte. Si los ejes no
   * coinciden (otra escena), reemplaza de golpe.
   */
  acercarFicha(destino: FichaBarniz, alpha: number): void {
    const a = this.ficha;
    const mismos = a && a.ejes.length === destino.ejes.length
      && a.ejes.every((e, i) => e.direccion === destino.ejes[i].direccion);
    if (!a || !mismos) { this.aplicar(destino); return; }
    const u = Math.max(0, Math.min(1, alpha));
    const L = (x: number, y: number) => x + (y - x) * u;
    const n = Math.max(a.anclasTono.length, destino.anclasTono.length);
    const anclas: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = a.anclasTono[i] ?? a.anclasTono[a.anclasTono.length - 1] ?? 0;
      const y = destino.anclasTono[i] ?? destino.anclasTono[destino.anclasTono.length - 1] ?? 0;
      anclas.push(L(x, y));
    }
    a.anclasTono = anclas;
    a.bandaCarga = L(a.bandaCarga, destino.bandaCarga);
    a.k.e1 = L(a.k.e1, destino.k.e1); a.k.e1b = L(a.k.e1b, destino.k.e1b);
    a.k.e2 = L(a.k.e2, destino.k.e2); a.k.e2b = L(a.k.e2b, destino.k.e2b);
    a.k.e3 = L(a.k.e3, destino.k.e3); a.k.e4 = L(a.k.e4, destino.k.e4);
    a.paso = L(a.paso, destino.paso);
    a.presupuesto = L(a.presupuesto, destino.presupuesto);
    a.tempMax = L(a.tempMax, destino.tempMax);
  }

  apagar(): void {
    this.activo = false;
    this.vector?.soltar();  // devuelve la base intacta
    this.sPrevio = null;
    this.emitirCambio();
  }

  /** La capa de Frase inyecta aquí su tensión (0..1) cada frame. */
  fijarTension(t: number): void {
    this.tension = Math.max(0, Math.min(1, t));
  }

  /**
   * Direcciones que la música NO debe escribir directamente (biblia, Anexo I §V):
   * los ejes de paleta y todo eje circular (tono/hue). El color es identidad,
   * no parámetro reactivo. La Mesa de Sinestesia las excluye como destino.
   */
  direccionesProtegidas(): Set<string> {
    const out = new Set<string>();
    if (!this.ficha) return out;
    for (const eje of this.ficha.ejes) {
      if (eje.familia === 'paleta' || eje.circular) out.add(eje.direccion);
    }
    return out;
  }

  onCambio(fn: () => void): () => void {
    this.escuchasCambio.add(fn);
    return () => this.escuchasCambio.delete(fn);
  }

  exportar(): FichaBarniz | null {
    return this.ficha ? structuredClone(this.ficha) : null;
  }

  restaurar(ficha: FichaBarniz | null): void {
    this.vector?.soltar();
    if (ficha) this.aplicar(ficha);
    else { this.ficha = null; this.vector = null; this.sPrevio = null; this.emitirCambio(); }
  }

  private emitirCambio(): void {
    for (const fn of this.escuchasCambio) fn();
  }

  /** Un tick por frame; internamente diezma a ~HZ_LENTO. */
  tick(dt: number): void {
    if (!this.activo || !this.vector || !this.ficha || this.vector.dim === 0) return;
    this.acumulador += dt;
    const paso = 1 / HZ_LENTO;
    if (this.acumulador < paso) return;
    const dtLento = this.acumulador;
    this.acumulador = 0;
    this.pasoLento(dtLento);
  }

  private pasoLento(dt: number): void {
    const vec = this.vector!;
    const f = this.ficha!;
    const s = vec.leer();
    const sPrevio = this.sPrevio ?? s.slice();

    // 1) Gradiente de E en s (analítico para E4, finitas para el resto).
    const g = this.gradiente(s, sPrevio);

    // 2) Corrección cuesta abajo, recortada al presupuesto (protege el gesto del autor).
    const correccion = s.map((_, i) => -f.paso * g[i]);
    limitarNorma(correccion, f.presupuesto);

    // 3) Temperatura: vagabundeo escalado por la tensión musical.
    const T = f.tempMax * this.tension * this.tension; // curva suave
    const objetivo = s.map((v, i) => {
      let nuevo = v + correccion[i] + T * gauss();
      nuevo = vec.ejes[i].circular ? envolver01(nuevo) : Math.max(0, Math.min(1, nuevo));
      return nuevo;
    });

    vec.escribir(objetivo);
    this.sPrevio = objetivo;

    // 4) Monitores.
    const desc = this.energia(objetivo, sPrevio, true);
    this.monitor = {
      E: desc.E, e1: desc.e1, e2: desc.e2, e3: desc.e3, e4: desc.e4,
      temp: T, correccion: norma(correccion),
    };
  }

  // ————— La energía y su gradiente —————

  /** ∂E/∂sᵢ. E4 es analítico (2·k4·(s−sPrevio)); el resto por diferencias finitas. */
  private gradiente(s: number[], sPrevio: number[]): number[] {
    const f = this.ficha!;
    const g = new Array(s.length).fill(0);
    for (let i = 0; i < s.length; i++) {
      const antes = s[i];
      s[i] = antes + H_GRAD;
      const eMas = this.energiaSinInercia(s);
      s[i] = antes - H_GRAD;
      const eMenos = this.energiaSinInercia(s);
      s[i] = antes;
      g[i] = (eMas - eMenos) / (2 * H_GRAD);
      // Inercia (E4) analítica, circular donde toque.
      const d = this.vector!.distanciaEje(i, antes, sPrevio[i]);
      g[i] += 2 * f.k.e4 * d;
    }
    return g;
  }

  private energiaSinInercia(s: number[]): number {
    const d = this.energia(s, s, false);
    return d.e1 + d.e2 + d.e3;
  }

  /** Descompone E en sus términos. `conInercia` añade E4 respecto a sPrevio. */
  private energia(s: number[], sPrevio: number[], conInercia: boolean) {
    const f = this.ficha!;
    const vec = this.vector!;
    const idx = this.indice();

    // — E1: legibilidad (acoplamiento) — `gasto` hay que pagarlo con `pago`.
    let e1 = 0;
    for (const ac of f.acoplamientos) {
      const g = idx.get(ac.gasto), p = idx.get(ac.pago);
      if (g === undefined || p === undefined) continue;
      const exceso = Math.max(0, s[g] - s[p]);
      e1 += ac.k * exceso * exceso;
    }

    // — E2: identidad cromática (multi-pozo) —
    let e2 = 0;
    let rangoCrom = 0, satCrom = 0, nPaleta = 0;
    for (let i = 0; i < s.length; i++) {
      if (vec.ejes[i].familia !== 'paleta') continue;
      if (vec.ejes[i].circular && f.anclasTono.length) {
        let dmin = Infinity;
        for (const ancla of f.anclasTono) {
          const dc = Math.abs(distMinCircular(s[i], ancla));
          if (dc < dmin) dmin = dc;
        }
        e2 += f.k.e2 * dmin * dmin;
      } else {
        // no circular: acumula para el anti-arcoíris (rango × saturación)
        rangoCrom = Math.max(rangoCrom, s[i]);
        satCrom = Math.max(satCrom, s[i]);
      }
      nPaleta++;
    }
    if (nPaleta) e2 += f.k.e2b * (rangoCrom * satCrom) * (rangoCrom * satCrom);

    // — E3: carga perceptual (banda), ponderada por presencia —
    let carga = 0, pesoTotal = 0;
    for (let i = 0; i < s.length; i++) {
      const w = f.pesosCarga[vec.ejes[i].direccion];
      if (!w) continue;
      carga += w * s[i] * vec.presenciaDe(i);
      pesoTotal += w;
    }
    if (pesoTotal > 0) carga /= pesoTotal;
    const e3 = pesoTotal > 0 ? f.k.e3 * (carga - f.bandaCarga) ** 2 : 0;

    // — E4: inercia —
    let e4 = 0;
    if (conInercia) {
      for (let i = 0; i < s.length; i++) {
        const dd = vec.distanciaEje(i, s[i], sPrevio[i]);
        e4 += f.k.e4 * dd * dd;
      }
    }

    return { e1, e2, e3, e4, E: e1 + e2 + e3 + e4 };
  }

  private indiceCache: Map<string, number> | null = null;
  private indice(): Map<string, number> {
    if (this.indiceCache) return this.indiceCache;
    const m = new Map<string, number>();
    this.vector!.ejes.forEach((e, i) => m.set(e.direccion, i));
    this.indiceCache = m;
    return m;
  }
}

// ————— utilidades —————

/** Distancia con signo mínima en el círculo [0,1). */
function distMinCircular(a: number, b: number): number {
  let d = envolver01(a) - envolver01(b);
  if (d > 0.5) d -= 1;
  else if (d < -0.5) d += 1;
  return d;
}

function norma(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

function limitarNorma(v: number[], max: number): void {
  const n = norma(v);
  if (n > max && n > 0) {
    const f = max / n;
    for (let i = 0; i < v.length; i++) v[i] *= f;
  }
}

/** Ruido gaussiano ~N(0,1) por Box–Muller. */
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
