import { Children, code } from "@alloy-js/core";

export interface BruDocsProps {
  content: string;
}

export function BruDocs(props: BruDocsProps): Children {
  const indented = props.content
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return code`docs {\n${indented}\n}\n`;
}
