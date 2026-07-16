// Gestos ensayados — el repertorio propio de una ficha de personaje.
//
// La música no escribe directamente en todos los parámetros: activa gestos
// con identidad. Cada gesto contiene uno o más canales internos y una forma
// temporal. El MVP edita un canal por gesto, pero el contrato ya admite varios.

import type { ParamBus } from './ParamBus';

export type FormaGesto = 'lineal' | 'envolvente' | 'loop';
export type CurvaGesto = 'lineal' | 'suave';

export interface CanalGesto {
  /** Hilo local de la ficha: `param.temblor`, nunca una dirección global. */
  hilo: string;
  etiqueta: string;
  min: number;
  max: number;
  /** Extremos normalizados dentro de min..max. */
  desde: number;
  hasta: number;
}

export interface GestoPersonaje {
  id: string;
  nombre: string;
  forma: FormaGesto;
  curva: CurvaGesto;
  duracion: number;
  canales: CanalGesto[];
}

interface GestoActivo {
  fuente: string;
  ambito: string;
  gesto: GestoPersonaje;
  resolver: (hilo: string) => string | null;
  intensidad: number;
  transcurrido: number;
}

export function copiarGestos(gestos: GestoPersonaje[] | undefined): GestoPersonaje[] {
  return (gestos ?? []).map((gesto) => ({
    ...gesto,
    canales: gesto.canales.map((canal) => ({ ...canal })),
  }));
}

export class MotorGestos {
  private activos: GestoActivo[] = [];
  private secuencia = 1;

  constructor(private bus: ParamBus) {}

  reproducir(
    ambito: string,
    gesto: GestoPersonaje,
    resolver: (hilo: string) => string | null,
    intensidad = 1,
  ): void {
    this.detenerAmbito(ambito);
    this.activos.push({
      fuente: `gesto-${this.secuencia++}`,
      ambito,
      gesto,
      resolver,
      intensidad: clamp(intensidad, 0, 1),
      transcurrido: 0,
    });
    this.aplicar(this.activos[this.activos.length - 1], 0);
  }

  detenerAmbito(ambito: string): void {
    const borrar = this.activos.filter((activo) => activo.ambito === ambito);
    for (const activo of borrar) this.bus.limpiarFuente(activo.fuente);
    this.activos = this.activos.filter((activo) => activo.ambito !== ambito);
  }

  detenerTodos(): void {
    for (const activo of this.activos) this.bus.limpiarFuente(activo.fuente);
    this.activos = [];
  }

  tick(dt: number): void {
    if (dt <= 0) return;
    const terminados = new Set<GestoActivo>();
    for (const activo of this.activos) {
      activo.transcurrido += dt;
      const duracion = Math.max(0.05, activo.gesto.duracion);
      const progreso = activo.transcurrido / duracion;
      if (activo.gesto.forma === 'envolvente' && progreso >= 1) {
        this.bus.limpiarFuente(activo.fuente);
        terminados.add(activo);
        continue;
      }
      this.aplicar(activo, progreso);
    }
    if (terminados.size) this.activos = this.activos.filter((activo) => !terminados.has(activo));
  }

  private aplicar(activo: GestoActivo, progreso: number): void {
    const factor = factorTemporal(activo.gesto.forma, progreso, activo.gesto.curva);
    for (const canal of activo.gesto.canales) {
      const destino = activo.resolver(canal.hilo);
      if (!destino) continue;
      const desde = lerp(canal.min, canal.max, clamp(canal.desde, 0, 1));
      const hasta = lerp(canal.min, canal.max, clamp(canal.hasta, 0, 1));
      const objetivo = lerp(desde, hasta, factor);
      const base = this.bus.get(destino, desde);
      this.bus.modular(destino, activo.fuente, (objetivo - base) * activo.intensidad);
    }
  }
}

function factorTemporal(forma: FormaGesto, progreso: number, curva: CurvaGesto): number {
  let t: number;
  if (forma === 'loop') {
    const fase = progreso - Math.floor(progreso);
    t = fase < 0.5 ? fase * 2 : (1 - fase) * 2;
  } else if (forma === 'envolvente') {
    const fase = clamp(progreso, 0, 1);
    t = fase < 0.5 ? fase * 2 : (1 - fase) * 2;
  } else {
    t = clamp(progreso, 0, 1);
  }
  return curva === 'suave' ? t * t * (3 - 2 * t) : t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(valor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valor));
}
