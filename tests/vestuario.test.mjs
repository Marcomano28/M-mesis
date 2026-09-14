import { CaracolVivo as CaracolReferencia } from './referencia/vestuario-v1.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { transformWithEsbuild } from 'vite';
const result = await build({ stdin: { contents: `export * from './src/vestuario/AlmacenDisfraces'; export * from './src/vestuario/Girih'; export * from './src/vestuario/Girih2'; export * from './src/vestuario/TexturaGirih2'; export * from './src/vestuario/disfraces'; export * from './src/salones/supershapes/CaracolVivo'; export * from './src/salones/supershapes/CaracolSalon'; export * from './src/core/DocumentoEscena'; export * from './src/salones/escenario/EscenarioSalon'; export * from './src/core/ParamBus'; export * as THREE from 'three/webgpu';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', loader: { '.css': 'empty' }, write: false });
const { plegarGirih2, adquirirTexturaGirih2, motivoHankin, Vestuario, almacenDisfraces, CaracolVivo, CaracolSalon, crearActorEscena, copiarFicha, EscenarioSalon, ParamBus, THREE } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('el catálogo viste una esfera ajena a Caracol y rechaza conexiones ausentes', () => {
  const malla = new THREE.SphereGeometry(1, 16, 12);
  const cuerpo = { semilla: 42, desarrollo: 1, malla,
    muestrear(u, v, m) { m.posicion.set(Math.sin(u * Math.PI) * Math.cos(v * 2 * Math.PI), Math.cos(u * Math.PI), Math.sin(u * Math.PI) * Math.sin(v * 2 * Math.PI)); m.normal.copy(m.posicion); m.tangente.set(1,0,0); m.excitacion = 0; m.memoria = 0; } };
  const v = new Vestuario(almacenDisfraces, cuerpo);
  for (const id of ['nacar', 'alambre', 'puntos', 'punteado', 'peludo']) v.configurar(id, 1);
  assert.equal(v.grupo.children.length, 5);
  assert.throws(() => v.configurar('corriente', 1), /no admite/);
  v.actualizar();
  for (const objeto of v.grupo.children) assert.ok([...objeto.geometry.getAttribute('position').array].every(Number.isFinite));
  let liberado = false; malla.addEventListener('dispose', () => liberado = true);
  v.dispose(); assert.equal(liberado, false); malla.dispose();
});

test('cambiar y combinar prendas conserva tejido, anatomía y pose; libera la prenda retirada', () => {
  const a = new CaracolVivo(); a.tejido.tocar(.6,.3,6); a.tejido.avanzar(.05); a.actualizar();
  const estado = a.tejido.guardar(), posiciones = [...a.superficie.geometry.getAttribute('position').array], pose = a.grupo.matrix.clone();
  const anterior = a.vestuario.grupo.children[0]; let liberado = false;
  anterior.material.addEventListener('dispose', () => liberado = true);
  a.vestuario.quitar('alambre'); a.vestuario.configurar('punteado', 1); a.vestuario.configurar('corriente', 1); a.actualizar(.03);
  assert.equal(liberado, true); assert.deepEqual(a.tejido.guardar(), estado);
  assert.deepEqual([...a.superficie.geometry.getAttribute('position').array], posiciones); assert.ok(a.grupo.matrix.equals(pose));
  a.dispose();
});

test('la corriente avanza, se pausa y recupera exactamente sus coordenadas', () => {
  const a = new CaracolVivo(); a.vestuario.configurar('corriente', 1);
  const inicial = a.vestuario.guardar(); a.actualizar(.05); const despues = a.vestuario.guardar();
  assert.notDeepEqual(inicial, despues); a.actualizar(0); assert.deepEqual(a.vestuario.guardar(), despues);
  a.vestuario.restaurar(inicial); assert.deepEqual(a.vestuario.guardar(), inicial);
  a.actualizar(.05); assert.deepEqual(a.vestuario.guardar(), despues); a.dispose();
});

test('restauración inválida es atómica y los actores no comparten estado de prendas', () => {
  const a = new CaracolVivo(), b = new CaracolVivo(); a.vestuario.configurar('corriente', 1);
  const previo = a.vestuario.guardar();
  const corrupto = structuredClone(previo); corrupto.capas.at(-1).estado = [NaN];
  assert.throws(() => a.vestuario.restaurar(corrupto), /incompatible/); assert.deepEqual(a.vestuario.guardar(), previo);
  assert.throws(() => a.vestuario.restaurar({version:1,capas:[previo.capas[0],previo.capas[0]]}), /inválida/);
  assert.equal(b.vestuario.guardar().capas.some(c => c.id === 'corriente'), false);
  a.dispose(); b.dispose();
});


test('camerino → ficha → actor → regreso conserva cuerpo y traje sin compartir instancias', () => {
  const escena = new THREE.Scene(), camara = new THREE.PerspectiveCamera();
  const camerino = new CaracolSalon(); camerino.init(escena, camara);
  const params = Object.fromEntries(camerino.params.map(d => [d.clave, d.valor]));
  camerino.update(.04, 0, { ...params, estimulo: 1 });
  const vestido = camerino.estadoExtra();
  vestido.vestuario.capas = [{id:'corriente',intensidad:1,detalle:.6}, {id:'punteado',intensidad:1,detalle:.4}, {id:'girih',intensidad:1,detalle:.6,parametros:{angulo:45,delta:15,longitudinal:24,transversal:12,cerrar:0}}, {id:'girih2',intensidad:.8,detalle:.4,parametros:{grupo:1,puntoX:.2,puntoY:.7}}];
  camerino.cargarEstadoExtra(vestido); camerino.update(.04, 1, params);
  const ficha = {salonId:'caracol', nombre:'Actor', params, extra:camerino.estadoExtra(), hilos:camerino.hilosFicha};
  const def = crearActorEscena(ficha); def.transform.x = 2;
  const actor = new CaracolSalon(def.ficha.extra); actor.init(new THREE.Group(), camara); actor.update(0,0,params);
  assert.deepEqual(actor.estadoExtra(), ficha.extra);
  actor.update(.05,1,{...params,estimulo:1}); assert.notDeepEqual(actor.estadoExtra(), ficha.extra);
  camerino.dispose(escena); camerino.init(escena,camara); assert.deepEqual(camerino.estadoExtra(), ficha.extra);
  const copia = copiarFicha({...def.ficha,extra:actor.estadoExtra()});
  camerino.cargarEstadoExtra(copia.extra); assert.deepEqual(camerino.estadoExtra(), actor.estadoExtra());
  assert.equal(def.transform.x,2);
  const previo = camerino.estadoExtra();
  const corrupto = structuredClone(previo); corrupto.tejido.altura[0] = NaN;
  assert.throws(() => camerino.cargarEstadoExtra(corrupto)); assert.deepEqual(camerino.estadoExtra(), previo);
  camerino.dispose(escena); actor.dispose(escena);
});

test('el Escenario captura estado vivo y retoca conservando ID, composición y rutas válidas', () => {
  const bus = new ParamBus(), camara = new THREE.PerspectiveCamera();
  const c = new CaracolSalon(); c.init(new THREE.Group(),camara); c.update(.05,0,{estimulo:1});
  const ficha = {salonId:'caracol', nombre:'Actor', params:{desarrollo:1}, extra:c.estadoExtra(), hilos:c.hilosFicha};
  const def = crearActorEscena(ficha); def.transform.x = 3; const id = def.id;
  const ruta = {destino:`actor:${id}.param.desarrollo`, activa:true};
  const motores = {
    sinestesia:{desactivarDonde(fn){if(fn(ruta))ruta.activa=false;return 0;},refrescarDestinos(){}},
    lfo:{desactivarDonde(){return 0;},refrescarDestinos(){}},
    acumuladores:{desactivarDonde(){return 0;}},
  };
  const e = new EscenarioSalon({},bus,motores);
  e.documento.actores.push(def); e.vivos.push({def,salon:c});
  c.update(.05,1,{estimulo:1}); e.conservarCuerpos(); assert.deepEqual(def.ficha.extra,c.estadoExtra());
  e.vivos=[]; // El shell desmonta el Escenario antes de editar en camerino.
  const editada = copiarFicha(def.ficha); editada.extra.vestuario.capas=[{id:'alambre',intensidad:1,detalle:.5}];
  e.actualizarActorDesdeCamerino(id,editada);
  assert.equal(def.id,id); assert.equal(def.transform.x,3); assert.equal(ruta.activa,true);
  assert.equal(def.ficha.extra.vestuario.capas[0].id,'alambre');
  c.dispose(new THREE.Scene());
});


test('equivalencia con la referencia: misma anatomía, fibras y corriente, sin reducir elementos', () => {
  const antes = new CaracolReferencia(), despues = new CaracolVivo();
  const capas = ['nacar','alambre','puntos','punteado','peludo','corriente'].map(id=>({id,intensidad:1,detalle:.65}));
  for (const a of [antes,despues]) a.vestuario.restaurar({version:1,capas});
  for (const edad of [0, .18, .5, 1]) {
    for (const a of [antes,despues]) {
      a.desarrollo=edad; a.tejido.tocar(.77,.3,5);
      for(let i=0;i<8;i++)a.tejido.avanzar(1/60);
      a.actualizar(1/60);
    }
    assert.deepEqual(despues.tejido.guardar(),antes.tejido.guardar());
    assert.deepEqual(despues.superficie.geometry.getAttribute('position').array,antes.superficie.geometry.getAttribute('position').array);
    assert.deepEqual(despues.superficie.geometry.getAttribute('normal').array,antes.superficie.geometry.getAttribute('normal').array);
    for (let i=2;i<6;i++) {
      const a=antes.vestuario.grupo.children[i], b=despues.vestuario.grupo.children[i];
      if (!b.visible) continue; // La versión optimizada no dibuja ni reconstruye capas invisibles.
      for(const nombre of ['position','color']) {
        const refArr=a.geometry.getAttribute(nombre).array, propioArr=b.geometry.getAttribute(nombre).array;
        // 'peludo' (i=4) reserva un búfer más grande para la cantidad de pelos ajustable;
        // por defecto solo usa (y dibuja) el mismo prefijo que la referencia congelada.
        assert.deepEqual(i===4 ? propioArr.subarray(0,refArr.length) : propioArr, refArr);
      }
    }
    const trajeDespues = despues.vestuario.guardar();
    const capaPeluda = trajeDespues.capas.find(c => c.id==='peludo');
    if (capaPeluda) delete capaPeluda.parametros; // cantidad de pelos: control nuevo, ausente en la referencia
    assert.deepEqual(trajeDespues,antes.vestuario.guardar());
  }
  antes.dispose();despues.dispose();
});

test('la cantidad de pelos recorta con drawRange, sin redimensionar ni recrear el búfer', () => {
  const a = new CaracolVivo();
  a.vestuario.quitar('alambre'); // el constructor viste 'alambre' por defecto; aislamos 'peludo'
  a.vestuario.configurar('peludo', 1, .5);
  const capaInicial = a.vestuario.configuracion().find(c => c.id === 'peludo');
  assert.equal(capaInicial.parametros.cantidad, 1000, 'valor por defecto: igual a la densidad histórica fija');
  const prenda = a.vestuario.grupo.children[0];
  const geometriaOriginal = prenda.geometry;
  a.actualizar();
  assert.equal(prenda.geometry.drawRange.count, 1000 * 4 * 2, 'con 1000 pelos y 4 tramos cada uno, se dibujan 1000*4*2 vértices');

  a.vestuario.configurar('peludo', 1, .5, { cantidad: 200 });
  assert.equal(a.vestuario.grupo.children[0], prenda, 'no se recrea la prenda al cambiar la cantidad');
  assert.equal(prenda.geometry, geometriaOriginal, 'el búfer sigue siendo el mismo objeto: nunca se redimensiona');
  a.actualizar();
  assert.equal(prenda.geometry.drawRange.count, 200 * 4 * 2);
  for (const v of prenda.geometry.getAttribute('position').array) assert.ok(Number.isFinite(v));

  a.vestuario.configurar('peludo', 1, .5, { cantidad: 3000 });
  a.actualizar();
  assert.equal(prenda.geometry.drawRange.count, 3000 * 4 * 2, 'el máximo reservado por el búfer es un valor válido');

  assert.throws(() => a.vestuario.configurar('peludo', 1, .5, { cantidad: 3001 }), /fuera de rango/, 'por encima del máximo reservado: rechazado');
  assert.throws(() => a.vestuario.configurar('peludo', 1, .5, { cantidad: 49 }), /fuera de rango/, 'por debajo del mínimo: rechazado');
  a.dispose();
});

test('superficies comparten geometría; retirar una capa conserva todos los buffers corporales', () => {
  const a = new CaracolVivo(); a.vestuario.configurar('alambre',1);
  assert.equal(a.vestuario.grupo.children[0].geometry,a.superficie.geometry);
  assert.equal(a.vestuario.grupo.children.at(-1).geometry,a.superficie.geometry);
  let liberaciones=0; a.superficie.geometry.addEventListener('dispose',()=>liberaciones++);
  a.vestuario.quitar('nacar');a.vestuario.quitar('alambre');assert.equal(liberaciones,0);
  a.vestuario.configurar('nacar',1);a.dispose();assert.equal(liberaciones,1);
});

test('reposo no sube buffers; mutaciones directas, receta y restauración invalidan', () => {
  const a = new CaracolVivo(); const pos=a.superficie.geometry.getAttribute('position');
  const version=pos.version, rev=a.cuerpo.revision;
  a.actualizar(0);assert.equal(pos.version,version);assert.equal(a.cuerpo.revision,rev);
  a.tejido.altura[12]=.1; a.actualizar(0); assert.ok(pos.version>version);
  const otra=pos.version; a.receta.radio=18;a.actualizar(0);assert.ok(pos.version>otra);
  a.dispose();
});

test('cambiar la resolución reemplaza la geometría entera, no reutiliza una ya dispuesta', () => {
  const a = new CaracolVivo();
  a.vestuario.configurar('alambre', 1);
  a.tejido.tocar(.4, .2, 6); a.tejido.avanzar(.05); a.actualizar();
  const geometriaPrevia = a.superficie.geometry;
  let dispuesta = false; geometriaPrevia.addEventListener('dispose', () => dispuesta = true);
  a.configurarResolucion(40, 20);
  assert.equal(dispuesta, true, 'la geometría anterior debe liberarse, no reutilizarse');
  assert.notEqual(a.superficie.geometry, geometriaPrevia, 'debe ser un objeto BufferGeometry nuevo');
  assert.equal(a.cuerpo.malla, a.superficie.geometry, 'el vestuario debe ver siempre la geometría vigente');
  assert.equal(a.superficie.geometry.getAttribute('position').count, 41 * 21);
  // El disfraz recreado tras el cambio de resolución debe apuntar a la geometría nueva, no a la vieja.
  const prenda = a.vestuario.grupo.children.find(o => o.geometry !== undefined);
  assert.equal(prenda.geometry, a.superficie.geometry);
  for (const v of a.superficie.geometry.getAttribute('position').array) assert.ok(Number.isFinite(v));
  // Repetir el cambio varias veces seguidas (como al arrastrar el control) no debe romper nada.
  a.configurarResolucion(80, 30); a.configurarResolucion(16, 8); a.actualizar(.02);
  assert.equal(a.superficie.geometry.getAttribute('position').count, 17 * 9);
  a.dispose();
});

test('capas invisibles mantienen corriente sin trabajo visual y recuperan el mismo estado', () => {
  const a=new CaracolVivo(), b=new CaracolVivo();
  a.vestuario.configurar('corriente',0);b.vestuario.configurar('corriente',1);
  const geo=a.vestuario.grupo.children.at(-1).geometry;
  const revision=geo.getAttribute('position').version;
  for(let i=0;i<5;i++){a.actualizar(.02);b.actualizar(.02);}
  assert.equal(geo.getAttribute('position').version,revision);
  a.vestuario.configurar('corriente',1);
  assert.deepEqual(a.vestuario.guardar(),b.vestuario.guardar());
  assert.deepEqual(geo.getAttribute('position').array,b.vestuario.grupo.children.at(-1).geometry.getAttribute('position').array);
  assert.equal(a.vestuario.configuracion().some(c=>'estado' in c),false);
  a.dispose();b.dispose();
});

// Referencia independiente del sketch Tiling/edge.js, con vectores en una celda de 100.
function referenciaTiling(angle,delta) {
  const vertices=[[0,0],[100,0],[100,100],[0,100]], out=[];
  for(let i=0;i<4;i++) {
    const a=vertices[i],b=vertices[(i+1)%4],mid=a.map((x,j)=>(x+b[j])/2);
    const v1=a.map((x,j)=>x-mid[j]),v2=b.map((x,j)=>x-mid[j]);
    const hlen=((Math.hypot(...v1)+delta)*Math.sin(Math.PI/4))/Math.sin(Math.PI-angle*Math.PI/180-Math.PI/4);
    for(const [v,sign,off] of [[v1,-1,v2],[v2,1,v1]]) {
      const theta=sign*angle*Math.PI/180,mag=Math.hypot(...v),q=mid.map((x,j)=>x+off[j]*delta/Math.hypot(...off));
      const d=[(v[0]*Math.cos(theta)-v[1]*Math.sin(theta))*hlen/mag,(v[0]*Math.sin(theta)+v[1]*Math.cos(theta))*hlen/mag];
      out.push(q[0]/100,q[1]/100,(q[0]+d[0])/100,(q[1]+d[1])/100);
    }
  }
  return out;
}

test('Girih reproduce los rayos de Tiling, incluidos ángulos y delta extremos', () => {
  for(const angulo of [0,15,45,75,90]) for(const delta of [0,10,25]) {
    const actual=motivoHankin(angulo,delta), esperado=referenciaTiling(angulo,delta);
    esperado.forEach((n,i)=>assert.ok(Math.abs(n-actual[i])<1e-12));
    assert.ok([...actual].every(n=>Number.isFinite(n)&&n>=-1e-12&&n<=1+1e-12));
  }
  assert.throws(()=>motivoHankin(NaN,10));assert.throws(()=>motivoHankin(75,26));
});

test('Girih comparte anatomía, no sube geometría al variar sliders y conserva configuración', () => {
  const a=new CaracolVivo(),b=new CaracolVivo();
  const tejido=a.tejido.guardar();a.vestuario.configurar('girih',1);
  const config=a.vestuario.guardar();assert.equal(config.capas.at(-1).detalle,.6);
  assert.deepEqual(config.capas.at(-1).parametros,{angulo:75,delta:10,longitudinal:50,transversal:18,cerrar:0});
  const prenda=a.vestuario.grupo.children.at(-1),geo=a.superficie.geometry;
  assert.equal(prenda.geometry,geo);const version=geo.getAttribute('position').version;
  a.vestuario.configurar('girih',.7,.6,{longitudinal:24,angulo:45,delta:25});
  assert.equal(geo.getAttribute('position').version,version);
  a.vestuario.restaurar(config);assert.deepEqual(a.vestuario.guardar(),config);
  const copia=a.vestuario.configuracion();copia.at(-1).parametros.angulo=0;
  assert.equal(a.vestuario.guardar().capas.at(-1).parametros.angulo,75);
  const mal=structuredClone(config);mal.capas.at(-1).parametros.delta=NaN;
  assert.throws(()=>a.vestuario.restaurar(mal));assert.deepEqual(a.vestuario.guardar(),config);
  assert.throws(()=>a.vestuario.configurar('girih',1,undefined,{inventado:1}));
  assert.deepEqual(a.tejido.guardar(),tejido);assert.equal(b.vestuario.configuracion().some(c=>c.id==='girih'),false);
  let liberado=0;geo.addEventListener('dispose',()=>liberado++);a.vestuario.quitar('girih');assert.equal(liberado,0);
  a.dispose();assert.equal(liberado,1);b.dispose();
});


// Fórmulas generales join/reflect del visor (no la simplificación A/B/C del port).
function referenciaPlegado(x,y,k,repetir,plegar) {
  const lados=[[0,k,0],[-1,-k,k],[1,0,0]];
  let z=[x,y];if(repetir)z=z.map(n=>n+1-2*Math.floor((n+1)/2)-1);
  let pasos=0;
  if(plegar)for(;pasos<100;pasos++) {
    let cambio=false;
    for(const a of lados){const d=z[0]*a[0]+z[1]*a[1]+a[2];if(d<0){const f=2*d/(a[0]**2+a[1]**2);z=[z[0]-f*a[0],z[1]-f*a[1]];cambio=true;}}
    if(!cambio)break;
  }
  return {x:z[0],y:z[1],pasos};
}
test('Girih II conserva el plegado y orden del visor para ambas simetrías',()=>{
  for(const k of [1,Math.sqrt(3)])for(const repetir of [false,true])for(const plegar of [false,true])
    for(let i=0;i<100;i++) {
      const x=Math.sin(i*1.234)*7.9,y=Math.cos(i*.987)*7.9;
      const a=plegarGirih2(x,y,k,repetir,plegar),b=referenciaPlegado(x,y,k,repetir,plegar);
      assert.ok(Math.abs(a.x-b.x)<1e-10&&Math.abs(a.y-b.y)<1e-10);assert.equal(a.pasos,b.pasos);
      if(plegar)assert.ok(a.x>=-1e-10&&a.y>=-1e-10&&a.x+k*a.y<=k+1e-10);
    }
});
test('Girih II comparte textura y malla, aísla controles y libera la textura al retirar el último traje',()=>{
  const a=new CaracolVivo(),b=new CaracolVivo();
  a.vestuario.configurar('girih2',1);b.vestuario.configurar('girih2',1);
  const r=adquirirTexturaGirih2(),r2=adquirirTexturaGirih2();assert.equal(r.textura,r2.textura);
  let liberado=0;r.textura.addEventListener('dispose',()=>liberado++);r.liberar();r2.liberar();
  const geo=a.superficie.geometry;assert.equal(a.vestuario.grupo.children.at(-1).geometry,geo);
  const version=geo.getAttribute('position').version,estado=b.vestuario.guardar();
  a.vestuario.configurar('girih2',.4,.8,{grupo:1,puntoX:0,puntoY:0,invertir:1,colorFondo:0});
  assert.equal(geo.getAttribute('position').version,version);assert.deepEqual(b.vestuario.guardar(),estado);
  const propio=a.vestuario.guardar();
  assert.equal(propio.capas.at(-1).parametros.colorFondo,0);
  assert.equal(estado.capas.at(-1).parametros.colorFondo,.2);
  a.vestuario.restaurar(propio);assert.deepEqual(a.vestuario.guardar(),propio);
  assert.throws(()=>a.vestuario.configurar('girih2',1,undefined,{colorFondo:1.1}));
  assert.throws(()=>a.vestuario.configurar('girih2',1,undefined,{grupo:.3}));assert.deepEqual(a.vestuario.guardar(),propio);
  a.vestuario.quitar('girih2');assert.equal(liberado,0);b.vestuario.quitar('girih2');assert.equal(liberado,1);
  a.dispose();b.dispose();
});

test('Imprimir exporta un HTML autocontenido, sin placeholders y con script interno válido', async () => {
  const c = new CaracolSalon();
  c.init(new THREE.Group(), new THREE.PerspectiveCamera());
  c.update(.05, 0, { estimulo: .4, regionU: .6, regionV: .2 });
  c.actor.vestuario.restaurar({ version: 1, capas: [
    { id: 'girih2', intensidad: .8, detalle: .5, parametros: { grupo: 1, puntoX: .1, puntoY: .2, zoom: 2, colorFondo: .3, desplazamiento: 0, bordes: 1, invertir: 0, cruceX: 1, cruceY: 0, plegado: 1, repeticion: 1 } },
  ] });
  const params = { desarrollo: 1, estimulo: .4, regionU: .6, regionV: .2, resolucionU: 32, resolucionV: 16, radio: 14, vueltas: 2, curvaZ: 1.4, escala: .45 };
  const html = c.exportar(params);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(html.includes('__PARAMS__'), false, 'no deben quedar placeholders de parámetros sin sustituir');
  assert.equal(html.includes('__ESTADO__'), false, 'no deben quedar placeholders de estado sin sustituir');
  assert.ok(html.includes('type="importmap"'));
  assert.ok(html.includes('three.webgpu.js') && html.includes('three.tsl.js'));
  assert.ok(html.includes('"girih2"'), 'el traje activo debe viajar horneado en el HTML');
  const bloque = html.match(/<script type="module">([\s\S]*)<\/script><\/body><\/html>/);
  assert.ok(bloque, 'debe existir un único <script type="module"> autocontenido');
  // Si el JS embebido tiene un error de sintaxis, esto lanza.
  await transformWithEsbuild(bloque[1], 'caracol-export.mjs', { target: 'es2022', format: 'esm' });
  c.dispose(new THREE.Scene());
});
