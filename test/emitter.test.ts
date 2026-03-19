import { describe, it, expect, beforeAll } from "vitest";
import { createBrunoTestRunner } from "./test-host.js";
import type { BasicTestRunner } from "@typespec/compiler/testing";
import { ignoreDiagnostics } from "@typespec/compiler";
import { getAllHttpServices, getServers } from "@typespec/http";
import { convertPath, kebabCase, generateExampleValue } from "../src/utils.js";

describe("emitter integration", () => {
  let runner: BasicTestRunner;

  beforeAll(async () => {
    runner = await createBrunoTestRunner();
  });

  it("emits a basic GET operation", async () => {
    await runner.compile(`
      @service
      namespace PetStore;
      using TypeSpec.Http;

      @route("/pets")
      @get op listPets(): { @body pets: string[] };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    expect(httpServices).toHaveLength(1);
    const op = httpServices[0].operations[0];
    expect(op.verb).toBe("get");
    expect(op.path).toBe("/pets");
  });

  it("generates correct bruno path from URI template", () => {
    expect(convertPath("/pets")).toBe("/pets");
    expect(convertPath("/pets/{petId}")).toBe("/pets/:petId");
    expect(convertPath("/users/{userId}/pets/{petId}")).toBe("/users/:userId/pets/:petId");
    expect(convertPath("/pets{?limit,offset}")).toBe("/pets");
    expect(convertPath("/pets/{+path}")).toBe("/pets/:path");
  });

  it("generates correct kebab-case", () => {
    expect(kebabCase("listPets")).toBe("list-pets");
    expect(kebabCase("CreateUser")).toBe("create-user");
    expect(kebabCase("getByID")).toBe("get-by-id");
    expect(kebabCase("simple")).toBe("simple");
  });

  it("emits operation with path and query params", async () => {
    await runner.compile(`
      @service
      namespace PetStore;
      using TypeSpec.Http;

      @route("/pets/{petId}")
      @get op getPet(@path petId: int32, @query verbose: boolean): { @body pet: string };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const pathParams = op.parameters.parameters.filter((p) => p.type === "path");
    const queryParams = op.parameters.parameters.filter((p) => p.type === "query");
    expect(pathParams).toHaveLength(1);
    expect(queryParams).toHaveLength(1);
  });

  it("generates example body from model", async () => {
    await runner.compile(`
      @service
      namespace PetStore;
      using TypeSpec.Http;

      model Pet { name: string; age: int32; vaccinated: boolean; }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    expect(op.parameters.body).toBeDefined();

    const example = generateExampleValue(op.parameters.body!.type);
    expect(example).toEqual({ name: "string", age: 0, vaccinated: false });
  });

  it("handles @server decorator for environments", async () => {
    await runner.compile(`
      @service
      @server("https://api.example.com", "Production")
      namespace PetStore;
      using TypeSpec.Http;

      @route("/pets")
      @get op listPets(): { @body pets: string[] };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const servers = getServers(runner.program, httpServices[0].namespace);
    expect(servers).toBeDefined();
    expect(servers!).toHaveLength(1);
    expect(servers![0].url).toBe("https://api.example.com");
  });

  it("handles bearer auth", async () => {
    await runner.compile(`
      @service
      @useAuth(BearerAuth)
      namespace SecureApi;
      using TypeSpec.Http;

      @route("/data")
      @get op getData(): { @body data: string };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    expect(httpServices[0].authentication).toBeDefined();
    const scheme = httpServices[0].authentication!.options[0].schemes[0];
    expect(scheme.type).toBe("http");
  });

  it("handles nested model for body generation", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      model Address { street: string; city: string; }
      model User { name: string; address: Address; }

      @route("/users")
      @post op createUser(@body user: User): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const example = generateExampleValue(op.parameters.body!.type);
    expect(example).toEqual({
      name: "string",
      address: { street: "string", city: "string" },
    });
  });

  it("handles @opExample for body payload", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      model Pet { name: string; age: int32; }

      @route("/pets")
      @opExample(#{
        parameters: #{
          pet: #{name: "Buddy", age: 3}
        }
      })
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const { getOpExamples, serializeValueAsJson } = await import("@typespec/compiler");
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const opExamples = getOpExamples(runner.program, op.operation);
    expect(opExamples).toHaveLength(1);

    const serialized = serializeValueAsJson(
      runner.program,
      opExamples[0].parameters!,
      op.operation.parameters,
    );
    expect(serialized).toEqual({ pet: { name: "Buddy", age: 3 } });
  });

  it("handles @example on model type", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      @example(#{name: "Luna", age: 5})
      model Pet { name: string; age: int32; }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const { getExamples, serializeValueAsJson } = await import("@typespec/compiler");
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const bodyType = op.parameters.body!.type;
    const examples = getExamples(runner.program, bodyType as any);
    expect(examples).toHaveLength(1);
    const serialized = serializeValueAsJson(runner.program, examples[0].value, bodyType);
    expect(serialized).toEqual({ name: "Luna", age: 5 });
  });

  it("handles interface-based grouping", async () => {
    await runner.compile(`
      @service
      namespace PetStore;
      using TypeSpec.Http;

      @route("/pets")
      interface Pets {
        @get list(): { @body pets: string[] };
        @post create(@body name: string): { @statusCode _: 201 };
      }

      @route("/owners")
      interface Owners {
        @get list(): { @body owners: string[] };
      }
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    expect(httpServices[0].operations).toHaveLength(3);
    const petOps = httpServices[0].operations.filter((op) => op.container.name === "Pets");
    expect(petOps).toHaveLength(2);
  });
});
