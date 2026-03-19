/**
 * Preserve user-managed sections when re-emitting YAML files.
 *
 * The emitter manages: info, http, docs
 * Users may add: runtime, settings — these are preserved.
 * Param values, header values, and body data may also be preserved.
 */

import { readFile } from "fs/promises";
import { resolve as resolveFsPath } from "path";
import { parse } from "yaml";
import type {
  RuntimeConfig,
  Settings,
  ParamEntry,
  HeaderEntry,
  BodyConfig,
  HttpConfig,
  FileEntry,
  OpenCollectionRequest,
} from "./types.js";

export interface PreservedSections {
  runtime?: RuntimeConfig;
  settings?: Settings;
  params?: ParamEntry[];
  headers?: HeaderEntry[];
  body?: BodyConfig;
}

/**
 * Read an existing .yml request file and extract user-managed sections.
 * Returns runtime, settings, and optionally HTTP values if present.
 */
export async function extractPreservedSections(
  filePath: string,
): Promise<PreservedSections> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return {};
  }

  try {
    const doc = parse(content);
    const preserved: PreservedSections = {};
    if (doc?.runtime) preserved.runtime = doc.runtime;
    if (doc?.settings) preserved.settings = doc.settings;
    if (doc?.http?.params) preserved.params = doc.http.params;
    if (doc?.http?.headers) preserved.headers = doc.http.headers;
    if (doc?.http?.body) preserved.body = doc.http.body;
    return preserved;
  } catch {
    return {};
  }
}

/**
 * Read existing files and attach preserved sections to generated entries.
 */
export async function attachPreservedSections(
  entries: FileEntry[],
  outputDir: string,
  preserveValues: boolean,
): Promise<void> {
  for (const entry of entries) {
    const filePath = resolveFsPath(outputDir, ...entry.segments);
    const preserved = await extractPreservedSections(filePath);
    if (preserved.runtime) entry.request.runtime = preserved.runtime;
    if (preserved.settings) entry.request.settings = preserved.settings;

    if (preserveValues) {
      mergePreservedValues(entry.request, preserved);
    }
  }
}

/** Merge user-edited values from preserved sections into the generated request. */
function mergePreservedValues(
  request: OpenCollectionRequest,
  preserved: PreservedSections,
): void {
  if (preserved.params && request.http.params) {
    mergeParamValues(request.http.params, preserved.params);
  }
  if (preserved.headers && request.http.headers) {
    mergeHeaderValues(request.http.headers, preserved.headers);
  }
  if (preserved.body && request.http.body) {
    mergeBodyData(request.http, preserved.body);
  }
}

/** Match params by name+type and copy over user-edited values. */
function mergeParamValues(
  generatedParams: ParamEntry[],
  existingParams: ParamEntry[],
): void {
  for (const param of generatedParams) {
    const match = existingParams.find(
      (p) => p.name === param.name && p.type === param.type,
    );
    if (match) {
      param.value = match.value;
    }
  }
}

/** Match headers by name and copy over user-edited values. */
function mergeHeaderValues(
  generatedHeaders: HeaderEntry[],
  existingHeaders: HeaderEntry[],
): void {
  for (const header of generatedHeaders) {
    const match = existingHeaders.find((h) => h.name === header.name);
    if (match) {
      header.value = match.value;
    }
  }
}

/** Preserve body data when the body type matches. */
function mergeBodyData(http: HttpConfig, existingBody: BodyConfig): void {
  if (http.body && http.body.type === existingBody.type) {
    http.body.data = existingBody.data;
  }
}
