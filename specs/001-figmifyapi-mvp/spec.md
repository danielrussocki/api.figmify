# Especificación: MVP de extracción web para Figma

## Contexto y objetivo
Figmify API permite obtener la representación visual de una página web pública HTTP/HTTPS sin almacenar datos. El MVP ofrece una salida con las propiedades visuales computadas y otra adaptada al consumo de un plugin de Figma, para que este pueda recrear la página y definir estilos reutilizables de color y tipografía.

## Contrato operativo de arranque

El proceso HTTP se configura exclusivamente mediante las variables de entorno `HOST` y `PORT`. Si una variable no está definida, se usa su valor predeterminado. Esta configuración se valida antes de crear un listener HTTP.

| Variable | Valor predeterminado | Valor válido |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Un nombre de host o dirección IP no vacía y sin espacios al inicio o al final. |
| `PORT` | `3000` | Un entero decimal sin signo entre `1` y `65535`. |

Un valor definido de `HOST` vacío o con espacios externos es inválido. Un valor definido de `PORT` que no sea una secuencia decimal de dígitos, que tenga signo, decimales, espacios, o que esté fuera del intervalo de `1` a `65535`, es inválido.

Ante una configuración inválida, el proceso registrará en inglés `Invalid HOST configuration.` o `Invalid PORT configuration.` según corresponda, terminará con un código de salida distinto de cero y no abrirá ningún puerto. Los errores de enlace posteriores a una configuración válida también se registrarán en inglés y terminarán el proceso con un código de salida distinto de cero.

El valor predeterminado limita el listener a la máquina local. Para aceptar conexiones de red, por ejemplo en un contenedor, se debe configurar explícitamente `HOST=0.0.0.0`; esta variable no modifica la política de URL pública de las solicitudes.

## Usuarios
- Desarrolladores de plugins de Figma que necesitan una fuente estructurada para recrear una página web.
- Diseñadores o desarrolladores que desean inspeccionar los estilos computados de una página pública.

## Historias de usuario
- Como desarrollador de un plugin de Figma, quiero solicitar una URL pública y recibir su estructura, contenido visible y estilos para recrearla en un archivo de Figma.
- Como desarrollador, quiero obtener los estilos computados sin transformar de cada elemento para analizarlos o integrarlos en otras herramientas.
- Como usuario, quiero recibir errores claros cuando una URL no puede extraerse, para corregir la solicitud sin interpretar resultados parciales.

## Requisitos funcionales

### RF-1. Solicitud de extracción
**Criterios de aceptación**
- Cuando un cliente envíe una solicitud `GET` a `/v1/extract` o `/v1/figma`, el sistema deberá recibir `url`, `width`, `height` y `deviceScaleFactor` como parámetros de consulta.
- Cuando un cliente envíe una URL absoluta HTTP o HTTPS pública mediante el parámetro de consulta `url`, el sistema deberá intentar extraer la página solicitada.
- Cuando el cliente omita `width`, `height` o `deviceScaleFactor`, el sistema deberá usar respectivamente 1920 píxeles, 1080 píxeles y escala 1.
- Cuando el cliente indique ancho, alto y escala de píxel del dispositivo válidos, el sistema deberá calcular la extracción con esa configuración de vista.
- Cuando el ancho o el alto no sea un entero entre 1 y 3840 píxeles, el sistema deberá rechazar la solicitud con un error normalizado en inglés.
- Cuando la escala de píxel del dispositivo no sea 1, 2 o 3, el sistema deberá rechazar la solicitud con un error normalizado en inglés.
- Cuando el entorno sea de producción y la URL o un destino de la navegación principal resuelva a localhost, una dirección IP privada, reservada o de red interna, el sistema deberá rechazar la solicitud como URL no pública antes de cargarlo.
- Cuando el entorno sea de desarrollo y la URL resuelva a localhost, una dirección IP privada, reservada o de red interna, el sistema podrá permitir la extracción.
- Cuando un cliente envíe `includeHidden` a `/v1/figma`, el sistema deberá aceptar exclusivamente los valores booleanos `true` y `false`.
- Cuando el cliente omita `includeHidden` en `/v1/figma`, el sistema deberá usar `false`.
- Cuando `includeHidden` no sea un booleano válido, el sistema deberá rechazar la solicitud con un error normalizado en inglés.

