# Plan técnico: MVP de extracción web para Figma

## Alcance y trazabilidad

Este plan implementa la especificación `001-figmifyapi-mvp` sin persistir información de solicitudes ni de extracciones. Las respuestas JSON, claves, valores de error, nombres de código y logs internos estarán en inglés; este documento permanece en español.

| Parte del plan | RF cubiertos |
| --- | --- |
| Contrato HTTP y validación | RF-1, RF-4 |
| Extracción del documento | RF-2, RF-4 |
| Transformación orientada a Figma y contrato de nodos | RF-3, RF-5 |
| Seguridad y navegación | RF-1, RF-4 |
| Estrategia de pruebas | RF-1, RF-2, RF-3, RF-4, RF-5 |

## Estructura de módulos

```text
src/
  http/
    routes/                 # Declara GET /v1/extract y GET /v1/figma
    schemas/                # Consulta HTTP y respuestas de error
    error-handler/          # Traduce errores de aplicación al contrato HTTP
  application/
    extract-document/       # Orquesta validación, seguridad y extracción
    create-figma-document/  # Orquesta extracción y transformación Figma
  contracts/
    extraction/             # Tipos del documento extraído, viewport y puertos
    figma/                  # Tipos del esquema Figma v1 y valores estructurados
    errors/                 # Tipos de error de aplicación
  security/
    url-policy/             # URL absoluta, esquema y política de red pública
  browser/
    playwright-extractor/   # Adaptador que navega y produce ExtractionDocument
    visual-properties/      # Lista cerrada de propiedades visuales
    element-serializer/     # Árbol raw, Shadow DOM abierto y pseudoelementos
    layout-inspector/       # Rectángulos, visibilidad y datos de imagen de nodos raw
  figma/
    transformer/            # Convierte ExtractionDocument a FigmaDocument v1 compacto
    node-mapper/            # Filtra, tipa y mapea nodos, texto y layout
    paint-parser/           # Convierte colores, bordes y sombras a valores Figma
    style-catalog/          # Deduplica y poda colores y estilos tipográficos usados
    font-assets/            # Descubre y agrupa fuentes usadas y sus URL determinables
  bootstrap/                # Ensambla dependencias y crea la aplicación
test/
  unit/
  integration/
  e2e/
  fixtures/
```

Los manejadores HTTP dependen solo de los casos de uso de `application`. El adaptador del navegador implementa el puerto de extracción definido en `contracts`; no conoce rutas HTTP ni el formato Figma. El transformador Figma recibe únicamente el contrato de extracción y no importa el adaptador Playwright ni módulos HTTP. La capa `application` es la única que compone extracción y transformación. **Cubre RF-1, RF-2, RF-3, RF-4 y RF-5.**

## Contrato HTTP

### Solicitudes

| Endpoint | Parámetros de consulta | Respuesta satisfactoria | RF |
| --- | --- | --- | --- |
| `GET /v1/extract` | `url` obligatorio; `width`, `height`, `deviceScaleFactor` opcionales | `ExtractionDocument` | RF-1, RF-2 |
| `GET /v1/figma` | `url` obligatorio; `width`, `height`, `deviceScaleFactor` e `includeHidden` opcionales | `FigmaDocument` v1 | RF-1, RF-3, RF-5 |

`width` y `height` son enteros entre 1 y 3840. `deviceScaleFactor` solo admite 1, 2 o 3. Los valores predeterminados son `width=1920`, `height=1080` y `deviceScaleFactor=1`. El parámetro `url` debe ser una URL absoluta HTTP o HTTPS. Los fragmentos se aceptan pero no intervienen en la navegación HTTP. Solo `/v1/figma` acepta `includeHidden`; admite literalmente `true` o `false` y su valor predeterminado es `false`. **Cubre RF-1 y RF-5.**

### Errores

Todas las respuestas de error tienen esta forma:

```json
{ "code": "INVALID_REQUEST", "message": "The width query parameter must be an integer between 1 and 3840." }
```

