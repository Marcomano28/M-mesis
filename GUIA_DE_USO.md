# MIA — Guía de uso
### La ruta de acciones del taller

*Documento vivo · actualizado el 24 de julio de 2026 · complementa a PLAN_ESTRATEGICO.md y RUTA_AL_VIDEOCLIP.md*

**Estado actual:** camerinos, fichas y **Escenario v3** utilizables. Cada personaje exporta una selección propia de **hilos individuales y gestos corporales persistentes**; una ficha de escena conserva rutas de sinestesia, LFOs, acumuladores, su **transporte musical**, el **Barniz** (el paisaje de coherencia — Etapa 2, §5b), el **Narrador** (el órgano del tiempo — Etapa 7, §5c) y la **Semilla** (la ontogénesis visual — Etapa 3, §5d). La cámara de obra, luces escénicas, vestuario por actor y pistas/keyframes todavía no forman parte de la interfaz. Para comprobar cada avance, seguir **[RUTA_DE_PRUEBAS.md](RUTA_DE_PRUEBAS.md)**.

---

## 0. Arrancar

```bash
cd ~/Claude/Projects/Mia
npm run dev        # abre http://localhost:5173
```

Abajo a la izquierda verás el backend activo: **● WebGPU** (verde) u **○ WebGL2 (fallback)** (ámbar). Si algo falla en cualquier momento, aparece un **banner rojo** al pie con el error — ese texto es lo que hay que reportar.

Consola del navegador (F12): `MIA` expone `engine`, `bus`, `galeria`, `transporte` y los motores de actuación para inspección.

---

## 1. El mapa de la pantalla

| Zona | Qué es |
|---|---|
| Arriba izquierda | **MIA — Galería**: selector de salón |
| Arriba derecha | **Panel del salón activo**: sliders, pestañas, botones de fábrica |
| Izquierda (en el Escenario) | **🎭 Actores**: transforms de cada figura colocada |
| Abajo izquierda | **〰 Moduladores**: los LFOs |
| Abajo, junto a Moduladores | **◇ Mesa de Sinestesia**, **◈ Barniz (paisaje)**, **📖 Narrador (dramaturgia)** y **🌱 Semilla (manifestación)** |
| Abajo centro | **♫ Transporte**: reloj común, BPM, compás, duración y reproducción |
| Abajo derecha | **🗂 Fichas (n)**: la cajonera, tu depósito de obra |

---

## 2. Modelar (los salones)

1. Elige salón en el selector.
2. Mueve sliders. En salones con **pestañas** (p.ej. Clásica / SuperFlor), cada pestaña es una variante con sus propios parámetros.
3. La exposición es coherente entre salones: **Alambre**, **Caras** o **Ambos** superpone la malla y sus líneas. Formas Exóticas y Delaunay también ofrecen **Puntos**. Delaunay permite elegir entre el degradado original de las caras y **Fill color** (por defecto, el verde claro `#f0faec` del tema light de Room). Cada salón conserva su forma de colorear: color directo en Formas/Delaunay, fondo y tinta en Trazo, y tinte sobre paleta en Bajo Relieve.
4. Salones con modelos: **📦 Cargar modelo GLB…** abre el selector de archivos — vale cualquier .glb/.gltf de cualquier carpeta, comprimido con Draco o no. En **Trazo y Grafito**, el GLB importado queda dentro de la ficha: al guardarla, recargarla o mandarla al Escenario reaparece el mismo modelo, no el nudo de muestra.
   - Trazo y Grafito comienza sin giro. Sus controles **fondo**, **líneas**, **polaridad** y **exposición** permiten dirigir el papel, el grafito y su alambre de un gesto.
   - En **Bajo Relieve**, el modelo entra casi plano: pásale el ratón por encima para que la estela lo revele. **Profundidad base** determina cuánto volumen queda sin tocar; **intensidad relieve** controla la fuerza del bump bajo el ratón; **radio del relieve** su tamaño; y **tinte** colorea la paleta. El salón auto-orienta el relieve (su eje delgado mira a cámara). Su GLB importado viaja dentro de la ficha y reaparece como el mismo actor al añadirlo al Escenario.
