# MIA — Blueprint técnico del taller de disfraces

Versión del documento: 1.1 · 13 de septiembre de 2026.

Actualización: existe una primera implementación optimizada, descrita en [OPTIMIZACION_VESTUARIO.md](OPTIMIZACION_VESTUARIO.md). La auditoría del apartado 11 conserva el diagnóstico anterior como referencia histórica; consultar el informe para saber qué puntos ya se resolvieron.

**Uso:** especificación común que debe acompañar a cada encargo de vestuario, tanto si lo realiza una persona como un agente de programación. El encargo particular añade estética, comportamiento, medidas y escenas objetivo. Este documento establece requisitos de entrega; no certifica que las prendas existentes ya los satisfagan.

**Principio rector:** encontrar la implementación de menor coste demostrado que conserve la calidad y el comportamiento acordados, dentro de una escena con varios actores. Una prenda atractiva en solitario no se considera terminada si compromete el conjunto. No se exige demostrar un óptimo matemático universal: se exige comparar alternativas razonables, medir y justificar la elegida.

## 1. Contexto y responsabilidad del taller

MIA es un instrumento audiovisual con personajes generativos, desarrollo y memoria. La referencia conceptual es [BIBLIA_CONCEPTUAL.md](BIBLIA_CONCEPTUAL.md), especialmente II (principios y autoría), III (ontogénesis) y IV (capas del tiempo). La interpretación corporal y el recorrido actual se desarrollan en [REVISION_ARQUITECTURA_Y_CONCEPTO.md](REVISION_ARQUITECTURA_Y_CONCEPTO.md) y [ENSAYO_CARACOL.md](ENSAYO_CARACOL.md).

El personaje aporta reglas de forma, identidad y estado corporal. La prenda expresa ese cuerpo mediante superficie, trama, fibras, partículas u otra representación. La interacción externa llega al cuerpo por los mecanismos de MIA; una prenda no abre su propio micrófono ni consulta directamente el ratón, el audio o el bus global.

Cambiar de traje no debe reiniciar el tejido, sustituir la identidad ni modificar la colocación del actor. Si un efecto necesita cambiar las leyes de crecimiento, colisión o intercambio entre cuerpos, el encargo debe incluir una extensión corporal explícita. No esconder esa transformación dentro de un material.

**Estado real:** existe un catálogo compartido. Caracol vivo está conectado al camerino, las fichas y el Escenario. Una esfera se usa como segundo cuerpo de prueba. El resto de familias todavía necesita adaptadores; “almacén común” no significa compatibilidad automática con cualquier geometría.

## 2. Qué se envía con cada encargo

El paquete de trabajo contendrá este blueprint, la descripción artística, los tipos de código vigentes y una escena reproducible. No basta con una imagen de referencia.

| Campo obligatorio | Qué debe precisar |
|---|---|
| Identidad de la prenda | ID estable, nombre visible, versión y propósito expresivo |
| Aspecto | Silueta, materia, densidad aparente, color, iluminación y referencias |
| Comportamiento | Qué cambia, qué lo provoca, dónde ocurre y qué memoria conserva |
| Medidas | Unidades, proporciones respecto al cuerpo y límites de deformación |
| Anclaje | Superficie, borde, interior, eje o campo; persistencia del lugar de anclaje |
| Cuerpos objetivo | Al menos dos cuerpos distintos y sus capacidades disponibles |
| Desarrollo | Aparición, crecimiento, repliegue y comportamiento ante degeneraciones |
| Composición | Prendas combinables, conflictos de transparencia/profundidad y exclusiones |
| Calidad de referencia | Cámaras, distancias, resolución, DPR y detalles que deben preservarse |
| Escena objetivo | Cantidad de actores, capas simultáneas, luces y fuentes de interacción |
| Presupuesto | Dispositivo, backend, frecuencia objetivo, coste CPU/GPU y memoria disponible |
| Persistencia | Qué se reconstruye y qué estado hay que guardar para continuar |

Las medidas se expresarán en el espacio local del cuerpo o en proporciones declaradas. No usar dimensiones en píxeles de una ventana concreta como sustituto de medidas corporales. Los efectos deliberadamente definidos en pantalla deben indicarlo, incluyendo su comportamiento al variar cámara y DPR.

