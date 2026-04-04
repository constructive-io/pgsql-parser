/**
 * Scanner for extracting comments and vertical whitespace
 * from PostgreSQL SQL source text.
 *
 * Uses PostgreSQL's real lexer via libpg-query's WASM scanner
 * to identify comment tokens (SQL_COMMENT and C_COMMENT) with
 * exact byte positions. Whitespace detection uses token gaps
 * to find blank lines between statements/comments.
 *
 * Note: We load the WASM module directly and call _wasm_scan
 * ourselves rather than using the library's scanSync() wrapper,
 * because the upstream JSON builder has a bug where control
 * characters (newlines, tabs) inside token text fields are not
 * escaped, causing JSON.parse to fail on multi-line comments.
 * We fix this by escaping control characters in the raw JSON
 * string before parsing.
 */

/** Token type constants from PostgreSQL's lexer */
const SQL_COMMENT = 275;
const C_COMMENT = 276;

interface ScanTokenMinimal {
  start: number;
  end: number;
  tokenType: number;
}

interface ScanResultMinimal {
  version: number;
  tokens: ScanTokenMinimal[];
}

/**
 * Holds the loaded WASM module instance.
 * Set by initWasm() which must be called before scanning.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;

/**
 * Initialize the WASM module by loading it from @libpg-query/parser's
 * bundled libpg-query.js. This is the same WASM binary that the
 * library uses internally — we just need our own reference to call
 * _wasm_scan directly with proper JSON escaping.
 */
export async function initWasm(): Promise<void> {
  if (wasmModule) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaderPath = require.resolve('@libpg-query/parser/wasm/libpg-query.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const createModule = require(loaderPath);
  wasmModule = await createModule();
}

/**
 * Convert a JS string to a WASM heap pointer (null-terminated UTF-8).
 */
function stringToPtr(str: string): number {
  const len = wasmModule.lengthBytesUTF8(str) + 1;
  const ptr = wasmModule._malloc(len);
  try {
    wasmModule.stringToUTF8(str, ptr, len);
    return ptr;
  } catch (error) {
    wasmModule._free(ptr);
    throw error;
  }
}

/**
 * Read a null-terminated UTF-8 string from the WASM heap.
 */
function ptrToString(ptr: number): string {
  return wasmModule.UTF8ToString(ptr);
}

/**
 * Escape control characters inside JSON string values.
 *
 * The upstream C code's build_scan_json() escapes " and \ in token
 * text but NOT \n, \r, \t, etc. This function fixes the raw JSON
 * by replacing unescaped control characters (U+0000-U+001F) inside
 * string values with their proper JSON escape sequences.
 */
function fixJsonControlChars(raw: string): string {
  let result = '';
  let inString = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (ch === '\\') {
        // Already-escaped sequence — pass through both chars
        result += ch;
        i++;
        if (i < raw.length) result += raw[i];
        continue;
      }
      if (ch === '"') {
        inString = false;
        result += ch;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        switch (ch) {
          case '\n': result += '\\n'; break;
          case '\r': result += '\\r'; break;
          case '\t': result += '\\t'; break;
          case '\b': result += '\\b'; break;
          case '\f': result += '\\f'; break;
          default: result += '\\u' + code.toString(16).padStart(4, '0'); break;
        }
        continue;
      }
      result += ch;
    } else {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
    }
  }

  return result;
}

/**
 * Call PostgreSQL's scanner via WASM with proper JSON escaping.
 * Bypasses the library's scanSync() to fix the control character bug.
 */
