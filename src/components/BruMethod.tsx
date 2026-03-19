import { Children } from "@alloy-js/core";
import { BruBlock } from "./BruBlock.js";

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

export interface BruMethodProps {
  verb: BruHttpVerb;
  url: string;
  body: BruBodyMode;
  auth: BruAuthMode;
}

export function BruMethod(props: BruMethodProps): Children {
  return BruBlock({
    name: props.verb,
    entries: [
      { key: "url", value: props.url },
      { key: "body", value: props.body },
      { key: "auth", value: props.auth },
    ],
  });
}
