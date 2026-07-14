// Documento serializable de una puesta en escena de MIA.
//
// Los salones crean personajes; este documento describe el reparto y el guion
// sin contener objetos Three.js. El runtime puede reconstruirlo, migrarlo y,
// más adelante, reproducir la misma partitura dentro del editor y del export.

import type { FichaParaSalon } from './Salon';

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

export interface DocumentoEscena {
  version: 2;
  duracion: number;
  bucle: boolean;
  actores: ActorEscena[];
  camara: CamaraEscena;
  luces: unknown[];
  pistas: PistaEscena[];
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
    ficha: { salonId: ficha.salonId, nombre: ficha.nombre, params: { ...ficha.params } },
    transform: transformActorInicial(),
    visible: true,
    actividad: 'dinamico',
  };
}

export function crearDocumentoEscena(): DocumentoEscena {
  return {
    version: 2,
    duracion: 60,
    bucle: true,
    actores: [],
    camara: { posicion: [0, 0, 6], objetivo: [0, 0, 0], fov: 50 },
    luces: [],
    pistas: [],
  };
}

/** Acepta el MVP anterior y devuelve siempre un documento v2 independiente. */
export function migrarDocumentoEscena(extra: unknown): DocumentoEscena | null {
  if (!extra || typeof extra !== 'object') return null;
  const datos = extra as DocumentoEscena | DocumentoV1;
  if (!Array.isArray(datos.actores)) return null;

  if (datos.version === 2) {
    const d = datos as DocumentoEscena;
    return {
      ...crearDocumentoEscena(),
      ...d,
      camara: { ...crearDocumentoEscena().camara, ...d.camara },
      actores: d.actores.map((a) => ({
        ...a,
        id: a.id || crypto.randomUUID(),
        ficha: { ...a.ficha, params: { ...a.ficha.params } },
        transform: { ...transformActorInicial(), ...a.transform },
        visible: a.visible !== false,
        actividad: a.actividad === 'estatico' ? 'estatico' : 'dinamico',
      })),
      luces: [...(d.luces ?? [])],
      pistas: [...(d.pistas ?? [])],
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
