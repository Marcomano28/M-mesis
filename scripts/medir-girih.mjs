import { build } from 'esbuild';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
const b=await build({stdin:{contents:"export { CaracolVivo } from './src/salones/supershapes/CaracolVivo'; export { crearGirih } from './src/vestuario/Girih';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',write:false});
const {CaracolVivo,crearGirih}=await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const filas=[];
for(const n of [1,4,8,16]) {
 const actores=Array.from({length:n},()=>{const a=new CaracolVivo();a.vestuario.restaurar({version:1,capas:[]});a.desarrollo=1;return a;});
 const prendas=actores.map(a=>crearGirih(a.cuerpo)), tiempos=[];
 const capa={id:'girih',intensidad:1,detalle:.6,parametros:{angulo:75,delta:10,longitudinal:50,transversal:18,cerrar:0}};
 for(let f=0;f<90;f++) {
  for(const a of actores){if(f%30===0)a.tejido.tocar(.77,.3,5);a.tejido.avanzar(1/60);a.actualizar();}
  const t=performance.now();for(const p of prendas)p.actualizar(capa,1/60,false);if(f>=30)tiempos.push(performance.now()-t);
 }
 tiempos.sort((a,b)=>a-b);filas.push({actores:n,p50:tiempos[30],p95:tiempos[57]});
 for(const p of prendas)p.dispose();for(const a of actores)a.dispose();
}
const resultado={fecha:new Date().toISOString(),cpu:cpus()[0]?.model,node:process.version,metodo:'Hankin regular en shader; ocho rayos compartidos por celda',alcance:'CPU incremental del Girih con cuerpo en evolución, excluye anatomía, render y GPU; no mide FPS ni compara Java con JS.',celdas:[50,18],calentamiento:30,muestras:60,repeticiones:1,filas};
console.log(JSON.stringify(resultado,null,2));await writeFile('MEDICION_GIRIH.json',JSON.stringify(resultado,null,2)+'\n');