5. Abre **🧵 Hilos de la ficha** antes de guardar:
   - **Esenciales** recupera una selección corta recomendada por el salón.
   - **Ninguno** permite empezar de cero.
   - Los hilos se agrupan en movimiento, expresión y materia; resolución, semilla y demás parámetros que regeneran topología no aparecen.
   - El contador indica cuántos controles viajarán con el personaje.
6. Abre **🎭 Ensayo del personaje** para preparar su repertorio corporal:
   - Elige un hilo interno, pon nombre al gesto y fija **reposo**, **acción** y duración.
   - **Lineal** llega a una pose y la sostiene hasta detenerla; **Ida y regreso** vuelve al reposo; **Bucle** repite el movimiento.
   - **Suave** evita arranques mecánicos; **Recto** conserva una progresión uniforme.
   - **＋ Guardar gesto** lo añade al repertorio y **▶ Probar** permite ensayarlo sin mover al personaje por el escenario.
   - En este primer hito cada gesto edita un hilo. El formato de ficha ya admite varios canales para una futura edición compuesta.

**Ruta corta:** `selector → pestaña → sliders → exposición/color`

---

## 3. Coleccionar (las fichas)

- **☆ Guardar ficha** (panel del salón) → el diálogo de MIA pide nombre → se guarda miniatura + todos los parámetros exactos, incluida la pestaña activa. Persiste entre sesiones (IndexedDB).
- **🗂 Fichas** (abajo derecha) abre la cajonera:
  - **Clic en la card** → recarga la figura idéntica (activa su salón y ajusta el panel).
  - **➕** → la manda al Escenario como actor.
  - **✕** → la borra (pide confirmación).
  - `🧵 n` → número de capacidades expresivas que llevará al Escenario.
  - `🎭 n` → número de gestos corporales que el personaje ya trae ensayados.

**Ruta corta:** `figura que te gusta → ☆ → nombre → aparece en 🗂`

---

## 4. Componer (el Escenario)

1. Cajonera → **➕** en las fichas que quieras (el Escenario se activa solo).
2. Panel **🎭 Actores**: cada actor tiene identidad estable, nombre, visibilidad, **x / y / z**, rotación XYZ, escala XYZ, duplicar y quitar.
   - **estático (ahorra)** configura la figura una vez y deja de evaluarla cada frame.
   - **dinámico** mantiene vivo el `update()` del camerino: úsalo si gira, respira, reacciona o evoluciona.
   - **🎭 Gestos ensayados** reúne el repertorio que viajó con la ficha. Cada botón acciona únicamente los hilos internos de ese actor; no mueve la escena global ni otro ejemplar del mismo personaje.
3. **giro global** (panel derecho) rota la escena entera; si una ficha lleva `giro` propio, ese actor se anima solo.
4. La composición **persiste** aunque salgas del Escenario y vuelvas. Al restaurar una escena, los actores entran progresivamente —uno por frame— para evitar un bloqueo largo.
5. **☆ Guardar ficha** estando en el Escenario = guarda **la escena completa**: actores, transforms, miniatura, actuación y configuración del transporte. Clic en esa card después = la escena vuelve entera y reemplaza la composición actual.
6. Al quitar un actor se eliminan también las rutas, LFOs y acumuladores que lo usan como fuente o destino; así no quedan hilos apuntando a una marioneta inexistente.
7. En el Escenario los gestos obedecen el reloj de la obra: durante la reproducción avanzan con el transporte; al detenerlo quedan congelados. **■ Detener gesto** retira su modulación y devuelve la pose base.

### Retocar un actor sin desmontar su papel

1. Abre el actor en **🎭 Actores** y pulsa **↩ Retocar en camerino**.
2. MIA abre su salón con una copia exacta de cuerpo, GLB, materia, hilos y repertorio. La plaza del actor sigue reservada dentro del documento de escena.
3. Ajusta la figura, cambia el modelo, selecciona hilos o ensaya gestos.
4. Pulsa **✓ Devolver a escena**. Se conserva el mismo ID de actor, nombre, posición, rotación, escala, visibilidad, actividad y guion escénico; solo se sustituye su ficha interna.
5. **Cancelar y volver** regresa al Escenario sin aplicar el retoque al actor.

Si se elimina un hilo utilizado por una ruta musical, LFO o memoria, MIA conserva esa indicación pero la deja desactivada. El actor muestra un aviso **revisión** y la indicación puede reasignarse desde su panel correspondiente.

