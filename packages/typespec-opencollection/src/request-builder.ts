import {
  type Program,
  type Namespace,
  type Interface,
  type Type,
  getDoc,
  getExamples,
  getOpExamples,
  serializeValueAsJson,
} from "@typespec/compiler";
import type { HttpOperation, HttpService } from "@typespec/http";
import type {
  OpenCollectionRequest,
  FileEntry,
  HttpConfig,
  ParamEntry,
  HeaderEntry,
  BodyConfig,
} from "./types.js";
import { resolveAuth } from "./auth.js";
import { kebabCase, convertPath } from "./utils.js";
import { generateSample } from "typespec-random-sample";

export function buildFileEntries(
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
        : String(generateSample(param.param.type));

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

  return generateSample(bodyType);
}
