# MIA — Ruta de pruebas
### Bitácora viva de validación

*Actualizada el 16 de julio de 2026 · repetir y actualizar después de cada bloque funcional*

**Reparto:** 🤖 = lo ejecuto yo vía extensión de Chrome (clics, JS, capturas) · 🧑‍🎨 = requiere tu mano/oído

**Estados:** ✅ verificado · 🟡 pendiente en la ronda actual · ⬜ pieza aún no implementada · ❌ fallo reproducible

---

## Punto de control actual — Escenario v3 + Transporte musical

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
| P1 | ✅ | Dos actores de familias diferentes | Delaunay + Formas Exóticas convivieron sin errores ni contaminación visible |
| P2 | ✅ | Transform XYZ completo | `x = 0.10` reapareció después de guardar, salir y restaurar |
| P3 | ✅ | Visibilidad | Aria se guardó oculta y reapareció oculta al restaurar |
| P4 | 🟡 | Estático frente a dinámico | Estático se congela; dinámico conserva giro/evolución |
| P5 | ✅ | Guardar, salir y restaurar escena v2 | Reaparecieron reparto, nombre, transform, visibilidad y actuación estática |
| P6 | 🟡 | Cargar una escena v1 existente | Migra posición, rotación Y y escala uniforme sin error |
| P7 | 🟡 | Escena con 10 actores | Los 10 terminaron de montar sin errores; falta valorar fluidez y memoria en Chrome |
| P8 | ✅ | Entrar/salir del Escenario tres veces | 10 actores exactos en los tres ciclos; sin duplicados, fantasmas ni errores |
| P9 | 🟡 | Exportar escena con transforms XYZ | Corregida liberación prematura del Blob; descarga pendiente de verificar fuera del navegador integrado |
| P10 | 🟡 | GLB de Trazo → ficha → Escenario | El mismo GLB debe reemplazar el nudo de muestra al montar el actor |
| P11 | 🟡 | Exportar supershape + GLB de Trazo | El HTML debe reconstruir los dos actores; Delaunay/Relieve avisan que no se exportan aún |
| P12 | ✅ | Destinos individuales de actor | La Mesa ofreció pose XYZ y expresiones; `ratón X → Marioneta · rotación Y` respondió de 0.19 a 0.72 sin errores |
| P13 | 🟡 | Dos marionetas con micrófono | `audio ataque → escala Y` de una y `audio nivel → rotación Z` de otra; la escena global debe quedar quieta |
| P14 | ✅ | Persistencia de la coreografía | Una ficha restauró actor, ruta `audio ataque → rotación Y`, LFO `→ rotación X` y acumulador `rotación X → escala Z`; quitar el actor limpió los tres motores |
| P15 | ✅ | Hilos seleccionados por ficha | Una ficha `🧵 1` ofreció en la Mesa únicamente `Actor un hilo · rotación Y`; la escena guardada conservó actor, selección y ruta |
| P16 | ✅ | Transporte musical compartido | `preparado → reproduciendo → preparado`, avance 00:00→00:01.5 y compás 1·4 a 120 BPM; stop volvió a cero. Una escena restauró 90 BPM, 3 pulsos, 12 s y bucle apagado después de alterarlos |
| P17 | 🟡 | GLB de Bajo Relieve → ficha → Escenario | El mismo GLB importado debe montar como actor, no volver a `/relieve.glb`; queda pendiente de comprobar con un archivo del usuario |
| P18 | ✅ | Exposición y color coherentes | Formas, Trazo, Bajo Relieve y Delaunay muestran Alambre/Caras/Ambos; Formas y Delaunay conservan Puntos. Bajo Relieve añade tinte y Trazo conserva fondo/tinta |
| P19 | ✅ | Gesto de camerino → ficha → actor | Un gesto de ida y regreso sobre respiración apareció en el repertorio del camerino, viajó en “Actor con gesto” y reapareció como botón propio bajo `🎭 Gestos ensayados`; ejecución sin errores. La cajonera muestra ahora `🎭 n` |

**Pendientes humanos de esta ronda:** P4 requiere mirar simultáneamente un actor estático y otro dinámico; P7 requiere juzgar si la entrada de diez actores resulta aceptablemente fluida y observar memoria; P9 y P11 requieren abrir el HTML descargado. P10 requiere un GLB del usuario. P13 comprueba visualmente que dos actores escuchan rutas distintas. P6 necesita conservar o proporcionar una ficha de escena v1 real.

### No probar todavía como funcionalidad terminada

| Estado | Pieza | Motivo |
|---|---|---|
| ⬜ | Cámara de obra animada | Solo existe cámara de inspección y persistencia inicial |
| ⬜ | Luces como actores escénicos | El documento reserva el campo, no hay editor/runtime |
| ⬜ | Timeline y keyframes | Las pistas están tipadas, pero aún no se evalúan |
| ✅ MVP | Música como reloj maestro | Transporte común con AudioContext, respaldo monotónico, play/stop, posición, BPM, compás, duración y bucle |
| ✅ | Modulación individual por actor | Pose y expresiones seguras ya usan direcciones estables por ID |
| ⬜ | Vestuario por actor | Concepto definido; contrato todavía pendiente |

