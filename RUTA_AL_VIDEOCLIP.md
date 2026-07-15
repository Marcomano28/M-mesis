# MIA — Ruta al videoclip interpretado
### De una escena reactiva a una toma audiovisual única, reproducible y masterizable

*Versión 1.3 · 15 de julio de 2026 · documento técnico de destino*

Este documento responde una pregunta concreta: **¿puede MIA producir un videoclip musical a partir de una improvisación en tiempo real?**

Sí. La arquitectura actual ya contiene el núcleo correcto: figuras paramétricas, actores con identidad, hilos individuales, fuentes de audio/gesto, memoria y un bus que separa la pose base de la modulación viva. Lo que falta no es otro efecto visual aislado, sino convertir estas piezas en un **instrumento temporal, grabable y dirigido**.

La meta no es un visualizador que acompañe una canción. Es una interpretación conjunta:

> músico + instrumento sonoro + reparto visual + reglas de respuesta + memoria + cámara = una toma irrepetible.

El accidente de la improvisación debe conservarse, pero la toma también debe poder abrirse, revisarse y masterizarse. Por eso MIA necesitará guardar no solo el vídeo final, sino la **huella de la interpretación**.

---

## 1. Qué debe producir MIA al final

Una sesión terminada debe entregar cuatro objetos relacionados:

1. **Vídeo master**: imagen y audio sincronizados, listo para publicar.
2. **Documento de obra**: reparto, assets, cámara, luces, rutas, semillas y configuración técnica.
3. **Toma de performance**: audio original más el registro temporal de rasgos, gestos, cues y cambios del intérprete.
4. **Informe de captura**: resolución, FPS, frecuencia de audio, frames perdidos, latencia y versión del runtime.

La toma viva y la reproducción posterior no son rivales:

- **Toma viva**: conserva la respuesta espontánea y puede grabarse en tiempo real.
- **Reproducción determinista**: vuelve a ejecutar la misma interpretación a tiempo fijo para obtener una masterización más estable o de mayor resolución.

La segunda no debe reinterpretar la música. Debe reproducir las mismas decisiones registradas durante la primera.

---

## 2. Estado actual: qué cimientos ya existen

| Cimiento | Estado | Valor para el videoclip |
|---|---|---|
| Salones y fichas | ✅ | Vocabulario visual creado por el autor |
| GLB dentro de fichas de Trazo | ✅ | Assets acompañan al personaje hasta la escena |
| DocumentoEscena v3 | ✅ | Reparto, transforms, cámara inicial y configuración de actuación |
| Actores estáticos/dinámicos | ✅ | Presupuesto de CPU/GPU controlable |
| Hilos por actor | ✅ | Pose XYZ y expresiones internas direccionables |
| Hilos seleccionados por ficha | ✅ | Cada camerino exporta solo capacidades elegidas, seguras y etiquetadas |
| ParamBus base + modulaciones | ✅ | La actuación no destruye la composición original |
| LFO, ratón, audio básico y MIDI | ✅ MVP | Fuentes reales o simuladas ya pueden tocar los hilos |
| Acumuladores de frase | ✅ | Primer nivel de memoria temporal |
| Mesa de Sinestesia | ✅ MVP | Curva, rango, ataque y caída por ruta |
| Export HTML de escena | 🟡 | Reproduce Formas Exóticas y Trazo/GLB; no es aún el runtime completo |
| Transporte musical | ✅ MVP | Reloj común, play/stop, posición, BPM, métrica, duración, bucle y persistencia por escena |
| Persistencia de rutas | ✅ MVP | Rutas, LFOs y acumuladores viajan con la ficha; los valores vivos se reinician |
| Cámara/luz direccionables | ⬜ | Falta lenguaje cinematográfico |
| Grabación de performance | ⬜ | Falta registrar audio, rasgos, cues y decisiones |
| Captura audiovisual | ⬜ | Falta grabador, sincronía, codecs y control de carga |

Conclusión: **la marioneta ya tiene hilos y reloj; ahora hay que registrar la interpretación, escribir pistas y filmar la función.**

---

## 3. Arquitectura objetivo

