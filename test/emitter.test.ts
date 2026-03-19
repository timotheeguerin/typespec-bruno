import { describe, it, expect, beforeAll } from "vitest";
import { createBrunoTestRunner } from "./test-host.js";
import type { BasicTestRunner } from "@typespec/compiler/testing";
import {
  listServices,
  ignoreDiagnostics,
} from "@typespec/compiler";
import {
  getAllHttpServices,
  getServers,
} from "@typespec/http";
import type { BruFileEntry, BruEnvironment, BruCollectionMeta } from "../src/bru/types.js";
import { writeBruFile, writeBruEnvironment, writeBrunoJson } from "../src/bru/writer.js";
import {
  kebabCase,
  toBruVerb,
  convertPath,
  generateExampleValue,
} from "../src/utils.js";
import type {
  BruFile,
  BruRequest,
  BruKeyValue,
  BruBody,
  BruAuth,
  BruAuthMode,
  BruBodyMode,
} from "../src/bru/types.js";

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

    const service = httpServices[0];
    expect(service.operations).toHaveLength(1);

    const op = service.operations[0];
    expect(op.verb).toBe("get");
    expect(op.path).toBe("/pets");
    expect(op.operation.name).toBe("listPets");
  });

  it("generates correct bruno path from URI template", () => {
    expect(convertPath("/pets")).toBe("/pets");
    expect(convertPath("/pets/{petId}")).toBe("/pets/:petId");
    expect(convertPath("/users/{userId}/pets/{petId}")).toBe(
      "/users/:userId/pets/:petId",
    );
    expect(convertPath("/pets{?limit,offset}")).toBe("/pets");
    expect(convertPath("/pets/{+path}")).toBe("/pets/:path");
  });

  it("generates correct kebab-case", () => {
    expect(kebabCase("listPets")).toBe("list-pets");
    expect(kebabCase("CreateUser")).toBe("create-user");
    expect(kebabCase("getByID")).toBe("get-by-id");
    expect(kebabCase("simple")).toBe("simple");
    expect(kebabCase("already-kebab")).toBe("already-kebab");
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

    expect(op.verb).toBe("get");
    expect(op.path).toBe("/pets/{petId}");

    // Check params
    const pathParams = op.parameters.parameters.filter((p) => p.type === "path");
    const queryParams = op.parameters.parameters.filter((p) => p.type === "query");
    expect(pathParams).toHaveLength(1);
    expect(queryParams).toHaveLength(1);
  });

  it("emits operation with request body", async () => {
    await runner.compile(`
      @service
      namespace PetStore;
      using TypeSpec.Http;

      model Pet {
        name: string;
        age: int32;
        vaccinated: boolean;
      }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];

    expect(op.verb).toBe("post");
    expect(op.parameters.body).toBeDefined();
    expect(op.parameters.body!.bodyKind).toBe("single");

    // Generate example from body type
    const example = generateExampleValue(op.parameters.body!.type);
    expect(example).toEqual({
      name: "string",
      age: 0,
      vaccinated: false,
    });
  });

  it("generates complete .bru file for POST with body", async () => {
    await runner.compile(`
      @service
      namespace PetStore;
      using TypeSpec.Http;

      model Pet {
        name: string;
        age: int32;
      }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];

    const file: BruFile = {
      meta: { name: "createPet", type: "http", seq: 1 },
      request: {
        method: toBruVerb(op.verb),
        url: `{{baseUrl}}${convertPath(op.uriTemplate)}`,
        body: "json",
        auth: "none",
      },
      body: {
        type: "json",
        content: JSON.stringify(
          generateExampleValue(op.parameters.body!.type),
          null,
          2,
        ),
      },
    };

    const bruText = writeBruFile(file);
    expect(bruText).toContain("meta {");
    expect(bruText).toContain("  name: createPet");
    expect(bruText).toContain("post {");
    expect(bruText).toContain("  url: {{baseUrl}}/pets");
    expect(bruText).toContain("  body: json");
    expect(bruText).toContain("body:json {");
    expect(bruText).toContain('"name": "string"');
    expect(bruText).toContain('"age": 0');
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
    expect(servers![0].description).toBe("Production");
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
    const service = httpServices[0];

    expect(service.authentication).toBeDefined();
    expect(service.authentication!.options).toHaveLength(1);

    const scheme = service.authentication!.options[0].schemes[0];
    expect(scheme.type).toBe("http");
    expect((scheme as any).scheme).toBe("bearer");
  });

  it("handles operation with header params", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      @route("/data")
      @get op getData(@header("X-Request-Id") requestId: string): { @body data: string };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];

    const headerParams = op.parameters.parameters.filter(
      (p) => p.type === "header",
    );
    expect(headerParams).toHaveLength(1);
    expect(headerParams[0].name).toBe("X-Request-Id");
  });

  it("handles nested model for body generation", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      model Address {
        street: string;
        city: string;
        zip: string;
      }

      model User {
        name: string;
        email: string;
        address: Address;
      }

      @route("/users")
      @post op createUser(@body user: User): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const example = generateExampleValue(op.parameters.body!.type);

    expect(example).toEqual({
      name: "string",
      email: "string",
      address: {
        street: "string",
        city: "string",
        zip: "string",
      },
    });
  });

  it("handles enum types in body generation", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      enum PetType {
        dog,
        cat,
        bird,
      }

      model Pet {
        name: string;
        type: PetType;
      }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const example = generateExampleValue(op.parameters.body!.type) as Record<string, unknown>;

    expect(example.name).toBe("string");
    // First enum member
    expect(example.type).toBe("dog");
  });

  it("handles optional properties in body generation", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      model Pet {
        name: string;
        nickname?: string;
        age: int32;
      }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const example = generateExampleValue(op.parameters.body!.type) as Record<string, unknown>;

    // All properties should be present, including optional
    expect(example).toHaveProperty("name");
    expect(example).toHaveProperty("nickname");
    expect(example).toHaveProperty("age");
  });

  it("handles @doc decorator", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      /** List all available pets in the store */
      @route("/pets")
      @get op listPets(): { @body pets: string[] };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];

    const { getDoc } = await import("@typespec/compiler");
    const doc = getDoc(runner.program, op.operation);
    expect(doc).toBe("List all available pets in the store");
  });

  it("handles multiple operations in same service", async () => {
    await runner.compile(`
      @service
      namespace PetStore;
      using TypeSpec.Http;

      @route("/pets")
      @get op listPets(): { @body pets: string[] };

      @route("/pets/{petId}")
      @get op getPet(@path petId: int32): { @body pet: string };

      @route("/pets")
      @post op createPet(@body name: string): { @statusCode _: 201 };

      @route("/pets/{petId}")
      @delete op deletePet(@path petId: int32): { @statusCode _: 204 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    expect(httpServices[0].operations).toHaveLength(4);

    const verbs = httpServices[0].operations.map((op) => op.verb);
    expect(verbs).toContain("get");
    expect(verbs).toContain("post");
    expect(verbs).toContain("delete");
  });

  it("handles interface-based operation grouping", async () => {
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

    // Check that operations have interface containers
    const petOps = httpServices[0].operations.filter(
      (op) => op.container.name === "Pets",
    );
    const ownerOps = httpServices[0].operations.filter(
      (op) => op.container.name === "Owners",
    );
    expect(petOps).toHaveLength(2);
    expect(ownerOps).toHaveLength(1);
  });

  it("uses @opExample for body payload", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      model Pet {
        name: string;
        age: int32;
        vaccinated: boolean;
      }

      @route("/pets")
      @opExample(#{
        parameters: #{
          pet: #{name: "Buddy", age: 3, vaccinated: true}
        }
      })
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const { getOpExamples, serializeValueAsJson } = await import("@typespec/compiler");
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];

    const opExamples = getOpExamples(runner.program, op.operation);
    expect(opExamples).toHaveLength(1);
    expect(opExamples[0].parameters).toBeDefined();

    // Serialize the example parameters
    const serialized = serializeValueAsJson(
      runner.program,
      opExamples[0].parameters!,
      op.operation.parameters,
    );
    expect(serialized).toEqual({
      pet: { name: "Buddy", age: 3, vaccinated: true },
    });
  });

  it("uses @opExample for path and query parameter values", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      @route("/pets/{petId}")
      @opExample(#{
        parameters: #{
          petId: 42,
          verbose: true
        }
      })
      @get op getPet(@path petId: int32, @query verbose?: boolean): { @body pet: string };
    `);

    const { getOpExamples, serializeValueAsJson } = await import("@typespec/compiler");
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];

    const opExamples = getOpExamples(runner.program, op.operation);
    const serialized = serializeValueAsJson(
      runner.program,
      opExamples[0].parameters!,
      op.operation.parameters,
    );

    expect((serialized as any).petId).toBe(42);
    expect((serialized as any).verbose).toBe(true);
  });

  it("uses @example on model type for body payload", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      @example(#{
        name: "Luna",
        age: 5,
      })
      model Pet {
        name: string;
        age: int32;
      }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const { getExamples, serializeValueAsJson } = await import("@typespec/compiler");
    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const bodyType = op.parameters.body!.type;

    const examples = getExamples(runner.program, bodyType as any);
    expect(examples).toHaveLength(1);

    const serialized = serializeValueAsJson(
      runner.program,
      examples[0].value,
      bodyType,
    );
    expect(serialized).toEqual({ name: "Luna", age: 5 });
  });

  it("prefers @opExample over @example on model", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      @example(#{
        name: "Luna",
        age: 5,
      })
      model Pet {
        name: string;
        age: int32;
      }

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
    const serialized = serializeValueAsJson(
      runner.program,
      opExamples[0].parameters!,
      op.operation.parameters,
    );

    // @opExample should take priority — "Buddy" not "Luna"
    expect((serialized as any).pet.name).toBe("Buddy");
  });

  it("falls back to generated values when no examples defined", async () => {
    await runner.compile(`
      @service
      namespace Api;
      using TypeSpec.Http;

      model Pet {
        name: string;
        age: int32;
      }

      @route("/pets")
      @post op createPet(@body pet: Pet): { @statusCode _: 201 };
    `);

    const httpServices = ignoreDiagnostics(getAllHttpServices(runner.program));
    const op = httpServices[0].operations[0];
    const example = generateExampleValue(op.parameters.body!.type);

    // Falls back to type-based placeholders
    expect(example).toEqual({ name: "string", age: 0 });
  });
});
