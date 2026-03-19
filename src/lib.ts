import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";

export interface BrunoEmitterOptions {
  /** Preserve user-edited param, header, and body values from existing files. Default: true. */
  "preserve-values"?: boolean;
}

const EmitterOptionsSchema: JSONSchemaType<BrunoEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "preserve-values": {
      type: "boolean",
      nullable: true,
      description:
        "When true (default), user-edited parameter values, header values, and body data are preserved from existing files on re-emit.",
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
