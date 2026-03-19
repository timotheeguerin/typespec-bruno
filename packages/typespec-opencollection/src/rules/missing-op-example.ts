import {
  createRule,
  paramMessage,
  defineCodeFix,
  getSourceLocation,
  getOpExamples,
  type Type,
} from "@typespec/compiler";
import { generateOpExampleDecorator } from "../example-literal.js";

export const missingOpExampleRule = createRule({
  name: "missing-op-example",
  severity: "warning",
  description:
    "Operations without @opExample will use auto-generated sample values in the collection.",
  messages: {
    default: paramMessage`Operation "${"operationName"}" has no @opExample. Sample values were generated automatically.`,
  },
  create(context) {
    return {
      operation: (op) => {
        const examples = getOpExamples(context.program, op);
        if (examples.length > 0) return;

        const paramInfos: { name: string; type: Type }[] = [];
        for (const [name, param] of op.parameters.properties) {
          paramInfos.push({ name, type: param.type });
        }

        const returnType = op.returnType.kind !== "Intrinsic" ? op.returnType : undefined;
        const decoratorText = generateOpExampleDecorator(paramInfos, undefined, returnType);

        const codefix = defineCodeFix({
          id: "add-op-example",
          label: "Add @opExample decorator with sample values",
          fix: (fixContext) => {
            const location = getSourceLocation(op);
            return fixContext.prependText(location, decoratorText + "\n");
          },
        });

        context.reportDiagnostic({
          target: op,
          format: { operationName: op.name },
          codefixes: [codefix],
        });
      },
    };
  },
});
