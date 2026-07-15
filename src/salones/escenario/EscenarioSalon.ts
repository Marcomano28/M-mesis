// El Escenario — la sala de montaje: fichas de la cajonera colocadas como
// ACTORES en una escena conjunta, cada uno con su transform (posición,
// rotación, escala) y sus parámetros congelados. Estática o animada (si las
// fichas llevan giro propio, y con el giro global de escena).
//
// Cómo funciona: cada actor crea una INSTANCIA NUEVA de su salón de origen
// (uniforms y materiales propios → parámetros independientes), montada dentro
// de un Group-envoltura que hace de "escena" para esa instancia.

import { Pane } from 'tweakpane';
import * as THREE from 'three/webgpu';
import {
  hilosLegadoFicha,
  type Salon, type Params, type ParamDef, type FichaParaSalon, type HiloModulable,
} from '../../core/Salon';
import type { ParamBus } from '../../core/ParamBus';
import type { MotorSinestesia } from '../../core/Sinestesia';
import type { MotorLFO } from '../../core/Moduladores';
import type { MotorAcumuladores } from '../../core/Acumuladores';
import {
  crearActorEscena, crearDocumentoEscena, migrarDocumentoEscena,
  type ActorEscena, type DocumentoEscena,
} from '../../core/DocumentoEscena';

interface ActorVivo {
  def: ActorEscena;
  salon: Salon;
  envoltura: THREE.Group;
  folder: { dispose(): void };
  /** Objeto estable: se actualiza en sitio para no generar basura cada frame. */
  paramsActuales: Params;
}

interface MotoresActuacion {
  sinestesia: MotorSinestesia;
  lfo: MotorLFO;
  acumuladores: MotorAcumuladores;
}

const TRANSFORM_HILOS = [
  { clave: 'x', etiqueta: 'posición X', min: -8, max: 8 },
  { clave: 'y', etiqueta: 'posición Y', min: -8, max: 8 },
  { clave: 'z', etiqueta: 'posición Z', min: -8, max: 8 },
  { clave: 'rotX', etiqueta: 'rotación X', min: -Math.PI, max: Math.PI },
  { clave: 'rotY', etiqueta: 'rotación Y', min: -Math.PI, max: Math.PI },
  { clave: 'rotZ', etiqueta: 'rotación Z', min: -Math.PI, max: Math.PI },
  { clave: 'escalaX', etiqueta: 'escala X', min: 0.05, max: 4 },
  { clave: 'escalaY', etiqueta: 'escala Y', min: 0.05, max: 4 },
  { clave: 'escalaZ', etiqueta: 'escala Z', min: 0.05, max: 4 },
] as const;

const TRANSFORM_CLAVES = new Set<string>(TRANSFORM_HILOS.map((hilo) => hilo.clave));

export class EscenarioSalon implements Salon {
  id = 'escenario';
  nombre = 'El Escenario';

  params: ParamDef[] = [
    { clave: 'giro', etiqueta: 'giro global', valor: 0, min: -1, max: 1 },
  ];

  private raiz = new THREE.Group();
  private documento: DocumentoEscena = crearDocumentoEscena();
  private vivos: ActorVivo[] = [];    // actores montados (solo mientras está activo
  private escena: THREE.Scene | null = null;
  private camara!: THREE.PerspectiveCamera;
  private pane: Pane | null = null;
  private contenedor: HTMLDivElement | null = null;
  /** Invalida colas de montaje pendientes al cambiar o abandonar la escena. */
  private generacionMontaje = 0;

  /** fábricas: salonId → instancia ligera preparada para la receta del actor. */
  constructor(
    private fabricas: Record<string, (ficha: FichaParaSalon) => Salon>,
    private bus: ParamBus,
    private motores: MotoresActuacion,
  ) {}

  init(escena: THREE.Scene, camara: THREE.PerspectiveCamera): void {
    this.escena = escena;
    this.camara = camara;
    escena.add(this.raiz);

    // Panel propio de actores (izquierda, bajo el selector de la galería)
    this.contenedor = document.createElement('div');
    this.contenedor.style.cssText =
      'position:fixed;top:96px;left:8px;width:270px;max-height:70vh;overflow:auto;z-index:10';
    document.body.appendChild(this.contenedor);
    this.pane = new Pane({ container: this.contenedor, title: '🎭 Actores' });

    // Re-montar progresivamente: primero aparece el escenario y después entra
    // un actor por frame, evitando bloquear un frame largo al cargar una obra.
    this.montarProgresivo(this.documento.actores);
  }

