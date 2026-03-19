import { Children } from "@alloy-js/core";
import { BruBlock } from "./BruBlock.js";

export interface BruHeaderEntry {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface BruHeadersProps {
  headers: BruHeaderEntry[];
}

export function BruHeaders(props: BruHeadersProps): Children {
  if (props.headers.length === 0) return "";
  return BruBlock({
    name: "headers",
    entries: props.headers.map((h) => ({
      key: h.key,
      value: h.value,
      disabled: h.enabled === false,
    })),
  });
}
