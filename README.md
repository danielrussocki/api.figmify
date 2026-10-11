# Figmify API

API HTTP en TypeScript que renderiza una página web pública con Playwright y devuelve su estructura y estilos computados. Ofrece una salida sin transformar y otra adaptada para que un plugin de Figma pueda reconstruirla y reutilizar estilos de color y tipografía.

> **Estado del repositorio:** la API es ejecutable. El punto de entrada crea Fastify y Chromium, registra las dos rutas y cierra ambos recursos de forma ordenada ante `SIGINT` o `SIGTERM`.

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
  bootstrap/     ensamblaje de Fastify, casos de uso y Chromium
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

## Arranque local

Inicie el servidor de desarrollo con:

```bash
pnpm dev
```

Por defecto escucha únicamente en `http://127.0.0.1:3000`. El proceso lanza Chromium al arrancar y lo cierra al terminar.

Para probar URLs locales o privadas durante el desarrollo, establezca `NODE_ENV=development`; en ese modo se permite la navegación a esos destinos. En PowerShell:

```powershell
$env:NODE_ENV = 'development'
pnpm dev
```

En macOS o Linux:

```bash
NODE_ENV=development pnpm dev
```

Para ejecutar la versión compilada:

```bash
pnpm build
node dist/main.js
```

### Configuración del listener

`HOST` y `PORT` son las únicas variables que configuran el listener HTTP:

| Variable | Predeterminado | Restricción |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Nombre de host o IP sin espacios exteriores. |
| `PORT` | `3000` | Entero decimal entre `1` y `65535`. |

Una configuración inválida termina el proceso sin abrir un puerto. `NODE_ENV` no configura el listener: solo selecciona la política de URLs. Cualquier valor distinto de `development` aplica la política de producción.

Una solicitud de ejemplo es:

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

## Despliegue en producción

No hay `Dockerfile`, manifiestos de plataforma ni configuración CI/CD en el repositorio. Aun así, puede desplegarse en cualquier plataforma que ejecute servicios Node.js o contenedores y permita Chromium. Se recomienda un **servicio de contenedor persistente**, no una función *serverless*: cada solicitud abre un contexto de navegador y puede tardar al menos 30 segundos después de la carga de la página.

Configure en la plataforma:

| Ajuste | Valor |
| --- | --- |
| Comando de construcción | `pnpm install --frozen-lockfile && pnpm build` |
| Instalación de navegador | `pnpm exec playwright install --with-deps chromium` durante la imagen, o imagen base compatible con Playwright |
| Comando de inicio | `node dist/main.js` |
| `HOST` | `0.0.0.0` |
| `PORT` | Puerto asignado por la plataforma, por ejemplo `8080` |
| `NODE_ENV` | `production` |

El entorno debe permitir procesos secundarios y disponer de CPU y memoria suficientes para Chromium. Establezca un periodo de apagado superior a una extracción en curso; el proceso atiende `SIGTERM` y cierra Fastify y el navegador. Configure también límites de concurrencia, duración de solicitud y tamaño de respuesta apropiados para la capacidad disponible.

No se expone una ruta de salud dedicada. Mientras no exista, configure una comprobación TCP sobre el puerto o una comprobación HTTP a `/v1/extract` sin `url`, que debe responder `400` cuando la aplicación está disponible.

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
