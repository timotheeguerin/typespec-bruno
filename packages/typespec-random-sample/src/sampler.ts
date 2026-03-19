import type { Type, Scalar, Model, Enum, Union } from "@typespec/compiler";
import { hash } from "./hash.js";

export interface SampleOptions {
  /** Maximum depth for nested models (default: 5). */
  maxDepth?: number;
  /** Seed prefix for deterministic generation (default: ""). */
  seed?: string;
}

/**
 * Generate a deterministic sample value from a TypeSpec type.
 *
 * The output is reproducible: given the same type structure and seed,
 * the same sample is always produced. Property and type names are used
 * as implicit seeds so different properties get different but stable values.
 */
export function generateSample(
  type: Type,
  options?: SampleOptions,
): unknown {
  const maxDepth = options?.maxDepth ?? 5;
  const seed = options?.seed ?? "";
  return sample(type, seed, 0, maxDepth);
}

function sample(
  type: Type,
  seed: string,
  depth: number,
  maxDepth: number,
): unknown {
  if (depth > maxDepth) return {};

  switch (type.kind) {
    case "Scalar":
      return scalarSample(type as Scalar, seed);
    case "Model":
      return modelSample(type as Model, seed, depth, maxDepth);
    case "Enum":
      return enumSample(type as Enum, seed);
    case "Union":
      return unionSample(type as Union, seed, depth, maxDepth);
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

function scalarSample(scalar: Scalar, seed: string): unknown {
  const name = resolveScalarName(scalar);
  const h = hash(seed + ":" + scalar.name);

  switch (name) {
    case "string":
      return deterministicString(seed || scalar.name, h);
    case "url":
      return `https://example.com/${deterministicSlug(seed, h)}`;
    case "plainDate":
      return deterministicDate(h);
    case "plainTime":
      return deterministicTime(h);
    case "utcDateTime":
    case "offsetDateTime":
      return `${deterministicDate(h)}T${deterministicTime(h)}Z`;
    case "duration":
      return `PT${(h % 59) + 1}M`;
    case "int8":
      return ((h % 200) - 100);
    case "int16":
    case "int32":
    case "integer":
    case "safeint":
      return (h % 1000) + 1;
    case "int64":
      return (h % 10000) + 1;
    case "uint8":
      return h % 256;
    case "uint16":
    case "uint32":
    case "uint64":
      return (h % 1000) + 1;
    case "float":
    case "float32":
    case "float64":
    case "decimal":
    case "decimal128":
    case "numeric":
      return Math.round(((h % 10000) / 100) * 100) / 100;
    case "boolean":
      return h % 2 === 0;
    case "bytes":
      return "";
    default:
      return deterministicString(seed || scalar.name, h);
  }
}

function resolveScalarName(scalar: Scalar): string {
  let current: Scalar | undefined = scalar;
  while (current) {
    if (current.namespace?.name === "TypeSpec" || !current.baseScalar) {
      return current.name;
    }
    current = current.baseScalar;
  }
  return scalar.name;
}

function modelSample(
  model: Model,
  seed: string,
  depth: number,
  maxDepth: number,
): unknown {
  if (model.indexer) {
    const itemSeed = seed + "[]";
    return [sample(model.indexer.value, itemSeed, depth + 1, maxDepth)];
  }

  const result: Record<string, unknown> = {};
  for (const [name, prop] of model.properties) {
    const propSeed = seed ? `${seed}.${name}` : name;
    result[name] = sample(prop.type, propSeed, depth + 1, maxDepth);
  }
  return result;
}

function enumSample(enumType: Enum, seed: string): unknown {
  const members = [...enumType.members.values()];
  if (members.length === 0) return "";
  const h = hash(seed + ":" + enumType.name!);
  const index = h % members.length;
  return members[index].value ?? members[index].name;
}

function unionSample(
  union: Union,
  seed: string,
  depth: number,
  maxDepth: number,
): unknown {
  const variants = [...union.variants.values()];
  if (variants.length === 0) return {};
  // Prefer the first non-intrinsic variant
  for (const variant of variants) {
    if (variant.type.kind !== "Intrinsic") {
      return sample(variant.type, seed, depth + 1, maxDepth);
    }
  }
  return sample(variants[0].type, seed, depth + 1, maxDepth);
}

// ── Deterministic value helpers ─────────────────────────────────────

const SAMPLE_WORDS = [
  "alpha", "bravo", "charlie", "delta", "echo",
  "foxtrot", "golf", "hotel", "india", "juliet",
  "kilo", "lima", "mike", "november", "oscar",
  "papa", "quebec", "romeo", "sierra", "tango",
];

function deterministicString(seed: string, h: number): string {
  const slug = camelToWords(seed.split(".").pop() || "value");
  const word = SAMPLE_WORDS[h % SAMPLE_WORDS.length];
  return `${slug}_${word}`;
}

function deterministicSlug(seed: string, h: number): string {
  return SAMPLE_WORDS[h % SAMPLE_WORDS.length];
}

function deterministicDate(h: number): string {
  const year = 2020 + (h % 5);
  const month = (h % 12) + 1;
  const day = (h % 28) + 1;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function deterministicTime(h: number): string {
  const hour = h % 24;
  const minute = (h >> 3) % 60;
  return `${pad2(hour)}:${pad2(minute)}:00`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function camelToWords(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}