| Estado | `code` | Situaciones | RF |
| --- | --- | --- | --- |
| 400 | `INVALID_REQUEST` | Parámetro ausente, no parseable o fuera de rango; `includeHidden` distinto de `true` o `false`; URL no absoluta o esquema no permitido | RF-1, RF-4 |
| 422 | `URL_NOT_PUBLIC` | En producción, URL inicial o destino de navegación principal en localhost, IP privada, reservada o red interna | RF-1, RF-4 |
| 502 | `REDIRECT_NOT_ALLOWED` | Redirección HTTP, meta refresh o navegación por JavaScript del documento principal | RF-4 |
| 502 | `UPSTREAM_FAILURE` | Error de DNS o red, certificado no válido, respuesta HTTP de origen no satisfactoria o fallo al procesar el documento | RF-4 |
| 500 | `INTERNAL_ERROR` | Fallo no atribuible a la solicitud ni al sitio de origen | RF-4 |

No se entrega una respuesta parcial ante ningún error. Los mensajes son estables, descriptivos y en inglés; nunca incluyen trazas, rutas locales, configuraciones ni detalles internos. **Cubre RF-1 y RF-4.**

## Modelo de datos JSON

### Decisiones que cierran las dudas de la especificación

#### Entorno de renderizado fijo

Además de la vista configurable, el MVP fija: idioma `en-US`, zona horaria `UTC`, esquema de color claro, preferencia de movimiento `no-preference`, modo de contraste `no-preference` y un agente de usuario de escritorio definido por la API. No se aceptan parámetros para cambiar estos valores. **Cubre RF-1 y el requisito no funcional de reproducibilidad.**

#### Propiedades visuales computadas

Las claves de `styles` usan nombres CSS en *kebab-case* y contienen el valor textual computado. Solo se incluyen las propiedades de esta lista; si una no es serializable o no se puede determinar, se omite.

- **Caja y posición:** `display`, `position`, `top`, `right`, `bottom`, `left`, `z-index`, `box-sizing`, `width`, `min-width`, `max-width`, `height`, `min-height`, `max-height`, `margin-top`, `margin-right`, `margin-bottom`, `margin-left`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`, `overflow-x`, `overflow-y`, `visibility`, `opacity`.
- **Bordes y fondos:** `border-top-width`, `border-right-width`, `border-bottom-width`, `border-left-width`, `border-top-style`, `border-right-style`, `border-bottom-style`, `border-left-style`, `border-top-color`, `border-right-color`, `border-bottom-color`, `border-left-color`, `border-top-left-radius`, `border-top-right-radius`, `border-bottom-right-radius`, `border-bottom-left-radius`, `background-color`, `background-image`, `background-size`, `background-position`, `background-repeat`, `box-shadow`, `outline-width`, `outline-style`, `outline-color`.
- **Texto:** `color`, `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`, `word-spacing`, `text-align`, `text-transform`, `text-decoration-line`, `text-decoration-style`, `text-decoration-color`, `text-indent`, `white-space`, `overflow-wrap`, `word-break`, `text-shadow`.
- **Diseño y transformación:** `transform`, `transform-origin`, `filter`, `mix-blend-mode`, `isolation`, `object-fit`, `object-position`, `cursor`, `pointer-events`.
- **Flex y grid:** `flex-direction`, `flex-wrap`, `flex-grow`, `flex-shrink`, `flex-basis`, `justify-content`, `align-items`, `align-content`, `align-self`, `order`, `gap`, `row-gap`, `column-gap`, `grid-template-columns`, `grid-template-rows`, `grid-column-start`, `grid-column-end`, `grid-row-start`, `grid-row-end`, `place-items`, `place-content`.

Esta lista cierra la primera duda abierta y sustituye el término ambiguo “todos los estilos computados” por propiedades visuales verificables. **Cubre RF-2.**

#### Metadatos de layout para la transformación

Cada nodo de extracción incorpora `layout` como dato de medición, separado de `styles`: `rect` obtenido de `getBoundingClientRect()` trasladado a coordenadas del documento, `offsetParentId` cuando exista, `hasOffsetParent` cuando aplique, `naturalWidth` y `naturalHeight` para `img`, y el `objectFit` calculado. Este dato permite a la transformación calcular geometría y visibilidad sin volver a abrir el navegador. No sustituye los estilos computados sin transformar de `/v1/extract`. **Cubre RF-2, RF-3 y RF-5.**

#### Atributos y recursos asociados

`attributes` solo conserva atributos visuales o semánticos: `id`, `class`, `role`, `title`, `lang`, `dir`, `hidden`, `tabindex`, `alt`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-hidden`, `href`, `target`, `src`, `srcset`, `poster`, `width`, `height`, `type`, `value`, `placeholder`, `checked`, `selected`, `disabled`, `name` y `viewBox`.

