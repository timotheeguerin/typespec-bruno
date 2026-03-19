import {
  type EmitContext,
  listServices,
  ignoreDiagnostics,
} from "@typespec/compiler";
import { getAllHttpServices } from "@typespec/http";
import { Output, SourceFile, SourceDirectory, type Children } from "@alloy-js/core";
import { writeOutput } from "@typespec/emitter-framework";
import type { OpenCollectionEmitterOptions } from "./lib.js";
import type { OpenCollectionRoot, FileEntry } from "./types.js";
import { serializeRequest, serializeRoot, serializeEnvironment } from "./serialize.js";
import { attachPreservedSections } from "./preserve.js";
import { buildFileEntries } from "./request-builder.js";
import { buildEnvironments, type EnvEntry } from "./environments.js";

export async function $onEmit(
  context: EmitContext<OpenCollectionEmitterOptions>,
): Promise<void> {
  const { program, emitterOutputDir } = context;

  if (program.compilerOptions.noEmit) {
    return;
  }

  const services = listServices(program);
  const httpServices = ignoreDiagnostics(getAllHttpServices(program));

  for (const httpService of httpServices) {
    const service = services.find((s) => s.type === httpService.namespace);
    const serviceName = service?.title ?? httpService.namespace.name;

    const root: OpenCollectionRoot = {
      info: { name: serviceName, type: "collection" },
    };

    const fileEntries = buildFileEntries(program, httpService);
    const environments = buildEnvironments(program, httpService.namespace);

    const preserveValues = context.options["preserve-values"] !== false;

    // Preserve user-managed sections from existing files
    await attachPreservedSections(fileEntries, emitterOutputDir, preserveValues);

    const tree = (
      <Output>
        <SourceFile path="opencollection.yml" filetype="yaml">
          {serializeRoot(root)}
        </SourceFile>
        <SourceDirectory path="environments">
          {environments.map((env) => (
            <SourceFile path={`${env.name}.yml`} filetype="yaml">
              {serializeEnvironment(env.data)}
            </SourceFile>
          ))}
        </SourceDirectory>
        {buildSourceTree(fileEntries)}
      </Output>
    );

    await writeOutput(program, tree, emitterOutputDir);
  }
}

function buildSourceTree(entries: FileEntry[]): Children[] {
  const folders = new Map<string, FileEntry[]>();
  const rootFiles: FileEntry[] = [];

  for (const entry of entries) {
    if (entry.segments.length === 1) {
      rootFiles.push(entry);
    } else {
      const folder = entry.segments[0];
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push({
        ...entry,
        segments: entry.segments.slice(1),
      });
    }
  }

  const result: Children[] = [];

  for (const entry of rootFiles) {
    result.push(
      <SourceFile path={entry.segments[0]} filetype="yaml">
        {serializeRequest(entry.request)}
      </SourceFile>,
    );
  }

  for (const [folder, folderEntries] of folders) {
    result.push(
      <SourceDirectory path={folder}>
        {buildSourceTree(folderEntries)}
      </SourceDirectory>,
    );
  }

  return result;
}
