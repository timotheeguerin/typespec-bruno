import { defineLinter } from "@typespec/compiler";
import { missingOpExampleRule } from "./rules/missing-op-example.js";

export const $linter = defineLinter({
  rules: [missingOpExampleRule],
  ruleSets: {
    recommended: {
      enable: {
        [`typespec-opencollection/${missingOpExampleRule.name}`]: true,
      },
    },
  },
});
