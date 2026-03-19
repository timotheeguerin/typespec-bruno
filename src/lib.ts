import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";

export interface BrunoEmitterOptions {
  "output-dir"?: string;
}

const EmitterOptionsSchema: JSONSchemaType<BrunoEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "output-dir": {
      type: "string",
      nullable: true,
      description: "Output directory for the Bruno collection",
    },
  },
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
