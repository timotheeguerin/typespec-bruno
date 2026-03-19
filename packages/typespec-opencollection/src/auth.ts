import type { HttpAuth, Authentication } from "@typespec/http";
import type { AuthConfig } from "./types.js";
import { kebabCase } from "./utils.js";

export function resolveAuth(authentication?: Authentication): AuthConfig | undefined {
  if (!authentication || authentication.options.length === 0) return undefined;
  const schemes = authentication.options[0].schemes;
  if (schemes.length === 0) return undefined;
  return mapAuthScheme(schemes[0]);
}

function mapAuthScheme(scheme: HttpAuth): AuthConfig | undefined {
  if (scheme.type === "http" && scheme.scheme === "Bearer") {
    return { type: "bearer", token: "{{token}}" };
  }
  if (scheme.type === "http" && scheme.scheme === "Basic") {
    return { type: "basic", username: "{{username}}", password: "{{password}}" };
  }
  if (scheme.type === "apiKey") {
    return {
      type: "apikey",
      key: scheme.name,
      value: `{{${kebabCase(scheme.name)}}}`,
      placement: scheme.in === "query" ? "query" : "header",
    };
  }
  return undefined;
}
