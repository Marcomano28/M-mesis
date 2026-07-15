# MIA — Guía de uso
### La ruta de acciones del taller

*Documento vivo · actualizado el 15 de julio de 2026 · complementa a PLAN_ESTRATEGICO.md*

**Estado actual:** camerinos, fichas y **Escenario v2** utilizables. Los actores ya tienen identidad, visibilidad, transform completo, duplicación y modo estático/dinámico. La cámara de obra, luces escénicas, vestuario por actor y timeline musical todavía no forman parte de la interfaz. Para comprobar cada avance, seguir **[RUTA_DE_PRUEBAS.md](RUTA_DE_PRUEBAS.md)**.

---

## 0. Arrancar

```bash
cd ~/Claude/Projects/Mia
npm run dev        # abre http://localhost:5173
```

Abajo a la izquierda verás el backend activo: **● WebGPU** (verde) u **○ WebGL2 (fallback)** (ámbar). Si algo falla en cualquier momento, aparece un **banner rojo** al pie con el error — ese texto es lo que hay que reportar.

Consola del navegador (F12): `MIA` expone `engine`, `bus`, `galeria` y `motorLFO` para inspección.

---

## 1. El mapa de la pantalla

| Zona | Qué es |
|---|---|
| Arriba izquierda | **MIA — Galería**: selector de salón |
| Arriba derecha | **Panel del salón activo**: sliders, pestañas, botones de fábrica |
| Izquierda (en el Escenario) | **🎭 Actores**: transforms de cada figura colocada |
| Abajo izquierda | **〰 Moduladores**: los LFOs |
| Abajo derecha | **🗂 Fichas (n)**: la cajonera, tu depósito de obra |

---

## 2. Modelar (los salones)

1. Elige salón en el selector.
2. Mueve sliders. En salones con **pestañas** (p.ej. Clásica / SuperFlor), cada pestaña es una variante con sus propios parámetros.
3. En Formas Exóticas, los controles comunes aplican a ambas variantes: **resolución** (densidad de la retícula), **exposición** (Puntos / Alambre / Caras) y **color**.
4. Salones con modelos: **📦 Cargar modelo GLB…** abre el selector de archivos — vale cualquier .glb/.gltf de cualquier carpeta, comprimido con Draco o no. En **Trazo y Grafito**, el GLB importado queda dentro de la ficha: al guardarla, recargarla o mandarla al Escenario reaparece el mismo modelo, no el nudo de muestra.
   - Trazo y Grafito comienza sin giro. Sus controles **fondo**, **líneas** y **polaridad** permiten invertir el papel y el grafito de un gesto.
   - En **Bajo Relieve**, el modelo entra casi plano: pásale el ratón por encima para que la estela lo revele. El salón auto-orienta el relieve (su eje delgado mira a cámara).

**Ruta corta:** `selector → pestaña → sliders → exposición/color`

---

## 3. Coleccionar (las fichas)

- **☆ Guardar ficha** (panel del salón) → el diálogo de MIA pide nombre → se guarda miniatura + todos los parámetros exactos, incluida la pestaña activa. Persiste entre sesiones (IndexedDB).
- **🗂 Fichas** (abajo derecha) abre la cajonera:
  - **Clic en la card** → recarga la figura idéntica (activa su salón y ajusta el panel).
  - **➕** → la manda al Escenario como actor.
  - **✕** → la borra (pide confirmación).

**Ruta corta:** `figura que te gusta → ☆ → nombre → aparece en 🗂`

---

## 4. Componer (el Escenario)

1. Cajonera → **➕** en las fichas que quieras (el Escenario se activa solo).
2. Panel **🎭 Actores**: cada actor tiene identidad estable, nombre, visibilidad, **x / y / z**, rotación XYZ, escala XYZ, duplicar y quitar.
   - **estático (ahorra)** configura la figura una vez y deja de evaluarla cada frame.
   - **dinámico** mantiene vivo el `update()` del camerino: úsalo si gira, respira, reacciona o evoluciona.
3. **giro global** (panel derecho) rota la escena entera; si una ficha lleva `giro` propio, ese actor se anima solo.
4. La composición **persiste** aunque salgas del Escenario y vuelvas. Al restaurar una escena, los actores entran progresivamente —uno por frame— para evitar un bloqueo largo.
5. **☆ Guardar ficha** estando en el Escenario = guarda **la escena completa** (actores + transforms + miniatura). Clic en esa card después = la escena vuelve entera (reemplaza la composición actual).

**Ruta corta:** `🗂 → ➕➕➕ → acomodar en 🎭 → ☆ para congelar la escena`

---

## 5. Animar (los moduladores)

