# MIA — Plan Estratégico
### El Taller: modelar · coleccionar · componer · (tocar)

*Versión 2.2 — Julio 2026 · sustituye a la v1.0 ("Galería viva")*
*Ruta de acciones del taller: ver **GUIA_DE_USO.md***
*Fundamento conceptual y plano del templo: ver **BIBLIA_CONCEPTUAL.md** (este plan ejecuta; la biblia orienta)*
*Camino técnico hasta una obra grabada: ver **[RUTA_AL_VIDEOCLIP.md](RUTA_AL_VIDEOCLIP.md)***

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
| **El Escenario v3** | ✅ | Actores con ID estable, transform XYZ, visibilidad, duplicación, actividad y actuación persistente |
| **Hilos individuales** | ✅ | Pose y expresiones seguras direccionadas como `actor:<id>...`; ratón, LFO, memoria y audio pueden actuar por personaje |
| **Hilos por ficha** | ✅ | Cada salón declara catálogo seguro; el autor exporta solo los elegidos y la cajonera muestra su cantidad |
| **Escenas como fichas** | ✅ | ☆ guarda DocumentoEscena, actores y assets GLB de Trazo; clic en la card restaura la puesta |
| **Export HTML del Escenario** | 🟡 | Reproduce Formas Exóticas y Trazo/GLB con transforms. Delaunay, Relieve, rutas, cámara de obra y runtime musical aún no están unificados |
| **Moduladores (LFOs)** | ✅ | Base + Σ desplazamientos con clamp; cinco ondas y destinos de salón/actor |
| **Mesa de Sinestesia** | ✅ MVP | Micrófono, MIDI, ratón y pulso → destino con rango, curva, ataque y caída; las rutas viajan con la escena; falta matriz de grupos |
| **Coreografía persistente** | ✅ MVP | DocumentoEscena v3 guarda/restaura rutas, LFOs y acumuladores y limpia referencias al quitar actores |
| Cargador GLB compartido | ✅ | Draco local; Trazo guarda el binario en ficha y lo transporta al Escenario/export |
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
│  FUENTES    sliders · fichas · LFOs · audio/MIDI · memoria │
└────────────────────────────────────────────────────────────┘
```

**Conceptos clave añadidos desde v1:**

- **Ficha**: `{ id, nombre, salonId, params, miniatura, fecha }`. El preset con cara. Persistente (IndexedDB). Es la unidad de colección Y la unidad de composición.
- **Fábricas**: registro `salonId → constructor`. Permite al Escenario crear instancias frescas de cualquier salón (uniforms y materiales propios por actor) sin conocerlos. Un salón nuevo queda disponible como actor con una línea en `main.ts`.
- **`recibirFicha()`**: hook opcional del contrato Salon — cualquier salón puede aceptar fichas (hoy solo el Escenario lo implementa).
- **Actor**: ficha + ID estable + transform XYZ + actividad. Sus hilos usan direcciones `actor:<id>.transform.*` y `actor:<id>.param.*`; las rutas musicales modulan sin destruir la base.
- **Hilo de ficha**: capacidad local segura (`transform.rotY`, `param.temblor`, etc.) con categoría, coste, escala temporal y afinidades musicales. El ID global solo se asigna al convertir la ficha en actor.
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
- Escenas v2, GLB de Trazo dentro de fichas, actores GLB en export y hilos individuales ✅
- Pulidos pendientes: sincronizar selector; sprites instanciados para puntos WebGPU; sustituir plantillas parciales de export por un `RuntimeEscena` compartido.

### Las etapas del templo (implementación de la BIBLIA_CONCEPTUAL)

Principio de ordenación: **las etapas 1–3 no necesitan guitarra** (se prueban con LFOs y ratón como fuentes falsas — toda la dramaturgia se valida en seco); las 4–6 traen el oído; la 7 necesita historia que leer; la 8 refina. Cada etapa deja el taller usable.

**Etapa 1 — Acumuladores de Frase** ✅ *(la primera memoria)*
- Fuentes internas que integran historia: tensión (energía acumulada con fuga), densidad (eventos/seg), meseta (tiempo sin cambio significativo). Escriben en el plano de modulación como cualquier LFO; panel con monitores.
- Sin audio: se alimentan de la actividad de los LFOs y del ratón.
- *Criterio de éxito:* una figura que responde a la **historia** de una señal, no a su instante — se ve la diferencia a ojo.

**Etapa 2 — El Barniz v1** *(la gramática estética)*
- Ficha de barniz: paleta (rangos), gramática de movimiento (suavizados globales asimétricos), materia (vistas/grano), presupuesto de caos. Aplicable sobre cualquier salón o escena; slider de interpolación entre dos barnices.
- Los transforms de actores y la actuación ya viajan en DocumentoEscena v3; el Barniz podrá apoyarse en ese contrato persistente.
- *Criterio:* la misma escena atravesando dos barnices produce dos mundos reconocibles.

**Etapa 3 — El protocolo de la Semilla** *(la dramaturgia)*
- Máquina de etapas dimensionales (silencio→punto→línea→curva→superficie→volumen→constelación) como **presupuesto de manifestación** global (diafragma sobre el vocabulario visual, no escenas separadas). Germinación primero manual (slider), luego automática vía acumuladores de Etapa 1. Reversible. Modo actuación (fullscreen sin UI).
- *Criterio:* un viaje completo de 3 minutos conducido solo con LFOs que se sienta narrado, no agitado.

**Etapa 4 — El oído crudo** *(entra la guitarra)*
- Prototipo actual: `AnalyserNode`, RMS/ataque, micrófono y MIDI ✅. Producción pendiente: AudioWorklet + rasgos espectrales + **calibración por sesión**, monitor y medición de latencia real.
- *Criterio:* rasgos visibles en vivo; onset→pulso visual sintiéndose instantáneo.

**Etapa 5 — La Matriz de Mapeo** *(el oído aprende a traducir)*
- Mesa v1 operativa ✅: fuente, destino individual/global, curva, rango, suavizado asimétrico, persistencia y destinos filtrados por ficha. Cada hilo ya lleva afinidades con energía/ataque/altura/brillo/textura/pulso/armonía. Falta matriz 1:N/N:1, grupos, sugerencias semánticas y fichas de sinestesia independientes.
- *Criterio:* cambiar de ficha de sinestesia en vivo transforma el carácter del viaje sin tocar código.

**Etapa 6 — Los Gestos** *(el vocabulario del músico)*
- Capa artesanal sobre f0/envolvente: pitch estable (YIN/Essentia), vibrato (oscilación 5–7Hz sobre f0 → frecuencia+profundidad), staccato/legato, bends. Cada gesto = fuente nueva en la matriz.
- *Criterio:* el vibrato del guitarrista mueve visiblemente algo que la energía sola no mueve.

**Etapa 7 — El Narrador v1** *(el órgano del tiempo)*
- Máquina de estados **legible**: lee acumuladores + historial de gestos; decide transiciones de la Semilla, cambios de universo (fichas/escenas), transiciones de Barniz y presupuesto de densidad. Iniciativa acotada con cooldown (propuestas que invitan a responder). **Bitácora en pantalla**: cada decisión del Narrador se muestra en texto — la legibilidad es requisito, no lujo.
- *Criterio:* en una improvisación de 10 minutos, el músico siente que "el sistema entendió la pieza" — y puede leer en la bitácora por qué hizo lo que hizo.

**Etapa 8 — El dueto profundo (IA pequeña)** *(v2 de todo)*
- Clasificadores de articulación entrenados con tus ejemplos (TF.js, ~30 muestras por clase). Embeddings de timbre → navegación continua entre fichas. Narrador entrenado con tus preferencias (cuándo TÚ habrías cambiado de escena). Empaquetado Tauri si la Etapa 4 midió latencias molestas.
- *Criterio:* el sistema distingue tu palm mute de tu legato y cada uno abre una puerta visual distinta.

**Horizonte — El Director de Escena (modelo + skill de MIA)** *(idea deliberadamente abierta)*
- Un modelo recibe una caja de herramientas limitada y explícita: consultar fichas/actores, analizar la forma musical, crear grupos, escribir pistas y cues, graduar la respuesta sonora, vestir actores, colocar luces y coreografiar cámaras.
- Su salida no es vídeo ni código arbitrario: es un `DocumentoEscena` válido, determinista y editable con los mismos destinos que usa el timeline humano.
- Puede proponer variantes de dirección —sobria, dramática, coral, reactiva— y explicar cada decisión: qué escucha, qué actor mueve, con qué intensidad y durante cuánto tiempo.
- El grado de autonomía es graduable por capa: sugerir solamente; escribir un borrador; dirigir dentro de límites bloqueados por el autor; o improvisar en vivo con presupuesto de cambio y posibilidad de detenerlo.
- El autor conserva el vocabulario y la última palabra. Actores, vestuarios y gramática visual provienen de los salones; el Director selecciona, relaciona y ordena.
- *Condición previa:* cámara, luces, transformaciones de actor, timeline, transporte musical y rutas de modulación deben compartir un contrato direccionable y serializable. Construir bien esas herramientas es construir desde ahora la futura `skill` del Director.
- *Criterio futuro:* dada una pieza y un reparto, produce una primera coreografía legible que el autor prefiera editar antes que comenzar desde cero, sin borrar la identidad de MIA.

*Herederos menores (se cuelan donde quepan):* grabación de gestos de sliders; sincronía BPM/ratios en LFOs (natural en Etapa 5); pulidos de Fase A.

**Vía paralela — Poblar el taller** *(no bloquea ninguna etapa; se intercala cuando apetezca)*
- Salones nuevos, priorizando **Materia de Puntos** (compute shaders TSL; tu cascada de 20k puntos → millones GPU-residentes). Cada salón nuevo enriquece automáticamente fichas, Escenario, moduladores y — llegado el momento — la matriz.
- Notas de referencia (IQ): **Campos y Ruido** con H de Hurst expuesto como slider (fBM ya implementado en 1D para LFOs; llevarlo a 2D/3D en shader); **Líneas y Trazos** con AABBs de Béziers ([bboxes2d](https://iquilezles.org/articles/bboxes2d/)) para culling de curvas en masa; el mismo culling servirá al Escenario con decenas de actores. Mapeo futuro: pendiente espectral del timbre → H (ver biblia §II.4).

### Referencia de diseño del instrumento · *tres niveles (soporta las Etapas 4–8)*

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

- **Reloj y sincronía**: audio, render, timeline y captura no pueden avanzar con relojes independientes. El tiempo de Web Audio será la referencia.
- **Exportador del Escenario**: las plantillas parciales divergen del editor. Debe extraerse un runtime único usado por editor, replay, HTML y render.
- **Fichas y assets**: Trazo ya guarda GLB; falta deduplicación por hash y aplicar el mismo contrato a Bajo Relieve.
- **Captura**: la toma directa preserva la espontaneidad pero también los frames perdidos. Se combinará con replay determinista para master.
- **Rutas**: ya viajan en DocumentoEscena v3; la siguiente ampliación será separar ensayo/obra y añadir grupos y mezcla 1:N/N:1.
- **Puntos en WebGPU**: tamaño fijo 1px por diseño de la API — resolver con sprites instanciados cuando toque (habilita además tamaño por punto modulable).
- **Crecimiento del panel de actores**: con >10 actores hará falta agrupar/plegar; evaluar entonces si el Escenario merece UI propia fuera de Tweakpane.

La secuencia operacional y los criterios de terminado están desarrollados en **[RUTA_AL_VIDEOCLIP.md](RUTA_AL_VIDEOCLIP.md)**.

---

## 7. Recursos

- Three.js WebGPU/TSL: [docs oficiales](https://threejs.org), [wiki TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language), [novedades 2026](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Supershapes: fórmula de Gielis (Paul Bourke)
- Referencias propias portadas: supeFlower (R3F), immersive (ssam/WebGPU), cascadapaisaje (Processing)
- Estética: spite/sketch, [Codrops Sketchy Pencil](https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/), The Book of Shaders, shadertoy
- Audio (Fase D): [Essentia.js](https://mtg.github.io/essentia.js/), Meyda, Web MIDI API
