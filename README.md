# Figmify API

API HTTP que renderiza páginas web públicas y transforma su información visual para integraciones con Figma. Ofrece una salida de extracción sin transformar y otra compacta, con nodos y estilos reutilizables orientados a un plugin de Figma.

> La API no persiste URLs, documentos, estilos extraídos ni datos de clientes.

## Resumen general

Figmify API recibe una URL pública HTTP(S), la carga con un navegador controlado y espera el evento `load` más 30 segundos. Después devuelve una de estas representaciones versionadas:

| Endpoint | Propósito |
| --- | --- |
| `GET /v1/extract` | Expone el árbol del documento con atributos permitidos, recursos, texto, estilos computados, pseudoelementos, layout y Shadow DOM abierto (`schemaVersion: "1.0"`). |
| `GET /v1/figma` | Convierte la extracción en un esquema propio para Figma, con nodos `FRAME`, `TEXT` e `IMAGE`, geometría, Auto Layout, pinturas, efectos y catálogos reutilizables (`schemaVersion: "1.1"`). |

La API está dirigida a:

- Desarrolladores de plugins de Figma que necesitan reconstruir una página web desde datos estructurados.
- Diseñadores y desarrolladores que desean inspeccionar estilos computados de sitios públicos.

Las respuestas y errores de la API se entregan en inglés. Esta documentación se mantiene en español.

Todas las respuestas de la API, incluidas las de error, envían `Access-Control-Allow-Origin: *`, por lo que un plugin de Figma u otro cliente web puede consumir los endpoints sin configurar un proxy CORS.

## Stack tecnológico

| Tecnología | Uso |
| --- | --- |
| Node.js + TypeScript (ESM) | Runtime y tipado de contratos compartidos. |
| Fastify | Servidor HTTP, rutas y manejo de errores. |
| Playwright / Chromium | Renderizado, navegación y lectura de DOM, estilos y geometría. |
| Vitest | Pruebas automatizadas. |
| pnpm | Gestor de dependencias. |

## Requisitos previos y dependencias

- Node.js compatible con las dependencias del proyecto.
- `pnpm` `12.11.2`, versión fijada en `package.json`.
- Chromium administrado por Playwright.

Las dependencias de producción son Fastify y Playwright. TypeScript, `tsx`, Vitest y los tipos de Node.js se usan para desarrollo, compilación y pruebas.

## Instalación y configuración

1. Instale las dependencias:

   ```bash
   pnpm install
   ```

2. Instale Chromium para Playwright:

   ```bash
   pnpm exec playwright install chromium
   ```

   En Linux, cuando falten bibliotecas de sistema para Chromium:

   ```bash
   pnpm exec playwright install --with-deps chromium
   ```

3. Inicie el servidor en modo desarrollo:

   ```bash
   pnpm dev
   ```

   Por defecto queda disponible en `http://127.0.0.1:3000`.

4. Opcionalmente, compile y ejecute la versión generada:

   ```bash
   pnpm build
   node dist/main.js
   ```

5. Verifique calidad y pruebas:

   ```bash
   pnpm typecheck
   pnpm test
   ```

## Variables de entorno

`HOST` y `PORT` son las únicas variables que configuran el listener HTTP. Su validación ocurre antes de abrir el puerto. `NODE_ENV` no configura el listener: solo determina la política de direcciones de destino.

| Variable | Predeterminado | Valor válido | Uso |
| --- | --- | --- | --- |
| `HOST` | `127.0.0.1` | Host o IP no vacía, sin espacios iniciales o finales. | Interfaz donde escucha el servidor. Use `0.0.0.0` en contenedores o para aceptar conexiones de red. |
| `PORT` | `3000` | Entero decimal sin signo entre `1` y `65535`. | Puerto del servidor. |
| `NODE_ENV` | — | `development` o cualquier otro valor. | Selecciona la política de URL: solo `development` permite destinos locales o privados; el resto aplica política de producción. No configura el listener. |