```text
ENTRADA SONORA
micrófono / interfaz / MIDI / pista
        │
        ▼
OÍDO DE TIEMPO REAL                 RELOJ MAESTRO
AudioWorklet → rasgos → gestos ◄── AudioContext.currentTime
        │                                  │
        ├──────────────┐                   │
        ▼              ▼                   ▼
MEMORIA DE FRASE   REGISTRO DE TOMA   TRANSPORTE / CUES
        │              │                   │
        └──────┬───────┴───────────┬───────┘
               ▼                   ▼
       MATRIZ DE SINESTESIA   TIMELINE / NARRADOR
               │                   │
               └─────────┬─────────┘
                         ▼
                    PARAM BUS
          escena · actor · cámara · luz · efecto
                         │
                         ▼
                 RUNTIME DE ESCENA
                         │
                         ▼
                 WebGPU / frame final
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       CAPTURA EN VIVO       REPLAY / MASTER OFFLINE
```

Regla esencial: **el audio es el reloj**, no `requestAnimationFrame`. La imagen consulta la posición musical actual; si cae un frame, el tiempo no se atrasa ni deriva.

---

## 4. Contratos de código que faltan

Los nombres siguientes describen el contrato de destino. `ConfiguracionTransporte` y el reloj base ya existen; performance, captura y el resto de direcciones todavía son propuesta.

```ts
type DireccionHilo =
  | `escena.${string}`
  | `actor:${string}.transform.${string}`
  | `actor:${string}.param.${string}`
  | `camara:${string}.${string}`
  | `luz:${string}.${string}`
  | `postfx.${string}`;

interface RutaActuacion {
  id: string;
  fuente: string;
  destino: DireccionHilo;
  rango: [number, number];
  curva: 'lineal' | 'suave' | 'exponencial' | 'log';
  ataque: number;
  caida: number;
  peso: number;
  grupo?: string;
  activo: boolean;
}

interface EventoPerformance {
  tiempoAudio: number;
  tipo: 'rasgo' | 'gesto' | 'cue' | 'ruta' | 'control' | 'semilla';
  clave: string;
  valor: number | string | boolean;
}

interface DocumentoPerformance {
  version: 1;
  escena: DocumentoEscena;
  rutas: RutaActuacion[];
  transporte: ConfiguracionTransporte;
  semillas: Record<string, number>;
  barniz?: unknown;
  captura: ConfiguracionCaptura;
}

interface TomaPerformance {
  documento: DocumentoPerformance;
  audioOriginal: Blob;
  eventos: EventoPerformance[];
  inicioAudio: number;
  duracion: number;
  diagnostico: DiagnosticoToma;
}
```

### Decisiones de contrato

- Las rutas apuntan a **IDs estables**, nunca al orden visual de una lista.
- Los valores base viven en el documento; la música escribe desplazamientos temporales.
- Toda aleatoriedad visible recibe una semilla guardada.
- Los eventos usan tiempo del audio, no fecha del sistema ni número de frame.
- Los assets se referencian por ID/hash; no se duplican en cada evento.
- El registro guarda **fuentes y decisiones**, no millones de valores finales redundantes.

---

## 5. Hoja de ruta priorizada

### P0 — Consolidar la marioneta actual

**Objetivo:** demostrar dos actores independientes reaccionando a fuentes distintas sin mover la escena global.

- Completar P13 de `RUTA_DE_PRUEBAS.md`.
- Verificar actores estáticos con hilos de transform y dinámicos con expresiones.
- Medir 10 actores con varias rutas y observar estabilidad.
- Corregir cualquier contaminación entre IDs antes de serializar rutas.

**Salida:** runtime de actor confiable.

### P1 — DocumentoEscena v3: guardar la coreografía ✅ MVP

**Objetivo:** que una ficha de Escenario restaure reparto **y** manera de tocarlo.

- Añadido el bloque `actuacion` con rutas, LFOs y acumuladores.
- Migración explícita v1/v2 → v3, sin invalidar fichas antiguas.
- Guardado y restauración sin serializar valores instantáneos ni memoria interna.
- Limpieza automática de rutas, LFOs y acumuladores cuando se elimina su actor.
- El guardado filtra por direcciones de la escena activa (`escenario.*` y sus IDs de actor), evitando capturar motores de otros salones.
- Pendiente de la Matriz v2: grupos de reparto y una capa explícita de rutas temporales de ensayo.

**Código principal:** `core/DocumentoEscena.ts`, `core/Sinestesia.ts`, `core/Moduladores.ts`, `salones/escenario/EscenarioSalon.ts`.