> **Alcance actual:** los moduladores actúan sobre el salón activo y sobre el giro global del Escenario. El ruteo individual hacia `actor:<id>`, cámara y luces llegará con el motor de guion; aún no debe considerarse implementado.

1. Activa el salón (o el Escenario) cuyo parámetro quieras mover.
2. **〰 Moduladores → ➕ Añadir LFO**: el desplegable *destino* ofrece los sliders del salón activo en ese momento.
3. Controles por LFO: **activo** (on/off), **destino**, **forma** (seno, triángulo, sierra, cuadrada, ruido suave), **frecuencia (Hz)**, **amplitud**, **fase**.

Reglas de la casa:
- El slider define la **base**; el LFO **suma** encima. Puedes seguir moviendo el slider con el LFO sonando.
- Apagar o quitar el LFO devuelve el valor exacto donde lo dejaste.
- Varios LFOs pueden apilarse sobre el mismo parámetro.
- El resultado nunca se sale de los límites del slider (clamp automático).
- Las fichas y el Imprimir guardan siempre la **base limpia**, no la oscilación.
- *(Los LFOs viven en la sesión: aún no se guardan en fichas.)*

**Ruta corta:** `salón activo → 〰 → ➕ → destino/forma/frecuencia/amplitud`

---

## 6. Imprimir (exportar)

- **En un salón**: ⎙ descarga un HTML autocontenido (Three.js por CDN) que reproduce la figura con los valores horneados. Se abre con doble clic, sin instalar nada.
- **En el Escenario**: ⎙ descarga una composición HTML con la partitura JSON embebida. Reproduce Formas Exóticas y los actores de Trazo y Grafito, incluyendo su GLB guardado, transform y giro. *(Delaunay y Bajo Relieve aún no tienen reproductor autónomo en el HTML; se avisan en la consola en vez de sustituirse por otra figura.)*
- **↓ Guardar preset**: el JSON de parámetros solo (re-importable vía consola: `MIA.bus.importarPreset(json)`).

---

## 7. El ciclo completo

```
   MODELAR            COLECCIONAR           COMPONER              ANIMAR              IMPRIMIR
  salón + sliders  →  ☆ ficha en 🗂     →  ➕ actores en 🎭   →  〰 LFOs encima   →  ⎙ HTML autónomo
                       (persiste)            (persiste)            (en vivo)            (para el mundo)
```

Y la promesa del Acto II: donde hoy dice 〰 LFO, mañana dirá 🎸 guitarra — misma arquitectura, otra fuente escribiendo en el bus.

---

## 8. Problemas conocidos / trucos

- **Selector de salón desincronizado**: al cargar una ficha de otro salón, el desplegable de arriba-izquierda puede seguir mostrando el nombre anterior (cosmético).
- **Tamaño de punto en WebGPU**: el slider `tamaño punto` solo actúa en fallback WebGL2 (los puntos WebGPU son de 1px por diseño de la API).
- **GLB "invisible" en Bajo Relieve**: sube el slider *aplanado base* para ver el modelo completo sin estela.
- **La miniatura no refleja lo que ves**: la captura toma el frame actual — encuadra antes de ☆.
- **Reset rápido de fichas**: borra la base de datos `mia-fichas` en DevTools → Application → IndexedDB.
- **Cámara actual**: OrbitControls sigue siendo cámara de inspección. Su posición y FOV se guardan en el DocumentoEscena v2, pero todavía no existe una cámara de obra independiente ni pistas de cámara.
- **Luces, vestuario y timeline**: aparecen ya reservados en el documento de escena, pero todavía no tienen herramientas de edición. No deben incluirse como fallos en la ronda actual.

---

## 9. Qué validar en el punto actual

Antes de avanzar a cámara y timeline, la ronda mínima es:

1. Crear al menos dos personajes de familias diferentes.
2. Guardarlos, recargarlos y mandarlos al Escenario.
3. Mover, rotar, escalar, ocultar y duplicar cada actor.
4. Comparar un actor **estático** con otro **dinámico**.
5. Guardar la puesta, salir del Escenario y restaurarla.
6. Confirmar que transforms, nombres, visibilidad y tipo de actuación sobreviven.
7. Repetir con 10 actores y observar si la interfaz se bloquea durante la entrada progresiva.
8. Importar un GLB en Trazo y Grafito, guardar su ficha, recargarla y añadirla al Escenario: debe conservar el modelo importado.
9. Exportar una escena con una supershape y un GLB de Trazo y Grafito: el HTML debe mostrar ambos.

Esta prueba valida los cimientos. La prueba de ópera —música, luces, cámara y coreografía temporal— se añadirá cuando esas piezas existan.
