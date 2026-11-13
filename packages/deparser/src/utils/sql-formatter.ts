const isIdentChar = (ch: string | undefined): boolean =>
  ch !== undefined && (/[A-Za-z0-9_$]/.test(ch) || ch.charCodeAt(0) >= 0x80);

const DOLLAR_TAG = /\$(?:[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)?\$/y;

/**
 * Splits SQL text into lines, breaking only at newlines that sit between
 * tokens. A newline inside a string literal ('...', E'...', $tag$...$tag$),
 * a quoted identifier or a block comment is part of that token's value and
 * stays inside its line, so callers can re-indent the lines without changing
 * what the SQL means.
 */
export function splitSqlLines(text: string, newlineChar: string = '\n'): string[] {
  if (!text.includes(newlineChar)) {
    return [text];
  }

  const lines: string[] = [];
  const length = text.length;
  let lineStart = 0;
  let i = 0;

  while (i < length) {
    const ch = text[i];

    if (ch === "'") {
      const prev = text[i - 1];
      const backslashEscapes = (prev === 'E' || prev === 'e') && !isIdentChar(text[i - 2]);
      i++;
      while (i < length) {
        if (backslashEscapes && text[i] === '\\') {
          i += 2;
        } else if (text[i] === "'") {
          if (text[i + 1] === "'") {
            i += 2;
          } else {
            break;
          }
        } else {
          i++;
        }
      }
      i++;
    } else if (ch === '"') {
      i++;
      while (i < length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            i += 2;
          } else {
            break;
          }
        } else {
          i++;
        }
      }
      i++;
    } else if (ch === '$' && !isIdentChar(text[i - 1])) {
      DOLLAR_TAG.lastIndex = i;
      const tag = DOLLAR_TAG.exec(text);
      if (tag) {
        const close = text.indexOf(tag[0], i + tag[0].length);
        i = close === -1 ? length : close + tag[0].length;
      } else {
        i++;
      }
    } else if (ch === '-' && text[i + 1] === '-') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? length : end;
    } else if (ch === '/' && text[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < length && depth > 0) {
        if (text[i] === '/' && text[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (text[i] === '*' && text[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
    } else if (text.startsWith(newlineChar, i)) {
      lines.push(text.slice(lineStart, i));
      i += newlineChar.length;
      lineStart = i;
    } else {
      i++;
    }
  }

  lines.push(text.slice(lineStart));
  return lines;
}

export class SqlFormatter {
  private newlineChar: string;
  private tabChar: string;
  private prettyMode: boolean;

  constructor(newlineChar: string = '\n', tabChar: string = '  ', prettyMode: boolean = true) {
    this.newlineChar = newlineChar;
    this.tabChar = tabChar;
    this.prettyMode = prettyMode;
  }

  format(parts: string[], separator: string = ' '): string {
    return parts.filter(part => part !== null && part !== undefined && part !== '').join(separator);
  }

  indent(text: string, count: number = 1): string {
    if (!this.prettyMode) {
      return text;
    }
    const indentation = this.tabChar.repeat(count);
    return splitSqlLines(text, this.newlineChar).map(line => 
      line.trim() ? indentation + line : line
    ).join(this.newlineChar);
  }

  parens(content: string): string {
    return `(${content})`;
  }

  newline(): string {
    return this.newlineChar;
  }

  tab(): string {
    return this.tabChar;
  }

  isPretty(): boolean {
    return this.prettyMode;
  }
}
