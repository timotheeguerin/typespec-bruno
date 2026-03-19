import { describe, it, expect } from "vitest";
import {
  writeBruFile,
  writeBruEnvironment,
  writeBrunoJson,
} from "../src/bru/writer.js";
import type {
  BruFile,
  BruEnvironment,
  BruCollectionMeta,
} from "../src/bru/types.js";

describe("writeBruFile", () => {
  it("writes a minimal GET request", () => {
    const file: BruFile = {
      meta: { name: "List Pets", type: "http", seq: 1 },
      request: {
        method: "get",
        url: "{{baseUrl}}/pets",
        body: "none",
        auth: "none",
      },
    };

    const result = writeBruFile(file);
    expect(result).toContain("meta {");
    expect(result).toContain("  name: List Pets");
    expect(result).toContain("  type: http");
    expect(result).toContain("  seq: 1");
    expect(result).toContain("get {");
    expect(result).toContain("  url: {{baseUrl}}/pets");
    expect(result).toContain("  body: none");
    expect(result).toContain("  auth: none");
  });

  it("writes query and path params", () => {
    const file: BruFile = {
      meta: { name: "Get Pet", type: "http", seq: 2 },
      request: {
        method: "get",
        url: "{{baseUrl}}/pets/:petId",
        body: "none",
        auth: "none",
      },
      pathParams: [{ key: "petId", value: "123" }],
      queryParams: [
        { key: "include", value: "details", enabled: true },
        { key: "debug", value: "true", enabled: false },
      ],
    };

    const result = writeBruFile(file);
    expect(result).toContain("params:path {");
    expect(result).toContain("  petId: 123");
    expect(result).toContain("params:query {");
    expect(result).toContain("  include: details");
    expect(result).toContain("  ~debug: true");
  });

  it("writes headers", () => {
    const file: BruFile = {
      meta: { name: "Create Pet", type: "http", seq: 1 },
      request: {
        method: "post",
        url: "{{baseUrl}}/pets",
        body: "json",
        auth: "none",
      },
      headers: [
        { key: "x-request-id", value: "{{requestId}}" },
      ],
    };

    const result = writeBruFile(file);
    expect(result).toContain("headers {");
    expect(result).toContain("  x-request-id: {{requestId}}");
  });

  it("writes JSON body", () => {
    const file: BruFile = {
      meta: { name: "Create Pet", type: "http", seq: 1 },
      request: {
        method: "post",
        url: "{{baseUrl}}/pets",
        body: "json",
        auth: "none",
      },
      body: {
        type: "json",
        content: JSON.stringify({ name: "Fido", age: 3 }, null, 2),
      },
    };

    const result = writeBruFile(file);
    expect(result).toContain("body:json {");
    expect(result).toContain('"name": "Fido"');
    expect(result).toContain('"age": 3');
  });

  it("writes form-urlencoded body", () => {
    const file: BruFile = {
      meta: { name: "Login", type: "http", seq: 1 },
      request: {
        method: "post",
        url: "{{baseUrl}}/login",
        body: "form-urlencoded",
        auth: "none",
      },
      body: {
        type: "form-urlencoded",
        fields: [
          { key: "username", value: "admin" },
          { key: "password", value: "secret" },
        ],
      },
    };

    const result = writeBruFile(file);
    expect(result).toContain("body:form-urlencoded {");
    expect(result).toContain("  username: admin");
    expect(result).toContain("  password: secret");
  });

  it("writes bearer auth", () => {
    const file: BruFile = {
      meta: { name: "Secure", type: "http", seq: 1 },
      request: {
        method: "get",
        url: "{{baseUrl}}/secure",
        body: "none",
        auth: "bearer",
      },
      auth: { type: "bearer", token: "{{token}}" },
    };

    const result = writeBruFile(file);
    expect(result).toContain("auth:bearer {");
    expect(result).toContain("  token: {{token}}");
  });

  it("writes basic auth", () => {
    const file: BruFile = {
      meta: { name: "Auth", type: "http", seq: 1 },
      request: {
        method: "get",
        url: "{{baseUrl}}/auth",
        body: "none",
        auth: "basic",
      },
      auth: {
        type: "basic",
        username: "{{username}}",
        password: "{{password}}",
      },
    };

    const result = writeBruFile(file);
    expect(result).toContain("auth:basic {");
    expect(result).toContain("  username: {{username}}");
    expect(result).toContain("  password: {{password}}");
  });

  it("writes apikey auth", () => {
    const file: BruFile = {
      meta: { name: "Api Key", type: "http", seq: 1 },
      request: {
        method: "get",
        url: "{{baseUrl}}/data",
        body: "none",
        auth: "apikey",
      },
      auth: {
        type: "apikey",
        key: "X-API-Key",
        value: "{{apiKey}}",
        placement: "header",
      },
    };

    const result = writeBruFile(file);
    expect(result).toContain("auth:apikey {");
    expect(result).toContain("  key: X-API-Key");
    expect(result).toContain("  value: {{apiKey}}");
    expect(result).toContain("  placement: header");
  });

  it("writes docs block", () => {
    const file: BruFile = {
      meta: { name: "Documented", type: "http", seq: 1 },
      request: {
        method: "get",
        url: "{{baseUrl}}/docs",
        body: "none",
        auth: "none",
      },
      docs: "This endpoint returns documentation.",
    };

    const result = writeBruFile(file);
    expect(result).toContain("docs {");
    expect(result).toContain("This endpoint returns documentation.");
  });

  it("writes a complete request with all blocks", () => {
    const file: BruFile = {
      meta: { name: "Update Pet", type: "http", seq: 3 },
      request: {
        method: "put",
        url: "{{baseUrl}}/pets/:petId",
        body: "json",
        auth: "bearer",
      },
      pathParams: [{ key: "petId", value: "0" }],
      queryParams: [{ key: "notify", value: "true" }],
      headers: [{ key: "x-trace-id", value: "{{traceId}}" }],
      body: {
        type: "json",
        content: JSON.stringify({ name: "Rex" }, null, 2),
      },
      auth: { type: "bearer", token: "{{token}}" },
      docs: "Update a pet by ID.",
    };

    const result = writeBruFile(file);

    // Verify block order
    const metaIdx = result.indexOf("meta {");
    const putIdx = result.indexOf("put {");
    const queryIdx = result.indexOf("params:query {");
    const pathIdx = result.indexOf("params:path {");
    const headersIdx = result.indexOf("headers {");
    const bodyIdx = result.indexOf("body:json {");
    const authIdx = result.indexOf("auth:bearer {");
    const docsIdx = result.indexOf("docs {");

    expect(metaIdx).toBeLessThan(putIdx);
    expect(putIdx).toBeLessThan(queryIdx);
    expect(queryIdx).toBeLessThan(pathIdx);
    expect(pathIdx).toBeLessThan(headersIdx);
    expect(headersIdx).toBeLessThan(bodyIdx);
    expect(bodyIdx).toBeLessThan(authIdx);
    expect(authIdx).toBeLessThan(docsIdx);
  });
});

describe("writeBruEnvironment", () => {
  it("writes environment variables", () => {
    const env: BruEnvironment = {
      name: "development",
      variables: [
        { key: "baseUrl", value: "http://localhost:3000" },
        { key: "apiKey", value: "dev-key-123" },
      ],
    };

    const result = writeBruEnvironment(env);
    expect(result).toContain("vars {");
    expect(result).toContain("  baseUrl: http://localhost:3000");
    expect(result).toContain("  apiKey: dev-key-123");
  });
});

describe("writeBrunoJson", () => {
  it("writes collection metadata", () => {
    const meta: BruCollectionMeta = {
      version: "1",
      name: "Pet Store",
      type: "collection",
    };

    const result = writeBrunoJson(meta);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({
      version: "1",
      name: "Pet Store",
      type: "collection",
    });
  });
});