Los atributos se incluyen solo cuando existan en el elemento. `resources` contiene referencias resueltas a URL absoluta, sin descargar ni almacenar su contenido: imágenes (`img[src]`, `input[type=image][src]`), medios (`video[poster]`, `video[src]`, `audio[src]`, `source[src]`) y hojas de estilo enlazadas (`link[rel=stylesheet][href]`). `srcset` se conserva como atributo y además aporta una referencia por candidato. `href` de enlaces ordinarios es semántico, no un recurso descargable. **Cubre RF-2.**

### `ExtractionDocument`

El contrato de `/v1/extract` es versionado mediante `schemaVersion: "1.0"`. La secuencia de `children` expresa el orden DOM. `text` es `null` cuando no hay texto renderizado. Un `iframe` se representa como nodo, pero no se atraviesa su documento. Las raíces Shadow DOM abiertas se representan mediante `shadowChildren`; una raíz cerrada no produce dicha propiedad.

```json
{
  "schemaVersion": "1.0",
  "source": {
    "url": "https://example.com/",
    "viewport": { "width": 1920, "height": 1080, "deviceScaleFactor": 1 },
    "environment": { "locale": "en-US", "timezone": "UTC", "colorScheme": "light", "reducedMotion": "no-preference" }
  },
  "document": {
    "id": "node-1",
    "tagName": "body",
    "attributes": { "class": "page" },
    "resources": [],
    "text": null,
    "layout": { "rect": { "x": 0, "y": 0, "width": 1920, "height": 1080, "top": 0, "left": 0 } },
    "styles": { "display": "block", "background-color": "rgb(255, 255, 255)" },
    "pseudoElements": {
      "before": null,
      "after": null
    },
    "children": [
      {
        "id": "node-2",
        "tagName": "h1",
        "attributes": { "id": "welcome" },
        "resources": [],
        "text": "Welcome",
        "layout": { "rect": { "x": 24, "y": 32, "width": 180, "height": 39, "top": 32, "left": 24 } },
        "styles": {
          "color": "rgb(17, 24, 39)",
          "font-family": "Inter, sans-serif",
          "font-size": "32px",
          "font-weight": "700",
          "line-height": "38.4px"
        },
        "pseudoElements": { "before": null, "after": null },
        "children": []
      }
    ]
  }
}
```

Un pseudoelemento no nulo contiene `content` (texto calculable o `null`) y `styles`, con la misma lista cerrada de propiedades visuales. Cada entrada de `resources` tiene `kind` (`image`, `media` o `stylesheet`) y `url`. **Cubre RF-2.**

### `FigmaDocument` v1

El contrato de `/v1/figma` usa `schemaVersion: "1.0"` y nombres basados en el modelo de plugin de Figma. Es un esquema propio: no presupone que sea una respuesta de la API de Figma ni que el plugin pueda asignarlo directamente sin validación. Transforma solo la estructura aplicable y no replica el árbol raw. **Cubre RF-3 y RF-5.**

