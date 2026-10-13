# Tareas: MVP de extracción web para Figma

Las tareas están ordenadas por dependencia y deben mantenerse dentro de 20–30 minutos cada una.

## Base del proyecto y contratos

- [x] **T1. Configurar el entorno TypeScript, ESM y los comandos de desarrollo y pruebas.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** el proyecto compila TypeScript con ESM y `pnpm test` ejecuta una suite de pruebas vacía correctamente.

- [x] **T2. Añadir Fastify y Playwright, y documentar en el manifiesto la justificación de cada dependencia añadida.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** las dependencias necesarias están instaladas y cada dependencia no transitiva añadida tiene una justificación documentada.

- [x] **T3. Crear los contratos TypeScript de viewport, entorno de renderizado y documento de extracción v1.**
  - **RF:** RF-1, RF-2.
  - **Hecho cuando:** los tipos representan `schemaVersion`, fuente, viewport, entorno, nodo, pseudoelementos y recursos descritos en `plan.md`.

- [x] **T4. Crear los contratos TypeScript de documento Figma v1, estilos de color y estilos tipográficos.**
  - **RF:** RF-3.
  - **Hecho cuando:** los tipos representan `FigmaDocument` v1, nodos Figma, `sourceId`, catálogos de color y tipografía, e IDs de estilos.

- [x] **T5. Crear el contrato de errores de aplicación y las cinco categorías de error normalizadas.**
  - **RF:** RF-4.
  - **Hecho cuando:** existen representaciones tipadas para `INVALID_REQUEST`, `URL_NOT_PUBLIC`, `REDIRECT_NOT_ALLOWED`, `UPSTREAM_FAILURE` e `INTERNAL_ERROR`.

- [x] **T6. Definir constantes para la vista predeterminada, el entorno fijo y las propiedades visuales permitidas.**
  - **RF:** RF-1, RF-2.
  - **Hecho cuando:** las constantes contienen 1920×1080@1, los valores fijos de entorno y la lista cerrada de propiedades de `plan.md`.

## Validación y seguridad

- [x] **T7. Implementar el análisis y la normalización de parámetros de consulta.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** una consulta válida produce una URL y viewport normalizados, y los parámetros omitidos reciben los tres valores predeterminados.

- [x] **T8. Probar la normalización de consulta para valores predeterminados y límites válidos.**
  - **RF:** RF-1.
  - **Hecho cuando:** las pruebas cubren valores omitidos, dimensiones 1 y 3840, y escalas 1, 2 y 3.

- [x] **T9. Probar la normalización de consulta para entradas inválidas.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** las pruebas verifican ausencia de `url`, URL no absoluta, esquemas no HTTP(S), dimensiones no enteras o fuera de rango y escalas no permitidas, todos con `INVALID_REQUEST`.

- [x] **T10. Implementar la política de URL pública para el entorno de producción.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** la política rechaza localhost y direcciones IPv4 e IPv6 loopback, privadas, link-local, multicast, no especificadas, reservadas y de documentación.

- [x] **T11. Probar la política de URL pública en producción y desarrollo.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** las pruebas confirman `URL_NOT_PUBLIC` en producción y permiten direcciones no públicas en desarrollo.

## Navegación y extracción Playwright

- [x] **T12. Crear el puerto de extracción y el caso de uso de extracción sin Figma.**
  - **RF:** RF-1, RF-2, RF-4.
  - **Hecho cuando:** el caso de uso acepta una solicitud normalizada, aplica la política de URL y depende de un puerto de extracción, no de Playwright directamente.

- [x] **T13. Crear el adaptador Playwright con viewport y entorno fijo.**
  - **RF:** RF-1, RF-2.
  - **Hecho cuando:** cada extracción crea un contexto con viewport, escala, idioma, zona horaria, esquema de color y preferencias definidos en el plan.

- [x] **T14. Detectar y clasificar redirecciones HTTP de la navegación principal.**
  - **RF:** RF-4.
  - **Hecho cuando:** una respuesta 3xx del documento principal termina la extracción con `REDIRECT_NOT_ALLOWED` y sin documento parcial.

- [x] **T15. Detectar redirecciones por meta refresh y JavaScript de la navegación principal.**
  - **RF:** RF-4.
  - **Hecho cuando:** una navegación principal posterior causada por meta refresh o JavaScript termina con `REDIRECT_NOT_ALLOWED`.