Si faltan requisitos artísticos o de carga, el taller podrá preparar una propuesta y medirla, pero la aceptación de producción quedará pendiente de fijar esos valores. No inventar un presupuesto cumplido.

## 3. Contrato de conexión vigente

La fuente de verdad es [src/vestuario/AlmacenDisfraces.ts](src/vestuario/AlmacenDisfraces.ts). Estos son los tipos públicos actuales, resumidos sin ampliar la API:

```ts
interface MuestraCorporal {
  posicion: THREE.Vector3;
  normal: THREE.Vector3;
  tangente: THREE.Vector3;
  excitacion: number;
  memoria: number;
}
interface CuerpoVestible {
  readonly semilla: number;
  readonly desarrollo: number;
  readonly malla?: THREE.BufferGeometry;
  readonly revision?: number;
  readonly atributoEstado?: string;
  muestrearEstado?: (u: number, v: number,
    salida: Pick<MuestraCorporal, 'excitacion' | 'memoria'>) => void;
  muestrearPosicion?: (u: number, v: number, salida: MuestraCorporal) => void;
  muestrear?: (u: number, v: number, salida: MuestraCorporal) => void;
  flujo?: (u: number, v: number, salida: THREE.Vector2) => void;
}
interface Capa {
  id: string;
  intensidad: number;
  detalle: number;
  estado?: number[];
  parametros?: Record<string, number>;
}
interface Traje { version: 1; capas: Capa[] }
interface Prenda {
  objeto: THREE.Object3D;
  actualizar(capa: Capa, dt: number, diagnostico: boolean): void;
  guardar?(): number[];
  restaurar?(estado: number[]): void;
  dispose(): void;
}
interface Disfraz {
  id: string;
  nombre: string;
  descripcion: string;
  control: string;
  requiere: Array<'malla' | 'muestrear' | 'flujo'>;
  crear: (cuerpo: CuerpoVestible) => Prenda;
}
```

### Semántica obligatoria

- `posicion`, `normal` y `tangente` pertenecen al espacio local del cuerpo. No contienen el transform escénico. Las orientaciones deben ser utilizables o señalar una degeneración mediante una política documentada; no propagar NaN.
- En el adaptador actual, `u` recorre [0,1] y `v` es periódico. `flujo` expresa velocidades en esas coordenadas materiales por segundo. No son velocidades cartesianas ni unidades físicas calibradas.
- Los lugares materiales deben seguir siendo reconocibles mientras el cuerpo cambia. Un nuevo cuerpo con varias cartas UV, discontinuidades o topología variable necesita una extensión del adaptador; no se supone que cabe sin pérdidas en un único rectángulo periódico.
- `muestrear` escribe en objetos de salida reutilizados. La prenda no debe retenerlos como snapshots ni modificar el cuerpo desde esa llamada.
- Las prendas actuales de superficie necesitan `position`, `normal` y `uv` en la malla, con topología estable mientras viven. El requisito `malla` por sí solo no comprueba esos atributos. La fábrica debe validarlos antes de reservar recursos costosos.
- `semilla` se usa para variaciones reproducibles. No usar `Math.random()` ni reloj de pared para estado que deba recuperarse.
- `desarrollo` describe capacidad corporal. No presupone el mismo umbral de madurez para todas las familias. Cualquier umbral fijo debe justificarse para los cuerpos declarados compatibles.
- `intensidad` y `detalle` están limitados a [0,1]. Cada prenda puede declarar `controles` adicionales (clave, nombre, min, max, paso y valor inicial), que el editor descubre y persiste en `Capa.parametros`. `detalleInicial` permite fijar el inicio del control principal. Los campos desconocidos o fuera de rango se rechazan antes de sustituir el traje. `oculto` se reserva para campos obsoletos aceptados por compatibilidad, no para controles artísticos inaccesibles.
- `actualizar` puede recibirse con `dt = 0`: debe refrescar representación sin avanzar el tiempo. Hoy `Vestuario` acota el dt a 50 ms; una simulación que necesita pasos fijos debe mantener su acumulador y documentar qué sucede ante una pausa larga.

### Puertos eficientes incorporados

`revision` es opcional y debe cambiar cuando cambian forma, desarrollo o estado visible. Si no existe, las prendas conservan la actualización conservadora. No se debe usar solo el tiempo como revisión: una restauración o cambio directo también invalida.

