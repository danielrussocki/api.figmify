type JsonObject = Record<string, unknown>;

const FIGMA_NODE_TYPES = new Set(['DOCUMENT', 'FRAME', 'TEXT', 'IMAGE', 'VECTOR', 'RECTANGLE']);
const RESOURCE_KINDS = new Set(['image', 'media', 'stylesheet']);

export function validateExtractionDocumentV1(value: unknown): string[] {
  const errors: string[] = [];
  const document = object(value, '$', errors);
  if (document === undefined) return errors;

  keys(document, '$', ['schemaVersion', 'source', 'document'], [], errors);
  literal(document.schemaVersion, '1.0', '$.schemaVersion', errors);
  validateExtractionSource(document.source, '$.source', errors);
  validateExtractionNode(document.document, '$.document', errors);
  return errors;
}

export function validateFigmaDocumentV1(value: unknown): string[] {
  const errors: string[] = [];
  const document = object(value, '$', errors);
  if (document === undefined) return errors;

  keys(document, '$', ['schemaVersion', 'source', 'styles', 'document'], [], errors);
  literal(document.schemaVersion, '1.0', '$.schemaVersion', errors);
  validateFigmaSource(document.source, '$.source', errors);
  validateFigmaCatalog(document.styles, '$.styles', errors);
  validateFigmaNode(document.document, '$.document', errors);
  return errors;
}

function validateExtractionSource(value: unknown, path: string, errors: string[]): void {
  const source = object(value, path, errors);
  if (source === undefined) return;
  keys(source, path, ['url', 'viewport', 'environment'], [], errors);
  url(source.url, `${path}.url`, errors);
  viewport(source.viewport, `${path}.viewport`, errors);

  const environment = object(source.environment, `${path}.environment`, errors);
  if (environment === undefined) return;
  keys(environment, `${path}.environment`, ['locale', 'timezone', 'colorScheme', 'reducedMotion'], [], errors);
  string(environment.locale, `${path}.environment.locale`, errors);
  string(environment.timezone, `${path}.environment.timezone`, errors);
  literal(environment.colorScheme, 'light', `${path}.environment.colorScheme`, errors);
  literal(environment.reducedMotion, 'no-preference', `${path}.environment.reducedMotion`, errors);
}

function validateFigmaSource(value: unknown, path: string, errors: string[]): void {
  const source = object(value, path, errors);
  if (source === undefined) return;
  keys(source, path, ['url', 'viewport'], [], errors);
  url(source.url, `${path}.url`, errors);
  viewport(source.viewport, `${path}.viewport`, errors);
}

function validateExtractionNode(value: unknown, path: string, errors: string[]): void {
  const node = object(value, path, errors);
  if (node === undefined) return;
  keys(node, path, ['id', 'tagName', 'attributes', 'resources', 'text', 'styles', 'pseudoElements', 'children'], ['shadowChildren'], errors);
  string(node.id, `${path}.id`, errors);
  string(node.tagName, `${path}.tagName`, errors);
  stringRecord(node.attributes, `${path}.attributes`, errors);
  resources(node.resources, `${path}.resources`, errors);
  nullableString(node.text, `${path}.text`, errors);
  stringRecord(node.styles, `${path}.styles`, errors);
  pseudoElements(node.pseudoElements, `${path}.pseudoElements`, errors);
  nested(node.children, `${path}.children`, errors, validateExtractionNode);
  if ('shadowChildren' in node) nested(node.shadowChildren, `${path}.shadowChildren`, errors, validateExtractionNode);
}

