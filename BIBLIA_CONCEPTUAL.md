# MIA — Biblia Conceptual
### El plano del templo: un motor de experiencia audiovisual con memoria

*Julio 2026 · documento fundacional — está por encima del PLAN_ESTRATEGICO (el plan ejecuta, esto orienta)*

---

## I. El propósito

MIA no es un visualizador de música. Un visualizador es un espejo: refleja y olvida. MIA es un **interlocutor**: un sistema que escucha a un músico improvisando, traduce el paquete completo de matices sonoros a un orden visual coherente, **recuerda lo que ha pasado**, y devuelve una lectura que a su vez alimenta las decisiones del músico. Un loop que se enriquece en cada vuelta:

```
        toca ──────────────► el sistema escucha, recuerda, traduce
     MÚSICO                                                VISIÓN
        ◄────────── la visión propone, sugiere, responde ──────
```

La palabra clave es *enriquece*. Un espejo devuelve siempre lo mismo. Un interlocutor tiene memoria, criterio y — con mesura — iniciativa. La meta experiencial: un viaje (sí, como un trip psicodélico, en el sentido preciso: percepción intensificada, sinestesia, disolución del borde entre el que hace y lo hecho) que motive al músico a desarrollar una perspectiva paralela de su propia improvisación.

---

## II. Los cinco principios

**1. Jazz, no relojería.** Sistemas con reglas internas que permiten improvisar, nunca coreografías predeterminadas. (Principio fundador del proyecto; sigue vigente en cada capa.)

**2. El silencio es el origen, no la ausencia.** Como en la práctica sufí: sumergirse en la nada total y escuchar cómo emerge desde el silencio la semilla de toda la catedral. El sistema trata el silencio como evento musical de primera clase — el estado cero del que todo germina y al que todo puede volver. Los silencios *esculpen* (decaimiento, floración, respiración), no interrumpen.

**3. Una manifestación, muchos universos latentes.** Respuesta a la pregunta fundacional — ¿punto que deviene línea, o universos coexistentes? — **ambas, en planos distintos.** En lo latente coexisten todos los universos (cada ficha, cada salón, cada gramática estética es un universo posible). En lo manifiesto hay UNA génesis por actuación: la coherencia del viaje exige monogénesis en la presentación. Exactamente como la improvisación misma: infinitas frases posibles laten en las manos del músico, pero suena una línea a la vez. El Narrador (§IV) es quien decide qué universo latente se manifiesta y cuándo.

**4. Arte objetivo: la matemática compartida.** Existe una tradición (Gurdjieff la llamó *arte objetivo*) que sostiene que ciertas geometrías y proporciones evocan experiencias precisas y universales, no arbitrarias. MIA no necesita creer la doctrina completa para usar su mecanismo: **la música y la forma comparten matemática.** Un intervalo musical es una razón de frecuencias; una proporción visual es una razón de longitudes; una simetría es un orden de repetición — y el parámetro *m* de la supershape ES literalmente un orden de simetría. El mapeo música→visual no debe ser un capricho estético celda a celda, sino estar *anclado* en esa matemática compartida:

| Fenómeno musical | Matemática | Traducción visual anclada |
|---|---|---|
| Octava (2:1) | duplicación | escala ×2, subdivisión binaria |
| Quinta (3:2), cuarta (4:3) | razones simples = consonancia | proporciones armónicas entre elementos, simetrías compatibles |
| Disonancia (razones complejas, batimientos) | interferencia | tensión geométrica: asimetría, ruptura de retícula, rugosidad |
| Nota / altura | frecuencia absoluta | posición en gradiente (altura, hue) — logarítmico como el oído |
| Acorde / armonía | conjunto de razones | orden de simetría (m), familia poligonal |
| Ritmo / compás | razones temporales | frecuencias de LFO como ratios del tempo (1/2, 1/4, 3/4) |
| Timbre | forma espectral | textura de superficie, grano, materia |
| Rugosidad del timbre | pendiente espectral (dB/octava) | **exponente de Hurst H del ruido visual** (fBM, IQ): timbre redondo → H=1 (deriva montañosa con memoria), timbre rasgado → H→0 (nervio de lluvia). Mismo espectro, dos dominios — ya implementado en la forma 'ruido' de los LFOs |

Esto es una **hipótesis operativa, no dogma**: se prueba con espectadores reales, se conserva lo que funciona. Pero da al proyecto lo que ningún visualizador tiene — un criterio no arbitrario para el diseño del impacto.

