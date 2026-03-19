import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";

export interface BrunoEmitterOptions {
}

const EmitterOptionsSchema: JSONSchemaType<BrunoEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {},
  required: [],
};

export const $lib = createTypeSpecLibrary({
  name: "typespec-bruno",
  diagnostics: {
    "unsupported-auth": {
      severity: "warning",
      messages: {
        default:
          "Authentication scheme is not supported by Bruno emitter and will be skipped.",
      },
    },
    "unsupported-body": {
      severity: "warning",
      messages: {
        default:
          "Body type is not supported by Bruno emitter and will be skipped.",
      },
    },
  },
  emitter: {
    options: EmitterOptionsSchema,
  },
});

export const { reportDiagnostic } = $lib;