function validateFigmaCatalog(value: unknown, path: string, errors: string[]): void {
  const catalog = object(value, path, errors);
  if (catalog === undefined) return;
  keys(catalog, path, ['colors', 'typographies'], [], errors);
  array(catalog.colors, `${path}.colors`, errors, (color, colorPath) => {
    const entry = object(color, colorPath, errors);
    if (entry === undefined) return;
    keys(entry, colorPath, ['id', 'name', 'rgba'], [], errors);
    prefixedString(entry.id, 'color-', `${colorPath}.id`, errors);
    string(entry.name, `${colorPath}.name`, errors);
    rgba(entry.rgba, `${colorPath}.rgba`, errors);
  });
  array(catalog.typographies, `${path}.typographies`, errors, (typography, typographyPath) => {
    const entry = object(typography, typographyPath, errors);
    if (entry === undefined) return;
    keys(entry, typographyPath, ['id', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textTransform'], [], errors);
    prefixedString(entry.id, 'type-', `${typographyPath}.id`, errors);
    for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textTransform']) {
      string(entry[key], `${typographyPath}.${key}`, errors);
    }
  });
}

function validateFigmaNode(value: unknown, path: string, errors: string[]): void {
  const node = object(value, path, errors);
  if (node === undefined) return;
  keys(node, path, ['sourceId', 'type', 'name', 'attributes', 'resources', 'styles', 'children'], ['characters', 'fillStyleId', 'textStyleId'], errors);
  string(node.sourceId, `${path}.sourceId`, errors);
  enumValue(node.type, FIGMA_NODE_TYPES, `${path}.type`, errors);
  string(node.name, `${path}.name`, errors);
  if ('characters' in node) string(node.characters, `${path}.characters`, errors);
  stringRecord(node.attributes, `${path}.attributes`, errors);
  resources(node.resources, `${path}.resources`, errors);
  figmaStyleRecord(node.styles, `${path}.styles`, errors);
  if ('fillStyleId' in node) prefixedString(node.fillStyleId, 'color-', `${path}.fillStyleId`, errors);
  if ('textStyleId' in node) prefixedString(node.textStyleId, 'type-', `${path}.textStyleId`, errors);
  nested(node.children, `${path}.children`, errors, validateFigmaNode);
}

function viewport(value: unknown, path: string, errors: string[]): void {
  const candidate = object(value, path, errors);
  if (candidate === undefined) return;
  keys(candidate, path, ['width', 'height', 'deviceScaleFactor'], [], errors);
  positiveInteger(candidate.width, `${path}.width`, errors);
  positiveInteger(candidate.height, `${path}.height`, errors);
  if (candidate.deviceScaleFactor !== 1 && candidate.deviceScaleFactor !== 2 && candidate.deviceScaleFactor !== 3) {
    errors.push(`${path}.deviceScaleFactor must be 1, 2, or 3.`);
  }
}

function pseudoElements(value: unknown, path: string, errors: string[]): void {
  const candidate = object(value, path, errors);
  if (candidate === undefined) return;
  keys(candidate, path, ['before', 'after'], [], errors);
  for (const key of ['before', 'after']) {
    const pseudo = candidate[key];
    if (pseudo === null) continue;
    const entry = object(pseudo, `${path}.${key}`, errors);
    if (entry === undefined) continue;
    keys(entry, `${path}.${key}`, ['content', 'styles'], [], errors);
    nullableString(entry.content, `${path}.${key}.content`, errors);
    stringRecord(entry.styles, `${path}.${key}.styles`, errors);
  }
}

function resources(value: unknown, path: string, errors: string[]): void {
  array(value, path, errors, (resource, resourcePath) => {
    const entry = object(resource, resourcePath, errors);
    if (entry === undefined) return;
    keys(entry, resourcePath, ['kind', 'url'], [], errors);
    enumValue(entry.kind, RESOURCE_KINDS, `${resourcePath}.kind`, errors);
    url(entry.url, `${resourcePath}.url`, errors);
  });
}

function figmaStyleRecord(value: unknown, path: string, errors: string[]): void {
  const styles = object(value, path, errors);
  if (styles === undefined) return;
  for (const [key, style] of Object.entries(styles)) {
    if (typeof style === 'string' || typeof style === 'number' || typeof style === 'boolean') continue;
    rgba(style, `${path}.${key}`, errors);
  }
}

function stringRecord(value: unknown, path: string, errors: string[]): void {
  const record = object(value, path, errors);
  if (record === undefined) return;
  for (const [key, entry] of Object.entries(record)) string(entry, `${path}.${key}`, errors);
}

function nested(value: unknown, path: string, errors: string[], validate: (entry: unknown, path: string, errors: string[]) => void): void {
  array(value, path, errors, (entry, entryPath) => validate(entry, entryPath, errors));
}

function rgba(value: unknown, path: string, errors: string[]): void {
  const color = object(value, path, errors);
  if (color === undefined) return;
  keys(color, path, ['r', 'g', 'b', 'a'], [], errors);
  for (const key of ['r', 'g', 'b', 'a']) number(color[key], `${path}.${key}`, errors);
}

function object(value: unknown, path: string, errors: string[]): JsonObject | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as JsonObject;
  errors.push(`${path} must be an object.`);
  return undefined;
}

function array(value: unknown, path: string, errors: string[], validate: (entry: unknown, path: string) => void): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return;
  }
  value.forEach((entry, index) => validate(entry, `${path}[${index}]`));
}

function keys(value: JsonObject, path: string, required: string[], optional: string[], errors: string[]): void {
  for (const key of required) if (!(key in value)) errors.push(`${path}.${key} is required.`);
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) errors.push(`${path}.${key} is not allowed.`);
  }
}

function string(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'string') errors.push(`${path} must be a string.`);
}

function nullableString(value: unknown, path: string, errors: string[]): void {
  if (value !== null) string(value, path, errors);
}

function number(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${path} must be a finite number.`);
}

function positiveInteger(value: unknown, path: string, errors: string[]): void {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1) errors.push(`${path} must be a positive integer.`);
}

function literal(value: unknown, expected: string, path: string, errors: string[]): void {
  if (value !== expected) errors.push(`${path} must be ${expected}.`);
}

function enumValue(value: unknown, allowed: ReadonlySet<string>, path: string, errors: string[]): void {
  if (typeof value !== 'string' || !allowed.has(value)) errors.push(`${path} has an invalid value.`);
}

function prefixedString(value: unknown, prefix: string, path: string, errors: string[]): void {
  if (typeof value !== 'string' || !value.startsWith(prefix)) errors.push(`${path} must start with ${prefix}.`);
}

function url(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'string') {
    errors.push(`${path} must be an absolute HTTP or HTTPS URL.`);
    return;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') errors.push(`${path} must be an absolute HTTP or HTTPS URL.`);
  } catch {
    errors.push(`${path} must be an absolute HTTP or HTTPS URL.`);
  }
}