### RF-2. Extracción sin transformar
**Criterios de aceptación**
- Cuando la navegación principal complete el evento de carga y transcurran 30 segundos adicionales sin un error de carga, `/v1/extract` deberá devolver un JSON con el árbol del documento, la etiqueta de cada elemento, sus atributos visuales y semánticos, sus recursos asociados, su texto renderizado y sus propiedades visuales computadas.
- Cuando un elemento se incluya en la extracción, `/v1/extract` deberá asignarle un identificador interno único y preservar el orden del DOM entre sus elementos hijos.
- Cuando un elemento no contenga texto visible, el primer endpoint deberá representarlo sin inventar contenido textual.
- Cuando un elemento esté oculto mediante CSS o atributos HTML, el primer endpoint deberá incluirlo en el árbol de extracción.
- Cuando haya elementos en un Shadow DOM accesible, el primer endpoint deberá incluirlos respetando su relación con el árbol que los contiene.
- Cuando un elemento tenga los pseudoelementos `::before` o `::after`, el primer endpoint deberá incluir sus estilos y contenido calculables.
- Cuando una propiedad visual computada no tenga un valor textual serializable o no pueda determinarse, el primer endpoint deberá omitir esa propiedad.
- Cuando un elemento o una ejecución de texto tenga una opacidad computada serializable mayor que cero y menor que uno, `/v1/extract` deberá incluir `opacity` en `styles` con su valor textual computado; no deberá tratarla como una propiedad no significativa ni omitirla.
- Cuando la página contenga un Shadow DOM cerrado, el primer endpoint deberá excluir su contenido y continuar con los elementos observables.
- Cuando un elemento contenga nodos de texto renderizados que sean hijos directos, el contrato podrá representarlos en `directTextRuns` sin alterar el árbol de elementos `children`; cada ejecución deberá conservar sus caracteres, su posición entre `childNodes` y sus estilos calculados efectivos, sin inventar ni concatenar contenido descendiente.

### RF-3. Extracción orientada a Figma
**Criterios de aceptación**
- Cuando la navegación principal complete el evento de carga y transcurran 30 segundos adicionales sin un error de carga, `/v1/figma` deberá transformar la información visual y estructural aplicable de `/v1/extract` en un JSON compacto apto para que un plugin de Figma lo interprete.
- Cuando la página se cargue sin errores, el segundo endpoint deberá usar el esquema JSON propio, estable y versionado `FigmaDocument` `1.1` para la integración con el plugin de Figma, definido en el plan de esta funcionalidad.
- Cuando la página use colores, el segundo endpoint deberá incluir la información necesaria para que el plugin cree estilos de color reutilizables.
- Cuando la página use tipografías, el segundo endpoint deberá incluir la información necesaria para que el plugin cree estilos tipográficos reutilizables.
- Cuando varias partes de la página usen el mismo color sólido CSS calculado en RGBA, el segundo endpoint deberá permitir identificarlo como un recurso reutilizable.
- Cuando varias partes de la página usen la misma combinación calculada de `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing` y `text-transform`, el segundo endpoint deberá permitir identificarla como un recurso tipográfico reutilizable.
- Cuando una apariencia de color provenga de un gradiente, imagen, filtro o modo de mezcla, el segundo endpoint no deberá convertirla en un recurso de color reutilizable.

