import { Children } from "@alloy-js/core";
import { BruMeta, type BruMetaProps } from "./BruMeta.js";
import { BruMethod, type BruMethodProps } from "./BruMethod.js";
import {
  BruQueryParams,
  BruPathParams,
  type BruParamEntry,
} from "./BruParams.js";
import { BruHeaders, type BruHeaderEntry } from "./BruHeaders.js";
import { BruBody, type BruBodyProps } from "./BruBody.js";
import { BruAuth, type BruAuthProps } from "./BruAuth.js";
import { BruDocs } from "./BruDocs.js";

export interface BruFileProps {
  meta: BruMetaProps;
  method: BruMethodProps;
  queryParams?: BruParamEntry[];
  pathParams?: BruParamEntry[];
  headers?: BruHeaderEntry[];
  body?: BruBodyProps;
  auth?: BruAuthProps;
  docs?: string;
}

/**
 * Renders a complete .bru file by composing individual block components.
 */
export function BruFile(props: BruFileProps): Children {
  const blocks: Children[] = [];

  blocks.push(BruMeta(props.meta));
  blocks.push(BruMethod(props.method));

  if (props.queryParams && props.queryParams.length > 0) {
    blocks.push(BruQueryParams({ params: props.queryParams }));
  }
  if (props.pathParams && props.pathParams.length > 0) {
    blocks.push(BruPathParams({ params: props.pathParams }));
  }
  if (props.headers && props.headers.length > 0) {
    blocks.push(BruHeaders({ headers: props.headers }));
  }
  if (props.body) {
    blocks.push(BruBody(props.body));
  }
  if (props.auth) {
    blocks.push(BruAuth(props.auth));
  }
  if (props.docs) {
    blocks.push(BruDocs({ content: props.docs }));
  }

  // Interleave blocks with newline separators
  const result: Children[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) result.push("\n");
    result.push(blocks[i]);
  }
  return result;
}