```json
{
  "schemaVersion": "1.0",
  "source": {
    "url": "https://example.com/",
    "viewport": { "width": 1920, "height": 1080, "deviceScaleFactor": 1 }
  },
  "styles": {
    "colors": [
      { "id": "color-111827", "name": "#111827", "rgba": { "r": 0.067, "g": 0.094, "b": 0.153, "a": 1 } }
    ],
    "typographies": [
      {
        "id": "type-inter-32-700-normal-38.4-0-none",
        "fontFamily": "Inter",
        "fontSize": 32,
        "fontWeight": 700,
        "fontStyle": "normal",
        "lineHeight": 38.4,
        "letterSpacing": 0,
        "textTransform": "none"
      }
    ]
  },
  "assets": [{ "family": "Inter", "weights": [700], "url": "https://example.com/inter.woff2" }],
  "document": {
    "id": "node-1",
    "tag": "body",
    "type": "FRAME",
    "rect": { "x": 0, "y": 0, "width": 1920, "height": 1080, "top": 0, "left": 0 },
    "isVisible": true,
    "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }],
    "children": [
      {
        "id": "node-2",
        "tag": "h1",
        "type": "TEXT",
        "characters": "Welcome",
        "rect": { "x": 24, "y": 32, "width": 180, "height": 39, "top": 32, "left": 24 },
        "relativeRect": { "x": 24, "y": 32, "width": 180, "height": 39, "top": 32, "left": 24 },
        "isVisible": true,
        "fillStyleId": "color-111827",
        "textStyleId": "type-inter-32-700-normal-38.4-0-none",
        "styles": { "fontFamily": "Inter", "fontSize": 32, "fontWeight": 700, "lineHeight": 38.4, "textAlign": "LEFT", "textAutoResize": "HEIGHT" },
        "children": []
      }
    ]
  }
}
```

Cada nodo tiene `id`, `tag`, `type`, `rect` e `isVisible`; salvo la raíz, también `relativeRect`. Ambos rectángulos contienen seis números CSS en píxeles: `x`, `y`, `width`, `height`, `top` y `left`. El primero es absoluto respecto al documento; el segundo es relativo al área de contenido del padre representado. Un nodo sin caja usa ceros numéricos. **Cubre RF-5.**

Los tipos emitidos son solo `FRAME`, `TEXT` e `IMAGE`: un contenedor visual es `FRAME`; una ejecución de texto hoja es `TEXT`; y `img` o un fondo con imagen renderizable es `IMAGE`. Se excluyen los elementos no renderizables o de metadatos. Un `TEXT` contiene `characters` y estilos numéricos normalizados; los nodos contenedores nunca concatenan texto descendiente. Cuando haya cambios de estilo, la transformación crea ejecuciones `TEXT` hoja ordenadas, una por tramo. **Cubre RF-5.**

`isVisible` combina la caja, `display`, `visibility`, `hidden`, opacidad y `offsetParent` cuando aplique; no declara ocultos por ese último dato al nodo raíz, SVG o elementos fijos que tengan caja. Con `includeHidden=false` se descarta un nodo no visible y su subárbol; con `true` se incluye marcado como no visible. **Cubre RF-1 y RF-5.**

Las claves de `styles` son *camelCase* y solo incluyen valores útiles. Se eliminan `auto`, `normal`, `none`, `0px` y `visible` cuando no cambian el resultado. `layoutMode` y `gap` se emiten únicamente para flex o grid; el primero vale `HORIZONTAL` o `VERTICAL` y el segundo es un número. `position` y `zIndex` se incluyen para nodos `absolute` o `sticky` cuando correspondan. **Cubre RF-5.**

`fills`, `strokes` y `effects` usan objetos Figma estructurados o son `null`/se omiten si no son perceptibles: los colores son RGBA normalizados, las sombras incluyen `DROP_SHADOW` con desplazamiento, radio y extensión numéricos, y los radios se expresan como `cornerRadius` o por esquina. `IMAGE` aporta `src`, dimensiones naturales y `objectFit` resuelto; un SVG inline aporta `svg` como cadena. **Cubre RF-5.**

Los colores reutilizables son únicamente sólidos perceptibles con alfa mayor que cero, agrupados por RGBA idéntico. Gradientes, imágenes, filtros y mezclas permanecen en el nodo pero no originan recursos de color. Las tipografías se agrupan por la tupla de RF-3 normalizada; `assets` contiene solo familias y pesos usados por nodos visibles incluidos, con URL cuando sea determinable. El catálogo se genera después de filtrar y transformar el árbol, por lo que no contiene recursos sin referencias. Los IDs son deterministas a partir de sus valores normalizados. **Cubre RF-3 y RF-5.**

## Algoritmo de extracción (pseudocódigo)