### RF-4. Errores de carga
**Criterios de aceptación**
- Cuando la navegación principal produzca una redirección HTTP, mediante meta refresh o mediante JavaScript, el sistema deberá rechazar la solicitud con estado 502, `code` `REDIRECT_NOT_ALLOWED`, un `message` en inglés y ningún resultado parcial.
- Cuando la página sea inaccesible, presente un certificado HTTPS no válido, responda con un error de origen o no pueda procesarse, el sistema deberá devolver estado 502, `code` `UPSTREAM_FAILURE`, un `message` en inglés y ningún resultado parcial.
- Cuando ocurra un error, ambos endpoints deberán comunicar la categoría de la causa sin exponer datos internos de la ejecución.
- Cuando una solicitud tenga parámetros ausentes o inválidos, ambos endpoints deberán responder con estado 400, `code` `INVALID_REQUEST` y un objeto JSON con `message` en inglés.
- Cuando una URL no sea pública en producción, ambos endpoints deberán responder con estado 422, `code` `URL_NOT_PUBLIC` y un objeto JSON con `message` en inglés.
- Cuando ocurra un fallo interno no atribuible a la solicitud ni al sitio de origen, ambos endpoints deberán responder con estado 500, `code` `INTERNAL_ERROR` y un objeto JSON con `message` en inglés.

