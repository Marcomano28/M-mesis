# MIA — Plan Estratégico
### El Taller: modelar · coleccionar · componer · (tocar)

*Versión 2.1 — Julio 2026 · sustituye a la v1.0 ("Galería viva")*
*Ruta de acciones del taller: ver **GUIA_DE_USO.md***

---

## 1. Visión (revisada)

MIA nació como una **galería** de efectos con salones. Al construirla apareció su forma verdadera: un **taller con depósito de obra y sala de montaje**. La metáfora actual tiene cuatro espacios:

1. **Los salones (fábricas)** — donde se modela: cada salón es una familia de efectos con panel de controles autogenerado, pestañas de variantes y modos de exposición.
2. **La cajonera (depósito)** — donde se colecciona: las figuras que valen la pena se guardan como **fichas** (cards con miniatura + parámetros exactos), persistentes entre sesiones.
3. **El Escenario (sala de montaje)** — donde se compone: fichas colocadas como **actores** independientes con posición/rotación/escala, en escenas estáticas o animadas (referencia: cascadapaisaje, Processing).
4. **El instrumento (Acto II, futuro)** — donde se toca: guitarra/MIDI modulando los parámetros de todo lo anterior en tiempo real.

La decisión arquitectónica que hace todo esto posible sigue siendo la misma: **los salones solo entienden de parámetros numéricos y no saben de dónde vienen** (slider, ficha, preset, LFO o guitarra).

### Ramificación conceptual: luthería digital

Sin reemplazar la metáfora del taller, aparece una posible rama de largo plazo: MIA como **luthería digital**. No solo un sistema para hacer visuales reactivos, sino un lugar donde se construyen **instrumentos visuales de autor**.

En esta lectura, el ciclo no termina en "generar una figura" ni en "hacer una escena", sino en **tocar formas**:

- **Ficha visual**: una criatura, materia o estado paramétrico diseñado en un salón.
- **Ficha de escena**: una composición de fichas visuales colocadas como actores.
- **Ficha de sinestesia**: una forma de tocar esa escena; el mapeo entre gesto musical y comportamiento visual.
- **Performance grabada**: la interpretación en el tiempo, no solo el preset.

La música no decoraría una imagen: interpretaría una materia visual. Un ataque podría abrir una serpiente, un vibrato podría ondular un campo, un bend podría desplazar la topología de una figura, y el timbre podría navegar entre fichas creadas por el autor. El objetivo conceptual sería pasar de **modelar formas** a **construir instrumentos visuales**.

---

## 2. Estado actual — lo construido y verificado

| Pieza | Estado | Notas |
|---|---|---|
| Motor WebGPU (Three.js r182 + TSL) | ✅ | `WebGPURenderer` con fallback WebGL2; indicador de backend en pantalla |
| Núcleo: ParamBus, contrato Salon, paneles autogenerados (Tweakpane) | ✅ | Pestañas, acciones, tipos `color` y `opciones` (desplegables) |
| Salón **Formas Exóticas** | ✅ GPU | Clásica (Gielis con a/b, perfiles θ/φ independientes, dominio angular, modo nautilus) + SuperFlor evaluadas en vertex shader; resolución 8–512; exposición Puntos/Alambre/Caras; selector de color; normales por diferencias finitas en shader |
| Salón **Trazo y Grafito** (cross-hatching) | ✅ | Tramado procedural TSL por niveles de luz + temblor + grano; importación GLB; pestaña wireframe |
| Salón **Bajo Relieve** | ✅ | Extrusión por estela del puntero (canvas 2D→textura); 6 niveles de textura + paleta cosenoidal; pestaña wireframe; GLB por defecto en `public/` |
| Salón **Delaunay** | ✅ GPU | Triangulación (Delaunator, CPU) + anidado instanciado en GPU (TSL); figura Plano/Room (cara apagable); degradado de color y extrude dentro/fuera por profundidad; poda LOD adaptativa por área de triángulo |
| **Fichas** (cajonera) | ✅ | Captura de miniatura sincronizada con el frame WebGPU; IndexedDB; cargar/borrar; los paneles respetan valores cargados |
| **El Escenario** | ✅ | Botón ➕ en cards → actor con instancia propia del salón (uniforms independientes); transforms por actor; giro global; la composición persiste al navegar |
| **Escenas como fichas** | ✅ | ☆ en el Escenario guarda la composición completa (campo `extra` de la ficha, hooks `estadoExtra`/`cargarEstadoExtra`); clic en la card restaura los actores |
| **Export HTML del Escenario** | ✅ v1 | ⎙ genera HTML autocontenido que reproduce la escena (figuras, vistas, colores, transforms, animación) con la partitura JSON embebida. Actores con GLB se omiten por ahora |
| **Moduladores (LFOs)** | ✅ | Plano de modulación en el bus: base (sliders/fichas) + Σ desplazamientos, con clamp por rango. Panel 〰 global; 5 formas de onda; destino = cualquier slider del salón activo. Fichas y export guardan la base limpia |
| Cargador GLB compartido | ✅ | `core/CargadorGLB.ts` con decoder Draco **local** (`public/draco/`) — funciona offline; auto-orientación de relieves en Bajo Relieve (eje delgado → cámara) |
| Exportador «Imprimir» por salón | ✅ v1 | HTML autocontenido vía CDN con valores horneados |
| Panel de errores en pantalla | ✅ | Excepciones, promesas y console.error visibles; el loop sobrevive a fallos de un salón |
| Depuración | ✅ | `window.MIA` (engine, bus, galeria) expuesto en consola |

