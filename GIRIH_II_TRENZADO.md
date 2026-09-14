# Girih II · Trenzado

Disfraz independiente (`girih2`) disponible en **Caracol vivo · Camerino → Almacén de disfraces**. Conserva el Girih · Moro anterior como otra opción del catálogo. Los controles del nuevo traje viajan con la ficha y las instancias escénicas.

## Fondo discreto

El slider **Color del fondo** regula la mezcla de la textura con un fondo oscuro neutro:

- **0:** fondo uniforme, sin las manchas de color.
- **0,20:** valor inicial, color atenuado.
- **1:** toda la intensidad del fondo del port.

Actúa antes de dibujar las cintas y sus bordes: no reduce la presencia de los hilos ni modifica el orden de los cruces. No es transparencia del fondo; para atenuar el disfraz completo se mantiene el control Presencia. Su valor se guarda con el traje y se valida en [AlmacenDisfraces.ts](src/vestuario/AlmacenDisfraces.ts).

## Construcción y controles

Port a TSL de `Girih-2/visor.html`, basado en “Islamic Interweavings II, mla, 2026”. El GLSL separado depende de funciones Common ausentes; se ha usado como referencia ejecutable la reconstrucción del visor. Se conserva su secuencia de reflexiones A/B/C y su paridad por iteración, que no es idéntica al cortocircuito del archivo GLSL original.

Incluye simetrías cuadrada 2,4,4 y hexagonal 2,3,6; origen X/Y del trenzado; escala; grosor; desplazamiento y color del fondo; bordes; inversión de tejido; intercambio de los dos pares; plegado y repetición. El origen se edita mediante sliders para conservar el puntero de MIA como estímulo corporal.

El patrón se aplica en UV sobre la malla prestada del actor. La curvatura y la distribución de sus UV afectan a sus proporciones visibles. Se reproduce el mecanismo de líneas superpuestas, no una simulación de cintas físicas.

## Recursos y alcance

- Un material y un Mesh por prenda, sin copias de la geometría corporal. El material usa una sola pasada de doble cara.
- Textura procedural de 512 × 512 compartida entre instancias, con mipmaps y contador de usuarios. Se libera al retirar el último ejemplar.
- Gradiente y manchas deterministas reconstruidos con raster propio, sin DOM. No se afirma igualdad píxel a píxel con Canvas 2D.
- Los cambios de controles actualizan uniforms. Atenuar el fondo no agrega texturas, geometría ni llamadas de dibujo.
- El plegado conserva el límite de 100 iteraciones y salida temprana del visor. El coste depende de la cobertura de pantalla y de la configuración; **no está certificado para un presupuesto de escena o GPU**.
- No se incorpora el cargador de imágenes del visor: el traje utiliza el fondo procedural compartido. Tampoco crea renderer, cámara, luces, bucle de animación ni fuentes externas.

## Comprobaciones

Pruebas locales: plegado frente a las fórmulas generales del visor, ambas simetrías, recursos compartidos, restauración de controles, validación de opciones, conservación de anatomía e independencia de actores. El recorrido camerino → ficha → actor → regreso incluye Girih II.

La inspección en navegador quedó bloqueada por la revisión automática debido al límite de uso. La compilación TypeScript/Vite no sustituye la compilación real del shader ni la revisión estética: esas verificaciones siguen pendientes.
