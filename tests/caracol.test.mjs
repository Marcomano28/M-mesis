import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

const archivo = 'src/core/TejidoCaracol.ts';
const compilado = await transformWithEsbuild(await readFile(archivo, 'utf8'), archivo, { target: 'es2022', format: 'esm' });
const { TejidoCaracol, posicionCorporal, azarCelda } = await import(
  `data:text/javascript;base64,${Buffer.from(compilado.code).toString('base64')}`);
const avanzar = (t, segundos, fps = 60) => { for (let i = 0; i < segundos * fps; i++) t.avanzar(1 / fps); };
const punto = (u, v, d) => { const p = { x: 0, y: 0, z: 0 }; posicionCorporal(u, v, d, 0, 0, p); return p; };

test('El cuerpo pleno en reposo conserva la fórmula de Caracol', () => {
  for (const u of [0, 0.17, 0.53, 1]) for (const v of [0, 0.13, 0.5, 1]) {
    const th = u * 4 * Math.PI, ph = (v * 2 - 1) * Math.PI;
    const esperado = { x: 14 * th * Math.cos(th) * (1 + Math.cos(ph)) * 0.01,
      y: 14 * th * Math.sin(th) * (1 + Math.cos(ph)) * 0.01,
      z: (14 * th * Math.sin(ph) - Math.pow((th + 0.375) * Math.PI, 1.4)) * 0.01 };
    const p = punto(u, v, 1);
    for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(p[k] - esperado[k]) < 1e-12);
  }
});

test('La génesis colapsa todas las coordenadas al mismo germen', () => {
  const a = punto(0, 0, 0);
  for (const u of [0.1, 0.5, 1]) for (const v of [0, 0.25, 0.5, 0.75, 1]) assert.deepEqual(punto(u, v, 0), a);
});

test('El desarrollo abre la sección además de extender la espiral', () => {
  const a = punto(0.5, 0.1, 0.15), b = punto(0.5, 0.7, 0.15);
  assert.deepEqual(a, b, 'El primer estado es una curva sin sección');
  assert.notDeepEqual(punto(0.5, 0.1, 0.7), punto(0.5, 0.7, 0.7), 'El estado posterior abre superficie');
});

test('El estímulo es local y se transmite después a regiones vecinas', () => {
  const t = new TejidoCaracol();
  t.tocar(0.4, 0.25, 6);
  assert.ok(t.velocidad[25 * 32 + 8] > 5);
  assert.equal(t.velocidad[60 * 32 + 8], 0);
  const antes = t.velocidad[36 * 32 + 8];
  avanzar(t, 1);
  assert.ok(Math.abs(t.altura[36 * 32 + 8]) > antes * 2 + 1e-5);
  assert.ok(Math.abs(t.altura[25 * 32 + 8]) > Math.abs(t.altura[60 * 32 + 8]));
});

test('Una entrada idéntica no borra una historia corporal distinta', () => {
  const a = new TejidoCaracol(), b = new TejidoCaracol();
  a.tocar(0.7, 0.3, 6); avanzar(a, 2); avanzar(b, 2);
  a.tocar(0.2, 0.6, 2); b.tocar(0.2, 0.6, 2);
  avanzar(a, 1); avanzar(b, 1);
  assert.ok(a.huella > b.huella);
  assert.notDeepEqual(a.altura, b.altura);
});

test('La costura transversal no interrumpe excitación o muestreo', () => {
  const a = new TejidoCaracol(), b = new TejidoCaracol();
  a.tocar(0.5, 0, 6); b.tocar(0.5, 1, 6);
  avanzar(a, 1); avanzar(b, 1);
  assert.deepEqual(a.altura, b.altura);
  assert.equal(a.muestrear(0.5, 0), a.muestrear(0.5, 1));
});

test('El paso fijo conserva el recorrido a 30 y 60 FPS', () => {
  const a = new TejidoCaracol(), b = new TejidoCaracol();
  a.tocar(0.7, 0.3, 5); b.tocar(0.7, 0.3, 5);
  avanzar(a, 3, 30); avanzar(b, 3, 60);
  assert.deepEqual(a.altura, b.altura); assert.deepEqual(a.memoria, b.memoria);
});

test('El checkpoint recupera exactamente el estado y su evolución posterior', () => {
  const a = new TejidoCaracol(), b = new TejidoCaracol();
  a.tocar(0.3, 0.1, 6); avanzar(a, 2); a.avanzar(0.004);
  const checkpoint = a.guardar(); b.restaurar(JSON.parse(JSON.stringify(checkpoint)));
  assert.deepEqual(a.guardar(), b.guardar());
  avanzar(a, 2); avanzar(b, 2); assert.deepEqual(a.guardar(), b.guardar());
  a.tocar(0.8, 0.5, 3); assert.notDeepEqual(a.velocidad, checkpoint.velocidad);
});

test('El silencio disipa la excitación, preservando una huella más lenta', () => {
  const t = new TejidoCaracol(); t.tocar(0.6, 0.4, 6); avanzar(t, 2);
  const inicial = t.actividad;
  avanzar(t, 10);
  assert.ok(t.actividad < inicial * 0.01);
  assert.ok(t.huella > t.actividad * 20);
  avanzar(t, 60); assert.ok(t.huella < 0.0001);
});

test('La semilla, las instancias y la validación del checkpoint son independientes', () => {
  assert.equal(azarCelda(17), azarCelda(17)); assert.notEqual(azarCelda(17, 1), azarCelda(17, 2));
  const a = new TejidoCaracol(), b = new TejidoCaracol(); a.tocar(0.5, 0.5); avanzar(a, 1);
  assert.equal(b.actividad, 0); assert.equal(b.huella, 0);
  const estado = a.guardar(); estado.altura[0] = NaN;
  assert.throws(() => b.restaurar(estado)); assert.equal(b.actividad, 0);
  assert.throws(() => b.restaurar({ ...a.guardar(), semilla: 42 }));
});
