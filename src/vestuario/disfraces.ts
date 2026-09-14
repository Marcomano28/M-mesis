import { disfrazGirih2 } from './Girih2';
import { disfrazGirih } from './Girih';
import * as THREE from 'three/webgpu';
import { attribute, uniform, varying, vec3, mix, min, max, sin, abs } from 'three/tsl';
import { AlmacenDisfraces, type CuerpoVestible, type MuestraCorporal, type Prenda } from './AlmacenDisfraces';

const muestra = (): MuestraCorporal => ({ posicion: new THREE.Vector3(), normal: new THREE.Vector3(), tangente: new THREE.Vector3(), excitacion: 0, memoria: 0 });
function azar(i: number, semilla: number): number {
  let x = Math.imul(i + 1, 374761393) ^ semilla;
  x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const cobre = new THREE.Color('#ac6754'), nacar = new THREE.Color('#f1d4a8'), jade = new THREE.Color('#71cbbf');
function tono(m: MuestraCorporal, color: THREE.Color, diagnostico: boolean): THREE.Color {
  return diagnostico ? color.setRGB(0.025 + Math.abs(m.excitacion) * 2.2, 0.06 + m.memoria * 3, 0.08 + Math.max(0, m.excitacion) * 1.9)
    : color.copy(nacar).lerp(jade, Math.min(0.85, Math.max(0, m.excitacion + m.memoria * 2)));
}
function superficie(cuerpo: CuerpoVestible, alambre: boolean): Prenda {
  const origen = cuerpo.malla!;
  const posicion = origen.getAttribute('position'), normal = origen.getAttribute('normal'), uv = origen.getAttribute('uv');
  if (!posicion || !normal || !uv || posicion.count !== normal.count || posicion.count !== uv.count)
    throw new Error('La superficie requiere position, normal y uv compatibles');
  const nombreEstado = cuerpo.atributoEstado;
  const estado = nombreEstado ? origen.getAttribute(nombreEstado) : undefined;
  if (nombreEstado && (!estado || estado.itemSize !== 2 || estado.count !== posicion.count))
    throw new Error('Atributo corporal de estado incompatible');
  // Puerto GPU optativo: una única geometría propiedad del actor, sin copias ni liberación por prenda.
  // Adaptadores anteriores conservan su ruta CPU y geometría privada.
  const compartida = !!estado;
  const geometria = compartida ? origen : origen.clone();
  const colores = compartida ? null : new Float32Array(posicion.count * 3);
  if (colores) geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  const material = new THREE.MeshPhysicalNodeMaterial({ vertexColors: !compartida, side: THREE.DoubleSide,
    wireframe: alambre, roughness: 0.46, metalness: 0.38, clearcoat: 0.65, transparent: true });
  const detalle = uniform(0.65), diagnostico = uniform(0);
  if (compartida) {
    const e = attribute(nombreEstado!, 'vec2'), z = e.x, m = e.y;
    const coord = attribute('uv', 'vec2');
    const base = mix(vec3(nacar.r, nacar.g, nacar.b), vec3(jade.r, jade.g, jade.b), min(0.85, max(0, z.add(m.mul(2)))));
    const materia = alambre ? base : mix(base, vec3(cobre.r, cobre.g, cobre.b),
      sin(coord.x.mul(Math.PI * 44).add(coord.y.mul(7))).mul(0.3).add(0.4).mul(detalle));
    const tejido = vec3(abs(z).mul(2.2).add(0.025), m.mul(3).add(0.06), max(0, z).mul(1.9).add(0.08));
    // Evaluación por vértice e interpolación: conserva el sombreado de los colores CPU originales.
    material.colorNode = varying(mix(materia, tejido, diagnostico));
  }
  const objeto = new THREE.Mesh(geometria, material);
  // En cuerpos externos se conserva la política previa: no presumir cotas fiables de un shader.
  objeto.frustumCulled = compartida;
  const m = muestra(), color = new THREE.Color();
  let revision = -1, detallePrevio = NaN, diagnosticoPrevio = false;
  return { objeto, actualizar(c, _dt, verTejido) {
    detalle.value = c.detalle; diagnostico.value = verTejido ? 1 : 0;
    material.opacity = c.intensidad; material.depthWrite = c.intensidad > 0.98;
    material.roughness = 0.15 + c.detalle * 0.7;
    objeto.visible = cuerpo.desarrollo > 0.22 && c.intensidad > 0;
    if (compartida) return;
    if (!objeto.visible) { revision = -1; return; }
    if (cuerpo.revision !== undefined && revision === cuerpo.revision && detallePrevio === c.detalle && diagnosticoPrevio === verTejido) return;
    for (const nombre of ['position', 'normal']) {
      const fuente = origen.getAttribute(nombre), destino = geometria.getAttribute(nombre);
      (destino.array as Float32Array).set(fuente.array); destino.needsUpdate = true;
    }
    for (let i = 0; i < posicion.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (cuerpo.muestrearEstado) cuerpo.muestrearEstado(u, v, m); else cuerpo.muestrear!(u, v, m);
      tono(m, color, verTejido);
      if (!verTejido && !alambre) color.lerp(cobre, (0.4 + 0.3 * Math.sin(u * Math.PI * 44 + v * 7)) * c.detalle);
      color.toArray(colores!, i * 3);
    }
    geometria.getAttribute('color').needsUpdate = true;
    revision = cuerpo.revision ?? -1; detallePrevio = c.detalle; diagnosticoPrevio = verTejido;
  }, dispose() { if (!compartida) geometria.dispose(); material.dispose(); } };
}
const MAX_PELOS = 3000;
function fibras(cuerpo: CuerpoVestible, modo: 'puntos' | 'punteado' | 'peludo' | 'corriente'): Prenda {
  // 'peludo' reserva un búfer para el máximo posible; la cantidad activa se recorta con
  // drawRange, nunca redimensionando el búfer (evita reusar geometría ya dispuesta).
  const nMax = modo === 'punteado' ? 2048 : modo === 'peludo' ? MAX_PELOS : 1000;
  const tramos = modo === 'peludo' ? 4 : 1;
  const esLinea = modo === 'peludo' || modo === 'corriente';
  const posiciones = new Float32Array(nMax * (esLinea ? tramos * 2 : 1) * 3);
  const colores = new Float32Array(posiciones.length);
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3).setUsage(THREE.DynamicDrawUsage));
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3).setUsage(THREE.DynamicDrawUsage));
  const material = esLinea
    ? new THREE.LineBasicNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false })
    : new THREE.PointsNodeMaterial({ vertexColors: true, size: 0.035, sizeAttenuation: true, transparent: true, depthWrite: false });
  const objeto = esLinea ? new THREE.LineSegments(geometria, material) : new THREE.Points(geometria, material);
  objeto.frustumCulled = false;
  const uv = new Float64Array(nMax * 2);
  const variaciones = new Float64Array(nMax);
  for (let i = 0; i < nMax; i++) {
    variaciones[i] = azar(i * 3 + 2, cuerpo.semilla);
    uv[i * 2] = modo === 'punteado' ? (Math.floor(i / 16) + 0.5) / 128 : 0.025 + azar(i * 3, cuerpo.semilla) * 0.95;
    uv[i * 2 + 1] = modo === 'punteado' ? (i % 16) / 16 : azar(i * 3 + 1, cuerpo.semilla);
  }
  const m = muestra(), otra = muestra(), velocidad = new THREE.Vector2(), color = new THREE.Color();
  let revision = -1, detallePrevio = NaN, diagnosticoPrevio = false, cantidadPrevia = NaN, sucio = true;
  const muestrear = modo === 'peludo' ? cuerpo.muestrear! : (cuerpo.muestrearPosicion ?? cuerpo.muestrear!);
  return { objeto, actualizar(c, dt, diagnostico) {
    const madurez = Math.max(0, Math.min(1, (cuerpo.desarrollo - 0.35) / 0.65));
    objeto.visible = cuerpo.desarrollo > 0.001 && c.intensidad > 0;
    material.opacity = c.intensidad;
    // Solo 'peludo' expone la cantidad como control; las demás fibras conservan su densidad fija.
    const activos = modo === 'peludo' ? Math.max(1, Math.min(nMax, Math.round(c.parametros?.cantidad ?? nMax))) : nMax;
    if (modo === 'corriente' && dt > 0) sucio = true;
    if (cuerpo.revision === undefined || revision !== cuerpo.revision || detallePrevio !== c.detalle || diagnosticoPrevio !== diagnostico || cantidadPrevia !== activos) sucio = true;
    if (!objeto.visible) sucio = true; // La simulación continúa; su representación se recupera al volver.
    if (!sucio) return;
    if (material instanceof THREE.PointsNodeMaterial) material.size = 0.012 + c.detalle * 0.065;
    for (let i = 0; i < nMax; i++) {
      if (modo === 'corriente' && dt > 0) {
        cuerpo.flujo!(uv[i * 2], uv[i * 2 + 1], velocidad);
        uv[i * 2] = ((uv[i * 2] + velocidad.x * dt * (0.1 + c.detalle * 2)) % 1 + 1) % 1;
        uv[i * 2 + 1] = ((uv[i * 2 + 1] + velocidad.y * dt * (0.1 + c.detalle * 2)) % 1 + 1) % 1;
      }
      if (i >= activos) continue; // Fuera de la cantidad activa: no se dibuja.
      if (!objeto.visible) continue;
      const u = uv[i * 2], v = uv[i * 2 + 1]; muestrear(u, v, m);
      tono(m, color, diagnostico);
      if (!esLinea) { m.posicion.toArray(posiciones, i * 3); color.toArray(colores, i * 3); continue; }
      const largo = madurez * (0.035 + c.detalle * (0.08 + variaciones[i] * 0.3) + Math.abs(m.excitacion) * 0.45 + m.memoria * 0.2);
      if (modo === 'corriente') {
        cuerpo.flujo!(u, v, velocidad);
        muestrear(Math.max(0, Math.min(1, u - velocidad.x * 0.12)), v - velocidad.y * 0.12, otra);
        // Nacimiento y desaparición suave al atravesar el extremo abierto de u.
        color.multiplyScalar(Math.min(1, u * 30, (1 - u) * 30));
      }
      for (let s = 0; s < tramos; s++) for (let e = 0; e < 2; e++) {
        const t = (s + e) / tramos, j = (i * tramos * 2 + s * 2 + e) * 3;
        if (modo === 'corriente') (e ? otra.posicion : m.posicion).toArray(posiciones, j);
        else {
          posiciones[j] = m.posicion.x + m.normal.x * largo * t + m.tangente.x * m.excitacion * 0.28 * t * t;
          posiciones[j + 1] = m.posicion.y + m.normal.y * largo * t + m.tangente.y * m.excitacion * 0.28 * t * t;
          posiciones[j + 2] = m.posicion.z + m.normal.z * largo * t + m.tangente.z * m.excitacion * 0.28 * t * t;
        }
        color.toArray(colores, j);
      }
    }
    if (!objeto.visible) return;
    geometria.setDrawRange(0, esLinea ? activos * tramos * 2 : activos);
    geometria.getAttribute('position').needsUpdate = true; geometria.getAttribute('color').needsUpdate = true;
    geometria.computeBoundingSphere(); objeto.frustumCulled = true;
    revision = cuerpo.revision ?? -1; detallePrevio = c.detalle; diagnosticoPrevio = diagnostico; cantidadPrevia = activos; sucio = false;
  }, ...(modo === 'corriente' ? {
    guardar: () => Array.from(uv),
    restaurar(estado: number[]) {
      if (!Array.isArray(estado) || estado.length !== uv.length || !estado.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Corriente incompatible');
      uv.set(estado); sucio = true;
    },
  } : {}), dispose() { geometria.dispose(); material.dispose(); } };
}

