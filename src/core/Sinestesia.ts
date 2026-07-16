// Sinestesia — mesa de mapeo para tocar MIA.
// Convierte fuentes vivas normalizadas (0..1) en modulaciones sobre el ParamBus.
// MVP: fuentes musicales reales (MIDI/audio) + fuentes tocables de respaldo.

import type { ParamBus } from './ParamBus';
import type { Transporte } from './Transporte';
import { onda } from './Moduladores';

export type FuenteSinestesia =
  | 'audioNivel' | 'audioAtaque'
  | 'midiNota' | 'midiVelocidad' | 'midiMod' | 'midiBend'
  | 'ratonX' | 'ratonY' | 'pulso' | 'presion';
export type CurvaSinestesia = 'lineal' | 'suave' | 'exponencial' | 'log';

export interface RutaSinestesia {
  id: string;
  fuente: FuenteSinestesia;
  destino: string;
  min: number;
  max: number;
  curva: CurvaSinestesia;
  ataque: number; // segundos
  caida: number;  // segundos
  activo: boolean;
  valor: number;  // 0..1, valor suavizado de la fuente
}

export type RutaSinestesiaGuardada = Omit<RutaSinestesia, 'valor'>;

export class MotorSinestesia {
  rutas: RutaSinestesia[] = [];
  estado = {
    audio: 'audio apagado',
    midi: 'MIDI apagado',
  };
  private fuentes: Record<FuenteSinestesia, number> = {
    audioNivel: 0,
    audioAtaque: 0,
    midiNota: 0.5,
    midiVelocidad: 0,
    midiMod: 0,
    midiBend: 0.5,
    ratonX: 0.5,
    ratonY: 0.5,
    pulso: 0.5,
    presion: 0,
  };
  private destinoPrevio = new Map<string, string>();
  private secuencia = 1;
  private audioCtx: AudioContext | null = null;
  private analizador: AnalyserNode | null = null;
  private datosAudio: Float32Array<ArrayBuffer> | null = null;
  private nivelAudioPrevio = 0;
  private escuchasCambio = new Set<() => void>();

  constructor(private bus: ParamBus, private transporte?: Transporte) {
    window.addEventListener('pointermove', (ev) => {
      this.fuentes.ratonX = clamp01(ev.clientX / Math.max(1, window.innerWidth));
      this.fuentes.ratonY = clamp01(1 - ev.clientY / Math.max(1, window.innerHeight));
    });
    window.addEventListener('pointerdown', () => { this.fuentes.presion = 1; });
    window.addEventListener('pointerup', () => { this.fuentes.presion = 0; });
    window.addEventListener('pointercancel', () => { this.fuentes.presion = 0; });
  }

  async activarAudio(): Promise<void> {
    if (this.audioCtx) {
      await this.audioCtx.resume();
      this.estado.audio = 'audio activo';
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.audioCtx = this.transporte
      ? await this.transporte.obtenerContextoAudio()
      : new AudioContext({ latencyHint: 'interactive' });
    const fuente = this.audioCtx.createMediaStreamSource(stream);
    this.analizador = this.audioCtx.createAnalyser();
    this.analizador.fftSize = 1024;
    this.datosAudio = new Float32Array(this.analizador.fftSize);
    fuente.connect(this.analizador);
    this.estado.audio = 'audio activo';
  }

  async activarMIDI(): Promise<void> {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<WebMidiAccess> };
    if (!nav.requestMIDIAccess) {
      this.estado.midi = 'MIDI no disponible';
      return;
    }
    const acceso = await nav.requestMIDIAccess();
    const conectar = () => {
      let n = 0;
      acceso.inputs.forEach((entrada) => {
        n++;
        entrada.onmidimessage = (ev) => {
          if (ev.data) this.recibirMIDI(ev.data);
        };
      });
      this.estado.midi = n ? `MIDI activo (${n})` : 'sin entradas MIDI';
    };
    conectar();
    acceso.onstatechange = conectar;
  }

  crear(destino: string, min: number, max: number): RutaSinestesia {
    const ruta: RutaSinestesia = {
      id: `syn-${this.secuencia++}`,
      fuente: 'ratonX',
      destino,
      min,
      max,
      curva: 'lineal',
      ataque: 0.03,
      caida: 0.25,
      activo: true,
      valor: 0.5,
    };
    this.rutas.push(ruta);
    this.emitirCambio();
    return ruta;
  }

  quitar(id: string): void {
    this.rutas = this.rutas.filter((r) => r.id !== id);
    this.bus.limpiarFuente(id);
    this.destinoPrevio.delete(id);
    this.emitirCambio();
  }

  onCambio(fn: () => void): () => void {
    this.escuchasCambio.add(fn);
    return () => this.escuchasCambio.delete(fn);
  }

  /** Recompone opciones de UI cuando aparecen/desaparecen hilos de actores. */
  refrescarDestinos(): void {
    this.emitirCambio();
  }

