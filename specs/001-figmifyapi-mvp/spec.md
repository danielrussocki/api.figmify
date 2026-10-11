# Especificación: MVP de extracción web para Figma

## Contexto y objetivo
Figmify API permite obtener la representación visual de una página web pública HTTP/HTTPS sin almacenar datos. El MVP ofrece una salida con las propiedades visuales computadas y otra adaptada al consumo de un plugin de Figma, para que este pueda recrear la página y definir estilos reutilizables de color y tipografía.

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

### RF-2. Extracción sin transformar
**Criterios de aceptación**
- Cuando la navegación principal complete el evento de carga y transcurran 30 segundos adicionales sin un error de carga, `/v1/extract` deberá devolver un JSON con el árbol del documento, la etiqueta de cada elemento, sus atributos visuales y semánticos, sus recursos asociados, su texto renderizado y sus propiedades visuales computadas.
- Cuando un elemento se incluya en la extracción, `/v1/extract` deberá asignarle un identificador interno único y preservar el orden del DOM entre sus elementos hijos.
- Cuando un elemento no contenga texto visible, el primer endpoint deberá representarlo sin inventar contenido textual.
- Cuando un elemento esté oculto mediante CSS o atributos HTML, el primer endpoint deberá incluirlo en el árbol de extracción.
- Cuando haya elementos en un Shadow DOM accesible, el primer endpoint deberá incluirlos respetando su relación con el árbol que los contiene.
- Cuando un elemento tenga los pseudoelementos `::before` o `::after`, el primer endpoint deberá incluir sus estilos y contenido calculables.
- Cuando una propiedad visual computada no tenga un valor textual serializable o no pueda determinarse, el primer endpoint deberá omitir esa propiedad.
- Cuando la página contenga un Shadow DOM cerrado, el primer endpoint deberá excluir su contenido y continuar con los elementos observables.

### RF-3. Extracción orientada a Figma
**Criterios de aceptación**
- Cuando la navegación principal complete el evento de carga y transcurran 30 segundos adicionales sin un error de carga, `/v1/figma` deberá devolver la misma información visual y estructural extraída por `/v1/extract` en un JSON apto para que un plugin de Figma lo interprete.
- Cuando la página se cargue sin errores, el segundo endpoint deberá usar un esquema JSON propio, estable y versionado para la integración con el plugin de Figma, definido en el plan de esta funcionalidad.
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

## Fuera de alcance
- Iframes y su contenido.
- URLs autenticadas o accesibles solo mediante una red privada en producción.
- Seguir o devolver el destino de una redirección de la navegación principal.
- Persistencia, historial, cuentas de usuario o autenticación.
- Crear, publicar o mantener el plugin de Figma.
- Capturas de pantalla, comparación visual o edición de la página origen.

## Criterios de finalización
- Ambos endpoints son solicitudes `GET` en `/v1/extract` y `/v1/figma`, y aceptan `url`, `width`, `height` y `deviceScaleFactor` mediante parámetros de consulta; la vista predeterminada es 1920 × 1080 con escala 1.
- El endpoint sin transformar entrega árbol, identificadores internos, orden DOM, etiqueta, atributos visuales y semánticos, recursos asociados, texto renderizado, propiedades visuales computadas, pseudoelementos y Shadow DOM accesible.
- El endpoint orientado a Figma entrega una representación consumible por el plugin, con colores y tipografías reutilizables.
- Las redirecciones de la navegación principal y los fallos de carga devuelven los estados, códigos y mensajes normalizados en inglés sin resultados parciales.
- Se han implementado y superan las pruebas automatizadas y de extremo a extremo requeridas.

## Dudas abiertas
No hay dudas abiertas para el MVP. La lista de propiedades visuales, los atributos y recursos permitidos, los contratos JSON versionados y el entorno de renderizado están definidos en `plan.md`.