El retoque actualiza la copia del personaje que vive en esa puesta; no sobrescribe silenciosamente la ficha maestra de la cajonera. Si la nueva versión merece convertirse en otra ficha reutilizable, pulsa también **☆ Guardar ficha** mientras está en el camerino.

**Ruta corta:** `🗂 → ➕➕➕ → acomodar en 🎭 → ☆ para congelar la escena`

---

## 5. Animar (los moduladores)

> **Alcance actual:** estando en el Escenario, las fuentes vivas pueden actuar sobre la escena completa o sobre los hilos de cada actor, y esa configuración viaja con la ficha de escena. El reloj musical ya gobierna la actuación; pistas, cues, cámara y luces siguen pendientes.

1. Activa el salón (o el Escenario) cuyo parámetro quieras mover.
2. **〰 Moduladores → ➕ Añadir LFO**: el desplegable *destino* ofrece los sliders del salón activo en ese momento.
3. Controles por LFO: **activo** (on/off), **destino**, **forma** (seno, triángulo, sierra, cuadrada, ruido suave), **frecuencia (Hz)**, **amplitud**, **fase**.

### Marionetas en el Escenario

1. Añade una ficha al Escenario y abre **◇ Mesa de Sinestesia**.
2. Pulsa **➕ Añadir ruta**. En *destino* aparecerán solamente los hilos elegidos en cada ficha, identificados por nombre de actor.
3. Elige, por ejemplo, `audio ataque → Aria · escala Y` y crea otra ruta `audio nivel → Coro · rotación Z`.
4. Las transformaciones responden incluso si el actor está en **estático (ahorra)**. Las expresiones internas solo responden en **dinámico**.

Los controles que regeneran topología —resolución, número de puntos, semilla o triangulación— no pueden seleccionarse como hilos musicales. Cada salón declara su catálogo seguro y anota categoría, escala temporal, coste y afinidades musicales para la futura capa de gestos.

Reglas de la casa:
- El slider define la **base**; el LFO **suma** encima. Puedes seguir moviendo el slider con el LFO sonando.
- Apagar o quitar el LFO devuelve el valor exacto donde lo dejaste.
- Varios LFOs pueden apilarse sobre el mismo parámetro.
- El resultado nunca se sale de los límites del slider (clamp automático).
- Las fichas y el Imprimir guardan siempre la **base limpia**, no la oscilación.
- Guardar una **ficha de Escenario** conserva LFOs, acumuladores y rutas sin guardar su valor instantáneo. Al volver, cada motor comienza desde un estado limpio y aplica la misma configuración.

**Ruta corta:** `salón activo → 〰 → ➕ → destino/forma/frecuencia/amplitud`

---

## 5b. Barnizar (el paisaje de coherencia)

> **Qué es:** el Barniz mantiene la escena dentro de *tu mundo* sin coreografiarla. En vez de vigilar reglas, define un **paisaje de energía**: la música empuja los parámetros, y el paisaje los devuelve suavemente hacia las configuraciones que reconoces como tuyas. La tensión musical decide cuánta libertad tiene el sistema para explorar. Concepto completo en **[BIBLIA_ANEXO_ENERGIA.md](BIBLIA_ANEXO_ENERGIA.md)**; plan en **[PLAN_IMPLEMENTACION_BARNIZ.md](PLAN_IMPLEMENTACION_BARNIZ.md)**.

1. Abre **◈ Barniz (paisaje)** (abajo, junto a Moduladores y Sinestesia).
2. **◈ Armar sobre el salón activo**: monta el paisaje sobre las direcciones del salón o escena actual. El panel indica cuántos **ejes** capturó. (Equivale a `MIA.armarBarniz()` en consola.)
3. **Monitores**: `E total` es cuánto se aleja el estado de tu mundo (baja = asentado). `E₂ paleta`, `E₃ carga`, `E₄ inercia` son los términos; `temperatura` es el vagabundeo actual; `‖corrección‖` cuánto tira el paisaje este instante.
4. **Afinación** — los dos únicos mandos que deciden si el instrumento se siente vivo o muerto:
   - **k₄ inercia** vs. amplitud de las rutas musicales. Si la inercia gana, la música no consigue mover nada; si el empuje gana, se pierde la coherencia. *Ese equilibrio ES el instrumento.*
   - **paso descenso**: grande oscila (rebota en el valle), pequeño no corrige a tiempo.
   - **presupuesto**: el límite de cuánto puede corregir por tick — súbelo para un paisaje firme, bájalo para que respete tus gestos.
   - **temp. máx (clímax)**: cuánto explora el sistema en el punto de máxima tensión.
