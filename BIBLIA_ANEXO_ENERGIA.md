# MIA — Anexo I a la Biblia Conceptual
### El Paisaje de Coherencia: el Barniz como energía

*Julio 2026 · anexo a BIBLIA_CONCEPTUAL.md — da forma matemática al Barniz (§V) y física a la capa de Frase (§IV). Plan de ejecución: PLAN_IMPLEMENTACION_BARNIZ.md*

---

## I. La idea en una frase

El Barniz deja de ser una lista de restricciones que se *vigilan* y pasa a ser un **paisaje de energía que tira**: una función escrita a mano `E(s)` sobre un vector de estado normalizado, cuyos valles son las configuraciones que pertenecen al mundo del autor y cuyas cuestas son las que lo traicionan. La música empuja el estado; el paisaje lo devuelve al valle; la tensión acumulada decide cuánto se le permite vagar.

```
s = s                                ← persiste, nunca se reinicia
s += empuje(música)                  ← la Mesa de Sinestesia desplaza
s -= paso · ∇E(s)                    ← el Barniz devuelve al valle
s += temperatura(tensión) · azar     ← vagabundeo, gobernado por la Frase
```

Esto no reemplaza ningún órgano del templo: es la **mecánica interna** de dos que ya estaban planeados — el Barniz (§V) y los acumuladores de Frase (§IV) — y le da al Narrador un mando nuevo.

---

## II. El vector de estado

Un subconjunto de direcciones del ParamBus, elegido por el autor en cada ficha de barniz, **normalizado a [0,1]** usando los rangos ya registrados en el bus (el tono es circular: envuelve). Típicamente 8–24 números: mezcla de paleta (tono, saturación, rango cromático), forma (escala, velocidad, turbulencia/caos) y carga (densidad, resolución visible, cantidad de actores activos).

La regla de diseño que hace posible la coherencia: **la mayoría del vector debe ser común a toda la escena** (paleta y luz compartidas), y solo una minoría específica de cada actor o salón. Si cada actor tuviera su propia paleta, no habría nada que mantener coherente — solo efectos pegados.

Sobre este vector, todo es uniforme y barato: el gradiente por diferencias finitas de 24 números con cuatro términos son microsegundos. **La latencia desaparece por construcción, no por optimización.**

---

## III. Los cuatro tipos de término

Cuatro familias, todas escritas a mano, cero ML. Las constantes y anclas concretas son del autor; los *tipos* son estructurales:

**E₁ — Legibilidad (acoplamiento).** Ciertos parámetros hay que *pagarlos* con otros: turbulencia sin contraste es papilla gris. Forma general: `max(0, gasto − pago)²`, más términos cuárticos para extremos (brillo: plano en el centro, brutal en negro y quemado).

**E₂ — Identidad cromática (multi-pozo).** Aquí vive la firma del autor: 2–4 tonos ancla que *son* la paleta; la energía tira hacia el más cercano (distancia circular). Varios valles = varias paletas, todas legítimas: **diversidad dentro de coherencia, hecha matemática**. Un segundo término mata el arcoíris: rango cromático amplio y saturación alta a la vez se penaliza.

**E₃ — Carga perceptual (banda).** Una suma ponderada de lo que se mueve y cuánto ocupa, atraída hacia una banda media: ni pantalla muerta ni sobrecarga. Los parámetros de un actor solo cuentan **ponderados por su presencia** (visibilidad/mezcla) — lo inactivo no ensucia la energía. Este término es la versión continua del *presupuesto de densidad* del Narrador.

**E₄ — Inercia (memoria de un paso).** `k₄·Σ(sᵢ − s_previoᵢ)²`: amortiguación hacia el estado anterior, gradiente analítico. Es el antídoto matemático contra el **presente perpetuo** (§VI de la biblia): el río erosiona el lecho lentamente. El equilibrio `k₄` ↔ amplitud del empuje musical **ES el instrumento**: si la inercia gana, todo se siente muerto; si el empuje gana, se pierde la coherencia.