- [x] **T16. Implementar la espera de `load` seguida de 30 segundos antes de serializar.**
  - **RF:** RF-2, RF-3.
  - **Hecho cuando:** el extractor no inicia la serialización antes de recibir `load` y esperar los 30 segundos adicionales.

- [x] **T17. Clasificar fallos de red, certificado, origen o procesamiento como error de origen.**
  - **RF:** RF-4.
  - **Hecho cuando:** cada fallo citado se expone al caso de uso como `UPSTREAM_FAILURE` y no contiene detalles internos.

- [x] **T18. Volver a aplicar la política de URL pública en cada destino de navegación principal.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** un destino principal no público en producción no llega a cargarse y devuelve `URL_NOT_PUBLIC`.

## Serialización del documento

- [x] **T19. Implementar la serialización básica de un elemento y sus hijos en orden DOM.**
  - **RF:** RF-2.
  - **Hecho cuando:** cada nodo incluye ID interno único, etiqueta, hijos ordenados, `attributes`, `resources`, `text`, `styles` y `pseudoElements`.

- [x] **T20. Implementar la extracción de texto renderizado y la inclusión de elementos ocultos.**
  - **RF:** RF-2.
  - **Hecho cuando:** los nodos ocultos se mantienen en el árbol y los nodos sin texto renderizado devuelven `text: null`.

- [x] **T21. Implementar la lectura de la lista cerrada de propiedades visuales computadas.**
  - **RF:** RF-2.
  - **Hecho cuando:** `styles` solo contiene propiedades de la lista del plan y omite valores no serializables o indeterminables.

- [x] **T22. Implementar la selección de atributos permitidos y referencias de recursos.**
  - **RF:** RF-2.
  - **Hecho cuando:** solo se incluyen los atributos permitidos, las URL de recursos están resueltas de forma absoluta y no se descarga ningún recurso adicional.

- [x] **T23. Implementar la serialización de `::before` y `::after`.**
  - **RF:** RF-2.
  - **Hecho cuando:** cada nodo incluye ambos campos como `null` o como un objeto con `content` y propiedades visuales permitidas.

- [x] **T24. Implementar la serialización de Shadow DOM abierto y la exclusión del cerrado.**
  - **RF:** RF-2.
  - **Hecho cuando:** las raíces abiertas se devuelven en `shadowChildren` respetando el orden y las cerradas no aportan contenido.

- [x] **T25. Integrar navegación y serialización en el adaptador Playwright.**
  - **RF:** RF-1, RF-2, RF-4.
  - **Hecho cuando:** el adaptador devuelve un `ExtractionDocument` v1 completo ante una página válida o uno de los errores tipados ante un fallo.

## Transformación para Figma

- [x] **T26. Crear el catálogo determinista de colores sólidos RGBA.**
  - **RF:** RF-3.
  - **Hecho cuando:** colores RGBA idénticos generan una única entrada con ID estable, y gradientes, imágenes, filtros y modos de mezcla no generan estilos de color.

- [x] **T27. Crear el catálogo determinista de estilos tipográficos.**
  - **RF:** RF-3.
  - **Hecho cuando:** una misma tupla de las siete propiedades tipográficas genera un único estilo con ID estable.

- [x] **T28. Implementar la transformación de un nodo extraído a nodo Figma.**
  - **RF:** RF-3.
  - **Hecho cuando:** la transformación conserva `sourceId`, estructura, texto, atributos y recursos, y asigna un tipo permitido de Figma.

- [x] **T29. Implementar la transformación recursiva a `FigmaDocument` v1.**
  - **RF:** RF-3.
  - **Hecho cuando:** el resultado contiene `schemaVersion: "1.0"`, catálogos de estilos, árbol Figma y referencias correctas a estilos reutilizables.

- [x] **T30. Crear el caso de uso de documento Figma a partir del puerto de extracción.**
  - **RF:** RF-1, RF-3, RF-4.
  - **Hecho cuando:** el caso de uso recibe el documento extraído y lo transforma sin que el transformador importe módulos HTTP ni Playwright.

## HTTP y pruebas de aceptación

