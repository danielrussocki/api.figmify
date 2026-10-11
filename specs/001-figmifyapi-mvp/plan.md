# Plan técnico: MVP de extracción web para Figma

## Alcance y trazabilidad

Este plan implementa la especificación `001-figmifyapi-mvp` sin persistir información de solicitudes ni de extracciones. Las respuestas JSON, claves, valores de error, nombres de código y logs internos estarán en inglés; este documento permanece en español.

| Parte del plan | RF cubiertos |
| --- | --- |
| Contrato HTTP y validación | RF-1, RF-4 |
| Extracción del documento | RF-2, RF-4 |
| Transformación orientada a Figma | RF-3 |
| Seguridad y navegación | RF-1, RF-4 |
| Estrategia de pruebas | RF-1, RF-2, RF-3, RF-4 |

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
    figma/                  # Tipos del esquema Figma v1
    errors/                 # Tipos de error de aplicación
  security/
    url-policy/             # URL absoluta, esquema y política de red pública
  browser/
    playwright-extractor/   # Adaptador que navega y produce ExtractionDocument
    visual-properties/      # Lista cerrada de propiedades visuales
    element-serializer/     # Árbol, Shadow DOM abierto y pseudoelementos
  figma/
    transformer/            # Convierte ExtractionDocument a FigmaDocument v1
    style-catalog/          # Deduplica colores y estilos tipográficos
  bootstrap/                # Ensambla dependencias y crea la aplicación
test/
  unit/
  integration/
  e2e/
  fixtures/
```

Los manejadores HTTP dependen solo de los casos de uso de `application`. El adaptador del navegador implementa el puerto de extracción definido en `contracts`; no conoce rutas HTTP ni el formato Figma. El transformador Figma recibe únicamente el contrato de extracción y no importa el adaptador Playwright ni módulos HTTP. La capa `application` es la única que compone extracción y transformación. **Cubre RF-1, RF-2, RF-3 y RF-4.**

## Contrato HTTP

### Solicitudes

| Endpoint | Parámetros de consulta | Respuesta satisfactoria | RF |
| --- | --- | --- | --- |
| `GET /v1/extract` | `url` obligatorio; `width`, `height`, `deviceScaleFactor` opcionales | `ExtractionDocument` | RF-1, RF-2 |
| `GET /v1/figma` | `url` obligatorio; `width`, `height`, `deviceScaleFactor` opcionales | `FigmaDocument` v1 | RF-1, RF-3 |

`width` y `height` son enteros entre 1 y 3840. `deviceScaleFactor` solo admite 1, 2 o 3. Los valores predeterminados son `width=1920`, `height=1080` y `deviceScaleFactor=1`. El parámetro `url` debe ser una URL absoluta HTTP o HTTPS. Los fragmentos se aceptan pero no intervienen en la navegación HTTP.

### Errores

Todas las respuestas de error tienen esta forma:

```json
{ "code": "INVALID_REQUEST", "message": "The width query parameter must be an integer between 1 and 3840." }
```

| Estado | `code` | Situaciones | RF |
| --- | --- | --- | --- |
| 400 | `INVALID_REQUEST` | Parámetro ausente, no parseable o fuera de rango; URL no absoluta o esquema no permitido | RF-1, RF-4 |
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

El contrato de `/v1/figma` usa `schemaVersion: "1.0"` y nombres basados en el modelo de plugin de Figma. Es un esquema propio: no presupone que sea una respuesta de la API de Figma ni que el plugin pueda asignarlo directamente sin validación. Conserva el identificador de origen, la estructura, texto, atributos permitidos y recursos para preservar la información de `ExtractionDocument`.

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
        "fontFamily": "Inter, sans-serif",
        "fontSize": "32px",
        "fontWeight": "700",
        "fontStyle": "normal",
        "lineHeight": "38.4px",
        "letterSpacing": "normal",
        "textTransform": "none"
      }
    ]
  },
  "document": {
    "sourceId": "node-1",
    "type": "FRAME",
    "name": "body",
    "attributes": { "class": "page" },
    "resources": [],
    "styles": { "backgroundColor": { "r": 1, "g": 1, "b": 1, "a": 1 } },
    "children": [
      {
        "sourceId": "node-2",
        "type": "TEXT",
        "name": "h1",
        "characters": "Welcome",
        "attributes": { "id": "welcome" },
        "resources": [],
        "fillStyleId": "color-111827",
        "textStyleId": "type-inter-32-700-normal-38.4-0-none",
        "styles": { "fontSize": 32, "fontWeight": 700 },
        "children": []
      }
    ]
  }
}
```

Las claves de `styles` del documento Figma se expresan en *camelCase*. Los tipos permitidos son `DOCUMENT`, `FRAME`, `TEXT`, `IMAGE`, `VECTOR` y `RECTANGLE`; el transformador elige el tipo a partir de la etiqueta, recursos y contenido. Los valores sin correspondencia Figma permanecen bajo `styles` con su representación CSS para que el plugin pueda decidir cómo tratarlos. `sourceId` enlaza cada nodo con su nodo de extracción. Los IDs de estilos se generan de forma determinista a partir de sus valores normalizados.