**Rendimiento**: las figuras paramétricas se evalúan en GPU — mover un slider solo escribe un uniform (cero regeneración). Solo el cambio de *resolución* reconstruye la retícula. Techo actual holgado; el siguiente salto sería compute shaders para nubes masivas.

---

## 3. Arquitectura (actualizada)

```
┌────────────────────────────────────────────────────────────┐
│  SHELL     selector de salones · cajonera de fichas        │
│            panel de errores · panel de actores (Escenario) │
├────────────────────────────────────────────────────────────┤
│  NÚCLEO    ParamBus · Engine (WebGPU + captura de frame)   │
│            AlmacenFichas (IndexedDB) · exportador          │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ Formas       │ Trazo y      │ Bajo         │ EL ESCENARIO  │
│ Exóticas     │ Grafito      │ Relieve      │ (compone      │
│ (GPU/TSL)    │ (TSL)        │ (TSL+estela) │  actores)     │
├──────────────┴──────────────┴──────────────┴───────────────┤
│  FÁBRICAS   salonId → () => new Salon()                    │
│  (el Escenario instancia salones como actores)             │
├────────────────────────────────────────────────────────────┤
│  FUENTES    sliders/paneles · fichas · [LFOs] · [audio/MIDI]│
└────────────────────────────────────────────────────────────┘
```

**Conceptos clave añadidos desde v1:**

- **Ficha**: `{ id, nombre, salonId, params, miniatura, fecha }`. El preset con cara. Persistente (IndexedDB). Es la unidad de colección Y la unidad de composición.
- **Fábricas**: registro `salonId → constructor`. Permite al Escenario crear instancias frescas de cualquier salón (uniforms y materiales propios por actor) sin conocerlos. Un salón nuevo queda disponible como actor con una línea en `main.ts`.
- **`recibirFicha()`**: hook opcional del contrato Salon — cualquier salón puede aceptar fichas (hoy solo el Escenario lo implementa).
- **Actor**: `{ ficha (params congelados), transform {x,y,z,rotY,escala} }`. Su animación viene de los parámetros de la ficha (giro, etc.) más el giro global de escena.
- **Modos de exposición**: Puntos / Alambre / Caras como atributo estándar (hoy en Formas Exóticas; generalizable vía el tipo `opciones` del ParamDef).

**Lecciones de runtime que ya son reglas del proyecto:**

- `NodeMaterial` base es abstracto (r167+): usar siempre subclases (`MeshBasicNodeMaterial`, etc.).
- El canvas WebGPU se vacía tras presentar: toda captura se hace dentro del loop, tras `render()`.
- Tweakpane puede emitir `select` con índice −1 al destruir paneles: los valores de modo se blindan en ambos extremos.
- Los salones deben resetear su estado interno (firmas de geometría) en `init()` — se reentran.
- Compilar ≠ funcionar: verificar en navegador (extensión Chrome + `window.MIA` + panel de errores).

