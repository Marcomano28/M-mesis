// Acumuladores de Frase — la primera memoria del sistema (Etapa 1 del templo).
//
// Donde un LFO oscila sin escuchar, un acumulador INTEGRA HISTORIA: cuánta
// actividad hubo, con qué densidad, cuánto silencio llevamos. Sus salidas
// (0..1) escriben en el plano de modulación como cualquier fuente viva.
//
// Sin audio todavía: la "actividad" viene de los gestos del usuario (mover
// sliders, ratón) o de la derivada de cualquier dirección del bus. Cuando
// llegue la guitarra (Etapa 4), sus rasgos serán una fuente más — misma clase.

import type { ParamBus } from './ParamBus';

export type ProcesoAcumulador = 'tension' | 'densidad' | 'meseta';

/** Fuente especial: actividad global del usuario (sliders + ratón). */
export const FUENTE_ACTIVIDAD = '@actividad';

export interface Acumulador {
  id: string;
  fuente: string;              // FUENTE_ACTIVIDAD o una dirección del bus
  proceso: ProcesoAcumulador;
  fuga: number;                // 1/s — velocidad de olvido (o de crecimiento en meseta)
  destino: string;             // dirección del bus a modular
  amplitud: number;            // en unidades del parámetro destino
  activo: boolean;
  valor: number;               // salida 0..1 (para monitores)
}

export type AcumuladorGuardado = Omit<Acumulador, 'valor'>;

interface Estado {
  anterior: number | null;     // última muestra de la fuente (para derivada)
  maxDeriv: number;            // auto-calibración: máximo reciente de la derivada
  ultimaActividad: number;     // tiempo del último evento significativo
  interno: number;             // integrador del proceso
  destinoPrevio: string;
}

const UMBRAL_EVENTO = 0.25;

export class MotorAcumuladores {
  acumuladores: Acumulador[] = [];
  private estados = new Map<string, Estado>();
  private actividadFrame = 0;
  private secuencia = 1;
  private escuchasCambio = new Set<() => void>();

  constructor(private bus: ParamBus) {}

  /** Cualquier gesto suma actividad: escrituras al bus, velocidad del ratón… */
  registrarActividad(cantidad = 1): void {
    this.actividadFrame += cantidad;
  }

  crear(destino: string, amplitud: number): Acumulador {
    const a: Acumulador = {
      id: `acum-${this.secuencia++}`,
      fuente: FUENTE_ACTIVIDAD,
      proceso: 'tension',
      fuga: 0.4,
      destino,
      amplitud,
      activo: true,
      valor: 0,
    };
    this.acumuladores.push(a);
    this.estados.set(a.id, {
      anterior: null, maxDeriv: 1e-6, ultimaActividad: 0, interno: 0, destinoPrevio: destino,
    });
    this.emitirCambio();
    return a;
  }

  quitar(id: string): void {
    this.acumuladores = this.acumuladores.filter((a) => a.id !== id);
    this.estados.delete(id);
    this.bus.limpiarFuente(id);
    this.emitirCambio();
  }

  onCambio(fn: () => void): () => void {
    this.escuchasCambio.add(fn);
    return () => this.escuchasCambio.delete(fn);
  }

  exportar(filtro: (acumulador: Acumulador) => boolean = () => true): AcumuladorGuardado[] {
    return this.acumuladores.filter(filtro).map(({ valor: _valor, ...acumulador }) => ({ ...acumulador }));
  }

  restaurar(acumuladores: AcumuladorGuardado[]): void {
    for (const actual of this.acumuladores) this.bus.limpiarFuente(actual.id);
    this.acumuladores = acumuladores.map((a) => ({ ...a, valor: 0 }));
    this.estados.clear();
    for (const a of this.acumuladores) this.estados.set(a.id, this.estadoInicial(a.destino));
    this.secuencia = siguienteSecuencia('acum-', this.acumuladores.map((a) => a.id));
    this.actividadFrame = 0;
    this.emitirCambio();
  }

  eliminarDonde(predicado: (acumulador: Acumulador) => boolean): void {
    const borrar = this.acumuladores.filter(predicado);
    if (!borrar.length) return;
    for (const a of borrar) {
      this.bus.limpiarFuente(a.id);
      this.estados.delete(a.id);
    }
    const ids = new Set(borrar.map((a) => a.id));
    this.acumuladores = this.acumuladores.filter((a) => !ids.has(a.id));
    this.emitirCambio();
  }

  private estadoInicial(destino: string): Estado {
    return { anterior: null, maxDeriv: 1e-6, ultimaActividad: 0, interno: 0, destinoPrevio: destino };
  }

  private emitirCambio(): void {
    for (const fn of this.escuchasCambio) fn();
  }

  /** Un tick por frame. `tiempo` en segundos (reloj del motor). */
  tick(dt: number, tiempo: number): void {
    if (dt <= 0) { this.actividadFrame = 0; return; }

    for (const a of this.acumuladores) {
      const st = this.estados.get(a.id)!;

      // Si cambió el destino, retirar la modulación que quedó en el anterior
      if (st.destinoPrevio !== a.destino) {
        this.bus.quitarModulacion(st.destinoPrevio, a.id);
        st.destinoPrevio = a.destino;
      }

      // — 1) Actividad instantánea normalizada 0..1 —
      let act = 0;
      if (a.fuente === FUENTE_ACTIVIDAD) {
        act = Math.min(1, this.actividadFrame / 3); // ~3 gestos/frame satura
        st.anterior = null;
      } else {
        const v = this.bus.valorFinal(a.fuente);
        if (st.anterior !== null) {
          const deriv = Math.abs(v - st.anterior) / dt;
          // Auto-calibración con olvido: el máximo reciente define la escala.
          // (Mismo principio que usará la calibración de la guitarra en Etapa 4.)
          st.maxDeriv = Math.max(st.maxDeriv * (1 - 0.1 * dt), deriv, 1e-6);
          act = Math.min(1, deriv / st.maxDeriv);
        }
        st.anterior = v;
      }

      if (act > UMBRAL_EVENTO) st.ultimaActividad = tiempo;

      // — 2) Proceso: cómo esta memoria digiere la actividad —
      switch (a.proceso) {
        case 'tension':
          // Integral con fuga: sube con la actividad, olvida exponencialmente.
          st.interno = st.interno * Math.exp(-a.fuga * dt) + act * dt * 2;
          a.valor = 1 - Math.exp(-st.interno); // saturación suave hacia 1
          break;
        case 'densidad':
          // Contador con fuga de eventos significativos (~8 vivos = 1.0)
          st.interno = st.interno * Math.exp(-a.fuga * dt) + (act > UMBRAL_EVENTO ? dt * 60 * 0.15 : 0);
          a.valor = Math.min(1, st.interno / 8);
          break;
        case 'meseta': {
          // Cuánto silencio/quietud llevamos. `fuga` = velocidad de crecimiento:
          // con fuga 0.5, la meseta llena en ~20s de quietud.
          const quieto = tiempo - st.ultimaActividad;
          a.valor = Math.min(1, (quieto * Math.max(a.fuga, 0.02)) / 10);
          break;
        }
      }

      this.bus.modular(a.destino, a.id, a.activo ? a.valor * a.amplitud : 0);
    }

    this.actividadFrame = 0;
  }
}

function siguienteSecuencia(prefijo: string, ids: string[]): number {
  return Math.max(0, ...ids.map((id) => id.startsWith(prefijo) ? Number(id.slice(prefijo.length)) || 0 : 0)) + 1;
}
