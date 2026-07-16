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
import type { Transporte } from '../../core/Transporte';
import { copiarGestos, type MotorGestos } from '../../core/Gestos';
import {
  copiarFicha, crearActorEscena, crearDocumentoEscena, migrarDocumentoEscena,
  type ActorEscena, type DocumentoEscena,
} from '../../core/DocumentoEscena';

type SolicitarRetoque = (
  actorId: string,
  ficha: FichaParaSalon,
  alDevolver: (ficha: FichaParaSalon) => void,
) => void;

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
  transporte: Transporte;
  gestos: MotorGestos;
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
  private solicitarRetoque: SolicitarRetoque | null = null;

  /** fábricas: salonId → instancia ligera preparada para la receta del actor. */
  constructor(
    private fabricas: Record<string, (ficha: FichaParaSalon) => Salon>,
    private bus: ParamBus,
    private motores: MotoresActuacion,
  ) {}

  conectarCamerino(solicitar: SolicitarRetoque): void {
    this.solicitarRetoque = solicitar;
  }

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
      if (def.avisos?.length) {
        const estado = { aviso: def.avisos.join(' · ') };
        folder.addBinding(estado, 'aviso', { label: 'revisión', readonly: true });
      }
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
      if (def.ficha.gestos?.length) {
        const repertorio = folder.addFolder({ title: '🎭 Gestos ensayados', expanded: false });
        for (const gesto of def.ficha.gestos) {
          repertorio.addButton({ title: `▶ ${gesto.nombre}` }).on('click', () => {
            def.actividad = 'dinamico';
            folder.refresh();
            this.motores.gestos.reproducir(
              this.ambitoActor(def.id),
              gesto,
              (hilo) => {
                if (!hilo.startsWith('param.')) return null;
                const clave = hilo.slice('param.'.length);
                return def.ficha.params[clave] === undefined ? null : this.dirParam(def.id, clave);
              },
            );
          });
        }
        repertorio.addButton({ title: '■ Detener gesto' }).on('click', () => {
          this.motores.gestos.detenerAmbito(this.ambitoActor(def.id));
        });
      }
      if (this.solicitarRetoque) {
        folder.addButton({ title: '↩ Retocar en camerino' }).on('click', () => {
          this.solicitarRetoque?.(
            def.id,
            copiarFicha(def.ficha),
            (ficha) => this.actualizarActorDesdeCamerino(def.id, ficha),
          );
        });
      }
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
        gestos: copiarGestos(def.ficha.gestos),
        extra: def.ficha.extra === undefined ? undefined : structuredClone(def.ficha.extra),
      },
      transform: { ...def.transform, x: def.transform.x + 0.4 },
      avisos: def.avisos ? [...def.avisos] : undefined,
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

  private actualizarActorDesdeCamerino(actorId: string, ficha: FichaParaSalon): void {
    const def = this.documento.actores.find((actor) => actor.id === actorId);
    if (!def) throw new Error('El actor ya no pertenece a esta escena.');
    if (def.ficha.salonId !== ficha.salonId) {
      throw new Error('El camerino no coincide con la familia del actor.');
    }

    const permitidas = new Set<string>();
    for (const hilo of ficha.hilos ?? []) {
      if (hilo.clave.startsWith('transform.')) {
        permitidas.add(this.dirTransform(actorId, hilo.clave.slice('transform.'.length)));
      } else if (hilo.clave.startsWith('param.')) {
        permitidas.add(this.dirParam(actorId, hilo.clave.slice('param.'.length)));
      }
    }
    const prefijo = `actor:${actorId}.`;
    const perdida = (direccion: string) => direccion.startsWith(prefijo) && !permitidas.has(direccion);
    const rutas = this.motores.sinestesia.desactivarDonde((ruta) => perdida(ruta.destino));
    const lfos = this.motores.lfo.desactivarDonde((lfo) => perdida(lfo.destino));
    const acumuladores = this.motores.acumuladores.desactivarDonde((a) =>
      perdida(a.destino) || (a.fuente.startsWith(prefijo) && perdida(a.fuente)));
    const avisos: string[] = [];
    if (rutas) avisos.push(`${rutas} ruta${rutas === 1 ? '' : 's'} sin hilo, desactivada${rutas === 1 ? '' : 's'}`);
    if (lfos) avisos.push(`${lfos} LFO sin hilo, desactivado${lfos === 1 ? '' : 's'}`);
    if (acumuladores) avisos.push(`${acumuladores} memoria${acumuladores === 1 ? '' : 's'} sin hilo, desactivada${acumuladores === 1 ? '' : 's'}`);

    const vivo = this.vivos.find((actor) => actor.def.id === actorId);
    if (vivo) {
      this.desmontar(vivo);
      this.vivos = this.vivos.filter((actor) => actor !== vivo);
    }
    def.ficha = copiarFicha(ficha);
    def.avisos = avisos.length ? avisos : undefined;
    if (this.escena) this.montar(def);
    this.notificarDestinos();
  }

  private desmontar(vivo: ActorVivo): void {
    this.motores.gestos.detenerAmbito(this.ambitoActor(vivo.def.id));
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

  private ambitoActor(actorId: string): string {
    return `actor:${actorId}`;
  }

  private esHiloDeEstaEscena(direccion: string): boolean {
    if (direccion.startsWith('escenario.')) return true;
    return this.documento.actores.some((actor) => direccion.startsWith(`actor:${actor.id}.`));
  }

  private limpiarRutasActor(actorId: string): void {
    this.motores.gestos.detenerAmbito(this.ambitoActor(actorId));
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
    const transporte = this.motores.transporte.exportarConfiguracion();
    this.documento.duracion = transporte.duracion;
    this.documento.bucle = transporte.bucle;
    this.documento.transporte = transporte;
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
    this.motores.transporte.configurar(documento.transporte);
    this.motores.transporte.detener();
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
  // Reproductores autónomos: Formas Exóticas (clásica/flor/serpiente), Delaunay
  // (triángulos y celdas Room, paleta luz/sombra) y los GLB de Trazo y Grafito.
  // Actores sin reproductor se identifican en la consola para no ocultarlos.

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
import Delaunator from 'https://cdn.jsdelivr.net/npm/delaunator@5/+esm';
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

// ——— Serpiente (cuerpo orgánico animado; port de PLANTILLA_SERPIENTE) ———
function makeNoise2D(){ const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
  const g3=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
  const pp=Array.from({length:256},(_,i)=>i); for(let i=255;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pp[i],pp[j]]=[pp[j],pp[i]];}
  const perm=Array.from({length:512},(_,i)=>pp[i&255]);
  return (xin,yin)=>{ const s=(xin+yin)*F2,i=Math.floor(xin+s),j=Math.floor(yin+s),t=(i+j)*G2;
    const x0=xin-(i-t),y0=yin-(j-t),i1=x0>y0?1:0,j1=x0>y0?0:1,x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255;
    const dot=(gi,x,y)=>{const g=g3[gi%12];return g[0]*x+g[1]*y;};
    const gi0=perm[ii+perm[jj]],gi1=perm[ii+i1+perm[jj+j1]],gi2=perm[ii+1+perm[jj+1]];
    let n0=0,n1=0,n2=0,t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0;n0=t0*t0*dot(gi0,x0,y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1;n1=t1*t1*dot(gi1,x1,y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2;n2=t2*t2*dot(gi2,x2,y2);}
    return 70*(n0+n1+n2); };
}
const mapV=(v,a,b,c,d)=>c+(v-a)/(b-a)*(d-c), cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function crearSerpiente(P){
  const SC=0.01, RES=Math.max(8,Math.round(P.resolucion??256)), KR=RES/256;
  const N1=Math.max(6,Math.min(60,Math.round(30*KR))), N=Math.max(3,Math.min(24,Math.round(12*KR)));
  const N2=Math.max(20,Math.min(160,Math.round(80*KR))), K=Math.ceil(N2/N);
  const R=P.sR??200, Z=P.sZ??1000, TRN=P.sTrn??3.4, MV=P.sMV??-0.15, MXV=P.sMXV??1.35;
  const R1=[P.sr1m??5,P.sr1n1??0.1,P.sr1n2??1.7,P.sr1n3??1.7], R2=[P.sr2m??7,P.sr2n1??0.3,P.sr2n2??0.5,P.sr2n3??0.5];
  const noise2D=makeNoise2D();
  const pos=(r,p,th)=>{ const r1=sr(th,R1[0],R1[1],R1[2],R1[3]), r2=sr(th,R2[0],R2[1],R2[2],R2[3]);
    return new THREE.Vector3(r*r1*Math.cos(th+TRN)-(1-p)**2*500+200, r*r2*Math.sin(th+TRN)+100*Math.sin(Math.PI*2*p), -Z*(1-p)+50*Math.sin(Math.PI*2*p)+120); };
  const inst=[]; for(let i=0;i<N1;i++)for(let j=0;j<N;j++) inst.push({seed:10+Math.random()*990,off:0.4+0.8*(Math.random()*2-1),di:120+Math.random()*680,i,j});
  const V=N1*N*K*4*3, posArr=new Float32Array(V*3), colArr=new Float32Array(V*3);
  function build(t){ let idx=0;
    for(const {seed,off,di,i,j} of inst){ for(let k=0;k<K;k++){ const ind=j+(t+k)*N;
      const p0=mapV(ind+0.5,0,N2,MV,MXV),p1=mapV(ind,0,N2,MV,MXV),p2=mapV(ind+1,0,N2,MV,MXV);
      const th0=Math.PI*2*(i+0.5)/N1,th1=Math.PI*2*i/N1,th2=Math.PI*2*(i+1)/N1;
      const par=(1-cl(2*p0-off,0,1))**3.3, rn=mapV(noise2D(seed+2*p0,0),-1,1,0,1), rV=R-20-180*rn**5, d=di*par, q=cl(par+0.05,0,1);
      const v0=pos(rV+d,p0,th0), v1=pos(R+d,p1,th1).lerp(v0,q), v2=pos(R+d,p2,th1).lerp(v0,q), v3=pos(R+d,p2,th2).lerp(v0,q), v4=pos(R+d,p1,th2).lerp(v0,q);
      const ca=900*mapV(noise2D(2*seed+2.5*p0,0),-1,1,0,1)**8, cb2=200*mapV(noise2D(2*seed+9.5*p0,0),-1,1,0,1)**6;
      const br=cl((5+0.2*ca+0.8*cb2-(1-p0)*130)/255,0,1);
      for(const [a,b,c] of [[v0,v1,v2],[v0,v3,v2],[v0,v3,v4],[v0,v1,v4]]) for(const v of [a,b,c]){
        posArr[idx*3]=v.x*SC; posArr[idx*3+1]=v.y*SC; posArr[idx*3+2]=v.z*SC;
        colArr[idx*3]=br; colArr[idx*3+1]=br*1.05; colArr[idx*3+2]=br*0.75; idx++; }
    }}
  }
  build(P.fase??0);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(posArr,3));
  geo.setAttribute('color',new THREE.BufferAttribute(colArr,3));
  const cuerpo=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  cuerpo.rotation.set(Math.PI*0.9,Math.PI*0.65,0); cuerpo.frustumCulled=false;
  const figura=new THREE.Group(); figura.add(cuerpo); figura.scale.setScalar(P.escala??2);
  let fase=P.fase??0;
  const tick=(T,dt)=>{ fase+=dt*(P.velocidad??0.3); build(fase);
    geo.getAttribute('position').needsUpdate=true; geo.getAttribute('color').needsUpdate=true; };
  return {figura,tick};
}

// ——— Delaunay (anidado sobre triángulos o celdas Room; port CPU del salón) ———
function crearDelaunay(P){
  const rng=(s)=>()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^s>>>15,1|s); t=(t+Math.imul(t^t>>>7,61|t))^t; return ((t^t>>>14)>>>0)/4294967296; };
  const rr=rng((Math.round(P.semilla??1))>>>0);
  const xy=[-1,-1,1,-1,1,1,-1,1];
  for(let i=0;i<Math.round(P.puntos??40);i++) xy.push(rr()*2-1,rr()*2-1);
  const del=new Delaunator(xy), tri=del.triangles, half=del.halfedges, nTri=tri.length/3;
  const dst=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
  // Parches: triángulos directos, o el teselado dual de Room (quad entre centros
  // de triángulos vecinos + extremos de la arista, partido en 2 sub-triángulos).
  const parches=[]; let maxSize=0;
  if((P.trama??1)!==0){
    const cX=new Float32Array(nTri), cY=new Float32Array(nTri);
    for(let t=0;t<nTri;t++){ const a=tri[t*3],b=tri[t*3+1],d=tri[t*3+2];
      cX[t]=(xy[a*2]+xy[b*2]+xy[d*2])/3; cY[t]=(xy[a*2+1]+xy[b*2+1]+xy[d*2+1])/3; }
    for(let e=0;e<tri.length;e++){ const o=half[e]; if(o<0||e>o) continue;
      const tA=(e/3)|0,tB=(o/3)|0,u=tri[e],v=tri[e%3===2?e-2:e+1];
      const ux=xy[u*2],uy=xy[u*2+1],vx=xy[v*2],vy=xy[v*2+1];
      const gx=(cX[tA]+ux+cX[tB]+vx)/4, gy=(cY[tA]+uy+cY[tB]+vy)/4;
      const size=dst(cX[tA],cY[tA],ux,uy)+dst(ux,uy,cX[tB],cY[tB])+dst(cX[tB],cY[tB],vx,vy)+dst(vx,vy,cX[tA],cY[tA]);
      if(size>maxSize) maxSize=size;
      parches.push({ax:cX[tA],ay:cY[tA],bx:ux,by:uy,cx:cX[tB],cy:cY[tB],gx,gy,size});
      parches.push({ax:cX[tA],ay:cY[tA],bx:cX[tB],by:cY[tB],cx:vx,cy:vy,gx,gy,size});
    }
  } else {
    for(let t=0;t<nTri;t++){ const a=tri[t*3],b=tri[t*3+1],d=tri[t*3+2];
      const ax=xy[a*2],ay=xy[a*2+1],bx=xy[b*2],by=xy[b*2+1],cx=xy[d*2],cy=xy[d*2+1];
      const gx=(ax+bx+cx)/3, gy=(ay+by+cy)/3;
      const size=dst(ax,ay,bx,by)+dst(bx,by,cx,cy)+dst(cx,cy,ax,ay);
      if(size>maxSize) maxSize=size;
      parches.push({ax,ay,bx,by,cx,cy,gx,gy,size});
    }
  }
  maxSize=maxSize||1;
  const M=()=>new THREE.Matrix4();
  const cubo=[M().setPosition(0,0,1),M().makeRotationX(Math.PI).setPosition(0,0,-1),
    M().makeRotationY(Math.PI/2).setPosition(1,0,0),M().makeRotationY(-Math.PI/2).setPosition(-1,0,0),
    M().makeRotationX(-Math.PI/2).setPosition(0,1,0),M().makeRotationX(Math.PI/2).setPosition(0,-1,0)];
  const caras=P.figura===1?cubo.filter((_,i)=>i!==Math.round(P.caraOff??-1)):[M()];
  const niveles=Math.max(1,Math.round(P.anidado??8)), umbral=Math.max(0,P.umbral??0.05);
  const lv=parches.map(q=>umbral>0?Math.max(1,Math.min(niveles,Math.round(q.size/(umbral*3)))):niveles);
  const V=lv.reduce((a,b)=>a+b,0)*caras.length*3;
  const posArr=new Float32Array(V*3), colC=new Float32Array(V*4), colA=new Float32Array(V*4);
  const room=(P.rellenoCaras??1)===1, amp=P.ampDeg??0.7, w=new THREE.Vector3();
  const c1=new THREE.Color(P.color??0x8ab4ff), c2=new THREE.Color(P.color2??0xff5a8c);
  const luz=new THREE.Color(P.colorRelleno??0xf0faec), som=new THREE.Color(P.colorSombra??0x000000);
  function build(t){ let k=0;
    for(const m of caras) for(let i=0;i<parches.length;i++){ const q=parches[i], sz=q.size/maxSize, mm=lv[i];
      for(let l=0;l<mm;l++){
        const s=(P.modoEsc??1)===1?1/(l+1):1-l/mm;
        const ang=l*(P.giro??0)+t*(P.velGiro??0), ca=Math.cos(ang), sa=Math.sin(ang);
        const z=l*(P.sepZ??0.03)*(P.extrude===1?-1:1);
        // Paleta: degradado estructural o luz/sombra Room + contorno cálido.
        const f=cl(l/mm,0,1)*amp, dA=1-cl(l/mm,0,1)*0.8;
        const dR=c1.r+(c2.r-c1.r)*f, dG=c1.g+(c2.g-c1.g)*f, dB=c1.b+(c2.b-c1.b)*f;
        const cN=(1-s)*0.7+(sz*0.8/s)*0.3, fill=cl(s-cN,0,1);
        const fR=room?som.r+(luz.r-som.r)*fill:dR, fG=room?som.g+(luz.g-som.g)*fill:dG, fB=room?som.b+(luz.b-som.b)*fill:dB;
        const aR=room?cl(s*0.1+cN*0.5,0,1):dR, aG=room?cl(cN*s,0,1):dG, aB=room?cl(cN*s-cN/3,0,1):dB;
        for(const [px,py] of [[q.ax,q.ay],[q.bx,q.by],[q.cx,q.cy]]){
          const rx=(px-q.gx)*s, ry=(py-q.gy)*s;
          w.set(rx*ca-ry*sa+q.gx, rx*sa+ry*ca+q.gy, z).applyMatrix4(m);
          posArr[k*3]=w.x; posArr[k*3+1]=w.y; posArr[k*3+2]=w.z;
          colC[k*4]=fR; colC[k*4+1]=fG; colC[k*4+2]=fB; colC[k*4+3]=room?1:dA;
          colA[k*4]=aR; colA[k*4+1]=aG; colA[k*4+2]=aB; colA[k*4+3]=room?0.32:dA;
          k++;
        }
      }
    }
  }
  build(0);
  const attrPos=new THREE.BufferAttribute(posArr,3);
  const gC=new THREE.BufferGeometry(); gC.setAttribute('position',attrPos); gC.setAttribute('color',new THREE.BufferAttribute(colC,4));
  const gA=new THREE.BufferGeometry(); gA.setAttribute('position',attrPos); gA.setAttribute('color',new THREE.BufferAttribute(colA,4));
  const mCaras=new THREE.Mesh(gC,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,side:THREE.DoubleSide,depthWrite:room}));
  const mAlam=new THREE.Mesh(gA,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,wireframe:true,depthWrite:false}));
  const pts=new THREE.Points(gA,new THREE.PointsMaterial({vertexColors:true,transparent:true,size:(P.puntoTam??1.5)*0.02,sizeAttenuation:true}));
  const vista=P.vista??1;
  mCaras.visible=vista===2||vista===3;
  mAlam.visible=vista===1||vista===3||(vista===2&&room); // en Room el contorno acompaña a las caras
  pts.visible=vista===0;
  mCaras.renderOrder=1; mAlam.renderOrder=2;
  const figura=new THREE.Group();
  for(const o of [mCaras,mAlam,pts]){ o.frustumCulled=false; figura.add(o); }
  figura.scale.setScalar(P.escala??2);
  const tick=(P.velGiro??0)>0?(T)=>{ build(T); attrPos.needsUpdate=true; }:null;
  return {figura,tick};
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
  if (actor.salon === 'delaunay') {
    const d = crearDelaunay(P);
    aplicarActor(actor, d.figura);
    animados.push({ figura: d.figura, giro: 0, tick: d.tick });
    continue;
  }
  if (actor.salon === 'supershapes' && (P.modo ?? 0) === 2) {
    const s = crearSerpiente(P);
    aplicarActor(actor, s.figura);
    animados.push({ figura: s.figura, giro: P.giro ?? 0, tick: s.tick });
    continue;
  }
  if (actor.salon !== 'supershapes' || (P.modo ?? 0) === 3) {
    console.warn('Exportación parcial: este actor aún no tiene reproductor autónomo:', actor.nombre, actor.salon, P.modo);
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
const reloj = new THREE.Clock(); let T = 0;
r.setAnimationLoop(()=>{
  const dt = reloj.getDelta(); T += dt;
  raiz.rotation.y += E.giro*dt;
  for (const a of animados){ a.figura.rotation.y += a.giro*dt; if (a.tick) a.tick(T, dt); }
  ctl.update(); r.render(escena,cam);
});
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth,innerHeight); });
</script></body></html>`;
