/**
 * Preserve user-managed sections when re-emitting YAML files.
 *
 * The emitter manages: info, http, docs
 * Users may add in Bruno: runtime, settings — these are preserved.
 * Param values, header values, and body data may also be preserved.
 */

import { readFile } from "fs/promises";
import { parse } from "yaml";
import type { RuntimeConfig, Settings, ParamEntry, HeaderEntry, BodyConfig } from "./types.js";

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
