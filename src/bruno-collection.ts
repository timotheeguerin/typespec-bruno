import {
  type EmitContext,
  emitFile,
  resolvePath,
} from "@typespec/compiler";
import type { BrunoEmitterOptions } from "./lib.js";
import type {
  BruCollectionMeta,
  BruFileEntry,
  BruEnvironment,
} from "./bru/types.js";
import {
  writeBruFile,
  writeBruEnvironment,
  writeBrunoJson,
} from "./bru/writer.js";

/**
 * Write the full Bruno collection to disk:
 * - bruno.json
 * - environments/*.bru
 * - request .bru files organized in folders
 */
export async function writeCollection(
  context: EmitContext<BrunoEmitterOptions>,
  meta: BruCollectionMeta,
  entries: BruFileEntry[],
  environments: BruEnvironment[],
): Promise<void> {
  const { program, emitterOutputDir } = context;
  const outputDir = emitterOutputDir;

  // Write bruno.json
  await emitFile(program, {
    path: resolvePath(outputDir, "bruno.json"),
    content: writeBrunoJson(meta),
  });

  // Write environment files
  for (const env of environments) {
    await emitFile(program, {
      path: resolvePath(outputDir, "environments", `${env.name}.bru`),
      content: writeBruEnvironment(env),
    });
  }

  // Write .bru request files
  for (const entry of entries) {
    const filePath = resolvePath(outputDir, ...entry.segments);
    await emitFile(program, {
      path: filePath,
      content: writeBruFile(entry.file),
    });
  }
}
