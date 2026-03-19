/**
 * Simple deterministic hash function (djb2).
 * Produces a non-negative 32-bit integer from a string.
 */
export function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return h >>> 0; // ensure unsigned
}