Si `HOST` o `PORT` son inválidos, el proceso registra `Invalid HOST configuration.` o `Invalid PORT configuration.`, termina con código distinto de cero y no abre un puerto.

Ejemplo para desarrollo con una URL local, en PowerShell:

```powershell
$env:NODE_ENV = 'development'
$env:HOST = '127.0.0.1'
$env:PORT = '3000'
pnpm dev
```

## Arquitectura y estructura de carpetas

La aplicación separa HTTP, extracción de navegador y transformación Figma. Los manejadores HTTP dependen de los casos de uso; Playwright implementa el puerto de extracción y el transformador Figma trabaja sobre el contrato extraído, sin depender del navegador ni de rutas HTTP.

```text
src/
  application/       Casos de uso de extracción y creación de documento Figma
  bootstrap/         Ensamblaje de Fastify, Playwright y dependencias
  browser/           Adaptador Playwright, serialización, layout y estilos visuales
  contracts/         Tipos de extracción, Figma, errores y puertos
  figma/             Transformación de nodos, pinturas, fuentes y catálogos
  http/              Rutas, esquemas de consulta, CORS y traductor de errores
  security/          Política de URLs públicas
  main.ts            Arranque y validación de HOST/PORT
test/
  unit/              Pruebas de lógica aislada
  integration/       Pruebas con navegador y fixtures
  e2e/               Pruebas de rutas HTTP
  fixtures/          Páginas locales usadas únicamente durante pruebas
specs/001-figmifyapi-mvp/
                    Especificación y plan técnico versionados del MVP
```

No existe base de datos, caché, cola ni almacenamiento de resultados.

## Guía de uso

Realice solicitudes `GET` e incluya la URL codificada como parámetro de consulta.

```bash
curl --get 'http://127.0.0.1:3000/v1/extract' \
  --data-urlencode 'url=https://example.com/' \
  --data-urlencode 'width=1440' \
  --data-urlencode 'height=900' \
  --data-urlencode 'deviceScaleFactor=1'
```

Para solicitar la salida destinada a Figma:

```bash
curl --get 'http://127.0.0.1:3000/v1/figma' \
  --data-urlencode 'url=https://example.com/' \
  --data-urlencode 'includeHidden=false'
```

Consideraciones de navegación:

- Solo se aceptan URLs absolutas `http` o `https`.
- En producción se rechazan destinos locales, privados, reservados o de red interna, incluida una navegación principal hacia ellos.
- No se permiten redirecciones HTTP, `meta refresh` ni navegación JavaScript del documento principal.
- Los recursos secundarios que fallen o se redirijan no bloquean por sí solos la extracción.
- No se atraviesan `iframe` ni Shadow DOM cerrado. Sí se serializa Shadow DOM abierto.
- Tras una navegación principal satisfactoria, espera `load` y 30 segundos antes de serializar. La API no define un límite total propio para la extracción; los límites operativos del navegador pueden terminar una navegación que no progrese.

### Entorno de renderizado reproducible

Además del viewport solicitado, cada extracción crea un contexto aislado de Chromium con valores fijos: locale `en-US`, zona horaria `UTC`, esquema claro, movimiento y contraste `no-preference`, y un user agent de escritorio Chromium. No hay parámetros para cambiar estos valores. `/v1/extract` devuelve los valores aplicables en `source.environment`; `/v1/figma` conserva la URL y el viewport de origen.

## Endpoints principales

### `GET /v1/extract`

Devuelve un `ExtractionDocument` con el árbol DOM sin transformar. Incluye elementos ocultos, mantiene el orden DOM de `children`, conserva atributos visuales o semánticos permitidos y referencias de recursos con URL absoluta. Los estilos tienen claves CSS en *kebab-case* y valores computados textuales de una lista visual cerrada.

| Parámetro | Obligatorio | Valor |
| --- | --- | --- |
| `url` | Sí | URL absoluta HTTP(S) pública. |
| `width` | No | Entero de `1` a `3840`; predeterminado `1920`. |
| `height` | No | Entero de `1` a `3840`; predeterminado `1080`. |
| `deviceScaleFactor` | No | `1`, `2` o `3`; predeterminado `1`. |

