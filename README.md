# MIA

**Un taller e instrumento audiovisual en el navegador** — modelar, coleccionar, componer y tocar figuras paramétricas evaluadas en la GPU con Three.js WebGPU + TSL.

MIA nació como una galería de efectos y se convirtió en un **taller con depósito de obra y sala de montaje**. Eliges un salón (una familia de efectos), mueves sus controles, guardas las figuras que valen la pena como *fichas*, las combinas en escenas y las animas — y exportas cualquiera de ellas como un HTML autónomo.

> Documentación: **[GUIA_DE_USO.md](GUIA_DE_USO.md)** (uso), **[PLAN_ESTRATEGICO.md](PLAN_ESTRATEGICO.md)** (arquitectura) y **[RUTA_AL_VIDEOCLIP.md](RUTA_AL_VIDEOCLIP.md)** (pasos técnicos hasta una performance grabada).

---

## La idea

El taller tiene cuatro espacios:

1. **Los salones (fábricas)** — donde se *modela*: cada salón es una familia de efectos con panel de controles autogenerado, pestañas de variantes y modos de exposición (Puntos / Alambre / Caras).
2. **La cajonera (depósito)** — donde se *colecciona*: las figuras se guardan como **fichas** (miniatura + parámetros exactos), persistentes entre sesiones en IndexedDB.
3. **El Escenario (sala de montaje)** — donde se *compone*: las fichas se colocan como **actores** independientes con su propia posición, rotación y escala.
4. **El instrumento (en construcción)** — donde se *toca*: micrófono, guitarra/MIDI, ratón y memoria modulando la escena completa o los hilos de cada actor.

La decisión de arquitectura que lo hace posible: **los salones solo entienden de parámetros numéricos y no saben de dónde vienen** — un slider, una ficha, un preset, un LFO o, mañana, una guitarra. Todas esas fuentes escriben en un mismo bus de parámetros (`ParamBus`); el salón solo lee.

Una ramificación conceptual posible, desarrollada en el plan, es MIA como **luthería digital**: no solo generar visuales para música, sino construir instrumentos visuales de autor. En esa lectura, las fichas visuales, las escenas y los mapeos de sinestesia pueden convertirse en materiales tocables, grabables y exportables. La recomendación técnica para esa rama es una cadena Web Audio/Web MIDI → Meyda → Essentia.js → gestos propios de MIA → Mesa de Sinestesia → `ParamBus`.

```
┌────────────────────────────────────────────────────────────┐
│  SHELL     selector de salones · cajonera · panel de errores│
├────────────────────────────────────────────────────────────┤
│  NÚCLEO    ParamBus · Engine (WebGPU + captura de frame)    │
│            Fichas (IndexedDB) · exportador                  │
├───────────┬───────────┬───────────┬──────────┬─────────────┤
│ Formas    │ Trazo y   │ Bajo      │ Delaunay │ EL ESCENARIO│
│ Exóticas  │ Grafito   │ Relieve   │          │ (compone)   │
├───────────┴───────────┴───────────┴──────────┴─────────────┤
│  FUENTES   sliders · fichas · LFOs · audio/MIDI · memoria  │
└────────────────────────────────────────────────────────────┘
```

---

## Los salones

| Salón | Qué hace |
|---|---|
| **Formas Exóticas** | Supershapes de Gielis evaluadas en el vertex shader. Variante *Clásica* (con divisores de eje a/b, perfiles θ/φ independientes, dominio angular configurable y modo *nautilus* espiral) y *SuperFlor* (superficie abierta combinada). Resolución 8–512, exposición Puntos/Alambre/Caras, color. |
| **Trazo y Grafito** | Cross-hatching y lápiz *sketchy* procedural en TSL por niveles de luz, con temblor y grano. Importa modelos GLB. |
| **Bajo Relieve** | Relieve revelado por la estela del puntero (canvas 2D → textura), con paleta cosenoidal. Trae un GLB por defecto. |
| **Delaunay** | Triangulación de Delaunay sobre un plano o una *room* (cubo con una cara apagable para ver dentro). Cada triángulo se dibuja con copias anidadas escaladas y giradas, instanciadas en la GPU en una sola *draw call*; degradado entre dos colores según la profundidad, extrude hacia dentro/fuera y poda LOD adaptativa. |
| **El Escenario** | Coloca fichas como actores con identidad, pose XYZ y expresiones propias; las fuentes vivas pueden accionar sus hilos individualmente. |

