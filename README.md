# Figmify API

API HTTP en TypeScript que renderiza una página web pública con Playwright y devuelve su estructura y estilos computados. Ofrece una salida sin transformar y otra adaptada para que un plugin de Figma pueda reconstruirla y reutilizar estilos de color y tipografía.

> **Estado del repositorio:** la lógica de extracción, transformación y rutas está implementada, pero la API **no se puede levantar ni desplegar todavía** desde esta revisión. `src/main.ts` solo contiene `export {}` y no hay módulo de *bootstrap* que cree Fastify, lance Chromium, registre las rutas ni ejecute `listen()`. Los comandos de esta guía para ejecutar el servidor y el despliegue deben aplicarse después de implementar ese ensamblaje.

## Capacidades previstas

| Endpoint | Resultado |
| --- | --- |
| `GET /v1/extract` | Documento de extracción `1.0`: árbol DOM, atributos seleccionados, recursos, texto, estilos computados, pseudoelementos y Shadow DOM abierto. |
| `GET /v1/figma` | Documento Figma propio `1.0`, con árbol transformado y catálogos deterministas de colores sólidos y tipografías reutilizables. |

Los endpoints aceptan los siguientes parámetros de consulta:

| Parámetro | Requerido | Valor |
| --- | --- | --- |
| `url` | Sí | URL absoluta pública `http` o `https`. |
| `width` | No | Entero entre `1` y `3840`; predeterminado `1920`. |
| `height` | No | Entero entre `1` y `3840`; predeterminado `1080`. |
| `deviceScaleFactor` | No | `1`, `2` o `3`; predeterminado `1`. |

En producción se rechazan `localhost` y direcciones IP no públicas. Las redirecciones del documento principal no están permitidas. Una extracción espera 30 segundos adicionales después de que la página emite `load`, por lo que no es una operación de baja latencia.

## Arquitectura

El código está dividido para evitar el acoplamiento entre HTTP, navegador y conversión Figma:

```text
src/
  http/          rutas, validación de consulta y manejo de errores
  application/   casos de uso que orquestan la extracción
  browser/       adaptador Playwright y serialización del DOM
  security/      política de URLs públicas
  contracts/     contratos versionados de extracción, Figma y errores
  figma/         transformación y catálogo de estilos reutilizables
```

No hay base de datos, caché ni persistencia intencionada de URLs, páginas o resultados.

## Requisitos locales

- Node.js compatible con las dependencias instaladas.
- [pnpm](https://pnpm.io/) `12.11.2` (versión fijada en `package.json`).
- Chromium administrado por Playwright.

## Instalación y verificación

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm test
pnpm build
```

En Linux, si faltan las bibliotecas del sistema para Chromium y el entorno permite instalar paquetes del sistema:

```bash
pnpm exec playwright install --with-deps chromium
```

El último comando requiere privilegios administrativos en la mayoría de distribuciones. En CI y contenedores es preferible usar una imagen que ya incluya las dependencias de Playwright o instalarlas durante la construcción de la imagen.

## Arranque local (pendiente de bootstrap)

Cuando exista el punto de entrada HTTP, el flujo esperado será:

```bash
pnpm dev
```

para desarrollo, y:

```bash
pnpm build
node dist/main.js
```

para ejecutar el artefacto compilado. El *bootstrap* pendiente debe, como mínimo:

1. Determinar el entorno de ejecución (`development` o `production`).
2. Lanzar Chromium mediante `playwright.chromium.launch()`.
3. Crear la instancia Fastify.
4. Construir `PlaywrightExtractor`, `ExtractDocumentUseCase` y `CreateFigmaDocumentUseCase`.
5. Registrar `registerExtractRoute`, `registerFigmaRoute` y `registerApplicationErrorHandler`.
6. Escuchar en `HOST` y `PORT`, usando `0.0.0.0` para un entorno contenerizado.
7. Cerrar ordenadamente Fastify y el navegador al recibir `SIGTERM` o `SIGINT`.

Hasta que se implemente lo anterior, `pnpm dev` termina sin abrir un puerto y `node dist/main.js` no sirve rutas.

Una vez implementado, una solicitud de ejemplo será:

```bash
curl --get 'http://localhost:3000/v1/extract' \
  --data-urlencode 'url=https://example.com/' \
  --data-urlencode 'width=1440' \
  --data-urlencode 'height=900' \
  --data-urlencode 'deviceScaleFactor=1'
```

Para la representación orientada a Figma, sustituya `/v1/extract` por `/v1/figma`.

Las respuestas de error usan el formato:

```json
{ "code": "INVALID_REQUEST", "message": "The width query parameter must be an integer between 1 and 3840." }
```

Los códigos previstos son `INVALID_REQUEST` (400), `URL_NOT_PUBLIC` (422), `REDIRECT_NOT_ALLOWED` (502), `UPSTREAM_FAILURE` (502) e `INTERNAL_ERROR` (500).

## Despliegue en producción (pendiente de bootstrap)

No hay `Dockerfile`, manifiestos de plataforma ni configuración CI/CD en el repositorio; por tanto, no existe un despliegue reproducible para ejecutar ahora. Cuando se implemente el punto de entrada, se recomienda desplegarlo como **servicio de contenedor persistente**, no como función *serverless*: cada solicitud abre un contexto de navegador y puede tardar al menos 30 segundos tras la carga de la página.

El servicio de destino debe cumplir estas condiciones:

1. Ejecutar `pnpm install --frozen-lockfile`, `pnpm build` y `pnpm exec playwright install --with-deps chromium` durante la construcción, o partir de una imagen compatible con Playwright.
2. Ejecutar `node dist/main.js` como comando de inicio.
3. Exponer el puerto configurado por `PORT` y enlazar el proceso a `0.0.0.0`.
4. Definir el entorno como `production` para activar el rechazo de destinos no públicos.
5. Conceder CPU y memoria suficientes para Chromium y permitir procesos secundarios. No usar un sistema de archivos persistente para resultados.
6. Configurar un periodo de apagado mayor que una extracción en curso y enviar `SIGTERM` para cerrar el navegador de forma ordenada.
7. Establecer límites de concurrencia, de duración de solicitud y de tamaño de respuesta acorde con la capacidad del navegador.

### Seguridad de red obligatoria

La API navega a URLs proporcionadas por clientes; debe quedar detrás de autenticación, cuota de uso y límites de concurrencia antes de exponerla a Internet. Además, aplique reglas de salida de red (*egress*) que impidan al contenedor acceder a redes privadas, metadatos del proveedor cloud y servicios internos.

La política actual bloquea `localhost` y literales IPv4/IPv6 no públicos en producción, pero no realiza una resolución DNS explícita antes de navegar. Las reglas de salida son por ello una defensa complementaria necesaria frente a dominios que resuelvan a IPs internas o cambien de resolución.

## Calidad

```bash
pnpm test
```

La suite usa Vitest e incluye pruebas unitarias, de integración con Playwright, extremo a extremo de rutas y regresión de contratos JSON. Las especificaciones versionadas del MVP están en [`specs/001-figmifyapi-mvp/`](specs/001-figmifyapi-mvp/).

## Limitaciones funcionales

- Solo se permiten páginas públicas HTTP/HTTPS.
- No se siguen redirecciones del documento principal.
- No se extrae el contenido de `iframe` ni de Shadow DOM cerrado.
- Los estilos recogidos pertenecen a una lista cerrada de propiedades visuales.
- Gradientes, imágenes, filtros y modos de mezcla no se convierten en estilos de color reutilizables de Figma.
- El contenido de origen puede cambiar entre solicitudes; no se persisten ni cachean resultados.