- [x] **T31. Crear el manejador global que traduce errores de aplicación al contrato HTTP.**
  - **RF:** RF-4.
  - **Hecho cuando:** los cinco códigos de error devuelven el estado correcto y un JSON con solo `code` y `message` en inglés.

- [x] **T32. Implementar la ruta `GET /v1/extract`.**
  - **RF:** RF-1, RF-2, RF-4.
  - **Hecho cuando:** la ruta valida la consulta, ejecuta el caso de uso de extracción y devuelve el contrato `ExtractionDocument` v1 o el error normalizado.

- [x] **T33. Implementar la ruta `GET /v1/figma`.**
  - **RF:** RF-1, RF-3, RF-4.
  - **Hecho cuando:** la ruta valida la consulta, ejecuta el caso de uso Figma y devuelve `FigmaDocument` v1 o el error normalizado.

- [x] **T34. Crear fixtures web para las pruebas de navegador.**
  - **RF:** RF-2, RF-3, RF-4.
  - **Hecho cuando:** existen fixtures controladas para texto, elementos ocultos, pseudoelementos, Shadow DOM abierto/cerrado, iframe, carga asíncrona, recursos fallidos y recursos secundarios redirigidos.

- [x] **T35. Añadir pruebas unitarias de serialización del documento.**
  - **RF:** RF-2.
  - **Hecho cuando:** las pruebas verifican orden, IDs, texto nulo, ocultos, estilos permitidos, atributos, recursos, pseudoelementos y ambos tipos de Shadow DOM.

- [x] **T36. Añadir pruebas unitarias de transformación Figma.**
  - **RF:** RF-3.
  - **Hecho cuando:** las pruebas verifican esquema v1, `sourceId`, tipos de nodo, deduplicación exacta de color y tipografía, y exclusiones de estilos de color.

- [x] **T37. Añadir pruebas de integración del adaptador Playwright.**
  - **RF:** RF-1, RF-2, RF-4.
  - **Hecho cuando:** las fixtures verifican espera tras `load`, redirecciones principales, errores de origen, recursos secundarios no bloqueantes e iframe no atravesado.

- [x] **T38. Añadir pruebas de extremo a extremo de respuestas satisfactorias.**
  - **RF:** RF-1, RF-2, RF-3.
  - **Hecho cuando:** solicitudes HTTP reales a ambas rutas devuelven los contratos JSON v1 con los valores predeterminados y configurados de viewport.

- [x] **T39. Añadir pruebas de extremo a extremo de errores.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** las rutas devuelven 400, 422, 502 y 500 con el `code` esperado, mensajes en inglés y ninguna respuesta parcial.

- [x] **T40. Añadir pruebas de regresión de contratos JSON.**
  - **RF:** RF-2, RF-3.
  - **Hecho cuando:** ejemplos representativos de extracción y Figma se validan contra los contratos versionados 1.0.

- [x] **T41. Ejecutar la suite completa y verificar que no se persisten datos.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** `pnpm test` pasa y la revisión de la implementación confirma que no incorpora base de datos, caché, archivos de resultados ni colas persistentes.
  - **NOTA:** `pnpm typecheck` tiene dos errores preexistentes que deben resolverse durante esta validación final: `TS2532` en `src/figma/transformer.ts` (el acceso a `match[2]` puede ser `undefined`) y `TS2345` en `test/unit/figma/transformer.test.ts` (la tupla de casos de `test.each` no coincide con la firma de la función).

## Ensamblaje y ejecución de la API

- [x] **T42. Especificar el contrato operativo de arranque de la API.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** la especificación versionada documenta las variables de entorno de host y puerto, sus valores predeterminados y el comportamiento ante valores inválidos, antes de implementar el arranque.

- [x] **T43. Crear el ensamblador de la aplicación Fastify y sus dependencias.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** un módulo de `bootstrap` crea una instancia de Fastify, instancia el adaptador Playwright y los casos de uso, registra el manejador global de errores y ambas rutas, sin que `main.ts` contenga lógica de rutas ni de extracción.

- [x] **T44. Implementar el punto de entrada que inicia el servidor HTTP.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** `src/main.ts` crea la aplicación mediante el ensamblador, lee la configuración operativa especificada y ejecuta `listen`; los fallos de arranque se registran en inglés y finalizan el proceso con un código distinto de cero.

