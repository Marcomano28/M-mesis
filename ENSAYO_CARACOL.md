# Caracol — La memoria de una caricia

Ensayo implementado en el código de MIA. Demuestra desarrollo geométrico, excitación localizada, propagación y memoria corporal. El cuerpo está integrado en el camerino, las fichas y el Escenario general; la vista de ensayo permite estudiarlo por separado.

## Abrir

Desde la carpeta del proyecto:

```sh
npm run dev -- --host 127.0.0.1
```

Abrir [el ensayo de Caracol](http://127.0.0.1:5173/?ensayo=caracol). También se puede entrar mediante «Ensayo · Caracol vivo» desde el taller. El servidor debe permanecer activo. Abrir `index.html` como `file://` no ejecuta la aplicación TypeScript de Vite.

## Ensayar

1. **Repetir nacimiento:** una secuencia de unos 31 segundos de tiempo de simulación extiende la curva, abre su sección y aplica tres impulsos localizados. Después deja el control al usuario. El tiempo real puede ser mayor si el dispositivo pierde frames; este ensayo aún no usa el transporte musical.
2. **Tocar la concha:** pulsar o arrastrar sobre su superficie deposita excitación donde se ha tocado. La cámara y el transform del actor permanecen inmóviles. «Tocar una región» ofrece un impulso repetible sin tener que apuntar.
3. **Desarrollo:** recorrer las edades del cuerpo. La longitud y la sección se abren por separado; no se escala el objeto completo. En cero no hay contribución visible.
4. **Despliegue de la piel:** graduar los filamentos de forma continua.
5. **Ver tejido:** rojo muestra magnitud de excitación; verde, memoria local. Es otra lectura del mismo estado corporal.
6. **Pausar / Continuar:** detener la simulación para observar. Los controles de desarrollo y piel siguen permitiendo inspeccionar la forma pausada.
7. **Guardar instante / Recuperar:** conservar tejido, desarrollo y piel en el navegador. Recuperar vuelve a ese estado y lo deja en pausa para compararlo. No guarda ni modifica fichas de la cajonera.
8. **Replegarse:** volver gradualmente al silencio. La huella sigue decayendo; «Repetir nacimiento» inicia una nueva simulación con la misma identidad y sin huellas anteriores.

Con preferencia de movimiento reducido, la vista comienza con el cuerpo desarrollado y sin el ensayo automático. Al ocultar la página se pausa; volver a ella requiere «Continuar».

## Qué cambió en la arquitectura

- [TejidoCaracol.ts](/Users/gorcap/Claude/Projects/Mia/src/core/TejidoCaracol.ts): núcleo independiente de DOM y Three.js. Contiene 64 × 32 regiones con altura, velocidad y memoria; una ecuación de onda amortiguada conecta vecinos. Integra a 120 Hz, con costura transversal periódica y extremos longitudinales sin flujo. Incluye muestreo, semilla determinista y checkpoints validados.
- [CaracolVivo.ts](/Users/gorcap/Claude/Projects/Mia/src/salones/supershapes/CaracolVivo.ts): representación experimental de la receta matemática de Caracol. A desarrollo pleno y excitación cero, su superficie coincide con la fórmula original. La geometría y el raycast se actualizan desde el mismo estado corporal; los filamentos comparten el campo de excitación y memoria.
- [EnsayoCaracol.ts](/Users/gorcap/Claude/Projects/Mia/src/ensayo/EnsayoCaracol.ts): vista de ensayo, secuencia de estímulos, controles y checkpoint local. Usa el Engine existente de MIA y sus backends WebGPU/WebGL2. La entrada condicional carga el ensayo solo con `?ensayo=caracol`.

La estructura permanente está en esos módulos. El HTML es la entrada de la aplicación, no una animación autónoma que sustituya al proyecto. La integración posterior añadió CaracolSalon y la conservación del estado vivo al salir, guardar o retocar en el Escenario; ParamBus sigue transportando controles de alto nivel.

## Comprobaciones

```sh
npm run test:caracol
npm run build
```

Las diez pruebas automatizadas verifican: equivalencia con la fórmula original; germen común; apertura de sección; impulso local y propagación; respuesta dependiente de la historia; costura periódica; mismo recorrido a 30/60 FPS; checkpoint y evolución posterior exactos; decaimiento en silencio; independencia de instancias y validación del estado.

Durante la implementación se comprobó render WebGPU sin errores de consola, nacimiento visible, impulso desde el botón, cambio corporal localizado, pausa y guardado desde la interfaz. La restauración exacta del estado numérico se comprobó en las pruebas. No se ha certificado todavía paridad visual entre todos los backends y dispositivos ni un presupuesto de FPS de producción.

## Límites deliberados

El prototipo demuestra **un cuerpo con dinámica interna**. No contiene fusión entre actores, micrófono, reconocimiento musical o edición completa de facetas. Su control externo inicial es el puntero y la secuencia reproducible de impulsos.

La simulación del tejido y la evaluación geométrica están en CPU; el render utiliza la GPU. Esta decisión permite probar y verificar la dinámica antes de trasladar los buffers a compute shaders. Se reutilizan buffers y se omite la evaluación cuando el cuerpo no cambia; cuando evoluciona, sus posiciones y normales todavía se calculan en CPU. El diagnóstico disponible en `window.MIAEnsayo` informa tiempo de actualización CPU; no debe interpretarse como tiempo total GPU o FPS de la aplicación.

La instancia escénica ya posee su tejido y expone desarrollo y estímulos locales al bus, conservando receta y estado en una ficha. La optimización medida del vestuario se describe en [OPTIMIZACION_VESTUARIO.md](OPTIMIZACION_VESTUARIO.md).

## Almacén común de disfraces

El ensayo incorpora un almacén reutilizable en `src/vestuario/`. No es otro HTML: CaracolVivo ofrece un adaptador corporal y utiliza las mismas fábricas que puede utilizar cualquier actor compatible. El botón **Abrir almacén de disfraces** permite activar y combinar Nácar, Alambre, Polvo de puntos, Líneas de puntos, Peludo y Corriente. Cada capa tiene presencia y un control propio. Para apreciar una prenda aislada, desactiva las demás.

- `AlmacenDisfraces.ts`: contratos, catálogo de fábricas y vestuario por instancia. `CuerpoVestible` proporciona identidad determinista, desarrollo, malla opcional, muestreo de superficie y campo de circulación opcional. La malla debe conservar su topología y atributos position/normal/uv durante la vida de la prenda; un cambio de topología requiere recrearla. El dominio material es u en [0,1], v periódico.
- `disfraces.ts`: seis implementaciones sin dependencias de Caracol. Las prendas poseen sus materiales. En el adaptador eficiente de Caracol, Nácar y Alambre comparten la geometría corporal y leen su atributo de estado en el shader; retirarlas no libera esa geometría. Los adaptadores anteriores conservan la ruta de copia privada. Las fibras poseen sus propios buffers.
- `PanelVestuario.ts`: editor común, construido desde el catálogo y las capacidades del cuerpo.
- `CaracolVivo.ts`: calcula anatomía, orientación superficial y un campo de velocidades sensible a excitación/memoria; conecta esos datos al vestuario. El cuerpo sigue siendo la referencia de las caricias aunque no lleve piel sólida.

La corriente transporta trazadores en coordenadas materiales. Al alcanzar el extremo longitudinal, renacen al principio con atenuación visual; no es simulación de líquido, intercambio de materia ni fusión. El peludo es una representación de fibras articuladas por el estado local, sin simulación física independiente del cabello. El SDF queda pendiente de una capacidad volumétrica explícita: no se incluye como supuesto filtro de textura.

Los instantes nuevos (versión 2, en la misma clave local del ensayo) conservan tejido, desarrollo, selección de prendas, controles y coordenadas de corriente. Se aceptan los instantes anteriores de versión 1, interpretando su faceta como longitud del peludo. La pausa detiene también la circulación. Un traje inválido se rechaza antes de sustituir el actual.

**Alcance de integración actualizado:** el mismo CaracolVivo está conectado al flujo general mediante CaracolSalon (ID `caracol`): camerino, fichas, Escenario y retorno para retoque. El Caracol anterior de SupershapesSalon mantiene su ID y su representación para conservar obras anteriores. Los demás actores todavía requieren sus adaptadores.

Validación: `npm run build` y `npm run test:vestuario`. Las pruebas verifican un segundo cuerpo (esfera), incompatibilidades, liberación de prendas sin liberar anatomía, invariancia del tejido al cambiar de traje, aislamiento de instancias y recuperación de la corriente. La evolución de los trazadores usa el dt de actualización con un límite de 50 ms; se recupera exactamente ante la misma secuencia de dt, pero no se afirma independencia del framerate ni se ha medido rendimiento en todos los dispositivos.


## Flujo general: Caracol vivo · Camerino

1. En el selector de salón, elige **Caracol vivo · Camerino**.
2. Ajusta desarrollo, receta y región sensible. Abre **♧ Almacén de disfraces** y combina prendas. Puedes tocar directamente el cuerpo o usar **Tocar la región elegida**.
3. Usa **☆ Guardar ficha**: conserva parámetros, repertorio de hilos, tejido y vestuario. Los presets numéricos no sustituyen esta ficha completa.
4. Abre **Fichas** y pulsa **➕** para llevar el personaje al Escenario.
5. En su carpeta de actor, usa **↩ Retocar en camerino**, modifica las prendas y pulsa **✓ Devolver a escena**. El ID escénico y el transform se conservan; las rutas cuyos hilos sigan presentes permanecen válidas. Cancelar devuelve la composición sin aplicar el retoque.
6. Guarda una ficha del Escenario para conservar la composición completa entre sesiones. Salir de la página sin guardarla no equivale a guardar la obra.

El bus puede modular desarrollo y estímulo local; posición del estímulo es una capacidad opcional del repertorio. El estímulo sostenido inyecta excitación local por unidad de tiempo. No es una simulación de fuerza física calibrada. El estado espacial continúa perteneciendo al cuerpo. El Escenario captura el tejido y los trazadores actuales al guardar, duplicar, salir o enviar a retoque a los salones que declaran `conservarEstadoVivo`. Cada instancia tiene estado independiente.

Compatibilidad: las fichas anteriores de Formas Exóticas no se convierten automáticamente. Picos y Moro no son equivalentes al nuevo cuerpo. El nuevo camerino comparte radio, vueltas y curva Z con la receta original, pero sus prendas pertenecen al almacén común. La exportación de código del nuevo camerino genera un módulo para el proyecto MIA, no un HTML autónomo. La exportación cinematográfica autónoma del Escenario no se amplía en esta entrega.

Validación actual: 20 pruebas, con recorrido de estado entre camerino/ficha/actor, rechazo de datos corruptos, conservación de composición e IDs y rutas válidas durante el retoque. La iluminación de presentación actual se añade por instancia; para grandes elencos queda pendiente centralizarla. El informe de optimización distingue la medición CPU de todas las capas de la prueba renderizada con iluminación compartida.
