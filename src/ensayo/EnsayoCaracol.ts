import * as THREE from 'three/webgpu';
import { Engine } from '../core/Engine';
import { CaracolVivo } from '../salones/supershapes/CaracolVivo';
import { suave, type EstadoTejido } from '../core/TejidoCaracol';
import './ensayo.css';
import { crearPanelVestuario } from '../vestuario/PanelVestuario';
import type { Traje } from '../vestuario/AlmacenDisfraces';

document.title = 'MIA — Caracol · La memoria de una caricia';
const ui = document.createElement('main');
ui.className = 'ensayo';
ui.innerHTML = `
  <header class="cabecera"><a class="marca" href="/">MIA<span>ESTUDIOS DE UN CUERPO VIVO</span></a><a class="regreso" href="/">Volver al taller ↗</a></header>
  <section class="descripcion"><p class="sobre">ENSAYO 01 / CARACOL</p><h1>La memoria<br>de una <em>caricia.</em></h1>
  <p class="intro">Una espiral aprende a desplegarse.<br>Lo que tocas en su piel permanece<br>un poco más que tu mano.</p>
  <div class="linea"></div><p class="acto" id="acto">I. El germen</p><p class="relato" id="relato">Una línea contiene el cuerpo que todavía no vemos.</p></section>
  <aside class="testigo"><h2>Lo que ocurre dentro</h2><div class="dato"><label>Excitación <span id="valor-onda">0.000</span></label><div class="barra"><i id="onda"></i></div></div>
  <div class="dato"><label>Memoria <span id="valor-memoria">0.000</span></label><div class="barra"><i id="memoria"></i></div></div><p class="estado"><span class="punto"></span>Pose inmóvil<br>2.048 regiones sensibles</p></aside>
  <section class="instrumento" aria-label="Instrumento corporal">
  <div class="control"><label for="desarrollo">Desarrollo <output id="edad">0%</output></label><input id="desarrollo" type="range" min="0" max="1" step="0.001" value="0" aria-label="Desarrollo del cuerpo"></div>
  <div class="control"><button id="abrir-vestuario">Abrir almacén de disfraces ↗</button><p id="vestido-actual">Nácar · Peludo</p></div>
  <div class="acciones"><button id="nacer" class="principal">Repetir nacimiento</button><button id="tocar">Tocar una región</button><button id="reposar">Replegarse</button></div>
  <p class="mensaje" id="mensaje" role="status">El ensayo comienza. Después, puedes tocarlo.</p>
  <details class="ayuda"><summary>Sobre este ensayo</summary><p>La espiral conserva la fórmula de Caracol. Cada región guarda excitación y memoria, y transmite movimiento a sus vecinas. La cámara y la pose permanecen fijas. Esta prueba explora un solo cuerpo; todavía no hay fusión entre actores.</p></details></section>
  <p class="nota">Acerca la mano: pulsa o arrastra sobre la concha.<br>El verde revela la huella de tu encuentro.</p>
  <footer class="pie"><div class="nombre">Caracol <small>Identidad 1729 · Un cuerpo, muchas edades</small></div><div class="indicacion">Toca la superficie. Observa cómo responde.<span>La forma recuerda aunque retires la mano.</span></div>
  <div class="controles-pie"><button class="secundario" id="pausa" aria-pressed="false">Pausar</button><button class="secundario" id="tejido" aria-pressed="false">Ver tejido</button><button class="secundario" id="guardar">Guardar instante</button><button class="secundario" id="recuperar" disabled>Recuperar</button></div></footer>`;