`muestrearEstado` evita calcular geometría para obtener excitación/memoria. `muestrearPosicion` devuelve posición y estado sin calcular orientación. Se mantiene `muestrear` como fallback para adaptadores anteriores y para pelo, que necesita orientación.

`atributoEstado` nombra un atributo vec2 de la malla (excitación, memoria), alineado con sus vértices. Nácar y alambre pueden compartir la geometría corporal y evaluar sus colores por vértice en TSL. La malla y todos sus buffers siguen siendo propiedad del cuerpo: la prenda solo libera su material. Deben existir cotas válidas de la geometría evaluada en CPU; este puerto no autoriza culling de una deformación GPU cuya extensión se desconoce. La topología permanece estable durante la vida de la prenda.

`Vestuario.configuracion()` devuelve controles sin capturar los arrays de simulación. `guardar()` sigue reservándose para snapshots completos. El formato persistido Traje v1 no cambia.

### Ciclo de vida

`registrar` incorpora una fábrica al catálogo; no debe reservar geometrías, texturas, trabajadores ni simulaciones por actor. `crear` genera una instancia aislada solo cuando se necesita. `actualizar` trabaja sobre recursos ya preparados. `quitar` y `dispose` liberan lo adquirido por esa instancia. El almacén compartido contiene diseños; el estado vivo pertenece a cada ejemplar.

El objeto devuelto se coloca bajo el grupo de vestuario del actor. La prenda no crea otro renderer, cámara, canvas, bucle RAF, controlador de órbita, luz global ni listeners de entrada. La iluminación se dirige desde el contexto escénico. No introducir importaciones de `CaracolVivo`, `CaracolSalon` o de una fórmula concreta en un disfraz genérico.

## 4. Regla de optimización sin pérdida artística

La referencia visual y temporal se fija primero. Se comparan candidatos con la misma receta, trayectoria, cámaras, densidad aparente y carga de escena. Una versión que elimina pelo, borra memoria o reduce resolución de salida no demuestra una optimización equivalente.

Orden de trabajo requerido:

1. Medir dónde se consume tiempo: cuerpo, prenda, transferencias, render, composición o compilación.
2. Eliminar trabajo redundante y asignaciones evitables, conservando el resultado.
3. Compartir cálculos y recursos inmutables con propiedad explícita.
4. Comparar evaluación analítica, shaders, instancing, texturas/campos y simulación almacenada según el problema.
5. Cambiar la representación solo después de verificar equivalencia visual y temporal.
6. Proponer aproximaciones perceptuales o niveles de detalle únicamente con criterios artísticos explícitos y transición estable.

GPU no significa automáticamente más rápido. Una fórmula recalculada por cada fragmento puede costar más que una tabla compartida; una carga pequeña puede funcionar mejor en CPU. El informe de entrega debe explicar al menos dos opciones razonables, o justificar por qué solo una es viable. Una mejora local que empeora el frame completo no es una mejora de producción.

No usar el papel “extra” como permiso para degradar arbitrariamente al actor. La visibilidad, el tamaño proyectado y la intención de la obra determinan qué información puede representarse de otra manera. Los perfiles alternativos no deben activarse silenciosamente para aprobar un benchmark.

## 5. Requisitos de implementación eficiente