- [x] **T45. Gestionar el cierre ordenado del proceso y de los recursos de la aplicación.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** las señales de terminación cierran Fastify y los recursos de Playwright que permanezcan abiertos, sin persistir datos ni dejar el proceso escuchando.

- [x] **T46. Probar el ensamblaje y el arranque del servidor.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** las pruebas verifican que el ensamblador expone `GET /v1/extract` y `GET /v1/figma` con sus dependencias reales o sustituidas de forma controlada, y que el punto de entrada escucha la configuración válida y rechaza una configuración inválida sin abrir un puerto.

- [x] **T47. Validar la ejecución local de la API.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** `pnpm test` pasa, `pnpm build` genera el punto de entrada ejecutable y una ejecución manual confirma que el proceso acepta solicitudes en el host y puerto configurados, sin persistir datos.

## Evolución del contrato compacto de Figma

- [x] **T48. Ampliar los contratos de extracción con los metadatos `layout`.**
  - **RF:** RF-2, RF-3, RF-5.
  - **Hecho cuando:** los tipos de extracción representan el rectángulo de documento, los datos de `offsetParent`, las dimensiones naturales y `objectFit` sin usar valores CSS textuales para la geometría.

- [x] **T49. Definir los contratos tipados de geometría y visibilidad Figma.**
  - **RF:** RF-5.
  - **Hecho cuando:** existen tipos para `rect`, `relativeRect` e `isVisible`, y cada rectángulo exige `x`, `y`, `width`, `height`, `top` y `left` numéricos.

- [x] **T50. Actualizar el contrato de nodo Figma compacto.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** el tipo exige `id`, `tag`, `type`, `rect` e `isVisible`, permite `relativeRect` fuera de la raíz y limita los tipos a `FRAME`, `TEXT` e `IMAGE`.

- [x] **T51. Definir los contratos Figma de pinturas, bordes, efectos y radios.**
  - **RF:** RF-5.
  - **Hecho cuando:** existen tipos estructurados para RGBA normalizado, `fills`, `strokes`, `effects` con `DROP_SHADOW`, `cornerRadius` y radios por esquina.

- [x] **T52. Definir los contratos de texto, imágenes, SVG y assets Figma.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** los tipos representan runs `TEXT` con valores tipográficos normalizados, datos de `IMAGE`, cadena `svg` y la colección global `assets` por familia, pesos y URL opcional.

- [x] **T53. Añadir `includeHidden` al esquema de consulta de `/v1/figma`.**
  - **RF:** RF-1, RF-4, RF-5.
  - **Hecho cuando:** solo `true` y `false` son válidos, la omisión normaliza a `false` y un valor distinto produce `INVALID_REQUEST`.

- [x] **T54. Probar la normalización de `includeHidden`.**
  - **RF:** RF-1, RF-4, RF-5.
  - **Hecho cuando:** las pruebas cubren omisión, ambos valores válidos y valores inválidos con el error HTTP normalizado.

- [x] **T55. Extraer el rectángulo absoluto del documento en el inspector de layout.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** el serializador convierte `getBoundingClientRect()` a coordenadas de documento y entrega seis números, incluidos ceros para nodos sin caja.

- [x] **T56. Extraer los datos de layout necesarios para imágenes y visibilidad.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** el documento raw conserva la aplicabilidad de `offsetParent`, dimensiones naturales de `img` y `objectFit` calculado sin alterar el contrato de estilos raw.

- [x] **T57. Probar la serialización de metadatos de layout.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** las pruebas verifican coordenadas con desplazamiento de documento, caja cero y los datos de una imagen.

- [x] **T58. Crear fixtures para geometría, visibilidad y nodos excluidos.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** existen fixtures con metadatos HTML, `display: none`, `hidden`, opacidad cero, tamaño cero, posición fija y SVG con caja.

- [x] **T59. Crear fixtures para texto mixto, layout e imágenes.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** existen fixtures con runs de texto de estilos distintos, flex, grid, `gap: normal`, imágenes `img`, fondos de imagen y SVG inline.

- [x] **T60. Implementar la exclusión de etiquetas no renderizables en el mapeador Figma.**
  - **RF:** RF-5.
  - **Hecho cuando:** `head`, `meta`, `title`, `script`, `link`, `style`, `base`, `template` y `noscript` no aparecen en el árbol Figma.