**5. La máquina interpreta, nunca autora.** Todo lo que aparece en pantalla fue creado por el autor (las fichas, las gramáticas, los salones). El sistema — incluido cualquier agente o modelo — solo elige, gradúa, combina y ordena en el tiempo ese vocabulario. Es un director de orquesta con la partitura del autor, jamás un pintor propio. (Por eso se descartó la generación end-to-end: disuelve el lenguaje decantado durante años.)

---

## III. La ontogénesis visual — el protocolo de la semilla

El Big Bang del motor, en su literalidad visual. Cada actuación comienza en el estado cero y germina por etapas dimensionales:

```
SILENCIO ──► PUNTO ──► LÍNEA ──► CURVA ──► SUPERFICIE ──► VOLUMEN ──► CONSTELACIÓN
 (nada)     (0D: la    (1D: el   (gesto:   (2D: la piel   (3D: el     (N: universos
             semilla,   primer    vibrato,  aparece —      cuerpo      en relación —
             late con   inter-    bend,     caras,         entero —    el Escenario
             el primer  valo      curva-    trama)         figura      pleno)
             sonido)    traza     tura)                    completa)
             dirección)
```

Reglas del protocolo:

- **La germinación se gana.** Cada salto dimensional lo desbloquea la música: densidad, energía acumulada, riqueza armónica. Un músico tímido se queda — bellamente — en el mundo de las líneas. La catedral entera solo aparece si la música la construye.
- **Es reversible.** El silencio prolongado repliega: la constelación se disuelve hacia el volumen, la superficie hacia la línea, el punto... y la nada. El final de un viaje es tan importante como su inicio.
- **No es un tutorial, es una dramaturgia.** En actuaciones avanzadas el Narrador puede alterar el orden, saltar etapas o reiniciar la semilla a mitad de viaje (nueva sección = nueva génesis dentro del mismo universo).

Técnicamente: las etapas son *presupuestos de manifestación* (qué % del vocabulario visual está disponible), no escenas separadas. El punto y la constelación son la misma arquitectura con distinta apertura del diafragma.

---

## IV. Las capas del tiempo — y el Narrador

El talón de Aquiles de todo motor audiovisual reactivo es el **presente perpetuo**: mapeo instantáneo 1:1 → la pantalla se agita con cada nota → ruido visual → salvapantallas caro. La solución es una jerarquía de memorias, cada una operando en su escala:

| Capa | Escala | Qué hace | Estado |
|---|---|---|---|
| **Reflejo** | ~10 ms | rasgos → modulación directa (energía→escala, pitch→forma) | ✅ el plano de modulación del bus ya es esto |
| **Gesto** | 0.1–1 s | vibrato, staccato, bends → eventos visuales discretos | ◻ capa artesanal sobre f0/envolvente (Fase D) |
| **Frase** | 1–10 s | curvas de tensión, densidad, dirección melódica → evolución de parámetros lentos | ◻ acumuladores con inercia |
| **El Narrador** | 10 s – todo el viaje | lee la historia completa y dirige la dramaturgia | ◻ **el órgano nuevo** |

**El Narrador** es el agente que preguntabas. Su naturaleza exacta:

- **Qué lee:** el historial de rasgos y gestos (no el audio crudo): perfiles de energía, mapa de tensión, repeticiones y motivos, cuánto hace que no cambia nada, en qué etapa de germinación estamos.
- **Qué decide:** transiciones de etapa (§III), cambios de universo latente (qué ficha/escena manifestar), aplicación y transición de Barniz (§V), presupuesto de densidad visual (cuánto puede moverse la pantalla — el freno de mano contra el ruido), y con **iniciativa acotada**: de tanto en tanto *propone* — introduce un evento visual no solicitado (una deriva, una floración lenta) que invita al músico a responder. Ahí el loop se vuelve dueto de verdad.
- **Qué NO decide jamás:** ningún píxel. Solo dirige vocabulario del autor con reglas del autor.
- **Su implementación es un gradiente:** v1 = máquina de estados con reglas legibles (si la tensión acumulada supera X y hay meseta de energía, transición de etapa). v2 = pequeño modelo entrenado con las preferencias del autor (cuándo TÚ habrías cambiado de escena). Nunca un modelo generativo.

---

## V. El Barniz — la LoRA del taller

Tu analogía es exacta y merece ser sistema. En generación de imágenes, una LoRA imprime un estilo constante sobre cualquier contenido. El equivalente MIA — el **Barniz** — es una **gramática estética**: un conjunto de restricciones que tiñe todo lo que se manifiesta sin cambiar QUÉ se manifiesta:

- **Paleta** (rangos de color permitidos, no colores sueltos)
- **Familia geométrica** (qué salones/figuras están disponibles en este universo)
- **Gramática de movimiento** (elástico vs. nervioso: los suavizados y curvas de TODOS los mapeos a la vez)
- **Materia** (puntos vs. alambre vs. caras; grano; densidad de trama)
- **Presupuesto de caos** (cuánta irregularidad se tolera antes del clamp)

