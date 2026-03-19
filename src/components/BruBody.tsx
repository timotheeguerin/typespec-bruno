import { Children } from "@alloy-js/core";
import { BruBlock, BruRawBlock } from "./BruBlock.js";

export type BruBodyProps =
  | { type: "json"; content: string }
  | {
      type: "form-urlencoded";
      fields: { key: string; value: string }[];
    }
  | {
      type: "multipart-form";
      fields: { key: string; value: string }[];
    }
  | { type: "text"; content: string }
  | { type: "xml"; content: string };

export function BruBody(props: BruBodyProps): Children {
  switch (props.type) {
    case "json":
      return BruRawBlock({ name: "body:json", content: props.content });
    case "text":
      return BruRawBlock({ name: "body:text", content: props.content });
    case "xml":
      return BruRawBlock({ name: "body:xml", content: props.content });
    case "form-urlencoded":
      return BruBlock({
        name: "body:form-urlencoded",
        entries: props.fields,
      });
    case "multipart-form":
      return BruBlock({
        name: "body:multipart-form",
        entries: props.fields,
      });
  }
}
