# AGENTS.md - figmify-api

## Proyecto
API en TypeScript que extrae estilos computados de páginas web públicas mediante Playwright.
Expone un endpoint de JSON sin transformar y otro orientado a Figma. Usa Fastify para
HTTP, separa la extracción del navegador de la transformación para Figma y no persiste datos.

## Comandos
- Instalar dependencias: `pnpm install`
- Tests: `pnpm test`

## Estilo
- TypeScript sobre Node.js con módulos ESM.
- Usa Fastify y Playwright; justifica cada dependencia adicional.
- Mantén identificadores, código, logs y errores internos en inglés.
- Mantén las respuestas de API en inglés y los archivos Markdown en español.

## Reglas
- Lee `docs/constitution.md` y la especificación activa en `specs/` antes de cambiar código.
- Actualiza la especificación versionada del endpoint antes de cambiar su comportamiento o la forma del JSON.
- No acoples directamente los manejadores HTTP, la extracción con Playwright y la transformación para Figma.
- No añadas persistencia de datos salvo que esté explícitamente documentada y aprobada.
- No modifiques archivos dentro de `specs/` salvo petición explícita.

## Al terminar cualquier tarea
- Ejecuta `pnpm test` y confirma el resultado en tu respuesta.