5. **paleta (E₂)**: define los **tonos ancla** que *son* tu paleta. La energía tira el color al ancla más cercana; varias anclas = varias paletas legítimas. `anti-arcoíris` evita rango + saturación altos a la vez.
6. **transición A↔B**: pulsa *fijar barniz actual como B*, cambia las anclas/constantes, y mueve el slider `A → B`. El paisaje se deforma y el estado **rueda solo** hacia el mundo nuevo — sin corte.
7. **✕ Soltar barniz** apaga el paisaje: los parámetros vuelven exactos a su base, como cualquier fuente de modulación.

Reglas de la casa:
- **La música nunca escribe el color.** Las direcciones de tono/paleta quedan protegidas: no aparecen como destino en la Mesa de Sinestesia. El color es identidad, no un parámetro reactivo.
- El Barniz corrige **después** de que la música y la memoria empujaron; el golpe (vía Sinestesia) se siente al instante, el paisaje solo respira en la frase.
- La **temperatura** la gobierna un acumulador de *tensión* (Etapa 1): calma → la imagen se asienta; clímax → explora. Crea uno en 〰 Moduladores para alimentarla.
- Guardar una **ficha de Escenario** conserva el Barniz (anclas, constantes y si estaba encendido).

**Ruta corta:** `◈ Armar → ajustar k₄/paso → definir anclas → (opcional) transición A↔B`

---

## 5c. Dirigir (el Narrador)

> **Qué es:** el Narrador es el órgano del tiempo. No pinta nada: lee la **historia** de la improvisación (los acumuladores de tensión, densidad y meseta) y dirige la dramaturgia — sobre todo, *cuándo* cambiar de Barniz. Es una máquina de estados legible; cada decisión se escribe en una **bitácora** en texto. Concepto en **[BIBLIA_CONCEPTUAL.md §IV](BIBLIA_CONCEPTUAL.md)**.

Los cuatro estados son un arco: **reposo → construcción → clímax → disolución → reposo**. Cada estado tiene su propio Barniz (un "rol"), y el Narrador funde entre ellos sin corte según la música.

1. Arma y afina un Barniz (§5b) para el ambiente que quieras.
2. Abre **📖 Narrador** y pulsa **capturar actual → reposo** (o el rol que corresponda). Cambia las anclas/constantes y captura los otros roles: así el mundo tiene una cara para la calma, otra para el clímax, etc. Con tener **reposo** basta para empezar.
3. Crea en 〰 Moduladores al menos un acumulador de **tensión** (y opcionalmente *densidad* y *meseta*): son los ojos del Narrador.
4. Activa **dirige**. A partir de ahí:
   - El estado avanza a **construcción** cuando la tensión supera el umbral, a **clímax** cuando llega al máximo, y desciende por **disolución** cuando la energía cae.
   - El Barniz **funde** hacia el rol del estado actual, sin corte.
   - El **sesgo de temperatura** sube en clímax (el sistema explora) y baja en reposo (se asienta).
   - En calma prolongada, el Narrador ejerce **iniciativa acotada**: propone una deriva suave (una floración lenta que te invita a responder), espaciada por un *cooldown*.
5. **umbrales**: ajusta cuándo despierta, cuándo llega al clímax, cuánta calma vuelve al reposo, la duración del fundido y el cooldown de la iniciativa.
6. La **bitácora** explica cada decisión en texto: "→ clímax: la tensión alcanza el clímax", "propongo una deriva…". La legibilidad es parte del diseño — si algo te sorprende, ahí está el porqué.

Reglas de la casa:
- El Narrador **nunca pinta un píxel** ni inventa vocabulario: solo elige y ordena en el tiempo los barnices que capturaste. Es un director con tu partitura.
- Dirige el *cuándo*; el golpe sigue siendo instantáneo (va por Sinestesia) y el color sigue protegido (§5b).
- Todavía no decide etapas de la Semilla ni cambios de escena — esos órganos aún no existen. Cuando lleguen, se enchufan aquí.
- Guardar una **ficha de Escenario** conserva el repertorio, los umbrales y si estaba dirigiendo.

