# Vestuario compartido: primera optimización medida

Fecha: 13 de septiembre de 2026. Estado: **candidato medido**, no certificación universal de rendimiento. Complementa el [blueprint del taller](BLUEPRINT_TALLER_DE_DISFRACES.md).

## Qué se ha implementado

La optimización pertenece al código común de `src/vestuario/` y al adaptador de `CaracolVivo`. Se utiliza tanto en el ensayo como en **Caracol vivo · Camerino**, las fichas y las instancias del Escenario. La página de comparación es exclusivamente un instrumento de comprobación.

- **Nácar y Alambre comparten la geometría del cuerpo.** Se eliminan sus clones y las copias repetidas de posiciones y normales. El cuerpo calcula una sola vez el atributo `miaEstado` (excitación y memoria por vértice). Los materiales lo leen en TSL y calculan el color con las mismas fórmulas. La interpolación permanece por vértice para conservar el aspecto anterior.
- **El cuerpo y las prendas omiten trabajo que no ha cambiado.** Una revisión corporal invalida el vestuario. El cuerpo compara también el tejido y la receta, de modo que una restauración o una modificación directa de sus arrays no quede ignorada. La corriente conserva su evolución temporal aunque no cambie la anatomía.
- **Cada prenda solicita solo lo necesario.** Puntos y corriente usan el muestreo de posición sin calcular normales. El peludo conserva el muestreo completo. Las variaciones deterministas se preparan una vez. Las capas invisibles evitan reconstrucciones visuales, pero conservan el estado de circulación para reaparecer correctamente.
- **La interfaz consulta controles sin copiar la simulación.** `configuracion()` devuelve los controles; `guardar()` sigue siendo el checkpoint completo.
- **La propiedad de recursos es explícita.** Retirar una superficie libera su material, nunca la geometría prestada. El cuerpo libera su geometría al terminar. Las fibras mantienen buffers propios y límites espaciales actualizados para el descarte fuera de cámara.

No se ha reducido la resolución del cuerpo, la cantidad de fibras o partículas, ni se ha sustituido la materia física por un material visualmente más simple. El estado corporal sigue siendo independiente de sus disfraces.

## Cómo se enchufa y conserva compatibilidad

El contrato [CuerpoVestible](src/vestuario/AlmacenDisfraces.ts) mantiene los puertos anteriores y añade capacidades opcionales: `revision`, `atributoEstado`, `muestrearEstado` y `muestrearPosicion`. Una familia que no las ofrece conserva la ruta anterior; una esfera ajena a Caracol se prueba expresamente.

El atributo de estado debe ser vec2, alineado con los vértices de la malla. El cuerpo mantiene topología, atributos y límites espaciales válidos durante el préstamo. Un cambio de topología exige recrear las prendas. Los detalles están en el blueprint; no basta con añadir el nombre del atributo a un cuerpo incompatible.

Se conservan el formato de traje v1, los checkpoints, los IDs y las rutas existentes. La optimización no convierte automáticamente los demás actores ni las fichas del Caracol antiguo. Su adopción requiere implementar el adaptador de cada familia.

## Medición CPU antes y después

Datos completos: [MEDICION_VESTUARIO.json](MEDICION_VESTUARIO.json). Entorno: macOS x64, Intel i7-9750H a 2,60 GHz, Node 22.22.0. Se comparan la referencia congelada anterior y el código actual con las seis prendas simultáneas, intensidad 1 y detalle 0,65. Cada carga tiene 30 frames de calentamiento y 120 medidos, con tres repeticiones y orden alternado. Ambas versiones reciben la misma secuencia de estímulos y dt.

| Actores | Antes p50 / p95 (ms) | Después p50 / p95 (ms) |
|---:|---:|---:|
| 1 | 20,43 / 22,38 | 6,51 / 7,07 |
| 4 | 80,91 / 84,89 | 26,64 / 29,76 |
| 8 | 161,98 / 186,64 | 52,96 / 55,61 |
| 16 | 322,87 / 339,08 | 106,65 / 110,99 |

El ahorro de la mediana ronda el **67 %**, aproximadamente tres veces menos tiempo. La medición incluye tejido, anatomía y prendas en CPU; **no incluye render ni mide FPS**. Con 16 actores, 106,65 ms de actualización sigue excediendo ampliamente un presupuesto de 16,7 ms. Es una mejora importante y comprobable, no el final de la optimización.

La muestra se tomó en una estación de trabajo de uso normal, no en un laboratorio aislado. Es más corta que el protocolo completo exigido por el blueprint y no representa todos los dispositivos.

## Contraste con render WebGPU

Datos: [MEDICION_ESCENA_VESTUARIO.json](MEDICION_ESCENA_VESTUARIO.json), navegador integrado de Codex en la estación local. Una pasada por configuración, en orden antes/después; no se debe comparar directamente este runtime con Node.

