/** Islamic Interweavings II, mla, 2026 — port del visor Girih-2 a TSL.
 * Se conserva la secuencia A/B/C y la paridad por iteración del visor suministrado.
 */
import * as THREE from 'three/webgpu';
import { Fn, If, Loop, Break, bool, float, vec2, vec3, vec4, uv, uniform, texture, mod, sub, dot, length, max, min, abs, clamp, mix, smoothstep, fwidth } from 'three/tsl';
import type { CuerpoVestible, Disfraz, Prenda } from './AlmacenDisfraces';
import { adquirirTexturaGirih2 } from './TexturaGirih2';

/** Referencia numérica del plegado para comprobar dominio y límite de iteraciones. */
export function plegarGirih2(x: number,y: number,k: number,repetir=true,plegar=true): {x:number;y:number;pasos:number} {
  if(repetir){x=((x+1)%2+2)%2-1;y=((y+1)%2+2)%2-1;}
  let pasos=0;
  if(plegar)for(;pasos<100;pasos++) {
    let cambio=false;
    if(y<0){y=-y;cambio=true;}
    const d=k-x-k*y;
    if(d<0){const t=2*d/(1+k*k);x+=t;y+=t*k;cambio=true;}
    if(x<0){x=-x;cambio=true;}
    if(!cambio)break;
  }
  return {x,y,pasos};
}

