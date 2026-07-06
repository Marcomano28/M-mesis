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
import type { Salon, Params, ParamDef, FichaParaSalon } from '../../core/Salon';

interface Transform { x: number; y: number; z: number; rotY: number; escala: number }

interface ActorDef {
  ficha: FichaParaSalon;
  transform: Transform;
}

interface ActorVivo {
  def: ActorDef;
  salon: Salon;
  envoltura: THREE.Group;
  folder: { dispose(): void };
}

export class EscenarioSalon implements Salon {
  id = 'escenario';
  nombre = 'El Escenario';

  params: ParamDef[] = [
    { clave: 'giro', etiqueta: 'giro global', valor: 0, min: -1, max: 1 },
  ];

  private raiz = new THREE.Group();
  private defs: ActorDef[] = [];      // persiste aunque salgas del escenario
  private vivos: ActorVivo[] = [];    // actores montados (solo mientras está activo
  private escena: THREE.Scene | null = null;
  private camara!: THREE.PerspectiveCamera;
  private pane: Pane | null = null;
  private contenedor: HTMLDivElement | null = null;

  /** fábricas: salonId → cómo crear una instancia nueva de ese salón. */
  constructor(private fabricas: Record<string, () => Salon>) {}

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

    // Re-montar lo que ya estaba compuesto
    for (const def of this.defs) this.montar(def);
  }

  recibirFicha(ficha: FichaParaSalon): void {
    const def: ActorDef = {
      ficha: { salonId: ficha.salonId, nombre: ficha.nombre, params: { ...ficha.params } },
      transform: { x: 0, y: 0, z: 0, rotY: 0, escala: 1 },
    };
    this.defs.push(def);
    if (this.escena) this.montar(def);
  }

  private montar(def: ActorDef): void {
    const fabrica = this.fabricas[def.ficha.salonId];
    if (!fabrica || !this.pane) {
      console.error(`El Escenario no tiene fábrica para el salón «${def.ficha.salonId}».`);
      return;
    }
    try {
      const salon = fabrica();
      const envoltura = new THREE.Group();
      salon.init(envoltura as unknown as THREE.Scene, this.camara);
      this.raiz.add(envoltura);

      const folder = (this.pane as Pane).addFolder({ title: def.ficha.nombre, expanded: false });
      const t = def.transform;
      folder.addBinding(t, 'x', { min: -8, max: 8, step: 0.01 });
      folder.addBinding(t, 'y', { min: -8, max: 8, step: 0.01 });
      folder.addBinding(t, 'z', { min: -8, max: 8, step: 0.01 });
      folder.addBinding(t, 'rotY', { label: 'rotación', min: -Math.PI, max: Math.PI, step: 0.01 });
      folder.addBinding(t, 'escala', { min: 0.05, max: 4, step: 0.01 });
      folder.addButton({ title: '✕ Quitar del escenario' }).on('click', () => this.quitar(def));

      this.vivos.push({ def, salon, envoltura, folder });
    } catch (err) {
      console.error(`No se pudo montar el actor «${def.ficha.nombre}»:`, err);
    }
  }

  private quitar(def: ActorDef): void {
    this.defs = this.defs.filter((d) => d !== def);
    const vivo = this.vivos.find((v) => v.def === def);
    if (vivo) this.desmontar(vivo);
    this.vivos = this.vivos.filter((v) => v.def !== def);
  }

  private desmontar(vivo: ActorVivo): void {
    try {
      vivo.salon.dispose(vivo.envoltura as unknown as THREE.Scene);
    } catch (err) {
      console.error('Error al desmontar actor:', err);
    }
    this.raiz.remove(vivo.envoltura);
    vivo.folder.dispose();
  }

  update(dt: number, tiempo: number, p: Params): void {
    this.raiz.rotation.y += (p.giro ?? 0) * dt;
    for (const v of this.vivos) {
      v.salon.update(dt, tiempo, v.def.ficha.params);
      const t = v.def.transform;
      v.envoltura.position.set(t.x, t.y, t.z);
      v.envoltura.rotation.y = t.rotY;
      v.envoltura.scale.setScalar(t.escala);
    }
  }

  dispose(escena: THREE.Scene): void {
    for (const v of this.vivos) this.desmontar(v);
    this.vivos = [];
    escena.remove(this.raiz);
    this.pane?.dispose();
    this.contenedor?.remove();
    this.pane = null;
    this.contenedor = null;
    this.escena = null;
    // this.defs se conserva: la composición sigue ahí al volver
  }

  // ————— Escenas como fichas —————

  /** La partitura de la escena viaja dentro de la ficha (campo extra). */
  estadoExtra(): unknown {
    return { version: 1, actores: this.defs.map((d) => ({ ficha: d.ficha, transform: { ...d.transform } })) };
  }

  /** Restaura una escena guardada: reemplaza la composición actual. */
  cargarEstadoExtra(extra: unknown): void {
    const datos = extra as { actores?: { ficha: FichaParaSalon; transform: Transform }[] } | undefined;
    if (!datos?.actores) return;
    for (const v of this.vivos) this.desmontar(v);
    this.vivos = [];
    this.defs = datos.actores.map((a) => ({
      ficha: { salonId: a.ficha.salonId, nombre: a.ficha.nombre, params: { ...a.ficha.params } },
      transform: { ...a.transform },
    }));
    if (this.escena) for (const def of this.defs) this.montar(def);
  }

  // ————— Exportador: HTML autocontenido que reconstruye la escena —————
  // v1 soporta actores de Formas Exóticas (clásica y superflor) con sus
  // vistas y colores. Los salones con GLB (trazo/relieve) se omiten con aviso.

  exportar(p: Params): string {
    const escena = {
      giro: p.giro ?? 0,
      actores: this.defs.map((d) => ({
        salon: d.ficha.salonId,
        nombre: d.ficha.nombre,
        params: d.ficha.params,
        transform: d.transform,
      })),
    };
    return PLANTILLA_ESCENA.replaceAll('__ESCENA__', JSON.stringify(escena));
  }
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
for (const actor of E.actores){
  if (actor.salon !== 'supershapes'){
    console.warn('Export v1: actor omitido (salón con assets externos):', actor.nombre, actor.salon);
    continue;
  }
  const P = actor.params;
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
  const envoltura = new THREE.Group();
  const t = actor.transform;
  envoltura.position.set(t.x, t.y, t.z);
  envoltura.rotation.y = t.rotY;
  envoltura.scale.setScalar(t.escala);
  envoltura.add(figura);
  raiz.add(envoltura);
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