### RF-5. Contrato de nodos orientados a Figma
**Criterios de aceptación**
- Cuando `/v1/figma` represente un nodo, el sistema deberá devolver `id`, `tag`, `type`, `rect`, `relativeRect` e `isVisible`, además de sus propiedades visuales, contenido y recursos aplicables.
- Cuando el sistema devuelva `rect` o `relativeRect`, deberá expresar `x`, `y`, `width`, `height`, `top` y `left` como números en píxeles CSS; `rect` será absoluto respecto al documento y, para todo nodo no raíz con padre representado, `relativeRect.x` y `relativeRect.y` deberán calcularse exactamente como `rect.x - parent.rect.x` y `rect.y - parent.rect.y`, respectivamente. `relativeRect` conservará el mismo `width` y `height` que `rect`. Los márgenes, incluidas las márgenes negativas, el desplazamiento `sticky` y cualquier otro estilo de posicionamiento ya reflejado en ambas cajas no deberán aplicarse por segunda vez. El nodo raíz no tendrá `relativeRect`.
- Cuando un nodo no tenga caja de diseño, el sistema deberá devolver una geometría numérica de tamaño cero en lugar de valores CSS textuales o valores no numéricos.
- Cuando un nodo tenga `display: none`, no tenga `offsetParent` cuando dicha propiedad aplique, tenga opacidad calculada cero, ancho o alto cero, esté oculto por el atributo `hidden` o por `visibility: hidden` o `collapse`, el sistema deberá marcarlo con `isVisible: false`; esta comprobación no deberá marcar erróneamente como ocultos el nodo raíz, SVGs o elementos de posición fija que sí tengan caja renderizada.
- Cuando `includeHidden` sea `false`, el sistema deberá excluir de `/v1/figma` los nodos con `isVisible: false` y sus descendientes; cuando sea `true`, deberá incluirlos y conservar `isVisible: false`.
- Cuando el árbol contenga elementos no renderizables o de metadatos, incluidos `head`, `meta`, `title`, `script`, `link`, `style`, `base`, `template` y `noscript`, el sistema deberá excluirlos de `/v1/figma`.
- Cuando un nodo sea un contenedor visual, incluso si tiene una imagen CSS de fondo, el sistema deberá asignarle `type: "FRAME"`; cuando represente una ejecución de texto puro, deberá asignarle `type: "TEXT"`; solo cuando sea un elemento `img` deberá asignarle `type: "IMAGE"`.
- Cuando un nodo contenedor tenga texto descendiente, el sistema no deberá duplicar dicho texto en `characters`; solo los nodos `TEXT` hoja podrán incluir `characters`.
- Cuando un bloque de texto contenga tramos con estilos distintos, el sistema deberá devolver sus ejecuciones en orden DOM, cada una con sus propios caracteres y estilo de texto. Cada ejecución deberá incluir una única familia en `fontFamily` sin fallbacks, `fontSize`, `fontWeight`, `lineHeight` numérico, `letterSpacing`, `textAlign` y `textAutoResize`.
- La representación de extracción de las ejecuciones de texto directas deberá conservar su orden frente a los elementos hermanos, para que `/v1/figma` pueda emitir nodos `TEXT` hoja sin perder ni duplicar texto.
- Cuando un contenedor use `display: flex`, el sistema deberá devolver `layoutMode: "HORIZONTAL"` o `"VERTICAL"` según su dirección principal. Cuando use `display: grid`, deberá devolver el modo equivalente a su eje principal. Cuando no use flex ni grid, deberá omitir las propiedades de Auto Layout.
- Cuando un nodo tenga `layoutMode`, el sistema deberá devolver `itemSpacing` y `gap` con el mismo valor numérico en píxeles CSS de la separación efectiva en su eje principal; si la separación calculada es `normal` o no produce separación efectiva, ambos valores deberán ser `0`. Deberá devolver también `padding` como objeto con `top`, `right`, `bottom` y `left` numéricos en píxeles CSS, incluso cuando alguno sea cero.
- Cuando un nodo tenga `layoutMode`, el sistema deberá convertir `justify-content` en `primaryAxisAlign` con los valores `MIN`, `CENTER`, `MAX` o `SPACE_BETWEEN`, y `align-items` en `counterAxisAlign` con los valores `MIN`, `CENTER` o `MAX`, siempre que exista una equivalencia directa. Para valores CSS sin equivalencia directa, deberá omitir el campo de alineación correspondiente en lugar de asignar un valor inexacto.
- Cuando un nodo hijo participe en el Auto Layout de un padre, el sistema deberá devolver `layoutGrow` como el valor numérico calculado de `flex-grow` cuando sea mayor que cero; en los demás casos deberá devolver `0` u omitirlo. Los elementos con posición `absolute` o `fixed` no deberán recibir `layoutGrow` por su participación en el flujo del padre.
- Cuando un nodo tenga posición calculada `absolute` o `sticky`, el sistema deberá devolver `position` y `zIndex` numérico cuando sea aplicable, para que el consumidor pueda decidir su posicionamiento absoluto en Figma.
- Cuando un nodo tenga estilos visuales, el sistema deberá limitar `styles` a las propiedades útiles para su recreación y deberá omitir valores calculados no significativos, incluidos `auto`, `normal`, `none`, `0px` y `visible`, salvo que su presencia cambie el resultado visual o el contrato estructurado requiera representarlos.
- Cuando un nodo visible tenga una opacidad computada mayor que cero y menor que uno, `/v1/figma` deberá devolver `opacity` como número y conservar ese valor para su recreación; no deberá omitirla como estilo no significativo.
- Cuando un nodo tenga un borde sólido perceptible, el sistema deberá devolver `strokes` como una colección de pinturas con `type: "SOLID"` y color RGBA normalizado, y `strokeWeight` como su grosor numérico en píxeles CSS. Cuando los lados del borde difieran en color o grosor, deberá preservar la información por lado sin reducirlos a un único borde uniforme.
- Cuando un nodo tenga una sombra CSS perceptible, el sistema deberá devolver `effects` como una colección estructurada: las sombras externas usarán `type: "DROP_SHADOW"` y las internas `type: "INNER_SHADOW"`; cada efecto incluirá color RGBA normalizado, `offset` con `x` e `y`, `radius` y `spread` numéricos en píxeles CSS. Deberá conservar todas las sombras perceptibles declaradas y su orden de composición.
- Cuando un nodo tenga rellenos, bordes o sombras perceptibles, el sistema deberá devolver `fills`, `strokes` y `effects` en formato estructurado compatible con Figma. Cuando no exista un relleno perceptible, deberá devolver `fills: []`, sin inventar un color de respaldo; cuando no exista un borde o efecto perceptible, deberá omitir la propiedad o devolver `null`. Nunca deberá devolver una cadena CSS como `"none"`. Cuando haya varias pinturas, `fills` deberá ordenarlas de primer plano a fondo para preservar su composición.
- Cuando un nodo tenga un color sólido perceptible, el sistema deberá expresarlo con canales RGBA numéricos normalizados entre 0 y 1. El sistema no deberá registrar ni devolver como recurso reutilizable colores con alfa cero.
- Cuando un nodo tenga un radio de esquina uniforme, el sistema deberá devolver `cornerRadius` numérico; cuando sus esquinas difieran, deberá devolver los cuatro radios numéricos identificados por esquina.
- Cuando un elemento `img` tenga una fuente de imagen determinable, deberá devolver `fills` con una pintura de `type: "IMAGE"`, `src` con la URL de la imagen y `scaleMode: "FILL"`; no deberá representarla como una pintura `"SOLID"`. El campo complementario `image` de ese nodo deberá devolver `src`, `naturalWidth`, `naturalHeight` y el `objectFit` resuelto cuando puedan determinarse. Cuando un contenedor tenga una única imagen CSS de fondo con URL absoluta determinable, deberá conservar `type: "FRAME"` y devolver esa fuente como pintura `IMAGE` en `fills`, aunque tenga hijos o Auto Layout; no deberá usar `image` para duplicar esos datos. Si también tiene un color de fondo perceptible, deberá conservar ambas pinturas, con la imagen antes que el color. Una imagen CSS de fondo sin URL absoluta determinable, varias imágenes de fondo o un gradiente no deberán convertir el nodo en `IMAGE` ni inventar una pintura `IMAGE`.
- Cuando un nodo sea un SVG inline, el sistema deberá devolver su marcado SVG como cadena y no deberá convertirlo en un nodo `IMAGE` basado en una URL.
- Cuando la página use familias tipográficas en nodos visibles, la respuesta deberá incluir una colección global `assets` con las fuentes detectadas, agrupadas por familia, pesos usados y URL de carga cuando esta pueda determinarse. No deberá incluir familias ni pesos usados exclusivamente por nodos no visibles o excluidos.
- Cuando se construyan los recursos globales de colores y tipografías, el sistema deberá considerar únicamente nodos visibles incluidos y apariencias perceptibles; por tanto, deberá eliminar recursos no referenciados por esos nodos.

