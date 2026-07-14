# MIA — Ruta de pruebas
### Bitácora viva de validación

*Actualizada el 14 de julio de 2026 · repetir y actualizar después de cada bloque funcional*

**Reparto:** 🤖 = lo ejecuto yo vía extensión de Chrome (clics, JS, capturas) · 🧑‍🎨 = requiere tu mano/oído

**Estados:** ✅ verificado · 🟡 pendiente en la ronda actual · ⬜ pieza aún no implementada · ❌ fallo reproducible

---

## Punto de control actual — Escenario v2

Sí, **es momento de probar**. La ronda actual no pretende validar todavía la ópera completa: valida que el reparto y el escenario sean suficientemente sólidos para recibir cámara, luces y timeline.

### Verificado técnicamente el 14-07-2026

| # | Estado | Comprobación | Resultado |
|---|---|---|---|
| V1 | ✅ | TypeScript + build de producción | Correctos; 41 módulos transformados |
| V2 | ✅ | Apertura local | WebGPU activo, sin errores de inicio |
| V3 | ✅ | Diálogo propio de nombre | Guarda personaje sin `prompt()` nativo |
| V4 | ✅ | Camerino → ficha → Escenario | “Prima Donna” apareció como actor con controles v2 |
| V5 | ✅ | Duplicar actor | Creó una copia independiente desplazada en X |
| V6 | ✅ | Guardar puesta en escena | “Ensayo I” quedó almacenada como ficha de Escenario |
| V7 | ✅ | Confirmación propia de borrado | Personaje y escena de prueba eliminados; sin residuos |
| V8 | ✅ | Consola durante el recorrido | Sin errores ni advertencias nuevas |

### Ronda inmediata antes de construir la cámara

| # | Estado | Prueba | Esperado |
|---|---|---|---|
| P1 | 🟡 | Dos actores de familias diferentes | Conviven sin alterar materiales o parámetros entre sí |
| P2 | 🟡 | Transform XYZ completo | Posición, rotación y escala por eje responden y persisten |
| P3 | 🟡 | Visibilidad | Ocultar detiene dibujo/actualización; mostrar recupera el actor |
| P4 | 🟡 | Estático frente a dinámico | Estático se congela; dinámico conserva giro/evolución |
| P5 | 🟡 | Guardar, salir y restaurar escena v2 | Reaparecen reparto, nombres, transforms, visibilidad y actuación |
| P6 | 🟡 | Cargar una escena v1 existente | Migra posición, rotación Y y escala uniforme sin error |
| P7 | 🟡 | Escena con 10 actores | Entrada progresiva; no hay bloqueo largo ni crecimiento anormal de memoria |
| P8 | 🟡 | Entrar/salir del Escenario tres veces | Sin duplicados, actores fantasma ni paneles repetidos |
| P9 | 🟡 | Exportar escena con transforms XYZ | El HTML conserva posición, rotación, escala y visibilidad |

### No probar todavía como funcionalidad terminada

| Estado | Pieza | Motivo |
|---|---|---|
| ⬜ | Cámara de obra animada | Solo existe cámara de inspección y persistencia inicial |
| ⬜ | Luces como actores escénicos | El documento reserva el campo, no hay editor/runtime |
| ⬜ | Timeline y keyframes | Las pistas están tipadas, pero aún no se evalúan |
| ⬜ | Música como reloj maestro | La sinestesia reacciona, pero no existe transporte musical |
| ⬜ | Modulación individual por actor | Los parámetros de actor aún no están direccionados en el bus |
| ⬜ | Vestuario por actor | Concepto definido; contrato todavía pendiente |

### Registro de rondas

| Fecha | Rama/commit | Alcance | Resultado |
|---|---|---|---|
| 14-07-2026 | `codex/escenario-v2` · `9d659a1` | Documento v2, diálogo, alta y duplicación de actores, guardado básico | Base técnica ✅ · ronda visual P1–P9 pendiente |

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
| E5 | Cargar una escena v1 guardada antes del Documento v2 | Migra: conserva posición, rotación Y y escala uniforme |
| E6 | Actor estático vs dinámico | Estático queda visualmente congelado; dinámico conserva giro/evolución |
| E7 | Ocultar, duplicar y transformar XYZ un actor | Visibilidad inmediata; copia independiente; rotación y escala por eje persisten al guardar/cargar |
| E8 | Restaurar una escena con varios actores | Entran progresivamente, uno por frame; la interfaz no queda bloqueada durante todo el montaje |

## Cierre

- Hallazgos → se arreglan en el momento o se anotan aquí con ❌ y ticket en el plan.
- Si P1–P9 quedan ✅: luz verde para **cámara de obra + transporte/timeline mínimo**.
- Después de cada sesión se actualizan estados y se añade una fila al **Registro de rondas**.

---

## Qué necesito de ti para arrancar

1. **Servidor encendido**: `cd ~/Claude/Projects/Mia && npm run dev` (y déjalo corriendo — la sesión anterior se cayó a mitad).
2. **Chrome o el navegador integrado**. Los diálogos propios ya funcionan en ambos.
3. **Tu clic en "Permitir"** cuando el navegador pida micrófono (C1) — es lo único que yo no puedo hacer.
4. **Fuente de sonido** para el bloque C: palmas o voz bastan; si tienes la guitarra o interfaz a mano, mejor (dime qué entrada usas).
5. **MIDI** (opcional): si tienes controlador/pastilla conectado, dímelo para incluir C4.
6. Para la ronda inmediata basta con decir **“listo para P1–P9”**. Audio y MIDI pueden dejarse para los bloques C posteriores.
