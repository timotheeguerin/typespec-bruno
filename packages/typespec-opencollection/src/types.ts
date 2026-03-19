/**
 * TypeScript types for OpenCollection YAML request files.
 */

export interface OpenCollectionRequest {
  info: RequestInfo;
  http: HttpConfig;
  runtime?: RuntimeConfig;
  settings?: Settings;
  docs?: string;
}

export interface RequestInfo {
  name: string;
  type: "http";
  seq: number;
}

export interface HttpConfig {
  method: string;
  url: string;
  params?: ParamEntry[];
  headers?: HeaderEntry[];
  body?: BodyConfig;
  auth?: AuthConfig;
}

export interface ParamEntry {
  name: string;
  value: string;
  type: "query" | "path";
  disabled?: boolean;
}

export interface HeaderEntry {
  name: string;
  value: string;
  disabled?: boolean;
}

export type BodyConfig = {
  type: "json" | "text" | "xml";
  data: string;
} | {
  type: "form-urlencoded" | "multipart-form";
  data: FormField[];
};

export interface FormField {
  name: string;
  value: string;
}

export type AuthConfig =
  | "inherit"
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; key: string; value: string; placement: string };

export interface RuntimeConfig {
  scripts?: ScriptEntry[];
  assertions?: AssertionEntry[];
}

export interface ScriptEntry {
  type: "before-request" | "after-response" | "tests";
  code: string;
}

export interface AssertionEntry {
  expression: string;
  operator: string;
  value?: string;
}

export interface Settings {
  encodeUrl?: boolean;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
}

/** Root opencollection.yml */
export interface OpenCollectionRoot {
  info: {
    name: string;
    type: "collection";
  };
}

/** Environment file */
export interface OpenCollectionEnvironment {
  name: string;
  variables: EnvironmentVariable[];
}

export interface EnvironmentVariable {
  name: string;
  value: string;
  disabled?: boolean;
}

/** A request file with its relative path inside the collection. */
export interface FileEntry {
  segments: string[];
  request: OpenCollectionRequest;
}