---

## IV. La temperatura — el regalo

El término de azar se escala con la **tensión de Frase** (el acumulador ya construido en la Etapa 1):

- Pasaje calmado → temperatura baja → el estado se hunde en el valle → la imagen se asienta.
- Clímax → temperatura alta → el estado salta crestas, explora, se desestabiliza.

Es *annealing* dirigido por la improvisación: un mecanismo expresivo de primer orden que ningún mapeo directo produce. La tensión no escribe en ningún parámetro; escribe en **cuánta libertad tiene el sistema**. Esa es exactamente la diferencia entre visualizador reactivo y experiencia paralela.

---

## V. Las dos reglas de frontera

Dos direcciones quedan **protegidas**: la música jamás escribe directamente en ellas.

1. **El tono / la paleta.** El color parpadeando con el bajo es el tic que delata al visualizador barato. El hue se mueve despacio, y solo porque el Barniz transiciona o el Narrador lo decide. La paleta es identidad, no parámetro reactivo.
2. **La mezcla entre universos** (qué ficha/escena se manifiesta). Es trabajo del Narrador en la escala de la sección — no del golpe.

La Mesa de Sinestesia debe rechazar esas direcciones como destino. Es la constitución del principio 5 aplicada al ruteo.

---

## VI. Encaje en el templo

| Concepto del anexo | Órgano MIA | Estado |
|---|---|---|
| Vector de estado normalizado | Subconjunto del ParamBus (rangos ya registrados) | ◻ capa fina nueva |
| Empuje musical | Mesa de Sinestesia → plano de modulación | ✅ ya es esto |
| E(s) + gradiente + corrección | **El Barniz v1** (Etapa 2) — su mecánica interna | ◻ este anexo |
| Temperatura | Acumulador `tension` (Etapa 1) → escala del azar | ✅ la fuente existe |
| Inercia E₄ | Los "suavizados asimétricos" elevados a física | ◻ dentro del Barniz |
| Ficha de barniz | Anclas + constantes k + direcciones del vector + banda de carga | ◻ ficha nueva |
| Transición de barnices | Interpolar anclas y constantes = **mover el paisaje**, no el estado | ◻ el estado migra solo, sin corte |
| Mando del Narrador | Elegir barniz, curva de temperatura, presupuesto de corrección | ◻ Etapa 7 |

La transición de barnices merece subrayarse: al interpolar dos fichas de barniz no se interpola la imagen — se deforma el paisaje bajo el estado, y el estado **rueda solo hacia el valle nuevo**. La transición es orgánica por construcción. Eso es lo que una LoRA nunca dio.

---

## VII. Lo que este anexo NO es

- No es un órgano nuevo del templo: es la mecánica del Barniz y de la Frase.
- No decide ningún píxel ni inventa vocabulario: corrige *hacia* configuraciones que el autor declaró suyas. Principio 5 intacto.
- No sustituye al Narrador: la energía no tiene memoria dramática (solo un paso, E₄). El Narrador lee la historia; el paisaje solo siente el presente y su derivada.
- No lleva ML. Si algún día un modelo aprende las constantes k a partir de preferencias del autor, será la v2 — y seguirá sin tocar la estructura.

---

## VIII. Procedencia

Sintetizado de dos documentos de un proyecto hermano («documento maestro» y «especificación v0 — vector de energía»), que llegaron por la vía inversa: sin taller, sin vocabulario, sin memoria — pero con la física exacta que al Barniz le faltaba. De ellos se toma la estructura (vector normalizado, cuatro tipos de término, temperatura, reglas de frontera) y se descarta su vocabulario concreto (dos modos fbm/radial y sus 12 parámetros): MIA ya tiene el suyo, decantado en salones y fichas.

> El Barniz era un adjetivo. Ahora es un campo gravitatorio.