document.body.appendChild(ui);
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const engine = new Engine(document.getElementById('lienzo')!);
await engine.init();
engine.escena.background = new THREE.Color('#101b18');
engine.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
engine.renderer.toneMapping = THREE.ACESFilmicToneMapping;
engine.renderer.toneMappingExposure = 0.95;
engine.controles.enabled = false;
engine.escena.add(new THREE.HemisphereLight('#edf5dc', '#15382a', 1.6));
for (const [color, intensidad, xyz] of [
  ['#ffddba', 4, [3, 5, 6]], ['#a3e9d5', 3, [-5, 2, -1]], ['#e7b5b9', 2, [0, -3, 4]],
] as const) {
  const luz = new THREE.DirectionalLight(color, intensidad);
  luz.position.set(xyz[0], xyz[1], xyz[2]); engine.escena.add(luz);
}
const actor = new CaracolVivo();
actor.desarrollo = 1; actor.actualizar();
engine.escena.add(actor.grupo);
actor.grupo.updateMatrixWorld(true);
const caja = new THREE.Box3().setFromObject(actor.grupo);
const centro = caja.getCenter(new THREE.Vector3());
const dimensiones = caja.getSize(new THREE.Vector3());
actor.grupo.position.copy(centro).negate();
function encuadrar(): void {
  const movil = innerWidth < 761;
  const ancho = innerWidth, alto = innerHeight;
  const izquierda = movil ? 15 : ancho > 1100 ? 320 : 280;
  const derecha = ancho > 1100 ? 195 : 25;
  const arriba = movil ? 248 : 100;
  const abajo = movil ? 258 : 115;
  const disponibleX = Math.max(160, ancho - izquierda - derecha);
  const disponibleY = Math.max(160, alto - arriba - abajo);
  const centroX = izquierda + disponibleX / 2;
  const centroY = arriba + disponibleY / 2;
  engine.camara.fov = 39;
  const tan = Math.tan(39 * Math.PI / 360);
  const z = Math.max(dimensiones.y * alto / disponibleY / (2 * tan),
    dimensiones.x * ancho / disponibleX / (2 * tan * ancho / alto)) * 1.06 + dimensiones.z * 0.35;
  const mundoY = 2 * tan * z, mundoX = mundoY * ancho / alto;
  const x = -(centroX / ancho - 0.5) * mundoX;
  const y = (centroY / alto - 0.5) * mundoY;
  engine.camara.position.set(x, y, z);
  engine.camara.lookAt(x, y, 0);
  engine.camara.updateProjectionMatrix();
}
encuadrar(); addEventListener('resize', encuadrar);

let objetivoDesarrollo = 0;
let pausado = false;
let guion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let tiempoGuion = 0;
let siguienteToque = 0;
let contadorToques = 0;
let ultimoUI = 0;
let estadoGuardado: { version: 1 | 2; tejido: EstadoTejido; desarrollo: number; faceta: number; vestuario?: Traje } | null = null;
const fotogramas: number[] = [];
const pulsos = [
  { t: 16, u: 0.8, v: 0.26 }, { t: 19.5, u: 0.67, v: 0.67 }, { t: 23, u: 0.42, v: 0.38 },
];
actor.desarrollo = guion ? 0.015 : 1;
if (!guion) objetivoDesarrollo = 1;

