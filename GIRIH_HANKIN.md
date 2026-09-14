# Girih · Moro: trama Hankin regular

El disfraz está registrado en el almacén común y disponible en **Caracol vivo · Camerino → Almacén de disfraces → Girih · Moro**. Puede combinarse con Nácar. Para ver solamente la filigrana, desactivar las otras prendas.

## Corrección del patrón

El primer sketch, `caracol_moro1/poly.pde`, obtiene puntos con `sl()` sobre rectas de cuadriláteros tridimensionales. En una celda no plana esas rectas no tienen por qué cortarse: la fórmula devuelve un punto de mínima distancia sobre una de ellas. El resultado depende de la deformación y puede alterar irregularmente los motivos.

El segundo sketch, `Tiling/edge.js`, ofrece otra construcción: dos rayos Hankin por borde, con separación desde el centro y longitud calculada mediante la ley de senos. Se ha portado esa construcción al cuadrado material de cada celda. **No se resuelven intersecciones 3D.** El shader repite los ocho segmentos en las coordenadas UV de la piel, de modo que todos parten del mismo motivo y acompañan el desarrollo del cuerpo.

El trazado es regular en sus coordenadas materiales. Eso no convierte una superficie curva en una cuadrícula físicamente plana: el escorzo de cámara y el estiramiento de las UV siguen deformando su apariencia. Los controles longitudinal y transversal permiten ajustar sus proporciones. No se promete un recubrimiento isométrico ni igual tamaño físico en toda la concha.

## Sliders

| Control | Rango | Inicio | Efecto |
|---|---:|---:|---|
| Presencia | 0–1 | 1 | Opacidad del disfraz |
| Grosor del trazo | 0–1 | 0,6 | De 0,5 a 3 píxeles del render; 2 píxeles por defecto |
| Ángulo (grados) | 0–90 | 75 | Rotación de los rayos Hankin, como en Tiling |
| Separación · delta | 0–25 | 10 | Desplazamiento desde el centro del borde; unidades del sketch con celda de 100 |
| Celdas longitudinales | 8–100 | 50 | Repeticiones a lo largo del cuerpo |
| Celdas transversales | 4–48 | 18 | Repeticiones alrededor del cuerpo |

Se mantienen los inicios 75° y delta 10 del segundo sketch y la densidad 50 × 18 del primero. Los límites 0° y 90° son válidos: el denominador de la ley de senos no se anula en este dominio. El color naranja procede de `Hankin.show()` del segundo sketch. No se importa p5.js, audio ni librerías externas del ejemplo.

El contorno abierto/cerrado del primer port no corresponde a los ocho rayos del nuevo método: su antiguo campo `cerrar` se acepta para leer fichas ya guardadas, pero queda oculto y sin efecto. El ID `girih` se conserva. Las fichas de esa primera versión adoptan la construcción corregida; `detalle` pasa a representar grosor. La corrección no promete conservar su aspecto irregular anterior.

## Integración y recursos

- [Girih.ts](src/vestuario/Girih.ts) contiene el motivo puro, el material y su definición de controles. No importa Caracol ni su fórmula.
- Requiere una malla con UV compatibles. Comparte sus atributos e índices; no crea una copia de la anatomía ni la libera al quitar la prenda.
- Un Mesh y un material por actor; `DoubleSide` con `forceSinglePass`. No se crea un objeto por rectángulo ni por segmento.
- Los ocho rayos se calculan una vez al cambiar ángulo/delta. La animación del tejido no necesita volver a calcularlos. Densidad, grosor y presencia son uniforms.
- Antialias mediante derivadas de las coordenadas antes de `fract`, evitando derivar la discontinuidad entre celdas. El grosor se estima en píxeles para reducir cambios por la proyección.
- El catálogo ahora admite descriptores de controles adicionales, validados y persistidos en `Capa.parametros`. El panel los construye automáticamente. Las prendas anteriores conservan sus controles y sus snapshots.
- Las pruebas de camerino → ficha → actor → regreso incluyen los parámetros de Girih. El estado corporal sigue separado del vestido.

## Elección de implementación y límites de rendimiento

Se valoraron dos rutas. Generar segmentos sobre una rejilla corporal permite reproducir la construcción 3D original, pero exige muestreo, buffers y actualizaciones por celda, además de conservar su irregularidad. Evaluar el motivo 2D en el shader conserva el diseño regular de Tiling y evita esos trabajos y copias; por eso se eligió para esta corrección.

No es coste GPU cero: cada fragmento de la superficie evalúa distancias a ocho segmentos. La cobertura en pantalla y la superposición de actores importan más que el número de repeticiones. Densidades extremas pueden perder legibilidad o producir alias temporal; no se aplica una reducción de densidad automática. Falta medir perfiles de escena y GPU sostenidos antes de certificar el nuevo material para grandes elencos.

[MEDICION_GIRIH.json](MEDICION_GIRIH.json) contiene una comprobación CPU incremental, **excluyendo anatomía, render y GPU**, con 30 actualizaciones de calentamiento y 60 medidas. En la estación local, la mediana fue 0,0075 ms para una prenda y 0,0499 ms para 16. Son tiempos muy pequeños, sensibles al ruido del cronómetro: no son FPS ni una comparación Java/JavaScript. Reproducir con `node scripts/medir-girih.mjs`.

`MEDICION_GIRIH_MORO_INICIAL.json` es únicamente el registro histórico del primer port de líneas, sustituido por esta corrección; no describe el shader actual.

## Validación

`npm run test:vestuario`: 22 pruebas. La referencia independiente reproduce las operaciones de Tiling con celdas de 100 y compara los extremos de los rayos para cinco ángulos y tres separaciones, incluidos los límites. Se comprueban recursos compartidos, controles sin subidas de geometría, restauración, rechazo de parámetros inválidos y aislamiento entre actores.

`npm run build`: TypeScript y compilación de producción. En el navegador WebGPU se verificaron el patrón inicial sobre Nácar y el cambio mediante sliders a 60°, delta 0 y 32 celdas longitudinales, sin errores de compilación del material. Esta comprobación no certifica equivalencia píxel a píxel con el rasterizador de p5 ni todos los backends y dispositivos.
