import { Children } from "@alloy-js/core";
import { BruBlock } from "./BruBlock.js";

export type BruAuthProps =
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | {
      type: "apikey";
      key: string;
      value: string;
      placement: "header" | "query";
    };

export function BruAuth(props: BruAuthProps): Children {
  switch (props.type) {
    case "bearer":
      return BruBlock({
        name: "auth:bearer",
        entries: [{ key: "token", value: props.token }],
      });
    case "basic":
      return BruBlock({
        name: "auth:basic",
        entries: [
          { key: "username", value: props.username },
          { key: "password", value: props.password },
        ],
      });
    case "apikey":
      return BruBlock({
        name: "auth:apikey",
        entries: [
          { key: "key", value: props.key },
          { key: "value", value: props.value },
          { key: "placement", value: props.placement },
        ],
      });
  }
}
