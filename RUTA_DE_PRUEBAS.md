# MIA — Ruta de pruebas
### Sesión de validación en vivo (post Etapa 1 + fBM + Sinestesia + Delaunay)

*Julio 2026 · protocolo repetible — marcar ✅/❌ por ítem en cada sesión*

**Reparto:** 🤖 = lo ejecuto yo vía extensión de Chrome (clics, JS, capturas) · 🧑‍🎨 = requiere tu mano/oído

---

## Bloque A — Humo (2 min) 🤖

| # | Prueba | Esperado |
|---|---|---|
| A1 | Cargar http://localhost:5173 | Sin banner rojo; consola sin errores |
| A2 | Indicador de backend | ● WebGPU verde |
| A3 | Selector de salones | 5 entradas: Formas Exóticas, Trazo y Grafito, Bajo Relieve, Delaunay, El Escenario |
| A4 | Recorrer los 5 salones ida y vuelta | Cada uno pinta; volver a entrar no deja pantalla vacía (bug de firmas ya mordido una vez) |

## Bloque B — Etapa 1: la memoria (5 min) 🤖

| # | Prueba | Esperado |
|---|---|---|
| B1 | LFO forma *ruido*, rugosidad H=1 vs H=0 sobre `escala` | A ojo: deriva suave montañosa vs temblor nervioso. Capturas comparadas |
| B2 | Monitor gráfico del acumulador (vista `graph` de Tweakpane) | La curva se dibuja en el panel — único riesgo runtime nuevo |
| B3 | **Criterio Etapa 1**: acumulador *tensión* → `escala`, fuga ~0.4; genero actividad sintética 3s y paro | La figura crece durante la actividad y se desinfla sola en ~5s de silencio |
| B4 | Acumulador *meseta* → algún parámetro visible; 15s sin tocar nada | El valor crece solo en la quietud; un gesto lo colapsa |
| B5 | Quitar todos los LFOs/acumuladores | Los parámetros vuelven EXACTOS a su base (plano de modulación limpio) |

## Bloque C — Sinestesia: MIA escucha por primera vez (5 min) 🧑‍🎨

| # | Prueba | Esperado |
|---|---|---|
| C1 | 🧑‍🎨 Clic en activar audio de tu panel + **Permitir** micrófono (el navegador solo acepta ese clic tuyo) | estado "audio activo" |
| C2 | 🧑‍🎨 Palmas / voz / guitarra cerca del micro | `audioNivel` y `audioAtaque` se mueven (lo verifico por consola) |
| C3 | Ruta audioAtaque → parámetro visible (pulso) | Cada palmada = pulso visual; sensación de inmediatez (medimos latencia subjetiva) |
| C4 | Si tienes MIDI conectado: activar y tocar | `midiNota`/`midiVelocidad` reaccionan |
| C5 | 🤖 Acumulador *tensión* escuchando al parámetro movido por audio | **La cadena completa**: sonido → sinestesia → parámetro → memoria. El futuro en miniatura |

## Bloque D — Delaunay: revisión de contrato (5 min) 🤖

| # | Prueba | Esperado |
|---|---|---|
| D1 | Lectura del código del salón | dispose completo, reset de estado en init, sin `new NodeMaterial()` base, materiales/geometrías liberados |
| D2 | Entrar/salir/reentrar al salón ×2 | Sin fugas visuales ni pantalla vacía |
| D3 | ☆ Guardar ficha de Delaunay → recargarla | Idéntica |
| D4 | ➕ al Escenario junto a otra figura | Dos actores conviven; transforms funcionan |
| D5 | Sus parámetros aparecen en destinos de LFO/acumulador | Modulable como los demás |

## Bloque E — Regresión del ciclo taller (5 min) 🤖

| # | Prueba | Esperado |
|---|---|---|
| E1 | Cargar ficha antigua (shape1) | Sigue funcionando tras los cambios del bus |
| E2 | Guardar/cargar escena completa | Actores restaurados |
| E3 | ⎙ Imprimir del Escenario | HTML se genera; sin oscilación de LFOs horneada (base limpia) |
| E4 | Imprimir un salón con LFO activo | Los valores exportados son la BASE, no el instante modulado |

## Cierre

- Hallazgos → se arreglan en el momento o se anotan aquí con ❌ y ticket en el plan.
- Si todo ✅: luz verde para **Etapa 2 — el Barniz**.

---

## Qué necesito de ti para arrancar

1. **Servidor encendido**: `cd ~/Claude/Projects/Mia && npm run dev` (y déjalo corriendo — la sesión anterior se cayó a mitad).
2. **Chrome con la extensión Claude conectada** y sesión iniciada.
3. **Tu clic en "Permitir"** cuando el navegador pida micrófono (C1) — es lo único que yo no puedo hacer.
4. **Fuente de sonido** para el bloque C: palmas o voz bastan; si tienes la guitarra o interfaz a mano, mejor (dime qué entrada usas).
5. **MIDI** (opcional): si tienes controlador/pastilla conectado, dímelo para incluir C4.
6. Avísame con un "listo" y arranco el bloque A.
