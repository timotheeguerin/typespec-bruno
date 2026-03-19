import { describe, it, expect, beforeAll } from "vitest";
import { createTestRunner } from "./test-host.js";
import type { BasicTestRunner } from "@typespec/compiler/testing";
import { ignoreDiagnostics } from "@typespec/compiler";
import { getAllHttpServices, getServers } from "@typespec/http";
import { convertPath, kebabCase } from "../src/utils.js";
import { generateSample } from "typespec-random-sample";

describe("emitter integration", () => {
  let runner: BasicTestRunner;

  beforeAll(async () => {
    runner = await createTestRunner();
  });

  it("converts URI templates to OpenCollection paths", () => {
    expect(convertPath("/pets")).toBe("/pets");
    expect(convertPath("/pets/{petId}")).toBe("/pets/:petId");
    expect(convertPath("/users/{userId}/pets/{petId}")).toBe("/users/:userId/pets/:petId");
    expect(convertPath("/pets{?limit,offset}")).toBe("/pets");
  });

  it("converts to kebab-case", () => {
    expect(kebabCase("listPets")).toBe("list-pets");
    expect(kebabCase("CreateUser")).toBe("create-user");
    expect(kebabCase("getByID")).toBe("get-by-id");
  });

  it("extracts HTTP operations from TypeSpec", async () => {
    await runner.compile(`
      @service namespace PetStore;
      using TypeSpec.Http;
      @route("/pets") @get op listPets(): { @body pets: string[] };
    `);
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    expect(httpServices).toHaveLength(1);
    expect(httpServices[0].operations[0].verb).toBe("get");
    expect(httpServices[0].operations[0].path).toBe("/pets");
  });

  it("extracts path and query params", async () => {
    await runner.compile(`
      @service namespace Api;
      using TypeSpec.Http;
      @route("/pets/{petId}")
      @get op getPet(@path petId: int32, @query verbose: boolean): { @body pet: string };
    `);
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    expect(op.parameters.parameters.filter((p) => p.type === "path")).toHaveLength(1);
    expect(op.parameters.parameters.filter((p) => p.type === "query")).toHaveLength(1);
  });

  it("generates example body from model", async () => {
    await runner.compile(`
      @service namespace Api;
      using TypeSpec.Http;
      model Pet { name: string; age: int32; ok: boolean; }
      @route("/pets") @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const example = generateSample(op.parameters.body!.type) as Record<string, unknown>;
    expect(typeof example.name).toBe("string");
    expect(typeof example.age).toBe("number");
    expect(Number.isInteger(example.age)).toBe(true);
    expect(typeof example.ok).toBe("boolean");
    // Deterministic: same call produces same result
    const example2 = generateSample(op.parameters.body!.type);
    expect(example).toEqual(example2);
  });

  it("extracts @server definitions", async () => {
    await runner.compile(`
      @service @server("https://api.example.com", "Production")
      namespace Api;
      using TypeSpec.Http;
      @route("/pets") @get op listPets(): { @body pets: string[] };
    `);
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const servers = getServers(runner.program, httpServices[0].namespace);
    expect(servers!).toHaveLength(1);
    expect(servers![0].url).toBe("https://api.example.com");
  });

  it("extracts bearer auth", async () => {
    await runner.compile(`
      @service @useAuth(BearerAuth)
      namespace Api;
      using TypeSpec.Http;
      @route("/data") @get op getData(): { @body data: string };
    `);
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    expect(httpServices[0].authentication).toBeDefined();
    expect(httpServices[0].authentication!.options[0].schemes[0].type).toBe("http");
  });

  it("generates nested model examples", async () => {
    await runner.compile(`
      @service namespace Api;
      using TypeSpec.Http;
      model Address { street: string; city: string; }
      model User { name: string; address: Address; }
      @route("/users") @post op createUser(@body user: User): { @statusCode _: 201 };
    `);
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const example = generateSample(httpServices[0].operations[0].parameters.body!.type) as Record<string, unknown>;
    expect(typeof example.name).toBe("string");
    const address = example.address as Record<string, unknown>;
    expect(typeof address.street).toBe("string");
    expect(typeof address.city).toBe("string");
  });

  it("uses @opExample for body payload", async () => {
    await runner.compile(`
      @service namespace Api;
      using TypeSpec.Http;
      model Pet { name: string; age: int32; }
      @route("/pets")
      @opExample(#{ parameters: #{ pet: #{name: "Buddy", age: 3} } })
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);
    const { getOpExamples, serializeValueAsJson } = await import("@typespec/compiler");
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const examples = getOpExamples(runner.program, op.operation);
    const serialized = serializeValueAsJson(runner.program, examples[0].parameters!, op.operation.parameters);
    expect(serialized).toEqual({ pet: { name: "Buddy", age: 3 } });
  });

  it("uses @example on model type", async () => {
    await runner.compile(`
      @service namespace Api;
      using TypeSpec.Http;
      @example(#{name: "Luna", age: 5})
      model Pet { name: string; age: int32; }
      @route("/pets") @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);
    const { getExamples, serializeValueAsJson } = await import("@typespec/compiler");
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const bodyType = httpServices[0].operations[0].parameters.body!.type;
    const examples = getExamples(runner.program, bodyType as any);
    const serialized = serializeValueAsJson(runner.program, examples[0].value, bodyType);
    expect(serialized).toEqual({ name: "Luna", age: 5 });
  });

  it("groups operations by interface", async () => {
    await runner.compile(`
      @service namespace PetStore;
      using TypeSpec.Http;
      @route("/pets") interface Pets {
        @get list(): { @body pets: string[] };
        @post create(@body name: string): { @statusCode _: 201 };
      }
      @route("/owners") interface Owners {
        @get list(): { @body owners: string[] };
      }
    `);
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    expect(httpServices[0].operations).toHaveLength(3);
    expect(httpServices[0].operations.filter((op) => op.container.name === "Pets")).toHaveLength(2);
  });
});