```text
function executeExtraction(query, environment):
  request = validateAndNormalizeQuery(query, defaults=1920x1080@1)
  target = parseAbsoluteHttpUrl(request.url)
  enforcePublicAddressPolicy(target, environment)

  browserPage = createPage(viewport=request.viewport, fixedEnvironment)
  startNavigationTracking(browserPage)
  navigateTo(target, doNotAcceptMainNavigationRedirects)
  if mainNavigationRedirected(): fail(REDIRECT_NOT_ALLOWED)
  if mainNavigationFailedOrOriginResponseIsNotSuccessful(): fail(UPSTREAM_FAILURE)

  waitForDocumentLoadEvent()
  wait(30 seconds)
  if mainNavigationRedirected(): fail(REDIRECT_NOT_ALLOWED)
  if mainNavigationFailed(): fail(UPSTREAM_FAILURE)

  document = serializeDocument(browserPage.document)
  return document

function serializeDocument(document):
  return serializeElement(document.documentElement)

function serializeElement(element):
  node.id = nextStableInternalId()
  node.tagName = lowercaseTagName(element)
  node.attributes = selectAllowedAttributes(element)
  node.resources = resolveAllowedResourceReferences(element)
  node.text = renderedDirectAndDescendantTextOrNull(element)
  node.styles = readOnlyListedSerializableComputedProperties(element)
  node.layout = inspectLayout(element, documentScrollOffset)
  node.pseudoElements.before = serializePseudoElement(element, "::before")
  node.pseudoElements.after = serializePseudoElement(element, "::after")
  node.children = serializeDirectElementChildrenInDomOrder(element)
  if element.hasOpenShadowRoot():
    node.shadowChildren = serializeShadowRootElementChildrenInDomOrder(element.shadowRoot)
  return node

function createFigmaDocument(extraction, includeHidden):
  visibleTree = mapFigmaNode(extraction.document, parent=null, includeHidden)
  catalog = collectReferencedPerceptibleColorsAndTypography(visibleTree)
  assets = collectUsedFontAssets(visibleTree, extraction.fontFaceSources)
  return { schemaVersion: "1.0", source: extraction.source, styles: catalog, assets, document: visibleTree }

function mapFigmaNode(rawNode, parent, includeHidden):
  if isExcludedFigmaTag(rawNode.tagName): return null
  visibility = determineVisibility(rawNode, parent)
  if !includeHidden and !visibility: return null
  if isTextLeaf(rawNode): return mapTextRun(rawNode, parent, visibility)
  node = mapFrameOrImage(rawNode, parent, visibility)
  node.children = mapDirectChildrenAndTextRunsInDomOrder(rawNode, node, includeHidden)
  return node
```

`inspectLayout` convierte el rectángulo de viewport en coordenadas de documento con el desplazamiento actual y conserva datos necesarios para la transformación. `mapFigmaNode` calcula `relativeRect` al restar el origen del área de contenido del padre representado; conserva ceros para nodos sin caja. El inspector de texto recorre nodos de texto directos y divide ejecuciones cuando cambian sus estilos computados, sin asignar el texto agregado a sus antecesores. El análisis de flex/grid resuelve eje y `gap`; los valores `normal` o no numéricos no se envían. El parseador de pintura no inventa valores si el CSS no se puede convertir con certeza. **Cubre RF-2, RF-3 y RF-5.**

La política pública se ejecuta antes de navegar y se vuelve a ejecutar para cada destino de navegación principal. En producción rechaza direcciones loopback, privadas, link-local, multicast, no especificadas, reservadas y rangos de documentación, tanto IPv4 como IPv6. En desarrollo se permite esa navegación. Los recursos secundarios no bloquean la extracción si fallan o se redirigen. No hay límite total de tiempo por decisión del MVP; una página que no complete `load` no produce extracción mientras permanezca pendiente. **Cubre RF-1, RF-2 y RF-4.**

## Decisiones técnicas