- [x] **T61. Implementar la clasificación `FRAME`, `TEXT` e `IMAGE`.**
  - **RF:** RF-5.
  - **Hecho cuando:** los contenedores visuales son `FRAME`, los `img` y fondos renderizables son `IMAGE`, y solo ejecuciones de texto puro son `TEXT`.

- [x] **T62. Implementar el cálculo de `rect` y `relativeRect` en el mapeador Figma.**
  - **RF:** RF-5.
  - **Hecho cuando:** el nodo raíz omite `relativeRect`, los descendientes lo calculan respecto al área de contenido del padre representado y no se emiten valores no numéricos.

- [x] **T63. Implementar la determinación de visibilidad real.**
  - **RF:** RF-5.
  - **Hecho cuando:** se consideran `display`, `visibility`, `hidden`, opacidad, tamaño y `offsetParent` aplicable, sin ocultar falsamente raíz, SVG o elementos fijos con caja.

- [x] **T64. Implementar el filtrado de subárboles por `includeHidden`.**
  - **RF:** RF-1, RF-5.
  - **Hecho cuando:** con `false` se eliminan nodos invisibles y descendientes, y con `true` se conservan con `isVisible: false`.

- [x] **T65. Implementar runs `TEXT` hoja sin texto duplicado en contenedores.**
  - **RF:** RF-5.
  - **Hecho cuando:** un contenedor no tiene `characters` por texto descendiente y cada tramo de texto en orden DOM se emite como un nodo `TEXT` hoja.

- [x] **T66. Normalizar el estilo de cada run de texto.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** cada run incluye familia sin fallbacks, tamaño, peso, `lineHeight`, `letterSpacing`, `textAlign` y `textAutoResize` con los tipos establecidos por el plan.

- [x] **T67. Implementar el mapeo de Auto Layout y posicionamiento.**
  - **RF:** RF-5.
  - **Hecho cuando:** flex y grid emiten `layoutMode` y `gap` numéricos, mientras que nodos `absolute` o `sticky` incluyen `position` y `zIndex` cuando aplica.

- [x] **T68. Implementar la poda de estilos CSS no significativos.**
  - **RF:** RF-5.
  - **Hecho cuando:** el mapeador omite `auto`, `normal`, `none`, `0px` y `visible` salvo cuando cambien el resultado visual o sean exigidos por el contrato estructurado.

- [x] **T69. Implementar el parseo de rellenos, bordes, efectos y radios Figma.**
  - **RF:** RF-5.
  - **Hecho cuando:** colores perceptibles se normalizan a RGBA, sombras se convierten a `DROP_SHADOW`, radios se expresan numéricamente y ausencias no se representan como cadenas CSS.

- [x] **T70. Implementar el mapeo de `IMAGE` y SVG inline.**
  - **RF:** RF-5.
  - **Hecho cuando:** un `img` incluye `src`, dimensiones naturales y `objectFit`; fondos resueltos no inventan datos; y SVG inline incluye `svg` como cadena.

- [x] **T71. Actualizar el catálogo de colores y tipografías tras el filtrado.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** los catálogos solo contienen recursos perceptibles referenciados por nodos visibles incluidos, sin colores de alfa cero ni entradas de gradientes, imágenes, filtros o mezclas.

- [x] **T72. Implementar la colección global de assets tipográficos usados.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** `assets` agrupa familias y pesos de nodos visibles incluidos y añade URL solo cuando puede determinarse.

- [x] **T73. Integrar `includeHidden` en el caso de uso y la ruta Figma.**
  - **RF:** RF-1, RF-3, RF-4, RF-5.
  - **Hecho cuando:** `/v1/figma` entrega el árbol compacto con el filtrado solicitado y mantiene la traducción de errores sin resultados parciales.

- [x] **T74. Añadir pruebas unitarias de la transformación Figma compacta.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** las pruebas cubren tipos, geometría, visibilidad, exclusiones, runs, Auto Layout, pinturas, imágenes, SVG, assets y poda de catálogos.