## Requisitos no funcionales
- La API no debe persistir URLs, documentos, estilos extraídos ni datos de clientes.
- Las respuestas de API, incluidos los errores, deben estar en inglés.
- Los archivos Markdown de esta funcionalidad deben estar en español.
- Los resultados de una solicitud válida deben ser reproducibles para la misma URL, configuración de vista, entorno de renderizado definido por la API y estado público de la página.
- El MVP no establece un tiempo máximo total para completar una extracción.
- La funcionalidad debe contar con pruebas automatizadas de su lógica y pruebas de extremo a extremo de las rutas.

## Casos límite
- URL con puerto explícito, fragmento o parámetros de consulta.
- URL o destino de navegación principal que resuelve a localhost, una IP privada, reservada o una red interna.
- Página sin elementos visibles o sin texto visible.
- Página que carga contenido de forma asíncrona antes de completar su representación.
- Página que no completa el evento de carga.
- Redirección HTTP, mediante meta refresh o mediante JavaScript de la navegación principal.
- Pseudoelemento sin contenido o sin estilos perceptibles.
- Shadow DOM cerrado, que se excluye de la extracción.
- Recursos externos que fallen sin producir una redirección de la navegación principal.
- Recursos secundarios que se redirigen sin que se redirija la navegación principal.
- Colores producidos por gradientes, imágenes, filtros o modos de mezcla.
- Página cuyo contenido o estilos cambien entre solicitudes.
- Elemento con `display: none` incluido mediante `includeHidden=true` y excluido por omisión.
- Elemento de posición fija, SVG o raíz sin `offsetParent` y con caja renderizada.
- Nodo padre con texto concatenado y varios nodos `TEXT` hoja, incluidos tramos con estilos tipográficos distintos.
- Contenedor flex o grid con `gap: normal`, sin separación efectiva, con `row-gap` y `column-gap` distintos, o con dirección invertida.
- Contenedor Auto Layout con `justify-content` o `align-items` sin equivalencia directa en Figma, con padding parcial o con un hijo `absolute`, `fixed` o con `flex-grow` positivo.
- Borde sólido con lados de distinto color o grosor, borde transparente, y varias sombras CSS externas o internas con desplazamiento, desenfoque o extensión cero.
- Nodo con margen negativo o posición `sticky` cuyo `relativeRect` debe ser estrictamente la resta de su `rect` y el `rect` de su padre representado.
- Imagen `img` sin dimensiones naturales disponibles, imagen CSS de fondo no resoluble, varias imágenes CSS de fondo, gradiente CSS y SVG inline.
- Nodo sin relleno perceptible, que debe devolver `fills: []` sin color de respaldo.
- Nodo `IMAGE` de `img` con una URL determinable, que debe devolver una pintura `fills` de `type: "IMAGE"`, con `src` y `scaleMode: "FILL"`, y no una pintura `"SOLID"`.
- Contenedor con una imagen CSS de fondo determinable, hijos y/o Auto Layout, que debe conservar `type: "FRAME"` y sus hijos, y expresar la imagen en `fills`.
- Contenedor con imagen CSS de fondo y color de fondo perceptibles, que debe devolver ambas pinturas en `fills`, ordenadas de primer plano a fondo.
- Recursos de color con alfa cero o fuentes declaradas que no se usan en nodos visibles.
- Nodo sin caja de diseño, con tamaño cero o posicionado de forma absoluta o `sticky`.
- Elemento o ejecución de texto visible con `opacity: 0.8`, `opacity: 0.5` u otro valor computado estrictamente mayor que cero y menor que uno, que debe conservar la opacidad en ambas salidas JSON.

