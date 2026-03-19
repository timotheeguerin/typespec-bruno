import { stringify } from "yaml";
import type {
  OpenCollectionRequest,
  OpenCollectionRoot,
  OpenCollectionEnvironment,
} from "./types.js";

/** Serialize an OpenCollection request to YAML. */
export function serializeRequest(request: OpenCollectionRequest): string {
  return stringify(request, { lineWidth: 0 });
}

/** Serialize the root opencollection.yml. */
export function serializeRoot(root: OpenCollectionRoot): string {
  return stringify(root, { lineWidth: 0 });
}

/** Serialize an environment file to YAML. */
export function serializeEnvironment(env: OpenCollectionEnvironment): string {
  return stringify(env, { lineWidth: 0 });
}