- [x] **T75. Añadir pruebas de integración y extremo a extremo del nuevo contrato Figma.**
  - **RF:** RF-1, RF-2, RF-3, RF-4, RF-5.
  - **Hecho cuando:** las fixtures y solicitudes reales validan `includeHidden` por omisión y habilitado, el JSON compacto versionado y los errores 400 sin respuestas parciales.

- [x] **T76. Ejecutar la regresión final del contrato y de no persistencia.**
  - **RF:** RF-1, RF-2, RF-3, RF-4, RF-5.
  - **Hecho cuando:** `pnpm test` pasa, los ejemplos de ambos contratos v1 validan sus esquemas y la revisión confirma que no se añadieron almacenamiento ni dependencias no justificadas.

## Cierre de brechas de cumplimiento

- [x] **T77. Hacer inyectable la resolución de nombres en la política de URL pública.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** la política puede resolver un hostname mediante una abstracción basada en las APIs estándar de Node.js, conserva la comprobación de literales IPv4 e IPv6 y permite sustituir el resolvedor de DNS en pruebas sin añadir dependencias.

- [x] **T78. Rechazar en producción los hostnames que resuelven a direcciones no públicas.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** antes de cargar la URL inicial y cada destino de navegación principal se comprueban todas las direcciones resueltas; si cualquiera es loopback, privada, reservada o interna se devuelve `URL_NOT_PUBLIC` y no se carga el destino.

- [x] **T79. Probar la política DNS para URL inicial y destinos de navegación principal.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** las pruebas unitarias cubren hostnames que resuelven a IPv4 e IPv6 no públicas y a direcciones públicas, las de integración cubren un destino principal no público resuelto por DNS, y desarrollo continúa permitiendo esos destinos.

- [x] **T80. Versionar el contrato de extracción necesario para conservar ejecuciones de texto directo.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** antes de modificar la respuesta se actualizan la especificación versionada y el plan para definir una representación ordenada de nodos de texto directos y sus estilos calculados, sin romper el árbol de elementos ni inventar contenido.

- [x] **T81. Serializar las ejecuciones de texto directo en el orden del DOM.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** el extractor conserva cada nodo de texto renderizado que sea hijo directo de un elemento, con sus caracteres y estilos efectivos, e ignora texto no renderizado sin duplicarlo en el texto de sus contenedores.

- [x] **T82. Transformar texto directo y texto de elementos en nodos `TEXT` hoja.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** `/v1/figma` emite todas las ejecuciones de texto en orden DOM, incluidos casos como `Hello <em>world</em>`, no asigna `characters` a contenedores y normaliza el estilo de cada ejecución de forma independiente.

- [x] **T83. Añadir pruebas de texto directo, mixto y oculto.**
  - **RF:** RF-2, RF-3, RF-5.
  - **Hecho cuando:** las pruebas unitarias, de integración con Playwright y de extremo a extremo verifican que no se pierde ni se duplica texto directo, que los cambios de estilo producen ejecuciones ordenadas y que `includeHidden` aplica al subárbol correspondiente.

- [x] **T84. Versionar el contrato de imagen para fondos resolubles.**
  - **RF:** RF-5.
  - **Hecho cuando:** antes de cambiar la respuesta se actualizan la especificación versionada y el plan para permitir que un nodo `IMAGE` de fondo incluya fuente y ajuste resueltos sin exigir dimensiones naturales que no puedan determinarse.

- [x] **T85. Extraer y transformar las fuentes y ajustes de imágenes de fondo determinables.**
  - **RF:** RF-5.
  - **Hecho cuando:** una imagen de fondo con URL absoluta o resoluble y `background-size` conocido produce un nodo `IMAGE` con su fuente y ajuste; los valores ambiguos, múltiples o no resolubles se omiten sin inventar datos.

- [x] **T86. Conservar el marcado completo de los SVG inline en la extracción.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** la extracción conserva el marcado serializado del SVG inline, incluidos atributos y descendientes gráficos necesarios para recrearlo, sin convertirlo en una imagen basada en URL ni relajar la lista de atributos ordinarios de HTML.

- [x] **T87. Emitir y probar SVG inline e imágenes de fondo en el contrato Figma.**
  - **RF:** RF-5.
  - **Hecho cuando:** las pruebas verifican SVG con atributos gráficos como `d`, `fill`, `cx`, `cy` y `r`, fondos con URL y ajuste conocidos, y la omisión segura de datos no determinables.

