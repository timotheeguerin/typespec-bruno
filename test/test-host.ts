import {
  createTestHost,
  createTestRunner,
  type BasicTestRunner,
} from "@typespec/compiler/testing";
import { HttpTestLibrary } from "@typespec/http/testing";
import { OpenAPITestLibrary } from "@typespec/openapi/testing";
import { BrunoTestLibrary } from "./test-lib.js";

export async function createBrunoTestRunner(): Promise<BasicTestRunner> {
  const host = await createTestHost({
    libraries: [HttpTestLibrary, OpenAPITestLibrary, BrunoTestLibrary],
  });
  return createTestRunner(host);
}
