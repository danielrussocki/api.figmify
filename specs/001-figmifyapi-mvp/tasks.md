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

- [ ] **T38. Añadir pruebas de extremo a extremo de respuestas satisfactorias.**
  - **RF:** RF-1, RF-2, RF-3.
  - **Hecho cuando:** solicitudes HTTP reales a ambas rutas devuelven los contratos JSON v1 con los valores predeterminados y configurados de viewport.

- [ ] **T39. Añadir pruebas de extremo a extremo de errores.**
  - **RF:** RF-1, RF-4.
  - **Hecho cuando:** las rutas devuelven 400, 422, 502 y 500 con el `code` esperado, mensajes en inglés y ninguna respuesta parcial.

- [ ] **T40. Añadir pruebas de regresión de contratos JSON.**
  - **RF:** RF-2, RF-3.
  - **Hecho cuando:** ejemplos representativos de extracción y Figma se validan contra los contratos versionados 1.0.

- [ ] **T41. Ejecutar la suite completa y verificar que no se persisten datos.**
  - **RF:** RF-1, RF-2, RF-3, RF-4.
  - **Hecho cuando:** `pnpm test` pasa y la revisión de la implementación confirma que no incorpora base de datos, caché, archivos de resultados ni colas persistentes.
  - **Nota:** `pnpm typecheck` tiene errores preexistentes en el contrato `UpstreamFailureError`; deben resolverse durante esta validación final.
