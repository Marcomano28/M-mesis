import * as THREE from 'three/webgpu';
import { uv, uniform, vec2, float, fract, dot, length, max, min, clamp, smoothstep, dFdx, dFdy } from 'three/tsl';
import type { CuerpoVestible, Disfraz, Prenda } from './AlmacenDisfraces';

/** Tiling/edge.js: ocho rayos Hankin en un cuadrado de lado 1.
 * delta conserva las unidades del sketch (celda de 100); ángulo en grados.
 * Cada grupo de cuatro números contiene inicio.xy, fin.xy.
 */
export function motivoHankin(angulo: number, delta: number, salida = new Float64Array(32)): Float64Array {
  if (!Number.isFinite(angulo)||angulo<0||angulo>90||!Number.isFinite(delta)||delta<0||delta>25) throw new Error('Hankin fuera de rango');
  const theta=angulo*Math.PI/180, separacion=delta/100;
  const largo=(.5+separacion)*Math.sin(Math.PI/4)/Math.sin(Math.PI-theta-Math.PI/4);
  const cs=Math.cos(theta)*largo, sn=Math.sin(theta)*largo;
  // Rotar el borde superior a los otros tres lados, sin resolver intersecciones 3D.
  for(let lado=0;lado<4;lado++)for(let rayo=0;rayo<2;rayo++) {
    let ax=.5+(rayo===0?separacion:-separacion), ay=0;
    let bx=ax+(rayo===0?-cs:cs), by=sn;
    for(let giro=0;giro<lado;giro++) {const x=ax;ax=1-ay;ay=x;const y=bx;bx=1-by;by=y;}
    const i=(lado*2+rayo)*4;salida[i]=ax;salida[i+1]=ay;salida[i+2]=bx;salida[i+3]=by;
  }
  return salida;
}

export function crearGirih(cuerpo: CuerpoVestible): Prenda {
  const geometria=cuerpo.malla!;
  const position=geometria?.getAttribute('position'), coords=geometria?.getAttribute('uv');
  if(!position||!coords||coords.itemSize!==2||coords.count!==position.count) throw new Error('Girih requiere malla con UV compatibles');
  const reticula=uniform(new THREE.Vector2(50,18)), grosor=uniform(2), presencia=uniform(1);
  const segmentos=Array.from({length:8},()=>uniform(new THREE.Vector4()));
  const pGlobal=uv().mul(reticula), p=fract(pGlobal);
  // Derivar antes de fract evita franjas de antialias en los límites de celda.
  const dx=dFdx(pGlobal), dy=dFdy(pGlobal);
  let distancia=min(float(1e6),float(1e6));
  for(const segmento of segmentos) {
    const a=segmento.xy, ab=segmento.zw.sub(a), ap=p.sub(a);
    const t=clamp(dot(ap,ab).div(max(dot(ab,ab),1e-12))), residuo=ap.sub(ab.mul(t));
    const d=length(residuo), normal=residuo.div(max(d,1e-8));
    // Distancia en píxeles: compensa la anisotropía de la proyección para el grosor.
    const pixel=max(length(vec2(dot(dx,normal),dot(dy,normal))),1e-6);
    distancia=min(distancia,d.div(pixel));
  }
  const cobertura=float(1).sub(smoothstep(grosor.mul(.5).sub(.5),grosor.mul(.5).add(.5),distancia));
  const material=new THREE.MeshBasicNodeMaterial({color:new THREE.Color('rgb(248,158,79)'),transparent:true,
    depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,alphaTest:.001});
  material.opacityNode=cobertura.mul(presencia);
  const objeto=new THREE.Mesh(geometria,material);objeto.renderOrder=1;
  // La malla es prestada. No asumir cotas de adaptadores deformados solo en GPU.
  objeto.frustumCulled=!!cuerpo.atributoEstado;
  const patron=new Float64Array(32);let anteriorAngulo=NaN,anteriorDelta=NaN;
  return {objeto,actualizar(c) {
    const angulo=c.parametros?.angulo??75, delta=c.parametros?.delta??10;
    reticula.value.set(Math.round(c.parametros?.longitudinal??50),Math.round(c.parametros?.transversal??18));
    grosor.value=.5+c.detalle*2.5;presencia.value=c.intensidad;
    objeto.visible=cuerpo.desarrollo>.001&&c.intensidad>0;
    if(angulo!==anteriorAngulo||delta!==anteriorDelta) {
      motivoHankin(angulo,delta,patron);
      for(let i=0;i<8;i++)segmentos[i].value.fromArray(patron,i*4);
      anteriorAngulo=angulo;anteriorDelta=delta;
    }
  },dispose(){material.dispose();}};
}

export const disfrazGirih: Disfraz={
  id:'girih',nombre:'Girih · Moro',
  descripcion:'Trama Hankin regular, construida en cada celda y adherida a la piel. Ángulo y separación transforman el motivo; puede combinarse con Nácar.',
  control:'Grosor del trazo',detalleInicial:.6,
  controles:[
    {clave:'angulo',nombre:'Ángulo (grados)',min:0,max:90,paso:1,valor:75},
    {clave:'delta',nombre:'Separación · delta',min:0,max:25,paso:.5,valor:10},
    {clave:'longitudinal',nombre:'Celdas longitudinales',min:8,max:100,paso:1,valor:50},
    {clave:'transversal',nombre:'Celdas transversales',min:4,max:48,paso:1,valor:18},
    // Compatibilidad con instantes del primer port: se acepta, pero no pertenece al método Hankin.
    {clave:'cerrar',nombre:'Contorno anterior',min:0,max:1,paso:1,valor:0,oculto:true},
  ],
  requiere:['malla'],crear:crearGirih,
};
