/** Banco visual de desarrollo. No se importa en el taller ni en el build de index.html. */
import * as THREE from 'three/webgpu';
import { Engine } from '../core/Engine';
import { CaracolVivo } from '../salones/supershapes/CaracolVivo';
// @ts-expect-error Referencia JS congelada de la implementación previa; solo validación.
import { CaracolVivo as Referencia } from '../../tests/referencia/vestuario-v1.mjs';
const engine = new Engine(document.getElementById('lienzo')!);
await engine.init({ forceWebGL: new URLSearchParams(location.search).get('backend') === 'webgl', trackTimestamp: true });
engine.controles.enabled = false;
engine.escena.background = new THREE.Color('#101b18');
engine.renderer.setPixelRatio(1);
engine.escena.add(new THREE.HemisphereLight('#f5ead4','#214339',2));
const luz=new THREE.DirectionalLight('#ffe1c2',3);luz.position.set(2,4,5);engine.escena.add(luz);
const actores: CaracolVivo[] = [new Referencia(),new CaracolVivo()];
const estado=document.getElementById('estado')!;
let pausado=true, fase=0;
function vestir(id:string):void {
  const ids=id==='todas'?['nacar','alambre','puntos','punteado','peludo','corriente']:[id];
  for(const a of actores) {a.vestuario.restaurar({version:1,capas:ids.map(id=>({id,intensidad:1,detalle:.65}))});a.actualizar();}
}
for (const [i,a] of actores.entries()) {
  a.desarrollo=1;a.tejido.tocar(.77,.3,5);
  for(let j=0;j<60;j++)a.tejido.avanzar(1/60);
  a.actualizar();a.grupo.scale.setScalar(.55);a.grupo.updateMatrixWorld(true);
  const centro=new THREE.Box3().setFromObject(a.grupo).getCenter(new THREE.Vector3());
  a.grupo.position.copy(centro).negate();a.grupo.position.x+=(i===0?-2.4:2.4);
  engine.escena.add(a.grupo);
}
function encuadrar():void {engine.camara.position.set(0,0,Math.max(9,9/engine.camara.aspect));engine.camara.lookAt(0,0,0);}
encuadrar();addEventListener('resize',encuadrar);vestir('nacar');
document.getElementById('prenda')!.addEventListener('change',e=>vestir((e.target as HTMLSelectElement).value));
document.getElementById('pausa')!.addEventListener('click',e=>{pausado=!pausado;(e.target as HTMLElement).textContent=pausado?'Continuar':'Pausar';});
document.getElementById('diagnostico')!.addEventListener('click',()=>{for(const a of actores){a.revelarTejido=!a.revelarTejido;a.actualizar();}});
document.getElementById('quitar')!.addEventListener('click',()=>{
  for(let n=0;n<10;n++) for(const a of actores) {const traje=a.vestuario.guardar();a.vestuario.restaurar({version:1,capas:[]});a.vestuario.restaurar(traje);a.actualizar();}
  estado.textContent='Diez ciclos de retirada y reposición completados';
});
const tick = () => {
  if(!pausado){fase++;for(const a of actores){if(fase%90===0)a.tejido.tocar(.77,.3,5);a.tejido.avanzar(1/60);a.actualizar(1/60);}}
};
engine.arrancar(tick);
estado.textContent='Listo · estado inicial idéntico · pausa';
addEventListener('pagehide',()=>{engine.renderer.setAnimationLoop(null);for(const a of actores)a.dispose();engine.renderer.dispose();});


