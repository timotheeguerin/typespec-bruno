import type {
  BruAuth,
  BruBody,
  BruEnvironment,
  BruFile,
  BruKeyValue,
  BruCollectionMeta,
} from "./types.js";

/**
 * Serialize a BruFile to .bru text format.
 */
export function writeBruFile(file: BruFile): string {
  const blocks: string[] = [];

  // meta block
  blocks.push(
    writeDictBlock("meta", [
      { key: "name", value: file.meta.name },
      { key: "type", value: file.meta.type },
      { key: "seq", value: String(file.meta.seq) },
    ]),
  );

  // HTTP method block
  blocks.push(
    writeDictBlock(file.request.method, [
      { key: "url", value: file.request.url },
      { key: "body", value: file.request.body },
      { key: "auth", value: file.request.auth },
    ]),
  );

  // params:query
  if (file.queryParams && file.queryParams.length > 0) {
    blocks.push(writeKeyValueBlock("params:query", file.queryParams));
  }

  // params:path
  if (file.pathParams && file.pathParams.length > 0) {
    blocks.push(writeKeyValueBlock("params:path", file.pathParams));
  }

  // headers
  if (file.headers && file.headers.length > 0) {
    blocks.push(writeKeyValueBlock("headers", file.headers));
  }

  // body
  if (file.body) {
    blocks.push(writeBody(file.body));
  }

  // auth
  if (file.auth) {
    blocks.push(writeAuth(file.auth));
  }

  // docs
  if (file.docs) {
    blocks.push(writeTextBlock("docs", file.docs));
  }

  return blocks.join("\n\n") + "\n";
}

/**
 * Serialize a Bruno environment to .bru text format.
 */
export function writeBruEnvironment(env: BruEnvironment): string {
  return writeKeyValueBlock("vars", env.variables) + "\n";
}

/**
 * Serialize bruno.json collection metadata.
 */
export function writeBrunoJson(meta: BruCollectionMeta): string {
  return JSON.stringify(meta, null, 2) + "\n";
}

// ── Internal helpers ──────────────────────────────────────────────────

function writeDictBlock(
  name: string,
  entries: { key: string; value: string }[],
): string {
  const lines = entries.map((e) => `  ${e.key}: ${e.value}`);
  return `${name} {\n${lines.join("\n")}\n}`;
}

function writeKeyValueBlock(name: string, entries: BruKeyValue[]): string {
  const lines = entries.map((e) => {
    const prefix = e.enabled === false ? "~" : "";
    return `  ${prefix}${e.key}: ${e.value}`;
  });
  return `${name} {\n${lines.join("\n")}\n}`;
}

function writeTextBlock(name: string, content: string): string {
  return `${name} {\n  ${content.split("\n").join("\n  ")}\n}`;
}

function writeBody(body: BruBody): string {
  switch (body.type) {
    case "json":
      return writeRawBlock("body:json", body.content);
    case "text":
      return writeRawBlock("body:text", body.content);
    case "xml":
      return writeRawBlock("body:xml", body.content);
    case "form-urlencoded":
      return writeKeyValueBlock("body:form-urlencoded", body.fields);
    case "multipart-form":
      return writeKeyValueBlock("body:multipart-form", body.fields);
  }
}

function writeAuth(auth: BruAuth): string {
  switch (auth.type) {
    case "bearer":
      return writeDictBlock("auth:bearer", [
        { key: "token", value: auth.token },
      ]);
    case "basic":
      return writeDictBlock("auth:basic", [
        { key: "username", value: auth.username },
        { key: "password", value: auth.password },
      ]);
    case "apikey":
      return writeDictBlock("auth:apikey", [
        { key: "key", value: auth.key },
        { key: "value", value: auth.value },
        { key: "placement", value: auth.placement },
      ]);
  }
}

function writeRawBlock(name: string, content: string): string {
  return `${name} {\n${content}\n}`;
}
