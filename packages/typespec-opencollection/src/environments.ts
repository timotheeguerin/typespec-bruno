import type { Program, Namespace } from "@typespec/compiler";
import { getServers } from "@typespec/http";
import type { OpenCollectionEnvironment } from "./types.js";
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
        info: { name: "Default", type: "env" },
        vars: { baseUrl: "http://localhost:3000" },
      },
    }];
  }

  return servers.map((server, index) => {
    const vars: Record<string, string> = { baseUrl: server.url };
    if (server.parameters) {
      for (const [name, param] of server.parameters) {
        vars[name] = String(generateSample(param.type));
      }
    }
    const description =
      server.description ?? (servers.length === 1 ? "Default" : `Server ${index + 1}`);
    return {
      name: kebabCase(description),
      data: {
        info: { name: description, type: "env" as const },
        vars,
      },
    };
  });
}
