// El contrato de Salón — la pieza más importante de la arquitectura.
// Un salón NUNCA sabe de dónde vienen sus valores (slider, preset, LFO, guitarra).

import type * as THREE from 'three/webgpu';

/** Definición autodescriptiva de un parámetro → genera su control en el panel. */
export interface ParamDef {
  clave: string;        // p.ej. "m1" → dirección en el bus: "supershapes.m1"
  etiqueta: string;     // texto visible en el panel
  valor: number;        // valor inicial
  min: number;
  max: number;
  paso?: number;
  /** 'color' → selector de color (el valor es un hex numérico 0xRRGGBB). */
  tipo?: 'color';
  /** Lista desplegable: etiqueta → valor numérico (p.ej. vistas de exposición). */
  opciones?: Record<string, number>;
}

/** Valores actuales de los parámetros de un salón, por clave. */
export type Params = Record<string, number>;

/** Dirección que una fuente viva puede accionar como un hilo de marioneta. */
export interface HiloModulable {
  etiqueta: string;
  dir: string;
  min: number;
  max: number;
}

/** Acción no-numérica del salón (p.ej. «Cargar modelo GLB»). Se vuelve botón en el panel. */
export interface Accion {
  titulo: string;
  fn: () => void;
}

/** Lo mínimo que un salón necesita saber de una ficha para aceptarla. */
export interface FichaParaSalon {
  salonId: string;
  nombre: string;
  params: Record<string, number>;
  /** Datos no numéricos de la ficha (por ejemplo, el archivo GLB importado). */
  extra?: unknown;
}

/** Pestaña del panel: un modo del salón con su propio juego de parámetros. */
export interface Pestana {
  titulo: string;
  params: ParamDef[];
}

export interface Salon {
  id: string;
  nombre: string;
  /** Parámetros comunes (visibles siempre, encima de las pestañas). */
  params: ParamDef[];
  /** Modos del salón. La pestaña activa llega al bus como `<id>.modo` (índice). */
  pestanas?: Pestana[];
  acciones?: Accion[];

  /** Monta el efecto en la escena. Se llama una vez al entrar al salón. */
  init(escena: THREE.Scene, camara: THREE.PerspectiveCamera): void;

  /** Un tick del loop. `params` trae los valores ya resueltos desde el bus. */
  update(dt: number, tiempo: number, params: Params): void;

  /** Desmonta y libera GPU. Se llama al salir del salón. */
  dispose(escena: THREE.Scene): void;

  /** Botón «Imprimir»: devuelve código autocontenido con los valores horneados. */
  exportar(params: Params): string;

  /** Si existe, el salón acepta fichas (p.ej. el Escenario las convierte en actores). */
  recibirFicha?(ficha: FichaParaSalon): void;

  /** Estado no-numérico a guardar dentro de una ficha (p.ej. actores de una escena). */
  estadoExtra?(): unknown;

  /** Restaura el estado extra de una ficha cargada. */
  cargarEstadoExtra?(extra: unknown): void;

  /** Destinos adicionales creados en runtime (p.ej. hilos de cada actor). */
  hilosModulables?(): HiloModulable[];
}