- [x] **T88. Añadir fuentes `@font-face` determinables al documento de extracción.**
  - **RF:** RF-2, RF-3, RF-5.
  - **Hecho cuando:** el contrato y el serializador recogen, cuando sean accesibles, las familias, pesos y URL HTTP(S) resueltas de reglas `@font-face`, sin fallar ante hojas de estilo entre orígenes o reglas inaccesibles.

- [x] **T89. Asociar URLs de fuente detectadas a los assets Figma usados.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** `assets` agrupa solo familias y pesos de nodos `TEXT` visibles e incluidos, añade la URL de carga cuando corresponde a una fuente detectada y omite fuentes declaradas pero no usadas.

- [x] **T90. Probar la detección de URLs de fuentes y la poda de assets.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** fixtures y pruebas de transformación cubren una fuente accesible con URL, una fuente sin URL determinable y una fuente usada exclusivamente por nodos ocultos o excluidos.

- [x] **T91. Corregir los errores de tipos de la suite de pruebas.**
  - **RF:** RF-1, RF-2, RF-3, RF-4, RF-5.
  - **Hecho cuando:** las solicitudes de prueba de `CreateFigmaDocumentUseCase` incluyen `includeHidden` y `pnpm typecheck` termina sin errores.

- [x] **T92. Ejecutar la validación final de cumplimiento de la especificación.**
  - **RF:** RF-1, RF-2, RF-3, RF-4, RF-5.
  - **Hecho cuando:** `pnpm test` y `pnpm typecheck` pasan; las pruebas de extremo a extremo cubren las brechas corregidas; y una revisión requisito por requisito confirma que no quedan URL internas resolubles, texto perdido, fondos de imagen resolubles, SVG incompleto ni assets tipográficos determinables ausentes.

## Auto Layout, geometría y pinturas estructuradas

- [x] **T93. Añadir `grid-auto-flow` a la lista de propiedades visuales permitidas.**
  - **RF:** RF-2, RF-5.
  - **Hecho cuando:** la serialización raw incluye el valor computado serializable de `grid-auto-flow` y continúa omitiendo propiedades fuera de la lista cerrada.

- [x] **T94. Ampliar los tipos Figma para Auto Layout.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** los contratos tipados representan `layoutMode`, `itemSpacing`, `gap`, `padding`, `primaryAxisAlign`, `counterAxisAlign` y `layoutGrow` con los tipos y opcionalidad definidos en el plan.

- [x] **T95. Ampliar los tipos Figma para bordes por lado y sombras internas.**
  - **RF:** RF-5.
  - **Hecho cuando:** los contratos representan `strokeWeight` uniforme, `strokeWeights` y `strokes` por lado, además de efectos `DROP_SHADOW` e `INNER_SHADOW` con color, desplazamiento, radio y extensión numéricos.

- [x] **T96. Crear una fixture de Auto Layout flex con padding y separación efectiva.**
  - **RF:** RF-2, RF-3, RF-5.
  - **Hecho cuando:** la fixture contiene un contenedor flex horizontal y otro vertical con `gap`, padding físico, `justify-content`, `align-items` e hijo con `flex-grow` verificables.

- [ ] **T97. Crear una fixture de Auto Layout grid y casos sin equivalencia de alineación.**
  - **RF:** RF-2, RF-3, RF-5.
  - **Hecho cuando:** la fixture cubre `grid-auto-flow`, `row-gap` y `column-gap` distintos, `gap: normal`, dirección invertida y valores de alineación que deben omitirse.

- [ ] **T98. Crear una fixture de bordes, sombras y geometría relativa.**
  - **RF:** RF-2, RF-3, RF-5.
  - **Hecho cuando:** la fixture incluye borde uniforme, bordes distintos por lado, sombras externa e interna múltiples, un margen negativo y un nodo `sticky` bajo un padre con caja conocida.

- [ ] **T99. Corregir el cálculo de `relativeRect` mediante resta directa de rectángulos.**
  - **RF:** RF-5.
  - **Hecho cuando:** para cada nodo no raíz con padre representado, `x` e `y` se calculan únicamente como la diferencia de los orígenes de `rect`, y `width` y `height` se conservan sin reajustes.