**Criterio alcanzado:** guardar una escena, vaciar los motores y recuperar actor, ruta de audio, LFO y acumulador con las mismas fuentes y destinos.

### P2 — Transporte musical y reloj único ✅ MVP

**Objetivo:** que todo componente comparta posición, duración y estado de interpretación.

- Creado `core/Transporte.ts`: `parado | preparado | reproduciendo`.
- `AudioContext.currentTime` gobierna la reproducción; un reloj monotónico mantiene continuidad mientras el navegador habilita el audio.
- Expuestos `tiempo`, `delta`, `compas`, `pulso`, `beat`, `fasePulso` y `bpm`.
- LFO, acumuladores, sinestesia y Escenario reciben el mismo marco musical; los camerinos mantienen su tiempo de diseño independiente.
- BPM, métrica, duración y bucle viajan en DocumentoEscena v3 y restauran la obra detenida a cero.
- Pendiente para P6/P8: estado `grabando`, cues, cuenta atrás, finalización de toma y prueba prolongada de deriva.

**Criterio MVP alcanzado:** play/stop y persistencia exacta verificados; los frames visuales consultan un tiempo absoluto. **Criterio de producción pendiente:** medir cinco minutos con cues audiovisuales y deriva imperceptible.

### Contrato ya preparado para el oído musical

Cada hilo de ficha conserva `categoria`, `velocidad`, `coste` y `afinidades`. La futura capa de análisis no debe volcar F0, chroma o centroide directamente sobre una enorme lista de parámetros. Primero los traducirá a un vocabulario estable —energía, ataque, altura, brillo, textura, pulso y armonía— y la Mesa podrá sugerir destinos compatibles sin decidir por el autor.

- Impulso: onset/ataque → aparición, pulso o escala breve.
- Gesto: F0, dinámica o centroide → pose y expresión corporal.
- Frase: chroma, tonalidad y progresión → paleta, barniz, luces y cambios de estado.
- Cámara: trayectoria dirigida por cues; la música solo modula dentro de límites lentos.

### P3 — Oído de producción

**Objetivo:** extraer rasgos estables sin bloquear la interfaz.

- Mover el análisis continuo desde el hilo principal a `AudioWorklet`.
- Primera capa: RMS, envolvente, ataque/onset, centroide, flux y flatness.
- Segunda capa: pitch estable, vibrato, bend, staccato/legato y densidad.
- Calibración por sesión: ruido de fondo, nivel útil, rango dinámico y latencia.
- Cola circular sin asignaciones por bloque; publicar rasgos a frecuencia controlada.

**Criterio:** audio sin chasquidos, render estable y ataques que se sienten inmediatos.

### P4 — Matriz de Sinestesia v2

**Objetivo:** pasar de rutas sueltas a un instrumento visual ensayable.

- Mapeos 1:N y N:1.
- Grupos de actores: solista, coro, fondo, escenografía.
- Puertas, umbrales, histéresis, cuantización a beat y probabilidades con semilla.
- Presupuesto de movimiento por actor y global para evitar saturación.
- Mezcla por prioridad: base + timeline + música + gesto manual + seguridad.
- Fichas de sinestesia intercambiables.

**Criterio:** cambiar la matriz altera el carácter de la obra sin cambiar reparto ni código.

### P5 — Cámara, luces y postproducción como actores

**Objetivo:** convertir una simulación 3D en lenguaje cinematográfico.

- Cámara de obra separada de OrbitControls.
- Hilos de posición, objetivo, FOV, roll, enfoque y exposición.
- Luces con ID, intensidad, color, dirección y grupos de influencia.
- Cues y pistas lentas para cámara; la música puede modular, no pilotar cada frame sin filtro.
- PostFX presupuestado: bloom, niebla, profundidad o aberración solo cuando la escena lo admita.

**Criterio:** una toma tiene encuadre, jerarquía visual y respiración, no solo objetos moviéndose.

### P6 — Registrar la interpretación

**Objetivo:** conservar el accidente exacto que convirtió la sesión en una toma.

- Grabar audio maestro sin procesar.
- Registrar rasgos/gestos a una cadencia suficiente, con timestamps del reloj de audio.
- Registrar cambios manuales, cues, cambios de ruta, semillas y decisiones del Narrador.
- Usar bloques incrementales en IndexedDB; no mantener una sesión larga completa en RAM.
- Crear reproducción del log sin micrófono.