| Área | Requisito del taller | Evidencia de aceptación |
|---|---|---|
| CPU por frame | Evitar asignaciones de objetos/arrays en bucles por elemento; preasignar salidas y buffers | Perfil de asignaciones y ausencia de picos periódicos de GC atribuibles a la prenda |
| Trabajo corporal | No recalcular posición, normales y memoria completas por cada capa si pueden producirse una vez | Recuento de muestras/cálculos y comparación con varias capas |
| Datos estáticos | Semillas, distribución, índices y atributos constantes se calculan al crear o cambiar configuración estructural | Sin reconstrucciones por frame al mantener configuración |
| Transferencias | Subir solo datos que hayan cambiado; evaluar rangos parciales, atributos compactos y evaluación GPU | Bytes estimados o medidos por frame y justificación del formato |
| Recursos | Separar inmutables compartibles de estado mutable por instancia | Inventario de propiedad y prueba de liberación/aislamiento |
| Draw calls | Agrupar elementos homogéneos; evitar un objeto/material/draw por pelo, punto o segmento | Draw calls y primitivas para 1, 4, 8 y 16 actores |
| Materiales | Elegir el modelo de iluminación mínimo que reproduzca la referencia | Comparación visual y coste GPU; no usar PBR complejo por defecto |
| Transparencia | Medir overdraw, ordenación, dobles caras y coste al superponer actores | Escena de solapamiento, sin halos ni pérdidas no acordadas |
| Culling | Proporcionar cotas conservadoras que incluyan crecimiento y extensiones | No desaparece contenido visible; ahorro fuera de cámara verificado |
| Compilación | Reutilizar programas compatibles; no cambiar defines/materiales por cada valor de slider | Primera aparición y cambios de configuración sin compilación reiterada |
| Inactividad | Separar actualización visual de evolución temporal; evitar trabajo visual inútil | Medición de actor quieto, oculto, intensidad cero y pausa |
| Escena completa | No añadir luces, postprocesos o render targets privados sin necesidad cuantificada | Coste total incluyendo todas las pasadas y otros actores |

Estas son condiciones de entrega, no afirmaciones sobre lo ya implementado. Cualquier excepción debe explicar el obstáculo, el coste medido y su alcance; “funciona en mi ordenador” no es evidencia suficiente.

### Propiedad y reutilización

Compartir un buffer dinámico solo es seguro si tiene un productor definido y consumidores que no lo modifican ni liberan. Compartir un material mutable puede acoplar colores o controles de actores distintos. El taller debe declarar quién crea, actualiza y libera cada recurso. Un caché compartido necesita claves completas, límite de memoria y liberación por referencias o ciclo de vida equivalente.

No copiar geometría completa como solución universal al problema de propiedad. Tampoco eliminar las copias actuales sin sustituir su garantía de aislamiento. Comparar vistas de lectura, atributos compartidos, almacenamiento GPU común y reconstrucción analítica, según el backend y la compatibilidad real.

### Visibilidad y tiempo

Ocultar una prenda no autoriza a borrar su historia. Para efectos con estado se debe acordar si continúan, se congelan o recuperan mediante un avance controlado. La política pertenece al contexto de actuación y debe conservar causalidad al volver a verse. Una prenda sin estado puede omitir trabajo si sus entradas no han cambiado.

No calcular física o advección a partir del número de frames. Si se requiere reproducibilidad ante distinto framerate, usar paso fijo o solución analítica, persistir el resto temporal y probarlo. Recuperar exactamente una secuencia de dt no prueba independencia del framerate. En GPU se declarará si se promete igualdad exacta dentro del mismo backend o equivalencia con tolerancia entre dispositivos.

## 6. Extensiones necesarias para escalar el almacén

El contrato actual es pequeño y funcional, pero no ofrece toda la información que requiere un planificador eficiente. Las siguientes interfaces generales siguen siendo **propuestas**. La revisión global y el atributo vec2 descritos en el apartado anterior ya están implementados; no equivalen todavía a un planificador completo ni a estos contratos ampliados:

| Extensión propuesta | Finalidad | Condición para incorporarla |
|---|---|---|
| Versiones de topología, forma y estado | Reutilizar resultados y actualizar solo lo invalidado | Productor corporal fiable; pruebas de invalidación |
| Muestreo por lotes y atributos semánticos | Calcular una vez datos compartidos por capas | Layout, unidades, costuras y propiedad documentados |
| Conexión GPU de solo lectura | Evaluar la misma anatomía desde varias representaciones sin ida/vuelta CPU | Implementación explícita por backend, ciclo de vida y sincronización |
| Cotas y escala corporal | Culling y medidas relativas seguras | Incluir pelo, ondas y desarrollo máximo permitido |
| Contexto de frame | Tick común, visibilidad, tamaño proyectado y política temporal | Lo suministra MIA; las prendas no consultan la escena por su cuenta |
| Presupuestos y perfiles de representación | Repartir recursos entre actores según obra y vista | Política artística explícita y medición del conjunto |
| Estado de prenda versionado | Migrar simulaciones y formatos futuros | Adaptador para `Traje.version = 1` y `estado?: number[]` actuales |
| Metadatos de compatibilidad y recursos | Validar capacidades reales, estimar coste y compartir assets | Ampliar fábrica, editor, persistencia y pruebas juntos |