| Decisión | Justificación | Alternativa descartada | RF |
| --- | --- | --- | --- |
| TypeScript sobre Node.js con módulos ESM | Mantiene tipos compartidos para ambos contratos JSON y coherencia con la constitución. | JavaScript sin tipos: reduce la verificación del contrato. | RF-1 a RF-5 |
| Fastify para HTTP | Es el framework exigido, ofrece validación declarativa y pruebas de rutas sin servidor externo. | Express: más trabajo manual de validación; NestJS: complejidad desproporcionada para dos endpoints. | RF-1, RF-4 |
| Playwright para la extracción | Es el navegador exigido y permite navegar, esperar la carga, medir rectángulos, obtener estilos calculados y acceder a Shadow DOM abierto. | Peticiones HTTP o parser HTML: no calculan estilos ni geometría; Puppeteer: dependencia adicional sin ventaja para el alcance. | RF-2, RF-4, RF-5 |
| Puertos de contratos entre capas | Evita importaciones directas entre HTTP, Playwright y transformación Figma. | Llamadas del manejador HTTP directamente al navegador y al transformador: viola la separación exigida. | RF-1 a RF-5 |
| Esquema Figma propio `1.0` | Estabiliza el intercambio con el plugin, con geometría y valores Figma, sin acoplar la API a su implementación. | Emitir objetos nativos de Figma: acopla la API a detalles del plugin y dificulta versionar. | RF-3, RF-5 |
| Transformación tipada y poda posterior | Evita ruido CSS y garantiza que catálogos y assets solo correspondan a nodos incluidos y perceptibles. | Crear catálogos antes de filtrar: conserva colores y fuentes muertos. | RF-3, RF-5 |
| Sin base de datos, caché ni colas | Cumple la política de no persistencia y evita almacenar URLs o contenido de terceros. | Persistir resultados o usar caché: requiere aprobación y documentación explícitas. | RF-1 a RF-5 |
| Dependencias adicionales mínimas | Los parseos de CSS y valores Figma se implementan con TypeScript y APIs existentes; solo se añadirá una dependencia si se documenta su necesidad. | Añadir librerías de serialización, validación o scraping sin justificación: incumple la constitución. | RF-1 a RF-5 |

## Estrategia de pruebas

| Nivel | Casos | RF |
| --- | --- | --- |
| Unitarias: validación | Valores predeterminados, límites de viewport, URL absoluta, esquema, `includeHidden` válido, error 400 y mensajes en inglés. | RF-1, RF-4, RF-5 |
| Unitarias: política de red | Host público; localhost; IPv4/IPv6 privada, reservada, loopback y link-local; diferencia entre desarrollo y producción. | RF-1, RF-4 |
| Unitarias: serialización | Orden DOM, IDs únicos, texto `null`, nodos ocultos, lista cerrada de estilos, atributos permitidos, recursos, pseudoelementos y Shadow DOM abierto/cerrado. | RF-2 |
| Unitarias: transformación Figma | Tipos `FRAME`/`TEXT`/`IMAGE`; rectángulos absoluto y relativo; exclusión de metadatos; visibilidad y poda con `includeHidden`; texto por ejecuciones; flex/grid; posición; pinturas, radios, imágenes, SVG y omisión de valores de ruido. | RF-3, RF-5 |
| Unitarias: catálogos y assets | RGBA exacto sin alfa cero; exclusión de gradientes/filtros/modos de mezcla; tipografías normalizadas; eliminación de recursos no referenciados; familias, pesos y URL de fuentes usadas. | RF-3, RF-5 |
| Integración: navegador | Sitios de fixture con contenido asíncrono, recursos fallidos, recursos secundarios redirigidos, iframe, Shadow DOM, pseudoelementos, metadatos, textos mixtos, flex/grid, imágenes, SVG y elementos ocultos/fijos. | RF-2, RF-3, RF-4, RF-5 |
| Extremo a extremo: rutas | Solicitudes reales a ambos endpoints y verificación de contratos de éxito, `includeHidden` por omisión y habilitado, 400, 422, 502 y 500; comprobación de que no hay respuestas parciales. | RF-1 a RF-5 |
| Regresión de contrato | Ejemplos JSON validados contra los esquemas `ExtractionDocument` 1.0 y `FigmaDocument` 1.0, incluidos rectángulos y recursos globales. | RF-2, RF-3, RF-5 |

Las fixtures se sirven localmente solo durante las pruebas. No forman parte de la política de producción y permiten comprobar el comportamiento de desarrollo para destinos privados. Las pruebas de extremo a extremo ejercitan HTTP, casos de uso y el adaptador de navegador; no sustituyen las pruebas unitarias. Cada corrección incorpora una prueba que reproduzca el defecto antes de corregirlo. **Cubre RF-1, RF-2, RF-3, RF-4 y RF-5.**
