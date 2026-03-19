import { describe, it, expect } from "vitest";
import { render, stc } from "@alloy-js/core";
import { Output as OutputComponent, SourceFile as SourceFileComponent } from "@alloy-js/core";
import type { Children } from "@alloy-js/core";
import { BruMeta } from "../src/components/BruMeta.js";
import { BruMethod } from "../src/components/BruMethod.js";
import { BruQueryParams, BruPathParams } from "../src/components/BruParams.js";
import { BruHeaders } from "../src/components/BruHeaders.js";
import { BruBody } from "../src/components/BruBody.js";
import { BruAuth } from "../src/components/BruAuth.js";
import { BruDocs } from "../src/components/BruDocs.js";
import { BruEnvironment } from "../src/components/BruEnvironment.js";
import { BruFile } from "../src/components/BruFile.js";

const Output = stc(OutputComponent);
const SourceFile = stc(SourceFileComponent);

/** Render a bru component to a string via alloy's render pipeline. */
function renderBru(component: Children): string {
  const output = render(
    Output().children(
      SourceFile({ path: "test.bru", filetype: "bru" }).children(component),
    ),
  );
  return output.contents[0].contents as string;
}

describe("BruMeta component", () => {
  it("renders meta block", () => {
    const result = renderBru(BruMeta({ name: "List Pets", seq: 1 }));
    expect(result).toContain("meta {");
    expect(result).toContain("  name: List Pets");
    expect(result).toContain("  type: http");
    expect(result).toContain("  seq: 1");
  });
});

describe("BruMethod component", () => {
  it("renders get block", () => {
    const result = renderBru(
      BruMethod({ verb: "get", url: "{{baseUrl}}/pets", body: "none", auth: "none" }),
    );
    expect(result).toContain("get {");
    expect(result).toContain("  url: {{baseUrl}}/pets");
    expect(result).toContain("  body: none");
    expect(result).toContain("  auth: none");
  });

  it("renders post block", () => {
    const result = renderBru(
      BruMethod({ verb: "post", url: "{{baseUrl}}/pets", body: "json", auth: "bearer" }),
    );
    expect(result).toContain("post {");
    expect(result).toContain("  body: json");
    expect(result).toContain("  auth: bearer");
  });
});

describe("BruParams components", () => {
  it("renders query params with disabled entries", () => {
    const result = renderBru(
      BruQueryParams({
        params: [
          { key: "page", value: "1" },
          { key: "debug", value: "true", enabled: false },
        ],
      }),
    );
    expect(result).toContain("params:query {");
    expect(result).toContain("  page: 1");
    expect(result).toContain("  ~debug: true");
  });

  it("renders path params", () => {
    const result = renderBru(
      BruPathParams({ params: [{ key: "petId", value: "123" }] }),
    );
    expect(result).toContain("params:path {");
    expect(result).toContain("  petId: 123");
  });

  it("returns empty for no params", () => {
    const result = renderBru(BruQueryParams({ params: [] }));
    expect(result).not.toContain("params:query");
  });
});

describe("BruHeaders component", () => {
  it("renders headers block", () => {
    const result = renderBru(
      BruHeaders({
        headers: [
          { key: "x-request-id", value: "{{requestId}}" },
          { key: "x-optional", value: "val", enabled: false },
        ],
      }),
    );
    expect(result).toContain("headers {");
    expect(result).toContain("  x-request-id: {{requestId}}");
    expect(result).toContain("  ~x-optional: val");
  });
});

describe("BruBody component", () => {
  it("renders JSON body", () => {
    const result = renderBru(
      BruBody({
        type: "json",
        content: JSON.stringify({ name: "Fido", age: 3 }, null, 2),
      }),
    );
    expect(result).toContain("body:json {");
    expect(result).toContain('"name": "Fido"');
  });

  it("renders form-urlencoded body", () => {
    const result = renderBru(
      BruBody({
        type: "form-urlencoded",
        fields: [
          { key: "username", value: "admin" },
          { key: "password", value: "secret" },
        ],
      }),
    );
    expect(result).toContain("body:form-urlencoded {");
    expect(result).toContain("  username: admin");
  });
});

describe("BruAuth component", () => {
  it("renders bearer auth", () => {
    const result = renderBru(BruAuth({ type: "bearer", token: "{{token}}" }));
    expect(result).toContain("auth:bearer {");
    expect(result).toContain("  token: {{token}}");
  });

  it("renders basic auth", () => {
    const result = renderBru(
      BruAuth({ type: "basic", username: "{{user}}", password: "{{pass}}" }),
    );
    expect(result).toContain("auth:basic {");
    expect(result).toContain("  username: {{user}}");
    expect(result).toContain("  password: {{pass}}");
  });

  it("renders apikey auth", () => {
    const result = renderBru(
      BruAuth({ type: "apikey", key: "X-API-Key", value: "{{apiKey}}", placement: "header" }),
    );
    expect(result).toContain("auth:apikey {");
    expect(result).toContain("  key: X-API-Key");
    expect(result).toContain("  placement: header");
  });
});

describe("BruDocs component", () => {
  it("renders docs block", () => {
    const result = renderBru(BruDocs({ content: "Gets a list of pets." }));
    expect(result).toContain("docs {");
    expect(result).toContain("Gets a list of pets.");
  });
});

describe("BruEnvironment component", () => {
  it("renders environment vars", () => {
    const result = renderBru(
      BruEnvironment({
        variables: [
          { key: "baseUrl", value: "http://localhost:3000" },
          { key: "apiKey", value: "dev-key" },
        ],
      }),
    );
    expect(result).toContain("vars {");
    expect(result).toContain("  baseUrl: http://localhost:3000");
    expect(result).toContain("  apiKey: dev-key");
  });
});

describe("BruFile composite component", () => {
  it("renders a complete GET request", () => {
    const result = renderBru(
      BruFile({
        meta: { name: "List Pets", seq: 1 },
        method: { verb: "get", url: "{{baseUrl}}/pets", body: "none", auth: "none" },
      }),
    );
    expect(result).toContain("meta {");
    expect(result).toContain("get {");
  });

  it("renders a full POST with all blocks in order", () => {
    const result = renderBru(
      BruFile({
        meta: { name: "Create Pet", seq: 2 },
        method: { verb: "post", url: "{{baseUrl}}/pets", body: "json", auth: "bearer" },
        queryParams: [{ key: "notify", value: "true" }],
        headers: [{ key: "x-trace-id", value: "{{traceId}}" }],
        body: {
          type: "json",
          content: JSON.stringify({ name: "Rex" }, null, 2),
        },
        auth: { type: "bearer", token: "{{token}}" },
        docs: "Create a new pet.",
      }),
    );

    expect(result).toContain("meta {");
    expect(result).toContain("post {");
    expect(result).toContain("params:query {");
    expect(result).toContain("headers {");
    expect(result).toContain("body:json {");
    expect(result).toContain("auth:bearer {");
    expect(result).toContain("docs {");

    // Verify block ordering
    const metaIdx = result.indexOf("meta {");
    const postIdx = result.indexOf("post {");
    const bodyIdx = result.indexOf("body:json {");
    const authIdx = result.indexOf("auth:bearer {");
    const docsIdx = result.indexOf("docs {");
    expect(metaIdx).toBeLessThan(postIdx);
    expect(postIdx).toBeLessThan(bodyIdx);
    expect(bodyIdx).toBeLessThan(authIdx);
    expect(authIdx).toBeLessThan(docsIdx);
  });
});