No parchear globales ni usar casts para fingir estas capacidades. Si una prenda las necesita, entregar también la extensión mínima, su compatibilidad y una prueba en dos cuerpos. Una conexión GPU no obliga a trasladar toda la dinámica a GPU: medir el coste de mantener el cuerpo actual en CPU y sus transferencias.

## 7. Familias de implementación y decisiones que deben justificarse

| Familia | Alternativas que conviene comparar | Riesgo que hay que resolver |
|---|---|---|
| Piel/textura | Material procedural, textura horneada, datos corporales compartidos | Repetir muestreo geométrico solo para colorear; texturas que resbalan al crecer |
| Alambre | Aristas explícitas, índices reutilizados, representación en shader | Demasiadas líneas, coste de fragmentos o pérdida de grosor legible |
| Puntos | Buffer agrupado, instancias o sprites adecuados al backend | Tamaño y transparencia distintos entre backends; un draw por punto |
| Pelo | Curvas agrupadas, instancias, evaluación procedural; simulación solo si necesaria | Silueta, solapamiento, orientación y coste de animar todos los segmentos |
| Corriente | Advección CPU agrupada, cómputo GPU o solución analítica cuando exista | Transferencias, costuras, reinicios, memoria y estabilidad temporal |
| Volumen/SDF | Campo analítico, representación muestreada o extracción de superficie | Coste por píxel, pasos de raymarch, cotas, memoria y compatibilidad de backend |

El contrato vigente no tiene un puerto SDF ni un puerto volumétrico. Tampoco ofrece fusión universal. Una prenda volumétrica debe declarar su representación y la relación con el cuerpo; no puede inferir un interior correcto de cualquier malla abierta. Distancia firmada, densidad y velocidad son campos diferentes y no deben confundirse.

## 8. Persistencia y continuidad en la obra

Las prendas viajan en `Traje` dentro del estado extra de la ficha. [CaracolSalon.ts](src/salones/supershapes/CaracolSalon.ts) es el adaptador de referencia; [EscenarioSalon.ts](src/salones/escenario/EscenarioSalon.ts) captura estado vivo en los puntos de salida previstos. El taller debe respetar ese flujo, sin crear un almacén paralelo de personajes en localStorage.

Se guardará lo necesario para reconstruir el estado: controles, semilla cuando corresponda, posiciones/velocidades internas si son independientes y resto temporal cuando lo haya. No persistir buffers de render que puedan derivarse exactamente. No omitir historia irrecuperable para ahorrar espacio. La migración de formato debe preservar IDs y permitir reconocer una versión no soportada antes de sustituir el traje activo.

Probar carga, copia independiente, guardado de escena, retorno del camerino y cancelación del retoque. Una selección numérica o un preset incompleto no sustituye a una ficha de estado. No serializar cada frame; la interfaz necesita un acceso ligero a configuración distinto de una captura completa si esta resulta costosa.

## 9. Protocolo de medición para aceptación

**Matriz mínima propuesta:** 1, 4, 8 y 16 actores. Son cargas de ensayo, no una promesa de soporte. Añadir la cantidad máxima real de la obra y probar cuerpos de familias distintas. Evaluar una prenda aislada, combinaciones habituales y la combinación más costosa admitida.

Mantener dos escenarios: actores distribuidos con encuadres comparables y actores solapados para medir el peor caso de transparencia. Añadir primer plano de un protagonista rodeado de secundarios. Registrar resolución real del framebuffer, DPR, cámara, luces, densidad, receta, secuencia de estímulos y semillas.

Medir por separado:

- Arranque en frío: construcción, compilación, subida de recursos y primer frame útil.
- Régimen estable: después del calentamiento, al menos 30 segundos por corrida y tres corridas por configuración como protocolo inicial.
- Cambios: abrir/retirar prendas, mover controles estructurales, germinar, replegar, pausar, restaurar y pasar de camerino a escena.
- Liberación: repetir 50 ciclos de poner/quitar y comprobar que el uso de recursos se estabiliza tras la liberación diferida del backend; distinguir cachés acotados de fugas crecientes.