  recibirFicha(ficha: FichaParaSalon): void {
    const def = crearActorEscena(ficha);
    this.documento.actores.push(def);
    if (this.escena) this.montar(def);
  }

  private montarProgresivo(defs: ActorEscena[]): void {
    const generacion = ++this.generacionMontaje;
    const cola = [...defs];
    const siguiente = () => {
      if (generacion !== this.generacionMontaje || !this.escena) return;
      const def = cola.shift();
      if (!def) return;
      this.montar(def);
      if (cola.length) requestAnimationFrame(siguiente);
    };
    if (cola.length) requestAnimationFrame(siguiente);
  }

  private montar(def: ActorEscena): void {
    const fabrica = this.fabricas[def.ficha.salonId];
    if (!fabrica || !this.pane) {
      console.error(`El Escenario no tiene fábrica para el salón «${def.ficha.salonId}».`);
      return;
    }
    try {
      const salon = fabrica(def.ficha);
      // Una ficha anterior al selector conserva el repertorio que MIA ofrecía
      // hasta ahora. Al volver a guardarla ya queda materializado en la ficha.
      if (!def.ficha.hilos) def.ficha.hilos = hilosLegadoFicha(salon);
      const envoltura = new THREE.Group();
      salon.init(envoltura as unknown as THREE.Scene, this.camara);
      this.raiz.add(envoltura);

      const folder = (this.pane as Pane).addFolder({ title: def.ficha.nombre, expanded: false });
      const t = def.transform;
      const vivo: ActorVivo = { def, salon, envoltura, folder, paramsActuales: { ...def.ficha.params } };
      this.registrarHilos(vivo);
      const cambioTransform = (clave: typeof TRANSFORM_HILOS[number]['clave']) => () => {
        this.bus.set(this.dirTransform(def.id, clave), t[clave]);
      };
      folder.addBinding(def.ficha, 'nombre', { label: 'nombre' });
      folder.addBinding(def, 'visible', { label: 'en escena' });
      folder.addBinding(def, 'actividad', {
        label: 'actuación',
        options: { 'estático (ahorra)': 'estatico', 'dinámico': 'dinamico' },
      }).on('change', () => this.notificarDestinos());
      folder.addBinding(t, 'x', { min: -8, max: 8, step: 0.01 }).on('change', cambioTransform('x'));
      folder.addBinding(t, 'y', { min: -8, max: 8, step: 0.01 }).on('change', cambioTransform('y'));
      folder.addBinding(t, 'z', { min: -8, max: 8, step: 0.01 }).on('change', cambioTransform('z'));
      folder.addBinding(t, 'rotX', { label: 'rotación X', min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', cambioTransform('rotX'));
      folder.addBinding(t, 'rotY', { label: 'rotación Y', min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', cambioTransform('rotY'));
      folder.addBinding(t, 'rotZ', { label: 'rotación Z', min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', cambioTransform('rotZ'));
      folder.addBinding(t, 'escalaX', { label: 'escala X', min: 0.05, max: 4, step: 0.01 }).on('change', cambioTransform('escalaX'));
      folder.addBinding(t, 'escalaY', { label: 'escala Y', min: 0.05, max: 4, step: 0.01 }).on('change', cambioTransform('escalaY'));
      folder.addBinding(t, 'escalaZ', { label: 'escala Z', min: 0.05, max: 4, step: 0.01 }).on('change', cambioTransform('escalaZ'));
      folder.addButton({ title: '⧉ Duplicar actor' }).on('click', () => this.duplicar(def));
      folder.addButton({ title: '✕ Quitar del escenario' }).on('click', () => this.quitar(def));

      this.vivos.push(vivo);
      this.notificarDestinos();
      // Incluso un actor estático necesita un primer pase para configurar sus
      // uniforms y hornear la geometría derivada de la ficha.
      salon.update(0, 0, this.paramsActor(vivo));
      this.aplicarTransform(vivo);
    } catch (err) {
      console.error(`No se pudo montar el actor «${def.ficha.nombre}»:`, err);
    }
  }

  private duplicar(def: ActorEscena): void {
    const copia: ActorEscena = {
      ...def,
      id: crypto.randomUUID(),
      ficha: {
        ...def.ficha,
        nombre: `${def.ficha.nombre} copia`,
        params: { ...def.ficha.params },
        hilos: def.ficha.hilos?.map((hilo) => ({ ...hilo, afinidades: [...hilo.afinidades] })),
        extra: def.ficha.extra === undefined ? undefined : structuredClone(def.ficha.extra),
      },
      transform: { ...def.transform, x: def.transform.x + 0.4 },
    };
    this.documento.actores.push(copia);
    if (this.escena) this.montar(copia);
  }

  private quitar(def: ActorEscena): void {
    this.documento.actores = this.documento.actores.filter((d) => d.id !== def.id);
    this.limpiarRutasActor(def.id);
    const vivo = this.vivos.find((v) => v.def.id === def.id);
    if (vivo) this.desmontar(vivo);
    this.vivos = this.vivos.filter((v) => v.def.id !== def.id);
    this.notificarDestinos();
  }

  private desmontar(vivo: ActorVivo): void {
    try {
      vivo.salon.dispose(vivo.envoltura as unknown as THREE.Scene);
    } catch (err) {
      console.error('Error al desmontar actor:', err);
    }
    this.bus.limpiarDirecciones(`actor:${vivo.def.id}.`);
    this.raiz.remove(vivo.envoltura);
    vivo.folder.dispose();
  }

  update(dt: number, tiempo: number, p: Params): void {
    this.raiz.rotation.y += (p.giro ?? 0) * dt;
    for (const v of this.vivos) {
      // Las transformaciones son hilos baratos y permanecen activas también
      // para actores estáticos; solo se congela su cálculo interno.
      this.aplicarTransform(v);
      if (!v.def.visible) continue;
      if (v.def.actividad === 'dinamico') v.salon.update(dt, tiempo, this.paramsActor(v));
    }
  }

  private aplicarTransform(vivo: ActorVivo): void {
    const { def, envoltura } = vivo;
    const t = def.transform;
    envoltura.visible = def.visible;
    const valor = (clave: typeof TRANSFORM_HILOS[number]['clave']) =>
      this.bus.valorFinal(this.dirTransform(def.id, clave), t[clave]);
    envoltura.position.set(valor('x'), valor('y'), valor('z'));
    envoltura.rotation.set(valor('rotX'), valor('rotY'), valor('rotZ'));
    envoltura.scale.set(valor('escalaX'), valor('escalaY'), valor('escalaZ'));
    envoltura.updateMatrix();
  }

  /** Hilos que la Mesa de Sinestesia y los LFO pueden ofrecer en este instante. */
  hilosModulables(): HiloModulable[] {
    const hilos: HiloModulable[] = [];
    for (const vivo of this.vivos) {
      const nombre = vivo.def.ficha.nombre;
      for (const hilo of vivo.def.ficha.hilos ?? []) {
        if (hilo.clave.startsWith('transform.')) {
          const clave = hilo.clave.slice('transform.'.length);
          if (!TRANSFORM_CLAVES.has(clave)) continue;
          hilos.push({
            etiqueta: `${nombre} · ${hilo.etiqueta}`,
            dir: this.dirTransform(vivo.def.id, clave),
            min: hilo.min,
            max: hilo.max,
          });
          continue;
        }
        // Un actor estático conserva los hilos de pose, pero no evalúa su salón.
        if (vivo.def.actividad !== 'dinamico' || !hilo.clave.startsWith('param.')) continue;
        const clave = hilo.clave.slice('param.'.length);
        if (vivo.def.ficha.params[clave] === undefined) continue;
        hilos.push({
          etiqueta: `${nombre} · ${hilo.etiqueta}`,
          dir: this.dirParam(vivo.def.id, clave),
          min: hilo.min,
          max: hilo.max,
        });
      }
    }
    return hilos;
  }

  private registrarHilos(vivo: ActorVivo): void {
    const { def, salon } = vivo;
    for (const h of TRANSFORM_HILOS) {
      const dir = this.dirTransform(def.id, h.clave);
      this.bus.set(dir, def.transform[h.clave]);
      this.bus.registrarRango(dir, h.min, h.max);
    }
    const defs = [...salon.params, ...(salon.pestanas ?? []).flatMap((p) => p.params)];
    for (const d of defs) {
      const base = def.ficha.params[d.clave];
      if (base === undefined) continue;
      const dir = this.dirParam(def.id, d.clave);
      this.bus.set(dir, base);
      this.bus.registrarRango(dir, d.min, d.max);
    }
  }

  private paramsActor(vivo: ActorVivo): Params {
    for (const clave in vivo.def.ficha.params) {
      const base = vivo.def.ficha.params[clave];
      vivo.paramsActuales[clave] = this.bus.valorFinal(this.dirParam(vivo.def.id, clave), base);
    }
    return vivo.paramsActuales;
  }

  private dirTransform(actorId: string, clave: string): string {
    return `actor:${actorId}.transform.${clave}`;
  }

  private dirParam(actorId: string, clave: string): string {
    return `actor:${actorId}.param.${clave}`;
  }

  private esHiloDeEstaEscena(direccion: string): boolean {
    if (direccion.startsWith('escenario.')) return true;
    return this.documento.actores.some((actor) => direccion.startsWith(`actor:${actor.id}.`));
  }

  private limpiarRutasActor(actorId: string): void {
    const prefijo = `actor:${actorId}.`;
    this.motores.sinestesia.eliminarDonde((ruta) => ruta.destino.startsWith(prefijo));
    this.motores.lfo.eliminarDonde((lfo) => lfo.destino.startsWith(prefijo));
    this.motores.acumuladores.eliminarDonde((a) =>
      a.destino.startsWith(prefijo) || a.fuente.startsWith(prefijo));
  }

  private notificarDestinos(): void {
    this.motores.sinestesia.refrescarDestinos();
    // PanelModuladores escucha al MotorLFO y reconstruye LFOs + acumuladores.
    this.motores.lfo.refrescarDestinos();
  }

  dispose(escena: THREE.Scene): void {
    this.generacionMontaje++;
    for (const v of this.vivos) this.desmontar(v);
    this.vivos = [];
    escena.remove(this.raiz);
    this.pane?.dispose();
    this.contenedor?.remove();
    this.pane = null;
    this.contenedor = null;
    this.escena = null;
    // El documento se conserva: la composición sigue ahí al volver.
  }

  // ————— Escenas como fichas —————

  /** La partitura de la escena viaja dentro de la ficha (campo extra). */
  estadoExtra(): unknown {
    this.documento.camara = {
      posicion: this.camara.position.toArray() as [number, number, number],
      objetivo: [...this.documento.camara.objetivo],
      fov: this.camara.fov,
    };
    this.documento.actuacion = {
      rutas: this.motores.sinestesia.exportar((ruta) => this.esHiloDeEstaEscena(ruta.destino)),
      lfos: this.motores.lfo.exportar((lfo) => this.esHiloDeEstaEscena(lfo.destino)),
      acumuladores: this.motores.acumuladores.exportar((a) => this.esHiloDeEstaEscena(a.destino)),
    };
    return structuredClone(this.documento);
  }

  /** Restaura una escena guardada: reemplaza la composición actual. */
  cargarEstadoExtra(extra: unknown): void {
    const documento = migrarDocumentoEscena(extra);
    if (!documento) return;
    this.generacionMontaje++;
    for (const v of this.vivos) this.desmontar(v);
    this.vivos = [];
    this.documento = documento;
    this.motores.sinestesia.restaurar(documento.actuacion.rutas);
    this.motores.lfo.restaurar(documento.actuacion.lfos);
    this.motores.acumuladores.restaurar(documento.actuacion.acumuladores);
    this.camara.position.fromArray(documento.camara.posicion);
    this.camara.fov = documento.camara.fov;
    this.camara.lookAt(...documento.camara.objetivo);
    this.camara.updateProjectionMatrix();
    if (this.escena) this.montarProgresivo(this.documento.actores);
  }

  // ————— Exportador: HTML autocontenido que reconstruye la escena —————
  // Incluye las recetas de Formas Exóticas y los GLB guardados de Trazo y
  // Grafito. Otros salones se identifican en la consola para no ocultarlos.

  exportar(p: Params): string {
    const escena = {
      giro: p.giro ?? 0,
      actores: this.documento.actores.map((d) => ({
        salon: d.ficha.salonId,
        nombre: d.ficha.nombre,
        params: d.ficha.params,
        transform: {
          x: d.transform.x, y: d.transform.y, z: d.transform.z,
          rotX: d.transform.rotX, rotY: d.transform.rotY, rotZ: d.transform.rotZ,
          escalaX: d.transform.escalaX, escalaY: d.transform.escalaY, escalaZ: d.transform.escalaZ,
        },
        visible: d.visible,
        modeloGLB: serializarModeloGLB(d.ficha.extra),
      })),
    };
    return PLANTILLA_ESCENA.replaceAll('__ESCENA__', JSON.stringify(escena));
  }
}

function serializarModeloGLB(extra: unknown): string | null {
  if (!extra || typeof extra !== 'object') return null;
  const datos = (extra as { tipo?: unknown; datos?: unknown }).datos;
  if ((extra as { tipo?: unknown }).tipo !== 'mia-glb' || !(datos instanceof ArrayBuffer)) return null;
  const bytes = new Uint8Array(datos);
  const bloque = 0x8000;
  let binario = '';
  for (let inicio = 0; inicio < bytes.length; inicio += bloque) {
    binario += String.fromCharCode(...bytes.subarray(inicio, inicio + bloque));
  }
  return btoa(binario);
}

// La partitura JSON queda embebida en el HTML: el archivo es a la vez
// pieza reproducible y documento de la composición.
const PLANTILLA_ESCENA = `<!doctype html>
<html><head><meta charset="utf-8"><title>MIA — escena</title>
<style>html,body{margin:0;height:100%;background:#0d0d12;overflow:hidden}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const E = __ESCENA__;

// ——— matemática de Formas Exóticas ———
const sr = (t,m,n1,n2,n3) => { const r = (Math.abs(Math.cos(m*t/4))**n2 + Math.abs(Math.sin(m*t/4))**n3)**(-1/n1); return isFinite(r) ? r : 0; };
const sft = (q,p) => { const qq=p+q; return qq<=0 ? 0 : qq>=2*p ? qq-p : qq*qq/(4*p); };
const ease = (p,g) => p<0.5 ? 0.5*(2*p)**g : 1-0.5*(2*(1-p))**g;
const posClasica = (P) => (u,v) => {
  const th=-Math.PI+2*Math.PI*u, ph=-Math.PI/2+Math.PI*v;
  const r1=sr(th,P.m1,P.n1,P.n2,P.n3), r2=sr(ph,P.m2,P.n1,P.n2,P.n3);
  return [r1*Math.cos(th)*r2*Math.cos(ph), r1*Math.sin(th)*r2*Math.cos(ph), r2*Math.sin(ph)];
};
const posFlor = (P) => (u,v) => {
  const t=v, th=2*Math.PI*u;
  const r1=sr(th,P.r1m,P.r1n1,P.r1n2,P.r1n3), r2=sr(th,P.r2m,P.r2n1,P.r2n2,P.r2n3);
  const pp=P.rat**(t*P.K), f=ease(Math.max(0,Math.min(1,t/0.9)),P.easeExp);
  const r=P.rmn*f+sft(4*pp,P.rmx)*f;
  const z=-sft(pp,P.rmx)+P.zOffset-P.zCurva*(1-pp)**2;
  const sm=(Math.sin(Math.PI*2*t)+1)/2;
  return [(r*r1*Math.cos(th)*r2*Math.sin(th)-(sm*(1-t))**2*P.xOffset)*0.01,
          (r*r1*Math.sin(th)*r2*Math.sin(th)-(1-t)**3*P.yOffset-P.yBase)*0.01, z*0.01];
};

// ——— generadores de geometría (retícula → nube / malla con normales) ———
function nube(fn, n1, n2){
  const ps = new Float32Array((n1+1)*(n2+1)*3); let i=0;
  for (let a=0;a<=n1;a++) for (let b=0;b<=n2;b++){ const v=fn(a/n1,b/n2); ps[i++]=v[0]; ps[i++]=v[1]; ps[i++]=v[2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(ps,3));
  return g;
}
function malla(fn, n1, n2){
  const ps=[], ns=[], e=0.001;
  const nor=(u,v)=>{ const a=fn(u,v), b=fn(u+e,v), c=fn(u,v+e);
    const w1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], w2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=[w1[1]*w2[2]-w1[2]*w2[1], w1[2]*w2[0]-w1[0]*w2[2], w1[0]*w2[1]-w1[1]*w2[0]];
    const L=Math.hypot(...n)||1; return [n[0]/L,n[1]/L,n[2]/L]; };
  const put=(u,v)=>{ ps.push(...fn(u,v)); ns.push(...nor(u,v)); };
  for (let a=0;a<n1;a++) for (let b=0;b<n2;b++){
    const u1=a/n1,u2=(a+1)/n1,v1=b/n2,v2=(b+1)/n2;
    put(u1,v1); put(u2,v1); put(u1,v2); put(u2,v1); put(u2,v2); put(u1,v2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ps,3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(ns,3));
  return g;
}

// ——— montaje de actores ———
const escena = new THREE.Scene();
const raiz = new THREE.Group(); escena.add(raiz);
const animados = [];
const aplicarActor = (actor, figura) => {
  const envoltura = new THREE.Group(), t = actor.transform;
  envoltura.position.set(t.x, t.y, t.z);
  envoltura.rotation.set(t.rotX ?? 0, t.rotY ?? 0, t.rotZ ?? 0);
  envoltura.scale.set(t.escalaX ?? 1, t.escalaY ?? 1, t.escalaZ ?? 1);
  envoltura.visible = actor.visible !== false;
  envoltura.add(figura); raiz.add(envoltura);
};
const bytesDesdeBase64 = (texto) => {
  const binario = atob(texto), bytes = new Uint8Array(binario.length);
  for (let i=0; i<binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
};
for (const actor of E.actores){
  const P = actor.params;
  if (actor.salon === 'crosshatch') {
    const figura = new THREE.Group();
    const invertir = P.invertir === 1;
    const colorLinea = invertir ? (P.fondo ?? 0xf3f0e8) : (P.tinta ?? 0x21212b);
    const mat = new THREE.MeshBasicMaterial({ color: colorLinea, wireframe: true });
    const defecto = new THREE.Mesh(new THREE.TorusKnotGeometry(1, .35, 220, 36), mat);
    figura.add(defecto); aplicarActor(actor, figura);
    if (actor.modeloGLB) new GLTFLoader().parseAsync(bytesDesdeBase64(actor.modeloGLB), '').then((gltf) => {
      const modelo = gltf.scene;
      modelo.traverse(o => { if (o.isMesh) o.material = mat; });
      const caja = new THREE.Box3().setFromObject(modelo);
      const centro = caja.getCenter(new THREE.Vector3());
      const dimension = caja.getSize(new THREE.Vector3()).length() || 1;
      modelo.position.sub(centro); modelo.scale.setScalar(3.4 / dimension);
      figura.clear(); figura.add(modelo);
    }).catch(err => console.error('No se pudo restaurar el GLB exportado:', err));
    animados.push({ figura, giro: P.giro ?? 0 });
    continue;
  }
  if (actor.salon !== 'supershapes') {
    console.warn('Exportación parcial: este salón aún no tiene reproductor autónomo:', actor.nombre, actor.salon);
    continue;
  }
  const R = Math.min(Math.round(P.resolucion ?? 128), 192);
  const fn = (P.modo ?? 0) === 1 ? posFlor(P) : posClasica(P);
  const color = P.color ?? 0xdfe6ff;
  const vista = P.vista ?? 0;
  let objeto;
  if (vista === 0){
    objeto = new THREE.Points(nube(fn,R,R), new THREE.PointsMaterial({color, size:P.puntoTam ?? 0.02, sizeAttenuation:true}));
  } else if (vista === 1){
    objeto = new THREE.Mesh(malla(fn,R,Math.round(R*0.75)), new THREE.MeshBasicMaterial({color, wireframe:true, transparent:true, opacity:0.6}));
  } else {
    objeto = new THREE.Mesh(malla(fn,R,Math.round(R*0.75)), new THREE.MeshPhongMaterial({color, side:THREE.DoubleSide, shininess:60}));
  }
  const figura = new THREE.Group();
  if ((P.modo ?? 0) === 1) objeto.rotation.x = 2.97;
  figura.add(objeto);
  figura.scale.setScalar(P.escala ?? 2);
  aplicarActor(actor, figura);
  animados.push({ figura, giro: P.giro ?? 0 });
}

// ——— luces, cámara, loop ———
escena.add(new THREE.AmbientLight(0xffffff, 0.35));
const l1 = new THREE.DirectionalLight(0xccffdd, 1.2); l1.position.set(1,3,2); escena.add(l1);
const l2 = new THREE.DirectionalLight(0x3366ff, 0.4); l2.position.set(-2,-1,1); escena.add(l2);
const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .1, 200); cam.position.z = 8;
const r = new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.appendChild(r.domElement);
const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true;
const reloj = new THREE.Clock();
r.setAnimationLoop(()=>{
  const dt = reloj.getDelta();
  raiz.rotation.y += E.giro*dt;
  for (const a of animados) a.figura.rotation.y += a.giro*dt;
  ctl.update(); r.render(escena,cam);
});
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth,innerHeight); });
</script></body></html>`;
