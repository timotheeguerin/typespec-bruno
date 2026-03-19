import {
  type EmitContext,
  type Program,
  type Namespace,
  type Interface,
  type Type,
  listServices,
  getDoc,
  getExamples,
  getOpExamples,
  serializeValueAsJson,
  ignoreDiagnostics,
} from "@typespec/compiler";
import {
  getAllHttpServices,
  getServers,
  type HttpOperation,
  type HttpService,
  type HttpAuth,
  type Authentication,
} from "@typespec/http";
import { Output, SourceFile, SourceDirectory, type Children } from "@alloy-js/core";
import { writeOutput } from "@typespec/emitter-framework";
import { resolve as resolveFsPath } from "path";
import type { BrunoEmitterOptions } from "./lib.js";
import type {
  OpenCollectionRequest,
  OpenCollectionRoot,
  OpenCollectionEnvironment,
  FileEntry,
  HttpConfig,
  ParamEntry,
  HeaderEntry,
  BodyConfig,
  AuthConfig,
} from "./types.js";
import { serializeRequest, serializeRoot, serializeEnvironment } from "./serialize.js";
import { extractPreservedSections } from "./preserve.js";
import { kebabCase, convertPath, generateExampleValue } from "./utils.js";

export async function $onEmit(
  context: EmitContext<BrunoEmitterOptions>,
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

    // Preserve user-managed sections from existing files
    await attachPreservedSections(fileEntries, emitterOutputDir);

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

// ── Source tree building ─────────────────────────────────────────────

interface EnvEntry {
  name: string;
  data: OpenCollectionEnvironment;
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

// ── Building file entries from TypeSpec ──────────────────────────────

function buildFileEntries(
  program: Program,
  httpService: HttpService,
): FileEntry[] {
  const entries: FileEntry[] = [];
  const seqCounters = new Map<string, number>();

  for (const operation of httpService.operations) {
    const segments = getOperationSegments(operation, httpService.namespace);
    const folderKey = segments.slice(0, -1).join("/");
    const seq = (seqCounters.get(folderKey) ?? 0) + 1;
    seqCounters.set(folderKey, seq);

    const request = buildRequest(program, operation, seq);
    entries.push({ segments, request });
  }

  return entries;
}

function getOperationSegments(
  operation: HttpOperation,
  serviceNamespace: Namespace,
): string[] {
  const segments: string[] = [];
  let container = operation.container;
  const visited = new Set<Namespace | Interface>();

  while (container && !visited.has(container)) {
    visited.add(container);
    if (container === serviceNamespace) break;
    segments.unshift(container.name);
    container = container.namespace as Namespace;
  }

  segments.push(`${kebabCase(operation.operation.name)}.yml`);
  return segments;
}

function buildRequest(
  program: Program,
  operation: HttpOperation,
  seq: number,
): OpenCollectionRequest {
  const path = convertPath(operation.uriTemplate);
  const url = `{{baseUrl}}${path}`;

  // Resolve operation examples
  const opExamples = getOpExamples(program, operation.operation);
  const opExample = opExamples.length > 0 ? opExamples[0] : undefined;
  let opExampleParams: Record<string, unknown> | undefined;
  if (opExample?.parameters) {
    const serialized = serializeValueAsJson(
      program,
      opExample.parameters,
      operation.operation.parameters,
    );
    if (serialized && typeof serialized === "object" && !Array.isArray(serialized)) {
      opExampleParams = serialized as Record<string, unknown>;
    }
  }

  // Collect parameters
  const params: ParamEntry[] = [];
  const headers: HeaderEntry[] = [];

  for (const param of operation.parameters.parameters) {
    const exampleValue =
      opExampleParams?.[param.param.name] !== undefined
        ? String(opExampleParams[param.param.name])
        : String(generateExampleValue(param.param.type));

    switch (param.type) {
      case "query":
        params.push({
          name: param.name,
          value: exampleValue,
          type: "query",
          ...(param.param.optional ? { disabled: true } : {}),
        });
        break;
      case "path":
        params.push({ name: param.name, value: exampleValue, type: "path" });
        break;
      case "header":
        headers.push({
          name: param.name,
          value: exampleValue,
          ...(param.param.optional ? { disabled: true } : {}),
        });
        break;
    }
  }

  // Build body
  let body: BodyConfig | undefined;
  const opBody = operation.parameters.body;
  if (opBody && opBody.bodyKind === "single") {
    const contentTypes = opBody.contentTypes;
    if (contentTypes.some((ct) => ct.includes("json")) || contentTypes.length === 0) {
      const example = resolveBodyExample(program, operation, opExampleParams, opBody.type);
      body = { type: "json", data: JSON.stringify(example, null, 2) };
    } else if (contentTypes.some((ct) => ct.includes("form-urlencoded"))) {
      const example = resolveBodyExample(program, operation, opExampleParams, opBody.type);
      body = { type: "form-urlencoded", data: objectToFormFields(example) };
    } else if (contentTypes.some((ct) => ct.includes("multipart"))) {
      const example = resolveBodyExample(program, operation, opExampleParams, opBody.type);
      body = { type: "multipart-form", data: objectToFormFields(example) };
    } else if (contentTypes.some((ct) => ct.includes("xml"))) {
      body = { type: "xml", data: "" };
    } else if (contentTypes.some((ct) => ct.includes("text"))) {
      body = { type: "text", data: "" };
    }
  }

  // Auth
  const auth = resolveAuth(operation.authentication);

  // HTTP config
  const http: HttpConfig = {
    method: operation.verb.toUpperCase(),
    url,
  };
  if (params.length > 0) http.params = params;
  if (headers.length > 0) http.headers = headers;
  if (body) http.body = body;
  if (auth) http.auth = auth;

  // Docs
  const doc = getDoc(program, operation.operation);

  const request: OpenCollectionRequest = {
    info: { name: operation.operation.name, type: "http", seq },
    http,
  };

  if (doc) request.docs = doc;

  return request;
}

// ── Helpers ──────────────────────────────────────────────────────────

function objectToFormFields(example: unknown): { name: string; value: string }[] {
  const fields: { name: string; value: string }[] = [];
  if (example && typeof example === "object" && !Array.isArray(example)) {
    for (const [key, val] of Object.entries(example as Record<string, unknown>)) {
      fields.push({ name: key, value: String(val) });
    }
  }
  return fields;
}

function resolveBodyExample(
  program: Program,
  operation: HttpOperation,
  opExampleParams: Record<string, unknown> | undefined,
  bodyType: Type,
): unknown {
  if (opExampleParams) {
    const bodyParam = operation.parameters.body;
    if (bodyParam?.property) {
      const bodyValue = opExampleParams[bodyParam.property.name];
      if (bodyValue !== undefined) return bodyValue;
    }
    if (bodyType.kind === "Model") {
      const bodyObj: Record<string, unknown> = {};
      let hasAny = false;
      for (const [propName] of bodyType.properties) {
        if (opExampleParams[propName] !== undefined) {
          bodyObj[propName] = opExampleParams[propName];
          hasAny = true;
        }
      }
      if (hasAny) return bodyObj;
    }
  }

  if (
    bodyType.kind === "Model" ||
    bodyType.kind === "Scalar" ||
    bodyType.kind === "Enum" ||
    bodyType.kind === "Union"
  ) {
    const examples = getExamples(program, bodyType);
    if (examples.length > 0) {
      return serializeValueAsJson(program, examples[0].value, bodyType);
    }
  }

  return generateExampleValue(bodyType);
}

function resolveAuth(authentication?: Authentication): AuthConfig | undefined {
  if (!authentication || authentication.options.length === 0) return undefined;
  const schemes = authentication.options[0].schemes;
  if (schemes.length === 0) return undefined;
  return mapAuthScheme(schemes[0]);
}

function mapAuthScheme(scheme: HttpAuth): AuthConfig | undefined {
  if (scheme.type === "http" && scheme.scheme === "Bearer") {
    return { type: "bearer", token: "{{token}}" };
  }
  if (scheme.type === "http" && scheme.scheme === "Basic") {
    return { type: "basic", username: "{{username}}", password: "{{password}}" };
  }
  if (scheme.type === "apiKey") {
    return {
      type: "apikey",
      key: scheme.name,
      value: `{{${kebabCase(scheme.name)}}}`,
      placement: scheme.in === "query" ? "query" : "header",
    };
  }
  return undefined;
}

async function attachPreservedSections(
  entries: FileEntry[],
  outputDir: string,
): Promise<void> {
  for (const entry of entries) {
    const filePath = resolveFsPath(outputDir, ...entry.segments);
    const preserved = await extractPreservedSections(filePath);
    if (preserved.runtime) entry.request.runtime = preserved.runtime;
    if (preserved.settings) entry.request.settings = preserved.settings;
  }
}

function buildEnvironments(
  program: Program,
  namespace: Namespace,
): EnvEntry[] {
  const servers = getServers(program, namespace);
  if (!servers || servers.length === 0) {
    return [{
      name: "default",
      data: {
        info: { name: "Default", type: "env" },
        vars: { baseUrl: "http://localhost:3000" },
      },
    }];
  }

  return servers.map((server, index) => {
    const vars: Record<string, string> = { baseUrl: server.url };
    if (server.parameters) {
      for (const [name, param] of server.parameters) {
        vars[name] = String(generateExampleValue(param.type));
      }
    }
    const description =
      server.description ?? (servers.length === 1 ? "Default" : `Server ${index + 1}`);
    return {
      name: kebabCase(description),
      data: {
        info: { name: description, type: "env" as const },
        vars,
      },
    };
  });
}
