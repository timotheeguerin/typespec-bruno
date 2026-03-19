import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { serializeRequest, serializeRoot, serializeEnvironment } from "../src/serialize.js";
import type {
  OpenCollectionRequest,
  OpenCollectionRoot,
  OpenCollectionEnvironment,
} from "../src/types.js";

describe("serializeRoot", () => {
  it("produces valid opencollection.yml", () => {
    const root: OpenCollectionRoot = {
      info: { name: "Pet Store", type: "collection" },
    };
    const yaml = serializeRoot(root);
    const parsed = parse(yaml);
    expect(parsed.info.name).toBe("Pet Store");
    expect(parsed.info.type).toBe("collection");
  });
});

describe("serializeEnvironment", () => {
  it("produces environment with variables", () => {
    const env: OpenCollectionEnvironment = {
      name: "Production",
      variables: [
        { name: "baseUrl", value: "https://api.example.com" },
        { name: "apiKey", value: "secret" },
      ],
    };
    const yaml = serializeEnvironment(env);
    const parsed = parse(yaml);
    expect(parsed.name).toBe("Production");
    expect(parsed.variables).toHaveLength(2);
    expect(parsed.variables[0]).toEqual({ name: "baseUrl", value: "https://api.example.com" });
    expect(parsed.variables[1]).toEqual({ name: "apiKey", value: "secret" });
  });
});

