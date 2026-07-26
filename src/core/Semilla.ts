// Semilla — la ontogénesis visual (biblia §III, Etapa 3 del plan).
//
// El Big Bang del motor: cada actuación germina desde el silencio por etapas
// dimensionales. La Semilla NO es una escena aparte — es un DIAFRAGMA sobre el
// vocabulario visual: un escalar `apertura` (0..1) que decide qué porcentaje del
// mundo se manifiesta. Punto y constelación son la misma arquitectura con el
// diafragma más o menos abierto.
//
//   SILENCIO → PUNTO → LÍNEA → CURVA → SUPERFICIE → VOLUMEN → CONSTELACIÓN
//
// Reglas del protocolo:
//   · La germinación se GANA: la música (energía, densidad) abre el diafragma.
//   · Es REVERSIBLE: el silencio prolongado lo cierra, etapa a etapa.
//   · El Narrador puede dirigirla (fijar un objetivo de apertura por su estado).
//
// Escribe en el plano de modulación como cualquier fuente ('@semilla'): a
// apertura=1 no impone nada (mundo pleno); al cerrarse, tira de los ejes de
// manifestación hacia un piso (colapso hacia el punto).

import type { ParamBus } from './ParamBus';

export const FUENTE_SEMILLA = '@semilla';

export type EtapaSemilla =
  | 'silencio' | 'punto' | 'linea' | 'curva' | 'superficie' | 'volumen' | 'constelacion';

/** Bandas de apertura → etapa. El punto empieza en cuanto hay algo. */
const BANDAS: { hasta: number; etapa: EtapaSemilla }[] = [
  { hasta: 0.02, etapa: 'silencio' },
  { hasta: 0.15, etapa: 'punto' },
  { hasta: 0.32, etapa: 'linea' },
  { hasta: 0.50, etapa: 'curva' },
  { hasta: 0.70, etapa: 'superficie' },
  { hasta: 0.90, etapa: 'volumen' },
  { hasta: 1.01, etapa: 'constelacion' },
];

export function etapaDeApertura(a: number): EtapaSemilla {
  for (const b of BANDAS) if (a < b.hasta) return b.etapa;
  return 'constelacion';
}

export interface SemillaGuardada {
  activo: boolean;
  modo: 'auto' | 'manual';
  aperturaManual: number;
  piso: number;         // valor normalizado al que colapsan los ejes (0 = al punto)
  ejes: string[];       // direcciones del bus que manifiestan el mundo
  tasaSubida: number;   // apertura/seg al germinar (ganada → lenta)
  tasaBajada: number;   // apertura/seg al replegar
}

export function semillaGuardadaPorDefecto(ejes: string[] = []): SemillaGuardada {
  return { activo: false, modo: 'auto', aperturaManual: 0, piso: 0, ejes, tasaSubida: 0.15, tasaBajada: 0.1 };
}

export class MotorSemilla {
  activo = false;
  modo: 'auto' | 'manual' = 'auto';
  aperturaManual = 0;
  piso = 0;
  ejes: string[] = [];
  tasaSubida = 0.15;
  tasaBajada = 0.1;

  /** Estado vivo. `apertura` persiste durante la actuación; empieza en el silencio. */
  apertura = 0;
  etapa: EtapaSemilla = 'silencio';

  private escuchasCambio = new Set<() => void>();

  constructor(private bus: ParamBus) {}

  encender(): void { this.activo = true; this.emitirCambio(); }
  apagar(): void { this.activo = false; this.soltar(); this.emitirCambio(); }

  /** Reemplaza los ejes de manifestación (direcciones del bus con rango). */
  fijarEjes(ejes: string[]): void {
    this.soltar();
    this.ejes = ejes.filter((d) => this.bus.rangoDe(d));
    this.emitirCambio();
  }

  onCambio(fn: () => void): () => void {
    this.escuchasCambio.add(fn);
    return () => this.escuchasCambio.delete(fn);
  }

  private emitirCambio(): void { for (const fn of this.escuchasCambio) fn(); }

  private soltar(): void {
    for (const dir of this.ejes) this.bus.quitarModulacion(dir, FUENTE_SEMILLA);
  }

  /**
   * Un tick por frame. `m` = métricas de Frase (germinación ganada). `objetivo`
   * (0..1 o null) es la orden del Narrador: si viene, manda sobre lo ganado.
   */
  tick(dt: number, m: { tension: number; densidad: number; meseta: number }, objetivo: number | null): void {
    if (!this.activo) return;

    if (this.modo === 'manual') {
      // Control directo: el diafragma sigue al slider, rápido pero suave.
      this.apertura += (this.aperturaManual - this.apertura) * Math.min(1, dt * 8);
    } else {
      // Auto: el Narrador manda si dirige; si no, la germinación se gana de la música.
      const destino = objetivo !== null
        ? objetivo
        : clamp01(0.6 * m.tension + 0.4 * m.densidad);
      const tasa = destino > this.apertura ? this.tasaSubida : this.tasaBajada;
      const salto = tasa * dt;
      if (Math.abs(destino - this.apertura) <= salto) this.apertura = destino;
      else this.apertura += Math.sign(destino - this.apertura) * salto;
    }
    this.apertura = clamp01(this.apertura);

    const etapaNueva = etapaDeApertura(this.apertura);
    if (etapaNueva !== this.etapa) { this.etapa = etapaNueva; this.emitirCambio(); }

    this.manifestar();
  }

  /** Tira de cada eje entre `piso` (colapsado) y su base (pleno) según apertura. */
  private manifestar(): void {
    for (const dir of this.ejes) {
      const r = this.bus.rangoDe(dir);
      if (!r) continue;
      const span = r.max - r.min || 1;
      const base = this.bus.get(dir, r.min);
      const baseN = (base - r.min) / span;
      const objetivoN = this.piso + this.apertura * (baseN - this.piso);
      const objetivoReal = r.min + objetivoN * span;
      this.bus.modular(dir, FUENTE_SEMILLA, objetivoReal - base);
    }
  }

  // ————— persistencia —————

  exportar(): SemillaGuardada {
    return {
      activo: this.activo, modo: this.modo, aperturaManual: this.aperturaManual,
      piso: this.piso, ejes: [...this.ejes], tasaSubida: this.tasaSubida, tasaBajada: this.tasaBajada,
    };
  }

  restaurar(g: SemillaGuardada | null): void {
    this.soltar();
    const d = g ?? semillaGuardadaPorDefecto();
    this.activo = d.activo;
    this.modo = d.modo;
    this.aperturaManual = d.aperturaManual;
    this.piso = d.piso;
    this.ejes = (d.ejes ?? []).filter((dir) => this.bus.rangoDe(dir));
    this.tasaSubida = d.tasaSubida;
    this.tasaBajada = d.tasaBajada;
    this.apertura = 0;          // cada actuación germina desde el silencio
    this.etapa = 'silencio';
    this.emitirCambio();
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
