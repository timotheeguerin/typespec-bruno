import type { Type, Model, Scalar } from "@typespec/compiler";
import { generateSample } from "typespec-random-sample";

/**
 * Generate a TypeSpec value literal string from a Type.
 * Produces syntax like `#{ name: "Buddy", age: 3 }` for use in @opExample.
 */
export function generateValueLiteral(type: Type): string {
  const sample = generateSample(type);
  return toValueLiteral(sample, type);
}

function toValueLiteral(value: unknown, type?: Type): string {
  if (value === null || value === undefined) return '""';

  if (typeof value === "string") return `"${escapeString(value)}"`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "#[]";
    const items = value.map((v) => toValueLiteral(v));
    return `#[${items.join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "#{}";
    const props = entries.map(([k, v]) => `${k}: ${toValueLiteral(v)}`);
    return `#{${props.join(", ")}}`;
  }

  return `"${String(value)}"`;
}

function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Generate the full `@opExample(#{ parameters: #{ ... } })` decorator text
 * for an HTTP operation, including all parameters and body.
 */
export function generateOpExampleDecorator(
  params: { name: string; type: Type }[],
  body?: { name: string; type: Type },
): string {
  const paramEntries: string[] = [];

  for (const param of params) {
    const sample = generateSample(param.type);
    paramEntries.push(`${param.name}: ${toValueLiteral(sample, param.type)}`);
  }

  if (body) {
    const sample = generateSample(body.type);
    paramEntries.push(`${body.name}: ${toValueLiteral(sample, body.type)}`);
  }

  if (paramEntries.length === 0) {
    return `@opExample(#{ parameters: #{} })`;
  }

  return `@opExample(#{ parameters: #{${paramEntries.join(", ")}} })`;
}