**Ruta corta:** `armar barniz → 📖 capturar roles → crear acumulador de tensión → dirige`

---

## 5d. Germinar (la Semilla)

> **Qué es:** el ritual de inicio. Cada actuación nace del silencio y germina por etapas dimensionales: **silencio → punto → línea → curva → superficie → volumen → constelación**. La Semilla no es una escena aparte, es un **diafragma** sobre el vocabulario: un mando de *apertura* (0..1) que decide cuánto del mundo se manifiesta. El punto y la constelación son la misma arquitectura con el diafragma más o menos abierto. Concepto en **[BIBLIA_CONCEPTUAL.md §III](BIBLIA_CONCEPTUAL.md)**.

1. Abre **🌱 Semilla** y pulsa **🌱 Tomar ejes del salón activo**: elige qué direcciones "manifiestan" el mundo (escala, densidad, número de anillos…). Al cerrarse el diafragma, esos ejes colapsan hacia el **piso**; al abrirse, vuelven a su base.
2. **modo manual**: mueve *apertura manual* de 0 a 1 y observa cómo el mundo germina y la etapa cambia. Es la forma de conocer el protocolo.
3. **modo auto**: la germinación **se gana**. Con acumuladores de tensión/densidad activos, la música abre el diafragma; el **silencio lo repliega**, etapa a etapa. Es reversible: el final de un viaje importa tanto como su inicio.
4. **protocolo**: el **piso** es a dónde colapsa el mundo en silencio (0 = al punto puro; súbelo si quieres que nunca desaparezca del todo). Las tasas de **germina/repliega** controlan cuán lento se gana y se pierde el mundo.
5. **Con el Narrador dirigiendo** (§5c), la Semilla obedece su dramaturgia: reposo apenas germina, el clímax abre a constelación, la disolución repliega. Ahí el viaje entero —nacer, crecer, volver— lo conduce el Narrador leyendo tu música.

Reglas de la casa:
- La apertura **arranca siempre en el silencio** al cargar una escena: cada actuación germina de cero.
- Manifestación plena (apertura=1) no impone nada: el mundo queda tal cual lo diseñaste. La Semilla solo actúa al *cerrar* el diafragma.
- Escribe en el bus como una fuente más (`@semilla`); apagarla devuelve la base intacta, como todo en MIA.

**Ruta corta:** `🌱 tomar ejes → manual para conocer → auto para germinar → (opcional) dejar que el Narrador conduzca`

---

## 6. Transportar (el reloj musical)

1. Abre **♫ Transporte** en el centro inferior. Está plegado por defecto para no convertir la mesa en una cabina llena de controles.
2. Ajusta **BPM**, **pulsos/compás**, **duración** y **bucle**.
3. Pulsa **Preparar audio** una vez. Después usa **▶ Reproducir** y **■ Detener y volver a cero**.
4. En el Escenario, LFOs, acumuladores, sinestesia y actores dinámicos consultan el mismo tiempo. Si el render pierde un frame, la posición musical no se atrasa con él.
5. Fuera del Escenario, los camerinos conservan su tiempo de modelado continuo: detener la obra no congela mientras diseñas una figura.
6. Al guardar una ficha de Escenario viajan BPM, métrica, duración y bucle. Al restaurarla, el transporte vuelve detenido a `00:00.000` con esa configuración.

El panel refresca sus monitores a 10 Hz, no en cada frame. Si el navegador mantiene temporalmente suspendida la salida de audio, el transporte conserva la continuidad con un reloj monotónico y entrega el mando a `AudioContext` cuando queda disponible.

**Ruta corta:** `♫ → BPM/compás/duración → Preparar → ▶`

---

## 7. Imprimir (exportar)

- **En un salón**: ⎙ descarga un HTML autocontenido (Three.js por CDN) que reproduce la figura con los valores horneados. Se abre con doble clic, sin instalar nada.
- **En el Escenario**: ⎙ descarga una composición HTML con la partitura JSON embebida. Reproduce Formas Exóticas y los actores de Trazo y Grafito, incluyendo su GLB guardado, transform y giro. *(Delaunay y Bajo Relieve aún no tienen reproductor autónomo en el HTML; se avisan en la consola en vez de sustituirse por otra figura.)*
- **↓ Guardar preset**: el JSON de parámetros solo (re-importable vía consola: `MIA.bus.importarPreset(json)`).

