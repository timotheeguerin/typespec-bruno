import {
  createTestHost,
  createTestRunner,
  type BasicTestRunner,
} from "@typespec/compiler/testing";
import { HttpTestLibrary } from "@typespec/http/testing";
import { OpenAPITestLibrary } from "@typespec/openapi/testing";
import { OpenCollectionTestLibrary } from "./test-lib.js";

export async function createTestRunner(): Promise<BasicTestRunner> {
  const host = await createTestHost({
    libraries: [HttpTestLibrary, OpenAPITestLibrary, OpenCollectionTestLibrary],
  });
  return createTestRunner(host);
}
