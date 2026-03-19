import { createTester, findTestPackageRoot } from "@typespec/compiler/testing";

export async function createOpenCollectionTester() {
  const packageRoot = await findTestPackageRoot(import.meta.url);
  return createTester(packageRoot, {
    libraries: ["@typespec/http", "@typespec/openapi"],
  })
    .importLibraries()
    .using("TypeSpec.Http");
}