Salones planificados (ver plan): Materia de Puntos (compute shaders), Campos y Ruido, Líneas y Trazos, Materiales Imposibles, Luz y Atmósfera.

---

## Stack

- **[Three.js](https://threejs.org) r182 · WebGPU + TSL** — geometría paramétrica evaluada en el shader; `WebGPURenderer` con *fallback* automático a WebGL2.
- **TypeScript** + **[Vite](https://vitejs.dev)** — dev server y build.
- **[Tweakpane](https://tweakpane.github.io/docs/)** — paneles de control autogenerados desde la definición de cada parámetro.
- **[Delaunator](https://github.com/mapbox/delaunator)** — triangulación (salón Delaunay).
- **IndexedDB** — persistencia de fichas. **Draco** (decoder local en `public/draco/`) — carga de GLB comprimidos, offline.

---

## Requisitos

- **Node.js ≥ 20.19** (lo pide Vite 7).
- Un navegador con **WebGPU** (Chrome/Edge recientes recomendado). Sin WebGPU cae a WebGL2 automáticamente; el backend activo se indica abajo a la izquierda (**● WebGPU** verde / **○ WebGL2** ámbar).

---

## Arranque

```bash
npm install
npm run dev        # http://localhost:5173
```

Otros scripts:

```bash
npm run build      # typecheck (tsc) + build de producción a dist/
npm run preview    # sirve el build de producción
```

En la consola del navegador (F12), `window.MIA` expone `engine`, `bus`, `galeria` y `motorLFO` para inspección. Si algo falla, un banner rojo al pie muestra el error.

---

## El ciclo de trabajo

```
  MODELAR            COLECCIONAR         COMPONER            INTERPRETAR       IMPRIMIR
 salón + sliders  →  ☆ ficha en 🗂   →  ➕ actores en 🎭  →  audio/rutas     →  ⎙ HTML autónomo
                     (persiste)          (persiste)          (en vivo)          (para el mundo)
```

- **Modelar** — elige salón, mueve sliders; en salones con pestañas, cada una es una variante.
- **Coleccionar** — *☆ Guardar ficha* guarda miniatura + parámetros exactos (persisten entre sesiones).
- **Componer** — desde la cajonera, *➕* manda una ficha al Escenario como actor; acomódalo en el panel 🎭.
- **Interpretar** — LFO, ratón, micrófono o MIDI actúan sobre la escena o cada actor sin alterar su pose base.
- **Imprimir** — *⎙* descarga un HTML autocontenido que reproduce la figura con los valores horneados; se abre con doble clic, sin instalar nada.

Los pasos completos, con atajos y trucos, están en **[GUIA_DE_USO.md](GUIA_DE_USO.md)**.

---

## Estructura del proyecto

```
src/
  core/      Engine (WebGPU), ParamBus, contrato Salon, Fichas (IndexedDB),
             Moduladores (LFOs), CargadorGLB (Draco local)
  salones/   supershapes/ · crosshatch/ · bajorelieve/ · delaunay/ · escenario/
  shell/     Galeria, Paneles, Cajonera, PanelModuladores, panel de errores
  main.ts    punto de entrada: motor + bus + registro de salones
public/      assets (GLB de ejemplo, decoder Draco)
GeoNodes/    exportaciones de árboles de Geometry Nodes de Blender (referencia
             de portado a TSL)
```

Añadir un salón nuevo es crear su clase (implementando el contrato `Salon`) y registrarla con una línea en `main.ts`; su panel se autogenera desde la lista de parámetros.

---

## Estado

El ciclo del taller, los hilos individuales y su persistencia en DocumentoEscena v3 están funcionando. El siguiente hito es crear un transporte musical común; después vendrán el registro de performance y la captura de audio/vídeo. El destino y sus criterios técnicos están en **[RUTA_AL_VIDEOCLIP.md](RUTA_AL_VIDEOCLIP.md)**.

---

<sub>μίμησις — *mímēsis*: "imitación", "representación". El acto de representar o imitar la realidad; en estética y filosofía, asociado a Platón y Aristóteles.</sub>
