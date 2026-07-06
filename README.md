# MIA

**Un taller de arte generativo en el navegador** — modelar, coleccionar, componer y (pronto) tocar figuras paramétricas evaluadas en la GPU con Three.js WebGPU + TSL.

MIA nació como una galería de efectos y se convirtió en un **taller con depósito de obra y sala de montaje**. Eliges un salón (una familia de efectos), mueves sus controles, guardas las figuras que valen la pena como *fichas*, las combinas en escenas y las animas — y exportas cualquiera de ellas como un HTML autónomo.

> Documentación en profundidad: **[GUIA_DE_USO.md](GUIA_DE_USO.md)** (la ruta de acciones paso a paso) y **[PLAN_ESTRATEGICO.md](PLAN_ESTRATEGICO.md)** (visión, arquitectura y hoja de ruta).

---

## La idea

El taller tiene cuatro espacios:

1. **Los salones (fábricas)** — donde se *modela*: cada salón es una familia de efectos con panel de controles autogenerado, pestañas de variantes y modos de exposición (Puntos / Alambre / Caras).
2. **La cajonera (depósito)** — donde se *colecciona*: las figuras se guardan como **fichas** (miniatura + parámetros exactos), persistentes entre sesiones en IndexedDB.
3. **El Escenario (sala de montaje)** — donde se *compone*: las fichas se colocan como **actores** independientes con su propia posición, rotación y escala.
4. **El instrumento (futuro)** — donde se *tocará*: guitarra / MIDI modulando en tiempo real los parámetros de todo lo anterior.

La decisión de arquitectura que lo hace posible: **los salones solo entienden de parámetros numéricos y no saben de dónde vienen** — un slider, una ficha, un preset, un LFO o, mañana, una guitarra. Todas esas fuentes escriben en un mismo bus de parámetros (`ParamBus`); el salón solo lee.

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
│  FUENTES   sliders · fichas · LFOs · [audio/MIDI futuro]   │
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
| **El Escenario** | La sala de montaje: coloca fichas como actores, con transforms por actor y giro global. Las escenas se guardan como fichas completas. |

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
  MODELAR            COLECCIONAR         COMPONER            ANIMAR            IMPRIMIR
 salón + sliders  →  ☆ ficha en 🗂   →  ➕ actores en 🎭  →  〰 LFOs encima  →  ⎙ HTML autónomo
                     (persiste)          (persiste)          (en vivo)          (para el mundo)
```

- **Modelar** — elige salón, mueve sliders; en salones con pestañas, cada una es una variante.
- **Coleccionar** — *☆ Guardar ficha* guarda miniatura + parámetros exactos (persisten entre sesiones).
- **Componer** — desde la cajonera, *➕* manda una ficha al Escenario como actor; acomódalo en el panel 🎭.
- **Animar** — *〰 Moduladores* añade LFOs que suman sobre la base del slider (con clamp por rango).
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

El ciclo del taller (modelar → coleccionar → componer → animar → imprimir) está funcionando. En curso: guardar los LFOs dentro de las fichas y modular los transforms de los actores. Después: los salones de compute shaders (partículas masivas) y, como Acto II, el instrumento musical escribiendo en el mismo bus. Detalle completo en **[PLAN_ESTRATEGICO.md](PLAN_ESTRATEGICO.md)**.

---

<sub>μίμησις — *mímēsis*: "imitación", "representación". El acto de representar o imitar la realidad; en estética y filosofía, asociado a Platón y Aristóteles.</sub>
