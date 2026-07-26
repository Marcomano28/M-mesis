# MIA — Guion de sesión de pruebas
### Semilla · Narrador · Coherencia (Barniz) — el corazón conceptual funcionando junto

*24-07-2026 · para probar en el navegador los tres órganos nuevos (Etapas 3, 7 y 2). Complementa los Bloques F/G/H de RUTA_DE_PRUEBAS.md con un recorrido guiado, determinista y sin micrófono.*

---

## Cómo leer este guion

Cada paso tiene **Haz** (lo que tocas) y **Esperado** (lo que debe pasar). Si algo no coincide, anótalo al final (sección «Reporte») y seguimos. No necesitas guitarra ni micrófono: un pequeño *motor de prueba* de consola simula la intensidad musical.

Tiempo total: ~25 min. Puedes parar entre partes.

---

## Parte 0 — Arranque (3 min)

1. **Haz:** en la terminal, `cd ~/Claude/Projects/Mia && npm run dev`. Abre `http://localhost:5173`.
   **Esperado:** carga sin banner rojo al pie.

2. **Haz:** mira abajo a la izquierda.
   **Esperado:** indicador **● WebGPU** en verde (si es **○ WebGL2** ámbar, también sirve, solo más lento).

3. **Haz:** abre la consola del navegador (F12 → pestaña *Console*).
   **Esperado:** sin errores rojos. Escribe `MIA` y pulsa Enter: aparece un objeto con `motorBarniz`, `motorNarrador`, `motorSemilla`, `armarBarniz`, etc.

4. **Los paneles nuevos** están abajo, en fila, **plegados** (clic en el título para abrir): `◇ Sinestesia`, `◈ Barniz (paisaje)`, `📖 Narrador (dramaturgia)`, `🌱 Semilla (manifestación)`.
   **Nota:** si la ventana es estrecha, los de la derecha (Narrador/Semilla) pueden quedar fuera de pantalla. Ensancha la ventana del navegador, o gobiérnalos por consola con `MIA.motorNarrador` / `MIA.motorSemilla`.

5. **El motor de prueba** (pega esto en la consola, aún no lo ejecutes; lo usarás varias veces):
   ```js
   // Simula actividad musical sostenida (sube la "tensión" de Frase):
   window.subir = () => window.__d = setInterval(() => MIA.motorAcum.registrarActividad(3), 30);
   window.callar = () => clearInterval(window.__d);
   ```
   **Esperado:** sin error. `subir()` inyecta energía; `callar()` la corta (equivale a tocar fuerte / dejar de tocar).

---

## Parte 1 — La Semilla en manual (el más visual) (4 min)

*Objetivo: ver el diafragma de manifestación — el mundo que nace del punto y florece.*

1. **Haz:** en el selector de arriba, elige **Bajo Relieve**. Pásale el ratón por encima para que aparezca el relieve.
   **Esperado:** una superficie con relieve reaccionando a la estela del puntero.

2. **Haz:** abre **🌱 Semilla** → botón **🌱 Tomar ejes del salón activo**.
   **Esperado:** el contador **ejes** muestra un número > 0 (unos 4). La Semilla queda **activa**.

3. **Haz:** cambia **modo** a **manual (slider)**. Baja **apertura manual** a **0**.
   **Esperado:** el mundo **colapsa**: el relieve se aplana y se oscurece hacia casi nada. El monitor **etapa** dice **silencio** o **punto**.

4. **Haz:** sube **apertura manual** lentamente de 0 a 1.
   **Esperado:** el monitor **etapa** recorre **punto → línea → curva → superficie → volumen → constelación**, y la imagen crece/gana relieve y color al abrir. A 1, el mundo está pleno (idéntico a como se ve sin Semilla).

5. **Haz:** deja apertura a ~0.2 y sube **piso (colapso)** a ~0.4 (en *protocolo*).
   **Esperado:** con el mismo valor bajo de apertura, el mundo ya **no desaparece del todo** — conserva una manifestación mínima. (El piso es "a dónde colapsa el silencio".)

6. **Haz:** vuelve a poner **piso = 0** y **apertura manual = 1** para dejarlo pleno.

---

## Parte 2 — La Semilla en auto: germinación ganada y reversible (4 min)

