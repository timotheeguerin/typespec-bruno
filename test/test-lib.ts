import { createTestLibrary } from "@typespec/compiler/testing";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const BrunoTestLibrary = createTestLibrary({
  name: "typespec-bruno",
  packageRoot: resolve(__dirname, ".."),
});
