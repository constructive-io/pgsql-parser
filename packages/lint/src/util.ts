/**
 * Offset arithmetic. Every location libpg_query reports — `stmt_location`,
 * `stmt_len`, a node's `location` — is a **byte** offset into the UTF-8 source,
 * while a JS string is indexed by UTF-16 code unit. The two agree only while
 * the text is pure ASCII: one `→` or `—` earlier in a file shifts every later
 * offset, and a definition sliced by character then fails to parse. So slice
 * and count newlines over the UTF-8 bytes, never over the string.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The UTF-8 bytes of `text` — the coordinate space parser offsets live in. */
export function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

/** `bytes[start, start + len)` decoded back to a string. */
export function sliceBytes(bytes: Uint8Array, start: number, len: number): string {
  return decoder.decode(bytes.subarray(start, start + len));
}

/** Count newline bytes in `bytes[0, byteOffset)` — the 0-based line the offset sits on. */
export function newlinesBeforeByte(bytes: Uint8Array, byteOffset: number): number {
  let n = 0;
  const end = Math.min(Math.max(byteOffset, 0), bytes.length);
  for (let i = 0; i < end; i++) if (bytes[i] === 10) n++;
  return n;
}

/** Absolute 1-based line of a parser (byte) offset within `text`. */
export function lineOfOffset(text: string, byteOffset: number): number {
  return newlinesBeforeByte(utf8(text), byteOffset) + 1;
}
