import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";

export interface BrunoEmitterOptions {}

const EmitterOptionsSchema: JSONSchemaType<BrunoEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {},
  required: [],
};

export const $lib = createTypeSpecLibrary({
  name: "typespec-bruno",
  diagnostics: {},
  emitter: {
    options: EmitterOptionsSchema,
  },
});

export const { reportDiagnostic } = $lib;