**Criterio:** al reproducir una toma, los principales gestos visuales ocurren en los mismos momentos.

### P7 — Captura audiovisual en dos niveles

#### Nivel A: grabación directa de ensayo

- `canvas.captureStream(fps)` para la imagen.
- `MediaStreamAudioDestinationNode` para obtener el audio de la misma gráfica Web Audio.
- Combinar tracks y grabar con `MediaRecorder`.
- Elegir MIME con `MediaRecorder.isTypeSupported()`; no asumir codec fijo.
- Descargar WebM/codec disponible y el documento de performance asociado.

Ventaja: implementación corta y captura exactamente lo que se vio. Límite: si el render pierde frames, la grabación también.

#### Nivel B: master determinista

- Reproducir el log con timestep fijo: frame `n` usa `n / fps`.
- Crear `VideoFrame` desde el canvas y codificar mediante `VideoEncoder`.
- Codificar audio o conservar WAV/PCM maestro.
- Añadir un muxer WebM/MP4: WebCodecs entrega chunks, **no crea el contenedor final**.
- Consultar soporte real con `VideoEncoder.isConfigSupported()` y mantener fallback.
- Si el navegador no ofrece un pipeline estable, exportar frames + WAV para FFmpeg o empaquetar el mismo runtime con Tauri.

Ventaja: 1080p/4K estable aunque la actuación original tuviera carga irregular. Límite: exige que semillas, eventos y shaders dependan del tiempo explícito.

**Criterio:** vídeo y audio comienzan juntos, no derivan y el archivo se reproduce fuera de MIA.

### P8 — Modo actuación

**Objetivo:** que la herramienta desaparezca durante la interpretación.

- Pantalla completa limpia, monitores mínimos y controles grandes.
- Preparar → cuenta atrás → grabar → detener → revisar.
- Indicadores de audio, FPS, frames perdidos, espacio disponible y estado de captura.
- Recuperación ante micrófono desconectado, pestaña en segundo plano o encoder saturado.
- Bloqueo opcional de rutas/actores para evitar cambios accidentales.

**Criterio:** una sesión puede operarse sin abrir herramientas de desarrollo.

### P9 — Director de Escena, después del instrumento

La IA no debe preceder al contrato. Cuando actores, rutas, cues, cámara, luces y transporte sean herramientas serializables, un Director podrá:

- proponer una primera coreografía;
- distribuir fuentes entre solista/coro;
- sugerir cámara y luces por sección;
- limitar densidad y frecuencia de cambios;
- explicar y registrar sus decisiones.

No generará píxeles ni sustituirá la improvisación. Escribirá una partitura editable sobre el vocabulario del autor.

---

## 6. Retos evidentes y soluciones propuestas

| Reto | Riesgo visible | Solución de arquitectura |
|---|---|---|
| Dos relojes: audio y pantalla | deriva, golpes fuera de tiempo | audio como reloj maestro; render consulta tiempo absoluto |
| Latencia de entrada/análisis/render | respuesta que se siente blanda | AudioWorklet, buffers pequeños medidos, rasgos rápidos separados de pitch lento |
| Micrófonos e instrumentos diferentes | una ruta funciona hoy y mañana no | calibración por sesión y normalización robusta |
| Demasiada reacción | ruido visual sin significado | memoria, ataque/caída, histéresis, grupos y presupuesto de movimiento |
| Topología modulada por audio | caídas bruscas de FPS | distinguir hilos expresivos de parámetros estructurales; cambios pesados mediante cues |
| Frames perdidos durante captura | vídeo entrecortado | calidad adaptativa en vivo + master determinista posterior |
| Aleatoriedad no reproducible | replay diferente de la toma | PRNG con semilla por sistema y registro de toda reseed |
| Assets grandes | fichas lentas y duplicación | almacén por hash, referencias compartidas, compresión y carga progresiva |
| Memoria en sesiones largas | cierre del navegador | escritura incremental en IndexedDB y chunks de grabación |
| Codec/contenedor variable | archivo incompatible | detección de soporte, perfil recomendado y fallback frames+WAV/FFmpeg |
| Cámara demasiado reactiva | mareo y pérdida de composición | pistas lentas, límites de velocidad/aceleración y cues; audio solo modula |
| Cambios de código rompen tomas antiguas | obra imposible de reabrir | versionado y migraciones de documento; guardar versión del runtime |
| Export HTML divergente | la obra exportada no coincide | un único runtime compartido para editor, replay y render; eliminar plantillas duplicadas |
| IA con demasiado mando | pérdida de autoría | herramientas acotadas, presupuesto de cambio, bitácora y botón de bloqueo |
| Evaluación solo técnica | funciona pero no emociona | pruebas con músico/espectador y registro de decisiones artísticas |

