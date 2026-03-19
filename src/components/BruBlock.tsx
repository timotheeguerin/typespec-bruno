import { Children, code } from "@alloy-js/core";

/**
 * Renders a bru dictionary block:
 * ```
 * blockName {
 *   key: value
 *   key: value
 * }
 * ```
 */
export interface BruBlockProps {
  name: string;
  entries: { key: string; value: string; disabled?: boolean }[];
  children?: Children;
}

export function BruBlock(props: BruBlockProps): Children {
  if (props.entries.length === 0 && !props.children) {
    return code`${props.name} {\n}\n`;
  }

  const lines = props.entries.map((e) => {
    const prefix = e.disabled ? "~" : "";
    return `  ${prefix}${e.key}: ${e.value}`;
  });

  return code`${props.name} {\n${lines.join("\n")}\n}\n`;
}

/**
 * Renders a bru raw text block:
 * ```
 * blockName {
 * <content>
 * }
 * ```
 */
export interface BruRawBlockProps {
  name: string;
  content: string;
  children?: Children;
}

export function BruRawBlock(props: BruRawBlockProps): Children {
  return code`${props.name} {\n${props.content}\n}\n`;
}
