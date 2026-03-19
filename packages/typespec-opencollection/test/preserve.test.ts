import { describe, it, expect } from "vitest";
import { extractPreservedSections } from "../src/preserve.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("extractPreservedSections", () => {
  const testDir = join(tmpdir(), "typespec-opencollection-test-" + Date.now());

  it("returns empty for non-existent file", async () => {
    const sections = await extractPreservedSections("/non/existent/file.yml");
    expect(sections).toEqual({});
  });

  it("preserves runtime section", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "test1.yml");
    await writeFile(
      filePath,
      `info:
  name: Get Pet
  type: http
  seq: 1
http:
  method: GET
  url: "{{baseUrl}}/pets/:petId"
runtime:
  scripts:
    - type: tests
      code: |-
        test("status is 200", function() {
          expect(res.status).to.equal(200);
        });
  assertions:
    - expression: res.status
      operator: eq
      value: "200"
settings:
  encodeUrl: true
  timeout: 5000
`,
    );

    const sections = await extractPreservedSections(filePath);
    expect(sections.runtime).toBeDefined();
    expect(sections.runtime!.scripts).toHaveLength(1);
    expect(sections.runtime!.scripts![0].type).toBe("tests");
    expect(sections.runtime!.assertions).toHaveLength(1);
    expect(sections.settings).toBeDefined();
    expect(sections.settings!.encodeUrl).toBe(true);
    expect(sections.settings!.timeout).toBe(5000);
    await rm(testDir, { recursive: true });
  });

  it("returns empty when no runtime or settings", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "test2.yml");
    await writeFile(
      filePath,
      `info:
  name: Simple
  type: http
  seq: 1
http:
  method: GET
  url: "{{baseUrl}}/simple"
`,
    );

    const sections = await extractPreservedSections(filePath);
    expect(sections.runtime).toBeUndefined();
    expect(sections.settings).toBeUndefined();
    expect(sections.params).toBeUndefined();
    expect(sections.headers).toBeUndefined();
    expect(sections.body).toBeUndefined();
    await rm(testDir, { recursive: true });
  });

  it("extracts http params from existing file", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "test-params.yml");
    await writeFile(
      filePath,
      `info:
  name: List Pets
  type: http
  seq: 1
http:
  method: GET
  url: "{{baseUrl}}/pets"
  params:
    - name: limit
      value: "50"
      type: query
    - name: petId
      value: "abc-123"
      type: path
`,
    );

    const sections = await extractPreservedSections(filePath);
    expect(sections.params).toHaveLength(2);
    expect(sections.params![0]).toEqual({ name: "limit", value: "50", type: "query" });
    expect(sections.params![1]).toEqual({ name: "petId", value: "abc-123", type: "path" });
    await rm(testDir, { recursive: true });
  });

  it("extracts http headers from existing file", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "test-headers.yml");
    await writeFile(
      filePath,
      `info:
  name: Get Data
  type: http
  seq: 1
http:
  method: GET
  url: "{{baseUrl}}/data"
  headers:
    - name: X-Custom
      value: my-custom-value
`,
    );

    const sections = await extractPreservedSections(filePath);
    expect(sections.headers).toHaveLength(1);
    expect(sections.headers![0]).toEqual({ name: "X-Custom", value: "my-custom-value" });
    await rm(testDir, { recursive: true });
  });

  it("extracts http body from existing file", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "test-body.yml");
    await writeFile(
      filePath,
      `info:
  name: Create Pet
  type: http
  seq: 1
http:
  method: POST
  url: "{{baseUrl}}/pets"
  body:
    type: json
    data: '{"name":"Buddy","age":3}'
`,
    );

    const sections = await extractPreservedSections(filePath);
    expect(sections.body).toBeDefined();
    expect(sections.body!.type).toBe("json");
    expect(sections.body!.data).toBe('{"name":"Buddy","age":3}');
    await rm(testDir, { recursive: true });
  });
});