export const almacenDisfraces = new AlmacenDisfraces()
  .registrar({ id: 'nacar', nombre: 'Nácar', descripcion: 'Piel continua con vetas que revelan la huella del contacto.', control: 'Veta y rugosidad', requiere: ['malla', 'muestrear'], crear: c => superficie(c, false) })
  .registrar({ id: 'alambre', nombre: 'Alambre', descripcion: 'La trama de triángulos acompaña cada pliegue del cuerpo.', control: 'Rugosidad', requiere: ['malla', 'muestrear'], crear: c => superficie(c, true) });
for (const [id, nombre, descripcion, control] of [
  ['puntos', 'Polvo de puntos', 'Partículas ancladas a la piel conservan su lugar durante el crecimiento.', 'Tamaño'],
  ['punteado', 'Líneas de puntos', 'Hileras recorren las coordenadas del cuerpo y se abren con él.', 'Tamaño'],
  ['peludo', 'Peludo', 'Fibras nacen de la superficie y se curvan con la excitación local.', 'Longitud'],
  ['corriente', 'Corriente', 'Trazadores viajan por un campo corporal sensible a la memoria.', 'Velocidad'],
] as const) almacenDisfraces.registrar({ id, nombre, descripcion, control,
  requiere: id === 'corriente' ? ['muestrear', 'flujo'] : ['muestrear'],
  ...(id === 'peludo' ? { controles: [{ clave: 'cantidad', nombre: 'Cantidad de pelos', min: 50, max: MAX_PELOS, paso: 50, valor: 1000 }] } : {}),
  crear: c => fibras(c, id) });

almacenDisfraces.registrar(disfrazGirih);

almacenDisfraces.registrar(disfrazGirih2);
