import { describe, it, expect, beforeAll } from "vitest";
import { generateSample } from "../src/index.js";
import {
  createTestHost,
  createTestRunner,
  type BasicTestRunner,
} from "@typespec/compiler/testing";
import { ignoreDiagnostics } from "@typespec/compiler";

async function createRunner(): Promise<BasicTestRunner> {
  const host = await createTestHost({ libraries: [] });
  return createTestRunner(host);
}

describe("generateSample", () => {
  let runner: BasicTestRunner;

  beforeAll(async () => {
    runner = await createRunner();
  });

  it("generates string sample", async () => {
    await runner.compile(`model M { name: string; }`);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result = generateSample(model) as Record<string, unknown>;
    expect(typeof result.name).toBe("string");
    expect((result.name as string).length).toBeGreaterThan(0);
  });

  it("generates integer sample", async () => {
    await runner.compile(`model M { age: int32; }`);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result = generateSample(model) as Record<string, unknown>;
    expect(typeof result.age).toBe("number");
    expect(Number.isInteger(result.age)).toBe(true);
  });

  it("generates boolean sample", async () => {
    await runner.compile(`model M { active: boolean; }`);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result = generateSample(model) as Record<string, unknown>;
    expect(typeof result.active).toBe("boolean");
  });

  it("generates nested model sample", async () => {
    await runner.compile(`
      model Address { street: string; city: string; }
      model User { name: string; address: Address; }
    `);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("User")!;
    const result = generateSample(model) as Record<string, unknown>;
    expect(typeof result.name).toBe("string");
    const address = result.address as Record<string, unknown>;
    expect(typeof address.street).toBe("string");
    expect(typeof address.city).toBe("string");
  });

  it("generates enum sample", async () => {
    await runner.compile(`
      enum Status { active, inactive, pending }
      model M { status: Status; }
    `);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result = generateSample(model) as Record<string, unknown>;
    expect(["active", "inactive", "pending"]).toContain(result.status);
  });

  it("generates array sample", async () => {
    await runner.compile(`model M { tags: string[]; }`);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result = generateSample(model) as Record<string, unknown>;
    expect(Array.isArray(result.tags)).toBe(true);
    expect((result.tags as unknown[]).length).toBeGreaterThan(0);
  });

  it("is deterministic across calls", async () => {
    await runner.compile(`model M { name: string; count: int32; }`);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result1 = generateSample(model);
    const result2 = generateSample(model);
    expect(result1).toEqual(result2);
  });

  it("produces different values for different property names", async () => {
    await runner.compile(`model M { firstName: string; lastName: string; }`);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result = generateSample(model) as Record<string, unknown>;
    expect(result.firstName).not.toBe(result.lastName);
  });

  it("respects seed option", async () => {
    await runner.compile(`model M { name: string; }`);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("M")!;
    const result1 = generateSample(model, { seed: "a" });
    const result2 = generateSample(model, { seed: "b" });
    expect(result1).not.toEqual(result2);
  });

  it("respects maxDepth", async () => {
    await runner.compile(`
      model Deep { child: Deep; name: string; }
    `);
    const model = runner.program.checker.getGlobalNamespaceType().models.get("Deep")!;
    const result = generateSample(model, { maxDepth: 2 }) as Record<string, unknown>;
    expect(typeof result.name).toBe("string");
    // Should not infinitely recurse
    expect(result.child).toBeDefined();
  });
});
