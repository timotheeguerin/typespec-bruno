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
import type { BrunoEmitterOptions } from "./lib.js";
import type {
  BruFileProps,
  BruBodyProps,
  BruAuthProps,
  BruAuthMode,
  BruBodyMode,
  BruParamEntry,
  BruHeaderEntry,
  BruHttpVerb,
} from "./components/index.js";
import { BruFile } from "./components/BruFile.js";
import { BruEnvironment } from "./components/BruEnvironment.js";
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

    const brunoJson = JSON.stringify(
      { version: "1", name: serviceName, type: "collection" },
      null,
      2,
    ) + "\n";

    const fileEntries = buildFileEntries(program, httpService);
    const environments = buildEnvironments(program, httpService.namespace);

    // Build the component tree using JSX
    const tree = (
      <Output>
        <SourceFile path="bruno.json" filetype="json">
          {brunoJson}
        </SourceFile>
        <SourceDirectory path="environments">
          {environments.map((env) => (
            <SourceFile path={`${env.name}.bru`} filetype="bru">
              {BruEnvironment({ variables: env.variables })}
            </SourceFile>
          ))}
        </SourceDirectory>
        {buildSourceTree(fileEntries)}
      </Output>
    );

    await writeOutput(program, tree, emitterOutputDir);
  }
}

/** A file entry with its relative path segments and component props. */
interface FileEntry {
  segments: string[];
  props: BruFileProps;
}

/** Environment definition. */
interface EnvironmentDef {
  name: string;
  variables: { key: string; value: string }[];
}

/** Build the alloy SourceDirectory/SourceFile tree from file entries. */
function buildSourceTree(entries: FileEntry[]) {
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
      <SourceFile path={entry.segments[0]} filetype="bru">
        {BruFile(entry.props)}
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

    const props = buildBruFileProps(program, operation, seq);
    entries.push({ segments, props });
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

  segments.push(`${kebabCase(operation.operation.name)}.bru`);
  return segments;
}

function buildBruFileProps(
  program: Program,
  operation: HttpOperation,
  seq: number,
): BruFileProps {
  const verb = operation.verb as BruHttpVerb;
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
  const queryParams: BruParamEntry[] = [];
  const pathParams: BruParamEntry[] = [];
  const headers: BruHeaderEntry[] = [];

  for (const param of operation.parameters.parameters) {
    const exampleValue =
      opExampleParams?.[param.param.name] !== undefined
        ? String(opExampleParams[param.param.name])
        : String(generateExampleValue(param.param.type));

    switch (param.type) {
      case "query":
        queryParams.push({
          key: param.name,
          value: exampleValue,
          enabled: !param.param.optional,
        });
        break;
      case "path":
        pathParams.push({ key: param.name, value: exampleValue });
        break;
      case "header":
        headers.push({
          key: param.name,
          value: exampleValue,
          enabled: !param.param.optional,
        });
        break;
    }
  }

  // Build body
  let body: BruBodyProps | undefined;
  let bodyMode: BruBodyMode = "none";
  const opBody = operation.parameters.body;
  if (opBody && opBody.bodyKind === "single") {
    const contentTypes = opBody.contentTypes;
    if (contentTypes.some((ct) => ct.includes("json")) || contentTypes.length === 0) {
      bodyMode = "json";
      const example = resolveBodyExample(program, operation, opExampleParams, opBody.type);
      body = { type: "json", content: JSON.stringify(example, null, 2) };
    } else if (contentTypes.some((ct) => ct.includes("form-urlencoded"))) {
      bodyMode = "form-urlencoded";
      if (opBody.type.kind === "Model") {
        const example = resolveBodyExample(program, operation, opExampleParams, opBody.type);
        const fields = objectToFields(example);
        body = { type: "form-urlencoded", fields };
      }
    } else if (contentTypes.some((ct) => ct.includes("multipart"))) {
      bodyMode = "multipart-form";
      if (opBody.type.kind === "Model") {
        const example = resolveBodyExample(program, operation, opExampleParams, opBody.type);
        const fields = objectToFields(example);
        body = { type: "multipart-form", fields };
      }
    } else if (contentTypes.some((ct) => ct.includes("xml"))) {
      bodyMode = "xml";
    } else if (contentTypes.some((ct) => ct.includes("text"))) {
      bodyMode = "text";
    }
  }

  // Auth
  const { authMode, auth } = resolveAuth(operation.authentication);

  // Docs
  const doc = getDoc(program, operation.operation);

  const props: BruFileProps = {
    meta: { name: operation.operation.name, seq },
    method: { verb, url, body: bodyMode, auth: authMode },
  };

  if (queryParams.length > 0) props.queryParams = queryParams;
  if (pathParams.length > 0) props.pathParams = pathParams;
  if (headers.length > 0) props.headers = headers;
  if (body) props.body = body;
  if (auth) props.auth = auth;
  if (doc) props.docs = doc;

  return props;
}

// ── Helpers ──────────────────────────────────────────────────────────

function objectToFields(example: unknown): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  if (example && typeof example === "object" && !Array.isArray(example)) {
    for (const [key, val] of Object.entries(example as Record<string, unknown>)) {
      fields.push({ key, value: String(val) });
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

function resolveAuth(
  authentication?: Authentication,
): { authMode: BruAuthMode; auth?: BruAuthProps } {
  if (!authentication || authentication.options.length === 0) {
    return { authMode: "none" };
  }
  const schemes = authentication.options[0].schemes;
  if (schemes.length === 0) return { authMode: "none" };
  return mapAuthScheme(schemes[0]);
}

function mapAuthScheme(
  scheme: HttpAuth,
): { authMode: BruAuthMode; auth?: BruAuthProps } {
  if (scheme.type === "http" && scheme.scheme === "Bearer") {
    return {
      authMode: "bearer",
      auth: { type: "bearer", token: "{{token}}" },
    };
  }
  if (scheme.type === "http" && scheme.scheme === "Basic") {
    return {
      authMode: "basic",
      auth: { type: "basic", username: "{{username}}", password: "{{password}}" },
    };
  }
  if (scheme.type === "apiKey") {
    return {
      authMode: "apikey",
      auth: {
        type: "apikey",
        key: scheme.name,
        value: `{{${kebabCase(scheme.name)}}}`,
        placement: scheme.in === "query" ? "query" : "header",
      },
    };
  }
  return { authMode: "none" };
}

function buildEnvironments(
  program: Program,
  namespace: Namespace,
): EnvironmentDef[] {
  const servers = getServers(program, namespace);
  if (!servers || servers.length === 0) {
    return [{ name: "default", variables: [{ key: "baseUrl", value: "http://localhost:3000" }] }];
  }

  return servers.map((server, index) => {
    const variables: { key: string; value: string }[] = [
      { key: "baseUrl", value: server.url },
    ];
    if (server.parameters) {
      for (const [name, param] of server.parameters) {
        variables.push({ key: name, value: String(generateExampleValue(param.type)) });
      }
    }
    const name =
      server.description ?? (servers.length === 1 ? "default" : `server-${index + 1}`);
    return { name: kebabCase(name), variables };
  });
}
