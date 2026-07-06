# MIA — Guía de uso
### La ruta de acciones del taller

*Julio 2026 · complementa a PLAN_ESTRATEGICO.md*

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
4. Salones con modelos: **📦 Cargar modelo GLB…** abre el selector de archivos — vale cualquier .glb/.gltf de cualquier carpeta, comprimido con Draco o no. *(El GLB cargado vive solo en la sesión: aún no viaja en las fichas.)*
   - En **Bajo Relieve**, el modelo entra casi plano: pásale el ratón por encima para que la estela lo revele. El salón auto-orienta el relieve (su eje delgado mira a cámara).

**Ruta corta:** `selector → pestaña → sliders → exposición/color`

---

## 3. Coleccionar (las fichas)

- **☆ Guardar ficha** (panel del salón) → nombre → se guarda miniatura + todos los parámetros exactos, incluida la pestaña activa. Persiste entre sesiones (IndexedDB).
- **🗂 Fichas** (abajo derecha) abre la cajonera:
  - **Clic en la card** → recarga la figura idéntica (activa su salón y ajusta el panel).
  - **➕** → la manda al Escenario como actor.
  - **✕** → la borra (pide confirmación).

**Ruta corta:** `figura que te gusta → ☆ → nombre → aparece en 🗂`

---

## 4. Componer (el Escenario)

1. Cajonera → **➕** en las fichas que quieras (el Escenario se activa solo).
2. Panel **🎭 Actores**: cada actor tiene folder con **x / y / z / rotación / escala** y «✕ Quitar».
3. **giro global** (panel derecho) rota la escena entera; si una ficha lleva `giro` propio, ese actor se anima solo.
4. La composición **persiste** aunque salgas del Escenario y vuelvas.
5. **☆ Guardar ficha** estando en el Escenario = guarda **la escena completa** (actores + transforms + miniatura). Clic en esa card después = la escena vuelve entera (reemplaza la composición actual).

**Ruta corta:** `🗂 → ➕➕➕ → acomodar en 🎭 → ☆ para congelar la escena`

---

## 5. Animar (los moduladores)

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
- **En el Escenario**: ⎙ descarga la escena completa — figuras, vistas, colores, transforms y animación, con la partitura JSON embebida en el archivo. *(Límites v1: los actores con GLB se omiten; las caras usan Phong clásico, un tono más cálido.)*
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
