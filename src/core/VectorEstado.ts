// VectorEstado — la espina dorsal del Barniz (Anexo I de la biblia, §II).
//
// Una capa fina de lectura/escritura NORMALIZADA sobre un subconjunto de
// direcciones del ParamBus. El Barniz razona siempre en [0,1] — así la energía,
// el gradiente y el ruido de temperatura son uniformes, sin problemas de escala.
//
// No guarda estado propio del mundo: el estado ES el bus. Este objeto solo
// traduce ida y vuelta y aplica la corrección como una fuente más ('@barniz'),
// exactamente igual que un LFO o un acumulador. Apagar el Barniz devuelve la
// base intacta.

import type { ParamBus } from './ParamBus';

/** Fuente única con la que el Barniz escribe en el plano de modulación. */
export const FUENTE_BARNIZ = '@barniz';

export interface EjeVector {
  direccion: string;   // dirección del bus, p.ej. "escenario.tono" o "actor:3.param.turbulencia"
  circular: boolean;   // true para tonos/hue: la distancia y el clamp envuelven [0,1)
  familia: 'paleta' | 'forma' | 'carga' | 'otro';
  presencia?: string;  // dirección cuya normalización pondera este eje (visibilidad/mezcla)
}

export class VectorEstado {
  /** Ejes válidos (con rango registrado). Los inválidos se descartan al construir. */
  readonly ejes: EjeVector[] = [];
  /** Direcciones pedidas que no tenían rango registrado — para avisar en UI. */
  readonly rechazadas: string[] = [];

  constructor(private bus: ParamBus, ejes: EjeVector[]) {
    for (const eje of ejes) {
      if (bus.rangoDe(eje.direccion)) this.ejes.push(eje);
      else this.rechazadas.push(eje.direccion);
    }
  }

  get dim(): number {
    return this.ejes.length;
  }

  /** Lee el estado actual (base + modulación) normalizado a [0,1]. */
  leer(): number[] {
    return this.ejes.map((eje) => this.normalizar(eje, this.bus.valorFinal(eje.direccion)));
  }

  /** Peso de presencia de un eje en [0,1] (1 si no declara `presencia`). */
  presenciaDe(i: number): number {
    const p = this.ejes[i].presencia;
    if (!p) return 1;
    const r = this.bus.rangoDe(p);
    if (!r) return 1;
    return clamp01((this.bus.valorFinal(p) - r.min) / (r.max - r.min || 1));
  }

  /**
   * Aplica una corrección (delta en espacio normalizado) escribiéndola como
   * desplazamiento desnormalizado en el plano de modulación. `s` es el estado
   * normalizado objetivo tras la corrección; el desplazamiento es s − base.
   */
  escribir(sObjetivo: number[]): void {
    for (let i = 0; i < this.ejes.length; i++) {
      const eje = this.ejes[i];
      const base = this.bus.get(eje.direccion, 0); // solo la base, sin nuestra propia modulación
      const objetivoReal = this.desnormalizar(eje, sObjetivo[i]);
      this.bus.modular(eje.direccion, FUENTE_BARNIZ, objetivoReal - base);
    }
  }

  /** Retira toda la modulación del Barniz (al apagarlo o al cambiar de ejes). */
  soltar(): void {
    for (const eje of this.ejes) this.bus.quitarModulacion(eje.direccion, FUENTE_BARNIZ);
  }

  /** Diferencia entre dos estados normalizados, circular donde toque. */
  distanciaEje(i: number, a: number, b: number): number {
    return this.ejes[i].circular ? distanciaCircular(a, b) : a - b;
  }

  private normalizar(eje: EjeVector, v: number): number {
    const r = this.bus.rangoDe(eje.direccion)!;
    const span = r.max - r.min || 1;
    const t = (v - r.min) / span;
    return eje.circular ? envolver01(t) : clamp01(t);
  }

  private desnormalizar(eje: EjeVector, t: number): number {
    const r = this.bus.rangoDe(eje.direccion)!;
    const u = eje.circular ? envolver01(t) : clamp01(t);
    return r.min + u * (r.max - r.min);
  }
}

/** Distancia con signo mínima en el círculo [0,1) (para hue). Rango [-0.5, 0.5]. */
export function distanciaCircular(a: number, b: number): number {
  let d = envolver01(a) - envolver01(b);
  if (d > 0.5) d -= 1;
  else if (d < -0.5) d += 1;
  return d;
}

export function envolver01(t: number): number {
  return t - Math.floor(t);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