export function crearGirih2(cuerpo: CuerpoVestible): Prenda {
  const geometria=cuerpo.malla!,p=geometria?.getAttribute('position'),coord=geometria?.getAttribute('uv');
  if(!p||!coord||coord.itemSize!==2||coord.count!==p.count)throw new Error('Girih II requiere malla con UV compatibles');
  const fondo=adquirirTexturaGirih2();
  const zoom=uniform(3.5),k=uniform(1),punto=uniform(new THREE.Vector2(.309,.951));
  const colorFondo=uniform(.2);
  const grosor=uniform(.05),drift=uniform(0),plegado=uniform(1),repeticion=uniform(1),bordes=uniform(1);
  const invertir=uniform(0),swapX=uniform(0),swapY=uniform(0);
  const color=Fn(()=>{
    const original=uv().mul(2).sub(1).mul(zoom);
    const px=max(fwidth(length(original)),1e-5);
    const z=original.toVar(),paridad=float(0).toVar();
    If(repeticion.greaterThan(.5),()=>{z.assign(mod(z.add(1),2).sub(1));});
    If(plegado.greaterThan(.5),()=>{
      Loop(100,()=>{
        const cambio=bool(false).toVar();
        If(z.y.lessThan(0),()=>{z.y.assign(z.y.negate());cambio.assign(bool(true));});
        const d=k.sub(z.x).sub(k.mul(z.y)).toVar();
        If(d.lessThan(0),()=>{z.addAssign(vec2(1,k).mul(d.mul(2).div(k.mul(k).add(1))));cambio.assign(bool(true));});
        If(z.x.lessThan(0),()=>{z.x.assign(z.x.negate());cambio.assign(bool(true));});
        If(cambio.not(),()=>{Break();});
        paridad.assign(float(1).sub(paridad));
      });
    });
    If(invertir.greaterThan(.5),()=>{paridad.assign(float(1).sub(paridad));});
    const col=texture(fondo.textura,z.add(vec2(drift,drift.mul(.618)))).rgb.pow(2.2).toVar();
    // Atenuar solo el fondo antes de dibujar bordes y cintas: no cambia los cruces.
    col.assign(mix(vec3(.018,.023,.02),col,colorFondo));
    If(bordes.greaterThan(.5),()=>{
      const d=min(abs(k.mul(z.y)),min(abs(k.sub(z.x).sub(k.mul(z.y))),abs(z.x)));
      col.assign(mix(vec3(.5),col,smoothstep(0,px,d)));
    });
    const ancho=grosor.mul(float(1).add(length(texture(fondo.textura,z).rgb).mul(.1)));
    const pa=vec2(punto.x,punto.y.negate());
    const pb=punto.add(vec2(1,k).mul(k.sub(punto.x).sub(k.mul(punto.y)).mul(2).div(k.mul(k).add(1))));
    const q=vec2(0),s=vec2(k.mul(.618),.382);
    const distancia=(a:THREE.Node,b:THREE.Node)=>{
      const ba=sub(b,a),v=z.sub(a),t=clamp(dot(v,ba).div(max(dot(ba,ba),1e-12)));
      return length(v.sub(ba.mul(t)));
    };
    const d=vec4(distancia(pa,q),distancia(punto,q),
      distancia(pb,s),distancia(punto,s)).toVar();
    If(swapX.greaterThan(.5),()=>{d.assign(d.yxzw);});
    If(swapY.greaterThan(.5),()=>{d.assign(d.xywz);});
    If(paridad.greaterThan(.5),()=>{d.assign(d.wzyx);});
    for(const distancia of [d.x,d.y,d.z,d.w]) {
      col.assign(mix(vec3(.01),col,smoothstep(0,px,distancia.sub(ancho))));
      col.assign(mix(vec3(1),col,smoothstep(0,px,abs(distancia.sub(ancho)))));
    }
    return col;
  })();
  const material=new THREE.MeshBasicNodeMaterial({transparent:true,side:THREE.DoubleSide,forceSinglePass:true,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.colorNode=color;
  const objeto=new THREE.Mesh(geometria,material);objeto.renderOrder=1;objeto.frustumCulled=!!cuerpo.atributoEstado;
  return {objeto,actualizar(c){
    const a=c.parametros??{};
    colorFondo.value=a.colorFondo??.2;
    zoom.value=a.zoom??3.5;k.value=(a.grupo??0)>=.5?Math.sqrt(3):1;
    punto.value.set(a.puntoX??.309,a.puntoY??.951);grosor.value=.01+c.detalle*.14;drift.value=a.desplazamiento??0;
    plegado.value=a.plegado??1;repeticion.value=a.repeticion??1;bordes.value=a.bordes??1;
    invertir.value=a.invertir??0;swapX.value=a.cruceX??0;swapY.value=a.cruceY??0;
    material.opacity=c.intensidad;material.depthWrite=c.intensidad>.98;
    objeto.visible=cuerpo.desarrollo>.001&&c.intensidad>0;
  },dispose(){material.dispose();fondo.liberar();}};
}

const siNo=[{nombre:'No',valor:0},{nombre:'Sí',valor:1}];
export const disfrazGirih2: Disfraz={id:'girih2',nombre:'Girih II · Trenzado',
  descripcion:'Cintas entrelazadas y fondo de manchas: simetría cuadrada o hexagonal, con cruces alternados. Viste la piel completa.',
  control:'Grosor del hilo',detalleInicial:2/7,requiere:['malla'],crear:crearGirih2,
  controles:[
    {clave:'grupo',nombre:'Simetría',min:0,max:1,paso:1,valor:0,opciones:[{nombre:'Cuadrada · 2,4,4',valor:0},{nombre:'Hexagonal · 2,3,6',valor:1}]},
    {clave:'puntoX',nombre:'Origen del trenzado · X',min:-2,max:2,paso:.001,valor:.309},
    {clave:'puntoY',nombre:'Origen del trenzado · Y',min:-2,max:2,paso:.001,valor:.951},
    {clave:'zoom',nombre:'Escala del patrón',min:.25,max:32,paso:.05,valor:3.5},
    {clave:'colorFondo',nombre:'Color del fondo',min:0,max:1,paso:.01,valor:.2},
    {clave:'desplazamiento',nombre:'Desplazamiento de textura',min:-3,max:3,paso:.01,valor:0},
    ...[{clave:'bordes',nombre:'Bordes de celda',valor:1},{clave:'invertir',nombre:'Invertir el tejido',valor:0},
      {clave:'cruceX',nombre:'Intercambiar primer par',valor:0},{clave:'cruceY',nombre:'Intercambiar segundo par',valor:0},
      {clave:'plegado',nombre:'Plegado',valor:1},{clave:'repeticion',nombre:'Repetición',valor:1}]
      .map(c=>({...c,min:0,max:1,paso:1,opciones:siNo})),
  ]};