*Objetivo: que la música (no un slider) haga germinar el mundo, y el silencio lo repliegue.*

1. **Haz:** abre **〰 Moduladores** → **➕ Acumulador (recuerda)**. En ese acumulador, deja **memoria = tensión**. (Su *destino* da igual para esta prueba.)
   Opcional: añade un segundo acumulador con **memoria = densidad** para germinar más alto.
   **Esperado:** aparece el acumulador con un monitor **memoria viva** a 0.

2. **Haz:** en **🌱 Semilla**, cambia **modo** a **auto (música/Narrador)**.

3. **Haz:** en consola, ejecuta `subir()`. Observa el panel de la Semilla ~10 s.
   **Esperado:** **apertura** sube sola y **etapa** asciende (hasta *volumen*/*constelación* según cuántos acumuladores tengas). La germinación es **gradual** — se gana, no aparece de golpe.

4. **Haz:** ejecuta `callar()` y espera ~10 s.
   **Esperado:** **apertura** baja y **etapa** desciende hasta **silencio**. Es **reversible**: el mundo se repliega al callar.

5. **Comprobación numérica (opcional):** en consola, `MIA.motorSemilla.apertura` refleja el valor; `MIA.motorSemilla.etapa` la etapa.

---

## Parte 3 — El Barniz: el paisaje de coherencia (6 min)

*Objetivo: ver que el color "cae" hacia tu paleta, que la música no puede escribir el color, y la transición entre dos mundos.*

### 3a — Descenso al valle de paleta (determinista, por consola)

1. **Haz:** deja Bajo Relieve como salón activo. En consola:
   ```js
   MIA.armarBarniz([{ direccion: 'bajorelieve.tono', circular: true, familia: 'paleta' }]);
   MIA.motorBarniz.ficha.anclasTono = [0.5];   // un solo valle de paleta
   MIA.bus.set('bajorelieve.tono', 1);          // empuja el tono al extremo
   ```
   **Esperado:** en ~1–2 s el tinte del relieve **se desliza solo** y se asienta. Verifícalo: `MIA.bus.valorFinal('bajorelieve.tono')` va desde ~1 hacia ~0 (el valor real que corresponde al ancla 0.5).

2. **Haz:** `MIA.bus.set('bajorelieve.tono', -1)` (empújalo al otro extremo).
   **Esperado:** vuelve a caer hacia el mismo valle. **El color es identidad: siempre regresa a tu ancla.**

### 3b — La música no escribe el color (dirección protegida)

3. **Haz:** con el Barniz armado (paso 3a), abre **◇ Mesa de Sinestesia** → **➕ Añadir ruta** → despliega **destino**.
   **Esperado:** **`bajorelieve.tono` NO aparece** en la lista de destinos. La música no puede rutearse al color (regla del Anexo I §V). Los demás parámetros sí están.

### 3c — Coherencia + monitores (panel)

4. **Haz:** en **◈ Barniz** pulsa **◈ Armar sobre el salón activo** (ahora toma todos los ejes del salón). Abre *monitores*.
   **Esperado:** **E total** se dibuja y tiende a bajar (el estado se asienta en el valle). Con `subir()` corriendo, **temperatura** sube > 0 y el tinte **vaga** alrededor del valle; con `callar()`, se asienta.

5. **Haz:** sube **k₄ inercia** al máximo y baja **paso** al mínimo (en *afinación*).
   **Esperado:** el sistema se vuelve **perezoso** (amortiguado); con k₄ bajo, responde más suelto. *Ese equilibrio es el instrumento.*

### 3d — Transición entre dos barnices

6. **Haz:** en *transición A↔B*: pulsa **fijar barniz actual como B**. Cambia un ancla de paleta (en *paleta (E₂)*). Ahora mueve el slider **A → B** de 0 a 1.
   **Esperado:** el mundo **funde** de una paleta a otra **sin corte** — el estado rueda solo hacia el valle nuevo.

7. **Haz:** cuando termines esta parte, pulsa **✕ Soltar barniz**.
   **Esperado:** los parámetros vuelven **exactos** a su base (el Barniz es una fuente más; apagarlo no deja residuo).

---

## Parte 4 — El Narrador: la dramaturgia (6 min)

*Objetivo: que un director legible lea la música y conduzca el viaje — cambiando barniz y abriendo la Semilla — y que puedas leer por qué.*

1. **Preparación:** arma y afina un Barniz que te guste (Parte 3, paso 4). Asegúrate de tener un acumulador de **tensión** (Parte 2, paso 1).

2. **Haz:** abre **📖 Narrador**. En *repertorio de barnices*, con el barniz actual, pulsa **capturar actual → reposo**. Cambia un ancla/constante y pulsa **capturar actual → clímax** (opcional: *construcción* y *disolución* también).
   **Esperado:** la **bitácora** anota cada captura ("barniz capturado como «reposo»").

3. **Haz:** activa **dirige**. Ejecuta `subir()` y observa 15–20 s.
   **Esperado:** el **estado** recorre **reposo → construcción → clímax**; la **bitácora** explica cada salto ("→ clímax: la tensión alcanza el clímax"). El barniz **funde** hacia el rol del estado. Si la Semilla está en auto, **se abre** hacia constelación (el Narrador la dirige).

4. **Haz:** ejecuta `callar()` y espera ~15 s.
   **Esperado:** el estado desciende **→ disolución → reposo**; la bitácora lo narra; la Semilla se **repliega**.

5. **Haz (iniciativa):** con el sistema en calma (`callar()` ya ejecutado), espera ~30–60 s sin tocar nada. Ayuda tener un acumulador de **meseta**.
   **Esperado:** aparecen entradas de **iniciativa** en la bitácora ("propongo una deriva — una floración lenta…"), **espaciadas** por el cooldown, no en ráfaga.

6. **Monitor:** `sesgo temp.` es alto en clímax (explora) y bajo en reposo (se asienta).

---

## Parte 5 — El bucle completo + persistencia (4 min)

*Objetivo: los tres órganos juntos, y que todo sobreviva a guardar/restaurar.*

1. **Haz:** con Semilla (auto), Barniz (armado, roles capturados) y Narrador (**dirige**) activos, haz un arco: `subir()` ~20 s, luego `callar()` ~20 s.
   **Esperado:** un viaje que **nace del silencio, florece y vuelve** — la Semilla abre/cierra el diafragma, el Barniz mantiene la paleta, el Narrador conduce y lo narra en la bitácora. Nada coreografiado: todo sale de la intensidad simulada.

2. **Haz (guardar):** entra en **El Escenario** (selector de arriba). Añade cualquier ficha como actor si no hay ninguna, y guarda la puesta como ficha de Escenario (**☆**). Ponle un nombre, p.ej. "Prueba SNC".
   **Esperado:** la escena queda en la cajonera 🗂.

3. **Haz (restaurar):** entra a otro salón y vuelve; carga la ficha "Prueba SNC".
   **Esperado:** reaparecen el **repertorio del Narrador**, sus **umbrales**, el **Barniz** (anclas/constantes) y los **ejes/modo/piso de la Semilla**. La **apertura de la Semilla arranca en el silencio** (cada actuación germina de cero) y la **bitácora arranca limpia** — eso es correcto, no un fallo.

---

## Reporte (qué anotar)

Por cada paso que falle, anota: número de paso, qué esperabas, qué pasó, y si hubo error rojo en consola (cópialo). Con eso lo corrijo o abro ticket.

**Los criterios de oído (tu juicio, no automatizables):**
- **Semilla:** ¿el viaje se siente **narrado**, no agitado? (nace, crece, vuelve).
- **Barniz:** con música variada 10 min, ¿parece **una obra** o zapping entre efectos?
- **Narrador:** ¿sientes que **entendió la pieza**? ¿la bitácora explica bien lo que hizo?

---

## Referencia rápida (consola)

```js
subir()        // inyecta intensidad musical (sube la tensión)
callar()       // corta la intensidad
MIA.armarBarniz()                         // arma el Barniz sobre el salón activo
MIA.motorBarniz.monitor                   // E total, términos, temperatura, corrección
MIA.motorSemilla.apertura / .etapa        // estado del diafragma
MIA.motorNarrador.estado / .bitacora      // estado dramático e historial de decisiones
MIA.bus.valorFinal('bajorelieve.tono')    // valor final de un parámetro (base + modulación)
```

> Nace del silencio, florece con la música, vuelve al silencio. Y puedes leer por qué.