describe("serializeRequest", () => {
  it("produces minimal GET request", () => {
    const request: OpenCollectionRequest = {
      info: { name: "List Pets", type: "http", seq: 1 },
      http: { method: "GET", url: "{{baseUrl}}/pets" },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.info.name).toBe("List Pets");
    expect(parsed.info.type).toBe("http");
    expect(parsed.info.seq).toBe(1);
    expect(parsed.http.method).toBe("GET");
    expect(parsed.http.url).toBe("{{baseUrl}}/pets");
  });

  it("produces POST with JSON body", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Create Pet", type: "http", seq: 2 },
      http: {
        method: "POST",
        url: "{{baseUrl}}/pets",
        body: {
          type: "json",
          data: JSON.stringify({ name: "Buddy", age: 3 }, null, 2),
        },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.body.type).toBe("json");
    const bodyData = JSON.parse(parsed.http.body.data);
    expect(bodyData.name).toBe("Buddy");
    expect(bodyData.age).toBe(3);
  });

  it("produces request with params", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Get Pet", type: "http", seq: 1 },
      http: {
        method: "GET",
        url: "{{baseUrl}}/pets/:petId",
        params: [
          { name: "petId", value: "42", type: "path" },
          { name: "verbose", value: "true", type: "query", disabled: true },
        ],
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.params).toHaveLength(2);
    expect(parsed.http.params[0]).toEqual({ name: "petId", value: "42", type: "path" });
    expect(parsed.http.params[1].disabled).toBe(true);
  });

  it("produces request with headers", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Auth Request", type: "http", seq: 1 },
      http: {
        method: "GET",
        url: "{{baseUrl}}/data",
        headers: [
          { name: "X-Request-Id", value: "{{requestId}}" },
          { name: "X-Optional", value: "val", disabled: true },
        ],
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.headers).toHaveLength(2);
    expect(parsed.http.headers[0].name).toBe("X-Request-Id");
    expect(parsed.http.headers[1].disabled).toBe(true);
  });

  it("produces request with bearer auth", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Secure", type: "http", seq: 1 },
      http: {
        method: "GET",
        url: "{{baseUrl}}/secure",
        auth: { type: "bearer", token: "{{token}}" },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.auth.type).toBe("bearer");
    expect(parsed.http.auth.token).toBe("{{token}}");
  });

  it("produces request with basic auth", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Basic", type: "http", seq: 1 },
      http: {
        method: "GET",
        url: "{{baseUrl}}/basic",
        auth: { type: "basic", username: "{{user}}", password: "{{pass}}" },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.auth.type).toBe("basic");
    expect(parsed.http.auth.username).toBe("{{user}}");
  });

  it("produces request with docs", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Documented", type: "http", seq: 1 },
      http: { method: "GET", url: "{{baseUrl}}/docs" },
      docs: "Returns documentation for the API.",
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.docs).toBe("Returns documentation for the API.");
  });

  it("includes runtime when present", () => {
    const request: OpenCollectionRequest = {
      info: { name: "With Tests", type: "http", seq: 1 },
      http: { method: "GET", url: "{{baseUrl}}/data" },
      runtime: {
        scripts: [
          { type: "tests", code: 'test("ok", () => { expect(res.status).to.equal(200); });' },
        ],
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.runtime.scripts).toHaveLength(1);
    expect(parsed.runtime.scripts[0].type).toBe("tests");
  });

  it("produces form-urlencoded body", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Login", type: "http", seq: 1 },
      http: {
        method: "POST",
        url: "{{baseUrl}}/login",
        body: {
          type: "form-urlencoded",
          data: [
            { name: "username", value: "admin" },
            { name: "password", value: "secret" },
          ],
        },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.body.type).toBe("form-urlencoded");
    expect(parsed.http.body.data).toHaveLength(2);
    expect(parsed.http.body.data[0].name).toBe("username");
  });

  it("produces request with apikey auth", () => {
    const request: OpenCollectionRequest = {
      info: { name: "ApiKey", type: "http", seq: 1 },
      http: {
        method: "GET",
        url: "{{baseUrl}}/data",
        auth: { type: "apikey", key: "x-api-key", value: "{{api-key}}", placement: "header" },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.auth.type).toBe("apikey");
    expect(parsed.http.auth.key).toBe("x-api-key");
    expect(parsed.http.auth.value).toBe("{{api-key}}");
    expect(parsed.http.auth.placement).toBe("header");
  });

  it("produces request with default settings", () => {
    const request: OpenCollectionRequest = {
      info: { name: "With Settings", type: "http", seq: 1 },
      http: { method: "GET", url: "{{baseUrl}}/data" },
      settings: { encodeUrl: true, timeout: 0, followRedirects: true, maxRedirects: 5 },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.settings.encodeUrl).toBe(true);
    expect(parsed.settings.timeout).toBe(0);
    expect(parsed.settings.followRedirects).toBe(true);
    expect(parsed.settings.maxRedirects).toBe(5);
  });

  it("produces request with runtime assertions", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Asserted", type: "http", seq: 1 },
      http: { method: "GET", url: "{{baseUrl}}/data" },
      runtime: {
        assertions: [
          { expression: "res.status", operator: "eq", value: "200" },
          { expression: "res.body.name", operator: "isString" },
        ],
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.runtime.assertions).toHaveLength(2);
    expect(parsed.runtime.assertions[0]).toEqual({ expression: "res.status", operator: "eq", value: "200" });
    expect(parsed.runtime.assertions[1]).toEqual({ expression: "res.body.name", operator: "isString" });
  });

  it("produces multipart-form body", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Upload", type: "http", seq: 1 },
      http: {
        method: "POST",
        url: "{{baseUrl}}/upload",
        body: {
          type: "multipart-form",
          data: [
            { name: "file", value: "test.txt" },
            { name: "description", value: "A test file" },
          ],
        },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.body.type).toBe("multipart-form");
    expect(parsed.http.body.data).toHaveLength(2);
  });

  it("produces xml body", () => {
    const request: OpenCollectionRequest = {
      info: { name: "XML", type: "http", seq: 1 },
      http: {
        method: "POST",
        url: "{{baseUrl}}/xml",
        body: { type: "xml", data: "<root><name>test</name></root>" },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.body.type).toBe("xml");
    expect(parsed.http.body.data).toBe("<root><name>test</name></root>");
  });

  it("produces text body", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Text", type: "http", seq: 1 },
      http: {
        method: "POST",
        url: "{{baseUrl}}/text",
        body: { type: "text", data: "plain text content" },
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.body.type).toBe("text");
    expect(parsed.http.body.data).toBe("plain text content");
  });

  it("produces request with auth inherit", () => {
    const request: OpenCollectionRequest = {
      info: { name: "Inherit", type: "http", seq: 1 },
      http: {
        method: "GET",
        url: "{{baseUrl}}/data",
        auth: "inherit",
      },
    };
    const yaml = serializeRequest(request);
    const parsed = parse(yaml);
    expect(parsed.http.auth).toBe("inherit");
  });
});
