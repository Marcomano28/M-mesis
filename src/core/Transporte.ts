// Transporte musical — reloj único de una interpretación.
//
// El render nunca se detiene, pero el Escenario consulta este reloj. Cuando
// está parado su delta es cero; al reproducir usa AudioContext.currentTime,
// que no deriva aunque el navegador pierda frames visuales.

export type EstadoTransporte = 'parado' | 'preparado' | 'reproduciendo';

export interface ConfiguracionTransporte {
  bpm: number;
  pulsosPorCompas: number;
  duracion: number;
  bucle: boolean;
}

export interface MarcoMusical {
  estado: EstadoTransporte;
  tiempo: number;
  delta: number;
  bpm: number;
  beat: number;
  compas: number;
  pulso: number;
  fasePulso: number;
}

export function crearConfiguracionTransporte(): ConfiguracionTransporte {
  return { bpm: 120, pulsosPorCompas: 4, duracion: 60, bucle: true };
}

export class Transporte {
  estado: EstadoTransporte = 'parado';
  configuracion = crearConfiguracionTransporte();

  private audioCtx: AudioContext | null = null;
  private origenAudio = 0;
  private fuenteReloj: 'audio' | 'visual' = 'visual';
  private posicion = 0;
  private tiempoPrevio = 0;
  private escuchas = new Set<() => void>();
  private marco: MarcoMusical = {
    estado: 'parado', tiempo: 0, delta: 0, bpm: 120,
    beat: 0, compas: 1, pulso: 1, fasePulso: 0,
  };

  async obtenerContextoAudio(): Promise<AudioContext> {
    if (!this.audioCtx) this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
    // Algunos navegadores mantienen resume() pendiente hasta que su salida de
    // audio está disponible. No bloqueamos la obra: mientras tanto el reloj
    // monotónico de performance conserva la continuidad y AudioContext toma el
    // relevo en cuanto pasa a running.
    if (this.audioCtx.state !== 'running') {
      void this.audioCtx.resume().catch((err) => {
        console.warn('El transporte continúa con el reloj visual:', err);
      });
    }
    return this.audioCtx;
  }

  async preparar(): Promise<void> {
    await this.obtenerContextoAudio();
    if (this.estado !== 'reproduciendo') {
      this.estado = 'preparado';
      this.actualizarMarco(0);
      this.emitirCambio();
    }
  }

  async reproducir(): Promise<void> {
    if (this.estado === 'reproduciendo') return;
    const ctx = await this.obtenerContextoAudio();
    if (this.posicion >= this.configuracion.duracion) this.posicion = 0;
    this.fuenteReloj = ctx.state === 'running' ? 'audio' : 'visual';
    this.origenAudio = this.ahoraReloj() - this.posicion;
    this.tiempoPrevio = this.posicion;
    this.estado = 'reproduciendo';
    this.actualizarMarco(0);
    this.emitirCambio();
  }

  detener(): void {
    this.posicion = 0;
    this.tiempoPrevio = 0;
    this.estado = this.audioCtx ? 'preparado' : 'parado';
    this.actualizarMarco(0);
    this.emitirCambio();
  }

  irA(segundos: number): void {
    this.posicion = clamp(segundos, 0, this.configuracion.duracion);
    this.tiempoPrevio = this.posicion;
    if (this.estado === 'reproduciendo' && this.audioCtx) {
      this.origenAudio = this.ahoraReloj() - this.posicion;
    }
    this.actualizarMarco(0);
  }

  configurar(cambios: Partial<ConfiguracionTransporte>): void {
    const anterior = this.configuracion;
    this.configuracion = {
      bpm: clamp(cambios.bpm ?? anterior.bpm, 20, 300),
      pulsosPorCompas: Math.round(clamp(cambios.pulsosPorCompas ?? anterior.pulsosPorCompas, 1, 12)),
      duracion: clamp(cambios.duracion ?? anterior.duracion, 1, 60 * 60),
      bucle: cambios.bucle ?? anterior.bucle,
    };
    if (this.posicion > this.configuracion.duracion) this.irA(this.configuracion.duracion);
    this.actualizarMarco(0);
    this.emitirCambio();
  }

  exportarConfiguracion(): ConfiguracionTransporte {
    return { ...this.configuracion };
  }

  onCambio(fn: () => void): () => void {
    this.escuchas.add(fn);
    return () => this.escuchas.delete(fn);
  }

  tick(): MarcoMusical {
    let delta = 0;
    let cambioEstado = false;
    if (this.estado === 'reproduciendo' && this.audioCtx) {
      const fuenteDisponible = this.audioCtx.state === 'running' ? 'audio' : 'visual';
      if (fuenteDisponible !== this.fuenteReloj) {
        this.fuenteReloj = fuenteDisponible;
        this.origenAudio = this.ahoraReloj() - this.posicion;
      }
      const ahora = this.ahoraReloj();
      let siguiente = ahora - this.origenAudio;
      const duracion = this.configuracion.duracion;
      if (siguiente >= duracion) {
        if (this.configuracion.bucle) {
          siguiente %= duracion;
          this.origenAudio = ahora - siguiente;
          delta = 0;
        } else {
          siguiente = duracion;
          delta = clamp(duracion - this.tiempoPrevio, 0, 0.25);
          this.estado = 'preparado';
          cambioEstado = true;
        }
      } else {
        delta = clamp(siguiente - this.tiempoPrevio, 0, 0.25);
      }
      this.posicion = siguiente;
      this.tiempoPrevio = siguiente;
    }
    this.actualizarMarco(delta);
    if (cambioEstado) this.emitirCambio();
    return this.marco;
  }

  instantanea(): MarcoMusical {
    return this.marco;
  }

  private ahoraReloj(): number {
    if (this.fuenteReloj === 'audio' && this.audioCtx?.state === 'running') {
      return this.audioCtx.currentTime;
    }
    return performance.now() / 1000;
  }

  private actualizarMarco(delta: number): void {
    const beat = this.posicion * this.configuracion.bpm / 60;
    const entero = Math.floor(beat);
    this.marco.estado = this.estado;
    this.marco.tiempo = this.posicion;
    this.marco.delta = delta;
    this.marco.bpm = this.configuracion.bpm;
    this.marco.beat = beat;
    this.marco.compas = Math.floor(entero / this.configuracion.pulsosPorCompas) + 1;
    this.marco.pulso = (entero % this.configuracion.pulsosPorCompas) + 1;
    this.marco.fasePulso = beat - entero;
  }

  private emitirCambio(): void {
    for (const fn of this.escuchas) fn();
  }
}

function clamp(valor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valor));
}
