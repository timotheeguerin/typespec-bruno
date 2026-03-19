import { Children } from "@alloy-js/core";
import { BruBlock } from "./BruBlock.js";

export interface BruEnvironmentProps {
  variables: { key: string; value: string }[];
}

export function BruEnvironment(props: BruEnvironmentProps): Children {
  return BruBlock({
    name: "vars",
    entries: props.variables,
  });
}