### Registro de rondas

| Fecha | Rama/commit | Alcance | Resultado |
|---|---|---|---|
| 14-07-2026 | `codex/escenario-v2` · `9d659a1` | Documento v2, diálogo, alta y duplicación de actores, guardado básico | Base técnica ✅ · ronda visual P1–P9 pendiente |
| 14-07-2026 | `codex/escenario-v2` | P1–P9: dos familias, persistencia, 10 actores, 3 reentradas y export | P1/P2/P3/P5/P8 ✅ · P4/P6/P7/P9 🟡 |
| 15-07-2026 | `codex/escenario-v2` | Fichas conservan GLB de Trazo, polaridad de papel/grafito y export de GLB embebido | Compilación ✅ · P10/P11 🟡 para validación visual |
| 15-07-2026 | `main` | Hilos de pose y expresión por actor conectados a LFO, memoria y sinestesia | P12 ✅ · P13 🟡 para prueba visual con micrófono |
| 15-07-2026 | `main` | DocumentoEscena v3: rutas, LFOs y acumuladores persistentes; limpieza de huérfanos | P14 ✅ en navegador integrado · TypeScript/build ✅ |
| 15-07-2026 | `main` | Catálogo seguro y selección de hilos exportada con cada ficha | P15 ✅ · selector programático de salón sincronizado · TypeScript/build ✅ |
| 15-07-2026 | `main` | Transporte común de escena, persistencia y captura atómica de fichas | P16 ✅ en navegador integrado · TypeScript/build ✅ |
| 16-07-2026 | `main` | Primer ensayo corporal: gestos lineales, envolventes y en bucle guardados por personaje | P19 ✅ en navegador integrado · ficha temporal eliminada · sin errores |

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
| E9 | Mesa de Sinestesia en el Escenario | El destino distingue escena global y cada actor por nombre |
| E10 | Actor estático con ruta a transform | Se mueve por posición/rotación/escala sin reactivar su cálculo interno |
| E11 | Intentar modular topología con audio | Resolución, puntos y semilla no aparecen entre los hilos de actor |
| E12 | Guardar escena con ruta + LFO + acumulador, vaciarlos y restaurar | Los tres reaparecen con fuente, destino y configuración; los monitores vivos arrancan limpios |
| E13 | Quitar un actor usado por los tres motores | Sus rutas, LFOs y acumuladores desaparecen y no dejan modulación residual |
| E14 | Seleccionar un único hilo, guardar ficha y añadirla al Escenario | La cajonera muestra `🧵 1`; la Mesa ofrece solo ese destino para el actor |
| E15 | Guardar y restaurar una escena con la ficha filtrada | La selección de hilos y las rutas sobreviven dentro de DocumentoEscena v3 |
| E16 | Preparar/reproducir/detener y restaurar una escena con otro tempo | El reloj avanza por tiempo musical, vuelve a cero y recupera BPM, métrica, duración y bucle |
| E17 | Importar GLB en Bajo Relieve, guardarlo y añadirlo al Escenario | El actor conserva el binario de la ficha; una carga tardía del modelo por defecto no puede reemplazarlo |
| E18 | Crear/probar un gesto, guardar ficha y añadir actor al Escenario | El repertorio conserva nombre, forma, curva, duración y canal; el botón del actor mueve solo su parámetro interno |
| E19 | Duplicar un actor con gesto y accionar solo la copia | Los repertorios son independientes y no hay contaminación entre IDs |

## Cierre

- Hallazgos → se arreglan en el momento o se anotan aquí con ❌ y ticket en el plan.
- P13 sigue siendo la validación humana de dos marionetas con micrófono; P14 cierra técnicamente **DocumentoEscena v3**, P16 el transporte mínimo y P19 el repertorio corporal del personaje. El siguiente bloque debe conectar fuentes musicales con **disparadores de gestos nombrados**, no con más parámetros crudos.
- Después de cada sesión se actualizan estados y se añade una fila al **Registro de rondas**.

---

## Qué necesito de ti para arrancar

1. **Servidor encendido**: `cd ~/Claude/Projects/Mia && npm run dev` (y déjalo corriendo — la sesión anterior se cayó a mitad).
2. **Chrome o el navegador integrado**. Los diálogos propios ya funcionan en ambos.
3. **Tu clic en "Permitir"** cuando el navegador pida micrófono (C1) — es lo único que yo no puedo hacer.
4. **Fuente de sonido** para el bloque C: palmas o voz bastan; si tienes la guitarra o interfaz a mano, mejor (dime qué entrada usas).
5. **MIDI** (opcional): si tienes controlador/pastilla conectado, dímelo para incluir C4.
6. Para la ronda inmediata basta con decir **“listo para P13”**: dos actores, dos rutas de audio y giro global quieto.
