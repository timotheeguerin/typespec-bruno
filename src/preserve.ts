/**
 * Preserve user-managed sections when re-emitting YAML files.
 *
 * The emitter manages: info, http, docs
 * Users may add in Bruno: runtime, settings — these are preserved.
 */

import { readFile } from "fs/promises";
import { parse } from "yaml";
import type { RuntimeConfig, Settings } from "./types.js";

export interface PreservedSections {
  runtime?: RuntimeConfig;
  settings?: Settings;
}

/**
 * Read an existing .yml request file and extract user-managed sections.
 * Returns runtime and settings if present.
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
    return preserved;
  } catch {
    return {};
  }
}