## Fuera de alcance
- Iframes y su contenido.
- URLs autenticadas o accesibles solo mediante una red privada en producción.
- Seguir o devolver el destino de una redirección de la navegación principal.
- Persistencia, historial, cuentas de usuario o autenticación.
- Crear, publicar o mantener el plugin de Figma.
- Capturas de pantalla, comparación visual o edición de la página origen.

## Criterios de finalización
- Ambos endpoints son solicitudes `GET` en `/v1/extract` y `/v1/figma`, y aceptan `url`, `width`, `height` y `deviceScaleFactor` mediante parámetros de consulta; `/v1/figma` acepta adicionalmente `includeHidden`, cuyo valor predeterminado es `false`; la vista predeterminada es 1920 × 1080 con escala 1.
- El endpoint sin transformar entrega árbol, identificadores internos, orden DOM, etiqueta, atributos visuales y semánticos, recursos asociados, texto renderizado, propiedades visuales computadas, pseudoelementos y Shadow DOM accesible.
- El endpoint orientado a Figma entrega `FigmaDocument` `1.1`, una representación consumible por el plugin, con geometría absoluta y relativa calculada mediante la resta de cajas padre-hijo, visibilidad real, nodos y texto sin duplicación, Auto Layout (dirección, separación, padding, alineación y crecimiento), estilos compactos y estructurados, bordes, sombras, imágenes CSS de fondo como pinturas de nodos `FRAME`, imágenes `img`, SVGs, colores y tipografías reutilizables que se usan en nodos visibles.
- Las redirecciones de la navegación principal y los fallos de carga devuelven los estados, códigos y mensajes normalizados en inglés sin resultados parciales.
- Se han implementado y superan las pruebas automatizadas y de extremo a extremo requeridas.

## Dudas abiertas
No hay dudas abiertas para el MVP. La lista de propiedades visuales, los atributos y recursos permitidos, los contratos JSON versionados y el entorno de renderizado están definidos en `plan.md`.
