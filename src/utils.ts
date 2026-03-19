import type {
  Type,
  Model,
  Scalar,
  Enum,
  Union,
  ModelProperty,
} from "@typespec/compiler";
import type { BruHttpVerb } from "./bru/types.js";
import type { HttpVerb } from "@typespec/http";

/** Convert a string to kebab-case. */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/** Map TypeSpec HttpVerb to Bruno verb. */
export function toBruVerb(verb: HttpVerb): BruHttpVerb {
  return verb as BruHttpVerb;
}

/**
 * Convert a TypeSpec URI template path to a Bruno URL path.
 * Replaces `{param}` with `:param` and strips query template parts like `{?query}`.
 */
export function convertPath(uriTemplate: string): string {
  // Remove query template parts: {?foo,bar} or {&foo}
  let path = uriTemplate.replace(/\{[?&][^}]*\}/g, "");
  // Replace path params: {param} or {+param} → :param
  path = path.replace(/\{[+]?([^}]+)\}/g, ":$1");
  // Clean trailing slashes that may have been left
  path = path.replace(/\/+$/, "") || "/";
  return path;
}

/**
 * Generate an example JSON value from a TypeSpec Type.
 * Produces sensible placeholder values for use in Bruno request bodies.
 */
export function generateExampleValue(type: Type, depth: number = 0): unknown {
  if (depth > 5) return {};

  switch (type.kind) {
    case "Scalar":
      return scalarExample(type as Scalar);
    case "Model":
      return modelExample(type as Model, depth);
    case "Enum":
      return enumExample(type as Enum);
    case "Union":
      return unionExample(type as Union, depth);
    case "String":
      return (type as { value: string }).value;
    case "Number":
      return (type as { value: number }).value;
    case "Boolean":
      return (type as { value: boolean }).value;
    default:
      return {};
  }
}

function scalarExample(scalar: Scalar): unknown {
  const name = getScalarName(scalar);
  switch (name) {
    case "string":
    case "url":
    case "plainDate":
    case "plainTime":
      return "string";
    case "int8":
    case "int16":
    case "int32":
    case "int64":
    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
    case "integer":
    case "safeint":
    case "float":
    case "float32":
    case "float64":
    case "decimal":
    case "decimal128":
    case "numeric":
      return 0;
    case "boolean":
      return false;
    case "utcDateTime":
    case "offsetDateTime":
      return "2024-01-01T00:00:00Z";
    case "duration":
      return "PT1H";
    case "bytes":
      return "";
    default:
      return "string";
  }
}

/** Walk up the scalar base chain to find the root scalar name. */
function getScalarName(scalar: Scalar): string {
  let current: Scalar | undefined = scalar;
  while (current) {
    if (
      current.namespace?.name === "TypeSpec" ||
      !current.baseScalar
    ) {
      return current.name;
    }
    current = current.baseScalar;
  }
  return scalar.name;
}

function modelExample(model: Model, depth: number): unknown {
  // Check if it's an array (has an indexer with integer key)
  if (model.indexer) {
    const itemExample = generateExampleValue(model.indexer.value, depth + 1);
    return [itemExample];
  }

  // Check for Record<T> pattern (string indexer)
  if (model.indexer && model.properties.size === 0) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [name, prop] of model.properties) {
    result[name] = generateExampleValue(prop.type, depth + 1);
  }
  return result;
}

function enumExample(enumType: Enum): unknown {
  const members = [...enumType.members.values()];
  if (members.length === 0) return "";
  return members[0].value ?? members[0].name;
}

function unionExample(union: Union, depth: number): unknown {
  const variants = [...union.variants.values()];
  if (variants.length === 0) return {};
  // Pick the first non-null variant
  for (const variant of variants) {
    if (variant.type.kind !== "Intrinsic") {
      return generateExampleValue(variant.type, depth + 1);
    }
  }
  return generateExampleValue(variants[0].type, depth + 1);
}

/** Generate example values for each property of a model (for form bodies). */
export function generateFormFields(
  model: Model,
): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  for (const [name, prop] of model.properties) {
    const val = generateExampleValue(prop.type);
    fields.push({ key: name, value: String(val) });
  }
  return fields;
}