---

## 7. Decisión importante sobre el exportador HTML

El export actual contiene reconstrucciones simplificadas de algunos salones. Esto sirve como prueba, pero no debe convertirse en la base del videoclip.

La solución sostenible es separar:

- `RuntimeEscena`: monta y evalúa la obra completa.
- `EditorEscena`: añade paneles y herramientas alrededor del runtime.
- `ReproductorEscena`: usa el mismo runtime sin UI.
- `RenderEscena`: usa el mismo runtime con timestep fijo y captura.

Así, un shader o salón se implementa una vez. Editor, HTML, replay y vídeo dejan de evolucionar por caminos distintos.

---

## 8. Primer videoclip alcanzable

Antes de perseguir 4K, IA o una obra de diez minutos, el primer objetivo artístico debe ser pequeño y completo:

- 1920×1080, 30 FPS, audio 48 kHz.
- Improvisación de 3–5 minutos.
- Dos o tres actores de familias distintas.
- Una cámara de obra y dos luces.
- Entre cuatro y ocho rutas musicales bien elegidas.
- Un grupo solista y un grupo coral.
- Audio original, documento y log guardados junto al vídeo.
- Sin error visible ni pérdida de una sección completa.
- Desfase audiovisual menor de 50 ms en la toma directa.
- Replay capaz de repetir los eventos principales dentro de un frame.

Este MVP ya sería una obra: no una demostración de tecnología, sino una interpretación audiovisual conservada.

---

## 9. Orden inmediato recomendado

El orden que reduce más riesgos, con DocumentoEscena v3 y el transporte mínimo completados, es:

1. ✅ **Transporte mínimo**: preparar/play/stop y reloj de audio compartido.
2. **Registro de performance**: eventos con timestamps y replay sin micrófono.
3. **Cámara de obra direccionable**.
4. **Grabación directa** con `captureStream` + `MediaRecorder`.
5. **Oído AudioWorklet** y calibración.
6. **Master determinista** mediante replay y encoder.
7. **Matriz v2**: grupos, rutas 1:N/N:1 y modos de ensayo.

No conviene construir todavía el Director de IA ni ampliar mucho el catálogo de salones. Primero hay que conseguir que una interpretación pequeña pueda **guardarse, repetirse y filmarse**.

---

## 10. Referencias técnicas de plataforma

Estas APIs permiten construir el recorrido propuesto, pero parte de sus especificaciones sigue en evolución y el soporte de codecs es deliberadamente opcional. Por eso MIA debe comprobar capacidades al arrancar una captura y conservar siempre un fallback de frames + audio maestro.

- [Web Audio API — W3C](https://www.w3.org/TR/webaudio/): gráfica de audio, tiempo musical, entrada viva, análisis y `AudioWorklet`.
- [Media Capture from DOM Elements — W3C](https://www.w3.org/TR/mediacapture-fromelement/): captura de canvas como `MediaStream` y control de frames.
- [MediaStream Recording — W3C](https://www.w3.org/TR/mediastream-recording/): grabación directa de tracks de audio y vídeo.
- [WebCodecs — W3C](https://www.w3.org/TR/webcodecs/): codificación controlada de `VideoFrame`/`AudioData`; requiere resolver aparte el contenedor.
- [WebCodecs Codec Registry — W3C](https://www.w3.org/TR/webcodecs-codec-registry/): nombres de codecs que pueden consultarse en runtime.

---

## Cierre

El reto principal no es hacer que todo se mueva con la música. Eso ya empieza a existir. El reto es conseguir que **cada movimiento tenga identidad, tiempo, memoria y lugar en el encuadre**, y que el sistema recuerde lo suficiente para conservar la interpretación sin domesticarla.

MIA será verdaderamente un instrumento cuando una misma escena pueda tocarse dos veces y producir dos obras diferentes; será además una herramienta cinematográfica cuando cualquiera de esas obras pueda quedar capturada como una toma íntegra.