Los colores reutilizables son únicamente valores sólidos CSS convertibles a RGBA. Se agrupan por RGBA calculado idéntico. Los gradientes, imágenes, filtros y modos de mezcla se conservan como información del nodo, pero no generan entradas en `styles.colors`. Las tipografías se agrupan por la tupla exacta indicada en RF-3. **Cubre RF-3.**

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
  node.pseudoElements.before = serializePseudoElement(element, "::before")
  node.pseudoElements.after = serializePseudoElement(element, "::after")
  node.children = serializeDirectElementChildrenInDomOrder(element)
  if element.hasOpenShadowRoot():
    node.shadowChildren = serializeShadowRootElementChildrenInDomOrder(element.shadowRoot)
  return node

function createFigmaDocument(extraction):
  catalog = collectSolidRgbaColorsAndTypographyTuples(extraction)
  return transformTree(extraction.document, catalog) with schemaVersion "1.0"
```

La política pública se ejecuta antes de navegar y se vuelve a ejecutar para cada destino de navegación principal. En producción rechaza direcciones loopback, privadas, link-local, multicast, no especificadas, reservadas y rangos de documentación, tanto IPv4 como IPv6. En desarrollo se permite esa navegación. Los recursos secundarios no bloquean la extracción si fallan o se redirigen. No hay límite total de tiempo por decisión del MVP; una página que no complete `load` no produce extracción mientras permanezca pendiente. **Cubre RF-1, RF-2, RF-3 y RF-4.**

## Decisiones técnicas

| Decisión | Justificación | Alternativa descartada | RF |
| --- | --- | --- | --- |
| TypeScript sobre Node.js con módulos ESM | Mantiene tipos compartidos para ambos contratos JSON y coherencia con la constitución. | JavaScript sin tipos: reduce la verificación del contrato. | RF-1 a RF-4 |
| Fastify para HTTP | Es el framework exigido, ofrece validación declarativa y pruebas de rutas sin servidor externo. | Express: más trabajo manual de validación; NestJS: complejidad desproporcionada para dos endpoints. | RF-1, RF-4 |
| Playwright para la extracción | Es el navegador exigido y permite navegar, esperar la carga, obtener estilos calculados y acceder a Shadow DOM abierto. | Peticiones HTTP o parser HTML: no calculan estilos ni ejecutan la página; Puppeteer: dependencia adicional sin ventaja para el alcance. | RF-2, RF-4 |
| Puertos de contratos entre capas | Evita importaciones directas entre HTTP, Playwright y transformación Figma. | Llamadas del manejador HTTP directamente al navegador y al transformador: viola la separación exigida. | RF-1 a RF-4 |
| Esquema Figma propio `1.0` | Estabiliza el intercambio con el plugin sin acoplar la API a su implementación. | Emitir objetos nativos de Figma: acopla la API a detalles del plugin y dificulta versionar. | RF-3 |
| Catálogo determinista de estilos | Permite reutilización exacta de colores y tipografías en Figma. | Agrupación aproximada: puede fusionar estilos visualmente distintos. | RF-3 |
| Sin base de datos, caché ni colas | Cumple la política de no persistencia y evita almacenar URLs o contenido de terceros. | Persistir resultados o usar caché: requiere aprobación y documentación explícitas. | RF-1 a RF-4 |
| Dependencias adicionales mínimas | Solo se añadirán herramientas de pruebas si son necesarias y documentadas como dependencias de desarrollo. | Añadir librerías de serialización, validación o scraping sin justificación: incumple la constitución. | RF-1 a RF-4 |

## Estrategia de pruebas

| Nivel | Casos | RF |
| --- | --- | --- |
| Unitarias: validación | Valores predeterminados, límites de viewport, URL absoluta, esquema, errores 400 y mensajes en inglés. | RF-1, RF-4 |
| Unitarias: política de red | Host público; localhost; IPv4/IPv6 privada, reservada, loopback y link-local; diferencia entre desarrollo y producción. | RF-1, RF-4 |
| Unitarias: serialización | Orden DOM, IDs únicos, texto `null`, nodos ocultos, lista cerrada de estilos, atributos permitidos, recursos, pseudoelementos y Shadow DOM abierto/cerrado. | RF-2 |
| Unitarias: transformación Figma | Versión `1.0`, correspondencia de `sourceId`, deduplicación RGBA exacta, deduplicación tipográfica exacta y exclusión de gradientes/filtros/modos de mezcla del catálogo de color. | RF-3 |
| Integración: navegador | Sitios de fixture que contienen contenido asíncrono, recursos fallidos, recursos secundarios redirigidos, iframe, Shadow DOM, pseudoelementos y elementos ocultos. | RF-2, RF-3, RF-4 |
| Extremo a extremo: rutas | Solicitudes reales a ambos endpoints y verificación de contratos de éxito, 400, 422, 502 y 500; comprobación de que no hay respuestas parciales. | RF-1 a RF-4 |
| Regresión de contrato | Ejemplos JSON validados contra los esquemas `ExtractionDocument` 1.0 y `FigmaDocument` 1.0. | RF-2, RF-3 |

Las fixtures se sirven localmente solo durante las pruebas. No forman parte de la política de producción y permiten comprobar el comportamiento de desarrollo para destinos privados. Las pruebas de extremo a extremo ejercitan HTTP, casos de uso y el adaptador de navegador; no sustituyen las pruebas unitarias. Cada corrección incorpora una prueba que reproduzca el defecto antes de corregirlo. **Cubre RF-1, RF-2, RF-3 y RF-4.**