function mensaje(s: string): void { el('mensaje').textContent = s; }
function relato(titulo: string, texto: string): void {
  el('acto').textContent = titulo; el('relato').textContent = texto;
}
function intervenir(): void {
  guion = false;
  relato('Tu turno', 'Una caricia aquí. Una respuesta que viaja más allá.');
}
function tocar(u: number, v: number, fuerza = 5): void {
  actor.tejido.tocar(u, v, fuerza);
  contadorToques++;
}
el<HTMLInputElement>('desarrollo').addEventListener('input', (ev) => {
  intervenir(); objetivoDesarrollo = Number((ev.target as HTMLInputElement).value);
  if (pausado) { actor.desarrollo = objetivoDesarrollo; actor.actualizar(); }
});
function mostrarVestido(): void {
  actor.actualizar();
  el('vestido-actual').textContent = actor.vestuario.guardar().capas.map(c => actor.vestuario.almacen.obtener(c.id).nombre).join(' · ') || 'Cuerpo sin prendas';
}
const panelVestuario = crearPanelVestuario(actor.vestuario, mostrarVestido);
el('abrir-vestuario').addEventListener('click', () => panelVestuario.abrir());
el('nacer').addEventListener('click', () => {
  actor.tejido.reiniciar(); actor.desarrollo = 0.001; objetivoDesarrollo = 0;
  guion = true; tiempoGuion = 0; siguienteToque = 0;
  fijarPausa(false); mensaje('De la línea a la piel. La pose permanece inmóvil.');
});
el('tocar').addEventListener('click', () => {
  intervenir(); if (actor.desarrollo < 0.65) objetivoDesarrollo = 1;
  fijarPausa(false); tocar(0.77, 0.3, 6);
  mensaje('Un impulso local. Ahora observa cómo viaja.');
});
el('reposar').addEventListener('click', () => {
  guion = false; objetivoDesarrollo = 0; fijarPausa(false);
  relato('Volver al silencio', 'El cuerpo se repliega. Su identidad permanece.');
  mensaje('La memoria continúa decayendo durante el repliegue.');
});
function fijarPausa(p: boolean): void {
  pausado = p; el('pausa').textContent = p ? 'Continuar' : 'Pausar';
  el('pausa').setAttribute('aria-pressed', String(p));
}
el('pausa').addEventListener('click', () => fijarPausa(!pausado));
el('tejido').addEventListener('click', () => {
  actor.revelarTejido = !actor.revelarTejido;
  el('tejido').setAttribute('aria-pressed', String(actor.revelarTejido));
  el('tejido').textContent = actor.revelarTejido ? 'Ver materia' : 'Ver tejido';
  actor.actualizar();
  mensaje(actor.revelarTejido ? 'Rojo: excitación. Verde: memoria local persistente.' : 'La misma anatomía, bajo su materia.');
});
el('guardar').addEventListener('click', () => {
  estadoGuardado = { version: 2, vestuario: actor.vestuario.guardar(), tejido: actor.tejido.guardar(), desarrollo: actor.desarrollo, faceta: actor.faceta };
  try { localStorage.setItem('mia-ensayo-caracol-v1', JSON.stringify(estadoGuardado)); mensaje('Instante guardado en este navegador.'); }
  catch { mensaje('Instante guardado durante esta sesión.'); }
  el<HTMLButtonElement>('recuperar').disabled = false;
});
try {
  const previo = localStorage.getItem('mia-ensayo-caracol-v1');
  if (previo) {
    const dato = JSON.parse(previo);
    const copia = actor.tejido.guardar();
    if ((dato.version !== 1 && dato.version !== 2) || !Number.isFinite(dato.desarrollo) || dato.desarrollo < 0 || dato.desarrollo > 1
      || !Number.isFinite(dato.faceta) || dato.faceta < 0 || dato.faceta > 1) throw new Error('Estado incompatible');
    const traje = actor.vestuario.guardar();
    try {
      actor.tejido.restaurar(dato.tejido);
      if (dato.version === 2) actor.vestuario.restaurar(dato.vestuario);
    } finally { actor.tejido.restaurar(copia); actor.vestuario.restaurar(traje); }
    estadoGuardado = dato; el<HTMLButtonElement>('recuperar').disabled = false;
  }
} catch { mensaje('El instante anterior no es compatible. Puedes guardar uno nuevo.'); }
el('recuperar').addEventListener('click', () => {
  if (!estadoGuardado) return;
  intervenir(); fijarPausa(true);
  actor.tejido.restaurar(estadoGuardado.tejido);
  actor.desarrollo = objetivoDesarrollo = estadoGuardado.desarrollo;
  if (estadoGuardado.version === 2) actor.vestuario.restaurar(estadoGuardado.vestuario!);
  else actor.vestuario.restaurar({ version: 1, capas: [{ id: 'nacar', intensidad: 1, detalle: 0.65 }, { id: 'peludo', intensidad: 0.8, detalle: estadoGuardado.faceta }] });
  mostrarVestido();
  actor.actualizar(); mensaje('Instante recuperado y en pausa: misma forma, misma memoria.');
});

