import { build } from 'esbuild';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { cpus, platform, arch } from 'node:os';
import { CaracolVivo as Antes } from '../tests/referencia/vestuario-v1.mjs';
const b = await build({stdin:{contents:"export { CaracolVivo } from './src/salones/supershapes/CaracolVivo';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',write:false});
const { CaracolVivo: Despues } = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const frames = Number(process.env.MIA_BENCH_FRAMES ?? 120), repeticiones = 3;
const capas = ['nacar','alambre','puntos','punteado','peludo','corriente'].map(id=>({id,intensidad:1,detalle:.65}));
const resultados = [];
function cuantiles(a) { a.sort((x,y)=>x-y); return {p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]}; }
for (const n of [1,4,8,16]) {
  const tiempos = {antes:[],despues:[]};
  for (let r=0;r<repeticiones;r++) for(const [nombre,Clase] of (r%2 ? [['despues',Despues],['antes',Antes]] : [['antes',Antes],['despues',Despues]])) {
    const actores = Array.from({length:n},()=>new Clase());
    for(const a of actores) {a.desarrollo=1;a.vestuario.restaurar({version:1,capas});}
    for(let f=0;f<frames+30;f++) {
      const t=performance.now();
      for(const a of actores) {if(f%30===0)a.tejido.tocar(.77,.3,5);a.tejido.avanzar(1/60);a.actualizar(1/60);}
      if(f>=30)tiempos[nombre].push(performance.now()-t);
    }
    for(const a of actores)a.dispose();
  }
  const fila = {actores:n,antes:cuantiles(tiempos.antes),despues:cuantiles(tiempos.despues)};
  resultados.push(fila);console.log(JSON.stringify(fila));
}
const informe={fecha:new Date().toISOString(),entorno:{cpu:cpus()[0]?.model,plataforma:platform(),arquitectura:arch(),node:process.version},alcance:'CPU: tejido + geometría + seis prendas, sin renderer ni GPU. No mide FPS de escena.',frames,repeticiones,calentamiento:30,dt:1/60,capas,resultados};
await writeFile('MEDICION_VESTUARIO.json',JSON.stringify(informe,null,2)+'\n');
