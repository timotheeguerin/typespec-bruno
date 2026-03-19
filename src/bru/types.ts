/** Represents a complete .bru file. */
export interface BruFile {
  meta: BruMeta;
  request: BruRequest;
  headers?: BruKeyValue[];
  queryParams?: BruKeyValue[];
  pathParams?: BruKeyValue[];
  body?: BruBody;
  auth?: BruAuth;
  docs?: string;
}

export interface BruMeta {
  name: string;
  type: "http";
  seq: number;
}

export interface BruRequest {
  method: BruHttpVerb;
  url: string;
  body: BruBodyMode;
  auth: BruAuthMode;
}

export type BruHttpVerb =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "head"
  | "options";

export type BruBodyMode =
  | "none"
  | "json"
  | "form-urlencoded"
  | "multipart-form"
  | "text"
  | "xml";

export type BruAuthMode =
  | "none"
  | "bearer"
  | "basic"
  | "apikey"
  | "inherit";

export interface BruKeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export type BruBody =
  | { type: "json"; content: string }
  | { type: "form-urlencoded"; fields: BruKeyValue[] }
  | { type: "multipart-form"; fields: BruKeyValue[] }
  | { type: "text"; content: string }
  | { type: "xml"; content: string };

export type BruAuth =
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | {
      type: "apikey";
      key: string;
      value: string;
      placement: "header" | "query";
    };

export interface BruEnvironment {
  name: string;
  variables: BruKeyValue[];
}

export interface BruCollectionMeta {
  version: string;
  name: string;
  type: "collection";
}

/** A request file with its relative path inside the collection. */
export interface BruFileEntry {
  /** Relative path segments (e.g., ["Pets", "list-pets.bru"]). */
  segments: string[];
  file: BruFile;
}
