// Narrador — el órgano del tiempo (biblia §IV, Etapa 7 del plan).
//
// Lee la HISTORIA de la improvisación (los acumuladores: tensión, densidad,
// meseta) y dirige la dramaturgia SIN pintar un solo píxel. En esta v1 gobierna
// lo que ya existe: transiciona el Barniz entre "roles" de un repertorio, sesga
// la temperatura del sistema, y ejerce iniciativa acotada. Cuando existan la
// Semilla y los universos, sus decisiones se enchufan aquí sin reescribir esto.
//
// Es una MÁQUINA DE ESTADOS LEGIBLE, nunca un modelo generativo. Cada decisión
// se escribe en la bitácora en texto: la legibilidad es requisito, no lujo (v2
// podría aprender los umbrales de tus preferencias; seguiría sin autora imagen).

import { MotorBarniz, type FichaBarniz } from './Barniz';

/** Los estados de la dramaturgia. Cada uno es también un rol de barniz. */
export type RolNarrador = 'reposo' | 'construccion' | 'climax' | 'disolucion';

export const ROLES: RolNarrador[] = ['reposo', 'construccion', 'climax', 'disolucion'];

export interface ConfigNarrador {
  umbralConstruccion: number; // tensión que despierta el mundo
  umbralClimax: number;       // tensión que lo lleva al límite
  umbralMeseta: number;       // quietud que devuelve al reposo
  duracionTransicion: number; // segundos de fundido entre barnices
  cooldownIniciativa: number; // segundos mínimos entre propuestas
}

export interface EntradaBitacora {
  tiempo: number;
  texto: string;
  tipo: 'estado' | 'iniciativa' | 'sistema';
}

export interface NarradorGuardado {
  activo: boolean;
  config: ConfigNarrador;
  repertorio: Partial<Record<RolNarrador, FichaBarniz>>;
}

/** Sesgo de temperatura por rol: cuánta libertad concede el Narrador. */
const SESGO: Record<RolNarrador, number> = {
  reposo: 0.5, construccion: 1.0, climax: 1.5, disolucion: 0.4,
};

export function configNarradorPorDefecto(): ConfigNarrador {
  return {
    umbralConstruccion: 0.35,
    umbralClimax: 0.7,
    umbralMeseta: 0.6,
    duracionTransicion: 6,
    cooldownIniciativa: 20,
  };
}

const HZ_NARRADOR = 2;       // el Narrador delibera ~2 veces/seg (escala de 10s+)
const MAX_BITACORA = 60;

export class MotorNarrador {
  activo = false;
  estado: RolNarrador = 'reposo';
  config = configNarradorPorDefecto();
  repertorio: Partial<Record<RolNarrador, FichaBarniz>> = {};
  bitacora: EntradaBitacora[] = [];
  /** Monitores para el panel. */
  monitor = { tension: 0, densidad: 0, meseta: 0, sesgo: 0.5 };

  private sesgo = 0.5;         // sesgo de temperatura suavizado
  private impulso = 0;         // empujón transitorio de la iniciativa
  private acumulador = 0;      // diezmado a HZ_NARRADOR
  private tiempo = 0;
  private ultimaIniciativa = -Infinity;
  private escuchasCambio = new Set<() => void>();

  constructor(private barniz: MotorBarniz) {}

  get sesgoTemperatura(): number {
    return this.sesgo + this.impulso;
  }

  /**
   * Objetivo de apertura para la Semilla (biblia §III): el Narrador decide las
   * transiciones de etapa. Reposo apenas germina; construcción abre con la
   * tensión; el clímax manifiesta el mundo pleno; la disolución repliega.
   */
  get objetivoApertura(): number {
    switch (this.estado) {
      case 'reposo': return 0.12;
      case 'construccion': return 0.25 + 0.55 * this.monitor.tension;
      case 'climax': return 1;
      case 'disolucion': return 0.08;
    }
  }

  /** Captura el barniz actualmente activo como el barniz de un rol. */
  capturar(rol: RolNarrador): void {
    const ficha = this.barniz.exportar();
    if (!ficha) { this.log('sistema', 'no hay barniz activo que capturar'); return; }
    this.repertorio[rol] = ficha;
    this.log('sistema', `barniz capturado como «${rol}»`);
    this.emitirCambio();
  }

  activar(): void {
    this.activo = true;
    // Si hay barniz de reposo y ninguno activo, arráncalo.
    if (!this.barniz.ficha && this.repertorio.reposo) {
      this.barniz.aplicar(structuredClone(this.repertorio.reposo));
      this.barniz.encender();
    }
    this.log('sistema', 'el Narrador toma la dirección');
    this.emitirCambio();
  }

  desactivar(): void {
    this.activo = false;
    this.log('sistema', 'el Narrador cede la dirección');
    this.emitirCambio();
  }

