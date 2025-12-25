import { keywordKindOf } from '../kwlist';

export class QuoteUtils {
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
   * Quote an identifier that appears after a dot in a qualified name.
   *
   * In PostgreSQL's grammar, identifiers that appear after a dot (e.g., schema.name,
   * table.column) are in a more permissive position that accepts all keyword categories
   * including RESERVED_KEYWORD. This means we only need to quote for lexical reasons
   * (uppercase, special characters, leading digits) not for keyword reasons.
   *
   * Empirically verified: `myschema.select`, `myschema.float`, `t.from` all parse
   * successfully in PostgreSQL without quotes.
   */
  static quoteIdentifierAfterDot(ident: string): string {
    if (!ident) return ident;

    let safe = true;

    const firstChar = ident[0];
    if (!((firstChar >= 'a' && firstChar <= 'z') || firstChar === '_')) {
      safe = false;
    }

    for (let i = 0; i < ident.length; i++) {
      const ch = ident[i];
      if ((ch >= 'a' && ch <= 'z') ||
          (ch >= '0' && ch <= '9') ||
          (ch === '_')) {
        // okay
      } else {
        safe = false;
      }
    }

    if (safe) {
      return ident;
    }

    let result = '"';
    for (let i = 0; i < ident.length; i++) {
      const ch = ident[i];
      if (ch === '"') {
        result += '"';
      }
      result += ch;
    }
    result += '"';

    return result;
  }

  /**
   * Quote a dotted name (e.g., schema.table, catalog.schema.table).
   *
   * The first part uses strict quoting (keywords are quoted), while subsequent
   * parts use relaxed quoting (keywords allowed, only quote for lexical reasons).
   *
   * This reflects PostgreSQL's grammar where the first identifier in a statement
   * may conflict with keywords, but identifiers after a dot are in a more
   * permissive position.
   */
  static quoteDottedName(parts: string[]): string {
    if (!parts || parts.length === 0) return '';
    if (parts.length === 1) {
      return QuoteUtils.quoteIdentifier(parts[0]);
    }
    return parts.map((part, index) => 
      index === 0 ? QuoteUtils.quoteIdentifier(part) : QuoteUtils.quoteIdentifierAfterDot(part)
    ).join('.');
  }

  /**
   * Quote a possibly-qualified identifier
   *
   * This is inspired by PostgreSQL's quote_qualified_identifier() function from ruleutils.c
   * but uses relaxed quoting for the tail component since PostgreSQL's grammar accepts
   * all keywords in qualified name positions.
   *
   * Return a name of the form qualifier.ident, or just ident if qualifier
   * is null/undefined, quoting each component if necessary.
   */
  static quoteQualifiedIdentifier(qualifier: string | null | undefined, ident: string): string {
    if (qualifier) {
      return `${QuoteUtils.quoteIdentifier(qualifier)}.${QuoteUtils.quoteIdentifierAfterDot(ident)}`;
    }
    return QuoteUtils.quoteIdentifier(ident);
  }

  /**
   * Quote an identifier that appears as a type name.
   *
   * Type names in PostgreSQL have a less strict quoting policy than standalone identifiers.
   * In type positions, COL_NAME_KEYWORD and TYPE_FUNC_NAME_KEYWORD are allowed unquoted
   * (e.g., 'json', 'int', 'boolean', 'interval'). Only RESERVED_KEYWORD must be quoted.
   *
   * This is different from:
   * - quoteIdentifier(): quotes all keywords except UNRESERVED_KEYWORD
   * - quoteIdentifierAfterDot(): only quotes for lexical reasons (no keyword checking)
   *
   * Type names still need quoting for lexical reasons (uppercase, special chars, etc.).
   */
  static quoteIdentifierTypeName(ident: string): string {
    if (!ident) return ident;

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
      }
    }

    if (safe) {
      // For type names, only quote RESERVED_KEYWORD
      // COL_NAME_KEYWORD and TYPE_FUNC_NAME_KEYWORD are allowed unquoted in type positions
      const kwKind = keywordKindOf(ident);
      if (kwKind === 'RESERVED_KEYWORD') {
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
   * Quote a dotted type name (e.g., schema.typename).
   *
   * For type names, we use type-name quoting for all parts since the entire
   * qualified name is in a type context. This allows keywords like 'json',
   * 'int', 'boolean' to remain unquoted in user-defined schema-qualified types.
   */
  static quoteTypeDottedName(parts: string[]): string {
    if (!parts || parts.length === 0) return '';
    return parts.map(part => QuoteUtils.quoteIdentifierTypeName(part)).join('.');
  }
  
}
