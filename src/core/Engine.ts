// Motor de render — Three.js WebGPURenderer (con fallback automático a WebGL2).

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Engine {
  renderer!: THREE.WebGPURenderer;
  escena = new THREE.Scene();
  camara: THREE.PerspectiveCamera;
  controles!: OrbitControls;
  private reloj = new THREE.Clock();

  constructor(private contenedor: HTMLElement) {
    this.camara = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
    this.camara.position.set(0, 0, 6);
  }

  async init(): Promise<void> {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    await this.renderer.init(); // WebGPU es asíncrono; aquí decide GPU o fallback
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.contenedor.appendChild(this.renderer.domElement);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;

    // Indicador del backend real (WebGPU o fallback WebGL2)
    const esWebGPU = (this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
    const etiqueta = document.createElement('div');
    etiqueta.textContent = esWebGPU ? '● WebGPU' : '○ WebGL2 (fallback)';
    etiqueta.style.cssText =
      'position:fixed;bottom:8px;left:8px;z-index:20;font:11px ui-monospace,monospace;' +
      `color:${esWebGPU ? '#7dffb0' : '#ffd97d'};opacity:0.7;pointer-events:none`;
    document.body.appendChild(etiqueta);

    addEventListener('resize', () => {
      this.camara.aspect = innerWidth / innerHeight;
      this.camara.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  private capturaPendiente: { tam: number; resolver: (dataURL: string) => void } | null = null;

  /**
   * Captura una miniatura (dataURL jpeg). El canvas WebGPU se vacía tras
   * presentar cada frame, así que la captura se hace DENTRO del loop, justo
   * después de render() — por eso devuelve una promesa (se resuelve al frame siguiente).
   */
  capturar(tam = 256): Promise<string> {
    return new Promise((resolver) => {
      this.capturaPendiente = { tam, resolver };
    });
  }

  /** Arranca el loop. `tick` recibe (dt, tiempo total). */
  arrancar(tick: (dt: number, tiempo: number) => void): void {
    this.renderer.setAnimationLoop(() => {
      const dt = this.reloj.getDelta();
      tick(dt, this.reloj.elapsedTime);
      this.controles.update();
      this.renderer.render(this.escena, this.camara);

      // Captura diferida: el backbuffer aún está vivo en este punto del frame
      if (this.capturaPendiente) {
        const { tam, resolver } = this.capturaPendiente;
        this.capturaPendiente = null;
        const origen = this.renderer.domElement;
        const factor = tam / Math.max(origen.width, origen.height);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(origen.width * factor));
        c.height = Math.max(1, Math.round(origen.height * factor));
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#0d0d12';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(origen, 0, 0, c.width, c.height);
        resolver(c.toDataURL('image/jpeg', 0.85));
      }
    });
  }
}
