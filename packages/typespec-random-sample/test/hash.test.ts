import { describe, it, expect } from "vitest";
import { hash } from "../src/hash.js";

describe("hash", () => {
  it("produces a non-negative integer", () => {
    expect(hash("test")).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hash("test"))).toBe(true);
  });

  it("is deterministic", () => {
    expect(hash("hello")).toBe(hash("hello"));
    expect(hash("foo.bar")).toBe(hash("foo.bar"));
  });

  it("produces different values for different inputs", () => {
    expect(hash("a")).not.toBe(hash("b"));
    expect(hash("name")).not.toBe(hash("age"));
  });
});
