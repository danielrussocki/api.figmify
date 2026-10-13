type JsonObject = Record<string, unknown>;

const FIGMA_NODE_TYPES = new Set(['FRAME', 'TEXT', 'IMAGE']);
const RESOURCE_KINDS = new Set(['image', 'media', 'stylesheet']);
const OBJECT_FITS = new Set(['fill', 'contain', 'cover', 'none', 'scale-down']);
const TEXT_ALIGNS = new Set(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']);
const TEXT_AUTO_RESIZES = new Set(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']);

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

  keys(document, '$', ['schemaVersion', 'source', 'styles', 'assets', 'document'], [], errors);
  literal(document.schemaVersion, '1.0', '$.schemaVersion', errors);
  validateFigmaSource(document.source, '$.source', errors);
  validateFigmaCatalog(document.styles, '$.styles', errors);
  fontAssets(document.assets, '$.assets', errors);
  validateFigmaNode(document.document, '$.document', errors, true);
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
  keys(node, path, ['id', 'tagName', 'attributes', 'resources', 'text', 'styles', 'pseudoElements', 'children'], ['layout', 'directTextRuns', 'shadowChildren'], errors);
  string(node.id, `${path}.id`, errors);
  string(node.tagName, `${path}.tagName`, errors);
  stringRecord(node.attributes, `${path}.attributes`, errors);
  resources(node.resources, `${path}.resources`, errors);
  nullableString(node.text, `${path}.text`, errors);
  if ('layout' in node) extractionLayout(node.layout, `${path}.layout`, errors);
  stringRecord(node.styles, `${path}.styles`, errors);
  pseudoElements(node.pseudoElements, `${path}.pseudoElements`, errors);
  if ('directTextRuns' in node) directTextRuns(node.directTextRuns, `${path}.directTextRuns`, errors);
  nested(node.children, `${path}.children`, errors, validateExtractionNode);
  if ('shadowChildren' in node) nested(node.shadowChildren, `${path}.shadowChildren`, errors, validateExtractionNode);
}

function directTextRuns(value: unknown, path: string, errors: string[]): void {
  array(value, path, errors, (run, runPath) => {
    const entry = object(run, runPath, errors);
    if (entry === undefined) return;
    keys(entry, runPath, ['characters', 'childNodeIndex', 'styles'], [], errors);
    string(entry.characters, `${runPath}.characters`, errors);
    number(entry.childNodeIndex, `${runPath}.childNodeIndex`, errors);
    stringRecord(entry.styles, `${runPath}.styles`, errors);
  });
}

function extractionLayout(value: unknown, path: string, errors: string[]): void {
  const layout = object(value, path, errors);
  if (layout === undefined) return;
  keys(layout, path, ['rect'], ['offsetParentId', 'hasOffsetParent', 'naturalWidth', 'naturalHeight', 'objectFit'], errors);
  rect(layout.rect, `${path}.rect`, errors);
  optionalString(layout, 'offsetParentId', path, errors);
  optionalBoolean(layout, 'hasOffsetParent', path, errors);
  optionalNumber(layout, 'naturalWidth', path, errors);
  optionalNumber(layout, 'naturalHeight', path, errors);
  if ('objectFit' in layout) enumValue(layout.objectFit, OBJECT_FITS, `${path}.objectFit`, errors);
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
    for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textTransform']) string(entry[key], `${typographyPath}.${key}`, errors);
  });
}

function fontAssets(value: unknown, path: string, errors: string[]): void {
  array(value, path, errors, (asset, assetPath) => {
    const entry = object(asset, assetPath, errors);
    if (entry === undefined) return;
    keys(entry, assetPath, ['family', 'weights'], ['url'], errors);
    string(entry.family, `${assetPath}.family`, errors);
    array(entry.weights, `${assetPath}.weights`, errors, (weight, weightPath) => number(weight, weightPath, errors));
    if ('url' in entry) url(entry.url, `${assetPath}.url`, errors);
  });
}