function safeScanSync(sql: string): ScanResultMinimal {
  if (!wasmModule) {
    throw new Error(
      'WASM module not initialized. Call initWasm() or loadModule() first.'
    );
  }

  const queryPtr = stringToPtr(sql);
  let resultPtr = 0;

  try {
    resultPtr = wasmModule._wasm_scan(queryPtr);
    const rawJson = ptrToString(resultPtr);

    if (
      rawJson.startsWith('syntax error') ||
      rawJson.startsWith('deparse error') ||
      rawJson.startsWith('ERROR')
    ) {
      throw new Error(rawJson);
    }

    const fixedJson = fixJsonControlChars(rawJson);
    return JSON.parse(fixedJson);
  } finally {
    wasmModule._free(queryPtr);
    if (resultPtr) {
      wasmModule._wasm_free_string(resultPtr);
    }
  }
}

export interface ScannedComment {
  /** 'line' for -- comments, 'block' for /* comments */
  type: 'line' | 'block';
  /** The comment text (without delimiters) */
  text: string;
  /** Byte offset of the start of the comment (including delimiter) */
  start: number;
  /** Byte offset of the end of the comment (exclusive) */
  end: number;
}

export interface ScannedWhitespace {
  /** Number of blank lines (consecutive \n\n sequences) */
  lines: number;
  /** Byte offset of the start of the whitespace region */
  start: number;
  /** Byte offset of the end of the whitespace region */
  end: number;
}

export type ScannedElement = 
  | { kind: 'comment'; value: ScannedComment }
  | { kind: 'whitespace'; value: ScannedWhitespace };

/**
 * Count blank lines in a string region.
 * Returns 0 if there are fewer than 2 newlines (no blank line).
 */
function countBlankLines(text: string): number {
  let newlines = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') newlines++;
  }
  // 2+ newlines means at least 1 blank line
  return newlines >= 2 ? newlines - 1 : 0;
}

/**
 * Scan SQL source text and extract all comments and significant
 * vertical whitespace (2+ consecutive newlines).
 *
 * Uses PostgreSQL's real lexer (via WASM) for comment detection,
 * so all string literal types (single-quoted, dollar-quoted,
 * escape strings, etc.) are handled correctly by the actual
 * PostgreSQL scanner — no reimplementation needed.
 */
export function scanComments(sql: string): ScannedElement[] {
  const elements: ScannedElement[] = [];

  // Use PostgreSQL's real lexer to get all tokens
  let tokens: ScanTokenMinimal[];
  try {
    const scanResult = safeScanSync(sql);
    tokens = scanResult.tokens;
  } catch {
    // If the scanner fails (e.g., on truly invalid SQL),
    // return empty — let the parser handle the error
    return [];
  }

  // Walk through tokens, extracting comments and detecting
  // blank lines in the gaps between tokens
  let prevEnd = 0;

  for (const token of tokens) {
    // Check for blank lines in the gap before this token
    if (token.start > prevEnd) {
      const gap = sql.substring(prevEnd, token.start);
      const blankLines = countBlankLines(gap);
      if (blankLines > 0) {
        elements.push({
          kind: 'whitespace',
          value: {
            lines: blankLines,
            start: prevEnd,
            end: token.start,
          }
        });
      }
    }

    // If this is a comment token, add it
    if (token.tokenType === SQL_COMMENT || token.tokenType === C_COMMENT) {
      const isLine = token.tokenType === SQL_COMMENT;
      const text = isLine
        ? sql.substring(token.start + 2, token.end)     // strip --
        : sql.substring(token.start + 2, token.end - 2); // strip /* */
      elements.push({
        kind: 'comment',
        value: {
          type: isLine ? 'line' : 'block',
          text,
          start: token.start,
          end: token.end,
        }
      });
    }

    prevEnd = token.end;
  }

  // Check for blank lines after the last token
  if (prevEnd < sql.length) {
    const gap = sql.substring(prevEnd, sql.length);
    const blankLines = countBlankLines(gap);
    if (blankLines > 0) {
      elements.push({
        kind: 'whitespace',
        value: {
          lines: blankLines,
          start: prevEnd,
          end: sql.length,
        }
      });
    }
  }

  // Sort by position (comments and whitespace interleaved correctly)
  elements.sort((a, b) => a.value.start - b.value.start);

  return elements;
}