---

## 4. Los salones

| # | Salón | Estado | Contenido |
|---|---|---|---|
| 1 | **Formas Exóticas** | ✅ GPU | Supershape clásica (Gielis a/b, θ/φ independientes, nautilus) + SuperFlor combinada abierta (supeFlower). Resolución/vistas/color |
| 2 | **Trazo y Grafito** | ✅ | Cross-hatching + sketchy pencil sobre GLB (refs: spite/sketch, Codrops) |
| 3 | **Bajo Relieve** | ✅ | Relieve revelado por estela del puntero (ref: proyecto immersive) |
| 4 | **Delaunay** | ✅ GPU | Triangulación (Delaunator) + anidado instanciado; figura Plano/Room; degradado, extrude, LOD adaptativo (ref: Room.js propio) |
| — | **El Escenario** | ✅ MVP | Sala de montaje: no es una fábrica, compone las demás |
| 5 | Materia de Puntos | ◻ planificado | Partículas masivas, campos de flujo, cascadas (ref: cascadapaisaje) — compute shaders |
| 6 | Campos y Ruido | ◻ planificado | FBM, domain warping, texturas vivas |
| 7 | Líneas y Trazos | ◻ planificado | Ribbons, atractores, caligrafía generativa |
| 8 | Materiales Imposibles | ◻ planificado | Vidrio, iridiscencia, refracción |
| 9 | Luz y Atmósfera | ◻ planificado | Volumétricos, raymarching, bloom esculpido |

---

## 5. Hoja de ruta (revisada tras el Escenario)

**Fase A — Madurar el ciclo taller** ✅ *(completada salvo pulidos)*
- ~~Escenas guardadas como fichas~~ ✅ · ~~Export HTML del Escenario~~ ✅ v1
- Pulidos pendientes: sincronizar el selector de salón al cargar fichas; tamaño de punto en WebGPU (sprites instanciados); GLB dentro de fichas (binario en IndexedDB); actores GLB en el export.

**Fase B — Respiración (antesala del instrumento)** — en curso
- ~~LFOs en el ParamBus~~ ✅ — plano de modulación funcionando; la guitarra escribirá en este mismo plano.
- **Moduladores en fichas**: guardar los LFOs dentro de la ficha/escena (hoy viven solo en la sesión).
- **Modular transforms de actores**: rutear x/y/z/rotY/escala del Escenario por el bus para que también respiren.
- **Grabación de gestos**: grabar el movimiento de sliders y reproducirlo.
- **Sincronía musical**: tempo global (BPM) y frecuencias como ratios (1/2, 1/4…) en vez de Hz sueltos.

**Fase C — Poblar el taller**
- Salones 4–8, priorizando **Materia de Puntos** (compute shaders TSL; tu cascada de 20k puntos → millones GPU-residentes).

**Fase D — El instrumento (Acto II)** · *diseño en tres niveles*

*Nivel 1 — Extracción (señal → rasgos → gestos).* Jerarquía por escala temporal:
- **Rasgos instantáneos** (~10ms, salen de librería): energía/RMS, pitch f0 (YIN), centroide espectral (brillo), flatness (rugosidad), onsets. Stack: Web Audio + AudioWorklet, Meyda para empezar → Essentia.js (WASM) cuando haga falta MIR serio. Web MIDI si hay pastilla.
- **Gestos** (~100ms–1s, capa artesanal propia — NO vienen en ninguna librería): vibrato = LFO de 5–7Hz que el músico ejecuta sobre f0 (detectar oscilación → frecuencia + profundidad); staccato/legato = relación envolvente de ataque ↔ silencio; bends = deriva continua de f0; dinámica.
- **Textura/frase** (1–10s): densidad de notas, tesitura, cromagrama → tensión armónica.
- Analogía guía: fonemas (rasgos) → palabras (gestos) → frases (textura).