// Raycast contra la geometría corporal realmente dibujada, no contra su pose original.
const raycaster = new THREE.Raycaster();
const puntero = new THREE.Vector2();
const canvas = engine.renderer.domElement;
canvas.classList.add('cursor-cuerpo');
canvas.style.touchAction = 'none';
let arrastrando = false, ultimoToque = -Infinity;
function caricia(ev: PointerEvent): void {
  if (pausado || actor.desarrollo < 0.25 || performance.now() - ultimoToque < 100) return;
  const r = canvas.getBoundingClientRect();
  puntero.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
  actor.grupo.updateMatrixWorld(true); engine.camara.updateMatrixWorld(true);
  raycaster.setFromCamera(puntero, engine.camara);
  const hit = raycaster.intersectObject(actor.superficie)[0];
  if (!hit?.uv) return;
  intervenir(); tocar(hit.uv.x, hit.uv.y, 3.5); ultimoToque = performance.now();
  mensaje('La región que has tocado recuerda tu paso.');
}
canvas.addEventListener('pointerdown', (ev) => { arrastrando = true; canvas.setPointerCapture(ev.pointerId); caricia(ev); });
canvas.addEventListener('pointermove', (ev) => { if (arrastrando) caricia(ev); });
canvas.addEventListener('pointerup', () => { arrastrando = false; });
canvas.addEventListener('pointercancel', () => { arrastrando = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) fijarPausa(true); });

engine.arrancar((delta, tiempo) => {
  const inicio = performance.now();
  const dt = Math.min(delta, 0.05);
  if (!pausado) {
    if (guion) {
      tiempoGuion += dt;
      objetivoDesarrollo = suave(0, 15, tiempoGuion);
      if (tiempoGuion < 5) relato('I. La línea', 'Una espiral contiene el cuerpo que todavía no vemos.');
      else if (tiempoGuion < 15) relato('II. La piel', 'La línea se abre. Aparecen regiones capaces de sentir.');
      else if (tiempoGuion < 24) relato('III. El encuentro', 'Un estímulo nace en un lugar. Su respuesta atraviesa el tejido.');
      else relato('IV. La memoria', 'La mano ya se ha retirado. El cuerpo todavía la recuerda.');
      while (siguienteToque < pulsos.length && tiempoGuion >= pulsos[siguienteToque].t) {
        const p = pulsos[siguienteToque++]; tocar(p.u, p.v, 6);
      }
      if (tiempoGuion > 31) { intervenir(); mensaje('Ahora, el gesto es tuyo. Toca la concha o cambia su desarrollo.'); }
    }
    actor.desarrollo += (objetivoDesarrollo - actor.desarrollo) * (1 - Math.exp(-dt * 1.8));
    if (objetivoDesarrollo === 0 && actor.desarrollo < 0.0001) actor.desarrollo = 0;
    actor.tejido.avanzar(dt);
    actor.actualizar(dt);
  }
  if (tiempo - ultimoUI > 0.12) {
    const act = actor.tejido.actividad, mem = actor.tejido.huella;
    el('edad').textContent = `${Math.round(actor.desarrollo * 100)}%`;
    if (document.activeElement !== el('desarrollo') || guion)
      el<HTMLInputElement>('desarrollo').value = String(actor.desarrollo);
    el('valor-onda').textContent = act.toFixed(3); el('valor-memoria').textContent = mem.toFixed(3);
    el('onda').style.transform = `scaleX(${Math.min(1, act * 15)})`;
    el('memoria').style.transform = `scaleX(${Math.min(1, mem * 20)})`;
    ultimoUI = tiempo;
  }
  fotogramas.push(performance.now() - inicio);
  if (fotogramas.length > 300) fotogramas.shift();
});

// Inspección del ensayo: sin acceso a datos privados del taller.
(window as unknown as Record<string, unknown>).MIAEnsayo = {
  actor, engine, tocar, pausar: fijarPausa,
  diagnostico: () => ({
    desarrollo: actor.desarrollo, actividad: actor.tejido.actividad, memoria: actor.tejido.huella,
    toques: contadorToques, tiempo: actor.tejido.tiempo, pausado, guion,
    posicion: actor.grupo.position.toArray(), rotacion: actor.grupo.rotation.toArray(), escala: actor.grupo.scale.toArray(),
    cpuActualizacionMs: [...fotogramas].sort((a, b) => a - b)[Math.floor(fotogramas.length * 0.95)] ?? 0,
  }),
};
// Evita mantener recursos en una entrada que deja de estar activa.
addEventListener('pagehide', (e) => {
  if (e.persisted) return;
  engine.renderer.setAnimationLoop(null); panelVestuario.dispose(); actor.dispose(); engine.renderer.dispose();
});