const controles = [...document.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button,select')];
const salida = document.getElementById('resultados')!;
let ocupado = false;
async function exclusivo(fn: () => Promise<void>): Promise<void> {
  if (ocupado) return;
  ocupado = true; engine.renderer.setAnimationLoop(null);
  controles.forEach(c => c.disabled = true);
  try { await fn(); } catch (e) { estado.textContent = `Error: ${String(e)}`; }
  finally { controles.forEach(c => c.disabled = false); ocupado = false; engine.arrancar(tick); }
}
// Lectura síncrona solo para QA WebGL: evita depender de RAF para resolver fences
// en pestañas de inspección. El target del banco es RGBA/UnsignedByte, sin MSAA.
async function leerPixeles(target: THREE.RenderTarget, ancho: number, alto: number): Promise<Uint8Array> {
  const backend = engine.renderer.backend as unknown as {
    isWebGLBackend?: boolean;
    get(texture: THREE.Texture): { textureGPU: WebGLTexture };
  };
  if (!backend.isWebGLBackend)
    return new Uint8Array(await engine.renderer.readRenderTargetPixelsAsync(target, 0, 0, ancho, alto));
  const gl = engine.renderer.getContext() as unknown as WebGL2RenderingContext;
  const previo = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
  const fb = gl.createFramebuffer();
  try {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, backend.get(target.texture).textureGPU, 0);
    if (gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Target WebGL incompleto');
    const datos = new Uint8Array(ancho * alto * 4);
    gl.readPixels(0, 0, ancho, alto, gl.RGBA, gl.UNSIGNED_BYTE, datos);
    return datos;
  } finally { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previo); gl.deleteFramebuffer(fb); }
}
// Validación GPU fuera del bucle: mismo encuadre y luz, dos renders al mismo target.
async function compararPixeles() {
  const target = new THREE.RenderTarget(256,256,{type:THREE.UnsignedByteType});
  const camara=engine.camara.clone();camara.aspect=1;camara.position.set(0,0,6);camara.lookAt(0,0,0);camara.updateProjectionMatrix();
  const posiciones=actores.map(a=>a.grupo.position.clone());
  const visibles=actores.map(a=>a.grupo.visible);
  const previo=engine.renderer.getRenderTarget();
  try {
    const imagenes: Uint8Array[]=[];
    for(let i=0;i<2;i++) {
      for(let j=0;j<2;j++)actores[j].grupo.visible=i===j;
      actores[i].grupo.position.x-=i===0?-2.4:2.4;
      engine.renderer.setRenderTarget(target);engine.renderer.render(engine.escena,camara);
      imagenes.push(await leerPixeles(target,256,256));
      actores[i].grupo.position.copy(posiciones[i]);
    }
    let suma=0,maximo=0,distintos=0;
    for(let i=0;i<imagenes[0].length;i++) {
      const d=Math.abs(imagenes[0][i]-imagenes[1][i]);suma+=d;maximo=Math.max(maximo,d);if(d>1)distintos++;
    }
    return {media:suma/imagenes[0].length,maximo,canalesMayorQueUno:distintos};
  } finally {
    for(let i=0;i<2;i++){actores[i].grupo.position.copy(posiciones[i]);actores[i].grupo.visible=visibles[i];}
    engine.renderer.setRenderTarget(previo);target.dispose();
  }
}
document.getElementById('comparar')!.addEventListener('click',()=>void exclusivo(async()=>{
  const r=await compararPixeles();estado.textContent=`GPU 256×256 · media ${r.media.toFixed(6)}/255 · máxima ${r.maximo} · canales >1: ${r.canalesMayorQueUno}`;
}));
document.getElementById('suite')!.addEventListener('click',()=>void exclusivo(async()=>{
  const filas=[];
  const originales=actores.map(a=>({tejido:a.tejido.guardar(),traje:a.vestuario.guardar(),edad:a.desarrollo,diagnostico:a.revelarTejido}));
  try {
    for(const edad of [.18,.6,1]) for(const id of ['nacar','alambre','todas']) {
      vestir(id);
      for(const a of actores){a.desarrollo=edad;a.revelarTejido=false;a.actualizar();}
      for(let j=0;j<10;j++)for(const a of actores){const t=a.vestuario.guardar();a.vestuario.restaurar({version:1,capas:[]});a.vestuario.restaurar(t);a.actualizar();}
      const r=await compararPixeles();filas.push({edad,id,...r});estado.textContent=`Validado ${edad} / ${id}`;
    }
    for(const a of actores){a.desarrollo=1;a.revelarTejido=true;a.actualizar();}
    vestir('nacar');filas.push({edad:1,id:'diagnostico',...await compararPixeles()});
    salida.textContent=JSON.stringify({backend:new URLSearchParams(location.search).get('backend')??'webgpu',tipo:'equivalencia',resolucion:[256,256],filas},null,2);
    estado.textContent='Validación completa · 10 comparaciones';
  } finally {
    actores.forEach((a,i)=>{const o=originales[i];a.tejido.restaurar(o.tejido);a.desarrollo=o.edad;a.revelarTejido=o.diagnostico;a.vestuario.restaurar(o.traje);a.actualizar();});
  }
}));
function percentiles(a:number[]) {a.sort((x,y)=>x-y);return a.length?{p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]}:null;}
document.getElementById('medir')!.addEventListener('click',()=>void exclusivo(async()=>{
  const target=new THREE.RenderTarget(640,360,{type:THREE.UnsignedByteType});
  const camara=new THREE.PerspectiveCamera(50,640/360,.1,100);camara.position.set(0,0,12);
  const filas=[];const previo=engine.renderer.getRenderTarget();
  try {
    for(const n of [1,4,8,16]) for(const [nombre,Clase] of [['antes',Referencia],['despues',CaracolVivo]] as const) {
      estado.textContent=`Midiendo ${nombre}: ${n} actores`;
      const escena=new THREE.Scene();escena.background=new THREE.Color('#101b18');
      escena.add(new THREE.HemisphereLight('#f5ead4','#214339',2));
      const luz=new THREE.DirectionalLight('#ffe1c2',3);luz.position.set(2,4,5);escena.add(luz);
      const elenco:CaracolVivo[]=[];
      const cpu:number[]=[],total:number[]=[],gpu:number[]=[];let draws=0;
      try {
        for(let i=0;i<n;i++) {
          const a:CaracolVivo=new Clase();a.desarrollo=1;a.actualizar();
          a.vestuario.restaurar({version:1,capas:['nacar','alambre','puntos','punteado','peludo','corriente'].map(id=>({id,intensidad:1,detalle:.65}))});
          a.grupo.scale.setScalar(.32);a.grupo.position.set((i%4-1.5)*1.6,(Math.floor(i/4)-1.5)*1.4,0);escena.add(a.grupo);elenco.push(a);
        }
        engine.renderer.setRenderTarget(target);
        await engine.renderer.compileAsync(escena,camara);
        await engine.renderer.resolveTimestampsAsync(); // Descarta mediciones anteriores.
        for(let f=0;f<30;f++) {
          const t=performance.now();
          for(const a of elenco){if(f%10===0)a.tejido.tocar(.77,.3,5);a.tejido.avanzar(1/60);a.actualizar(1/60);}
          const duracionCPU=performance.now()-t;
          engine.renderer.info.reset();
          engine.renderer.render(escena,camara);
          // Capturar antes de cualquier await: Animation puede resetear Info al siguiente RAF.
          draws=engine.renderer.info.render.drawCalls;
          // Lectura de 1 píxel fuerza finalización: mide frame serializado, no FPS de presentación.
          await leerPixeles(target,1,1);
          const duracionTotal=performance.now()-t;
          const tiempoGPU=await engine.renderer.resolveTimestampsAsync();
          if(f>=10){cpu.push(duracionCPU);total.push(duracionTotal);if(tiempoGPU!==undefined&&tiempoGPU>0)gpu.push(tiempoGPU);}
        }
        filas.push({actores:n,version:nombre,cpuMs:percentiles(cpu),frameSerializadoMs:percentiles(total),gpuMs:percentiles(gpu),drawCalls:draws});
      } finally {for(const a of elenco)a.dispose();}
      salida.textContent=JSON.stringify({tipo:'escena-diagnostica',backend:new URLSearchParams(location.search).get('backend')??'webgpu',resolucion:[640,360],dpr:1,muestras:20,calentamiento:10,nota:'Frame con sincronización y readback; no mide FPS de presentación. GPU null = no disponible.',filas},null,2);
    }
    estado.textContent='Medición completa · 1, 4, 8 y 16 actores';
  } finally {engine.renderer.setRenderTarget(previo);target.dispose();}
}));