- [ ] **T100. Probar `relativeRect` con margen negativo, `sticky` y caja cero.**
  - **RF:** RF-5.
  - **Hecho cuando:** las pruebas prueban la resta exacta en los tres casos y verifican que no se aplican ajustes adicionales de margen, padding ni posicionamiento.

- [ ] **T101. Implementar el mapeo de dirección flex a `layoutMode`.**
  - **RF:** RF-5.
  - **Hecho cuando:** `row` y `row-reverse` producen `HORIZONTAL`, `column` y `column-reverse` producen `VERTICAL`, y los nodos que no son flex ni grid omiten las propiedades de Auto Layout.

- [ ] **T102. Implementar la separación y el padding de Auto Layout para flex.**
  - **RF:** RF-5.
  - **Hecho cuando:** un contenedor flex emite `itemSpacing` y `gap` iguales según su eje principal, normaliza la separación no efectiva a `0` e incluye siempre los cuatro valores numéricos de `padding`.

- [ ] **T103. Implementar el mapeo de alineación de Auto Layout.**
  - **RF:** RF-5.
  - **Hecho cuando:** las equivalencias directas de `justify-content` y `align-items` producen los valores de eje definidos, mientras que `stretch`, `baseline`, `space-around`, `space-evenly` y otros valores inexactos omiten el campo correspondiente.

- [ ] **T104. Implementar `layoutGrow` para hijos en flujo de Auto Layout.**
  - **RF:** RF-5.
  - **Hecho cuando:** un hijo con `flex-grow` positivo emite su valor numérico y los hijos con crecimiento cero, `absolute` o `fixed` no reciben un crecimiento de flujo incorrecto.

- [ ] **T105. Implementar el mapeo de eje y separación de grid.**
  - **RF:** RF-5.
  - **Hecho cuando:** el mapeador determina el eje principal conforme a `grid-auto-flow` o las pistas, usa `column-gap` u `row-gap` según ese eje y normaliza `normal` a `0`.

- [ ] **T106. Añadir pruebas unitarias del mapeo de Auto Layout.**
  - **RF:** RF-3, RF-5.
  - **Hecho cuando:** las pruebas cubren flex, grid, ejes invertidos, separaciones distintas, padding parcial, alineaciones directas e inexactas, y `layoutGrow` dentro y fuera de flujo.

- [ ] **T107. Implementar el parseo de borde sólido uniforme.**
  - **RF:** RF-5.
  - **Hecho cuando:** un borde sólido perceptible e idéntico en sus cuatro lados emite una pintura `SOLID` RGBA normalizada y un `strokeWeight` numérico.

- [ ] **T108. Implementar la preservación de bordes sólidos distintos por lado.**
  - **RF:** RF-5.
  - **Hecho cuando:** colores o grosores distintos generan entradas de `strokes` identificadas por lado y `strokeWeights` sin colapsarlos a un único borde uniforme.

- [ ] **T109. Implementar el parseo de sombras CSS externas e internas.**
  - **RF:** RF-5.
  - **Hecho cuando:** cada sombra perceptible convertible conserva su orden y emite `DROP_SHADOW` o `INNER_SHADOW` con RGBA, `offset`, `radius` y `spread` numéricos.

- [ ] **T110. Añadir pruebas unitarias del parseador de bordes y efectos.**
  - **RF:** RF-5.
  - **Hecho cuando:** las pruebas cubren bordes uniformes y por lado, bordes transparentes, sombras múltiples internas y externas, y valores de desplazamiento, desenfoque o extensión cero.

- [ ] **T111. Validar por integración el contrato Figma ampliado.**
  - **RF:** RF-2, RF-3, RF-5.
  - **Hecho cuando:** una extracción Playwright de las nuevas fixtures y una solicitud a `/v1/figma` validan geometría relativa, Auto Layout, bordes y efectos contra el contrato versionado.

- [ ] **T112. Ejecutar la regresión final de los ajustes de Auto Layout y pinturas.**
  - **RF:** RF-1, RF-2, RF-3, RF-4, RF-5.
  - **Hecho cuando:** `pnpm test` y `pnpm typecheck` pasan, las rutas mantienen sus errores normalizados y la revisión confirma que no se añadieron persistencia ni dependencias sin justificar.