*Recomendación técnica para extraer matices musicales.*
- **Base nativa**: Web Audio API para entrada de micrófono/audio y Web MIDI API para controladores, pastillas MIDI, teclados y pedales.
- **Baja latencia**: mover el análisis continuo a AudioWorklet cuando el prototipo salga del panel y entre en modo actuación.
- **Primera librería**: Meyda para rasgos rápidos de timbre y energía: RMS, centroide espectral, rolloff, flatness, MFCC, loudness y flux.
- **Segunda capa**: Essentia.js cuando hagan falta rasgos MIR más serios: pitch estable, onsets robustos, beat/tempo, chroma/HPCP, tonalidad, disonancia o clasificadores de timbre.
- **Capa propia de MIA**: `MotorGestosMusicales`, construido encima de esas señales. Aquí viven vibrato, bend, staccato/legato, tensión, densidad, respiración y fraseo. Esta capa es autoral: las librerías extraen datos, pero MIA decide qué es un gesto visualmente significativo.
- **Salida común**: todos los rasgos y gestos terminan como fuentes normalizadas en la Mesa de Sinestesia, que escribe modulaciones en el `ParamBus`.

*Nivel 2 — Traducción: la MATRIZ DE MAPEO (la interfaz donde vive la estética).*
- Mesa de ruteo modular: fuentes × destinos (direcciones del bus). Por celda: **curva** (log para pitch, compresión para dinámica), **rango**, y **suavizado asimétrico** (ataque rápido / caída lenta, como un compresor — ahí se decide si el visual es nervioso o elástico).
- Mapeos 1:N (un ataque dispara pulso+color+escala) y N:1 (tensión visual = rugosidad+densidad+disonancia).
- Cada configuración = **ficha de sinestesia** (una por pieza/improvisación).
- Ya construido el lado receptor: el plano de modulación del bus. La guitarra solo añade fuentes.
- Prototipable HOY con fuentes falsas (ratón, LFOs) antes de tener audio.

*Nivel 3 — IA pequeña y bien situada (no end-to-end).*
- ❌ Descartado: modelos generativos audio→imagen (píxeles ajenos, latencia alta, disuelve el lenguaje propio).
- ✅ **Clasificadores ligeros entrenados con ejemplos propios** (TensorFlow.js, estilo Teachable Machine): ~30 muestras por articulación (staccato/legato/palm mute) → fuente de alto nivel "articulación" imposible de obtener de Meyda.
- ✅ **Embeddings de audio → navegación entre fichas**: el timbre proyectado a un espacio continuo, mapeado al espacio de parámetros de las fichas → la guitarra interpola entre figuras que el autor creó. La IA da mejores fuentes y mejores destinos; la composición sinestésica sigue siendo del autor.

*Cierre de fase:* modo actuación (fullscreen sin UI, el Escenario como paisaje reactivo). Latencia esperada en navegador: 10–20ms para ataques/energía, 30–60ms para pitch (limitado por física de la onda, no por el navegador; percepción audiovisual integra como simultáneo hasta ~80–100ms). Si en directo molesta: Tauri, mismo código.

*Deriva posible:* el instrumento puede convertirse en una rama propia de luthería digital: presets de instrumento por escena, fichas de sinestesia compartibles, grabación/reproducción de performances, y export de piezas interpretadas. Esta rama convive con el taller generativo; no lo sustituye.

---

## 6. Riesgos y decisiones abiertas

- **Exportador del Escenario**: componer los códigos de varios salones en un solo HTML es la parte con más incógnitas — prototipar temprano en Fase A.
- **Fichas y assets**: las fichas de Trazo y Grafito / Bajo Relieve no guardan el GLB (montan el modelo por defecto). Decidir: ¿binarios en IndexedDB o referencia a archivo?
- **Puntos en WebGPU**: tamaño fijo 1px por diseño de la API — resolver con sprites instanciados cuando toque (habilita además tamaño por punto modulable).
- **Crecimiento del panel de actores**: con >10 actores hará falta agrupar/plegar; evaluar entonces si el Escenario merece UI propia fuera de Tweakpane.

---

## 7. Recursos

- Three.js WebGPU/TSL: [docs oficiales](https://threejs.org), [wiki TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language), [novedades 2026](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Supershapes: fórmula de Gielis (Paul Bourke)
- Referencias propias portadas: supeFlower (R3F), immersive (ssam/WebGPU), cascadapaisaje (Processing)
- Estética: spite/sketch, [Codrops Sketchy Pencil](https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/), The Book of Shaders, shadertoy
- Audio (Fase D): [Essentia.js](https://mtg.github.io/essentia.js/), Meyda, Web MIDI API
