// Documento serializable de una puesta en escena de MIA.
//
// Los salones crean personajes; este documento describe el reparto y el guion
// sin contener objetos Three.js. El runtime puede reconstruirlo, migrarlo y,
// más adelante, reproducir la misma partitura dentro del editor y del export.

import type { FichaParaSalon } from './Salon';
import type { RutaSinestesiaGuardada } from './Sinestesia';
import type { LFO } from './Moduladores';
import type { AcumuladorGuardado } from './Acumuladores';

export type ActividadActor = 'estatico' | 'dinamico';

export interface TransformActor {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  escalaX: number;
  escalaY: number;
  escalaZ: number;
}

export interface ActorEscena {
  id: string;
  ficha: FichaParaSalon;
  transform: TransformActor;
  visible: boolean;
  actividad: ActividadActor;
  padreId?: string;
}

export interface CamaraEscena {
  posicion: [number, number, number];
  objetivo: [number, number, number];
  fov: number;
}

export interface PistaEscena {
  id: string;
  destino: string;
  interpolacion: 'escalon' | 'lineal' | 'suave';
  claves: { tiempo: number; valor: number }[];
}

export interface ActuacionEscena {
  rutas: RutaSinestesiaGuardada[];
  lfos: LFO[];
  acumuladores: AcumuladorGuardado[];
}

export interface DocumentoEscena {
  version: 3;
  duracion: number;
  bucle: boolean;
  actores: ActorEscena[];
  camara: CamaraEscena;
  luces: unknown[];
  pistas: PistaEscena[];
  actuacion: ActuacionEscena;
}

interface DocumentoV2 extends Omit<DocumentoEscena, 'version' | 'actuacion'> {
  version: 2;
}

interface ActorV1 {
  ficha: FichaParaSalon;
  transform: Partial<TransformActor> & { escala?: number };
}

interface DocumentoV1 {
  version?: 1;
  actores?: ActorV1[];
}

export function transformActorInicial(): TransformActor {
  return {
    x: 0, y: 0, z: 0,
    rotX: 0, rotY: 0, rotZ: 0,
    escalaX: 1, escalaY: 1, escalaZ: 1,
  };
}

export function crearActorEscena(ficha: FichaParaSalon): ActorEscena {
  return {
    id: crypto.randomUUID(),
    ficha: copiarFicha(ficha),
    transform: transformActorInicial(),
    visible: true,
    actividad: 'dinamico',
  };
}

function copiarFicha(ficha: FichaParaSalon): FichaParaSalon {
  return {
    salonId: ficha.salonId,
    nombre: ficha.nombre,
    params: { ...ficha.params },
    hilos: ficha.hilos?.map((hilo) => ({ ...hilo, afinidades: [...hilo.afinidades] })),
    extra: ficha.extra === undefined ? undefined : structuredClone(ficha.extra),
  };
}

export function crearDocumentoEscena(): DocumentoEscena {
  return {
    version: 3,
    duracion: 60,
    bucle: true,
    actores: [],
    camara: { posicion: [0, 0, 6], objetivo: [0, 0, 0], fov: 50 },
    luces: [],
    pistas: [],
    actuacion: { rutas: [], lfos: [], acumuladores: [] },
  };
}

/** Acepta los MVP v1/v2 y devuelve siempre un documento v3 independiente. */
export function migrarDocumentoEscena(extra: unknown): DocumentoEscena | null {
  if (!extra || typeof extra !== 'object') return null;
  const datos = extra as DocumentoEscena | DocumentoV2 | DocumentoV1;
  if (!Array.isArray(datos.actores)) return null;

  if (datos.version === 3 || datos.version === 2) {
    const d = datos as DocumentoEscena | DocumentoV2;
    return {
      ...crearDocumentoEscena(),
      ...d,
      version: 3,
      camara: { ...crearDocumentoEscena().camara, ...d.camara },
      actores: d.actores.map((a) => ({
        ...a,
        id: a.id || crypto.randomUUID(),
        ficha: copiarFicha(a.ficha),
        transform: { ...transformActorInicial(), ...a.transform },
        visible: a.visible !== false,
        actividad: a.actividad === 'estatico' ? 'estatico' : 'dinamico',
      })),
      luces: [...(d.luces ?? [])],
      pistas: [...(d.pistas ?? [])],
      actuacion: d.version === 3 ? copiarActuacion(d.actuacion) : { rutas: [], lfos: [], acumuladores: [] },
    };
  }

  const viejo = datos as DocumentoV1;
  const documento = crearDocumentoEscena();
  documento.actores = (viejo.actores ?? []).map((a) => {
    const escala = a.transform?.escala ?? 1;
    return {
      ...crearActorEscena(a.ficha),
      transform: {
        ...transformActorInicial(),
        ...a.transform,
        escalaX: escala,
        escalaY: escala,
        escalaZ: escala,
      },
    };
  });
  return documento;
}

function copiarActuacion(actuacion: ActuacionEscena | undefined): ActuacionEscena {
  return {
    rutas: (actuacion?.rutas ?? []).map((ruta) => ({ ...ruta })),
    lfos: (actuacion?.lfos ?? []).map((lfo) => ({ ...lfo })),
    acumuladores: (actuacion?.acumuladores ?? []).map((a) => ({ ...a })),
  };
}
