import { RESERVED_KEYWORDS, TYPE_FUNC_NAME_KEYWORDS, keywordKindOf } from '../kwlist';

export class QuoteUtils {
  static needsQuotes(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const lowerValue = value.toLowerCase();
    
    if (RESERVED_KEYWORDS.has(lowerValue) || TYPE_FUNC_NAME_KEYWORDS.has(lowerValue)) {
      return true;
    }

    if (!/^[a-z_][a-z0-9_$]*$/i.test(value)) {
      return true;
    }

    if (value !== value.toLowerCase()) {
      return true;
    }

    return false;
  }

  static quote(value: any): any {
    if (value == null) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map(v => this.quote(v));
    }

    if (typeof value !== 'string') {
      return value;
    }

    if (this.needsQuotes(value)) {
      return `"${value}"`;
    }

    return value;
  }

  static escape(literal: string): string {
    return `'${literal.replace(/'/g, "''")}'`;
  }

  /**
   * Escapes a string value for use in E-prefixed string literals
   * Handles both backslashes and single quotes properly
   */
  static escapeEString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
  }

  /**
   * Formats a string as an E-prefixed string literal with proper escaping
   * This wraps the complete E-prefix logic including detection and formatting
   */
  static formatEString(value: string): string {
    const needsEscape = QuoteUtils.needsEscapePrefix(value);
    if (needsEscape) {
      const escapedValue = QuoteUtils.escapeEString(value);
      return `E'${escapedValue}'`;
    } else {
      return QuoteUtils.escape(value);
    }
  }

  /**
   * Determines if a string value needs E-prefix for escaped string literals
   * Detects backslash escape sequences that require E-prefix in PostgreSQL
   */
  static needsEscapePrefix(value: string): boolean {
    // Always use E'' if the string contains any backslashes,
    // unless it's a raw \x... bytea-style literal.
    return !/^\\x[0-9a-fA-F]+$/i.test(value) && value.includes('\\');
  }

  /**
   * Quote an identifier only if needed
   *
   * This is a TypeScript port of PostgreSQL's quote_identifier() function from ruleutils.c
   * https://github.com/postgres/postgres/blob/fab5cd3dd1323f9e66efeb676c4bb212ff340204/src/backend/utils/adt/ruleutils.c#L13055-L13137
   *
   * Can avoid quoting if ident starts with a lowercase letter or underscore
   * and contains only lowercase letters, digits, and underscores, *and* is
   * not any SQL keyword. Otherwise, supply quotes.
   *
   * When quotes are needed, embedded double quotes are properly escaped as "".
   */
  static quoteIdentifier(ident: string): string {
    if (!ident) return ident;

    let nquotes = 0;
    let safe = true;

    // Check first character: must be lowercase letter or underscore
    const firstChar = ident[0];
    if (!((firstChar >= 'a' && firstChar <= 'z') || firstChar === '_')) {
      safe = false;
    }

    // Check all characters
    for (let i = 0; i < ident.length; i++) {
      const ch = ident[i];
      if ((ch >= 'a' && ch <= 'z') ||
          (ch >= '0' && ch <= '9') ||
          (ch === '_')) {
        // okay
      } else {
        safe = false;
        if (ch === '"') {
          nquotes++;
        }
      }
    }

    if (safe) {
      // Check for keyword. We quote keywords except for unreserved ones.
      // (In some cases we could avoid quoting a col_name or type_func_name
      // keyword, but it seems much harder than it's worth to tell that.)
      const kwKind = keywordKindOf(ident);
      if (kwKind !== 'NO_KEYWORD' && kwKind !== 'UNRESERVED_KEYWORD') {
        safe = false;
      }
    }

    if (safe) {
      return ident; // no change needed
    }

    // Build quoted identifier with escaped embedded quotes
    let result = '"';
    for (let i = 0; i < ident.length; i++) {
      const ch = ident[i];
      if (ch === '"') {
        result += '"'; // escape " as ""
      }
      result += ch;
    }
    result += '"';

    return result;
  }

  /**
   * Quote a possibly-qualified identifier
   *
   * This is a TypeScript port of PostgreSQL's quote_qualified_identifier() function from ruleutils.c
   * https://github.com/postgres/postgres/blob/fab5cd3dd1323f9e66efeb676c4bb212ff340204/src/backend/utils/adt/ruleutils.c#L13139-L13156
   *
   * Return a name of the form qualifier.ident, or just ident if qualifier
   * is null/undefined, quoting each component if necessary.
   */
  static quoteQualifiedIdentifier(qualifier: string | null | undefined, ident: string): string {
    if (qualifier) {
      return `${QuoteUtils.quoteIdentifier(qualifier)}.${QuoteUtils.quoteIdentifier(ident)}`;
    }
    return QuoteUtils.quoteIdentifier(ident);
  }
  
}