function validateFigmaNode(value: unknown, path: string, errors: string[], isRoot: boolean): void {
  const node = object(value, path, errors);
  if (node === undefined) return;
  keys(node, path, ['id', 'tag', 'type', 'rect', 'isVisible', 'children'], [
    'relativeRect', 'layoutMode', 'itemSpacing', 'gap', 'padding', 'primaryAxisAlign', 'counterAxisAlign', 'layoutGrow',
    'position', 'zIndex', 'fills', 'strokes', 'strokeWeight', 'strokeWeights', 'effects', 'cornerRadius', 'cornerRadii',
    'characters', 'styles', 'image', 'svg',
  ], errors);
  string(node.id, `${path}.id`, errors);
  string(node.tag, `${path}.tag`, errors);
  enumValue(node.type, FIGMA_NODE_TYPES, `${path}.type`, errors);
  rect(node.rect, `${path}.rect`, errors);
  boolean(node.isVisible, `${path}.isVisible`, errors);
  if (!isRoot && !('relativeRect' in node)) errors.push(`${path}.relativeRect is required.`);
  if ('relativeRect' in node) rect(node.relativeRect, `${path}.relativeRect`, errors);
  if ('layoutMode' in node) enumValue(node.layoutMode, new Set(['HORIZONTAL', 'VERTICAL']), `${path}.layoutMode`, errors);
  optionalNumber(node, 'itemSpacing', path, errors);
  optionalNumber(node, 'gap', path, errors);
  if ('padding' in node) padding(node.padding, `${path}.padding`, errors);
  if ('primaryAxisAlign' in node) enumValue(node.primaryAxisAlign, new Set(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']), `${path}.primaryAxisAlign`, errors);
  if ('counterAxisAlign' in node) enumValue(node.counterAxisAlign, new Set(['MIN', 'CENTER', 'MAX']), `${path}.counterAxisAlign`, errors);
  optionalNumber(node, 'layoutGrow', path, errors);
  if ('position' in node) enumValue(node.position, new Set(['absolute', 'sticky']), `${path}.position`, errors);
  optionalNumber(node, 'zIndex', path, errors);
  if ('fills' in node) paints(node.fills, `${path}.fills`, errors, false, true);
  if ('strokes' in node) paints(node.strokes, `${path}.strokes`, errors, true, false);
  optionalNumber(node, 'strokeWeight', path, errors);
  if ('strokeWeights' in node) strokeWeights(node.strokeWeights, `${path}.strokeWeights`, errors);
  if ('effects' in node) effects(node.effects, `${path}.effects`, errors);
  optionalNumber(node, 'cornerRadius', path, errors);
  if ('cornerRadii' in node) cornerRadii(node.cornerRadii, `${path}.cornerRadii`, errors);
  if ('characters' in node) string(node.characters, `${path}.characters`, errors);
  if ('styles' in node) textStyle(node.styles, `${path}.styles`, errors);
  if ('image' in node) image(node.image, `${path}.image`, errors);
  if ('svg' in node) string(node.svg, `${path}.svg`, errors);
  nested(node.children, `${path}.children`, errors, (child, childPath, childErrors) => validateFigmaNode(child, childPath, childErrors, false));
}

function rect(value: unknown, path: string, errors: string[]): void {
  const candidate = object(value, path, errors);
  if (candidate === undefined) return;
  keys(candidate, path, ['x', 'y', 'width', 'height', 'top', 'left'], [], errors);
  for (const key of ['x', 'y', 'width', 'height', 'top', 'left']) number(candidate[key], `${path}.${key}`, errors);
}

function paints(value: unknown, path: string, errors: string[], includesWeight: boolean, allowsImage: boolean): void {
  if (value === null) return;
  array(value, path, errors, (paint, paintPath) => {
    const entry = object(paint, paintPath, errors);
    if (entry === undefined) return;
    if (allowsImage && entry.type === 'IMAGE') {
      keys(entry, paintPath, ['type', 'src', 'scaleMode'], [], errors);
      url(entry.src, `${paintPath}.src`, errors);
      literal(entry.scaleMode, 'FILL', `${paintPath}.scaleMode`, errors);
      return;
    }

    keys(entry, paintPath, includesWeight ? ['type', 'color', 'weight'] : ['type', 'color'], includesWeight ? ['side'] : [], errors);
    literal(entry.type, 'SOLID', `${paintPath}.type`, errors);
    rgba(entry.color, `${paintPath}.color`, errors);
    if (includesWeight) number(entry.weight, `${paintPath}.weight`, errors);
    if (includesWeight && 'side' in entry) enumValue(entry.side, new Set(['TOP', 'RIGHT', 'BOTTOM', 'LEFT']), `${paintPath}.side`, errors);
  });
}

function effects(value: unknown, path: string, errors: string[]): void {
  if (value === null) return;
  array(value, path, errors, (effect, effectPath) => {
    const entry = object(effect, effectPath, errors);
    if (entry === undefined) return;
    keys(entry, effectPath, ['type', 'color', 'offset', 'radius', 'spread'], [], errors);
    enumValue(entry.type, new Set(['DROP_SHADOW', 'INNER_SHADOW']), `${effectPath}.type`, errors);
    rgba(entry.color, `${effectPath}.color`, errors);
    const offset = object(entry.offset, `${effectPath}.offset`, errors);
    if (offset !== undefined) {
      keys(offset, `${effectPath}.offset`, ['x', 'y'], [], errors);
      number(offset.x, `${effectPath}.offset.x`, errors);
      number(offset.y, `${effectPath}.offset.y`, errors);
    }
    number(entry.radius, `${effectPath}.radius`, errors);
    number(entry.spread, `${effectPath}.spread`, errors);
  });
}

function padding(value: unknown, path: string, errors: string[]): void {
  const candidate = object(value, path, errors);
  if (candidate === undefined) return;
  keys(candidate, path, ['top', 'right', 'bottom', 'left'], [], errors);
  for (const key of ['top', 'right', 'bottom', 'left']) number(candidate[key], `${path}.${key}`, errors);
}

function strokeWeights(value: unknown, path: string, errors: string[]): void {
  const candidate = object(value, path, errors);
  if (candidate === undefined) return;
  keys(candidate, path, ['top', 'right', 'bottom', 'left'], [], errors);
  for (const key of ['top', 'right', 'bottom', 'left']) number(candidate[key], `${path}.${key}`, errors);
}

function cornerRadii(value: unknown, path: string, errors: string[]): void {
  const candidate = object(value, path, errors);
  if (candidate === undefined) return;
  keys(candidate, path, ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'], [], errors);
  for (const key of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) number(candidate[key], `${path}.${key}`, errors);
}

function textStyle(value: unknown, path: string, errors: string[]): void {
  const style = object(value, path, errors);
  if (style === undefined) return;
  keys(style, path, ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'textAutoResize'], [], errors);
  string(style.fontFamily, `${path}.fontFamily`, errors);
  for (const key of ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) number(style[key], `${path}.${key}`, errors);
  enumValue(style.textAlign, TEXT_ALIGNS, `${path}.textAlign`, errors);
  enumValue(style.textAutoResize, TEXT_AUTO_RESIZES, `${path}.textAutoResize`, errors);
}

function image(value: unknown, path: string, errors: string[]): void {
  const data = object(value, path, errors);
  if (data === undefined) return;

  if ('backgroundSize' in data) {
    keys(data, path, ['src', 'backgroundSize'], [], errors);
    url(data.src, `${path}.src`, errors);
    string(data.backgroundSize, `${path}.backgroundSize`, errors);
    return;
  }

  keys(data, path, ['src', 'naturalWidth', 'naturalHeight', 'objectFit'], [], errors);
  url(data.src, `${path}.src`, errors);
  number(data.naturalWidth, `${path}.naturalWidth`, errors);
  number(data.naturalHeight, `${path}.naturalHeight`, errors);
  string(data.objectFit, `${path}.objectFit`, errors);
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

function stringRecord(value: unknown, path: string, errors: string[]): void {
  const record = object(value, path, errors);
  if (record === undefined) return;
  for (const [key, entry] of Object.entries(record)) string(entry, `${path}.${key}`, errors);
}

function rgba(value: unknown, path: string, errors: string[]): void {
  const color = object(value, path, errors);
  if (color === undefined) return;
  keys(color, path, ['r', 'g', 'b', 'a'], [], errors);
  for (const key of ['r', 'g', 'b', 'a']) number(color[key], `${path}.${key}`, errors);
}

function viewport(value: unknown, path: string, errors: string[]): void {
  const candidate = object(value, path, errors);
  if (candidate === undefined) return;
  keys(candidate, path, ['width', 'height', 'deviceScaleFactor'], [], errors);
  positiveInteger(candidate.width, `${path}.width`, errors);
  positiveInteger(candidate.height, `${path}.height`, errors);
  if (candidate.deviceScaleFactor !== 1 && candidate.deviceScaleFactor !== 2 && candidate.deviceScaleFactor !== 3) errors.push(`${path}.deviceScaleFactor must be 1, 2, or 3.`);
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

function nested(value: unknown, path: string, errors: string[], validate: (entry: unknown, path: string, errors: string[]) => void): void {
  array(value, path, errors, (entry, entryPath) => validate(entry, entryPath, errors));
}

function keys(value: JsonObject, path: string, required: string[], optional: string[], errors: string[]): void {
  for (const key of required) if (!(key in value)) errors.push(`${path}.${key} is required.`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) errors.push(`${path}.${key} is not allowed.`);
}

function string(value: unknown, path: string, errors: string[]): void { if (typeof value !== 'string') errors.push(`${path} must be a string.`); }
function boolean(value: unknown, path: string, errors: string[]): void { if (typeof value !== 'boolean') errors.push(`${path} must be a boolean.`); }
function nullableString(value: unknown, path: string, errors: string[]): void { if (value !== null) string(value, path, errors); }
function number(value: unknown, path: string, errors: string[]): void { if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${path} must be a finite number.`); }
function positiveInteger(value: unknown, path: string, errors: string[]): void { if (!Number.isInteger(value) || typeof value !== 'number' || value < 1) errors.push(`${path} must be a positive integer.`); }
function literal(value: unknown, expected: string, path: string, errors: string[]): void { if (value !== expected) errors.push(`${path} must be ${expected}.`); }
function enumValue(value: unknown, allowed: ReadonlySet<string>, path: string, errors: string[]): void { if (typeof value !== 'string' || !allowed.has(value)) errors.push(`${path} has an invalid value.`); }
function prefixedString(value: unknown, prefix: string, path: string, errors: string[]): void { if (typeof value !== 'string' || !value.startsWith(prefix)) errors.push(`${path} must start with ${prefix}.`); }
function optionalString(value: JsonObject, key: string, path: string, errors: string[]): void { if (key in value) string(value[key], `${path}.${key}`, errors); }
function optionalBoolean(value: JsonObject, key: string, path: string, errors: string[]): void { if (key in value) boolean(value[key], `${path}.${key}`, errors); }
function optionalNumber(value: JsonObject, key: string, path: string, errors: string[]): void { if (key in value) number(value[key], `${path}.${key}`, errors); }

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