| Actores | CPU p50 antes → después (ms) | Frame serializado p50 antes → después (ms) | GPU p50 antes → después (ms) | Draw calls, ambas versiones |
|---:|---:|---:|---:|---:|
| 1 | 34,0 → 11,8 | 40,0 → 15,4 | 0,524 → 0,524 | 8 |
| 4 | 133,4 → 47,0 | 149,1 → 59,4 | 2,032 → 2,032 | 32 |
| 8 | 262,2 → 94,9 | 282,3 → 116,6 | 3,932 → 3,932 | 64 |
| 16 | 522,0 → 189,5 | 666,7 → 289,3 | 7,799 → 7,864 | 128 |

El ahorro CPU se conserva al renderizar. El tiempo GPU permanece prácticamente igual: esta entrega elimina trabajo y copias del procesador, no reduce las llamadas de dibujo. Los timestamps GPU tienen granularidad limitada.

**No se ha superado una prueba de estabilidad escénica.** Los p95 del frame serializado presentan pausas grandes: con 16 actores, 1.920,3 ms antes y 4.263,0 ms después. La mejora de la mediana no permite ocultar ese resultado. El ensayo corto con lecturas sincronizadas no aísla la causa de los picos ni reproduce la presentación normal; requiere un perfilado sostenido antes de aceptar un presupuesto de obra.

## Equivalencia y comprobaciones

Las 20 pruebas de `npm run test:vestuario` pasan. Incluyen equivalencia numérica con la implementación anterior para anatomía, normales, fibras y corriente; retiro de prendas sin liberar el cuerpo; ausencia de subidas de buffers en reposo; invalidación por cambios directos; capas invisibles; restauración; independencia de actores y continuidad del estado entre camerino, ficha y Escenario. `npm run build` comprueba TypeScript y genera el build de producción.

La comparación visual usa dos renders separados con la misma cámara, iluminación, receta y estado. En WebGPU y WebGL2 se verificaron diez casos por backend a 256 × 256: Nácar, Alambre y todas las prendas a desarrollos 0,18, 0,6 y 1, más diagnóstico corporal. Cada combinación se retira y repone diez veces antes de compararla. La diferencia máxima observada fue **1/255 por canal**; ningún canal superó esa diferencia. El diagnóstico fue idéntico. Datos completos: [VALIDACION_VISUAL_VESTUARIO.json](VALIDACION_VISUAL_VESTUARIO.json). Esto verifica esos estados en ambos backends, no toda animación o hardware imaginable. A desarrollo 0,18 las superficies todavía están ocultas por diseño; ese caso comprueba la representación inicial y las capas visibles, no el sombreado de una superficie desplegada. La comparación es antes/después dentro de cada backend, no entre backends.

## Reproducir el ejemplo

```sh
npm run test:vestuario
npm run build
npm run bench:vestuario
npm run dev -- --host 127.0.0.1
```

Con el servidor activo, abrir `/comparar-vestuario.html`. **Validar todas** compara las imágenes; **Medir escena** evalúa 1, 4, 8 y 16 actores con seis prendas. Añadir `?backend=webgl` fuerza WebGL2. La salida JSON aparece en la propia página. La lectura de píxeles WebGL de este banco es síncrona para evitar que sus comprobaciones dependan de RAF en pestañas de inspección; no modifica el render de producción.

La medición de escena usa un target 640 × 360, DPR 1, dos luces compartidas, 10 frames de calentamiento y 20 medidos por configuración. La compilación previa queda fuera del cronómetro. El tiempo de frame incluye una lectura que fuerza la finalización del trabajo: es un frame serializado con sincronización, no FPS de presentación. Los timestamps GPU se informan por separado cuando el backend los ofrece; `null` significa que no están disponibles.

La referencia de `tests/referencia/vestuario-v1.mjs` solo se importa desde las pruebas, el benchmark y esta página auxiliar. No forma parte de la entrada de producción.

## Lo que sigue

1. **Reducir el coste corporal restante:** posiciones, normales y peludo aún se evalúan en CPU. Perfilar y trasladar el trabajo apropiado a GPU conservando raycast, checkpoints y equivalencia constituye el siguiente paso de rendimiento.
2. **Centralizar iluminación del Escenario:** actualmente CaracolSalon añade luces por instancia. La prueba con dos luces compartidas no certifica el coste de esa composición real ni autoriza cambiar su aspecto sin comparar.
3. **Validar perfiles de obra reales:** duración mayor, resolución de salida, mezcla de familias, transparencia, memoria GPU y dispositivos objetivo. Registrar presupuesto y degradación permitida por el autor; no reducir calidad silenciosamente.

Esta entrega sirve como ejemplo de encargo al taller: contrato explícito, implementación compartida, referencia anterior conservada, verificaciones de equivalencia y resultados con límites declarados. La próxima optimización debe superar el mismo contraste antes de sustituirla.