El Barniz es una ficha más (las *fichas de sinestesia* del plan, elevadas de mapeos sueltos a gramática completa). Se pueden fundir dos barnices (interpolación), y el Narrador puede transicionarlos a lo largo del viaje — el "mismo" material sonoro atravesando dos barnices produce dos mundos. Eso es exactamente lo que una LoRA hace con un prompt.

---

## VI. El talón de Aquiles y el Big Bang

**El talón — dos, en realidad:**

1. **El literalismo sin memoria** (el salvapantallas): si todo reacciona a todo instantáneamente, nada significa nada. *Antídotos ya en diseño:* el presupuesto de densidad del Narrador, los suavizados asimétricos de la matriz, la jerarquía de capas temporales, y la regla de oro de que pocos mapeos bien elegidos superan a muchos.
2. **El exceso de agente** (la pérdida de autoría): si el Narrador decide demasiado, el músico deja de reconocerse en el espejo y el loop muere — obedecería a la máquina en vez de dialogar con ella. *Antídotos:* iniciativa acotada y presupuestada, reglas legibles antes que modelos, y el principio 5 como constitución.

**El Big Bang — también dos, uno técnico y uno estético:**

1. *Técnico:* el **protocolo de la semilla** (§III). Es la pieza que convierte "efectos que reaccionan" en "un viaje con dramaturgia". Todo lo demás decora; esto estructura.
2. *Estético:* la **matemática compartida** (§II.4). Es lo que separa a MIA de todo visualizador existente: el impacto no se diseña a ojo, se ancla en las proporciones que música y geometría ya comparten. Si la hipótesis del arte objetivo tiene algo de verdad, aquí es donde se manifiesta.

---

## VII. El mapa del templo — correspondencia con lo construido

Nada de lo construido sobra. Cada pieza encuentra su lugar en el plano mayor:

```
                          EL TEMPLO
┌─────────────────────────────────────────────────────────────┐
│  LA SEMILLA (◻)          el ritual de inicio: silencio→punto │
│  EL NARRADOR (◻)         dramaturgia, memoria, iniciativa    │
│  EL BARNIZ (◻)           gramáticas estéticas (fichas de     │
│                          sinestesia elevadas)                │
├──────────────────────────────────────────────────────────────┤
│  LA MATRIZ DE MAPEO (◻)  el oído: rasgos/gestos → destinos   │
│  EL OÍDO CRUDO (◻)       Web Audio/MIDI, Meyda/Essentia      │
├──────────────────────────────────────────────────────────────┤
│  EL SISTEMA NERVIOSO (✅) ParamBus: base + modulación         │
│  LA RESPIRACIÓN (✅)      LFOs — y el vibrato del músico ES   │
│                          un LFO que él ejecuta: mismo idioma │
├──────────────────────────────────────────────────────────────┤
│  LA NAVE (✅)             el Escenario: universos compuestos  │
│  EL DEPÓSITO (✅)         fichas: el vocabulario decantado    │
│  LAS CAPILLAS (✅)        salones: las familias de materia    │
│  LA IMPRENTA (✅)         exportadores: el templo viaja       │
└──────────────────────────────────────────────────────────────┘
```

Léelo de abajo hacia arriba y es la historia del proyecto; de arriba hacia abajo, el orden de mando de una actuación: la Semilla abre, el Narrador dirige, el Barniz tiñe, la Matriz traduce, el bus transmite, y las capillas manifiestan el vocabulario del depósito sobre la nave.

**Ruta de incorporación (enmienda al plan, no reemplazo):**

- Fase B (en curso) gana un objetivo: los acumuladores de *Frase* (tensión, densidad) como fuentes internas del bus — se prueban con LFOs antes de tener audio.
- Fase D se reordena: primero el protocolo de la Semilla con fuentes falsas (es dramaturgia pura, no necesita guitarra), luego el oído crudo, luego la matriz anclada en §II.4, y el Narrador v1 (máquina de estados) al final — cuando haya historia que leer.
- El Barniz puede empezar antes: es una generalización de las fichas que ya existen.

---

## VIII. Cierre

La pregunta "¿punto o universos?" tiene la respuesta del músico: **todos los universos laten; uno suena.** El silencio los contiene a todos — por eso el sufí escucha la nada: no está vacía, está *concentrada*. MIA construye la versión operativa de esa intuición: un depósito de universos decantados (lo hecho), un oído que traduce con matemática compartida (lo próximo), y un narrador con memoria que deja que la catedral emerja — nota a nota, punto a línea — del silencio de cada actuación.