Registrar tiempo de frame p50/p95/p99, frames fuera de presupuesto, CPU de actualización, tiempo GPU si está disponible, draw calls, primitivas, memoria de buffers/texturas/render targets y transferencias. Si la herramienta no permite medir memoria o tiempo GPU, indicar “no disponible” y detallar las estimaciones; no sustituir tiempo GPU por la duración CPU de `render()`.

Medir cuatro configuraciones: escena de referencia, cuerpos sin la prenda, cuerpos con la prenda candidata y cuerpos con la alternativa. Las diferencias sirven de diagnóstico; no sumarlas como si CPU, GPU, compilación y sincronización fueran costes independientes.

El presupuesto se fija **para toda la escena**, reservando margen al audio, cuerpo, interfaz, captura y variaciones de carga. A 60 FPS hay aproximadamente 16,67 ms por frame; a 30 FPS, 33,33 ms. Esos valores son aritmética de referencia, no metas aprobadas para MIA. No asignar ese presupuesto completo a cada actor. Un objetivo todavía no medido permanece pendiente.

La aceptación visual utiliza capturas pareadas y secuencias en movimiento con parámetros idénticos. Evaluar silueta, densidad aparente, respuesta local, memoria, costuras, parpadeos y estabilidad al cambiar de distancia. Un umbral numérico de diferencia de imagen, si se usa, debe acordarse por efecto: no reemplaza el juicio del autor.

## 10. Pruebas funcionales exigidas

1. Dos cuerpos de geometría diferente utilizan la misma fábrica sin importaciones específicas ni excepciones por nombre de actor.
2. Las capacidades ausentes o atributos inválidos se rechazan antes de la instalación, sin dejar recursos huérfanos.
3. Cambiar prendas conserva identidad, tejido y transform del actor; cada instancia mantiene su estado independiente.
4. Nacimiento, repliegue, costuras y normales degeneradas no producen NaN, saltos involuntarios ni geometría explosiva.
5. `dt = 0`, pausa y restauración cumplen la política temporal. Si se promete independencia del framerate, se prueba con secuencias temporales distintas.
6. El checkpoint recupera aspecto e historia; formatos inválidos no reemplazan la prenda activa. Fallos de creación/restauración liberan los recursos parciales.
7. La prenda combina correctamente con las capas declaradas, incluyendo profundidad, transparencia y contacto con la piel.
8. La retirada libera recursos propios y conserva los prestados/compartidos. Repetir creación y retirada no acumula listeners, objetos ni bucles.
9. Ficha → Escenario → camerino → devolución conserva IDs, composición y rutas cuyos hilos permanezcan disponibles.
10. WebGPU y WebGL2 se verifican cuando ambos sean parte del soporte declarado. Un fallback visualmente distinto o ausente debe ser explícito, no silencioso.

`npm run test:vestuario` y `npm run build` son comprobaciones disponibles. No constituyen por sí solas una certificación de rendimiento ni una prueba visual de ambos backends. Añadir pruebas específicas del efecto y adjuntar los datos del benchmark.

## 11. Auditoría del punto de partida y orden de optimización

La lectura del código actual muestra estos puntos; no son resultados de profiling:

| Evidencia local | Consecuencia probable | Trabajo prioritario |
|---|---|---|
| `superficie()` en [disfraces.ts](src/vestuario/disfraces.ts) clona malla y copia posición/normal por actualización | Trabajo y memoria multiplicados por capas | Medir y diseñar propiedad compartida de buffers corporales |
| La misma función llama `muestrear()` por vértice para el color | Recalcula también orientación y posición aunque el color solo necesite algunos campos | Separar acceso a estado/color del muestreo geométrico completo |
| `CaracolVivo.muestrear()` estima orientación mediante posiciones vecinas | Varias evaluaciones corporales por muestra y por prenda | Comparar derivadas analíticas, cachés, interpolación y muestreo por lotes |
| `CaracolVivo.actualizar()` recalcula normales y cotas cada actualización | Coste incluso con entradas inmóviles | Añadir invalidación fiable y medir cotas conservadoras |
| Prendas usan `frustumCulled = false` y ejecutan bucles aunque intensidad sea cero | Trabajo que puede no contribuir a la imagen | Separar visibilidad, simulación y actualización visual |
| Superficies usan material físico y transparencia también para alambre | Posible coste innecesario de iluminación y composición | Comparar materiales y pasadas equivalentes visualmente |
| Fibras recalculan variación determinista dentro del bucle | Datos estáticos computados repetidamente | Precalcular atributos de identidad |
| El editor obtiene configuración mediante `vestuario.guardar()` | Una consulta de UI puede copiar todo el estado de corriente | Añadir lectura ligera de configuración |
| `CaracolSalon.init()` añade luces por instancia | El coste de iluminación puede aumentar con el elenco | Separar luces del camerino y dirección lumínica compartida en escena |