Los valores de opacidad fraccionaria se conservan como texto en `styles.opacity`, por ejemplo `"0.5"`. Las ejecuciones de texto directo pueden aparecer en `directTextRuns` para conservar su posición frente a hermanos de elemento.

### `GET /v1/figma`

Devuelve un `FigmaDocument` `1.1` compacto para su interpretación por un plugin; no es una respuesta nativa de la API de Figma. El árbol excluye etiquetas no renderizables o de metadatos y representa nodos aplicables como `FRAME`, `TEXT` o `IMAGE`.

Acepta los mismos parámetros de `/v1/extract` y añade:

| Parámetro | Obligatorio | Valor |
| --- | --- | --- |
| `includeHidden` | No | Literal `true` o `false`; predeterminado `false`. |

Con `includeHidden=false`, se eliminan los nodos no visibles y sus descendientes. Con `true`, se incluyen con `isVisible: false`. La visibilidad considera `display`, `visibility`, `hidden`, opacidad nula, caja sin tamaño y `offsetParent` cuando corresponde; no invalida indebidamente la raíz, SVG ni elementos `fixed` con caja renderizada.

La respuesta incluye geometría absoluta y relativa, estilos tipográficos normalizados, Auto Layout para flex/grid, rellenos, bordes, sombras, radios, imágenes, SVG inline y catálogos de colores y tipografías usados por nodos visibles incluidos. Los elementos de metadatos o no renderizables (`head`, `meta`, `title`, `script`, `link`, `style`, `base`, `template` y `noscript`) se excluyen. Las ejecuciones de texto directo se reconstruyen entre sus hermanos de elemento como nodos `TEXT` hoja; un contenedor no duplica el texto de sus descendientes.

Un elemento `img` se representa como `IMAGE`; cuando sus mediciones están disponibles conserva `src`, dimensiones naturales y `objectFit` en `image`. Sus pinturas usan `scaleMode` `FILL`, `FIT` o `CROP`, según `object-fit`. Un contenedor con una única URL absoluta determinable en `background-image` continúa siendo `FRAME`; su fondo se expresa en `fills` como una pintura `IMAGE`, por delante de cualquier relleno sólido, para no perder hijos ni propiedades de layout. Para ese fondo, la repetición produce `TILE`; `cover` produce `FILL`, `contain` `FIT` y los demás tamaños `CROP`. Fondos con varias imágenes, gradientes o URLs no determinables no generan pinturas de imagen.

### Errores

Los errores no incluyen resultados parciales y tienen este formato:

```json
{
  "code": "INVALID_REQUEST",
  "message": "The width query parameter must be an integer between 1 and 3840."
}
```

| Estado | Código | Situación |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | Parámetros ausentes, inválidos o fuera de rango; URL no absoluta o esquema no permitido. |
| `422` | `URL_NOT_PUBLIC` | URL inicial o destino de navegación principal no público en producción. |
| `502` | `REDIRECT_NOT_ALLOWED` | Redirección de la navegación principal. |
| `502` | `UPSTREAM_FAILURE` | DNS, red, certificado, respuesta de origen no satisfactoria o fallo de procesamiento. |
| `500` | `INTERNAL_ERROR` | Error interno no atribuible a la solicitud ni al sitio de origen. |

## Tipado de respuestas

Los contratos TypeScript están en `src/contracts/`. La extracción usa `schemaVersion: "1.0"` y el documento para Figma usa `schemaVersion: "1.1"`.

