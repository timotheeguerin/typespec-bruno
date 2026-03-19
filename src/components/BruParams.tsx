import { Children } from "@alloy-js/core";
import { BruBlock } from "./BruBlock.js";

export interface BruParamEntry {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface BruQueryParamsProps {
  params: BruParamEntry[];
}

export function BruQueryParams(props: BruQueryParamsProps): Children {
  if (props.params.length === 0) return "";
  return BruBlock({
    name: "params:query",
    entries: props.params.map((p) => ({
      key: p.key,
      value: p.value,
      disabled: p.enabled === false,
    })),
  });
}

export interface BruPathParamsProps {
  params: BruParamEntry[];
}

export function BruPathParams(props: BruPathParamsProps): Children {
  if (props.params.length === 0) return "";
  return BruBlock({
    name: "params:path",
    entries: props.params.map((p) => ({
      key: p.key,
      value: p.value,
    })),
  });
}