  onCambio(fn: () => void): () => void {
    this.escuchasCambio.add(fn);
    return () => this.escuchasCambio.delete(fn);
  }

  private emitirCambio(): void {
    for (const fn of this.escuchasCambio) fn();
  }

  private log(tipo: EntradaBitacora['tipo'], texto: string): void {
    this.bitacora.unshift({ tiempo: this.tiempo, texto, tipo });
    if (this.bitacora.length > MAX_BITACORA) this.bitacora.length = MAX_BITACORA;
  }

  /** Cada frame; internamente delibera a HZ_NARRADOR. `m` = métricas de Frase. */
  tick(dt: number, m: { tension: number; densidad: number; meseta: number }): void {
    this.tiempo += dt;
    this.monitor.tension = m.tension;
    this.monitor.densidad = m.densidad;
    this.monitor.meseta = m.meseta;
    if (!this.activo) return;

    this.acumulador += dt;
    const paso = 1 / HZ_NARRADOR;
    if (this.acumulador < paso) { this.fundir(dt); return; }
    const dtN = this.acumulador;
    this.acumulador = 0;

    this.deliberar(m);
    this.fundir(dtN);

    // Sesgo de temperatura: suaviza hacia el objetivo del rol; el impulso decae.
    const objetivo = SESGO[this.estado];
    this.sesgo += (objetivo - this.sesgo) * Math.min(1, dtN / 2);
    this.impulso *= Math.exp(-dtN / 3);
    this.monitor.sesgo = this.sesgoTemperatura;
  }

  /** La máquina de estados: reglas legibles sobre las métricas de Frase. */
  private deliberar(m: { tension: number; densidad: number; meseta: number }): void {
    const c = this.config;
    switch (this.estado) {
      case 'reposo':
        if (m.tension > c.umbralConstruccion) this.cambiar('construccion', 'la música despierta el mundo');
        else if (m.meseta > c.umbralMeseta) this.quizaIniciativa();
        break;
      case 'construccion':
        if (m.tension > c.umbralClimax) this.cambiar('climax', 'la tensión alcanza el clímax');
        else if (m.tension < c.umbralConstruccion * 0.6) this.cambiar('reposo', 'la energía cede, vuelve la calma');
        break;
      case 'climax':
        if (m.tension < c.umbralConstruccion) this.cambiar('disolucion', 'el clímax se deshace');
        break;
      case 'disolucion':
        if (m.meseta > c.umbralMeseta) this.cambiar('reposo', 'vuelve el silencio');
        else if (m.tension > c.umbralClimax) this.cambiar('climax', 'la energía resurge');
        break;
    }
  }

  private cambiar(nuevo: RolNarrador, motivo: string): void {
    if (nuevo === this.estado) return;
    this.estado = nuevo;
    const hay = this.repertorio[nuevo] ? '' : ' (sin barniz asignado — solo temperatura)';
    this.log('estado', `→ ${nuevo}: ${motivo}${hay}`);
    this.emitirCambio();
  }

  /** Iniciativa acotada: propone una deriva suave si lleva mucho en calma. */
  private quizaIniciativa(): void {
    if (this.tiempo - this.ultimaIniciativa < this.config.cooldownIniciativa) return;
    this.ultimaIniciativa = this.tiempo;
    this.impulso = 0.6; // una floración lenta: un soplo de temperatura que invita a responder
    this.log('iniciativa', 'propongo una deriva — una floración lenta que invita a responder');
  }

  /** Funde el barniz activo hacia el del rol actual (sin corte, sin reset). */
  private fundir(dt: number): void {
    const destino = this.repertorio[this.estado];
    if (!destino) return;
    if (!this.barniz.ficha) {
      this.barniz.aplicar(structuredClone(destino));
      this.barniz.encender();
      return;
    }
    if (!this.barniz.activo) this.barniz.encender();
    this.barniz.acercarFicha(destino, Math.min(1, dt / this.config.duracionTransicion));
  }

  // ————— persistencia —————

  exportar(): NarradorGuardado {
    return {
      activo: this.activo,
      config: { ...this.config },
      repertorio: structuredClone(this.repertorio),
    };
  }

  restaurar(guardado: NarradorGuardado | null): void {
    this.bitacora = [];
    this.estado = 'reposo';
    this.impulso = 0;
    this.sesgo = SESGO.reposo;
    this.ultimaIniciativa = -Infinity;
    if (!guardado) {
      this.activo = false;
      this.config = configNarradorPorDefecto();
      this.repertorio = {};
    } else {
      this.config = { ...configNarradorPorDefecto(), ...guardado.config };
      this.repertorio = structuredClone(guardado.repertorio ?? {});
      this.activo = guardado.activo;
    }
    this.emitirCambio();
  }
}
