/** Absolute 1-based line of a char offset within `text`. */
export function lineOfOffset(text: string, offset: number): number {
  let n = 0;
  const end = Math.min(Math.max(offset, 0), text.length);
  for (let i = 0; i < end; i++) if (text.charCodeAt(i) === 10) n++;
  return n + 1;
}
