import { Children, code } from "@alloy-js/core";
import { BruBlock } from "./BruBlock.js";

export interface BruMetaProps {
  name: string;
  seq: number;
}

export function BruMeta(props: BruMetaProps): Children {
  return BruBlock({
    name: "meta",
    entries: [
      { key: "name", value: props.name },
      { key: "type", value: "http" },
      { key: "seq", value: String(props.seq) },
    ],
  });
}
