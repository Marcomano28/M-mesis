// Cargador GLB compartido — siempre con DRACO configurado, para que cualquier
// salón acepte modelos comprimidos sin sorpresas.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

let draco: DRACOLoader | null = null;

export function crearLoaderGLB(): GLTFLoader {
  if (!draco) {
    draco = new DRACOLoader();
    // Decoder local (copiado de three a public/draco/): el taller funciona offline
    draco.setDecoderPath('/draco/');
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

export interface ModeloGLBCargado {
  escena: import('three').Object3D;
  nombre: string;
  /** Copia binaria para que el salón pueda guardarla dentro de su ficha. */
  datos: ArrayBuffer;
}

/** Abre un selector de archivo .glb/.gltf y entrega escena y bytes originales. */
export function elegirYCargarGLB(alCargar: (modelo: ModeloGLBCargado) => void): void {
  const input = Object.assign(document.createElement('input'), {
    type: 'file',
    accept: '.glb,.gltf',
  }) as HTMLInputElement;
  input.onchange = async () => {
    const archivo = input.files?.[0];
    if (!archivo) return;
    try {
      const datos = await archivo.arrayBuffer();
      const gltf = await crearLoaderGLB().parseAsync(datos.slice(0), '');
      alCargar({ escena: gltf.scene, nombre: archivo.name, datos });
    } catch (err) {
      console.error('Error cargando GLB:', err);
    }
  };
  input.click();
}