```ts
type DocumentRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
};

type ExtractionDocument = {
  schemaVersion: '1.0';
  source: {
    url: string;
    viewport: { width: number; height: number; deviceScaleFactor: 1 | 2 | 3 };
    environment: { locale: string; timezone: string; colorScheme: 'light'; reducedMotion: 'no-preference' };
  };
  fontFaceSources?: Array<{ family: string; weight: number; url: string }>;
  document: ExtractionNode;
};

type ExtractionNode = {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  resources: Array<{ kind: 'image' | 'media' | 'stylesheet'; url: string }>;
  text: string | null;
  layout?: {
    rect: DocumentRect;
    offsetParentId?: string;
    hasOffsetParent?: boolean;
    naturalWidth?: number;
    naturalHeight?: number;
    objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
  };
  styles: Record<string, string>;
  pseudoElements: { before: PseudoElement | null; after: PseudoElement | null };
  svg?: string;
  directTextRuns?: Array<{ characters: string; childNodeIndex: number; styles: Record<string, string> }>;
  children: ExtractionNode[];
  shadowChildren?: ExtractionNode[];
};
```

```ts
type FigmaDocument = {
  schemaVersion: '1.1';
  source: { url: string; viewport: { width: number; height: number; deviceScaleFactor: 1 | 2 | 3 } };
  styles: { colors: ColorStyle[]; typographies: TypographyStyle[] };
  assets: Array<{ family: string; weights: number[]; url?: string }>;
  document: FigmaNode;
};

type FigmaNode = {
  id: string;
  tag: string;
  type: 'FRAME' | 'TEXT' | 'IMAGE';
  rect: DocumentRect;
  relativeRect?: DocumentRect;
  isVisible: boolean;
  opacity?: number;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  gap?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  primaryAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlign?: 'MIN' | 'CENTER' | 'MAX';
  layoutGrow?: number;
  position?: 'absolute' | 'sticky';
  zIndex?: number;
  fills: Array<
    | { type: 'SOLID'; color: Rgba }
    | { type: 'IMAGE'; src: string; scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE' }
  >;
  strokes?: Array<{ type: 'SOLID'; color: Rgba; weight: number; side?: 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT' }>;
  strokeWeight?: number;
  strokeWeights?: { top: number; right: number; bottom: number; left: number };
  effects?: Array<{
    type: 'DROP_SHADOW' | 'INNER_SHADOW'; color: Rgba;
    offset: { x: number; y: number }; radius: number; spread: number;
  }>;
  cornerRadius?: number;
  cornerRadii?: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  characters?: string;
  styles?: {
    fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number;
    letterSpacing: number; textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    textAutoResize: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';
  };
  image?: { src: string; naturalWidth: number; naturalHeight: number; objectFit: string };
  svg?: string;
  children: FigmaNode[];
};

type Rgba = { r: number; g: number; b: number; a: number };
```

En `/v1/figma`, `rect` está en coordenadas del documento y `relativeRect` se calcula exclusivamente restando los orígenes de los rectángulos padre e hijo representados; el nodo raíz no incluye `relativeRect`. Los valores se expresan como números en píxeles CSS y una caja indeterminable se representa con ceros. Los colores sólidos usan canales RGBA normalizados de `0` a `1`. Los catálogos globales se generan después del filtrado, por lo que solo contienen recursos perceptibles usados por nodos visibles incluidos. `fills` siempre se emite: es `[]` cuando no existe un relleno perceptible; cuando hay varias pinturas se ordenan de primer plano a fondo.

Los catálogos son globales y deterministas: `styles.colors` deduplica colores sólidos RGBA y excluye apariencias producidas por imágenes, gradientes, filtros o mezcla; `styles.typographies` usa la combinación computada de familia, tamaño, peso, estilo, interlineado, espaciado y transformación. `assets` agrupa por familia los pesos usados por nodos `TEXT` visibles y, cuando se puede determinar desde una regla `@font-face` accesible, incluye una URL HTTP(S) de la fuente. Los nodos no llevan identificadores de catálogo: el consumidor relaciona los recursos por sus valores normalizados.

## Limitaciones

- No se realiza autenticación de URLs de origen ni se soportan páginas privadas en producción.
- No se siguen ni devuelven destinos de redirección de la navegación principal.
- No se crean, publican ni mantienen plugins de Figma.
- No se generan capturas, comparaciones visuales ni edición del sitio origen.
- El contenido público puede cambiar entre solicitudes; los resultados no se almacenan ni se cachean.