---

## 8. El ciclo completo

```
   MODELAR            COLECCIONAR           COMPONER              ANIMAR              IMPRIMIR
  salón + sliders  →  ☆ ficha en 🗂     →  ➕ actores en 🎭   →  hilos y memoria →  ⎙ HTML autónomo
                       (persiste)            (persiste)            (persisten)           (para el mundo)
```

Y la promesa del Acto II: donde hoy dice 〰 LFO, mañana dirá 🎸 guitarra — misma arquitectura, otra fuente escribiendo en el bus.

---

## 9. Problemas conocidos / trucos

- **Tamaño de punto en WebGPU**: el slider `tamaño punto` solo actúa en fallback WebGL2 (los puntos WebGPU son de 1px por diseño de la API).
- **GLB "invisible" en Bajo Relieve**: sube *profundidad base* para ver el modelo completo sin estela; pon *intensidad relieve* a 1 para que el ratón revele el máximo volumen.
- **La miniatura no refleja lo que ves**: la captura toma el frame actual — encuadra antes de ☆.
- **Reset rápido de fichas**: borra la base de datos `mia-fichas` en DevTools → Application → IndexedDB.
- **Export de la actuación**: las rutas, LFOs y acumuladores se guardan en DocumentoEscena v3 y se restauran dentro de MIA, pero todavía no se ejecutan en el HTML exportado.
- **Cámara actual**: OrbitControls sigue siendo cámara de inspección. Su posición y FOV se guardan en el DocumentoEscena v3, pero todavía no existe una cámara de obra independiente ni pistas de cámara.
- **Luces, vestuario y pistas**: aparecen ya reservados en el documento de escena, pero todavía no tienen herramientas de edición. El transporte es reloj, no es aún un editor de timeline.

---

## 10. Qué validar en el punto actual

Antes de avanzar a cámara y timeline, la ronda mínima es:

1. Crear al menos dos personajes de familias diferentes.
2. Guardarlos, recargarlos y mandarlos al Escenario.
3. Mover, rotar, escalar, ocultar y duplicar cada actor.
4. Comparar un actor **estático** con otro **dinámico**.
5. Guardar la puesta, salir del Escenario y restaurarla.
6. Confirmar que transforms, nombres, visibilidad, tipo de actuación, rutas, LFOs y acumuladores sobreviven.
7. Repetir con 10 actores y observar si la interfaz se bloquea durante la entrada progresiva.
8. Importar un GLB en Trazo y Grafito, guardar su ficha, recargarla y añadirla al Escenario: debe conservar el modelo importado.
9. Exportar una escena con una supershape y un GLB de Trazo y Grafito: el HTML debe mostrar ambos.
10. Quitar un actor que tenga una ruta, un LFO y un acumulador: los tres deben desaparecer de sus paneles.
11. Guardar una ficha con un solo hilo, subirla al Escenario y abrir la Mesa: solo debe aparecer ese hilo bajo el nombre del actor.
12. En **♫ Transporte**, preparar, reproducir unos segundos y detener: el estado debe pasar por `preparado → reproduciendo → preparado` y volver a cero.
13. Guardar una escena a 90 BPM, 3 pulsos, 12 s y sin bucle; alterar esos valores y restaurar la ficha: deben volver exactamente los cuatro.
14. Crear un gesto de ida y regreso en un camerino, guardarlo con la ficha y subirla al Escenario: debe aparecer con su nombre bajo **🎭 Gestos ensayados** y afectar solo a ese actor.
15. Retocar ese actor desde el Escenario, cambiar un parámetro y devolverlo: debe conservar transform, identidad y guion, pero mostrar la nueva figura.

Esta prueba valida los cimientos y el reloj de la función. La prueba de ópera completa —registro de toma, luces, cámara y coreografía temporal— se añadirá al incorporar esas piezas.

La secuencia de construcción desde estos cimientos hasta una toma audiovisual completa se mantiene en **[RUTA_AL_VIDEOCLIP.md](RUTA_AL_VIDEOCLIP.md)**.
