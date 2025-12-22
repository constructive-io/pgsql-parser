import { RESERVED_KEYWORDS, TYPE_FUNC_NAME_KEYWORDS } from '../kwlist';

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
  
}
