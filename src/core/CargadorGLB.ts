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

/** Abre un selector de archivo .glb/.gltf y entrega la escena parseada. */
export function elegirYCargarGLB(alCargar: (escena: import('three').Object3D) => void): void {
  const input = Object.assign(document.createElement('input'), {
    type: 'file',
    accept: '.glb,.gltf',
  }) as HTMLInputElement;
  input.onchange = async () => {
    const archivo = input.files?.[0];
    if (!archivo) return;
    try {
      const gltf = await crearLoaderGLB().parseAsync(await archivo.arrayBuffer(), '');
      alCargar(gltf.scene);
    } catch (err) {
      console.error('Error cargando GLB:', err);
    }
  };
  input.click();
}
