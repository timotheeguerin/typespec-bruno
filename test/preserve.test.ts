import { describe, it, expect } from "vitest";
import { extractPreservedSections } from "../src/preserve.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("extractPreservedSections", () => {
  const testDir = join(tmpdir(), "typespec-bruno-test-" + Date.now());

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
    expect(sections).toEqual({});
    await rm(testDir, { recursive: true });
  });
});