Primero medir un conjunto representativo y eliminar redundancias CPU/transferencias. Después introducir los puertos compartidos mínimos, comparar representaciones GPU y centralizar los costes de escena. Finalmente certificar cada prenda con el protocolo anterior. No reescribir todo el motor sin demostrar qué cuello de botella resuelve la intervención.

## 12. Entrega del taller

Cada entrega incluirá implementación modular, registro en el catálogo, encargo artístico cumplimentado, contrato utilizado, mapa de propiedad de recursos, formatos y migraciones, pruebas, escena reproducible y comparación de alternativas con métricas. Adjuntará capturas/secuencias de referencia y una lista concreta de limitaciones.

Clasificar el resultado como **prototipo funcional**, **candidato medido** o **aceptado para un perfil de escena y dispositivo**. La aceptación siempre nombra el perfil probado. No etiquetar una prenda como “superoptimizada” solo por estar escrita en shader o por superar pruebas unitarias.

### Prompt reutilizable para enviar al taller

> Trabaja en MIA siguiendo BLUEPRINT_TALLER_DE_DISFRACES.md y la Biblia conceptual. Implementa la prenda descrita en el encargo adjunto como una fábrica reutilizable por capacidades corporales. Revisa los tipos reales antes de programar. Conserva identidad, memoria, desarrollo y composición al vestir, guardar, duplicar y retocar. No introduzcas dependencias de una familia concreta, renderers ni bucles propios.
>
> Busca la variante de menor coste demostrado que mantenga la calidad visual y temporal acordada. Compara alternativas razonables, evita trabajo repetido y mide la escena completa con varios actores, no solo la prenda aislada. No reduzcas calidad ni cambies comportamiento silenciosamente para alcanzar un número de FPS. Declara propiedad de buffers, costes, compatibilidad, límites y política de tiempo.
>
> Si falta una capacidad corporal, propón e implementa la extensión mínima versionada con su compatibilidad; no simules un enchufe inexistente. Entrega código, registro, pruebas en dos cuerpos distintos, escena reproducible, métricas CPU/GPU disponibles, comparación visual, persistencia y documentación. Distingue lo medido de lo estimado. No declares aceptación de producción si faltan el perfil objetivo o las mediciones necesarias.

### Ficha breve del encargo particular

```text
Nombre e ID:
Versión:
Intención y referencias artísticas:
Cuerpos y capacidades requeridas:
Anclaje, unidades, medidas y proporciones:
Respuesta a excitación, memoria y desarrollo:
Estado independiente y política temporal:
Controles y rangos:
Combinaciones admitidas y exclusiones:
Calidad de referencia y criterio de equivalencia:
Carga de escena (actores/capas/solapamiento):
Dispositivos, backends, resolución y DPR:
Presupuesto acordado y margen del conjunto:
Comparación técnica propuesta:
Formato de persistencia y compatibilidad:
Pruebas y artefactos de aceptación:
Pendientes que impiden certificar:
```

## Ejemplo adicional: trama regular Hankin

[GIRIH_HANKIN.md](GIRIH_HANKIN.md) documenta el port de Tiling, los sliders de ángulo/delta y la aplicación del motivo en UV sobre geometría prestada. Ilustra cuándo conviene sustituir intersecciones 3D por una construcción material regular, declarando el cambio visual y el coste por fragmento. La medición CPU no sustituye la evaluación GPU de una escena completa.

**Controles enumerados:** los descriptores admiten `opciones` (nombre y valor numérico). El panel genera un selector y el almacén rechaza valores que no pertenezcan a la lista. Girih II los usa para simetrías y conmutadores. Su control `colorFondo` atenúa únicamente la textura antes de componer el trenzado; consultar [la ficha técnica](GIRIH_II_TRENZADO.md).
