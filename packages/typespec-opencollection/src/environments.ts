import type { Program, Namespace } from "@typespec/compiler";
import { getServers } from "@typespec/http";
import type { OpenCollectionEnvironment, EnvironmentVariable } from "./types.js";
import { kebabCase } from "./utils.js";
import { generateSample } from "typespec-random-sample";

export interface EnvEntry {
  name: string;
  data: OpenCollectionEnvironment;
}

export function buildEnvironments(
  program: Program,
  namespace: Namespace,
): EnvEntry[] {
  const servers = getServers(program, namespace);
  if (!servers || servers.length === 0) {
    return [{
      name: "default",
      data: {
        name: "Default",
        variables: [{ name: "baseUrl", value: "http://localhost:3000" }],
      },
    }];
  }

  return servers.map((server, index) => {
    const variables: EnvironmentVariable[] = [
      { name: "baseUrl", value: server.url },
    ];
    if (server.parameters) {
      for (const [name, param] of server.parameters) {
        variables.push({ name, value: String(generateSample(param.type)) });
      }
    }
    const description =
      server.description ?? (servers.length === 1 ? "Default" : `Server ${index + 1}`);
    return {
      name: kebabCase(description),
      data: {
        name: description,
        variables,
      },
    };
  });
}
