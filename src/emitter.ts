import {
  type EmitContext,
  type Program,
  type Namespace,
  type Interface,
  listServices,
  getDoc,
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
import type { BrunoEmitterOptions } from "./lib.js";
import type {
  BruFile,
  BruFileEntry,
  BruRequest,
  BruKeyValue,
  BruBody,
  BruAuth,
  BruAuthMode,
  BruBodyMode,
  BruEnvironment,
  BruCollectionMeta,
} from "./bru/types.js";
import {
  kebabCase,
  toBruVerb,
  convertPath,
  generateExampleValue,
} from "./utils.js";
import { writeCollection } from "./bruno-collection.js";

export async function $onEmit(
  context: EmitContext<BrunoEmitterOptions>,
): Promise<void> {
  const { program } = context;

  if (program.compilerOptions.noEmit) {
    return;
  }

  const services = listServices(program);
  const httpServices = ignoreDiagnostics(getAllHttpServices(program));

  for (const httpService of httpServices) {
    const service = services.find(
      (s) => s.type === httpService.namespace,
    );
    const serviceName = service?.title ?? httpService.namespace.name;

    const collectionMeta: BruCollectionMeta = {
      version: "1",
      name: serviceName,
      type: "collection",
    };

    // Build file entries from operations
    const entries = buildFileEntries(
      program,
      httpService,
    );

    // Build environments from @server definitions
    const environments = buildEnvironments(program, httpService.namespace);

    // Build auth from service-level authentication
    const serviceAuth = httpService.authentication;

    await writeCollection(context, collectionMeta, entries, environments);
  }
}

/** Build BruFileEntry[] from all operations in the service. */
function buildFileEntries(
  program: Program,
  httpService: HttpService,
): BruFileEntry[] {
  const entries: BruFileEntry[] = [];
  // Track sequence numbers per folder
  const seqCounters = new Map<string, number>();

  for (const operation of httpService.operations) {
    const segments = getOperationSegments(
      operation,
      httpService.namespace,
    );
    const folderKey = segments.slice(0, -1).join("/");
    const seq = (seqCounters.get(folderKey) ?? 0) + 1;
    seqCounters.set(folderKey, seq);

    const file = buildBruFile(program, operation, seq);
    entries.push({ segments, file });
  }

  return entries;
}

/**
 * Determine the path segments for an operation's .bru file.
 * Uses the container hierarchy relative to the service namespace.
 */
function getOperationSegments(
  operation: HttpOperation,
  serviceNamespace: Namespace,
): string[] {
  const segments: string[] = [];

  // Walk up from the container to build folder path
  let container = operation.container;
  const visited = new Set<Namespace | Interface>();

  while (container && !visited.has(container)) {
    visited.add(container);
    if (container === serviceNamespace) break;

    segments.unshift(container.name);

    if (container.kind === "Interface") {
      // Interfaces don't have a parent namespace chain we can walk easily
      // but they do have a namespace property
      container = container.namespace as Namespace;
    } else {
      // Namespace
      container = container.namespace as Namespace;
    }
  }

  // Add the file name
  const fileName = `${kebabCase(operation.operation.name)}.bru`;
  segments.push(fileName);

  return segments;
}

/** Build a BruFile from a single HttpOperation. */
function buildBruFile(
  program: Program,
  operation: HttpOperation,
  seq: number,
): BruFile {
  const verb = toBruVerb(operation.verb);
  const path = convertPath(operation.uriTemplate);
  const url = `{{baseUrl}}${path}`;

  // Collect parameters by type
  const queryParams: BruKeyValue[] = [];
  const pathParams: BruKeyValue[] = [];
  const headers: BruKeyValue[] = [];

  for (const param of operation.parameters.parameters) {
    const exampleValue = String(
      generateExampleValue(param.param.type),
    );

    switch (param.type) {
      case "query":
        queryParams.push({
          key: param.name,
          value: exampleValue,
          enabled: !param.param.optional,
        });
        break;
      case "path":
        pathParams.push({
          key: param.name,
          value: exampleValue,
        });
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
  let body: BruBody | undefined;
  let bodyMode: BruBodyMode = "none";

  const opBody = operation.parameters.body;
  if (opBody && opBody.bodyKind === "single") {
    const contentTypes = opBody.contentTypes;
    if (
      contentTypes.some((ct) => ct.includes("json")) ||
      contentTypes.length === 0
    ) {
      bodyMode = "json";
      const example = generateExampleValue(opBody.type);
      body = {
        type: "json",
        content: JSON.stringify(example, null, 2),
      };
    } else if (
      contentTypes.some((ct) => ct.includes("form-urlencoded"))
    ) {
      bodyMode = "form-urlencoded";
      if (opBody.type.kind === "Model") {
        const fields: BruKeyValue[] = [];
        for (const [name, prop] of opBody.type.properties) {
          fields.push({
            key: name,
            value: String(generateExampleValue(prop.type)),
          });
        }
        body = { type: "form-urlencoded", fields };
      }
    } else if (contentTypes.some((ct) => ct.includes("multipart"))) {
      bodyMode = "multipart-form";
      if (opBody.type.kind === "Model") {
        const fields: BruKeyValue[] = [];
        for (const [name, prop] of opBody.type.properties) {
          fields.push({
            key: name,
            value: String(generateExampleValue(prop.type)),
          });
        }
        body = { type: "multipart-form", fields };
      }
    } else if (contentTypes.some((ct) => ct.includes("xml"))) {
      bodyMode = "xml";
    } else if (contentTypes.some((ct) => ct.includes("text"))) {
      bodyMode = "text";
    }
  }

  // Build auth from operation or service-level auth
  const { authMode, auth } = resolveAuth(operation.authentication);

  // Build request
  const request: BruRequest = {
    method: verb,
    url,
    body: bodyMode,
    auth: authMode,
  };

  // Get docs
  const doc = getDoc(program, operation.operation);

  const bruFile: BruFile = {
    meta: {
      name: operation.operation.name,
      type: "http",
      seq,
    },
    request,
  };

  if (queryParams.length > 0) bruFile.queryParams = queryParams;
  if (pathParams.length > 0) bruFile.pathParams = pathParams;
  if (headers.length > 0) bruFile.headers = headers;
  if (body) bruFile.body = body;
  if (auth) bruFile.auth = auth;
  if (doc) bruFile.docs = doc;

  return bruFile;
}

/** Resolve TypeSpec Authentication to Bruno auth block. */
function resolveAuth(
  authentication?: Authentication,
): { authMode: BruAuthMode; auth?: BruAuth } {
  if (!authentication || authentication.options.length === 0) {
    return { authMode: "none" };
  }

  // Use the first authentication option's first scheme
  const schemes = authentication.options[0].schemes;
  if (schemes.length === 0) {
    return { authMode: "none" };
  }

  const scheme = schemes[0];
  return mapAuthScheme(scheme);
}

function mapAuthScheme(
  scheme: HttpAuth,
): { authMode: BruAuthMode; auth?: BruAuth } {
  if (scheme.type === "http" && scheme.scheme === "bearer") {
    return {
      authMode: "bearer",
      auth: { type: "bearer", token: "{{token}}" },
    };
  }

  if (scheme.type === "http" && scheme.scheme === "basic") {
    return {
      authMode: "basic",
      auth: {
        type: "basic",
        username: "{{username}}",
        password: "{{password}}",
      },
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

  // OAuth2 and others — fall back to none
  return { authMode: "none" };
}

/** Build environment files from @server definitions. */
function buildEnvironments(
  program: Program,
  namespace: Namespace,
): BruEnvironment[] {
  const servers = getServers(program, namespace);
  if (!servers || servers.length === 0) {
    return [
      {
        name: "default",
        variables: [{ key: "baseUrl", value: "http://localhost:3000" }],
      },
    ];
  }

  return servers.map((server, index) => {
    const variables: BruKeyValue[] = [
      { key: "baseUrl", value: server.url },
    ];

    // Add server parameters as variables
    if (server.parameters) {
      for (const [name, param] of server.parameters) {
        const exampleValue = String(generateExampleValue(param.type));
        variables.push({ key: name, value: exampleValue });
      }
    }

    const name =
      server.description ??
      (servers.length === 1 ? "default" : `server-${index + 1}`);
    return { name: kebabCase(name), variables };
  });
}
