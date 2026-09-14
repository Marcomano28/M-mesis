import * as THREE from 'three/webgpu';

/** Fondo determinista del visor Girih-2: gradiente y 46 manchas suaves.
 * Raster propio sin DOM; una textura compartida entre los actores que la usan.
 */
let recurso: THREE.DataTexture | undefined;
let usuarios=0;
export function adquirirTexturaGirih2(): { textura: THREE.DataTexture; liberar(): void } {
  if(!recurso) {
    const n=512, datos=new Uint8Array(n*n*4);
    const colores=[[209,161,90],[240,195,116],[95,224,214],[138,106,58],[201,106,78]];
    const fondo=[[23,19,16],[58,44,24],[11,9,8]];
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const t=(x+y+1)/(2*n), tramo=t<.55?0:1, f=tramo===0?t/.55:(t-.55)/.45;
      const i=(y*n+x)*4;
      for(let k=0;k<3;k++)datos[i+k]=Math.round(fondo[tramo][k]*(1-f)+fondo[tramo+1][k]*f);
      datos[i+3]=255;
    }
    let seed=1234567;
    const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
    for(let j=0;j<46;j++) {
      const cx=rnd()*n,cy=rnd()*n,r=16+rnd()*68,alpha=.45+rnd()*.35,c=colores[j%colores.length];
      for(let y=Math.max(0,Math.floor(cy-r));y<Math.min(n,Math.ceil(cy+r));y++)
        for(let x=Math.max(0,Math.floor(cx-r));x<Math.min(n,Math.ceil(cx+r));x++) {
          const a=Math.max(0,1-Math.hypot(x+.5-cx,y+.5-cy)/r)*alpha,i=(y*n+x)*4;
          for(let k=0;k<3;k++)datos[i+k]=Math.round(datos[i+k]*(1-a)+c[k]*a);
        }
    }
    recurso=new THREE.DataTexture(datos,n,n,THREE.RGBAFormat);
    recurso.wrapS=recurso.wrapT=THREE.RepeatWrapping;
    recurso.magFilter=THREE.LinearFilter;recurso.minFilter=THREE.LinearMipmapLinearFilter;
    recurso.generateMipmaps=true;recurso.flipY=true;recurso.needsUpdate=true;
  }
  usuarios++;const textura=recurso;let liberada=false;
  return {textura,liberar(){if(liberada)return;liberada=true;if(--usuarios===0){textura.dispose();recurso=undefined;}}};
}
