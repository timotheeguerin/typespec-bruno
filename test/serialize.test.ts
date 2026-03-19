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
  it("produces environment with vars", () => {
    const env: OpenCollectionEnvironment = {
      info: { name: "Production", type: "env" },
      vars: { baseUrl: "https://api.example.com", apiKey: "secret" },
    };
    const yaml = serializeEnvironment(env);
    const parsed = parse(yaml);
    expect(parsed.info.name).toBe("Production");
    expect(parsed.info.type).toBe("env");
    expect(parsed.vars.baseUrl).toBe("https://api.example.com");
    expect(parsed.vars.apiKey).toBe("secret");
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
});
