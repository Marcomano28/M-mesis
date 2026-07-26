# MIA — Plan de implementación: el Barniz v1 como paisaje de energía
### Ejecuta el Anexo I de la biblia dentro de la Etapa 2 del plan estratégico

*Julio 2026 · concepto: BIBLIA_ANEXO_ENERGIA.md · marco: PLAN_ESTRATEGICO.md (Etapa 2)*

---

## 0. Punto de partida (lo que ya existe y se reutiliza)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Rangos por dirección | `ParamBus.registrarRango()` | Normalización a [0,1] gratis: `(v−min)/(max−min)` |
| Plano de modulación | `ParamBus.modular(dir, fuente, Δ)` | La corrección del Barniz es **una fuente más** (`@barniz`). Apagarlo devuelve la base intacta — no toca lo que el autor fijó |
| Empuje musical | `MotorSinestesia` (rutas con ataque/caída) | Ya escribe modulaciones: ES el término `empuje` del bucle |
| Tensión de Frase | `MotorAcumuladores`, proceso `tension` | La fuente de la temperatura, ya con fuga y saturación suave |
| Persistencia | `DocumentoEscena` v3 (guarda rutas, LFOs, acumuladores) | La ficha de barniz viaja igual |
| Tick por frame | Engine → motores (`tick(dt, tiempo)`) | El Barniz se engancha al mismo reloj, diezmado a ~15 Hz |

No hay que construir infraestructura: solo el motor de energía y su ficha.

---

## Fase 1 — `VectorEstado` (medio día)

Capa fina de lectura/escritura normalizada sobre el bus. Sin energía todavía.

- `src/core/VectorEstado.ts`: dada una lista de direcciones (con flag `circular` para tonos), lee `valorFinal` normalizado a [0,1] y escribe correcciones desnormalizadas vía `bus.modular(dir, '@barniz', Δ)`.
- Direcciones sin rango registrado: se rechazan con aviso en el panel de errores (no adivinar).
- **Criterio:** en consola (`window.MIA`), leer el estado normalizado de una escena y empujarlo a mano se refleja en pantalla.

## Fase 2 — `MotorBarniz`: energía + gradiente + inercia (1–2 días)

El corazón. `src/core/Barniz.ts`, mismo contrato que los otros motores (`tick`, `exportar`, `restaurar`, `onCambio`).

- Los cuatro términos del Anexo I §III como funciones puras sobre el vector normalizado:
  - `E1` acoplamientos declarados por pares `{gasto, pago, k}` + cuárticos de extremos.
  - `E2` multi-pozo circular sobre las direcciones de familia `paleta` + anti-arcoíris.
  - `E3` banda de carga con pesos por dirección, ponderando cada actor por su presencia (visibilidad).
  - `E4` inercia con gradiente analítico; el resto por diferencias finitas (`h=0.01`).
- Bucle a ~15 Hz (diezmado del tick de frame): `s_previo=s; g=∇E(s); corrección = −paso·g`, con **presupuesto de corrección** (norma máxima por tick) — el mando que evita que el paisaje pelee contra un gesto deliberado del autor.
- Constantes iniciales del documento origen: `k1=1, k1b=8, k2=3, k2b=2, k3=1.5, k4=6, paso=0.05`. Se ajustan a oído.
- **Criterio:** con dos tonos ancla definidos y el micrófono empujando, la paleta deriva sola hacia un ancla al callar la música. Sin parpadeo (E₄ activo).

## Fase 3 — Temperatura (medio día)

- Un acumulador `tension` designado como fuente de temperatura: `s += T(tension)·ruido_gaussiano` en el tick lento, con curva configurable (p.ej. `T = Tmax·tension²`).
- El ruido nunca entra en direcciones protegidas (tono) por encima de un factor mínimo.
- **Criterio:** música calmada → la imagen se asienta visiblemente; clímax → explora sin romper paleta. Grabar 2 minutos y verlo.

## Fase 4 — La ficha de barniz + panel (1–2 días)

- `FichaBarniz`: `{ nombre, direcciones del vector, anclas de tono, acoplamientos, pesos de carga y banda, constantes k, paso, presupuesto, curva de temperatura }`. Persiste en DocumentoEscena v3 y como ficha propia en la cajonera.
- Panel Tweakpane: monitores en vivo (E total y por término, temperatura, norma de corrección), constantes editables, botón apagar (limpia `@barniz` del bus).
- **Interpolación entre dos barnices**: un slider que mezcla anclas y constantes — el paisaje se deforma y el estado rueda solo (Anexo I §VI). Es la transición orgánica que luego usará el Narrador.
- **Criterio:** la misma escena atravesando dos barnices produce dos mundos reconocibles (el criterio original de la Etapa 2), y la transición entre ellos no tiene corte.

## Fase 5 — Direcciones protegidas (medio día)

- La ficha de barniz declara direcciones protegidas (tono/paleta; más adelante, mezcla de universos). La Mesa de Sinestesia las excluye como destino y las marca en su UI.
- **Criterio:** imposible rutear micrófono→tono desde la UI. El color solo se mueve por Barniz o autor.

## Fase 6 — Validación: la prueba de la obra (1 sesión)

La prueba que conecta con RUTA_AL_VIDEOCLIP (P7 nivel A, grabación directa):

1. **¿Se siente tocable?** Tocar fuerte/suave, rápido/lento. El golpe responde al instante (va por Sinestesia, el Barniz no lo frena); la frase evoluciona con inercia. Si falla: balance `k4` ↔ amplitud de rutas. **Ese equilibrio es el instrumento; todo lo demás es cosmética.**
2. **¿Se siente un solo mundo?** Dejar correr 10 minutos con música variada, grabar, mirar después: ¿parece una obra o zapping? Si falla: trabajar E₂ y aumentar las direcciones compartidas del vector — no añadir modos ni actores.

Los dos únicos mandos de afinación fina: `k4` vs empuje, y `paso` (grande = oscila, pequeño = no corrige a tiempo).

---

## Orden y esfuerzo

```
F1 VectorEstado ──► F2 MotorBarniz ──► F3 Temperatura ──► F4 Ficha+panel ──► F5 Protección ──► F6 Prueba
   (0.5 d)            (1–2 d)            (0.5 d)             (1–2 d)            (0.5 d)          (1 sesión)
```

Total ≈ una semana de trabajo real. F1–F3 dan ya el fenómeno completo en consola; F4–F5 lo hacen instrumento.

## Lo que NO se construye

- Nada de ML (ni para constantes ni para anclas): v2, y solo si las k a mano se quedan cortas.
- Nada de energía por píxel ni en shader: E vive en el espacio de parámetros, en CPU, en microsegundos.
- Nada de Narrador todavía: el Barniz no decide *cuándo* cambiar de paisaje; eso es la Etapa 7, cuando haya historia que leer.
- Ningún salón nuevo ni "modos" del documento origen: el vocabulario es el de MIA.

## Riesgos propios

- **El paisaje contra el autor.** Si el autor fija una base fuera del valle, el Barniz empujará siempre. El presupuesto de corrección (F2) y el botón de apagado son la válvula; si molesta en la práctica, añadir "recentrado": mover el ancla al valor del autor tras N segundos de gesto sostenido.
- **Direcciones heterogéneas.** Actores entran y salen del Escenario; el vector debe tolerar direcciones muertas (limpiarlas al vuelo, como ya hacen rutas y acumuladores con `limpiarFuente`).
- **Doble suavizado.** Las rutas de Sinestesia ya traen ataque/caída y E₄ añade inercia: vigilar que no se apilen hasta la sordera. Empezar con rutas rápidas y dejar la lentitud a E₄.
