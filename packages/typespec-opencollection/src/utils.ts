import type {
  Type,
  Scalar,
  Model,
  Enum,
  Union,
} from "@typespec/compiler";

/** Convert a string to kebab-case. */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Convert a TypeSpec URI template to an OpenCollection URL path.
 * Replaces `{param}` with `:param` and strips query template parts.
 */
export function convertPath(uriTemplate: string): string {
  let path = uriTemplate.replace(/\{[?&][^}]*\}/g, "");
  path = path.replace(/\{[+]?([^}]+)\}/g, ":$1");
  path = path.replace(/\/+$/, "") || "/";
  return path;
}