  exportar(filtro: (ruta: RutaSinestesia) => boolean = () => true): RutaSinestesiaGuardada[] {
    return this.rutas.filter(filtro).map(({ valor: _valor, ...ruta }) => ({ ...ruta }));
  }

  restaurar(rutas: RutaSinestesiaGuardada[]): void {
    for (const actual of this.rutas) this.bus.limpiarFuente(actual.id);
    this.destinoPrevio.clear();
    this.rutas = rutas.map((ruta) => ({ ...ruta, valor: 0.5 }));
    this.secuencia = siguienteSecuencia('syn-', this.rutas.map((r) => r.id));
    this.emitirCambio();
  }

  eliminarDonde(predicado: (ruta: RutaSinestesia) => boolean): void {
    const borrar = this.rutas.filter(predicado);
    if (!borrar.length) return;
    for (const ruta of borrar) {
      this.bus.limpiarFuente(ruta.id);
      this.destinoPrevio.delete(ruta.id);
    }
    const ids = new Set(borrar.map((r) => r.id));
    this.rutas = this.rutas.filter((r) => !ids.has(r.id));
    this.emitirCambio();
  }

  /** Conserva una indicación que perdió su hilo, pero evita que siga actuando. */
  desactivarDonde(predicado: (ruta: RutaSinestesia) => boolean): number {
    let total = 0;
    for (const ruta of this.rutas) {
      if (!predicado(ruta)) continue;
      ruta.activo = false;
      this.bus.limpiarFuente(ruta.id);
      total++;
    }
    if (total) this.emitirCambio();
    return total;
  }

  private emitirCambio(): void {
    for (const fn of this.escuchasCambio) fn();
  }

  tick(dt: number, tiempo: number, bpm = 60): void {
    this.fuentes.pulso = onda('seno', tiempo * bpm / 60) * 0.5 + 0.5;
    this.actualizarAudio();

    for (const r of this.rutas) {
      const previo = this.destinoPrevio.get(r.id);
      if (previo && previo !== r.destino) this.bus.quitarModulacion(previo, r.id);
      this.destinoPrevio.set(r.id, r.destino);

      const entrada = r.activo ? this.fuentes[r.fuente] : 0.5;
      const tau = entrada > r.valor ? r.ataque : r.caida;
      const a = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
      r.valor += (entrada - r.valor) * clamp01(a);

      const q = aplicarCurva(clamp01(r.valor), r.curva);
      const objetivo = r.min + (r.max - r.min) * q;
      const base = this.bus.get(r.destino, objetivo);
      this.bus.modular(r.destino, r.id, r.activo ? objetivo - base : 0);
    }
  }

  private actualizarAudio(): void {
    if (!this.analizador || !this.datosAudio) return;
    this.analizador.getFloatTimeDomainData(this.datosAudio);
    let suma = 0;
    for (const v of this.datosAudio) suma += v * v;
    const rms = Math.sqrt(suma / this.datosAudio.length);
    const nivel = clamp01(rms * 8);
    const subida = Math.max(0, nivel - this.nivelAudioPrevio);
    this.fuentes.audioNivel = nivel;
    this.fuentes.audioAtaque = Math.max(this.fuentes.audioAtaque * 0.85, clamp01(subida * 14));
    this.nivelAudioPrevio = nivel;
  }

  private recibirMIDI(data: Uint8Array<ArrayBufferLike>): void {
    const tipo = data[0] & 0xf0;
    const d1 = data[1] ?? 0;
    const d2 = data[2] ?? 0;
    if (tipo === 0x90 && d2 > 0) {
      this.fuentes.midiNota = d1 / 127;
      this.fuentes.midiVelocidad = d2 / 127;
    } else if (tipo === 0x80 || (tipo === 0x90 && d2 === 0)) {
      this.fuentes.midiVelocidad = 0;
    } else if (tipo === 0xb0 && d1 === 1) {
      this.fuentes.midiMod = d2 / 127;
    } else if (tipo === 0xe0) {
      this.fuentes.midiBend = ((d2 << 7) | d1) / 16383;
    }
  }
}

interface WebMidiInput {
  onmidimessage: ((ev: { data: Uint8Array }) => void) | null;
}

interface WebMidiAccess {
  inputs: Map<string, WebMidiInput>;
  onstatechange: (() => void) | null;
}

function aplicarCurva(v: number, curva: CurvaSinestesia): number {
  switch (curva) {
    case 'suave': return v * v * (3 - 2 * v);
    case 'exponencial': return v * v;
    case 'log': return Math.log10(1 + 9 * v);
    case 'lineal': return v;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function siguienteSecuencia(prefijo: string, ids: string[]): number {
  return Math.max(0, ...ids.map((id) => id.startsWith(prefijo) ? Number(id.slice(prefijo.length)) || 0 : 0)) + 1;
}
