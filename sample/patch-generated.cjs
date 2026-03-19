// Patches alpha bugs in @typespec/http-server-js generated code.
// Remove when the emitter stabilizes.
const fs = require("fs");
const f = "tsp-output/src/generated/http/operations/server-raw.ts";
let c = fs.readFileSync(f, "utf8");
// Fix: Pet[].toJsonObject(x) → x.map((i) => Pet.toJsonObject(i))
c = c.replace(/(\w+)\[\]\.toJsonObject\(([^)]+)\)/g, "$2.map((i) => $1.toJsonObject(i))");
// Suppress type errors in generated code
if (!c.startsWith("// @ts-nocheck")) {
  c = "// @ts-nocheck\n" + c;
}
fs.writeFileSync(f, c);
