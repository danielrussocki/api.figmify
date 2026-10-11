# Constitución del proyecto
1. **Stack mínimo:** TypeScript, Node.js, Fastify y Playwright; toda dependencia debe justificar su necesidad.
2. **Spec primero:** cada endpoint tiene una especificación versionada; el código y los cambios deben cumplirla.
3. **Capas separadas:** HTTP, extracción Playwright y transformación para Figma no se importan entre sí directamente.
4. **Tests obligatorios:** toda lógica nueva o corregida incluye tests automatizados; las rutas se prueban de extremo a extremo.
5. **Sin persistencia por defecto:** la API no guarda páginas, estilos ni datos de usuarios; cualquier almacenamiento requiere una decisión explícita documentada.
6. **Idioma consistente:** código, nombres, logs, errores internos y respuestas de API en inglés; los archivos Markdown están en español.
