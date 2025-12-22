import { Node } from '@pgsql/types';
import { DeparserContext, DeparserVisitor } from './visitors/base';
import { SqlFormatter } from './utils/sql-formatter';
import { QuoteUtils } from './utils/quote-utils';
import { ListUtils } from './utils/list-utils';
import * as t from '@pgsql/types';

/**
 * List of real PostgreSQL built-in types as they appear in pg_catalog.pg_type.typname.
 * These are stored in lowercase in PostgreSQL system catalogs.
 * Use these for lookups, validations, or introspection logic.
 */

const pgCatalogTypes = [
  // Integers
  'int2',        // smallint
  'int4',        // integer
  'int8',        // bigint

  // Floating-point & numeric
  'float4',      // real
  'float8',      // double precision
  'numeric',     // arbitrary precision (aka "decimal")

  // Text & string
  'varchar',     // variable-length string
  'char',        // internal one-byte type (used in special cases)
  'bpchar',      // blank-padded char(n)
  'text',        // unlimited string
  'bool',        // boolean

  // Dates & times
  'date',        // calendar date
  'time',        // time without time zone
  'timetz',      // time with time zone
  'timestamp',   // timestamp without time zone
  'timestamptz', // timestamp with time zone
  'interval',    // duration

  // Binary & structured
  'bytea',       // binary data
  'uuid',        // universally unique identifier

  // JSON & XML
  'json',        // textual JSON
  'jsonb',       // binary JSON
  'xml',         // XML format

  // Money & bitstrings
  'money',       // currency value
  'bit',         // fixed-length bit string
  'varbit',      // variable-length bit string

  // Network types
  'inet',        // IPv4 or IPv6 address
  'cidr',        // network address
  'macaddr',     // MAC address (6 bytes)
  'macaddr8'     // MAC address (8 bytes)
];


/**
 * Parser-level type aliases accepted by PostgreSQL SQL syntax,
 * but not present in pg_catalog.pg_type. These are resolved to
 * real types during parsing and never appear in introspection.
 */
const pgCatalogTypeAliases: [string, string[]][] = [
  ['numeric', ['decimal', 'dec']],
  ['int4', ['int', 'integer']],
  ['float8', ['float']],
  ['bpchar', ['character']],
  ['varchar', ['character varying']]
];

export interface DeparserOptions {
  newline?: string;
  tab?: string;
  // Function body delimiter options
  functionDelimiter?: string;  // Default: '$$'
  // Alternative delimiter when the default is found in the body
  functionDelimiterFallback?: string;  // Default: '$EOFCODE$'
  pretty?: boolean;  // Default: true
}

// Type guards for better type safety
function isParseResult(obj: any): obj is t.ParseResult {
  // A ParseResult is an object that could have stmts (but not required)
  // and is not already wrapped as a Node
  // IMPORTANT: ParseResult.stmts is "repeated RawStmt" in protobuf, meaning
  // the array contains RawStmt objects inline (not wrapped as { RawStmt: ... })
  // Example: { version: 170004, stmts: [{ stmt: {...}, stmt_len: 32 }] }
  return obj && typeof obj === 'object' &&
    !Array.isArray(obj) &&
    !('ParseResult' in obj) &&
    !('RawStmt' in obj) &&
    // Check if it looks like a ParseResult (has stmts or version)
    ('stmts' in obj || 'version' in obj);
}

function isWrappedParseResult(obj: any): obj is { ParseResult: t.ParseResult } {
  return obj && typeof obj === 'object' && 'ParseResult' in obj;
}

/**
 * Deparser - Converts PostgreSQL AST nodes back to SQL strings
 *
 * Entry Points:
 * 1. ParseResult (from libpg-query) - The complete parse result
 *    Structure: { version: number, stmts: RawStmt[] }
 *    Note: stmts is "repeated RawStmt" in protobuf, so array contains RawStmt
 *    objects inline (not wrapped as { RawStmt: ... } nodes)
 *    Example: { version: 170004, stmts: [{ stmt: {...}, stmt_len: 32 }] }
 *
 * 2. Wrapped ParseResult - When explicitly wrapped as a Node
 *    Structure: { ParseResult: { version: number, stmts: RawStmt[] } }
 *
 * 3. Wrapped RawStmt - When explicitly wrapped as a Node
 *    Structure: { RawStmt: { stmt: Node, stmt_len?: number } }
 *
 * 4. Array of Nodes - Multiple statements to deparse
 *    Can be: Node[] (e.g., SelectStmt, InsertStmt, etc.)
 *
 * 5. Single Node - Individual statement node
 *    Example: { SelectStmt: {...} }, { InsertStmt: {...} }, etc.
 *
 * The deparser automatically detects bare ParseResult objects for backward
 * compatibility and wraps them internally for consistent processing.
 */
export class Deparser implements DeparserVisitor {
  private tree: Node[];
  private options: DeparserOptions;

  constructor(tree: Node | Node[] | t.ParseResult, opts: DeparserOptions = {}) {

    // Set default options
    this.options = {
      functionDelimiter: '$$',
      functionDelimiterFallback: '$EOFCODE$',
      ...opts
    };

    // Handle different input types
    if (isParseResult(tree)) {
      // Duck-typed ParseResult (backward compatibility)
      // Wrap it as a proper Node for consistent handling
      this.tree = [{ ParseResult: tree } as Node];
    } else if (Array.isArray(tree)) {
      // Array of Nodes
      this.tree = tree;
    } else {
      // Single Node (including wrapped ParseResult)
      this.tree = [tree as Node];
    }
  }

  /**
   * Static method to deparse PostgreSQL AST nodes to SQL
   * @param query - Can be:
   *   - ParseResult from libpg-query (e.g., { version: 170004, stmts: [...] })
   *   - Wrapped ParseResult node (e.g., { ParseResult: {...} })
   *   - Wrapped RawStmt node (e.g., { RawStmt: {...} })
   *   - Array of Nodes
   *   - Single Node (e.g., { SelectStmt: {...} })
   * @param opts - Deparser options for formatting
   * @returns The deparsed SQL string
   */
  static deparse(query: Node | Node[] | t.ParseResult, opts: DeparserOptions = {}): string {
    return new Deparser(query, opts).deparseQuery();
  }

  deparseQuery(): string {
    const formatter = new SqlFormatter(this.options.newline, this.options.tab, this.options.pretty);
    const context = new DeparserContext({ formatter, prettyMode: this.options.pretty });
    return this.tree
      .map(node => {
        // All nodes should go through the standard deparse method
        // which will route to the appropriate handler
        const result = this.deparse(node, context);
        return result || '';
      })
      .filter(result => result !== '')
      .join(context.newline() + context.newline());
  }

  /**
   * Get the appropriate function delimiter based on the body content
   * @param body The function body to check
   * @returns The delimiter to use
   */
  private getFunctionDelimiter(body: string): string {
    const delimiter = this.options.functionDelimiter || '$$';
    if (body.includes(delimiter)) {
      return this.options.functionDelimiterFallback || '$EOFCODE$';
    }
    return delimiter;
  }

  /**
   * Maps ObjectType enum values to their corresponding SQL keywords
   * Used by AlterOwnerStmt, AlterObjectSchemaStmt, and other statements that need object type keywords
   */
  private getObjectTypeKeyword(objectType: string): string {
    switch (objectType) {
      case 'OBJECT_TABLE':
        return 'TABLE';
      case 'OBJECT_VIEW':
        return 'VIEW';
      case 'OBJECT_INDEX':
        return 'INDEX';
      case 'OBJECT_SEQUENCE':
        return 'SEQUENCE';
      case 'OBJECT_FUNCTION':
        return 'FUNCTION';
      case 'OBJECT_PROCEDURE':
        return 'PROCEDURE';
      case 'OBJECT_SCHEMA':
        return 'SCHEMA';
      case 'OBJECT_DATABASE':
        return 'DATABASE';
      case 'OBJECT_DOMAIN':
        return 'DOMAIN';
      case 'OBJECT_AGGREGATE':
        return 'AGGREGATE';
      case 'OBJECT_CONVERSION':
        return 'CONVERSION';
      case 'OBJECT_LANGUAGE':
        return 'LANGUAGE';
      case 'OBJECT_OPERATOR':
        return 'OPERATOR';
      case 'OBJECT_OPFAMILY':
        return 'OPERATOR FAMILY';
      case 'OBJECT_OPCLASS':
        return 'OPERATOR CLASS';
      case 'OBJECT_TSDICTIONARY':
        return 'TEXT SEARCH DICTIONARY';
      case 'OBJECT_TSCONFIGURATION':
        return 'TEXT SEARCH CONFIGURATION';
      case 'OBJECT_EVENT_TRIGGER':
        return 'EVENT TRIGGER';
      case 'OBJECT_FDW':
        return 'FOREIGN DATA WRAPPER';
      case 'OBJECT_FOREIGN_SERVER':
        return 'SERVER';
      case 'OBJECT_TYPE':
        return 'TYPE';
      case 'OBJECT_COLLATION':
        return 'COLLATION';
      case 'OBJECT_PUBLICATION':
        return 'PUBLICATION';
      case 'OBJECT_ACCESS_METHOD':
        return 'ACCESS METHOD';
      case 'OBJECT_AMOP':
        return 'OPERATOR CLASS';
      case 'OBJECT_AMPROC':
        return 'OPERATOR CLASS';
      case 'OBJECT_ATTRIBUTE':
        return 'ATTRIBUTE';
      case 'OBJECT_CAST':
        return 'CAST';
      case 'OBJECT_COLUMN':
        return 'COLUMN';
      case 'OBJECT_DEFAULT':
        return 'DEFAULT';
      case 'OBJECT_DEFACL':
        return 'DEFAULT PRIVILEGES';
      case 'OBJECT_DOMCONSTRAINT':
        return 'DOMAIN';
      case 'OBJECT_EXTENSION':
        return 'EXTENSION';
      case 'OBJECT_FOREIGN_TABLE':
        return 'FOREIGN TABLE';
      case 'OBJECT_LARGEOBJECT':
        return 'LARGE OBJECT';
      case 'OBJECT_MATVIEW':
        return 'MATERIALIZED VIEW';
      case 'OBJECT_PARAMETER_ACL':
        return 'PARAMETER';
      case 'OBJECT_POLICY':
        return 'POLICY';
      case 'OBJECT_PUBLICATION_NAMESPACE':
        return 'PUBLICATION';
      case 'OBJECT_PUBLICATION_REL':
        return 'PUBLICATION';
      case 'OBJECT_ROLE':
        return 'ROLE';
      case 'OBJECT_ROUTINE':
        return 'ROUTINE';
      case 'OBJECT_RULE':
        return 'RULE';
      case 'OBJECT_STATISTIC_EXT':
        return 'STATISTICS';
      case 'OBJECT_SUBSCRIPTION':
        return 'SUBSCRIPTION';
      case 'OBJECT_TABCONSTRAINT':
        return 'CONSTRAINT';
      case 'OBJECT_TABLESPACE':
        return 'TABLESPACE';
      case 'OBJECT_TRANSFORM':
        return 'TRANSFORM';
      case 'OBJECT_TRIGGER':
        return 'TRIGGER';
      case 'OBJECT_TSPARSER':
        return 'TEXT SEARCH PARSER';
      case 'OBJECT_TSTEMPLATE':
        return 'TEXT SEARCH TEMPLATE';
      case 'OBJECT_USER_MAPPING':
        return 'USER MAPPING';
      default:
        throw new Error(`Unsupported objectType: ${objectType}`);
    }
  }

  deparse(node: Node, context?: DeparserContext): string | null {
    if (node == null) {
      return null;
    }
    
    if (!context) {
      const formatter = new SqlFormatter(this.options.newline, this.options.tab, this.options.pretty);
      context = new DeparserContext({ formatter, prettyMode: this.options.pretty });
    }

    if (typeof node === 'number' || node instanceof Number) {
      return node.toString();
    }

    try {
      return this.visit(node, context);
    } catch (error) {
      const nodeType = Object.keys(node)[0];
      throw new Error(`Error deparsing ${nodeType}: ${(error as Error).message}`);
    }
  }

  visit(node: Node, context?: DeparserContext): string {
    if (!context) {
      const formatter = new SqlFormatter(this.options.newline, this.options.tab, this.options.pretty);
      context = new DeparserContext({ formatter, prettyMode: this.options.pretty });
    }
    
    const nodeType = this.getNodeType(node);
    
    // Handle empty objects
    if (!nodeType) {
      return '';
    }
    
    const nodeData = this.getNodeData(node);

    const methodName = nodeType as keyof this;
    if (typeof this[methodName] === 'function') {
      const result = (this[methodName] as any)(nodeData, context);
      
      return result;
    }
    
    throw new Error(`Deparser does not handle node type: ${nodeType}`);
  }

  getNodeType(node: Node): string {
    return Object.keys(node)[0];
  }

  getNodeData(node: Node): any {
    const keys = Object.keys(node);
    if (keys.length === 1 && typeof (node as any)[keys[0]] === 'object') {
      return (node as any)[keys[0]];
    }
    return node;
  }

  ParseResult(node: t.ParseResult, context: DeparserContext): string {
    if (!node.stmts || node.stmts.length === 0) {
      return '';
    }

    // Deparse each RawStmt in the ParseResult
    // Note: node.stmts is "repeated RawStmt" so contains RawStmt objects inline
    // Each element has structure: { stmt: Node, stmt_len?: number, stmt_location?: number }
    return node.stmts
      .filter((rawStmt: t.RawStmt) => rawStmt != null)
      .map((rawStmt: t.RawStmt) => this.RawStmt(rawStmt, context))
      .filter((result: string) => result !== '')
      .join(context.newline() + context.newline());
  }

  RawStmt(node: t.RawStmt, context: DeparserContext): string {
    if (!node.stmt) {
      return '';
    }

    const deparsedStmt = this.deparse(node.stmt, context);

    // Add semicolon if stmt_len is provided (indicates it had one in original)
    if (node.stmt_len) {
      return deparsedStmt + ';';
    }
    return deparsedStmt;
  }

  SelectStmt(node: t.SelectStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.withClause) {
      output.push(this.WithClause(node.withClause, context));
    }

    if (!node.op || node.op === 'SETOP_NONE') {
      if (node.valuesLists == null) {
        if (!context.isPretty() || !node.targetList) {
          output.push('SELECT');
        }
      }
    }else {
      const leftStmt = this.SelectStmt(node.larg as t.SelectStmt, context);
      const rightStmt = this.SelectStmt(node.rarg as t.SelectStmt, context);

      // Add parentheses if the operand is a set operation OR has ORDER BY/LIMIT clauses OR has WITH clause
      const leftNeedsParens = node.larg && (
        ((node.larg as t.SelectStmt).op && (node.larg as t.SelectStmt).op !== 'SETOP_NONE') ||
        (node.larg as t.SelectStmt).sortClause ||
        (node.larg as t.SelectStmt).limitCount ||
        (node.larg as t.SelectStmt).limitOffset ||
        (node.larg as t.SelectStmt).withClause
      );
      const rightNeedsParens = node.rarg && (
        ((node.rarg as t.SelectStmt).op && (node.rarg as t.SelectStmt).op !== 'SETOP_NONE') ||
        (node.rarg as t.SelectStmt).sortClause ||
        (node.rarg as t.SelectStmt).limitCount ||
        (node.rarg as t.SelectStmt).limitOffset ||
        (node.rarg as t.SelectStmt).withClause
      );

      if (leftNeedsParens) {
        output.push(context.parens(leftStmt));
      } else {
        output.push(leftStmt);
      }

      switch (node.op) {
        case 'SETOP_UNION':
          output.push('UNION');
          break;
        case 'SETOP_INTERSECT':
          output.push('INTERSECT');
          break;
        case 'SETOP_EXCEPT':
          output.push('EXCEPT');
          break;
        default:
          throw new Error(`Bad SelectStmt op: ${node.op}`);
      }

      if (node.all) {
        output.push('ALL');
      }

      if (rightNeedsParens) {
        output.push(context.parens(rightStmt));
      } else {
        output.push(rightStmt);
      }
    }

    // Handle DISTINCT clause - in pretty mode, we'll include it in the SELECT clause
    let distinctPart = '';
    if (node.distinctClause) {
      const distinctClause = ListUtils.unwrapList(node.distinctClause);
      if (distinctClause.length > 0 && Object.keys(distinctClause[0]).length > 0) {
        const clause = distinctClause
          .map(e => this.visit(e as Node, context.spawn('SelectStmt', { select: true })))
          .join(', ');
        distinctPart = ' DISTINCT ON ' + context.parens(clause);
      } else {
        distinctPart = ' DISTINCT';
      }

      if (!context.isPretty()) {
        if (distinctClause.length > 0 && Object.keys(distinctClause[0]).length > 0) {
          output.push('DISTINCT ON');
          const clause = distinctClause
            .map(e => this.visit(e as Node, context.spawn('SelectStmt', { select: true })))
            .join(', ');
          output.push(context.parens(clause));
        } else {
          output.push('DISTINCT');
        }
      }
    }

    if (node.targetList) {
      const targetList = ListUtils.unwrapList(node.targetList);
      if (context.isPretty()) {
        if (targetList.length === 1) {
          const targetNode = targetList[0] as Node;
          const target = this.visit(targetNode, context.spawn('SelectStmt', { select: true }));

          // Check if single target is complex - if so, use multiline format
          if (this.isComplexSelectTarget(targetNode)) {
            output.push('SELECT' + distinctPart);
            if (this.containsMultilineStringLiteral(target)) {
              output.push(target);
            } else {
              output.push(context.indent(target));
            }
          } else {
            output.push('SELECT' + distinctPart + ' ' + target);
          }
        } else {
          const targetStrings = targetList
            .map(e => {
              const targetStr = this.visit(e as Node, context.spawn('SelectStmt', { select: true }));
              if (this.containsMultilineStringLiteral(targetStr)) {
                return targetStr;
              }
              return context.indent(targetStr);
            });
          const formattedTargets = targetStrings.join(',' + context.newline());
          output.push('SELECT' + distinctPart);
          output.push(formattedTargets);
        }
      } else {
        const targets = targetList
          .map(e => this.visit(e as Node, context.spawn('SelectStmt', { select: true })))
          .join(', ');
        output.push(targets);
      }
    }

    if (node.intoClause) {
      output.push('INTO');
      output.push(this.IntoClause(node.intoClause, context));
    }

    if (node.fromClause) {
      const fromList = ListUtils.unwrapList(node.fromClause);
      const fromItems = fromList
        .map(e => this.deparse(e as Node, context.spawn('SelectStmt', { from: true })))
        .join(', ');
      output.push('FROM ' + fromItems.trim());
    }

    if (node.whereClause) {
      if (context.isPretty()) {
        output.push('WHERE');
        const whereExpr = this.visit(node.whereClause as Node, context);
        const lines = whereExpr.split(context.newline());
        const indentedLines = lines.map((line, index) => {
          if (index === 0) {
            return context.indent(line);
          }
          return line;
        });
        output.push(indentedLines.join(context.newline()));
      } else {
        output.push('WHERE');
        output.push(this.visit(node.whereClause as Node, context));
      }
    }

    if (node.valuesLists) {
      if (context.isPretty()) {
        output.push('VALUES');
        const lists = ListUtils.unwrapList(node.valuesLists).map(list => {
          const values = ListUtils.unwrapList(list).map(val => this.visit(val as Node, context));
          return context.parens(values.join(', '));
        });
        const indentedTuples = lists.map(tuple => {
          if (this.containsMultilineStringLiteral(tuple)) {
            return tuple;
          }
          return context.indent(tuple);
        });
        output.push(indentedTuples.join(',\n'));
      } else {
        output.push('VALUES');
        const lists = ListUtils.unwrapList(node.valuesLists).map(list => {
          const values = ListUtils.unwrapList(list).map(val => this.visit(val as Node, context));
          return context.parens(values.join(', '));
        });
        output.push(lists.join(', '));
      }
    }

    if (node.groupClause) {
      const groupList = ListUtils.unwrapList(node.groupClause);
      if (context.isPretty()) {
        const groupItems = groupList
          .map(e => {
            const groupStr = this.visit(e as Node, context.spawn('SelectStmt', { group: true, indentLevel: context.indentLevel + 1 }));
            if (this.containsMultilineStringLiteral(groupStr)) {
              return groupStr;
            }
            return context.indent(groupStr);
          })
          .join(',' + context.newline());
        output.push('GROUP BY');
        output.push(groupItems);
      } else {
        output.push('GROUP BY');
        const groupItems = groupList
          .map(e => this.visit(e as Node, context.spawn('SelectStmt', { group: true })))
          .join(', ');
        output.push(groupItems);
      }
    }

    if (node.havingClause) {
      if (context.isPretty()) {
        output.push('HAVING');
        const havingStr = this.visit(node.havingClause as Node, context);
        if (this.containsMultilineStringLiteral(havingStr)) {
          output.push(havingStr);
        } else {
          output.push(context.indent(havingStr));
        }
      } else {
        output.push('HAVING');
        output.push(this.visit(node.havingClause as Node, context));
      }
    }

    if (node.windowClause) {
      output.push('WINDOW');
      const windowList = ListUtils.unwrapList(node.windowClause);
      const windowClauses = windowList
        .map(e => this.visit(e as Node, context))
        .join(', ');
      output.push(windowClauses);
    }

    if (node.sortClause) {
      const sortList = ListUtils.unwrapList(node.sortClause);
      if (context.isPretty()) {
        const sortItems = sortList
          .map(e => {
            const sortStr = this.visit(e as Node, context.spawn('SelectStmt', { sort: true, indentLevel: context.indentLevel + 1 }));
            if (this.containsMultilineStringLiteral(sortStr)) {
              return sortStr;
            }
            return context.indent(sortStr);
          })
          .join(',' + context.newline());
        output.push('ORDER BY');
        output.push(sortItems);
      } else {
        output.push('ORDER BY');
        const sortItems = sortList
          .map(e => this.visit(e as Node, context.spawn('SelectStmt', { sort: true })))
          .join(', ');
        output.push(sortItems);
      }
    }

    if (node.limitCount) {
      output.push('LIMIT ' + this.visit(node.limitCount as Node, context));
    }

    if (node.limitOffset) {
      output.push('OFFSET ' + this.visit(node.limitOffset as Node, context));
    }

    if (node.lockingClause) {
      const lockingList = ListUtils.unwrapList(node.lockingClause);
      const lockingClauses = lockingList
        .map(e => this.visit(e as Node, context))
        .join(' ');
      output.push(lockingClauses);
    }

    if (context.isPretty()) {
      const filteredOutput = output.filter(item => item.trim() !== '');
      return filteredOutput.join(context.newline());
    }
    return output.join(' ');
  }

  A_Expr(node: t.A_Expr, context: DeparserContext): string {
    const kind = node.kind as string;
    const name = ListUtils.unwrapList(node.name);
    const lexpr = node.lexpr;
    const rexpr = node.rexpr;

    switch (kind) {
      case 'AEXPR_OP':
        if (lexpr && rexpr) {
          const operator = this.deparseOperatorName(name, context);
          let leftExpr = this.visit(lexpr, context);
          let rightExpr = this.visit(rexpr, context);

          // Check if left expression needs parentheses
          let leftNeedsParens = false;
          if (lexpr && 'A_Expr' in lexpr && lexpr.A_Expr?.kind === 'AEXPR_OP') {
            const leftOp = this.deparseOperatorName(ListUtils.unwrapList(lexpr.A_Expr.name), context);
            if (this.needsParentheses(leftOp, operator, 'left')) {
              leftNeedsParens = true;
            }
          }
          if (lexpr && this.isComplexExpression(lexpr)) {
            leftNeedsParens = true;
          }
          if (leftNeedsParens) {
            leftExpr = context.parens(leftExpr);
          }

          // Check if right expression needs parentheses
          let rightNeedsParens = false;
          if (rexpr && 'A_Expr' in rexpr && rexpr.A_Expr?.kind === 'AEXPR_OP') {
            const rightOp = this.deparseOperatorName(ListUtils.unwrapList(rexpr.A_Expr.name), context);
            if (this.needsParentheses(rightOp, operator, 'right')) {
              rightNeedsParens = true;
            }
          }
          if (rexpr && this.isComplexExpression(rexpr)) {
            rightNeedsParens = true;
          }
          if (rightNeedsParens) {
            rightExpr = context.parens(rightExpr);
          }

          return context.format([leftExpr, operator, rightExpr]);
        }else if (rexpr) {
          return context.format([
            this.deparseOperatorName(name, context),
            this.visit(rexpr, context)
          ]);
        }
        break;
      case 'AEXPR_OP_ANY':
        return context.format([
          this.visit(lexpr, context),
          this.deparseOperatorName(name, context),
          'ANY',
          context.parens(this.visit(rexpr, context))
        ]);
      case 'AEXPR_OP_ALL':
        return context.format([
          this.visit(lexpr, context),
          this.deparseOperatorName(name, context),
          'ALL',
          context.parens(this.visit(rexpr, context))
        ]);
      case 'AEXPR_DISTINCT': {
        let leftExpr = this.visit(lexpr, context);
        let rightExpr = this.visit(rexpr, context);

        // Add parentheses for complex expressions
        if (lexpr && this.isComplexExpression(lexpr)) {
          leftExpr = context.parens(leftExpr);
        }
        if (rexpr && this.isComplexExpression(rexpr)) {
          rightExpr = context.parens(rightExpr);
        }

        return context.format([
          leftExpr,
          'IS DISTINCT FROM',
          rightExpr
        ]);
      }
      case 'AEXPR_NOT_DISTINCT': {
        let leftExpr = this.visit(lexpr, context);
        let rightExpr = this.visit(rexpr, context);

        // Add parentheses for complex expressions
        if (lexpr && this.isComplexExpression(lexpr)) {
          leftExpr = context.parens(leftExpr);
        }
        if (rexpr && this.isComplexExpression(rexpr)) {
          rightExpr = context.parens(rightExpr);
        }

        return context.format([
          leftExpr,
          'IS NOT DISTINCT FROM',
          rightExpr
        ]);
      }
      case 'AEXPR_NULLIF':
        return context.format([
          'NULLIF',
          context.parens([
            this.visit(lexpr, context),
            this.visit(rexpr, context)
          ].join(', '))
        ]);
      case 'AEXPR_IN':
        const inOperator = this.deparseOperatorName(name, context);
        if (inOperator === '<>' || inOperator === '!=') {
          return context.format([
            this.visit(lexpr, context),
            'NOT IN',
            context.parens(this.visit(rexpr, context))
          ]);
        } else {
          return context.format([
            this.visit(lexpr, context),
            'IN',
            context.parens(this.visit(rexpr, context))
          ]);
        }
      case 'AEXPR_LIKE':
        const likeOp = this.deparseOperatorName(name, context);
        if (likeOp === '!~~') {
          return context.format([
            this.visit(lexpr, context),
            'NOT LIKE',
            this.visit(rexpr, context)
          ]);
        } else {
          return context.format([
            this.visit(lexpr, context),
            'LIKE',
            this.visit(rexpr, context)
          ]);
        }
      case 'AEXPR_ILIKE':
        const ilikeOp = this.deparseOperatorName(name, context);
        if (ilikeOp === '!~~*') {
          return context.format([
            this.visit(lexpr, context),
            'NOT ILIKE',
            this.visit(rexpr, context)
          ]);
        } else {
          return context.format([
            this.visit(lexpr, context),
            'ILIKE',
            this.visit(rexpr, context)
          ]);
        }
      case 'AEXPR_SIMILAR':
        const similarOp = this.deparseOperatorName(name, context);
        let rightExpr: string;

        if (rexpr && 'FuncCall' in rexpr &&
            rexpr.FuncCall?.funcname?.length === 2 &&
            (rexpr.FuncCall.funcname[0] as any)?.String?.sval === 'pg_catalog' &&
            (rexpr.FuncCall.funcname[1] as any)?.String?.sval === 'similar_to_escape') {
          const args = rexpr.FuncCall.args || [];
          rightExpr = this.visit(args[0], context);
          if (args.length > 1) {
            rightExpr += ` ESCAPE ${this.visit(args[1], context)}`;
          }
        } else {
          rightExpr = this.visit(rexpr, context);
        }

        if (similarOp === '!~') {
          return context.format([
            this.visit(lexpr, context),
            'NOT SIMILAR TO',
            rightExpr
          ]);
        } else {
          return context.format([
            this.visit(lexpr, context),
            'SIMILAR TO',
            rightExpr
          ]);
        }
      case 'AEXPR_BETWEEN':
        return context.format([
          this.visit(lexpr, context),
          'BETWEEN',
          this.visitBetweenRange(rexpr, context)
        ]);
      case 'AEXPR_NOT_BETWEEN':
        return context.format([
          this.visit(lexpr, context),
          'NOT BETWEEN',
          this.visitBetweenRange(rexpr, context)
        ]);
      case 'AEXPR_BETWEEN_SYM':
        return context.format([
          this.visit(lexpr, context),
          'BETWEEN SYMMETRIC',
          this.visitBetweenRange(rexpr, context)
        ]);
      case 'AEXPR_NOT_BETWEEN_SYM':
        return context.format([
          this.visit(lexpr, context),
          'NOT BETWEEN SYMMETRIC',
          this.visitBetweenRange(rexpr, context)
        ]);
    }

    throw new Error(`Unhandled A_Expr kind: ${kind}`);
  }

  deparseOperatorName(name: t.Node[], context: DeparserContext): string {
    if (!name || name.length === 0) {
      return '';
    }

    const parts = name.map((n: any) => {
      if (n.String) {
        return n.String.sval || n.String.str;
      }
      return this.visit(n, context);
    });

    if (parts.length > 1) {
      return `OPERATOR(${parts.join('.')})`;
    }

    return parts.join('.');
  }

  private getOperatorPrecedence(operator: string): number {
    const precedence: { [key: string]: number } = {
      '||': 1,    // string concatenation
      'OR': 2,    // logical OR
      'AND': 3,   // logical AND
      'NOT': 4,   // logical NOT
      'IS': 5,    // IS NULL, IS NOT NULL, etc.
      'IN': 5,    // IN, NOT IN
      'BETWEEN': 5, // BETWEEN, NOT BETWEEN
      'LIKE': 5,  // LIKE, ILIKE, SIMILAR TO
      'ILIKE': 5,
      'SIMILAR': 5,
      '<': 6,     // comparison operators
      '<=': 6,
      '>': 6,
      '>=': 6,
      '=': 6,
      '<>': 6,
      '!=': 6,
      '+': 7,     // addition, subtraction
      '-': 7,
      '*': 8,     // multiplication, division, modulo
      '/': 8,
      '%': 8,
      '^': 9,     // exponentiation
      '~': 10,    // bitwise operators
      '&': 10,
      '|': 10,
      '#': 10,
      '<<': 10,
      '>>': 10
    };

    return precedence[operator] || 0;
  }

  private needsParentheses(childOp: string, parentOp: string, position: 'left' | 'right'): boolean {
    const childPrec = this.getOperatorPrecedence(childOp);
    const parentPrec = this.getOperatorPrecedence(parentOp);

    if (childPrec < parentPrec) {
      return true;
    }

    if (childPrec === parentPrec && position === 'right') {
      if (parentOp === '-' || parentOp === '/') {
        return true;
      }
    }

    return false;
  }

  private isComplexExpression(node: any): boolean {
    return !!(
      node.NullTest ||
      node.BooleanTest ||
      node.BoolExpr ||
      node.CaseExpr ||
      node.CoalesceExpr ||
      node.SubLink ||
      node.A_Expr
    );
  }

  private isComplexSelectTarget(node: any): boolean {
    if (!node) return false;

    if (node.ResTarget?.val) {
      return this.isComplexExpression(node.ResTarget.val);
    }

    // Always complex: CASE expressions
    if (node.CaseExpr) return true;

    // Always complex: Subqueries and subselects
    if (node.SubLink) return true;

    // Always complex: Boolean tests and expressions
    if (node.NullTest || node.BooleanTest || node.BoolExpr) return true;

    // COALESCE and similar functions - complex if multiple arguments
    if (node.CoalesceExpr) {
      const args = node.CoalesceExpr.args;
      if (args && Array.isArray(args) && args.length > 1) return true;
    }

    // Function calls - complex if multiple args or has clauses
    if (node.FuncCall) {
      const funcCall = node.FuncCall;
      const args = funcCall.args ? (Array.isArray(funcCall.args) ? funcCall.args : [funcCall.args]) : [];

      // Complex if has window clause, filter, order by, etc.
      if (funcCall.over || funcCall.agg_filter || funcCall.agg_order || funcCall.agg_distinct) {
        return true;
      }

      // Complex if multiple arguments
      if (args.length > 1) return true;

      if (args.length === 1) {
        return this.isComplexSelectTarget(args[0]);
      }
    }

    if (node.A_Expr) {
      const expr = node.A_Expr;
      // Check if operands are complex
      if (expr.lexpr && this.isComplexSelectTarget(expr.lexpr)) return true;
      if (expr.rexpr && this.isComplexSelectTarget(expr.rexpr)) return true;
      return false;
    }

    if (node.TypeCast) {
      return this.isComplexSelectTarget(node.TypeCast.arg);
    }

    if (node.A_ArrayExpr) return true;

    if (node.A_Indirection) {
      return this.isComplexSelectTarget(node.A_Indirection.arg);
    }

    if (node.A_Const || node.ColumnRef || node.ParamRef || node.A_Star) {
      return false;
    }

    return false;
  }

  visitBetweenRange(rexpr: any, context: DeparserContext): string {
    if (rexpr && 'List' in rexpr && rexpr.List?.items) {
      const items = rexpr.List.items.map((item: any) => this.visit(item, context));
      return items.join(' AND ');
    }
    return this.visit(rexpr, context);
  }



  InsertStmt(node: t.InsertStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.withClause) {
      output.push(this.WithClause(node.withClause, context));
    }

    output.push('INSERT INTO');
    output.push(this.RangeVar(node.relation, context));

    if (node.cols) {
      const cols = ListUtils.unwrapList(node.cols);
      const insertContext = context.spawn('InsertStmt', { insertColumns: true });
      const columnNames = cols.map(col => this.visit(col as Node, insertContext));

      if (context.isPretty()) {
        // Always format columns in multiline parentheses for pretty printing
        const indentedColumns = columnNames.map(col => context.indent(col));
        output.push('(\n' + indentedColumns.join(',\n') + '\n)');
      } else {
        output.push(context.parens(columnNames.join(', ')));
      }
    }

    if (node.selectStmt) {
      output.push(this.visit(node.selectStmt as Node, context));
    } else if (!node.cols || (node.cols && ListUtils.unwrapList(node.cols).length === 0)) {
      // Handle DEFAULT VALUES case when no columns and no selectStmt
      output.push('DEFAULT VALUES');
    }

    if (node.onConflictClause) {
      output.push('ON CONFLICT');
      if (node.onConflictClause.infer) {
        const infer = node.onConflictClause.infer;

        // Handle ON CONSTRAINT clause
        if (infer.conname) {
          output.push('ON CONSTRAINT');
          output.push(infer.conname);
        } else if (infer.indexElems) {
          const elems = ListUtils.unwrapList(infer.indexElems);
          const indexElems = elems.map(elem => this.visit(elem as Node, context));
          output.push(context.parens(indexElems.join(', ')));
        }

        // Handle WHERE clause for conflict detection
        if (infer.whereClause) {
          output.push('WHERE');
          output.push(this.visit(infer.whereClause as Node, context));
        }
      }

      if (node.onConflictClause.action === 'ONCONFLICT_UPDATE') {
        output.push('DO UPDATE SET');
        const targetList = ListUtils.unwrapList(node.onConflictClause.targetList);

        if (targetList && targetList.length) {
          const firstTarget = targetList[0];

          if (firstTarget.ResTarget?.val?.MultiAssignRef && targetList.every(target => target.ResTarget?.val?.MultiAssignRef)) {
            const sortedTargets = targetList.sort((a, b) => a.ResTarget.val.MultiAssignRef.colno - b.ResTarget.val.MultiAssignRef.colno);
            const names = sortedTargets.map(target => target.ResTarget.name);
            output.push(context.parens(names.join(', ')));
            output.push('=');
            output.push(this.visit(firstTarget.ResTarget.val.MultiAssignRef.source, context));
          } else {
            const updateContext = context.spawn('UpdateStmt', { update: true });
            const targets = targetList.map(target => this.visit(target as Node, updateContext));
            output.push(targets.join(', '));
          }
        }

        if (node.onConflictClause.whereClause) {
          output.push('WHERE');
          output.push(this.visit(node.onConflictClause.whereClause as Node, context));
        }
      } else if (node.onConflictClause.action === 'ONCONFLICT_NOTHING') {
        output.push('DO NOTHING');
      }
    }

    if (node.returningList) {
      output.push('RETURNING');
      const returningList = ListUtils.unwrapList(node.returningList);
      const returns = returningList.map(ret => this.visit(ret as Node, context));
      output.push(returns.join(', '));
    }

    return output.join(' ');
  }

  UpdateStmt(node: t.UpdateStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.withClause) {
      output.push(this.WithClause(node.withClause, context));
    }

    output.push('UPDATE');
    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));
    }
    output.push('SET');

    const targetList = ListUtils.unwrapList(node.targetList);
    if (targetList && targetList.length) {
      const firstTarget = targetList[0];

      const processedTargets = new Set();
      const assignmentParts = [];

      for (let i = 0; i < targetList.length; i++) {
        if (processedTargets.has(i)) continue;

        const target = targetList[i];
        const multiAssignRef = target.ResTarget?.val?.MultiAssignRef;

        if (multiAssignRef) {
          const relatedTargets = [];
          for (let j = i; j < targetList.length; j++) {
            const otherTarget = targetList[j];
            const otherMultiAssignRef = otherTarget.ResTarget?.val?.MultiAssignRef;

            if (otherMultiAssignRef &&
                JSON.stringify(otherMultiAssignRef.source) === JSON.stringify(multiAssignRef.source)) {
              relatedTargets.push(otherTarget);
              processedTargets.add(j);
            }
          }

          const names = relatedTargets.map(t => t.ResTarget.name);
          const multiAssignment = `${context.parens(names.join(', '))} = ${this.visit(multiAssignRef.source, context)}`;
          assignmentParts.push(multiAssignment);
        } else {
          // Handle regular single-column assignment
          assignmentParts.push(this.visit(target, context.spawn('UpdateStmt', { update: true })));
          processedTargets.add(i);
        }
      }

      output.push(assignmentParts.join(','));
    }

    if (node.fromClause) {
      output.push('FROM');
      const fromList = ListUtils.unwrapList(node.fromClause);
      const fromItems = fromList.map(item => this.visit(item, context));
      output.push(fromItems.join(', '));
    }

    if (node.whereClause) {
      output.push('WHERE');
      output.push(this.visit(node.whereClause, context));
    }

    if (node.returningList) {
      output.push('RETURNING');
      output.push(this.deparseReturningList(node.returningList, context));
    }

    return output.join(' ');
  }

  DeleteStmt(node: t.DeleteStmt, context: DeparserContext): string {
    try {
      const output: string[] = [];

      if (node.withClause) {
        try {
          output.push(this.WithClause(node.withClause, context));
        } catch (error) {
          console.warn(`Error processing withClause in DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Error deparsing DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      output.push('DELETE');
      output.push('FROM');

      if (!node.relation) {
        throw new Error('DeleteStmt requires a relation');
      }
      output.push(this.RangeVar(node.relation, context));

      if (node.usingClause) {
        output.push('USING');
        const usingList = ListUtils.unwrapList(node.usingClause);
        const usingItems = usingList
          .filter(item => item != null && this.getNodeType(item) !== 'undefined')
          .map(item => {
            try {
              return this.visit(item, context);
            } catch (error) {
              console.warn(`Error processing usingClause item in DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
              return '';
            }
          })
          .filter(item => item && item.trim());
        if (usingItems.length > 0) {
          output.push(usingItems.join(', '));
        }
      }

      if (node.whereClause) {
        output.push('WHERE');
        try {
          output.push(this.visit(node.whereClause, context));
        } catch (error) {
          console.warn(`Error processing whereClause in DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Error deparsing DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (node.returningList) {
        output.push('RETURNING');
        try {
          output.push(this.deparseReturningList(node.returningList, context));
        } catch (error) {
          console.warn(`Error processing returningList in DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Error deparsing DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return output.join(' ');
    } catch (error) {
      throw new Error(`Error deparsing DeleteStmt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  WithClause(node: t.WithClause, context: DeparserContext): string {
    const output: string[] = ['WITH'];

    if (node.recursive) {
      output.push('RECURSIVE');
    }

    if (node.ctes && node.ctes.length > 0) {
      const ctes = ListUtils.unwrapList(node.ctes);
      if (context.isPretty()) {
        const cteStrings = ctes.map((cte, index) => {
          const cteStr = this.visit(cte, context);
          const prefix = index === 0 ? context.newline() : ',' + context.newline();
          if (this.containsMultilineStringLiteral(cteStr)) {
            return prefix + cteStr;
          }
          return prefix + context.indent(cteStr);
        });
        output.push(cteStrings.join(''));
      } else {
        const cteStrings = ctes.map(cte => this.visit(cte, context));
        output.push(cteStrings.join(', '));
      }
    }

    return output.join(' ');
  }



  ResTarget(node: t.ResTarget, context: DeparserContext): string {
    const output: string[] = [];

    if (context.update && node.name) {
      output.push(QuoteUtils.quote(node.name));

      // Handle indirection (array indexing, field access, etc.)
      if (node.indirection && node.indirection.length > 0) {
        const indirectionStrs = ListUtils.unwrapList(node.indirection).map(item => {
          if (item.String) {
            return `.${QuoteUtils.quote(item.String.sval || item.String.str)}`;
          }
          return this.visit(item, context);
        });
        output.push(indirectionStrs.join(''));
      }

      output.push('=');
      if (node.val) {
        output.push(this.deparse(node.val, context));
      }
    } else if (context.insertColumns && node.name) {
      output.push(QuoteUtils.quote(node.name));

      // Handle indirection for INSERT column lists (e.g., q.c1.r)
      if (node.indirection && node.indirection.length > 0) {
        const indirectionStrs = ListUtils.unwrapList(node.indirection).map(item => {
          if (item.String) {
            return `.${QuoteUtils.quote(item.String.sval || item.String.str)}`;
          }
          return this.visit(item, context);
        });
        output.push(indirectionStrs.join(''));
      }
    } else {
      if (node.val) {
        output.push(this.deparse(node.val, context));
      }

      if (node.name) {
        output.push('AS');
        output.push(QuoteUtils.quote(node.name));
      }
    }

    return output.join(' ');
  }

  deparseReturningList(list: t.Node[], context: DeparserContext): string {
    return ListUtils.unwrapList(list)
      .filter(item => item != null && this.getNodeType(item) !== 'undefined')
      .map(item => {
        try {
          // Handle ResTarget wrapper
          if (this.getNodeType(item) === 'ResTarget') {
            const resTarget = this.getNodeData(item) as any;
            const val = resTarget.val ? this.visit(resTarget.val, context) : '';
            const alias = resTarget.name ? ` AS ${QuoteUtils.quote(resTarget.name)}` : '';
            return val + alias;
          } else {
            const val = this.visit(item, context);
            return val;
          }
        } catch (error) {
          console.warn(`Error processing returning item: ${error instanceof Error ? error.message : String(error)}`);
          return '';
        }
      })
      .filter(item => item && item.trim())
      .join(', ');
  }

  BoolExpr(node: t.BoolExpr, context: DeparserContext): string {
    const boolop = node.boolop as string;
    const args = ListUtils.unwrapList(node.args);

    let formatStr = '%s';
    if (context.bool) {
      formatStr = '(%s)';
    }

    const boolContext = context.spawn('BoolExpr', { bool: true });

    // explanation of our syntax/fix below:
    // return formatStr.replace('%s', andArgs); // ❌ Interprets $ as special syntax
    // return formatStr.replace('%s', () => andArgs); // ✅ Function callback prevents interpretation

    switch (boolop) {
      case 'AND_EXPR':
        if (context.isPretty() && args.length > 1) {
          const andArgs = args.map(arg => this.visit(arg, boolContext)).join(context.newline() + context.indent('AND '));
          return formatStr.replace('%s', () => andArgs);
        } else {
          const andArgs = args.map(arg => this.visit(arg, boolContext)).join(' AND ');
          return formatStr.replace('%s', () => andArgs);
        }
      case 'OR_EXPR':
        if (context.isPretty() && args.length > 1) {
          const orArgs = args.map(arg => this.visit(arg, boolContext)).join(context.newline() + context.indent('OR '));
          return formatStr.replace('%s', () => orArgs);
        } else {
          const orArgs = args.map(arg => this.visit(arg, boolContext)).join(' OR ');
          return formatStr.replace('%s', () => orArgs);
        }
      case 'NOT_EXPR':
        return `NOT (${this.visit(args[0], context)})`;
      default:
        throw new Error(`Unhandled BoolExpr boolop: ${boolop}`);
    }
  }

  FuncCall(node: t.FuncCall, context: DeparserContext): string {
    const funcname = ListUtils.unwrapList(node.funcname);
    const args = ListUtils.unwrapList(node.args);
    const name = funcname.map(n => this.visit(n, context)).join('.');

    // Handle special SQL syntax functions like XMLEXISTS and EXTRACT
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.xmlexists' && args.length >= 2) {
      const xpath = this.visit(args[0], context);
      const xmlDoc = this.visit(args[1], context);
      return `xmlexists (${xpath} PASSING ${xmlDoc})`;
    }

    // Handle EXTRACT function with SQL syntax
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.extract' && args.length >= 2) {
      const field = this.visit(args[0], context);
      const source = this.visit(args[1], context);
      return `EXTRACT(${field} FROM ${source})`;
    }

    // Handle TRIM function with SQL syntax (TRIM TRAILING/LEADING/BOTH)
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && (name === 'pg_catalog.rtrim' || name === 'pg_catalog.ltrim' || name === 'pg_catalog.btrim') && args.length >= 1) {
      const source = this.visit(args[0], context);
      let trimChar = '';

      // Handle optional trim character (second argument)
      if (args.length >= 2) {
        trimChar = ` ${this.visit(args[1], context)}`;
      }

      if (name === 'pg_catalog.rtrim') {
        return `TRIM(TRAILING${trimChar} FROM ${source})`;
      } else if (name === 'pg_catalog.ltrim') {
        return `TRIM(LEADING${trimChar} FROM ${source})`;
      } else if (name === 'pg_catalog.btrim') {
        return `TRIM(BOTH${trimChar} FROM ${source})`;
      }
    }

    // Handle COLLATION FOR function - use SQL syntax instead of function call
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.pg_collation_for') {
      const argStrs = args.map(arg => this.visit(arg, context));
      return `COLLATION FOR (${argStrs.join(', ')})`;
    }

    // Handle SUBSTRING function with FROM ... FOR ... syntax
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.substring') {
      const source = this.visit(args[0], context);
      if (args.length === 3) {
        const start = this.visit(args[1], context);
        const length = this.visit(args[2], context);
        return `SUBSTRING(${source} FROM ${start} FOR ${length})`;
      } else if (args.length === 2) {
        const start = this.visit(args[1], context);
        return `SUBSTRING(${source} FROM ${start})`;
      }
    }

    // Handle POSITION function with IN syntax
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.position') {
      if (args.length === 2) {
        const string = this.visit(args[0], context);
        const substring = this.visit(args[1], context);
        return `POSITION(${substring} IN ${string})`;
      }
    }

    // Handle OVERLAY function with PLACING ... FROM ... FOR ... syntax
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.overlay') {
      if (args.length === 4) {
        const string = this.visit(args[0], context);
        const substring = this.visit(args[1], context);
        const start = this.visit(args[2], context);
        const length = this.visit(args[3], context);
        return `OVERLAY(${string} PLACING ${substring} FROM ${start} FOR ${length})`;
      } else if (args.length === 3) {
        const string = this.visit(args[0], context);
        const substring = this.visit(args[1], context);
        const start = this.visit(args[2], context);
        return `OVERLAY(${string} PLACING ${substring} FROM ${start})`;
      }
    }

    // Handle IS NORMALIZED function with SQL syntax
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.is_normalized') {
      const string = this.visit(args[0], context);
      if (args.length === 2) {
        const form = this.visit(args[1], context);
        const formValue = form.replace(/'/g, '');
        return `${string} IS ${formValue} NORMALIZED`;
      } else {
        return `${string} IS NORMALIZED`;
      }
    }

    // Handle NORMALIZE function with SQL syntax
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.normalize') {
      const string = this.visit(args[0], context);
      if (args.length === 2) {
        const form = this.visit(args[1], context);
        const formValue = form.replace(/'/g, '');
        return `normalize(${string}, ${formValue})`;
      } else {
        return `normalize(${string})`;
      }
    }

    // Handle SYSTEM_USER function with SQL syntax (no parentheses)
    if (node.funcformat === 'COERCE_SQL_SYNTAX' && name === 'pg_catalog.system_user' && args.length === 0) {
      return 'SYSTEM_USER';
    }

    // Handle OVERLAPS operator with special infix syntax
    if (name === 'pg_catalog.overlaps' && args.length === 4) {
      const left1 = this.visit(args[0], context);
      const left2 = this.visit(args[1], context);
      const right1 = this.visit(args[2], context);
      const right2 = this.visit(args[3], context);
      return `(${left1}, ${left2}) OVERLAPS (${right1}, ${right2})`;
    }

    // Handle AT TIME ZONE operator with special infix syntax
    if (name === 'pg_catalog.timezone' && args.length === 2) {
      let timestamp = this.visit(args[1], context);
      const timezone = this.visit(args[0], context);

      // Add parentheses around timestamp if it contains arithmetic operations
      if (args[1] && 'A_Expr' in args[1] && args[1].A_Expr?.kind === 'AEXPR_OP') {
        const op = this.deparseOperatorName(ListUtils.unwrapList(args[1].A_Expr.name), context);
        if (op === '+' || op === '-' || op === '*' || op === '/') {
          timestamp = context.parens(timestamp);
        }
      }

      return `${timestamp} AT TIME ZONE ${timezone}`;
    }

    const params: string[] = [];

    if (node.agg_star) {
      if (node.agg_distinct) {
        params.push('DISTINCT *');
      } else {
        params.push('*');
      }
    } else {
      const argStrs = args.map(arg => this.visit(arg, context));
      if (node.func_variadic && argStrs.length > 0) {
        const lastIndex = argStrs.length - 1;
        argStrs[lastIndex] = `VARIADIC ${argStrs[lastIndex]}`;
      }

      if (node.agg_distinct && argStrs.length > 0) {
        params.push('DISTINCT ' + argStrs.join(', '));
      } else {
        params.push(...argStrs);
      }
    }

    // Handle aggregate ORDER BY clause - it should be part of the function call without comma separation
    let orderByClause = '';
    if (node.agg_order && node.agg_order.length > 0) {
      const orderItems = ListUtils.unwrapList(node.agg_order);
      const orderStrs = orderItems.map(item => this.visit(item, context));
      if (node.agg_within_group) {
        // For WITHIN GROUP aggregates, ORDER BY goes outside the parentheses
        orderByClause = ` WITHIN GROUP (ORDER BY ${orderStrs.join(', ')})`;
      } else {
        // For regular aggregates, ORDER BY goes inside the parentheses
        orderByClause = ` ORDER BY ${orderStrs.join(', ')}`;
      }
    }

    let result;
    if (node.agg_within_group && orderByClause) {
      result = `${name}(${params.join(', ')})${orderByClause}`;
    } else {
      // For regular functions, ORDER BY goes inside the parentheses
      result = `${name}(${params.join(', ')}${orderByClause})`;
    }

    if (node.agg_filter) {
      result += ` FILTER (WHERE ${this.visit(node.agg_filter, context)})`;
    }

    if (node.over) {
      // Handle named window references first
      if (node.over.name) {
        result += ` OVER ${node.over.name}`;
      } else {
        const windowParts: string[] = [];

        if (node.over.partitionClause) {
          const partitions = ListUtils.unwrapList(node.over.partitionClause);
          const partitionStrs = partitions.map(p => this.visit(p, context));
          windowParts.push(`PARTITION BY ${partitionStrs.join(', ')}`);
        }

        if (node.over.orderClause) {
          const orders = ListUtils.unwrapList(node.over.orderClause);
          const orderStrs = orders.map(o => this.visit(o, context));
          windowParts.push(`ORDER BY ${orderStrs.join(', ')}`);
        }

        // Handle window frame specifications using the dedicated formatWindowFrame method
        const frameClause = this.formatWindowFrame(node.over, context.spawn('FuncCall'));
        if (frameClause) {
          windowParts.push(frameClause);
        }

        if (windowParts.length > 0) {
          if (context.isPretty() && windowParts.length > 1) {
            const formattedParts = windowParts.map(part => context.indent(part));
            result += ` OVER (${context.newline()}${formattedParts.join(context.newline())}${context.newline()})`;
          } else {
            result += ` OVER (${windowParts.join(' ')})`;
          }
        } else {
          result += ` OVER ()`;
        }
      }
    }

    return result;
  }

  FuncExpr(node: t.FuncExpr, context: DeparserContext): string {
    const funcName = `func_${node.funcid}`;
    const args = node.args ? ListUtils.unwrapList(node.args).map(arg => this.visit(arg, context)).join(', ') : '';
    return `${funcName}(${args})`;
  }

  A_Const(node: t.A_Const, context: DeparserContext): string {
    const nodeAny = node as any;

    if (nodeAny.ival !== undefined) {
      if (typeof nodeAny.ival === 'object' && nodeAny.ival !== null) {
        if (nodeAny.ival.ival !== undefined) {
          return nodeAny.ival.ival.toString();
        } else if (Object.keys(nodeAny.ival).length === 0) {
          return '0';
        } else {
          return nodeAny.ival.toString();
        }
      } else if (nodeAny.ival === null) {
        return 'NULL';
      } else {
        return nodeAny.ival.toString();
      }
    } else if (nodeAny.fval !== undefined) {
      if (typeof nodeAny.fval === 'object' && nodeAny.fval !== null) {
        if (nodeAny.fval.fval !== undefined) {
          return nodeAny.fval.fval.toString();
        } else if (Object.keys(nodeAny.fval).length === 0) {
          return '0.0';
        } else {
          return nodeAny.fval.toString();
        }
      } else if (nodeAny.fval === null) {
        return 'NULL';
      } else {
        return nodeAny.fval.toString();
      }
    } else if (nodeAny.sval !== undefined) {
      if (typeof nodeAny.sval === 'object' && nodeAny.sval !== null) {
        if (nodeAny.sval.sval !== undefined) {
          return QuoteUtils.formatEString(nodeAny.sval.sval);
        } else if (nodeAny.sval.String && nodeAny.sval.String.sval !== undefined) {
          return QuoteUtils.formatEString(nodeAny.sval.String.sval);
        } else if (Object.keys(nodeAny.sval).length === 0) {
          return "''";
        } else {
          return QuoteUtils.formatEString(nodeAny.sval.toString());
        }
      } else if (nodeAny.sval === null) {
        return 'NULL';
      } else {
        return QuoteUtils.formatEString(nodeAny.sval);
      }
    } else if (nodeAny.boolval !== undefined) {
      if (typeof nodeAny.boolval === 'object' && nodeAny.boolval !== null) {
        if (nodeAny.boolval.boolval !== undefined) {
          return nodeAny.boolval.boolval ? 'true' : 'false';
        } else if (Object.keys(nodeAny.boolval).length === 0) {
          return 'false';
        } else {
          return nodeAny.boolval ? 'true' : 'false';
        }
      } else if (nodeAny.boolval === null) {
        return 'NULL';
      } else {
        return nodeAny.boolval ? 'true' : 'false';
      }
    } else if (nodeAny.bsval !== undefined) {
      if (typeof nodeAny.bsval === 'object' && nodeAny.bsval !== null) {
        if (nodeAny.bsval.bsval !== undefined) {
          const bsval = nodeAny.bsval.bsval;
          // Check if this is a hexadecimal bit string (starts with x and contains only hex digits)
          if (bsval.startsWith('x') && /^x[0-9A-Fa-f]+$/.test(bsval)) {
            return `x'${bsval.substring(1)}'`;
          }
          if (bsval.startsWith('b')) {
            return `b'${bsval.substring(1)}'`;
          }
          return `b'${bsval}'`;
        } else if (Object.keys(nodeAny.bsval).length === 0) {
          return "''";
        } else {
          return nodeAny.bsval.toString();
        }
      } else if (nodeAny.bsval === null) {
        return 'NULL';
      } else {
        const bsval = nodeAny.bsval;
        // Check if this is a hexadecimal bit string (starts with x and contains only hex digits)
        if (bsval.startsWith('x') && /^x[0-9A-Fa-f]+$/.test(bsval)) {
          return `x'${bsval.substring(1)}'`;
        }
        if (bsval.startsWith('b')) {
          return `b'${bsval.substring(1)}'`;
        }
        return `b'${bsval}'`;
      }
    }

    if (nodeAny.val) {
      if (nodeAny.val.Integer?.ival !== undefined) {
        return nodeAny.val.Integer.ival.toString();
      } else if (nodeAny.val.Float?.fval !== undefined) {
        return nodeAny.val.Float.fval.toString();
      } else if (nodeAny.val.String?.sval !== undefined) {
        return QuoteUtils.escape(nodeAny.val.String.sval);
      } else if (nodeAny.val.Boolean?.boolval !== undefined) {
        return nodeAny.val.Boolean.boolval ? 'true' : 'false';
      } else if (nodeAny.val.BitString?.bsval !== undefined) {
        return nodeAny.val.BitString.bsval;
      }
    }

    if (nodeAny.isnull === true) {
      return 'NULL';
    }

    if (typeof nodeAny === 'object' && nodeAny !== null) {
      if (nodeAny.Boolean !== undefined) {
        return nodeAny.Boolean ? 'true' : 'false';
      }
      if (nodeAny.Integer !== undefined) {
        if (typeof nodeAny.Integer === 'object' && nodeAny.Integer.ival !== undefined) {
          return nodeAny.Integer.ival.toString();
        }
        return nodeAny.Integer.toString();
      }
      if (nodeAny.Float !== undefined) {
        if (typeof nodeAny.Float === 'object' && nodeAny.Float.fval !== undefined) {
          return nodeAny.Float.fval.toString();
        }
        return nodeAny.Float.toString();
      }
      if (nodeAny.String !== undefined) {
        if (typeof nodeAny.String === 'object' && nodeAny.String.sval !== undefined) {
          return QuoteUtils.escape(nodeAny.String.sval);
        }
        return QuoteUtils.escape(nodeAny.String);
      }

      if (Object.keys(nodeAny).length === 0) {
        return 'NULL';
      }

      console.warn('A_Const: Unhandled object structure:', JSON.stringify(nodeAny, null, 2));
      return 'NULL';
    }

    return 'NULL';
  }

  ColumnRef(node: t.ColumnRef, context: DeparserContext): string {
    const fields = ListUtils.unwrapList(node.fields);
    return fields.map(field => {
      if (field.String) {
        return QuoteUtils.quote(field.String.sval || field.String.str);
      } else if (field.A_Star) {
        return '*';
      }
      return this.visit(field, context);
    }).join('.');
  }

  TypeName(node: t.TypeName, context: DeparserContext): string {
    if (!node.names) {
      return '';
    }

    const output: string[] = [];

    // Handle SETOF keyword
    if (node.setof) {
      output.push('SETOF');
    }

    const names = node.names.map((name: any) => {
      if (name.String) {
        return name.String.sval || name.String.str;
      }
      return '';
    }).filter(Boolean);

    if (names.length === 0) {
      return '';
    }

    let args: string | null = null;
    if (node.typmods) {
      const isInterval = names.some((name: any) => {
        const nameStr = typeof name === 'string' ? name : (name.String?.sval || name.String?.str);
        return nameStr === 'interval';
      });

      if (isInterval) {
        args = this.formatIntervalTypeMods(node.typmods, context);
        // For interval types, we'll handle the formatting differently to avoid parentheses
      } else {
        args = this.formatTypeMods(node.typmods, context);
      }
    } else if (node.typemod && node.typemod !== -1) {
      args = this.formatSingleTypeMod(node.typemod, names[0]);
    }

    const mods = (name: string, size: string | null) => {
      if (size != null) {
        // For interval types, use space separation for fields in all contexts
        if (name === 'interval') {
          // If size starts with '(', it's precision - keep parentheses
          if (size.startsWith('(')) {
            return `${name}${size}`;
          }
          // Otherwise it's a field specification - use space separation
          return `${name} ${size}`;
        }
        return `${name}(${size})`;
      }
      return name;
    };

    const formatArrayBounds = (arrayBounds: any[]): string => {
      return arrayBounds.map(bound => {
        if (bound.Integer && bound.Integer.ival !== undefined && bound.Integer.ival !== -1) {
          return `[${bound.Integer.ival}]`;
        }
        return '[]';
      }).join('');
    };

    if (names.length === 1) {
      const typeName = names[0];

      if (typeName === 'char') {
        if (context.parentNodeTypes.includes('TypeCast') && args === '1') {
          output.push('"char"');
        } else {
          output.push(mods('"char"', args));
        }
        return output.join(' ');
      }

      const quotedTypeName = QuoteUtils.quote(typeName);
      let result = mods(quotedTypeName, args);

      if (node.arrayBounds && node.arrayBounds.length > 0) {
        result += formatArrayBounds(node.arrayBounds);
      }

      output.push(result);
      return output.join(' ');
    }

    if (names.length === 2) {
      const [catalog, type] = names;

      if (catalog === 'pg_catalog' && type === 'char') {
        output.push(mods('pg_catalog.char', args));
        return output.join(' ');
      }

      if (catalog === 'pg_catalog') {
        let typeName = `${catalog}.${type}`;

        if (type === 'bpchar' && args) {
          typeName = 'char';
        } else if (type === 'varchar') {
          typeName = 'varchar';
        } else if (type === 'numeric') {
          typeName = 'numeric';
        } else if (type === 'int4') {
          typeName = 'int';
        } else if (type === 'float8') {
          typeName = 'double precision';
        } else if (type === 'float4') {
          typeName = 'real';
        } else if (type === 'int8') {
          typeName = 'bigint';
        } else if (type === 'int2') {
          typeName = 'smallint';
        } else if (type === 'bool') {
          typeName = 'boolean';
        } else if (type === 'interval') {
          // For interval types, strip pg_catalog prefix and handle field specifications properly
          if (context.parentNodeTypes.includes('TypeCast')) {
            typeName = 'interval';
          } else {
            // For CREATE TABLE column definitions, preserve interval field syntax
            typeName = 'interval';
          }
        } else if (type === 'timestamptz') {
          if (args) {
            typeName = `timestamp(${args}) with time zone`;
            args = null; // Don't apply args again in mods()
          } else {
            typeName = 'timestamp with time zone';
          }
        } else if (type === 'timetz') {
          if (args) {
            typeName = `time(${args}) with time zone`;
            args = null; // Don't apply args again in mods()
          } else {
            typeName = 'time with time zone';
          }
        } else if (type === 'timestamp') {
          if (args) {
            typeName = `timestamp(${args})`;
            args = null; // Don't apply args again in mods()
          } else {
            typeName = 'timestamp';
          }
        } else if (type === 'time') {
          if (args) {
            typeName = `time(${args})`;
            args = null; // Don't apply args again in mods()
          } else {
            typeName = 'time';
          }
        }

        let result = mods(typeName, args);

        if (node.arrayBounds && node.arrayBounds.length > 0) {
          result += formatArrayBounds(node.arrayBounds);
        }

        output.push(result);
        return output.join(' ');
      }
    }

    const quotedNames = names.map((name: string) => QuoteUtils.quote(name));
    let result = mods(quotedNames.join('.'), args);

    if (node.arrayBounds && node.arrayBounds.length > 0) {
      result += formatArrayBounds(node.arrayBounds);
    }

    output.push(result);
    return output.join(' ');
  }

  Alias(node: t.Alias, context: DeparserContext): string {
    const name = node.aliasname;
    const output: string[] = [];

    if (node.colnames) {
      const colnames = ListUtils.unwrapList(node.colnames);
      const quotedColnames = colnames.map(col => {
        const colStr = this.deparse(col, context);
        // Check if already quoted to avoid double-quoting
        if (colStr.startsWith('"') && colStr.endsWith('"')) {
          return colStr;
        }
        return this.quoteIfNeeded(colStr);
      });
      output.push('AS', this.quoteIfNeeded(name) + context.parens(quotedColnames.join(', ')));
    } else {
      output.push('AS', this.quoteIfNeeded(name));
    }

    return output.join(' ');
  }

  RangeVar(node: t.RangeVar, context: DeparserContext): string {
    const output: string[] = [];
    // Handle ONLY keyword for inheritance control (but not for type definitions, ALTER TYPE, or CREATE FOREIGN TABLE)
    if (node && (!('inh' in node) || node.inh === undefined) &&
        !context.parentNodeTypes.includes('CompositeTypeStmt') &&
        (!context.parentNodeTypes.includes('AlterTypeStmt') && context.objtype !== 'OBJECT_TYPE') &&
        !context.parentNodeTypes.includes('CreateForeignTableStmt')) {
      output.push('ONLY');
    }

    let tableName = '';
    if (node.catalogname) {
      tableName = QuoteUtils.quote(node.catalogname);
      if (node.schemaname) {
        tableName += '.' + QuoteUtils.quote(node.schemaname);
      }
      tableName += '.' + QuoteUtils.quote(node.relname);
    } else if (node.schemaname) {
      tableName = QuoteUtils.quote(node.schemaname) + '.' + QuoteUtils.quote(node.relname);
    } else {
      tableName = QuoteUtils.quote(node.relname);
    }
    output.push(tableName);

    if (node.alias) {
      const aliasStr = this.Alias(node.alias, context);
      output.push(aliasStr);
    }

    const result = output.join(' ');

    return result;
  }

  formatIntervalTypeMods(typmods: t.Node[], context: DeparserContext): string | null {
    if (!typmods || typmods.length === 0) {
      return null;
    }

    const mods = ListUtils.unwrapList(typmods);
    const intervalFields: { [key: number]: string } = {
      4: 'year',
      2: 'month',
      8: 'day',
      1024: 'hour',
      2048: 'minute',
      4096: 'second',
      6: 'year to month',
      1032: 'day to hour',
      3080: 'day to minute',
      7176: 'day to second',
      3072: 'hour to minute',
      7168: 'hour to second',
      6144: 'minute to second'
    };

    // Handle single modifier - could be field or precision
    if (mods.length === 1) {
      const mod = mods[0];
      if (mod && typeof mod === 'object') {
        const aConst = (mod as any).A_Const;
        if (aConst && aConst.ival !== undefined) {
          const ivalValue = typeof aConst.ival === 'object' ? aConst.ival.ival : aConst.ival;
          if (ivalValue !== undefined) {
            // Check if it's a known interval field
            if (intervalFields[ivalValue]) {
              return intervalFields[ivalValue];
            }
            return `(${ivalValue})`;
          }
        }
      }
    }

    // Handle interval precision: interval(0), interval(3), etc.
    if (mods.length === 2) {
      const firstMod = mods[0];
      const secondMod = mods[1];

      if (firstMod && typeof firstMod === 'object') {
        const firstConst = (firstMod as any).A_Const;
        if (firstConst && firstConst.ival !== undefined) {
          const firstValue = typeof firstConst.ival === 'object' ? firstConst.ival.ival : firstConst.ival;

          // Check if second mod is precision (empty ival object or specific precision value)
          if (secondMod && typeof secondMod === 'object') {
            const secondConst = (secondMod as any).A_Const;
            if (secondConst && secondConst.ival !== undefined) {
              const secondValue = typeof secondConst.ival === 'object' ?
                (secondConst.ival.ival !== undefined ? secondConst.ival.ival : 0) :
                secondConst.ival;

              if (firstValue === 32767 && secondValue >= 0) {
                return `(${secondValue})`;
              }
              if (intervalFields[firstValue] && secondValue >= 0) {
                return `${intervalFields[firstValue]}(${secondValue})`;
              }
            }
          }
        }
      }
    }

    const fieldSpecs = mods.map(mod => {
      if (mod && typeof mod === 'object') {
        const aConst = (mod as any).A_Const;
        if (aConst && aConst.ival !== undefined) {
          const ivalValue = typeof aConst.ival === 'object' ? aConst.ival.ival : aConst.ival;
          if (ivalValue !== undefined) {
            return intervalFields[ivalValue] || ivalValue.toString();
          }
        }
      }
      const result = this.visit(mod, context);
      return result || '';
    }).filter(Boolean);

    return fieldSpecs.length > 0 ? fieldSpecs.join(' ') : null;
  }

  formatTypeMods(typmods: t.Node[], context: DeparserContext): string | null {
    if (!typmods || typmods.length === 0) {
      return null;
    }

    const mods = ListUtils.unwrapList(typmods);
    const filteredMods = mods.filter(mod => {
      if (mod && typeof mod === 'object') {
        const aConst = (mod as any).A_Const;
        if (aConst && aConst.ival) {
          // Handle both direct number and nested object structures
          const ivalValue = typeof aConst.ival === 'object' ? aConst.ival.ival : aConst.ival;
          if (ivalValue === 32767) {
            return false;
          }
        }
      }
      return true;
    });

    if (filteredMods.length === 0) {
      return null;
    }

    return filteredMods.map(mod => {
      return this.deparse(mod, context);
    }).join(', ');
  }

  formatSingleTypeMod(typemod: number, typeName: string): string | null {

    switch (typeName) {
      case 'varchar':
      case 'bpchar':
      case 'char':
        if (typemod > 4) {
          return (typemod - 64).toString();
        }
        break;
      case 'numeric':
      case 'decimal':
        if (typemod > 4) {
          const modValue = typemod - 4;
          const precision = (modValue >> 16) & 0xFFFF;
          const scale = modValue & 0xFFFF;
          if (scale > 0) {
            return `${precision},${scale}`;
          } else {
            return precision.toString();
          }
        }
        break;
      case 'time':
      case 'timetz':
      case 'timestamp':
      case 'timestamptz':
      case 'interval':
        if (typemod >= 0) {
          return typemod.toString();
        }
        break;
    }

    return null;
  }

  getPgCatalogTypeName(typeName: string, size: string | null): string {
    switch (typeName) {
      case 'bpchar':
        if (size != null) {
          return 'char';
        }
        return 'pg_catalog.bpchar';
      case 'varchar':
        return 'varchar';
      case 'numeric':
        return 'numeric';
      case 'bool':
        return 'boolean';
      case 'int2':
        return 'smallint';
      case 'int4':
        return 'int';
      case 'int8':
        return 'bigint';
      case 'real':
        return 'pg_catalog.float4';
      case 'time':
        return 'time';
      case 'timestamp':
        return 'timestamp';
      case 'interval':
        return 'interval';
      case 'bit':
        return 'bit';
      default:
        return `pg_catalog.${typeName}`;
    }
  }

  isPgCatalogType(typeName: string): boolean {
    const cleanTypeName = typeName.replace(/^pg_catalog\./, '');

    if (pgCatalogTypes.includes(cleanTypeName)) {
      return true;
    }

    for (const [realType, aliases] of pgCatalogTypeAliases) {
      if (aliases.includes(cleanTypeName)) {
        return true;
      }
    }

    return false;
  }

  A_ArrayExpr(node: t.A_ArrayExpr, context: DeparserContext): string {
    const elements = ListUtils.unwrapList(node.elements);
    const elementStrs = elements.map(el => this.visit(el, context));
    return `ARRAY[${elementStrs.join(', ')}]`;
  }

  A_Indices(node: t.A_Indices, context: DeparserContext): string {
    const output: string[] = [];

    if (node.is_slice) {
      if (node.lidx) {
        output.push(this.visit(node.lidx, context));
      }
      output.push(':');
      if (node.uidx) {
        output.push(this.visit(node.uidx, context));
      }
    } else {
      if (node.uidx) {
        output.push(this.visit(node.uidx, context));
      }
    }

    return `[${output.join('')}]`;
  }

  A_Indirection(node: t.A_Indirection, context: DeparserContext): string {
    let argStr = this.visit(node.arg, context);

    const argType = this.getNodeType(node.arg);
    if (argType === 'TypeCast' || argType === 'SubLink' || argType === 'A_Expr' || argType === 'FuncCall' || argType === 'A_Indirection' || argType === 'ColumnRef' || argType === 'RowExpr') {
      argStr = `(${argStr})`;
    }

    const output = [argStr];
    const indirection = ListUtils.unwrapList(node.indirection);

    for (const subnode of indirection) {
      if (subnode.String || subnode.A_Star) {
        const value = subnode.A_Star ? '*' : QuoteUtils.quote(subnode.String.sval || subnode.String.str);
        output.push(`.${value}`);
      } else {
        output.push(this.visit(subnode, context));
      }
    }

    return output.join('');
  }

  A_Star(node: t.A_Star, context: DeparserContext): string {
    return '*';
  }

  CaseExpr(node: t.CaseExpr, context: DeparserContext): string {
    const output: string[] = ['CASE'];

    if (node.arg) {
      output.push(this.visit(node.arg, context));
    }

    const args = ListUtils.unwrapList(node.args);

    if (context.isPretty() && args.length > 0) {
      for (const arg of args) {
        const whenClause = this.visit(arg, context);
        if (this.containsMultilineStringLiteral(whenClause)) {
          output.push(context.newline() + whenClause);
        } else {
          output.push(context.newline() + context.indent(whenClause));
        }
      }

      if (node.defresult) {
        const elseResult = this.visit(node.defresult, context);
        if (this.containsMultilineStringLiteral(elseResult)) {
          output.push(context.newline() + 'ELSE ' + elseResult);
        } else {
          output.push(context.newline() + context.indent('ELSE ' + elseResult));
        }
      }

      output.push(context.newline() + 'END');
      return output.join(' ');
    } else {
      for (const arg of args) {
        output.push(this.visit(arg, context));
      }

      if (node.defresult) {
        output.push('ELSE');
        output.push(this.visit(node.defresult, context));
      }

      output.push('END');
      return output.join(' ');
    }
  }

  CoalesceExpr(node: t.CoalesceExpr, context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    const argStrs = args.map(arg => this.visit(arg, context));
    return `COALESCE(${argStrs.join(', ')})`;
  }

  TypeCast(node: t.TypeCast, context: DeparserContext): string {
    const arg = this.visit(node.arg, context);
    const typeName = this.TypeName(node.typeName, context);

    // Check if this is a bpchar typecast that should preserve original syntax for AST consistency
    if (typeName === 'bpchar' || typeName === 'pg_catalog.bpchar') {
      const names = node.typeName?.names;
      const isQualifiedBpchar = names && names.length === 2 &&
                               (names[0] as any)?.String?.sval === 'pg_catalog' &&
                               (names[1] as any)?.String?.sval === 'bpchar';

      if (isQualifiedBpchar) {
        return `CAST(${arg} AS ${typeName})`;
      }
    }

    if (this.isPgCatalogType(typeName)) {
      const argType = this.getNodeType(node.arg);

      const isSimpleArgument = argType === 'A_Const' || argType === 'ColumnRef';
      const isFunctionCall = argType === 'FuncCall';

      if (isSimpleArgument || isFunctionCall) {
        // For simple arguments, avoid :: syntax if they have complex structure
        const shouldUseCastSyntax = isSimpleArgument && (arg.includes('(') || arg.startsWith('-'));
        
        if (!shouldUseCastSyntax) {
          const cleanTypeName = typeName.replace('pg_catalog.', '');
          // Wrap FuncCall arguments in parentheses to prevent operator precedence issues
          if (isFunctionCall) {
            return `${context.parens(arg)}::${cleanTypeName}`;
          }
          return `${arg}::${cleanTypeName}`;
        }
      }
    }

    return `CAST(${arg} AS ${typeName})`;
  }

  CollateClause(node: t.CollateClause, context: DeparserContext): string {
    const output: string[] = [];

    if (node.arg) {
      let argStr = this.visit(node.arg, context);

      const argType = this.getNodeType(node.arg);
      if (argType === 'A_Expr' || argType === 'FuncCall' || argType === 'SubLink') {
        argStr = `(${argStr})`;
      }

      output.push(argStr);
    }

    output.push('COLLATE');

    if (node.collname) {
      const collname = ListUtils.unwrapList(node.collname);
      output.push(collname.map(n => this.visit(n, context)).join('.'));
    }

    return output.join(' ');
  }

  BooleanTest(node: t.BooleanTest, context: DeparserContext): string {
    const output: string[] = [];
    const boolContext = context.spawn('BooleanTest', { bool: true });

    output.push(this.visit(node.arg, boolContext));

    switch (node.booltesttype as string) {
      case 'IS_TRUE':
        output.push('IS TRUE');
        break;
      case 'IS_NOT_TRUE':
        output.push('IS NOT TRUE');
        break;
      case 'IS_FALSE':
        output.push('IS FALSE');
        break;
      case 'IS_NOT_FALSE':
        output.push('IS NOT FALSE');
        break;
      case 'IS_UNKNOWN':
        output.push('IS UNKNOWN');
        break;
      case 'IS_NOT_UNKNOWN':
        output.push('IS NOT UNKNOWN');
        break;
    }

    return output.join(' ');
  }

  NullTest(node: t.NullTest, context: DeparserContext): string {
    const output: string[] = [];

    output.push(this.visit(node.arg, context));

    switch (node.nulltesttype as string) {
      case 'IS_NULL':
        output.push('IS NULL');
        break;
      case 'IS_NOT_NULL':
        output.push('IS NOT NULL');
        break;
    }

    return output.join(' ');
  }

  quoteIfNeeded(value: string): string {
    return QuoteUtils.quoteString(value);
  }

  preserveOperatorDefElemCase(defName: string): string {
    const caseMap: { [key: string]: string } = {
      'leftarg': 'Leftarg',
      'rightarg': 'Rightarg',
      'procedure': 'Procedure',
      'function': 'Function',
      'commutator': 'Commutator',
      'negator': 'Negator',
      'restrict': 'Restrict',
      'join': 'Join',
      'hashes': 'Hashes',
      'merges': 'Merges'
    };

    return caseMap[defName.toLowerCase()] || defName;
  }



  String(node: t.String, context: DeparserContext): string {
    if (context.isStringLiteral || context.isEnumValue) {
      return QuoteUtils.formatEString(node.sval || '');
    }

    const value = node.sval || '';

    if (context.parentNodeTypes.includes('DefElem') ||
        context.parentNodeTypes.includes('CreateOpClassItem')) {
      return value;
    }

    if (context.parentNodeTypes.includes('ObjectWithArgs')) {
      // Check if this is a pure operator symbol (only operator characters, no alphanumeric)
      const pureOperatorRegex = /^[+\-*/<>=~!@#%^&|`?]+$/;
      if (pureOperatorRegex.test(value)) {
        return value; // Don't quote pure operator symbols like "=" or "-"
      }
    }

    return QuoteUtils.quoteString(value);
  }

  Integer(node: t.Integer, context: DeparserContext): string {
    return node.ival?.toString() || '0';
  }

  Float(node: t.Float, context: DeparserContext): string {
    return node.fval || '0.0';
  }

  Boolean(node: t.Boolean, context: DeparserContext): string {
    return node.boolval ? 'true' : 'false';
  }

  BitString(node: t.BitString, context: DeparserContext): string {
    // Check if this is a hexadecimal bit string (starts with x)
    if (node.bsval.startsWith('x')) {
      return `x'${node.bsval.substring(1)}'`;
    }
    if (node.bsval.startsWith('b')) {
      return `b'${node.bsval.substring(1)}'`;
    }
    // Fallback for raw values without prefix
    return `b'${node.bsval}'`;
  }

  Null(node: t.Node, context: DeparserContext): string {
    return 'NULL';
  }

  List(node: t.List, context: DeparserContext): string {
    if (!node.items || node.items.length === 0) {
      return '';
    }
    return node.items.map((item: any) => this.visit(item, context)).join(', ');
  }

  CreateStmt(node: t.CreateStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.relation && node.relation.relpersistence === 't') {
      output.push('TEMPORARY');
    } else if (node.relation && node.relation.relpersistence === 'u') {
      output.push('UNLOGGED');
    }

    if (node.if_not_exists) {
      output.push('TABLE IF NOT EXISTS');
    } else {
      output.push('TABLE');
    }

    output.push(this.RangeVar(node.relation, context));

    // Handle typed tables (CREATE TABLE ... OF typename)
    if (node.ofTypename) {
      output.push('OF');
      output.push(this.TypeName(node.ofTypename, context));

      // Handle additional constraints for typed tables
      if (node.tableElts) {
        const elements = ListUtils.unwrapList(node.tableElts);
        const elementStrs = elements.map(el => {
          return this.deparse(el, context);
        });
        output.push(context.parens(elementStrs.join(', ')));
      }
    } else if (node.tableElts) {
      const elements = ListUtils.unwrapList(node.tableElts);
      const elementStrs = elements.map(el => {
        return this.deparse(el, context.spawn('CreateStmt'));
      });

      if (context.isPretty()) {
        const formattedElements = elementStrs.map(el => {
          const trimmedEl = el.trim();
          // Remove leading newlines from constraint elements to avoid extra blank lines
          if (trimmedEl.startsWith('\n')) {
            return context.indent(trimmedEl.substring(1));
          }
          return context.indent(trimmedEl);
        }).join(',' + context.newline());
        output.push('(' + context.newline() + formattedElements + context.newline() + ')');
      } else {
        output.push(context.parens(elementStrs.join(', ')));
      }
    }else if (!node.partbound) {
      output.push(context.parens(''));
    }

    if (node.partbound && node.inhRelations && node.inhRelations.length > 0) {
      output.push('PARTITION OF');
      const inherits = ListUtils.unwrapList(node.inhRelations);
      const inheritStrs = inherits.map(rel => this.visit(rel, context));
      output.push(inheritStrs[0]);

      if (node.partbound.strategy === 'l' && node.partbound.listdatums) {
        output.push('FOR VALUES IN');
        const listValues = ListUtils.unwrapList(node.partbound.listdatums)
          .map(datum => this.visit(datum, context))
          .join(', ');
        output.push(`(${listValues})`);
      } else if (node.partbound.strategy === 'r' && (node.partbound.lowerdatums || node.partbound.upperdatums)) {
        output.push('FOR VALUES FROM');
        if (node.partbound.lowerdatums) {
          const lowerValues = ListUtils.unwrapList(node.partbound.lowerdatums)
            .map(datum => this.visit(datum, context))
            .join(', ');
          output.push(`(${lowerValues})`);
        }
        if (node.partbound.upperdatums) {
          output.push('TO');
          const upperValues = ListUtils.unwrapList(node.partbound.upperdatums)
            .map(datum => this.visit(datum, context))
            .join(', ');
          output.push(`(${upperValues})`);
        }
      } else if (node.partbound.strategy === 'h' && node.partbound.modulus !== undefined) {
        output.push('FOR VALUES WITH');
        const remainder = node.partbound.remainder !== undefined ? node.partbound.remainder : 0;
        output.push(`(MODULUS ${node.partbound.modulus}, REMAINDER ${remainder})`);
      } else if (node.partbound.is_default) {
        output.push('DEFAULT');
      }
    } else if (node.inhRelations) {
      output.push('INHERITS');
      const inherits = ListUtils.unwrapList(node.inhRelations);
      const inheritStrs = inherits.map(rel => this.visit(rel, context));
      output.push(context.parens(inheritStrs.join(', ')));
    }

    if (node.partspec) {
      output.push('PARTITION BY');
      switch (node.partspec.strategy) {
        case 'PARTITION_STRATEGY_HASH':
          output.push('HASH');
          break;
        case 'PARTITION_STRATEGY_LIST':
          output.push('LIST');
          break;
        case 'PARTITION_STRATEGY_RANGE':
          output.push('RANGE');
          break;
      }
      if (node.partspec.partParams && node.partspec.partParams.length > 0) {
        const partParams = ListUtils.unwrapList(node.partspec.partParams)
          .map(param => this.visit(param, context))
          .join(', ');
        output.push(`(${partParams})`);
      }
    }

    if (node.oncommit && node.oncommit !== 'ONCOMMIT_NOOP') {
      output.push('ON COMMIT');
      switch (node.oncommit) {
        case 'ONCOMMIT_PRESERVE_ROWS':
          output.push('PRESERVE ROWS');
          break;
        case 'ONCOMMIT_DELETE_ROWS':
          output.push('DELETE ROWS');
          break;
        case 'ONCOMMIT_DROP':
          output.push('DROP');
          break;
      }
    }

    // Handle table options like WITH (fillfactor=10)
    if (node.options && node.options.length > 0) {
      const createStmtContext = context.spawn('CreateStmt');
      const optionStrs = node.options.map((option: any) => {
        return this.deparse(option, createStmtContext);
      });
      output.push('WITH', `(${optionStrs.join(', ')})`);
    }

    // Handle access method (USING clause)
    if (node.accessMethod) {
      output.push('USING');
      output.push(this.quoteIfNeeded(node.accessMethod));
    }

    return output.join(' ');
  }

  ColumnDef(node: t.ColumnDef, context: DeparserContext): string {
    const output: string[] = [];

    if (node.colname) {
      output.push(QuoteUtils.quote(node.colname));
    }

    if (node.typeName) {
      output.push(this.TypeName(node.typeName, context));
    }

    if (node.fdwoptions && node.fdwoptions.length > 0) {
      output.push('OPTIONS');
      const columnContext = context.spawn('ColumnDef');
      const options = ListUtils.unwrapList(node.fdwoptions).map(opt => this.visit(opt, columnContext));
      output.push(`(${options.join(', ')})`);
    }

    if (node.collClause) {
      output.push(this.CollateClause(node.collClause, context));
    }

    if (node.constraints) {
      const constraints = ListUtils.unwrapList(node.constraints);
      const constraintStrs = constraints.map(constraint => {
        const columnConstraintContext = context.spawn('ColumnDef', { isColumnConstraint: true });
        return this.visit(constraint, columnConstraintContext);
      });
      output.push(...constraintStrs);
    }

    if (node.raw_default) {
      output.push('DEFAULT');
      output.push(this.visit(node.raw_default, context));
    }

    if (node.generated) {
      output.push('GENERATED ALWAYS AS');
      output.push(`(${node.generated})`);
      output.push('STORED');
    }

    if (node.is_not_null) {
      output.push('NOT NULL');
    }

    return output.join(' ');
  }

  Constraint(node: t.Constraint, context: DeparserContext): string {
    const output: string[] = [];

    // Handle constraint name if present
    if (node.conname && (node.contype === 'CONSTR_CHECK' || node.contype === 'CONSTR_UNIQUE' || node.contype === 'CONSTR_PRIMARY' || node.contype === 'CONSTR_FOREIGN')) {
      output.push('CONSTRAINT');
      output.push(QuoteUtils.quote(node.conname));
    }

    switch (node.contype) {
      case 'CONSTR_NULL':
        output.push('NULL');
        break;
      case 'CONSTR_NOTNULL':
        output.push('NOT NULL');
        break;
      case 'CONSTR_DEFAULT':
        output.push('DEFAULT');
        if (node.raw_expr) {
          output.push(this.visit(node.raw_expr, context));
        }
        break;
      case 'CONSTR_CHECK':
        if (context.isPretty() && !context.isColumnConstraint) {
          output.push('\n' + context.indent('CHECK'));
        } else {
          output.push('CHECK');
        }
        if (node.raw_expr) {
          if (context.isPretty()) {
            const checkExpr = this.visit(node.raw_expr, context);
            if (checkExpr.includes('\n')) {
              output.push('(\n' + context.indent(checkExpr) + '\n)');
            } else {
              output.push(`(${checkExpr})`);
            }
          } else {
            output.push(context.parens(this.visit(node.raw_expr, context)));
          }
        }
        // Handle NOT VALID for check constraints
        if (node.skip_validation) {
          output.push('NOT VALID');
        }
        // Handle NO INHERIT for check constraints - only for table constraints, not domain constraints
        if (node.is_no_inherit && !context.isDomainConstraint) {
          output.push('NO INHERIT');
        }
        break;
      case 'CONSTR_GENERATED':
        output.push('GENERATED');
        if (node.generated_when === 'a') {
          output.push('ALWAYS');
        } else if (node.generated_when === 's') {
          output.push('BY DEFAULT');
        }
        output.push('AS');
        if (node.raw_expr) {
          output.push(context.parens(this.visit(node.raw_expr, context)));
        }
        output.push('STORED');
        break;
      case 'CONSTR_IDENTITY':
        output.push('GENERATED');
        if (node.generated_when === 'a') {
          output.push('ALWAYS');
        } else if (node.generated_when === 'd' || node.generated_when === 's') {
          output.push('BY DEFAULT');
        }
        output.push('AS IDENTITY');
        if (node.options && node.options.length > 0) {
          const optionStrs = ListUtils.unwrapList(node.options)
            .map(option => {
              if (option.DefElem) {
                const defElem = option.DefElem;
                if (defElem.defname === 'sequence_name') {
                  if (defElem.arg && defElem.arg.List) {
                    const nameList = ListUtils.unwrapList(defElem.arg)
                      .map(item => this.visit(item, context))
                      .join('.');
                    return `SEQUENCE NAME ${nameList}`;
                  }
                  return 'SEQUENCE NAME';
                } else if (defElem.defname === 'start') {
                  const argValue = defElem.arg ? this.visit(defElem.arg, context) : '';
                  return `START WITH ${argValue}`;
                } else if (defElem.defname === 'increment') {
                  const argValue = defElem.arg ? this.visit(defElem.arg, context) : '';
                  return `INCREMENT BY ${argValue}`;
                } else if (defElem.defname === 'minvalue') {
                  if (defElem.arg) {
                    const argValue = this.visit(defElem.arg, context);
                    return `MINVALUE ${argValue}`;
                  } else {
                    return 'NO MINVALUE';
                  }
                } else if (defElem.defname === 'maxvalue') {
                  if (defElem.arg) {
                    const argValue = this.visit(defElem.arg, context);
                    return `MAXVALUE ${argValue}`;
                  } else {
                    return 'NO MAXVALUE';
                  }
                } else if (defElem.defname === 'cache') {
                  const argValue = defElem.arg ? this.visit(defElem.arg, context) : '';
                  return `CACHE ${argValue}`;
                } else if (defElem.defname === 'cycle') {
                  const argValue = defElem.arg ? this.visit(defElem.arg, context) : '';
                  return argValue === 'true' ? 'CYCLE' : 'NO CYCLE';
                }
                const argValue = defElem.arg ? this.visit(defElem.arg, context) : '';
                return `${defElem.defname.toUpperCase()} ${argValue}`;
              }
              return this.visit(option, context);
            });
          if (context.isPretty()) {
            const indentedOptions = optionStrs.map(option => context.indent(option));
            output.push('(\n' + indentedOptions.join('\n') + '\n)');
          } else {
            output.push(`(${optionStrs.join(' ')})`);
          }
        }
        break;
      case 'CONSTR_PRIMARY':
        output.push('PRIMARY KEY');
        if (node.keys && node.keys.length > 0) {
          const keyList = ListUtils.unwrapList(node.keys)
            .map(key => this.visit(key, context))
            .join(', ');
          output.push(`(${keyList})`);
        }
        if (node.indexname) {
          output.push('USING INDEX');
          output.push(node.indexname);
        }
        break;
      case 'CONSTR_UNIQUE':
        if (context.isPretty() && !context.isColumnConstraint) {
          output.push('\n' + context.indent('UNIQUE'));
        } else {
          output.push('UNIQUE');
        }
        if (node.nulls_not_distinct) {
          output.push('NULLS NOT DISTINCT');
        }
        if (node.keys && node.keys.length > 0) {
          const keyList = ListUtils.unwrapList(node.keys)
            .map(key => this.visit(key, context))
            .join(', ');
          output.push(`(${keyList})`);
        }
        if (node.indexname) {
          output.push('USING INDEX');
          output.push(node.indexname);
        }
        break;
      case 'CONSTR_FOREIGN':
        // Only add "FOREIGN KEY" for table-level constraints, not column-level constraints
        if (!context.isColumnConstraint) {
          if (context.isPretty()) {
            output.push('\n' + context.indent('FOREIGN KEY'));
            if (node.fk_attrs && node.fk_attrs.length > 0) {
              const fkAttrs = ListUtils.unwrapList(node.fk_attrs)
                .map(attr => this.visit(attr, context))
                .join(', ');
              output.push(`(${fkAttrs})`);
            }
            output.push('\n' + context.indent('REFERENCES'));
          } else {
            output.push('FOREIGN KEY');
            if (node.fk_attrs && node.fk_attrs.length > 0) {
              const fkAttrs = ListUtils.unwrapList(node.fk_attrs)
                .map(attr => this.visit(attr, context))
                .join(', ');
              output.push(`(${fkAttrs})`);
            }
            output.push('REFERENCES');
          }
        } else {
          output.push('REFERENCES');
        }
        if (node.pktable) {
          if (context.isPretty() && !context.isColumnConstraint) {
            const lastIndex = output.length - 1;
            if (lastIndex >= 0 && output[lastIndex].includes('REFERENCES')) {
              output[lastIndex] += ' ' + this.RangeVar(node.pktable, context);
            } else {
              output.push(this.RangeVar(node.pktable, context));
            }
          } else {
            output.push(this.RangeVar(node.pktable, context));
          }
        }
        if (node.pk_attrs && node.pk_attrs.length > 0) {
          const pkAttrs = ListUtils.unwrapList(node.pk_attrs)
            .map(attr => this.visit(attr, context))
            .join(', ');
          if (context.isPretty() && !context.isColumnConstraint) {
            const lastIndex = output.length - 1;
            if (lastIndex >= 0) {
              output[lastIndex] += ` (${pkAttrs})`;
            } else {
              output.push(`(${pkAttrs})`);
            }
          } else {
            output.push(`(${pkAttrs})`);
          }
        }
        if (node.fk_matchtype && node.fk_matchtype !== 's') {
          let matchClause = '';
          switch (node.fk_matchtype) {
            case 'f':
              matchClause = 'MATCH FULL';
              break;
            case 'p':
              matchClause = 'MATCH PARTIAL';
              break;
          }
          if (context.isPretty() && !context.isColumnConstraint) {
            output.push('\n' + context.indent(matchClause));
          } else {
            output.push(matchClause);
          }
        }
        if (node.fk_upd_action && node.fk_upd_action !== 'a') {
          let updateClause = 'ON UPDATE ';
          switch (node.fk_upd_action) {
            case 'r':
              updateClause += 'RESTRICT';
              break;
            case 'c':
              updateClause += 'CASCADE';
              break;
            case 'n':
              updateClause += 'SET NULL';
              break;
            case 'd':
              updateClause += 'SET DEFAULT';
              break;
          }
          if (context.isPretty()) {
            output.push('\n' + context.indent(updateClause));
          } else {
            output.push('ON UPDATE');
            output.push(updateClause.replace('ON UPDATE ', ''));
          }
        }
        if (node.fk_del_action && node.fk_del_action !== 'a') {
          let deleteClause = 'ON DELETE ';
          switch (node.fk_del_action) {
            case 'r':
              deleteClause += 'RESTRICT';
              break;
            case 'c':
              deleteClause += 'CASCADE';
              break;
            case 'n':
              deleteClause += 'SET NULL';
              break;
            case 'd':
              deleteClause += 'SET DEFAULT';
              break;
          }
          if (context.isPretty()) {
            output.push('\n' + context.indent(deleteClause));
          } else {
            output.push('ON DELETE');
            output.push(deleteClause.replace('ON DELETE ', ''));
          }
        }
        // Handle NOT VALID for foreign key constraints - only for table constraints, not domain constraints
        if (node.skip_validation && !context.isDomainConstraint) {
          if (context.isPretty() && !context.isColumnConstraint) {
            output.push('\n' + context.indent('NOT VALID'));
          } else {
            output.push('NOT VALID');
          }
        }
        break;
      case 'CONSTR_ATTR_DEFERRABLE':
        output.push('DEFERRABLE');
        break;
      case 'CONSTR_ATTR_NOT_DEFERRABLE':
        output.push('NOT DEFERRABLE');
        break;
      case 'CONSTR_ATTR_DEFERRED':
        output.push('INITIALLY DEFERRED');
        break;
      case 'CONSTR_ATTR_IMMEDIATE':
        output.push('INITIALLY IMMEDIATE');
        break;
      case 'CONSTR_EXCLUSION':
        output.push('EXCLUDE');
        if (node.access_method) {
          output.push('USING');
          output.push(node.access_method);
        }
        if (node.exclusions && node.exclusions.length > 0) {
          const exclusionElements = ListUtils.unwrapList(node.exclusions).map(elem => {
            if (this.getNodeType(elem) === 'List') {
              const elemList = ListUtils.unwrapList(elem);
              if (elemList.length >= 2) {
                const column = this.visit(elemList[0], context);
                // Extract operator string from nested List structure
                const operatorNode = elemList[1];
                let operator = '';
                if (this.getNodeType(operatorNode) === 'List') {
                  const operatorList = ListUtils.unwrapList(operatorNode);
                  if (operatorList.length > 0 && operatorList[0].String) {
                    operator = operatorList[0].String.sval;
                  }
                } else if (operatorNode.String) {
                  operator = operatorNode.String.sval;
                } else {
                  operator = this.visit(operatorNode, context);
                }
                return `${column} WITH ${operator}`;
              }
            }
            return this.visit(elem, context);
          });
          output.push(`(${exclusionElements.join(', ')})`);
        }
        break;
    }

    // Handle deferrable constraints for all constraint types that support it
    if (node.contype === 'CONSTR_PRIMARY' || node.contype === 'CONSTR_UNIQUE' || node.contype === 'CONSTR_FOREIGN') {
      if (node.deferrable) {
        if (context.isPretty() && node.contype === 'CONSTR_FOREIGN') {
          output.push('\n' + context.indent('DEFERRABLE'));
          if (node.initdeferred === true) {
            output.push('\n' + context.indent('INITIALLY DEFERRED'));
          } else if (node.initdeferred === false) {
            output.push('\n' + context.indent('INITIALLY IMMEDIATE'));
          }
        } else {
          output.push('DEFERRABLE');
          if (node.initdeferred === true) {
            output.push('INITIALLY DEFERRED');
          } else if (node.initdeferred === false) {
            output.push('INITIALLY IMMEDIATE');
          }
        }
      } else if (node.deferrable === false) {
        if (context.isPretty() && node.contype === 'CONSTR_FOREIGN') {
          output.push('\n' + context.indent('NOT DEFERRABLE'));
        } else {
          output.push('NOT DEFERRABLE');
        }
      }
    }

    if (context.isPretty() && node.contype === 'CONSTR_FOREIGN') {
      let result = '';
      for (let i = 0; i < output.length; i++) {
        if (output[i].startsWith('\n')) {
          result += output[i];
        } else {
          if (i > 0 && !output[i-1].startsWith('\n')) {
            result += ' ';
          }
          result += output[i];
        }
      }
      return result;
    }
    return output.join(' ');
  }

  SubLink(node: t.SubLink, context: DeparserContext): string {
    const subselect = context.parens(this.visit(node.subselect, context));

    switch (node.subLinkType) {
      case 'ANY_SUBLINK':
        if (node.testexpr && node.operName) {
          const testExpr = this.visit(node.testexpr, context);
          const operator = this.deparseOperatorName(node.operName, context);
          return `${testExpr} ${operator} ANY ${subselect}`;
        } else if (node.testexpr) {
          const testExpr = this.visit(node.testexpr, context);
          return `${testExpr} IN ${subselect}`;
        }
        return subselect;
      case 'ALL_SUBLINK':
        if (node.testexpr && node.operName) {
          const testExpr = this.visit(node.testexpr, context);
          const operator = this.deparseOperatorName(node.operName, context);
          return `${testExpr} ${operator} ALL ${subselect}`;
        }
        return subselect;
      case 'EXISTS_SUBLINK':
        return `EXISTS ${subselect}`;
      case 'ARRAY_SUBLINK':
        return `ARRAY${subselect}`;
      case 'EXPR_SUBLINK':
      default:
        return subselect;
    }
  }

  CaseWhen(node: t.CaseWhen, context: DeparserContext): string {
    const output: string[] = ['WHEN'];

    if (node.expr) {
      output.push(this.visit(node.expr, context));
    }

    output.push('THEN');

    if (node.result) {
      output.push(this.visit(node.result, context));
    }

    return output.join(' ');
  }

  WindowDef(node: t.WindowDef, context: DeparserContext): string {
    const output: string[] = [];

    if (node.name) {
      output.push(node.name);
    }

    const windowParts: string[] = [];

    if (node.partitionClause) {
      const partitions = ListUtils.unwrapList(node.partitionClause);
      const partitionStrs = partitions.map(p => this.visit(p, context));
      windowParts.push(`PARTITION BY ${partitionStrs.join(', ')}`);
    }

    if (node.orderClause) {
      const orders = ListUtils.unwrapList(node.orderClause);
      const orderStrs = orders.map(o => this.visit(o, context));
      windowParts.push(`ORDER BY ${orderStrs.join(', ')}`);
    }

    // Only add frame clause if frameOptions indicates non-default framing
    if (node.frameOptions && node.frameOptions !== 1058) {
      const frameClause = this.formatWindowFrame(node, context.spawn('WindowDef'));
      if (frameClause) {
        windowParts.push(frameClause);
      }
    }

    if (windowParts.length > 0) {
      if (node.name) {
        output.push('AS');
      }
      output.push(`(${windowParts.join(' ')})`);
    } else if (node.name) {
      output.push('AS');
      output.push('()');
    } else if (output.length === 0) {
      output.push('()');
    }

    return output.join(' ');
  }

  formatWindowFrame(node: any, context: DeparserContext): string | null {
    if (!node.frameOptions) return null;

    const frameOptions = node.frameOptions;
    const frameParts: string[] = [];

    if (frameOptions & 0x01) { // FRAMEOPTION_NONDEFAULT
      if (frameOptions & 0x02) { // FRAMEOPTION_RANGE
        frameParts.push('RANGE');
      } else if (frameOptions & 0x04) { // FRAMEOPTION_ROWS
        frameParts.push('ROWS');
      } else if (frameOptions & 0x08) { // FRAMEOPTION_GROUPS
        frameParts.push('GROUPS');
      }
    }

    if (frameParts.length === 0) return null;

    const boundsParts: string[] = [];

    // Handle specific frameOptions values that have known mappings
    if (frameOptions === 789) {
      boundsParts.push('CURRENT ROW');
      boundsParts.push('AND UNBOUNDED FOLLOWING');
    } else if (frameOptions === 1077) {
      boundsParts.push('UNBOUNDED PRECEDING');
      boundsParts.push('AND CURRENT ROW');
    } else if (frameOptions === 18453) {
      if (node.startOffset && node.endOffset) {
        boundsParts.push(`${this.visit(node.startOffset, context)} PRECEDING`);
        boundsParts.push(`AND ${this.visit(node.endOffset, context)} FOLLOWING`);
      }
    } else if (frameOptions === 1557) {
      boundsParts.push('CURRENT ROW');
      boundsParts.push('AND CURRENT ROW');
    } else if (frameOptions === 16917) {
      boundsParts.push('CURRENT ROW');
      if (node.endOffset) {
        boundsParts.push(`AND ${this.visit(node.endOffset, context)} FOLLOWING`);
      }
    } else if (frameOptions === 1058) {
      return null;
    } else {
      // Handle start bound - prioritize explicit offset values over bit flags
      if (node.startOffset) {
        if (frameOptions & 0x400) { // FRAMEOPTION_START_VALUE_PRECEDING
          boundsParts.push(`${this.visit(node.startOffset, context)} PRECEDING`);
        } else if (frameOptions & 0x800) { // FRAMEOPTION_START_VALUE_FOLLOWING
          boundsParts.push(`${this.visit(node.startOffset, context)} FOLLOWING`);
        } else {
          boundsParts.push(`${this.visit(node.startOffset, context)} PRECEDING`);
        }
      } else if (frameOptions & 0x10) { // FRAMEOPTION_START_UNBOUNDED_PRECEDING
        boundsParts.push('UNBOUNDED PRECEDING');
      } else if (frameOptions & 0x20) { // FRAMEOPTION_START_CURRENT_ROW
        boundsParts.push('CURRENT ROW');
      }

      // Handle end bound - prioritize explicit offset values over bit flags
      if (node.endOffset) {
        if (boundsParts.length > 0) {
          if (frameOptions & 0x1000) { // FRAMEOPTION_END_VALUE_PRECEDING
            boundsParts.push(`AND ${this.visit(node.endOffset, context)} PRECEDING`);
          } else if (frameOptions & 0x2000) { // FRAMEOPTION_END_VALUE_FOLLOWING
            boundsParts.push(`AND ${this.visit(node.endOffset, context)} FOLLOWING`);
          } else {
            boundsParts.push(`AND ${this.visit(node.endOffset, context)} FOLLOWING`);
          }
        }
      } else if (frameOptions & 0x80) { // FRAMEOPTION_END_UNBOUNDED_FOLLOWING
        if (boundsParts.length > 0) {
          boundsParts.push('AND UNBOUNDED FOLLOWING');
        }
      } else if (frameOptions & 0x100) { // FRAMEOPTION_END_CURRENT_ROW
        if (boundsParts.length > 0) {
          boundsParts.push('AND CURRENT ROW');
        }
      } else if (boundsParts.length > 0) {
        boundsParts.push('AND CURRENT ROW');
      }
    }

    if (boundsParts.length > 0) {
      frameParts.push('BETWEEN');
      frameParts.push(boundsParts.join(' '));
    }

    return frameParts.join(' ');
  }

  SortBy(node: t.SortBy, context: DeparserContext): string {
    const output: string[] = [];

    if (node.node) {
      output.push(this.visit(node.node, context));
    }

    if (node.sortby_dir === 'SORTBY_USING' && node.useOp) {
      output.push('USING');
      const useOp = ListUtils.unwrapList(node.useOp);
      output.push(useOp.map(op => {
        if (op.String && op.String.sval) {
          return op.String.sval;
        }
        return this.visit(op, context);
      }).join('.'));
    }else if (node.sortby_dir === 'SORTBY_ASC') {
      output.push('ASC');
    } else if (node.sortby_dir === 'SORTBY_DESC') {
      output.push('DESC');
    }

    if (node.sortby_nulls === 'SORTBY_NULLS_FIRST') {
      output.push('NULLS FIRST');
    } else if (node.sortby_nulls === 'SORTBY_NULLS_LAST') {
      output.push('NULLS LAST');
    }

    return output.join(' ');
  }

  GroupingSet(node: t.GroupingSet, context: DeparserContext): string {
    switch (node.kind) {
      case 'GROUPING_SET_EMPTY':
        return '()';
      case 'GROUPING_SET_SIMPLE':
        // Not present in raw parse trees
        return '';
      case 'GROUPING_SET_ROLLUP':
        const rollupContent = ListUtils.unwrapList(node.content);
        const rollupStrs = rollupContent.map(c => this.visit(c, context));
        return `ROLLUP (${rollupStrs.join(', ')})`;
      case 'GROUPING_SET_CUBE':
        const cubeContent = ListUtils.unwrapList(node.content);
        const cubeStrs = cubeContent.map(c => this.visit(c, context));
        return `CUBE (${cubeStrs.join(', ')})`;
      case 'GROUPING_SET_SETS':
        const setsContent = ListUtils.unwrapList(node.content);
        const setsStrs = setsContent.map(c => this.visit(c, context));
        return `GROUPING SETS (${setsStrs.join(', ')})`;
      default:
        return '';
    }
  }

  CommonTableExpr(node: t.CommonTableExpr, context: DeparserContext): string {
    const output: string[] = [];

    if (node.ctename) {
      output.push(node.ctename);
    }

    if (node.aliascolnames) {
      const colnames = ListUtils.unwrapList(node.aliascolnames);
      const colnameStrs = colnames.map(col => this.visit(col, context));
      // Don't add space before column list parentheses to match original formatting
      output[output.length - 1] += context.parens(colnameStrs.join(', '));
    }

    output.push('AS');

    // Handle materialization clauses
    if (node.ctematerialized === 'CTEMaterializeNever') {
      output.push('NOT MATERIALIZED');
    } else if (node.ctematerialized === 'CTEMaterializeAlways') {
      output.push('MATERIALIZED');
    }

    if (node.ctequery) {
      output.push(context.parens(this.visit(node.ctequery, context)));
    }

    return output.join(' ');
  }

  ParamRef(node: t.ParamRef, context: DeparserContext): string {
    return `$${node.number}`;
  }

  LockingClause(node: any, context: DeparserContext): string {
    const output: string[] = [];

    switch (node.strength) {
      case 'LCS_FORUPDATE':
        output.push('FOR UPDATE');
        break;
      case 'LCS_FORSHARE':
        output.push('FOR SHARE');
        break;
      case 'LCS_FORKEYSHARE':
        output.push('FOR KEY SHARE');
        break;
      case 'LCS_FORNOKEYUPDATE':
        output.push('FOR NO KEY UPDATE');
        break;
      default:
        throw new Error(`Unsupported locking strength: ${node.strength}`);
    }

    if (node.lockedRels && node.lockedRels.length > 0) {
      output.push('OF');
      const relations = ListUtils.unwrapList(node.lockedRels)
        .map(rel => this.visit(rel as Node, context))
        .join(', ');
      output.push(relations);
    }

    if (node.waitPolicy === 'LockWaitSkip') {
      output.push('SKIP LOCKED');
    } else if (node.waitPolicy === 'LockWaitError') {
      output.push('NOWAIT');
    }

    return output.join(' ');
  }

  MinMaxExpr(node: t.MinMaxExpr, context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    const argStrs = args.map(arg => this.visit(arg, context));

    if (node.op === 'IS_GREATEST') {
      return `GREATEST(${argStrs.join(', ')})`;
    } else {
      return `LEAST(${argStrs.join(', ')})`;
    }
  }

  RowExpr(node: t.RowExpr, context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    const argStrs = args.map(arg => this.visit(arg, context));

    if (node.row_format === 'COERCE_IMPLICIT_CAST') {
      return `(${argStrs.join(', ')})`;
    }

    return `ROW(${argStrs.join(', ')})`;
  }

  OpExpr(node: t.OpExpr, context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    if (args.length === 2) {
      const left = this.visit(args[0], context);
      const right = this.visit(args[1], context);
      const opname = this.getOperatorName(node.opno);
      return `${left} ${opname} ${right}`;
    } else if (args.length === 1) {
      const arg = this.visit(args[0], context);
      const opname = this.getOperatorName(node.opno);
      return `${opname} ${arg}`;
    }
    throw new Error(`Unsupported OpExpr with ${args.length} arguments`);
  }

  DistinctExpr(node: t.DistinctExpr, context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    if (args.length === 2) {
      const literalContext = context.spawn('DistinctExpr', { isStringLiteral: true });
      const left = this.visit(args[0], literalContext);
      const right = this.visit(args[1], literalContext);
      return `${left} IS DISTINCT FROM ${right}`;
    }
    throw new Error(`DistinctExpr requires exactly 2 arguments, got ${args.length}`);
  }

  NullIfExpr(node: t.NullIfExpr, context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    if (args.length === 2) {
      const literalContext = context.spawn('NullIfExpr', { isStringLiteral: true });
      const left = this.visit(args[0], literalContext);
      const right = this.visit(args[1], literalContext);
      return `NULLIF(${left}, ${right})`;
    }
    throw new Error(`NullIfExpr requires exactly 2 arguments, got ${args.length}`);
  }

  ScalarArrayOpExpr(node: t.ScalarArrayOpExpr, context: DeparserContext): string {
    const args = ListUtils.unwrapList(node.args);
    if (args.length === 2) {
      const left = this.visit(args[0], context);
      const right = this.visit(args[1], context);
      const operator = node.useOr ? 'ANY' : 'ALL';
      const opname = this.getOperatorName(node.opno);
      return `${left} ${opname} ${operator}(${right})`;
    }
    throw new Error(`ScalarArrayOpExpr requires exactly 2 arguments, got ${args.length}`);
  }

  Aggref(node: t.Aggref, context: DeparserContext): string {
    const funcName = this.getAggFunctionName(node.aggfnoid);
    let result = funcName + '(';

    const hasDistinct = node.aggdistinct && node.aggdistinct.length > 0;

    if (node.args && node.args.length > 0) {
      const args = ListUtils.unwrapList(node.args);
      const argStrs = args.map(arg => this.visit(arg, context));

      if (hasDistinct) {
        result += 'DISTINCT ' + argStrs.join(', ');
      } else {
        result += argStrs.join(', ');
      }
    } else if (funcName.toUpperCase() === 'COUNT') {
      if (hasDistinct) {
        result += 'DISTINCT *';
      } else {
        result += '*';
      }
    }

    result += ')';

    if (node.aggorder && node.aggorder.length > 0) {
      result += ' ORDER BY ';
      const orderItems = ListUtils.unwrapList(node.aggorder);
      const orderStrs = orderItems.map(item => this.visit(item, context));
      result += orderStrs.join(', ');
    }

    return result;
  }

  WindowFunc(node: t.WindowFunc, context: DeparserContext): string {
    const funcName = this.getWindowFunctionName(node.winfnoid);
    let result = funcName + '(';

    if (node.args && node.args.length > 0) {
      const args = ListUtils.unwrapList(node.args);
      const argStrs = args.map(arg => this.visit(arg, context));
      result += argStrs.join(', ');
    }

    result += ') OVER (';

    if (node.winref && typeof node.winref === 'object') {
      result += this.visit(node.winref as any, context);
    } else if (node.winref) {
      result += 'ORDER BY created_at ASC';
    }

    result += ')';

    return result;
  }



  FieldSelect(node: t.FieldSelect, context: DeparserContext): string {
    const output: string[] = [];

    if (node.arg) {
      output.push(this.visit(node.arg, context));
    }

    if (node.fieldnum !== undefined) {
      output.push(`.field_${node.fieldnum}`);
    }

    return output.join('');
  }

  RelabelType(node: t.RelabelType, context: DeparserContext): string {
    if (node.arg) {
      const literalContext = context.spawn('RelabelType', { isStringLiteral: true });
      return this.visit(node.arg, literalContext);
    }
    return '';
  }

  CoerceViaIO(node: t.CoerceViaIO, context: DeparserContext): string {
    if (node.arg) {
      return this.visit(node.arg, context);
    }
    return '';
  }

  ArrayCoerceExpr(node: t.ArrayCoerceExpr, context: DeparserContext): string {
    if (node.arg) {
      return this.visit(node.arg, context);
    }
    return '';
  }

  ConvertRowtypeExpr(node: t.ConvertRowtypeExpr, context: DeparserContext): string {
    if (node.arg) {
      const literalContext = context.spawn('ConvertRowtypeExpr', { isStringLiteral: true });
      return this.visit(node.arg, literalContext);
    }
    return '';
  }

  NamedArgExpr(node: t.NamedArgExpr, context: DeparserContext): string {
    const output: string[] = [];

    if (node.name) {
      output.push(node.name);
      output.push('=>');
    }

    if (node.arg) {
      output.push(this.visit(node.arg, context));
    }

    return output.join(' ');
  }

  ViewStmt(node: t.ViewStmt, context: DeparserContext): string {
    const output: string[] = [];

    output.push('CREATE');

    if (node.replace) {
      output.push('OR REPLACE');
    }

    if (node.view && node.view.relpersistence === 't') {
      output.push('TEMPORARY');
    }

    output.push('VIEW');

    if (node.view) {
      output.push(this.RangeVar(node.view, context));
    }

    if (node.aliases && node.aliases.length > 0) {
      const aliasStrs = ListUtils.unwrapList(node.aliases).map(alias => this.visit(alias, context));
      output.push(context.parens(aliasStrs.join(', ')));
    }

    if (node.options && node.options.length > 0) {
      const viewContext = context.spawn('ViewStmt');
      const optionStrs = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, viewContext));
      output.push(`WITH (${optionStrs.join(', ')})`);
    }

    output.push('AS');

    if (node.query) {
      output.push(this.visit(node.query, context));
    }

    if (node.withCheckOption) {
      switch (node.withCheckOption) {
        case 'CASCADED_CHECK_OPTION':
          output.push('WITH CASCADED CHECK OPTION');
          break;
        case 'LOCAL_CHECK_OPTION':
          output.push('WITH LOCAL CHECK OPTION');
          break;
      }
    }

    return output.join(' ');
  }

  IndexStmt(node: t.IndexStmt, context: DeparserContext): string {
    const output: string[] = [];

    output.push('CREATE');

    if (node.unique) {
      output.push('UNIQUE');
    }

    output.push('INDEX');

    if (node.concurrent) {
      output.push('CONCURRENTLY');
    }

    if (node.if_not_exists) {
      output.push('IF NOT EXISTS');
    }

    if (node.idxname) {
      output.push(QuoteUtils.quote(node.idxname));
    }

    output.push('ON');

    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));
    }

    if (node.accessMethod && node.accessMethod !== 'btree') {
      output.push('USING');
      output.push(node.accessMethod);
    }

    if (node.indexParams && node.indexParams.length > 0) {
      const paramStrs = ListUtils.unwrapList(node.indexParams).map(param => this.visit(param, context));
      output.push(context.parens(paramStrs.join(', ')));
    }

    if (node.indexIncludingParams && node.indexIncludingParams.length > 0) {
      const includeStrs = ListUtils.unwrapList(node.indexIncludingParams).map(param => this.visit(param, context));
      output.push('INCLUDE');
      output.push(context.parens(includeStrs.join(', ')));
    }

    if (node.whereClause) {
      output.push('WHERE');
      output.push(this.visit(node.whereClause, context));
    }

    if (node.options && node.options.length > 0) {
      const indexContext = context.spawn('IndexStmt');
      const optionStrs = ListUtils.unwrapList(node.options).map(option => this.visit(option, indexContext));
      output.push('WITH');
      output.push(context.parens(optionStrs.join(', ')));
    }

    if (node.nulls_not_distinct) {
      output.push('NULLS NOT DISTINCT');
    }

    if (node.tableSpace) {
      output.push('TABLESPACE');
      output.push(QuoteUtils.quote(node.tableSpace));
    }

    return output.join(' ');
  }

  IndexElem(node: t.IndexElem, context: DeparserContext): string {
    const output: string[] = [];

    if (node.name) {
      output.push(QuoteUtils.quote(node.name));
    } else if (node.expr) {
      output.push(context.parens(this.visit(node.expr, context)));
    }

    if (node.collation && node.collation.length > 0) {
      const collationStrs = ListUtils.unwrapList(node.collation).map(coll => this.visit(coll, context));
      output.push('COLLATE');
      output.push(collationStrs.join('.'));
    }

    if (node.opclass && node.opclass.length > 0) {
      const opclassStrs = ListUtils.unwrapList(node.opclass).map(op => this.visit(op, context));
      let opclassStr = opclassStrs.join('.');

      // Handle operator class parameters (opclassopts)
      if (node.opclassopts && node.opclassopts.length > 0) {
        const opclassOpts = ListUtils.unwrapList(node.opclassopts).map(opt => {
          if (opt.DefElem && opt.DefElem.arg && this.getNodeType(opt.DefElem.arg) === 'String') {
            const stringData = this.getNodeData(opt.DefElem.arg);
            return `${opt.DefElem.defname}='${stringData.sval}'`;
          }
          return this.visit(opt, context.spawn('IndexElem'));
        });
        opclassStr += `(${opclassOpts.join(', ')})`;
      }

      output.push(opclassStr);
    }

    if (node.ordering) {
      switch (node.ordering) {
        case 'SORTBY_ASC':
          output.push('ASC');
          break;
        case 'SORTBY_DESC':
          output.push('DESC');
          break;
      }
    }

    if (node.nulls_ordering) {
      switch (node.nulls_ordering) {
        case 'SORTBY_NULLS_FIRST':
          output.push('NULLS FIRST');
          break;
        case 'SORTBY_NULLS_LAST':
          output.push('NULLS LAST');
          break;
      }
    }

    return output.join(' ');
  }

  PartitionElem(node: t.PartitionElem, context: DeparserContext): string {
    const output: string[] = [];

    if (node.name) {
      output.push(QuoteUtils.quote(node.name));
    } else if (node.expr) {
      output.push(context.parens(this.visit(node.expr, context)));
    }

    if (node.collation && node.collation.length > 0) {
      const collationStrs = ListUtils.unwrapList(node.collation).map(coll => this.visit(coll, context));
      output.push('COLLATE');
      output.push(collationStrs.join('.'));
    }

    if (node.opclass && node.opclass.length > 0) {
      const opclassStrs = ListUtils.unwrapList(node.opclass).map(op => this.visit(op, context));
      output.push(opclassStrs.join('.'));
    }

    return output.join(' ');
  }

  PartitionCmd(node: t.PartitionCmd, context: DeparserContext): string {
    const output: string[] = [];

    if (node.concurrent) {
      output.push('CONCURRENTLY');
    }

    if (node.name) {
      output.push(this.visit(node.name as any, context));
    }

    if (node.bound) {
      if (node.bound.strategy === 'l' && node.bound.listdatums) {
        output.push('FOR VALUES IN');
        const listValues = ListUtils.unwrapList(node.bound.listdatums)
          .map(datum => this.visit(datum, context))
          .join(', ');
        output.push(`(${listValues})`);
      } else if (node.bound.strategy === 'r' && (node.bound.lowerdatums || node.bound.upperdatums)) {
        output.push('FOR VALUES FROM');
        if (node.bound.lowerdatums) {
          const lowerValues = ListUtils.unwrapList(node.bound.lowerdatums)
            .map(datum => this.visit(datum, context))
            .join(', ');
          output.push(`(${lowerValues})`);
        }
        if (node.bound.upperdatums) {
          output.push('TO');
          const upperValues = ListUtils.unwrapList(node.bound.upperdatums)
            .map(datum => this.visit(datum, context))
            .join(', ');
          output.push(`(${upperValues})`);
        }
      } else if (node.bound.strategy === 'h' && node.bound.modulus !== undefined && node.bound.remainder !== undefined) {
        output.push('FOR VALUES WITH');
        output.push(`(modulus ${node.bound.modulus}, remainder ${node.bound.remainder})`);
      } else if (node.bound.is_default) {
        output.push('DEFAULT');
      }
    }

    return output.join(' ');
  }

  private getAggFunctionName(aggfnoid?: number): string {
    const commonAggFunctions: { [key: number]: string } = {
      2100: 'avg',
      2101: 'count',
      2102: 'max',
      2103: 'min',
      2104: 'sum',
      2105: 'stddev',
      2106: 'variance',
      2107: 'array_agg',
      2108: 'string_agg'
    };

    return commonAggFunctions[aggfnoid || 0] || 'unknown_agg';
  }

  private getWindowFunctionName(winfnoid?: number): string {
    const commonWindowFunctions: { [key: number]: string } = {
      3100: 'row_number',
      3101: 'rank',
      3102: 'dense_rank',
      3103: 'percent_rank',
      3104: 'cume_dist',
      3105: 'ntile',
      3106: 'lag',
      3107: 'lead',
      3108: 'first_value',
      3109: 'last_value'
    };

    return commonWindowFunctions[winfnoid || 0] || 'unknown_window_func';
  }

  private getOperatorName(opno?: number): string {
    const commonOperators: { [key: number]: string } = {
      96: '=',
      518: '<>',
      97: '<',
      521: '>',
      523: '<=',
      525: '>=',
      551: '+',
      552: '-',
      553: '*',
      554: '/',
      555: '%',
      484: '-', // unary minus
      1752: '~~', // LIKE
      1753: '!~~', // NOT LIKE
      1754: '~~*', // ILIKE
      1755: '!~~*', // NOT ILIKE
      15: '=', // int4eq
      58: '<', // int4lt
      59: '<=', // int4le
      61: '>', // int4gt
      62: '>=', // int4ge
    };

    return commonOperators[opno || 0] || '=';
  }

  JoinExpr(node: t.JoinExpr, context: DeparserContext): string {
    const output: string[] = [];

    if (node.larg) {
      output.push(this.visit(node.larg, context));
    }

    let joinStr = '';
    if (node.isNatural) {
      joinStr = 'NATURAL ';
    }

    switch (node.jointype) {
      case 'JOIN_INNER':
        if (node.isNatural) {
          joinStr += 'JOIN';
        }
        else if (!node.quals && (!node.usingClause || node.usingClause.length === 0)) {
          joinStr += 'CROSS JOIN';
        } else {
          joinStr += 'JOIN';
        }
        break;
      case 'JOIN_LEFT':
        joinStr += 'LEFT JOIN';
        break;
      case 'JOIN_FULL':
        joinStr += 'FULL JOIN';
        break;
      case 'JOIN_RIGHT':
        joinStr += 'RIGHT JOIN';
        break;
      default:
        joinStr += 'JOIN';
    }

    if (node.rarg) {
      let rargStr = this.visit(node.rarg, context);

      if (node.rarg && 'JoinExpr' in node.rarg && !node.rarg.JoinExpr.alias) {
        rargStr = `(${rargStr})`;
      }

      if (context.isPretty()) {
        output.push(context.newline() + joinStr + ' ' + rargStr);
      } else {
        output.push(joinStr + ' ' + rargStr);
      }
    } else {
      if (context.isPretty()) {
        output.push(context.newline() + joinStr);
      } else {
        output.push(joinStr);
      }
    }

    if (node.usingClause && node.usingClause.length > 0) {
      const usingList = ListUtils.unwrapList(node.usingClause);
      const columnNames = usingList.map(col => this.visit(col, context));
      if (context.isPretty()) {
        output.push(` USING (${columnNames.join(', ')})`);
      } else {
        output.push(`USING (${columnNames.join(', ')})`);
      }
    } else if (node.quals) {
      const qualsStr = this.visit(node.quals, context);
      if (context.isPretty()) {
        // For complex JOIN conditions, format with proper indentation
        if (qualsStr.includes('AND') || qualsStr.includes('OR') || qualsStr.length > 50) {
          if (this.containsMultilineStringLiteral(qualsStr)) {
            output.push(` ON ${qualsStr}`);
          } else {
            output.push(` ON${context.newline()}${context.indent(qualsStr)}`);
          }
        } else {
          output.push(` ON ${qualsStr}`);
        }
      } else {
        output.push(`ON ${qualsStr}`);
      }
    }

    let result;
    if (context.isPretty()) {
      result = output.join('');
    } else {
      result = output.join(' ');
    }

    if (node.join_using_alias && node.join_using_alias.aliasname) {
      let aliasStr = node.join_using_alias.aliasname;
      if (node.join_using_alias.colnames && node.join_using_alias.colnames.length > 0) {
        const colNames = ListUtils.unwrapList(node.join_using_alias.colnames);
        const columnList = colNames.map(col => this.visit(col, context)).join(', ');
        aliasStr += `(${columnList})`;
      }
      result += ` AS ${aliasStr}`;
    }

    if (node.alias && node.alias.aliasname) {
      let aliasStr = node.alias.aliasname;
      if (node.alias.colnames && node.alias.colnames.length > 0) {
        const colNames = ListUtils.unwrapList(node.alias.colnames);
        const columnList = colNames.map(col => this.visit(col, context)).join(', ');
        aliasStr += `(${columnList})`;
      }
      result = `(${result}) ${aliasStr}`;
    }

    return result;
  }

  FromExpr(node: t.FromExpr, context: DeparserContext): string {
    const fromlist = ListUtils.unwrapList(node.fromlist);
    const fromStrs = fromlist.map(item => this.visit(item, context));

    let result = fromStrs.join(', ');

    if (node.quals) {
      result += ` WHERE ${this.visit(node.quals, context)}`;
    }

    return result;
  }

  TransactionStmt(node: t.TransactionStmt, context: DeparserContext): string {
    const output: string[] = [];

    switch (node.kind) {
      case 'TRANS_STMT_BEGIN':
        output.push('BEGIN');
        break;
      case 'TRANS_STMT_START':
        output.push('START TRANSACTION');
        break;
      case 'TRANS_STMT_COMMIT':
        output.push('COMMIT');
        break;
      case 'TRANS_STMT_ROLLBACK':
        output.push('ROLLBACK');
        break;
      case 'TRANS_STMT_SAVEPOINT':
        output.push('SAVEPOINT');
        if (node.savepoint_name) {
          output.push(QuoteUtils.quote(node.savepoint_name));
        }
        break;
      case 'TRANS_STMT_RELEASE':
        output.push('RELEASE SAVEPOINT');
        if (node.savepoint_name) {
          output.push(QuoteUtils.quote(node.savepoint_name));
        }
        break;
      case 'TRANS_STMT_ROLLBACK_TO':
        output.push('ROLLBACK TO');
        if (node.savepoint_name) {
          output.push(QuoteUtils.quote(node.savepoint_name));
        }
        break;
      case 'TRANS_STMT_PREPARE':
        output.push('PREPARE TRANSACTION');
        if (node.gid) {
          output.push(`'${node.gid}'`);
        }
        break;
      case 'TRANS_STMT_COMMIT_PREPARED':
        output.push('COMMIT PREPARED');
        if (node.gid) {
          output.push(`'${node.gid}'`);
        }
        break;
      case 'TRANS_STMT_ROLLBACK_PREPARED':
        output.push('ROLLBACK PREPARED');
        if (node.gid) {
          output.push(`'${node.gid}'`);
        }
        break;
      default:
        throw new Error(`Unsupported TransactionStmt kind: ${node.kind}`);
    }

    // Handle transaction options (e.g., READ ONLY, ISOLATION LEVEL)
    if (node.options && node.options.length > 0) {
      const options = ListUtils.unwrapList(node.options).map(option => {
        if (option.DefElem) {
          const defElem = option.DefElem;
          if (defElem.defname === 'transaction_read_only') {
            // Handle both A_Const with ival (integer) and sval (string) values
            let boolValue = false;
            if (defElem.arg) {
              const nodeData = this.getNodeData(defElem.arg);
              if (nodeData.ival !== undefined) {
                // Handle nested ival structure: { ival: { ival: 1 } }
                const ivalValue = typeof nodeData.ival === 'object' ? nodeData.ival.ival : nodeData.ival;
                boolValue = ivalValue === 1;
              } else if (nodeData.sval !== undefined) {
                // Handle nested sval structure: { sval: { sval: "value" } }
                const svalValue = typeof nodeData.sval === 'object' ? nodeData.sval.sval : nodeData.sval;
                const stringValue = svalValue.replace(/'/g, '');
                boolValue = stringValue.toLowerCase() === 'on' || stringValue.toLowerCase() === 'true';
              }
            }
            return boolValue ? 'READ ONLY' : 'READ WRITE';
          } else if (defElem.defname === 'transaction_isolation') {
            if (defElem.arg && defElem.arg.A_Const && defElem.arg.A_Const.sval) {
              return `ISOLATION LEVEL ${defElem.arg.A_Const.sval.sval.toUpperCase()}`;
            }
          } else if (defElem.defname === 'transaction_deferrable') {
            // Handle both A_Const with ival (integer) and sval (string) values
            let boolValue = false;
            if (defElem.arg) {
              const nodeData = this.getNodeData(defElem.arg);
              if (nodeData.ival !== undefined) {
                // Handle nested ival structure: { ival: { ival: 1 } }
                const ivalValue = typeof nodeData.ival === 'object' ? nodeData.ival.ival : nodeData.ival;
                boolValue = ivalValue === 1;
              } else if (nodeData.sval !== undefined) {
                // Handle nested sval structure: { sval: { sval: "value" } }
                const svalValue = typeof nodeData.sval === 'object' ? nodeData.sval.sval : nodeData.sval;
                const stringValue = svalValue.replace(/'/g, '');
                boolValue = stringValue.toLowerCase() === 'on' || stringValue.toLowerCase() === 'true';
              }
            }
            return boolValue ? 'DEFERRABLE' : 'NOT DEFERRABLE';
          }
        }
        return this.visit(option, context);
      }).filter(Boolean);

      if (options.length > 0) {
        output.push(options.join(', '));
      }
    }

    return output.join(' ');
  }

  VariableSetStmt(node: t.VariableSetStmt, context: DeparserContext): string {
    switch (node.kind) {
      case 'VAR_SET_VALUE':
        const localPrefix = node.is_local ? 'LOCAL ' : '';
        const args = node.args ? ListUtils.unwrapList(node.args).map(arg => {
          const nodeData = this.getNodeData(arg);
          if (nodeData.sval !== undefined) {
            const svalValue = typeof nodeData.sval === 'object' ? nodeData.sval.sval : nodeData.sval;
            if (svalValue === '' || svalValue.includes(' ') || svalValue.includes('-') || /[A-Z]/.test(svalValue) || /^\d/.test(svalValue) || svalValue.includes('.') || svalValue.includes('$') || svalValue.toLowerCase() === 'all' || /^[+-]\d/.test(svalValue)) {
              return `'${svalValue}'`;
            }
            return svalValue;
          }
          return this.visit(arg, context);
        }).join(', ') : '';

              // Handle args - always include TO clause if args exist (even if empty string)
              const paramName = QuoteUtils.quoteString(node.name);
              if (!node.args || node.args.length === 0) {
                return `SET ${localPrefix}${paramName}`;
              }
              return `SET ${localPrefix}${paramName} TO ${args}`;
            case 'VAR_SET_DEFAULT':
              const defaultParamName = QuoteUtils.quoteString(node.name);
              return `SET ${defaultParamName} TO DEFAULT`;
            case 'VAR_SET_CURRENT':
              const currentParamName = QuoteUtils.quoteString(node.name);
              return `SET ${currentParamName} FROM CURRENT`;
      case 'VAR_SET_MULTI':
        if (node.name === 'TRANSACTION' || node.name === 'SESSION CHARACTERISTICS') {
          // Handle SET TRANSACTION statements specially
          const transactionOptions: string[] = [];
          if (node.args) {
            const args = ListUtils.unwrapList(node.args);
            for (const arg of args) {
              if (arg.DefElem) {
                const defElem = arg.DefElem;
                if (defElem.defname === 'transaction_isolation') {
                  const value = defElem.arg ? this.visit(defElem.arg, context) : '';
                  transactionOptions.push(`ISOLATION LEVEL ${value.replace(/'/g, '').toUpperCase()}`);
                } else if (defElem.defname === 'transaction_read_only') {
                  // Handle both A_Const with ival (integer) and sval (string) values
                  let boolValue = false;
                  if (defElem.arg) {
                    const nodeData = this.getNodeData(defElem.arg);
                    if (nodeData.ival !== undefined) {
                      // Handle nested ival structure: { ival: { ival: 1 } }
                      const ivalValue = typeof nodeData.ival === 'object' ? nodeData.ival.ival : nodeData.ival;
                      boolValue = ivalValue === 1;
                    } else if (nodeData.sval !== undefined) {
                      // Handle nested sval structure: { sval: { sval: "value" } }
                      const svalValue = typeof nodeData.sval === 'object' ? nodeData.sval.sval : nodeData.sval;
                      const stringValue = svalValue.replace(/'/g, '');
                      boolValue = stringValue.toLowerCase() === 'on' || stringValue.toLowerCase() === 'true';
                    }
                  }
                  transactionOptions.push(boolValue ? 'READ ONLY' : 'READ WRITE');
                } else if (defElem.defname === 'transaction_deferrable') {
                  // Handle both A_Const with ival (integer) and sval (string) values
                  let boolValue = false;
                  if (defElem.arg) {
                    const nodeData = this.getNodeData(defElem.arg);
                    if (nodeData.ival !== undefined) {
                      // Handle nested ival structure: { ival: { ival: 1 } }
                      const ivalValue = typeof nodeData.ival === 'object' ? nodeData.ival.ival : nodeData.ival;
                      boolValue = ivalValue === 1;
                    } else if (nodeData.sval !== undefined) {
                      // Handle nested sval structure: { sval: { sval: "value" } }
                      const svalValue = typeof nodeData.sval === 'object' ? nodeData.sval.sval : nodeData.sval;
                      const stringValue = svalValue.replace(/'/g, '');
                      boolValue = stringValue.toLowerCase() === 'on' || stringValue.toLowerCase() === 'true';
                    }
                  }
                  transactionOptions.push(boolValue ? 'DEFERRABLE' : 'NOT DEFERRABLE');
                }
              }
            }
          }
          if (node.name === 'SESSION CHARACTERISTICS') {
            return `SET SESSION CHARACTERISTICS AS TRANSACTION ${transactionOptions.join(', ')}`;
          } else {
            return `SET TRANSACTION ${transactionOptions.join(', ')}`;
          }
        } else {
          // Handle other multi-variable sets
          const assignments = node.args ? ListUtils.unwrapList(node.args).map(arg => {
            if (arg.VariableSetStmt) {
              return this.VariableSetStmt(arg.VariableSetStmt, context);
            }
            return this.visit(arg, context);
          }).join(', ') : '';
          return `SET ${assignments}`;
        }
            case 'VAR_RESET':
              const resetParamName = QuoteUtils.quoteString(node.name);
              return `RESET ${resetParamName}`;
      case 'VAR_RESET_ALL':
        return 'RESET ALL';
      default:
        throw new Error(`Unsupported VariableSetStmt kind: ${node.kind}`);
    }
  }

  VariableShowStmt(node: t.VariableShowStmt, context: DeparserContext): string {
    if (node.name === 'ALL') {
      return 'SHOW ALL';
    }
    return `SHOW ${node.name}`;
  }

  CreateSchemaStmt(node: t.CreateSchemaStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE SCHEMA'];

    if (node.if_not_exists) {
      output.push('IF NOT EXISTS');
    }

    if (node.schemaname) {
      output.push(node.schemaname);
    }

    if (node.authrole) {
      output.push('AUTHORIZATION');
      output.push(this.RoleSpec(node.authrole, context));
    }

    if (node.schemaElts && node.schemaElts.length > 0) {
      const elements = ListUtils.unwrapList(node.schemaElts)
        .map(element => this.visit(element, context))
        .join(' ');
      output.push(elements);
    }

    return output.join(' ');
  }

  RoleSpec(node: t.RoleSpec, context: DeparserContext): string {
    if (node.rolename) {
      return this.quoteIfNeeded(node.rolename);
    }

    switch (node.roletype) {
      case 'ROLESPEC_PUBLIC':
        return 'PUBLIC';
      case 'ROLESPEC_CURRENT_USER':
        return 'CURRENT_USER';
      case 'ROLESPEC_SESSION_USER':
        return 'SESSION_USER';
      case 'ROLESPEC_CURRENT_ROLE':
        return 'CURRENT_ROLE';
      default:
        return 'PUBLIC';
    }
  }

  roletype(node: any, context: DeparserContext): string {
    if (node.rolename) {
      return node.rolename;
    }
    return '';
  }

  DropStmt(node: t.DropStmt, context: DeparserContext): string {
    const output: string[] = ['DROP'];

    if (node.removeType) {
      switch (node.removeType) {
        case 'OBJECT_TABLE':
          output.push('TABLE');
          break;
        case 'OBJECT_VIEW':
          output.push('VIEW');
          break;
        case 'OBJECT_INDEX':
          output.push('INDEX');
          break;
        case 'OBJECT_SEQUENCE':
          output.push('SEQUENCE');
          break;
        case 'OBJECT_SCHEMA':
          output.push('SCHEMA');
          break;
        case 'OBJECT_FUNCTION':
          output.push('FUNCTION');
          break;
        case 'OBJECT_PROCEDURE':
          output.push('PROCEDURE');
          break;
        case 'OBJECT_DATABASE':
          output.push('DATABASE');
          break;
        case 'OBJECT_EXTENSION':
          output.push('EXTENSION');
          break;
        case 'OBJECT_TYPE':
          output.push('TYPE');
          break;
        case 'OBJECT_DOMAIN':
          output.push('DOMAIN');
          break;
        case 'OBJECT_TRIGGER':
          output.push('TRIGGER');
          break;
        case 'OBJECT_RULE':
          output.push('RULE');
          break;
        case 'OBJECT_POLICY':
          output.push('POLICY');
          break;
        case 'OBJECT_ROLE':
          output.push('ROLE');
          break;

        case 'OBJECT_TABLESPACE':
          output.push('TABLESPACE');
          break;
        case 'OBJECT_FOREIGN_SERVER':
          output.push('SERVER');
          break;
        case 'OBJECT_FDW':
          output.push('FOREIGN DATA WRAPPER');
          break;
        case 'OBJECT_PUBLICATION':
          output.push('PUBLICATION');
          break;
        case 'OBJECT_SUBSCRIPTION':
          output.push('SUBSCRIPTION');
          break;
        case 'OBJECT_CAST':
          output.push('CAST');
          break;
        case 'OBJECT_TRANSFORM':
          output.push('TRANSFORM');
          break;
        case 'OBJECT_ACCESS_METHOD':
          output.push('ACCESS METHOD');
          break;
        case 'OBJECT_OPERATOR':
          output.push('OPERATOR');
          break;
        case 'OBJECT_FOREIGN_TABLE':
          output.push('FOREIGN TABLE');
          break;
        case 'OBJECT_MATVIEW':
          output.push('MATERIALIZED VIEW');
          break;
        case 'OBJECT_OPCLASS':
          output.push('OPERATOR CLASS');
          break;
        case 'OBJECT_OPFAMILY':
          output.push('OPERATOR FAMILY');
          break;
        case 'OBJECT_COLLATION':
          output.push('COLLATION');
          break;
        case 'OBJECT_CONVERSION':
          output.push('CONVERSION');
          break;
        case 'OBJECT_LANGUAGE':
          output.push('LANGUAGE');
          break;
        case 'OBJECT_LARGEOBJECT':
          output.push('LARGE OBJECT');
          break;
        case 'OBJECT_AGGREGATE':
          output.push('AGGREGATE');
          break;
        case 'OBJECT_STATISTIC_EXT':
          output.push('STATISTICS');
          break;
        case 'OBJECT_EVENT_TRIGGER':
          output.push('EVENT TRIGGER');
          break;
        case 'OBJECT_AMOP':
          output.push('OPERATOR CLASS');
          break;
        case 'OBJECT_AMPROC':
          output.push('OPERATOR CLASS');
          break;
        case 'OBJECT_ATTRIBUTE':
          output.push('ATTRIBUTE');
          break;
        case 'OBJECT_DEFAULT':
          output.push('DEFAULT');
          break;
        case 'OBJECT_DEFACL':
          output.push('DEFAULT PRIVILEGES');
          break;
        case 'OBJECT_PARAMETER_ACL':
          output.push('PARAMETER');
          break;
        case 'OBJECT_PUBLICATION_NAMESPACE':
          output.push('PUBLICATION');
          break;
        case 'OBJECT_PUBLICATION_REL':
          output.push('PUBLICATION');
          break;
        case 'OBJECT_ROUTINE':
          output.push('ROUTINE');
          break;
        case 'OBJECT_TABCONSTRAINT':
          output.push('CONSTRAINT');
          break;
        case 'OBJECT_TSCONFIGURATION':
          output.push('TEXT SEARCH CONFIGURATION');
          break;
        case 'OBJECT_TSDICTIONARY':
          output.push('TEXT SEARCH DICTIONARY');
          break;
        case 'OBJECT_TSPARSER':
          output.push('TEXT SEARCH PARSER');
          break;
        case 'OBJECT_TSTEMPLATE':
          output.push('TEXT SEARCH TEMPLATE');
          break;
        case 'OBJECT_USER_MAPPING':
          output.push('USER MAPPING');
          break;
        default:
          throw new Error(`Unsupported DROP object type: ${node.removeType}`);
      }
    }

    if (node.concurrent) {
      output.push('CONCURRENTLY');
    }

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    if (node.objects && node.objects.length > 0) {
      if (node.removeType === 'OBJECT_POLICY') {
        const objList = node.objects[0];
        if (objList && (objList as any).List && (objList as any).List.items) {
          const items = (objList as any).List.items.map((item: any) => {
            if (item.String && item.String.sval) {
              return item.String.sval;
            }
            return this.visit(item, context);
          });

          if (items.length === 3) {
            const [schemaName, tableName, policyName] = items;
            output.push(`${policyName} ON ${schemaName}.${tableName}`);
          } else if (items.length === 2) {
            const [tableName, policyName] = items;
            output.push(`${policyName} ON ${tableName}`);
          } else {
            // Fallback for unexpected structure
            output.push(items.join(', '));
          }
        }
      } else if (node.removeType === 'OBJECT_CAST') {
        const objects = node.objects.map((objList: any) => {
          if (objList && objList.List && objList.List.items) {
            const items = objList.List.items.map((item: any) => {
              return this.visit(item, context);
            }).filter((name: string) => name && name.trim());

            if (items.length === 2) {
              const [sourceType, targetType] = items;
              return `(${sourceType} AS ${targetType})`;
            }
            return items.join('.');
          }

          const objName = this.visit(objList, context);
          return objName;
        }).filter((name: string) => name && name.trim()).join(', ');
        if (objects) {
          output.push(objects);
        }
      } else if (node.removeType === 'OBJECT_TRIGGER' || node.removeType === 'OBJECT_RULE') {
        const objects = node.objects.map((objList: any) => {
          if (objList && objList.List && objList.List.items) {
            const items = objList.List.items.map((item: any) => {
              if (item.String && item.String.sval) {
                return QuoteUtils.quote(item.String.sval);
              }
              return this.visit(item, context);
            }).filter((name: string) => name && name.trim());

            if (items.length === 2) {
              const [tableName, triggerName] = items;
              return `${triggerName} ON ${tableName}`;
            } else if (items.length === 3) {
              const [schemaName, tableName, triggerName] = items;
              return `${triggerName} ON ${schemaName}.${tableName}`;
            }
            return items.join('.');
          }

          const objName = this.visit(objList, context);
          return objName;
        }).filter((name: string) => name && name.trim()).join(', ');
        if (objects) {
          output.push(objects);
        }
      } else if (node.removeType === 'OBJECT_OPFAMILY' || node.removeType === 'OBJECT_OPCLASS') {
        // Handle operator family and operator class objects specially to format name USING access_method correctly
        const objects = node.objects.map((objList: any) => {
          if (objList && objList.List && objList.List.items) {
            const items = objList.List.items.map((item: any) => {
              if (item.String && item.String.sval) {
                return item.String.sval;
              }
              return this.visit(item, context);
            }).filter((name: string) => name && name.trim());

            if (items.length === 2) {
              const accessMethod = items[0];
              const objectName = items[1];
              return `${QuoteUtils.quote(objectName)} USING ${accessMethod}`;
            } else if (items.length === 3) {
              const accessMethod = items[0];
              const schemaName = items[1];
              const objectName = items[2];
              return `${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(objectName)} USING ${accessMethod}`;
            }
            return items.join('.');
          }

          const objName = this.visit(objList, context);
          return objName;
        }).filter((name: string) => name && name.trim()).join(', ');
        if (objects) {
          output.push(objects);
        }
      } else if (node.removeType === 'OBJECT_TRANSFORM') {
        // Handle TRANSFORM objects specially to format FOR type_name LANGUAGE language_name correctly
        const objects = node.objects.map((objList: any) => {
          if (objList && objList.List && objList.List.items) {
            const items = objList.List.items.map((item: any) => {
              if (item.String && item.String.sval) {
                return item.String.sval;
              }
              return this.visit(item, context);
            }).filter((name: string) => name && name.trim());

            if (items.length === 2) {
              const [typeName, languageName] = items;
              return `FOR ${typeName} LANGUAGE ${languageName}`;
            }
            return items.join('.');
          }

          const objName = this.visit(objList, context);
          return objName;
        }).filter((name: string) => name && name.trim()).join(', ');
        if (objects) {
          output.push(objects);
        }
      } else {
        const objects = node.objects.map((objList: any) => {
          if (Array.isArray(objList)) {
            const objName = objList.map(obj => this.visit(obj, context)).filter(name => name && name.trim()).join('.');
            return objName;
          }

          if (objList && objList.List && objList.List.items) {
            const items = objList.List.items.map((item: any) => {
              if (item.String && item.String.sval) {
                return QuoteUtils.quote(item.String.sval);
              }
              return this.visit(item, context);
            }).filter((name: string) => name && name.trim());
            return items.join('.');
          }

          const objContext = context.spawn('DropStmt', { objtype: node.removeType });
          const objName = this.visit(objList, objContext);
          return objName;
        }).filter((name: string) => name && name.trim()).join(', ');
        if (objects) {
          output.push(objects);
        }
      }
    }

    if (node.behavior === 'DROP_CASCADE') {
      output.push('CASCADE');
    }
    // Only add RESTRICT if it was explicitly specified in the original SQL

    return output.join(' ');
  }

  TruncateStmt(node: t.TruncateStmt, context: DeparserContext): string {
    const output: string[] = ['TRUNCATE'];

    if (node.relations && node.relations.length > 0) {
      const relations = node.relations
        .map((relation: any) => this.visit(relation, context))
        .join(', ');
      output.push(relations);
    }

    if (node.restart_seqs) {
      output.push('RESTART IDENTITY');
    }

    if (node.behavior === 'DROP_CASCADE') {
      output.push('CASCADE');
    }

    return output.join(' ');
  }

  ReturnStmt(node: t.ReturnStmt, context: DeparserContext): string {
    const output: string[] = ['RETURN'];

    if (node.returnval) {
      const returnValue = this.visit(node.returnval, context);
      output.push(returnValue);
    }

    return output.join(' ');
  }

  PLAssignStmt(node: t.PLAssignStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.name) {
      let nameWithIndirection = QuoteUtils.quote(node.name);

      if (node.indirection && node.indirection.length > 0) {
        const indirectionStr = node.indirection
          .map((ind: any) => this.visit(ind, context))
          .join('');
        nameWithIndirection += indirectionStr;
      }

      output.push(nameWithIndirection);
    }

    output.push(':=');

    if (node.val) {
      const valAny = node.val as any;
      if (valAny.targetList) {
        output.push('SELECT');
        const targets = this.targetList(valAny.targetList, context);
        output.push(targets);
      } else {
        const valueStr = this.visit(node.val as any, context);
        output.push(valueStr);
      }
    }

    return output.join(' ');
  }

  CopyStmt(node: t.CopyStmt, context: DeparserContext): string {
    const output: string[] = ['COPY'];

    if (node.relation) {
      const relationStr = this.RangeVar(node.relation, context);
      output.push(relationStr);
    } else if (node.query) {
      const queryStr = this.visit(node.query, context);
      output.push(`(${queryStr})`);
    }

    if (node.attlist && node.attlist.length > 0) {
      const columnList = ListUtils.unwrapList(node.attlist)
        .map(col => this.visit(col, context))
        .join(', ');
      output.push(`(${columnList})`);
    }

    if (node.is_from) {
      output.push('FROM');
    } else {
      output.push('TO');
    }

    if (node.is_program) {
      output.push('PROGRAM');
    }

    if (node.filename) {
      output.push(`'${node.filename}'`);
    } else {
      output.push('STDIN');
    }

    if (node.options && node.options.length > 0) {
      output.push('WITH');
      const optionsStr = ListUtils.unwrapList(node.options)
        .map(opt => this.visit(opt, context.spawn('CopyStmt')))
        .join(', ');
      output.push(`(${optionsStr})`);
    }

    if (node.whereClause) {
      output.push('WHERE');
      const whereStr = this.visit(node.whereClause, context);
      output.push(whereStr);
    }

    return output.join(' ');
  }

  AlterTableStmt(node: t.AlterTableStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER'];

    if (node.objtype) {
      switch (node.objtype) {
        case 'OBJECT_TABLE':
          output.push('TABLE');
          break;
        case 'OBJECT_INDEX':
          output.push('INDEX');
          break;
        case 'OBJECT_SEQUENCE':
          output.push('SEQUENCE');
          break;
        case 'OBJECT_VIEW':
          output.push('VIEW');
          break;
        case 'OBJECT_MATVIEW':
          output.push('MATERIALIZED VIEW');
          break;
        case 'OBJECT_FOREIGN_TABLE':
          output.push('FOREIGN TABLE');
          break;
        case 'OBJECT_TYPE':
          output.push('TYPE');
          break;
        default:
          output.push('TABLE');
      }
    } else {
      output.push('TABLE');
    }

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    const alterContext = context.spawn('AlterTableStmt', { objtype: node.objtype });

    if (node.relation) {
      const relationStr = this.RangeVar(node.relation, alterContext);
      output.push(relationStr);
    }

    if (node.cmds && node.cmds.length > 0) {
      const commands = ListUtils.unwrapList(node.cmds);
      if (context.isPretty()) {
        const commandsStr = commands
          .map(cmd => {
            const cmdStr = this.visit(cmd, alterContext);
            return context.newline() + context.indent(cmdStr);
          })
          .join(',');
        output.push(commandsStr);
      } else {
        const commandsStr = commands
          .map(cmd => this.visit(cmd, alterContext))
          .join(', ');
        output.push(commandsStr);
      }
    }

    return output.join(' ');
  }

  AlterTableCmd(node: t.AlterTableCmd, context: DeparserContext): string {
    const output: string[] = [];

    if (node.subtype) {
      switch (node.subtype) {
        case 'AT_AddColumn':
          if (context.objtype === 'OBJECT_TYPE') {
            output.push('ADD ATTRIBUTE');
          } else {
            output.push('ADD COLUMN');
          }
          if (node.missing_ok) {
            output.push('IF NOT EXISTS');
          }
          if (node.def) {
            const colDefData = this.getNodeData(node.def);
            
            if (context.isPretty()) {
              const parts: string[] = [];
              const indentedParts: string[] = [];
              
              if (colDefData.colname) {
                parts.push(QuoteUtils.quote(colDefData.colname));
              }

              if (colDefData.typeName) {
                parts.push(this.TypeName(colDefData.typeName, context));
              }

              if (colDefData.is_not_null) {
                indentedParts.push('NOT NULL');
              }

              if (colDefData.collClause) {
                indentedParts.push(this.CollateClause(colDefData.collClause, context));
              }

              if (colDefData.constraints) {
                const constraints = ListUtils.unwrapList(colDefData.constraints);
                constraints.forEach(constraint => {
                  const columnConstraintContext = context.spawn('ColumnDef', { isColumnConstraint: true });
                  const constraintStr = this.visit(constraint, columnConstraintContext);
                  
                  if (constraintStr.includes('REFERENCES') && constraintStr.includes('ON DELETE')) {
                    const refMatch = constraintStr.match(/^(.*REFERENCES[^)]*\([^)]*\))\s*(ON\s+DELETE\s+CASCADE.*)$/);
                    if (refMatch) {
                      indentedParts.push(refMatch[1]);
                      indentedParts.push(refMatch[2]);
                    } else {
                      indentedParts.push(constraintStr);
                    }
                  } else if (constraintStr === 'UNIQUE' && colDefData.raw_default) {
                    const defaultStr = 'DEFAULT ' + this.visit(colDefData.raw_default, context);
                    indentedParts.push('UNIQUE ' + defaultStr);
                  } else {
                    indentedParts.push(constraintStr);
                  }
                });
              }

              if (colDefData.raw_default && !colDefData.constraints?.some((c: any) => {
                const constraintStr = this.visit(c, context.spawn('ColumnDef', { isColumnConstraint: true }));
                return constraintStr === 'UNIQUE';
              })) {
                const defaultStr = 'DEFAULT ' + this.visit(colDefData.raw_default, context);
                indentedParts.push(defaultStr);
              }

              if (colDefData.fdwoptions && colDefData.fdwoptions.length > 0) {
                indentedParts.push('OPTIONS');
                const columnContext = context.spawn('ColumnDef');
                const options = ListUtils.unwrapList(colDefData.fdwoptions).map(opt => this.visit(opt, columnContext));
                indentedParts.push(`(${options.join(', ')})`);
              }

              let result = parts.join(' ');
              if (indentedParts.length > 0) {
                const indentedStr = indentedParts.map(part => context.indent(part)).join(context.newline());
                result += context.newline() + indentedStr;
              }
              
              output.push(result);
            } else {
              const parts: string[] = [];

              if (colDefData.colname) {
                parts.push(QuoteUtils.quote(colDefData.colname));
              }

              if (colDefData.typeName) {
                parts.push(this.TypeName(colDefData.typeName, context));
              }

              if (colDefData.collClause) {
                parts.push(this.CollateClause(colDefData.collClause, context));
              }

              if (colDefData.fdwoptions && colDefData.fdwoptions.length > 0) {
                parts.push('OPTIONS');
                const columnContext = context.spawn('ColumnDef');
                const options = ListUtils.unwrapList(colDefData.fdwoptions).map(opt => this.visit(opt, columnContext));
                parts.push(`(${options.join(', ')})`);
              }

              if (colDefData.constraints) {
                const constraints = ListUtils.unwrapList(colDefData.constraints);
                const constraintStrs = constraints.map(constraint => {
                  const columnConstraintContext = context.spawn('ColumnDef', { isColumnConstraint: true });
                  return this.visit(constraint, columnConstraintContext);
                });
                parts.push(...constraintStrs);
              }

              if (colDefData.raw_default) {
                parts.push('DEFAULT');
                parts.push(this.visit(colDefData.raw_default, context));
              }

              if (colDefData.is_not_null) {
                parts.push('NOT NULL');
              }

              output.push(parts.join(' '));
            }
          }
          if (node.behavior === 'DROP_CASCADE') {
            output.push('CASCADE');
          }
          break;
        case 'AT_DropColumn':
          if (node.missing_ok) {
            if (context.objtype === 'OBJECT_TYPE') {
              output.push('DROP ATTRIBUTE IF EXISTS');
            } else {
              output.push('DROP COLUMN IF EXISTS');
            }
          } else {
            if (context.objtype === 'OBJECT_TYPE') {
              output.push('DROP ATTRIBUTE');
            } else {
              output.push('DROP COLUMN');
            }
          }
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          if (node.behavior === 'DROP_CASCADE') {
            output.push('CASCADE');
          } else if (node.behavior === 'DROP_RESTRICT') {
            output.push('RESTRICT');
          }
          break;
        case 'AT_AlterColumnType':
          if (context.objtype === 'OBJECT_TYPE') {
            output.push('ALTER ATTRIBUTE');
          } else {
            output.push('ALTER COLUMN');
          }
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('TYPE');
          if (node.def) {
            const nodeData = this.getNodeData(node.def);
            if (nodeData && nodeData.typeName) {
              output.push(this.TypeName(nodeData.typeName, context));
              // Handle USING clause (stored in raw_default for ALTER COLUMN TYPE)
              if (nodeData.raw_default) {
                output.push('USING');
                output.push(this.visit(nodeData.raw_default, context));
              }
            } else {
              // Fallback to original behavior
              const typeDef = this.visit(node.def, context);
              output.push(typeDef);
            }
          }
          // Handle CASCADE/RESTRICT behavior for ALTER COLUMN TYPE operations
          if (node.behavior === 'DROP_CASCADE') {
            output.push('CASCADE');
          }
          break;
        case 'AT_SetTableSpace':
          output.push('SET TABLESPACE');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_AddConstraint':
          output.push('ADD');
          if (node.def) {
            const constraintDef = this.visit(node.def, context);
            output.push(constraintDef);
          }
          break;
        case 'AT_DropConstraint':
          if (node.missing_ok) {
            output.push('DROP CONSTRAINT IF EXISTS');
          } else {
            output.push('DROP CONSTRAINT');
          }
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          if (node.behavior === 'DROP_CASCADE') {
            output.push('CASCADE');
          } else if (node.behavior === 'DROP_RESTRICT') {
            output.push('RESTRICT');
          }
          break;
        case 'AT_SetRelOptions':
          output.push('SET');
          if (node.def) {
            const alterTableContext = context.spawn('AlterTableCmd', { subtype: 'AT_SetRelOptions' });
            const options = ListUtils.unwrapList(node.def)
              .map(option => this.visit(option, alterTableContext))
              .join(', ');
            output.push(`(${options})`);
          } else {
            output.push('()');
          }
          break;
        case 'AT_ResetRelOptions':
          output.push('RESET');
          if (node.def) {
            const alterTableContext = context.spawn('AlterTableCmd', { subtype: 'AT_ResetRelOptions' });
            const options = ListUtils.unwrapList(node.def)
              .map(option => this.visit(option, alterTableContext))
              .join(', ');
            output.push(`(${options})`);
          } else {
            output.push('()');
          }
          break;
        case 'AT_ColumnDefault':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          if (node.def) {
            output.push('SET DEFAULT');
            output.push(this.visit(node.def, context));
          } else {
            output.push('DROP DEFAULT');
          }
          break;
        case 'AT_SetStorage':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('SET STORAGE');
          if (node.def) {
            const storageType = this.visit(node.def, context);
            output.push(storageType);
          }
          break;
        case 'AT_ClusterOn':
          output.push('CLUSTER ON');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_DropCluster':
          output.push('SET WITHOUT CLUSTER');
          break;
        case 'AT_ChangeOwner':
          output.push('OWNER TO');
          if (node.newowner) {
            output.push(this.RoleSpec(node.newowner, context));
          }
          break;
        case 'AT_AddInherit':
          output.push('INHERIT');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_DropInherit':
          output.push('NO INHERIT');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_SetNotNull':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('SET NOT NULL');
          break;
        case 'AT_DropNotNull':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('DROP NOT NULL');
          break;
        case 'AT_SetStatistics':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          } else if (node.num !== undefined && node.num !== null) {
            output.push(node.num.toString());
          }
          output.push('SET STATISTICS');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_SetOptions':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('SET');
          if (node.def) {
            const alterTableContext = context.spawn('AlterTableCmd', { subtype: 'AT_SetOptions' });
            const options = ListUtils.unwrapList(node.def)
              .map(option => this.visit(option, alterTableContext))
              .join(', ');
            output.push(`(${options})`);
          } else {
            output.push('()');
          }
          break;
        case 'AT_ResetOptions':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('RESET');
          if (node.def) {
            const alterTableContext = context.spawn('AlterTableCmd', { subtype: 'AT_ResetOptions' });
            const options = ListUtils.unwrapList(node.def)
              .map(option => this.visit(option, alterTableContext))
              .join(', ');
            output.push(`(${options})`);
          } else {
            output.push('()');
          }
          break;
        case 'AT_SetCompression':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('SET COMPRESSION');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_ValidateConstraint':
          output.push('VALIDATE CONSTRAINT');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_EnableTrig':
          output.push('ENABLE TRIGGER');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_EnableAlwaysTrig':
          output.push('ENABLE ALWAYS TRIGGER');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_EnableReplicaTrig':
          output.push('ENABLE REPLICA TRIGGER');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_DisableTrig':
          output.push('DISABLE TRIGGER');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_EnableTrigAll':
          output.push('ENABLE TRIGGER ALL');
          break;
        case 'AT_DisableTrigAll':
          output.push('DISABLE TRIGGER ALL');
          break;
        case 'AT_EnableTrigUser':
          output.push('ENABLE TRIGGER USER');
          break;
        case 'AT_DisableTrigUser':
          output.push('DISABLE TRIGGER USER');
          break;
        case 'AT_EnableRule':
          output.push('ENABLE RULE');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_EnableAlwaysRule':
          output.push('ENABLE ALWAYS RULE');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_EnableReplicaRule':
          output.push('ENABLE REPLICA RULE');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_DisableRule':
          output.push('DISABLE RULE');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'AT_SetAccessMethod':
          output.push('SET ACCESS METHOD');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          } else {
            // Handle DEFAULT access method case
            output.push('DEFAULT');
          }
          break;
        case 'AT_EnableRowSecurity':
          output.push('ENABLE ROW LEVEL SECURITY');
          break;
        case 'AT_DisableRowSecurity':
          output.push('DISABLE ROW LEVEL SECURITY');
          break;
        case 'AT_ForceRowSecurity':
          output.push('FORCE ROW LEVEL SECURITY');
          break;
        case 'AT_NoForceRowSecurity':
          output.push('NO FORCE ROW LEVEL SECURITY');
          break;
        case 'AT_AttachPartition':
          output.push('ATTACH PARTITION');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_DetachPartition':
          output.push('DETACH PARTITION');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_DetachPartitionFinalize':
          output.push('DETACH PARTITION');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          output.push('FINALIZE');
          break;
        case 'AT_SetLogged':
          output.push('SET LOGGED');
          break;
        case 'AT_SetUnLogged':
          output.push('SET UNLOGGED');
          break;
        case 'AT_AddColumnToView':
          output.push('ADD COLUMN');
          if (node.def) {
            const columnDef = this.visit(node.def, context);
            output.push(columnDef);
          }
          break;
        case 'AT_CookedColumnDefault':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          if (node.def) {
            output.push('SET DEFAULT');
            output.push(this.visit(node.def, context));
          } else {
            output.push('DROP DEFAULT');
          }
          break;
        case 'AT_SetExpression':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('SET EXPRESSION');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_DropExpression':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('DROP EXPRESSION');
          break;
        case 'AT_CheckNotNull':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('SET NOT NULL');
          break;
        case 'AT_AddIndex':
          output.push('ADD');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_ReAddIndex':
          output.push('ADD');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_ReAddConstraint':
          output.push('ADD');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_ReAddDomainConstraint':
          output.push('ADD');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_AlterConstraint':
          output.push('ALTER CONSTRAINT');
          if (node.def && this.getNodeType(node.def) === 'Constraint') {
            const constraintData = this.getNodeData(node.def) as any;
            if (constraintData.conname) {
              output.push(QuoteUtils.quote(constraintData.conname));
              if (constraintData.deferrable !== undefined) {
                output.push(constraintData.deferrable ? 'DEFERRABLE' : 'NOT DEFERRABLE');
              }
              if (constraintData.initdeferred !== undefined) {
                output.push(constraintData.initdeferred ? 'INITIALLY DEFERRED' : 'INITIALLY IMMEDIATE');
              }
            }
          } else if (node.name) {
            output.push(QuoteUtils.quote(node.name));
            if (node.def) {
              output.push(this.visit(node.def, context));
            }
          }
          break;
        case 'AT_AddIndexConstraint':
          output.push('ADD');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_ReAddComment':
          output.push('COMMENT');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_AlterColumnGenericOptions':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('OPTIONS');
          if (node.def) {
            const alterColumnContext = context.spawn('AlterTableCmd', { alterColumnOptions: true });
            const options = ListUtils.unwrapList(node.def)
              .map(option => this.visit(option, alterColumnContext))
              .join(', ');
            output.push(`(${options})`);
          }
          break;
        case 'AT_DropOids':
          output.push('SET WITHOUT OIDS');
          break;
        case 'AT_ReplaceRelOptions':
          output.push('REPLACE');
          if (node.def && Array.isArray(node.def)) {
            const options = ListUtils.unwrapList(node.def)
              .map(option => this.visit(option, context))
              .join(', ');
            output.push(`(${options})`);
          } else {
            output.push('()');
          }
          break;
        case 'AT_AddOf':
          output.push('OF');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_DropOf':
          output.push('NOT OF');
          break;
        case 'AT_ReplicaIdentity':
          output.push('REPLICA IDENTITY');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_GenericOptions':
          output.push('OPTIONS');
          if (node.def) {
            const alterTableContext = context.spawn('AlterTableCmd', { alterTableOptions: true });
            const options = ListUtils.unwrapList(node.def)
              .map(option => this.visit(option, alterTableContext))
              .join(', ');
            output.push(`(${options})`);
          }
          break;
        case 'AT_AddIdentity':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('ADD');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_SetIdentity':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('SET');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_DropIdentity':
          output.push('ALTER COLUMN');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          output.push('DROP IDENTITY');
          if (node.behavior === 'DROP_CASCADE') {
            output.push('CASCADE');
          } else if (node.behavior === 'DROP_RESTRICT') {
            output.push('RESTRICT');
          }
          break;
        case 'AT_ReAddStatistics':
          output.push('ADD');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        default:
          throw new Error(`Unsupported AlterTableCmd subtype: ${node.subtype}`);
      }
    }

    return output.join(' ');
  }

  CreateFunctionStmt(node: t.CreateFunctionStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.replace) {
      output.push('OR REPLACE');
    }

    if (node.is_procedure) {
      output.push('PROCEDURE');
    } else {
      output.push('FUNCTION');
    }

    if (node.funcname && node.funcname.length > 0) {
      const funcName = node.funcname.map((name: any) => this.visit(name, context)).join('.');

      if (node.parameters && node.parameters.length > 0) {
        const params = node.parameters
          .filter((param: any) => {
            const paramData = this.getNodeData(param);
            return paramData.mode !== 'FUNC_PARAM_TABLE';
          })
          .map((param: any) => this.visit(param, context));

        if (params.length > 0) {
          output.push(funcName + '(' + params.join(', ') + ')');
        } else {
          output.push(funcName + '()');
        }
      } else {
        output.push(funcName + '()');
      }
    }

    const hasTableParams = node.parameters && node.parameters.some((param: any) => {
      const paramData = this.getNodeData(param);
      return paramData.mode === 'FUNC_PARAM_TABLE';
    });

    if (hasTableParams) {
      output.push('RETURNS TABLE (');
      const tableParams = node.parameters
        .filter((param: any) => {
          const paramData = this.getNodeData(param);
          return paramData.mode === 'FUNC_PARAM_TABLE';
        })
        .map((param: any) => this.visit(param, context));
      output.push(tableParams.join(', '));
      output.push(')');
    } else if (node.returnType) {
      output.push('RETURNS');
      output.push(this.TypeName(node.returnType as any, context));
    }

    if (node.options && node.options.length > 0) {
      const funcContext = context.spawn('CreateFunctionStmt');
      const options = node.options.map((opt: any) => this.visit(opt, funcContext));
      output.push(...options);
    }

    if (node.sql_body) {
      const bodyType = this.getNodeType(node.sql_body);
      if (bodyType === 'ReturnStmt') {
        output.push(this.visit(node.sql_body, context));
      } else {
        output.push('BEGIN ATOMIC');

        // Handle List of statements in sql_body
        if (bodyType === 'List') {
          const statements = ListUtils.unwrapList(node.sql_body);
          if (statements.length === 0 || (statements.length === 1 && Object.keys(statements[0]).length === 0)) {
          } else {
            // Handle nested List structure in BEGIN ATOMIC blocks
            let actualStatements = statements;
            if (statements.length === 1 && statements[0].List) {
              actualStatements = ListUtils.unwrapList(statements[0]);
            }

            const stmtStrings = actualStatements
              .filter(stmt => stmt && Object.keys(stmt).length > 0) // Filter out empty objects
              .map(stmt => {
                const stmtSql = this.visit(stmt, context);
                return stmtSql.endsWith(';') ? stmtSql : stmtSql + ';';
              });
            if (stmtStrings.length > 0) {
              output.push(stmtStrings.join(' '));
            }
          }
        }else {
          const bodyStmt = this.visit(node.sql_body, context);
          if (bodyStmt && !bodyStmt.endsWith(';')) {
            output.push(bodyStmt + ';');
          } else {
            output.push(bodyStmt);
          }
        }

        output.push('END');
      }
    }

    return output.join(' ');
  }

  FunctionParameter(node: t.FunctionParameter, context: DeparserContext): string {
    const output: string[] = [];

    if (node.mode) {
      switch (node.mode) {
        case 'FUNC_PARAM_IN':
          output.push('IN');
          break;
        case 'FUNC_PARAM_OUT':
          output.push('OUT');
          break;
        case 'FUNC_PARAM_INOUT':
          output.push('INOUT');
          break;
        case 'FUNC_PARAM_VARIADIC':
          output.push('VARIADIC');
          break;
      }
    }

    if (node.name) {
      output.push(QuoteUtils.quote(node.name));
    }

    if (node.argType) {
      output.push(this.TypeName(node.argType as any, context));
    }

    if (node.defexpr) {
      output.push('DEFAULT');
      output.push(this.visit(node.defexpr, context));
    }

    return output.join(' ');
  }

  CreateEnumStmt(node: t.CreateEnumStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'TYPE'];

    if (node.typeName) {
      const typeName = ListUtils.unwrapList(node.typeName)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(typeName);
    }

    output.push('AS', 'ENUM');

    if (node.vals && node.vals.length > 0) {
      const enumContext = context.spawn('CreateEnumStmt', { isEnumValue: true });
      const values = ListUtils.unwrapList(node.vals)
        .map(val => this.visit(val, enumContext))
        .join(', ');
      output.push(`(${values})`);
    } else {
      output.push('()');
    }

    return output.join(' ');
  }

  CreateDomainStmt(node: t.CreateDomainStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'DOMAIN'];

    if (node.domainname) {
      const domainName = ListUtils.unwrapList(node.domainname)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(domainName);
    }

    if (node.typeName) {
      output.push('AS');
      output.push(this.TypeName(node.typeName, context));
    }

    if (node.collClause) {
      output.push(this.CollateClause(node.collClause, context));
    }

    if (node.constraints) {
      const constraints = ListUtils.unwrapList(node.constraints)
        .map(constraint => this.visit(constraint, context))
        .join(' ');
      if (constraints) {
        output.push(constraints);
      }
    }

    return output.join(' ');
  }

  CreateRoleStmt(node: t.CreateRoleStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.stmt_type === 'ROLESTMT_ROLE') {
      output.push('ROLE');
    } else if (node.stmt_type === 'ROLESTMT_USER') {
      output.push('USER');
    } else if (node.stmt_type === 'ROLESTMT_GROUP') {
      output.push('GROUP');
    } else {
      output.push('ROLE');
    }

    if (node.role) {
      const roleName = QuoteUtils.quoteString(node.role);
      output.push(roleName);
    }

    if (node.options) {
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, context.spawn('CreateRoleStmt')))
        .join(' ');
      if (options) {
        output.push('WITH');
        output.push(options);
      }
    }

    return output.join(' ');
  }

  DefElem(node: t.DefElem, context: DeparserContext): string {
    if (!node.defname) {
      return '';
    }

    // Handle CREATE OPERATOR commutator/negator - MUST be first to prevent quoting
    if (context.parentNodeTypes.includes('DefineStmt') &&
        ['commutator', 'negator'].includes(node.defname.toLowerCase())) {
      if (node.arg && this.getNodeType(node.arg) === 'List') {
        const listData = this.getNodeData(node.arg);
        const listItems = ListUtils.unwrapList(listData.items);
        if (listItems.length === 1 && listItems[0].String) {
          const preservedName = this.preserveOperatorDefElemCase(node.defname);
          return `${preservedName} = ${listItems[0].String.sval}`;
        }
      }
    }

    // Handle IndexElem opclassopts - MUST be first to preserve string types
    if (context.parentNodeTypes.includes('IndexElem')) {
      if (node.arg && this.getNodeType(node.arg) === 'String') {
        const stringData = this.getNodeData(node.arg);
        return `${node.defname}='${stringData.sval}'`;
      }
      return `${node.defname}=${this.visit(node.arg, context.spawn('DefElem'))}`;
    }

        // Handle CREATE OPERATOR boolean flags - MUST be first to preserve case
        if (context.parentNodeTypes.includes('DefineStmt') &&
            ['hashes', 'merges'].includes(node.defname.toLowerCase()) && !node.arg) {
          if (node.defname !== node.defname.toLowerCase() && node.defname !== node.defname.toUpperCase()) {
            return QuoteUtils.quoteString(node.defname);
          }
          return node.defname.charAt(0).toUpperCase() + node.defname.slice(1).toLowerCase();
        }

    // Handle FDW-related statements and ALTER OPTIONS that use space format for options
    if (context.parentNodeTypes.includes('AlterFdwStmt') || context.parentNodeTypes.includes('CreateFdwStmt') || context.parentNodeTypes.includes('CreateForeignServerStmt') || context.parentNodeTypes.includes('AlterForeignServerStmt') || context.parentNodeTypes.includes('CreateUserMappingStmt') || context.parentNodeTypes.includes('AlterUserMappingStmt') || context.parentNodeTypes.includes('ColumnDef') || context.parentNodeTypes.includes('CreateForeignTableStmt') || context.parentNodeTypes.includes('ImportForeignSchemaStmt') || context.alterColumnOptions || context.alterTableOptions) {
      if (['handler', 'validator'].includes(node.defname)) {
        if (!node.arg) {
          return `NO ${node.defname.toUpperCase()}`;
        }
        const defElemContext = context.spawn('DefElem');
        const argValue = this.visit(node.arg, defElemContext);
        return `${node.defname.toUpperCase()} ${argValue}`;
      }
      // Handle OPTIONS clause - use space format, not equals format
      if (node.arg) {
        const defElemContext = context.spawn('DefElem');
        const argValue = this.visit(node.arg, defElemContext);

        if (context.parentNodeTypes.includes('CreateFdwStmt') || context.parentNodeTypes.includes('AlterFdwStmt')) {
          const finalValue = typeof argValue === 'string' && !argValue.startsWith("'")
            ? `'${argValue}'`
            : argValue;

                    const quotedDefname = QuoteUtils.quoteString(node.defname);

          if (node.defaction === 'DEFELEM_ADD') {
            return `ADD ${quotedDefname} ${finalValue}`;
          } else if (node.defaction === 'DEFELEM_DROP') {
            return `DROP ${quotedDefname}`;
          } else if (node.defaction === 'DEFELEM_SET') {
            return `SET ${quotedDefname} ${finalValue}`;
          }

          return `${quotedDefname} ${finalValue}`;
        }

        const quotedValue = typeof argValue === 'string' && !argValue.startsWith("'")
          ? `'${argValue}'`
          : argValue;

        if (node.defaction === 'DEFELEM_ADD') {
          return `ADD ${node.defname} ${quotedValue}`;
        } else if (node.defaction === 'DEFELEM_DROP') {
          return `DROP ${node.defname}`;
        } else if (node.defaction === 'DEFELEM_SET') {
          return `SET ${node.defname} ${quotedValue}`;
        }

                const quotedDefname = QuoteUtils.quoteString(node.defname);
                return `${quotedDefname} ${quotedValue}`;
      } else if (node.defaction === 'DEFELEM_DROP') {
        // Handle DROP without argument
        return `DROP ${node.defname}`;
      }
    }

    // Handle sequence options that can have NO prefix when no argument (before checking node.arg)
    if ((context.parentNodeTypes.includes('CreateSeqStmt') || context.parentNodeTypes.includes('AlterSeqStmt')) &&
        (node.defname === 'minvalue' || node.defname === 'maxvalue') && !node.arg) {
      return `NO ${node.defname.toUpperCase()}`;
    }

    // Handle CREATE ROLE / ALTER ROLE password options BEFORE checking node.arg
    if (context.parentNodeTypes.includes('CreateRoleStmt') || context.parentNodeTypes.includes('AlterRoleStmt')) {
      if (node.defname === 'password') {
        // Handle PASSWORD NULL case when no arg is provided
        if (!node.arg) {
          return 'PASSWORD NULL';
        }
        const defElemContext = context.spawn('DefElem');
        const argValue = this.visit(node.arg, defElemContext);
        const quotedValue = typeof argValue === 'string' && !argValue.startsWith("'")
          ? `'${argValue}'`
          : argValue;
        return `PASSWORD ${quotedValue}`;
      }
    }

    if (node.arg) {
      const defElemContext = context.spawn('DefElem');
      const argValue = this.visit(node.arg, defElemContext);

      if (context.parentNodeTypes.includes('AlterOperatorStmt')) {
        if (node.arg && this.getNodeType(node.arg) === 'TypeName') {
          const typeNameData = this.getNodeData(node.arg);
          if (typeNameData.names) {
            const names = ListUtils.unwrapList(typeNameData.names);
            if (names.length === 1 && names[0].String) {
              return `${node.defname} = ${names[0].String.sval}`;
            }
          }
        }

        if (node.arg && this.getNodeType(node.arg) === 'List') {
          const listData = this.getNodeData(node.arg);
          const listItems = ListUtils.unwrapList(listData.items);
          if (listItems.length === 1 && listItems[0].String) {
            return `${node.defname} = ${listItems[0].String.sval}`;
          }
        }
      }

      if (context.parentNodeTypes.includes('CreatedbStmt') || context.parentNodeTypes.includes('DropdbStmt')) {
        const quotedValue = typeof argValue === 'string'
          ? QuoteUtils.escape(argValue)
          : argValue;
        return `${node.defname} = ${quotedValue}`;
      }

      // CreateForeignServerStmt and AlterForeignServerStmt use space format like CreateFdwStmt
      if (context.parentNodeTypes.includes('CreateForeignServerStmt') || context.parentNodeTypes.includes('AlterForeignServerStmt')) {
        const quotedValue = typeof argValue === 'string'
          ? QuoteUtils.escape(argValue)
          : argValue;
                const quotedDefname = QuoteUtils.quoteString(node.defname);
                return `${quotedDefname} ${quotedValue}`;
      }



      if (context.parentNodeTypes.includes('CreateRoleStmt') || context.parentNodeTypes.includes('AlterRoleStmt')) {
        if (node.defname === 'rolemembers') {
          // Handle List of RoleSpec nodes for GROUP statements
          if (node.arg && this.getNodeType(node.arg) === 'List') {
            const listData = this.getNodeData(node.arg);
            const listItems = ListUtils.unwrapList(listData.items);
            const roleNames = listItems.map(item => this.visit(item, context));

            if (context.parentNodeTypes.includes('CreateRoleStmt')) {
              return `ROLE ${roleNames.join(', ')}`;
            } else {
              // AlterRoleStmt - use ADD USER syntax
              return `ADD USER ${roleNames.join(', ')}`;
            }
          }
        }
        if (node.defname === 'addroleto') {
          // Handle List of RoleSpec nodes for IN ROLE statements
          if (node.arg && this.getNodeType(node.arg) === 'List') {
            const listData = this.getNodeData(node.arg);
            const listItems = ListUtils.unwrapList(listData.items);
            const roleNames = listItems.map(item => this.visit(item, context));
            return `IN ROLE ${roleNames.join(', ')}`;
          }
        }

        if (node.defname === 'validUntil') {
          const quotedValue = typeof argValue === 'string' && !argValue.startsWith("'")
            ? `'${argValue}'`
            : argValue;
          return `VALID UNTIL ${quotedValue}`;
        }

        if (node.defname === 'adminmembers') {
          return `ADMIN ${argValue}`;
        }

        if (node.defname === 'connectionlimit') {
          return `CONNECTION LIMIT ${argValue}`;
        }

        if (node.defname === 'sysid') {
          return `SYSID ${argValue}`;
        }

        if (String(argValue) === 'true') {
          // Handle special cases where the positive form has a different name
          if (node.defname === 'isreplication') {
            return 'REPLICATION';
          }
          if (node.defname === 'canlogin') {
            return 'LOGIN';
          }
          return node.defname.toUpperCase();
        } else if (String(argValue) === 'false') {
          // Handle special cases where the negative form has a different name
          if (node.defname === 'canlogin') {
            return 'NOLOGIN';
          }
          if (node.defname === 'isreplication') {
            return 'NOREPLICATION';
          }
          return `NO${node.defname.toUpperCase()}`;
        }
      }

      if (context.parentNodeTypes.includes('CreateSeqStmt') || context.parentNodeTypes.includes('AlterSeqStmt')) {
        if (node.defname === 'owned_by') {
          // Handle List node for table.column reference
          if (node.arg && this.getNodeType(node.arg) === 'List') {
            const listData = this.getNodeData(node.arg);
            const listItems = ListUtils.unwrapList(listData.items);
            const parts = listItems.map(item => {
              const itemData = this.getNodeData(item);
                            if (this.getNodeType(item) === 'String') {
                              // Check if this identifier needs quotes to preserve case
                              const value = itemData.sval;
                              return QuoteUtils.quoteString(value);
                            }
              return this.visit(item, context);
            });
            return `OWNED BY ${parts.join('.')}`;
          } else {
            return `OWNED BY ${argValue}`;
          }
        }

        // Handle boolean sequence options
        if (node.defname === 'cycle') {
          const boolValue = String(argValue).toLowerCase();
          if (boolValue === 'true' || boolValue === '1') {
            return 'CYCLE';
          } else if (boolValue === 'false' || boolValue === '0') {
            return 'NO CYCLE';
          }
        }

        // Handle sequence options that can have NO prefix when no argument
        if ((node.defname === 'minvalue' || node.defname === 'maxvalue') && !node.arg) {
          return `NO ${node.defname.toUpperCase()}`;
        }

        return `${node.defname.toUpperCase()} ${argValue}`;
      }

      if (context.parentNodeTypes.includes('CreateTableSpaceStmt') || context.parentNodeTypes.includes('AlterTableSpaceOptionsStmt')) {
        return `${node.defname.toUpperCase()} ${argValue}`;
      }

      if (context.parentNodeTypes.includes('ExplainStmt')) {
        if (argValue) {
          return `${node.defname.toUpperCase()} ${argValue.toUpperCase()}`;
        } else {
          return node.defname.toUpperCase();
        }
      }

      if (context.parentNodeTypes.includes('DoStmt')) {
        if (node.defname === 'as') {
          const defElemContext = context.spawn('DefElem');
          const argValue = node.arg ? this.visit(node.arg, defElemContext) : '';

          if (Array.isArray(argValue)) {
            const bodyParts = argValue;
            const body = bodyParts.join('');
            const delimiter = this.getFunctionDelimiter(body);
            return `${delimiter}${body}${delimiter}`;
          } else {
            const delimiter = this.getFunctionDelimiter(argValue);
            return `${delimiter}${argValue}${delimiter}`;
          }
        }
        return '';
      }

      if (context.parentNodeTypes.includes('CreateFunctionStmt') || context.parentNodeTypes.includes('AlterFunctionStmt')) {
        if (node.defname === 'as') {
          // Handle List type (multiple function body strings)
          if (node.arg && (node.arg as any).List) {
            const listNode = (node.arg as any).List;
            const listItems = listNode.items || [];
            const bodyParts = listItems.map((item: any) => {
              if (item.String) {
                return item.String.sval;
              }
              return this.visit(item, context);
            });

            if (bodyParts.length === 1) {
              const body = bodyParts[0];
              const delimiter = this.getFunctionDelimiter(body);
              return `AS ${delimiter}${body}${delimiter}`;
            } else {
              return `AS ${bodyParts.map((part: string) => {
                const delimiter = this.getFunctionDelimiter(part);
                return `${delimiter}${part}${delimiter}`;
              }).join(', ')}`;
            }
          }
          // Handle Array type (legacy support)
          else if (Array.isArray(argValue)) {
            const bodyParts = argValue;
            if (bodyParts.length === 1) {
              const body = bodyParts[0];
              const delimiter = this.getFunctionDelimiter(body);
              return `AS ${delimiter}${body}${delimiter}`;
            } else {
              return `AS ${bodyParts.map(part => {
                const delimiter = this.getFunctionDelimiter(part);
                return `${delimiter}${part}${delimiter}`;
              }).join(', ')}`;
            }
          }
          // Handle String type (single function body)
          else {
            const delimiter = this.getFunctionDelimiter(argValue);
            return `AS ${delimiter}${argValue}${delimiter}`;
          }
        }
        if (node.defname === 'language') {
          return `LANGUAGE ${argValue}`;
        }
        if (node.defname === 'volatility') {
          return argValue.toUpperCase();
        }
        if (node.defname === 'strict') {
          return argValue === 'true' ? 'STRICT' : 'CALLED ON NULL INPUT';
        }
        if (node.defname === 'security') {
          return argValue === 'true' ? 'SECURITY DEFINER' : 'SECURITY INVOKER';
        }
        if (node.defname === 'leakproof') {
          return argValue === 'true' ? 'LEAKPROOF' : 'NOT LEAKPROOF';
        }
        if (node.defname === 'cost') {
          return `COST ${argValue}`;
        }
        if (node.defname === 'rows') {
          return `ROWS ${argValue}`;
        }
        if (node.defname === 'window') {
          return argValue === 'true' ? 'WINDOW' : '';
        }
        if (node.defname === 'set') {
          return this.visit(node.arg, context);
        }
        return `${node.defname.toUpperCase()} ${argValue}`;
      }

      if (context.parentNodeTypes.includes('CreateExtensionStmt') || context.parentNodeTypes.includes('AlterExtensionStmt') || context.parentNodeTypes.includes('CreateFdwStmt') || context.parentNodeTypes.includes('AlterFdwStmt')) {
        // AlterExtensionStmt specific cases
        if (context.parentNodeTypes.includes('AlterExtensionStmt')) {
          if (node.defname === 'new_version') {
            // argValue is unquoted due to DefElem context, so we need to quote it
            const quotedValue = typeof argValue === 'string' && !argValue.startsWith("'")
              ? `'${argValue}'`
              : argValue;
            return `UPDATE TO ${quotedValue}`;
          }
          if (node.defname === 'schema') {
            return `SET SCHEMA ${argValue}`;
          }
        }

        // CreateFdwStmt specific cases
        if (context.parentNodeTypes.includes('CreateFdwStmt')) {
          if (['handler', 'validator'].includes(node.defname)) {
            return `${node.defname.toUpperCase()} ${argValue}`;
          }
          const quotedValue = typeof argValue === 'string'
            ? QuoteUtils.escape(argValue)
            : argValue;
          return `${node.defname} ${quotedValue}`;
        }





        // CreateExtensionStmt cases (schema, version, etc.)
        if (node.defname === 'cascade') {
          return argValue === 'true' ? 'CASCADE' : '';
        }
        return `${node.defname.toUpperCase()} ${argValue}`;
      }

      // Handle IndexStmt WITH clause options - no quotes, compact formatting
      if (context.parentNodeTypes.includes('IndexStmt')) {
        return `${node.defname}=${argValue}`;
      }

      // Handle IndexElem opclassopts - preserve string values as strings
      if (context.parentNodeTypes.includes('IndexElem')) {
        if (node.arg && this.getNodeType(node.arg) === 'String') {
          const stringData = this.getNodeData(node.arg);
          return `${node.defname}='${stringData.sval}'`;
        }
        return `${node.defname}=${argValue}`;
      }

      // Handle CreateStmt table options - no quotes, compact formatting
      if (context.parentNodeTypes.includes('CreateStmt')) {
        // For numeric values, use the raw value without quotes
        if (node.arg && this.getNodeType(node.arg) === 'Integer') {
          const integerData = this.getNodeData(node.arg);
          return `${node.defname}=${integerData.ival}`;
        }
        return `${node.defname}=${argValue}`;
      }

      // Handle CreateEventTrigStmt WHEN clause - use IN syntax for List arguments
      if (context.parentNodeTypes.includes('CreateEventTrigStmt')) {
        if (node.arg && this.getNodeType(node.arg) === 'List') {
          const listData = this.getNodeData(node.arg);
          const listItems = ListUtils.unwrapList(listData.items);
          const values = listItems.map(item => {
            if (this.getNodeType(item) === 'String') {
              const stringData = this.getNodeData(item);
              return `'${stringData.sval || ''}'`;
            }
            return this.visit(item, context);
          });
          return `${node.defname} IN (${values.join(', ')})`;
        }
        return `${node.defname} = ${argValue}`;
      }

      // Handle AT_SetRelOptions context - don't quote values that should be type names
      if ((context.parentNodeTypes.includes('AlterTableCmd') || context.parentNodeTypes.includes('AlterTableStmt')) &&
          !context.parentNodeTypes.includes('ColumnDef')) {
        const optionName = node.defnamespace ? `${node.defnamespace}.${node.defname}` : node.defname;
        if (node.arg && this.getNodeType(node.arg) === 'TypeName') {
          return `${optionName} = ${argValue}`;
        }
        return `${optionName} = ${argValue}`;
      }

      // Handle ViewStmt WITH options - don't quote numeric values
      if (context.parentNodeTypes.includes('ViewStmt')) {
        if (typeof argValue === 'string' && /^\d+$/.test(argValue)) {
          return `${node.defname}=${argValue}`;
        }
        const quotedValue = typeof argValue === 'string'
          ? QuoteUtils.escape(argValue)
          : argValue;
        return `${node.defname} = ${quotedValue}`;
      }

      // Handle CopyStmt WITH clause options - uppercase format without quotes
      if (context.parentNodeTypes.includes('CopyStmt')) {
        if (node.defname === 'format' && node.arg && this.getNodeType(node.arg) === 'String') {
          const stringData = this.getNodeData(node.arg);
          return `FORMAT ${stringData.sval.toUpperCase()}`;
        }
        // Handle other COPY options with uppercase defname
        if (node.arg) {
          return `${node.defname.toUpperCase()} ${argValue}`;
        }
        return node.defname.toUpperCase();
      }

      // Handle CREATE OPERATOR and CREATE TYPE context
      if (context.parentNodeTypes.includes('DefineStmt')) {
        const preservedName = this.preserveOperatorDefElemCase(node.defname);

        // Handle operator arguments that should be Lists vs TypeNames
        if (['commutator', 'negator'].includes(node.defname.toLowerCase())) {
          if (node.arg) {
            // For commutator/negator, preserve the original operator symbol without quotes
            if (node.arg && this.getNodeType(node.arg) === 'List') {
              const listData = this.getNodeData(node.arg);
              const listItems = ListUtils.unwrapList(listData.items);
              if (listItems.length === 1 && listItems[0].String) {
                return `${preservedName} = ${listItems[0].String.sval}`;
              }
            }
            const unquotedValue = argValue.replace(/^"(.*)"$/, '$1');
            return `${preservedName} = ${unquotedValue}`;
          }
          return preservedName;
        }

                // Handle boolean flags (no arguments) - preserve quoted case
                if (['hashes', 'merges'].includes(node.defname.toLowerCase())) {
                  if (node.defname !== node.defname.toLowerCase() && node.defname !== node.defname.toUpperCase()) {
                    return QuoteUtils.quoteString(node.defname);
                  }
                  return preservedName.toUpperCase();
                }

                // Handle CREATE AGGREGATE quoted identifiers - preserve quotes when needed
                if (QuoteUtils.needsQuotesForString(node.defname)) {
                  const quotedDefname = QuoteUtils.quoteString(node.defname);
                  if (node.arg) {
            if (this.getNodeType(node.arg) === 'String') {
              const stringData = this.getNodeData(node.arg);
              // Handle boolean string values without quotes
              if (stringData.sval === 'true' || stringData.sval === 'false') {
                return `${quotedDefname} = ${stringData.sval}`;
              }
              // Regular string literals get single quotes
              return `${quotedDefname} = '${stringData.sval}'`;
            }
            return `${quotedDefname} = ${argValue}`;
          }
          return quotedDefname;
        }

        // Handle other operator parameters with preserved case
        if (preservedName !== node.defname) {
          if (node.arg) {
            return `${preservedName} = ${argValue}`;
          }
          return preservedName;
        }

        // CREATE TYPE context - preserve string literals with single quotes, handle boolean strings
        if (node.arg && this.getNodeType(node.arg) === 'String') {
          const stringData = this.getNodeData(node.arg);
          // Handle boolean string values without quotes
          if (stringData.sval === 'true' || stringData.sval === 'false') {
            return `${node.defname} = ${stringData.sval}`;
          }
          // Regular string literals get single quotes
          return `${node.defname} = '${stringData.sval}'`;
        }
        if (node.arg && this.getNodeType(node.arg) === 'Boolean') {
          const boolData = this.getNodeData(node.arg);
          return `${node.defname} = ${boolData.boolval ? 'true' : 'false'}`;
        }
        if (node.arg && this.getNodeType(node.arg) === 'Integer') {
          const intData = this.getNodeData(node.arg);
          return `${node.defname} = ${intData.ival}`;
        }
        if (node.arg && this.getNodeType(node.arg) === 'TypeName') {
          const typeNameData = this.getNodeData(node.arg);
          if (typeNameData.names) {
            const names = ListUtils.unwrapList(typeNameData.names);
            if (names.length === 1 && names[0].String) {
              return `${node.defname} = ${names[0].String.sval}`;
            }
          }
          return `${node.defname} = ${argValue}`;
        }
      }

      const quotedValue = typeof argValue === 'string'
        ? QuoteUtils.escape(argValue)
        : argValue;
      return `${node.defname} = ${quotedValue}`;
    }

        // Handle CREATE TYPE boolean flags - preserve quoted case for attributes like "Passedbyvalue"
        if (context.parentNodeTypes.includes('DefineStmt') && !node.arg) {
          // Check if the original defname appears to be quoted (mixed case that's not all upper/lower)
          if (node.defname !== node.defname.toLowerCase() && node.defname !== node.defname.toUpperCase()) {
            return QuoteUtils.quoteString(node.defname);
          }
        }

    return node.defname.toUpperCase();
  }

  CreateTableSpaceStmt(node: t.CreateTableSpaceStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'TABLESPACE'];

    if (node.tablespacename) {
      output.push(node.tablespacename);
    }

    if (node.owner) {
      output.push('OWNER');
      output.push(this.RoleSpec(node.owner, context));
    }

    if (node.location) {
      output.push('LOCATION');
      output.push(`'${node.location}'`);
    }

    if (node.options && node.options.length > 0) {
      output.push('WITH');
      const tsContext = context.spawn('CreateTableSpaceStmt');
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, tsContext))
        .join(', ');
      output.push(`(${options})`);
    }

    return output.join(' ');
  }

  DropTableSpaceStmt(node: t.DropTableSpaceStmt, context: DeparserContext): string {
    const output: string[] = ['DROP', 'TABLESPACE'];

    if (node.missing_ok) {
      output.push('IF', 'EXISTS');
    }

    if (node.tablespacename) {
      output.push(node.tablespacename);
    }

    return output.join(' ');
  }

  AlterTableSpaceOptionsStmt(node: t.AlterTableSpaceOptionsStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'TABLESPACE'];

    if (node.tablespacename) {
      output.push(node.tablespacename);
    }

    if (node.isReset) {
      output.push('RESET');
    } else {
      output.push('SET');
    }

    if (node.options && node.options.length > 0) {
      const tablespaceContext = context.spawn('AlterTableSpaceOptionsStmt');
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, tablespaceContext))
        .join(', ');
      output.push(`(${options})`);
    }

    return output.join(' ');
  }

  CreateExtensionStmt(node: t.CreateExtensionStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'EXTENSION'];

    if (node.if_not_exists) {
      output.push('IF', 'NOT', 'EXISTS');
    }

    if (node.extname) {
      output.push(this.quoteIfNeeded(node.extname));
    }

    if (node.options && node.options.length > 0) {
      const extContext = context.spawn('CreateExtensionStmt');
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, extContext))
        .join(' ');
      output.push(options);
    }

    return output.join(' ');
  }

  AlterExtensionStmt(node: t.AlterExtensionStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'EXTENSION'];

    if (node.extname) {
      output.push(this.quoteIfNeeded(node.extname));
    }

    if (node.options && node.options.length > 0) {
      const extContext = context.spawn('AlterExtensionStmt');
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, extContext))
        .join(' ');
      output.push(options);
    }

    return output.join(' ');
  }

  AlterExtensionContentsStmt(node: t.AlterExtensionContentsStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'EXTENSION'];

    if (node.extname) {
      output.push(this.quoteIfNeeded(node.extname));
    }

    // Handle action: 1 = ADD, -1 = DROP
    if (node.action === 1) {
      output.push('ADD');
    } else if (node.action === -1) {
      output.push('DROP');
    }

    // Add object type keyword
    if (node.objtype) {
      try {
        output.push(this.getObjectTypeKeyword(node.objtype));
      } catch {
        // Fallback to the raw objtype if not supported
        output.push(node.objtype.toString());
      }
    }

    // Add the object itself
    if (node.object) {
      output.push(this.visit(node.object, context));
    }

    return output.join(' ');
  }

  CreateFdwStmt(node: t.CreateFdwStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'FOREIGN', 'DATA', 'WRAPPER'];

    if (node.fdwname) {
      output.push(node.fdwname);
    }

    if (node.func_options && node.func_options.length > 0) {
      const fdwContext = context.spawn('CreateFdwStmt');
      const funcOptions = ListUtils.unwrapList(node.func_options)
        .map(option => this.visit(option, fdwContext))
        .join(' ');
      output.push(funcOptions);
    }

    if (node.options && node.options.length > 0) {
      output.push('OPTIONS');
      const fdwContext = context.spawn('CreateFdwStmt');
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, fdwContext))
        .join(', ');
      output.push(`(${options})`);
    }

    return output.join(' ');
  }

  SetOperationStmt(node: t.SetOperationStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.larg) {
      output.push(this.visit(node.larg, context));
    }

    if (node.op) {
      switch (node.op) {
        case 'SETOP_UNION':
          output.push(node.all ? 'UNION ALL' : 'UNION');
          break;
        case 'SETOP_INTERSECT':
          output.push(node.all ? 'INTERSECT ALL' : 'INTERSECT');
          break;
        case 'SETOP_EXCEPT':
          output.push(node.all ? 'EXCEPT ALL' : 'EXCEPT');
          break;
        default:
          throw new Error(`Unsupported SetOperation: ${node.op}`);
      }
    }

    if (node.rarg) {
      output.push(this.visit(node.rarg, context));
    }

    return output.join(' ');
  }

  ReplicaIdentityStmt(node: t.ReplicaIdentityStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.identity_type) {
      switch (node.identity_type) {
        case 'd':
        case 'REPLICA_IDENTITY_DEFAULT':
          output.push('DEFAULT');
          break;
        case 'f':
        case 'REPLICA_IDENTITY_FULL':
          output.push('FULL');
          break;
        case 'n':
        case 'REPLICA_IDENTITY_NOTHING':
          output.push('NOTHING');
          break;
        case 'i':
        case 'REPLICA_IDENTITY_INDEX':
          output.push('USING', 'INDEX');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        default:
          throw new Error(`Unsupported replica identity type: ${node.identity_type}`);
      }
    }

    return output.join(' ');
  }

  AlterCollationStmt(node: t.AlterCollationStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'COLLATION'];

    if (node.collname && node.collname.length > 0) {
      const collationName = ListUtils.unwrapList(node.collname)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(collationName);
    }

    output.push('REFRESH', 'VERSION');

    return output.join(' ');
  }

  AlterDomainStmt(node: t.AlterDomainStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'DOMAIN'];

    if (node.typeName && node.typeName.length > 0) {
      const domainName = ListUtils.unwrapList(node.typeName)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(domainName);
    }

    if (node.subtype) {
      switch (node.subtype) {
        case 'AT_SetNotNull':
          output.push('SET', 'NOT', 'NULL');
          break;
        case 'AT_DropNotNull':
          output.push('DROP', 'NOT', 'NULL');
          break;
        case 'AT_SetDefault':
          output.push('SET', 'DEFAULT');
          if (node.def) {
            output.push(this.visit(node.def, context));
          }
          break;
        case 'AT_DropDefault':
          output.push('DROP', 'DEFAULT');
          break;
        case 'AT_AddConstraint':
          output.push('ADD');
          if (node.def) {
            // Pass domain context to avoid adding constraint names for domain constraints
            const domainContext = context.spawn('CreateDomainStmt', { isDomainConstraint: true });
            output.push(this.visit(node.def, domainContext));
          }
          break;
        case 'AT_DropConstraint':
          output.push('DROP', 'CONSTRAINT');
          if (node.missing_ok) {
            output.push('IF', 'EXISTS');
          }
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          if (node.behavior === 'DROP_CASCADE') {
            output.push('CASCADE');
          }
          break;
        case 'AT_ValidateConstraint':
          output.push('VALIDATE', 'CONSTRAINT');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'C':
          output.push('ADD');
          if (node.def) {
            // Pass domain context to avoid adding constraint names for domain constraints
            const domainContext = context.spawn('CreateDomainStmt', { isDomainConstraint: true });
            output.push(this.visit(node.def, domainContext));
          }
          break;
        case 'X':
          output.push('DROP', 'CONSTRAINT');
          if (node.missing_ok) {
            output.push('IF', 'EXISTS');
          }
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          if (node.behavior === 'DROP_CASCADE') {
            output.push('CASCADE');
          }
          break;
        case 'V':
          output.push('VALIDATE', 'CONSTRAINT');
          if (node.name) {
            output.push(QuoteUtils.quote(node.name));
          }
          break;
        case 'O':
          output.push('SET', 'NOT', 'NULL');
          break;
        case 'N':
          output.push('DROP', 'NOT', 'NULL');
          break;
        case 'T':
          if (node.def) {
            output.push('SET', 'DEFAULT');
            output.push(this.visit(node.def, context));
          } else {
            output.push('DROP', 'DEFAULT');
          }
          break;
        default:
          throw new Error(`Unsupported AlterDomainStmt subtype: ${node.subtype}`);
      }
    }

    return output.join(' ');
  }

  PrepareStmt(node: t.PrepareStmt, context: DeparserContext): string {
    const output: string[] = ['PREPARE'];

    if (node.name) {
      output.push(node.name);
    }

    if (node.argtypes && node.argtypes.length > 0) {
      const argTypes = ListUtils.unwrapList(node.argtypes)
        .map(argType => this.visit(argType, context))
        .join(', ');
      output.push(`(${argTypes})`);
    }

    output.push('AS');

    if (node.query) {
      output.push(this.visit(node.query, context));
    }

    return output.join(' ');
  }

  ExecuteStmt(node: t.ExecuteStmt, context: DeparserContext): string {
    const output: string[] = ['EXECUTE'];

    if (node.name) {
      output.push(node.name);
    }

    if (node.params && node.params.length > 0) {
      const params = ListUtils.unwrapList(node.params)
        .map(param => this.visit(param, context))
        .join(', ');
      output.push(`(${params})`);
    }

    return output.join(' ');
  }

  DeallocateStmt(node: t.DeallocateStmt, context: DeparserContext): string {
    const output: string[] = ['DEALLOCATE'];

    if (node.isall) {
      output.push('ALL');
    } else if (node.name) {
      output.push(node.name);
    }

    return output.join(' ');
  }

  NotifyStmt(node: t.NotifyStmt, context: DeparserContext): string {
    const output: string[] = ['NOTIFY'];

    if (node.conditionname) {
      output.push(node.conditionname);
    }

    if (node.payload !== null && node.payload !== undefined) {
      output.push(',');
      output.push(`'${node.payload}'`);
    }

    return output.join(' ');
  }

  ListenStmt(node: t.ListenStmt, context: DeparserContext): string {
    const output: string[] = ['LISTEN'];

    if (node.conditionname) {
      output.push(node.conditionname);
    }

    return output.join(' ');
  }

  UnlistenStmt(node: t.UnlistenStmt, context: DeparserContext): string {
    const output: string[] = ['UNLISTEN'];

    if (node.conditionname) {
      output.push(node.conditionname);
    } else {
      output.push('*');
    }

    return output.join(' ');
  }

  CheckPointStmt(node: t.CheckPointStmt, context: DeparserContext): string {
    return 'CHECKPOINT';
  }

  LoadStmt(node: t.LoadStmt, context: DeparserContext): string {
    if (!node.filename) {
      throw new Error('LoadStmt requires filename');
    }
    return `LOAD '${node.filename}'`;
  }

  DiscardStmt(node: t.DiscardStmt, context: DeparserContext): string {
    switch (node.target) {
      case 'DISCARD_ALL':
        return 'DISCARD ALL';
      case 'DISCARD_PLANS':
        return 'DISCARD PLANS';
      case 'DISCARD_SEQUENCES':
        return 'DISCARD SEQUENCES';
      case 'DISCARD_TEMP':
        return 'DISCARD TEMP';
      default:
        throw new Error(`Unsupported DiscardStmt target: ${node.target}`);
    }
  }

  CommentStmt(node: t.CommentStmt, context: DeparserContext): string {
    const output: string[] = ['COMMENT ON'];

    if (node.objtype) {
      switch (node.objtype) {
        case 'OBJECT_TABLE':
          output.push('TABLE');
          break;
        case 'OBJECT_COLUMN':
          output.push('COLUMN');
          break;
        case 'OBJECT_INDEX':
          output.push('INDEX');
          break;
        case 'OBJECT_FUNCTION':
          output.push('FUNCTION');
          break;
        case 'OBJECT_VIEW':
          output.push('VIEW');
          break;
        case 'OBJECT_SCHEMA':
          output.push('SCHEMA');
          break;
        case 'OBJECT_DATABASE':
          output.push('DATABASE');
          break;
        case 'OBJECT_MATVIEW':
          output.push('MATERIALIZED VIEW');
          break;
        case 'OBJECT_TABCONSTRAINT':
          output.push('CONSTRAINT');
          break;
        case 'OBJECT_TRIGGER':
          output.push('TRIGGER');
          break;
        case 'OBJECT_FDW':
          output.push('FOREIGN DATA WRAPPER');
          break;
        case 'OBJECT_EVENT_TRIGGER':
          output.push('EVENT TRIGGER');
          break;
        case 'OBJECT_FOREIGN_SERVER':
          output.push('SERVER');
          break;
        case 'OBJECT_FOREIGN_TABLE':
          output.push('FOREIGN TABLE');
          break;
        case 'OBJECT_STATISTIC_EXT':
          output.push('STATISTICS');
          break;
        case 'OBJECT_LARGEOBJECT':
          output.push('LARGE OBJECT');
          break;
        case 'OBJECT_OPERATOR':
          output.push('OPERATOR');
          break;
        case 'OBJECT_OPCLASS':
          output.push('OPERATOR CLASS');
          break;
        case 'OBJECT_OPFAMILY':
          output.push('OPERATOR FAMILY');
          break;
        case 'OBJECT_POLICY':
          output.push('POLICY');
          break;
        case 'OBJECT_TSPARSER':
          output.push('TEXT SEARCH PARSER');
          break;
        case 'OBJECT_TSDICTIONARY':
          output.push('TEXT SEARCH DICTIONARY');
          break;
        case 'OBJECT_TSTEMPLATE':
          output.push('TEXT SEARCH TEMPLATE');
          break;
        case 'OBJECT_TSCONFIGURATION':
          output.push('TEXT SEARCH CONFIGURATION');
          break;
        case 'OBJECT_TRANSFORM':
          output.push('TRANSFORM');
          break;
        default:
          output.push(node.objtype.replace('OBJECT_', ''));
      }
    }

    if (node.object) {
      // Handle object names specially for CommentStmt
      if (node.object && typeof node.object === 'object' && 'List' in node.object) {
        const list = node.object.List as t.List;
        if (list.items && list.items.length > 0) {
          const objectParts = ListUtils.unwrapList(list.items)
            .map(item => this.visit(item, context));

          if (node.objtype === 'OBJECT_TABCONSTRAINT') {
            if (objectParts.length === 3) {
              const [schema, table, constraint] = objectParts;
              output.push(constraint);
              output.push('ON');
              output.push(`${schema}.${table}`);
            } else if (objectParts.length === 2) {
              const [table, constraint] = objectParts;
              output.push(constraint);
              output.push('ON');
              output.push(table);
            } else {
              output.push(objectParts.join('.'));
            }
          } else if (node.objtype === 'OBJECT_TRIGGER') {
            if (objectParts.length === 2) {
              const [table, trigger] = objectParts;
              output.push(trigger);
              output.push('ON');
              output.push(table);
            } else {
              output.push(objectParts.join('.'));
            }
          } else if (node.objtype === 'OBJECT_RULE') {
            if (objectParts.length === 2) {
              const [table, rule] = objectParts;
              output.push(rule);
              output.push('ON');
              output.push(table);
            } else {
              output.push(objectParts.join('.'));
            }
          } else if (node.objtype === 'OBJECT_OPERATOR') {
            // Handle OPERATOR syntax: COMMENT ON OPERATOR -(NONE, integer) IS 'comment'
            // For operators, we need to handle ObjectWithArgs structure
            if (node.object && (node.object as any).ObjectWithArgs) {
              const objWithArgs = (node.object as any).ObjectWithArgs;
              let operatorName = objWithArgs.objname && objWithArgs.objname[0] && objWithArgs.objname[0].String
                ? objWithArgs.objname[0].String.sval : 'unknown';

              if (operatorName.startsWith('"') && operatorName.endsWith('"')) {
                operatorName = operatorName.slice(1, -1);
              }

              const args: string[] = [];
              if (objWithArgs.objargs) {
                objWithArgs.objargs.forEach((arg: any) => {
                  if (!arg || Object.keys(arg).length === 0) {
                    args.push('NONE');
                  } else if (arg.TypeName) {
                    const typeName = this.visit(arg, context);
                    args.push(typeName);
                  } else {
                    args.push('unknown');
                  }
                });
              }

              output.push(`${operatorName} (${args.join(', ')})`);
            } else {
              output.push(objectParts.join('.'));
            }
          } else if (node.objtype === 'OBJECT_OPCLASS' || node.objtype === 'OBJECT_OPFAMILY') {
            // Handle OPERATOR CLASS/FAMILY syntax: don't prefix with schema
            if (objectParts.length >= 2) {
              const className = objectParts[objectParts.length - 1];
              const accessMethod = objectParts[objectParts.length - 2];
              output.push(`${className} USING ${accessMethod}`);
            } else {
              output.push(objectParts.join(' USING '));
            }
          } else if (node.objtype === 'OBJECT_POLICY') {
            // Handle POLICY syntax: COMMENT ON POLICY policy_name ON table_name IS 'comment'
            if (objectParts.length === 2) {
              const [table, policy] = objectParts;
              output.push(policy);
              output.push('ON');
              output.push(table);
            } else {
              output.push(objectParts.join('.'));
            }
          } else if (node.objtype === 'OBJECT_TRANSFORM') {
            // Handle TRANSFORM syntax: COMMENT ON TRANSFORM FOR type LANGUAGE language IS 'comment'
            if (objectParts.length === 2) {
              const [type, language] = objectParts;
              output.push('FOR');
              output.push(type);
              output.push('LANGUAGE');
              output.push(language);
            } else {
              output.push(objectParts.join('.'));
            }
          } else {
            output.push(objectParts.join('.'));
          }
        }
      } else if (node.objtype === 'OBJECT_OPERATOR' && node.object && (node.object as any).ObjectWithArgs) {
        // Handle direct ObjectWithArgs for OPERATOR syntax: COMMENT ON OPERATOR -(NONE, integer) IS 'comment'
        const objWithArgs = (node.object as any).ObjectWithArgs;
        let operatorName = objWithArgs.objname && objWithArgs.objname[0] && objWithArgs.objname[0].String
          ? objWithArgs.objname[0].String.sval : 'unknown';

        // Remove quotes from operator name if present
        if (operatorName.startsWith('"') && operatorName.endsWith('"')) {
          operatorName = operatorName.slice(1, -1);
        }

        const args: string[] = [];
        if (objWithArgs.objargs) {
          objWithArgs.objargs.forEach((arg: any) => {
            if (!arg || Object.keys(arg).length === 0) {
              args.push('NONE');
            } else if (arg.TypeName) {
              const typeName = this.visit(arg, context);
              args.push(typeName);
            } else {
              args.push('unknown');
            }
          });
        }

        output.push(`${operatorName}(${args.join(', ')})`);
      } else {
        const objContext = context.spawn('CommentStmt', { objtype: node.objtype });
        output.push(this.visit(node.object, objContext));
      }
    }

    output.push('IS');

    if (node.comment === null || node.comment === undefined) {
      output.push('NULL');
    } else if (node.comment) {
      output.push(QuoteUtils.formatEString(node.comment));
    }

    return output.join(' ');
  }

  LockStmt(node: t.LockStmt, context: DeparserContext): string {
    const output: string[] = ['LOCK', 'TABLE'];

    if (node.relations && node.relations.length > 0) {
      const relations = ListUtils.unwrapList(node.relations)
        .map(rel => this.visit(rel, context))
        .join(', ');
      output.push(relations);
    }

    if (node.mode !== undefined) {
      const lockModes = [
        '',                       // mode 0 (unused)
        'ACCESS SHARE',           // mode 1
        'ROW SHARE',              // mode 2
        'ROW EXCLUSIVE',          // mode 3
        'SHARE UPDATE EXCLUSIVE', // mode 4
        'SHARE',                  // mode 5
        'SHARE ROW EXCLUSIVE',    // mode 6
        'EXCLUSIVE',              // mode 7
        'ACCESS EXCLUSIVE'        // mode 8
      ];

      if (node.mode >= 1 && node.mode < lockModes.length) {
        output.push('IN', lockModes[node.mode], 'MODE');
      }
    }

    if (node.nowait) {
      output.push('NOWAIT');
    }

    return output.join(' ');
  }

  CreatePolicyStmt(node: t.CreatePolicyStmt, context: DeparserContext): string {
    const output: string[] = [];

    const initialParts = ['CREATE', 'POLICY'];
    if (node.policy_name) {
      initialParts.push(QuoteUtils.quote(node.policy_name));
    }

    output.push(initialParts.join(' '));

    // Add ON clause on new line in pretty mode
    if (node.table) {
      if (context.isPretty()) {
        output.push(context.newline() + context.indent(`ON ${this.RangeVar(node.table, context)}`));
      } else {
        output.push('ON');
        output.push(this.RangeVar(node.table, context));
      }
    }

    // Handle AS RESTRICTIVE/PERMISSIVE clause
    if (node.permissive === undefined) {
      if (context.isPretty()) {
        output.push(context.newline() + context.indent('AS RESTRICTIVE'));
      } else {
        output.push('AS', 'RESTRICTIVE');
      }
    } else if (node.permissive === true) {
      if (context.isPretty()) {
        output.push(context.newline() + context.indent('AS PERMISSIVE'));
      } else {
        output.push('AS', 'PERMISSIVE');
      }
    }

    if (node.cmd_name) {
      if (context.isPretty()) {
        output.push(context.newline() + context.indent(`FOR ${node.cmd_name.toUpperCase()}`));
      } else {
        output.push('FOR', node.cmd_name.toUpperCase());
      }
    }

    if (node.roles && node.roles.length > 0) {
      const roles = ListUtils.unwrapList(node.roles).map(role => this.visit(role, context));
      if (context.isPretty()) {
        output.push(context.newline() + context.indent(`TO ${roles.join(', ')}`));
      } else {
        output.push('TO');
        output.push(roles.join(', '));
      }
    }

    if (node.qual) {
      if (context.isPretty()) {
        const qualExpr = this.visit(node.qual, context);
        output.push(context.newline() + context.indent('USING ('));
        output.push(context.newline() + context.indent(context.indent(qualExpr)));
        output.push(context.newline() + context.indent(')'));
      } else {
        output.push('USING');
        output.push(`(${this.visit(node.qual, context)})`);
      }
    }

    if (node.with_check) {
      if (context.isPretty()) {
        const checkExpr = this.visit(node.with_check, context);
        output.push(context.newline() + context.indent('WITH CHECK ('));
        output.push(context.newline() + context.indent(context.indent(checkExpr)));
        output.push(context.newline() + context.indent(')'));
      } else {
        output.push('WITH CHECK');
        output.push(`(${this.visit(node.with_check, context)})`);
      }
    }

    return context.isPretty() ? output.join('') : output.join(' ');
  }

  AlterPolicyStmt(node: t.AlterPolicyStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'POLICY'];

    if (node.policy_name) {
      output.push(QuoteUtils.quote(node.policy_name));
    }

    if (node.table) {
      output.push('ON');
      output.push(this.RangeVar(node.table, context));
    }

    if (node.roles && node.roles.length > 0) {
      output.push('TO');
      const roles = ListUtils.unwrapList(node.roles).map(role => this.visit(role, context));
      output.push(roles.join(', '));
    }

    if (node.qual) {
      output.push('USING');
      output.push(`(${this.visit(node.qual, context)})`);
    }

    if (node.with_check) {
      output.push('WITH CHECK');
      output.push(`(${this.visit(node.with_check, context)})`);
    }

    return output.join(' ');
  }

  CreateUserMappingStmt(node: t.CreateUserMappingStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.if_not_exists) {
      output.push('IF', 'NOT', 'EXISTS');
    }

    output.push('USER', 'MAPPING');

    output.push('FOR');

    if (node.user) {
      output.push(this.RoleSpec(node.user, context));
    } else {
      output.push('CURRENT_USER');
    }

    output.push('SERVER');

    if (node.servername) {
      output.push(QuoteUtils.quoteString(node.servername));
    }

    if (node.options && node.options.length > 0) {
      output.push('OPTIONS');
      const userMappingContext = context.spawn('CreateUserMappingStmt');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, userMappingContext));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  CreateStatsStmt(node: t.CreateStatsStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.if_not_exists) {
      output.push('IF', 'NOT', 'EXISTS');
    }

    output.push('STATISTICS');

    if (node.defnames && node.defnames.length > 0) {
      const names = ListUtils.unwrapList(node.defnames).map(name => this.visit(name, context));
      output.push(names.join('.'));
    }

    if (node.stat_types && node.stat_types.length > 0) {
      const types = ListUtils.unwrapList(node.stat_types).map(type => this.visit(type, context));
      output.push(`(${types.join(', ')})`);
    }

    output.push('ON');

    if (node.exprs && node.exprs.length > 0) {
      const exprs = ListUtils.unwrapList(node.exprs).map(expr => this.visit(expr, context));
      output.push(exprs.join(', '));
    }

    if (node.relations && node.relations.length > 0) {
      output.push('FROM');
      const relations = ListUtils.unwrapList(node.relations).map(rel => this.visit(rel, context));
      output.push(relations.join(', '));
    }

    return output.join(' ');
  }

  StatsElem(node: t.StatsElem, context: DeparserContext): string {
    if (node.name) {
      return this.quoteIfNeeded(node.name);
    } else if (node.expr) {
      return `(${this.visit(node.expr, context)})`;
    }
    return '';
  }

  CreatePublicationStmt(node: t.CreatePublicationStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'PUBLICATION'];

    if (node.pubname) {
      output.push(QuoteUtils.quoteString(node.pubname));
    }

    if (node.pubobjects && node.pubobjects.length > 0) {
      output.push('FOR', 'TABLE');
      const tables = ListUtils.unwrapList(node.pubobjects).map(table => this.visit(table, context));
      output.push(tables.join(', '));
    } else if (node.for_all_tables) {
      output.push('FOR', 'ALL', 'TABLES');
    }

    if (node.options && node.options.length > 0) {
      output.push('WITH');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, context));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  CreateSubscriptionStmt(node: t.CreateSubscriptionStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'SUBSCRIPTION'];

    if (node.subname) {
      output.push(QuoteUtils.quoteString(node.subname));
    }

    output.push('CONNECTION');

    if (node.conninfo) {
      output.push(`'${node.conninfo}'`);
    }

    output.push('PUBLICATION');

    if (node.publication && node.publication.length > 0) {
      const publications = ListUtils.unwrapList(node.publication).map(pub => this.visit(pub, context));
      output.push(publications.join(', '));
    }

    if (node.options && node.options.length > 0) {
      output.push('WITH');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, context));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  AlterPublicationStmt(node: t.AlterPublicationStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'PUBLICATION'];

    if (node.pubname) {
      output.push(QuoteUtils.quoteString(node.pubname));
    }

    if (node.action) {
      switch (node.action) {
        case 'AP_AddObjects':
          output.push('ADD');
          break;
        case 'AP_DropObjects':
          output.push('DROP');
          break;
        case 'AP_SetObjects':
          output.push('SET');
          break;
        default:
          throw new Error(`Unsupported AlterPublicationStmt action: ${node.action}`);
      }
    }

    if (node.for_all_tables) {
      output.push('FOR ALL TABLES');
    } else if (node.pubobjects && node.pubobjects.length > 0) {
      output.push('FOR TABLE');
      const objects = ListUtils.unwrapList(node.pubobjects).map(obj => this.visit(obj, context));
      output.push(objects.join(', '));
    }

    if (node.options && node.options.length > 0) {
      output.push('WITH');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, context));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  AlterSubscriptionStmt(node: t.AlterSubscriptionStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'SUBSCRIPTION'];

    if (node.subname) {
      output.push(QuoteUtils.quoteString(node.subname));
    }

    if (node.kind) {
      switch (node.kind) {
        case 'ALTER_SUBSCRIPTION_OPTIONS':
          output.push('SET');
          break;
        case 'ALTER_SUBSCRIPTION_CONNECTION':
          output.push('CONNECTION');
          if (node.conninfo) {
            output.push(`'${node.conninfo}'`);
          }
          break;
        case 'ALTER_SUBSCRIPTION_SET_PUBLICATION':
          output.push('SET PUBLICATION');
          if (node.publication && node.publication.length > 0) {
            const publications = ListUtils.unwrapList(node.publication).map(pub => this.visit(pub, context));
            output.push(publications.join(', '));
          }
          break;
        case 'ALTER_SUBSCRIPTION_REFRESH':
          output.push('REFRESH PUBLICATION');
          break;
        case 'ALTER_SUBSCRIPTION_ENABLED':
          output.push('ENABLE');
          break;
        case 'ALTER_SUBSCRIPTION_SKIP':
          output.push('SKIP');
          break;
        default:
          throw new Error(`Unsupported AlterSubscriptionStmt kind: ${node.kind}`);
      }
    }

    if (node.options && node.options.length > 0) {
      output.push('WITH');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, context));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  DropSubscriptionStmt(node: t.DropSubscriptionStmt, context: DeparserContext): string {
    const output: string[] = ['DROP', 'SUBSCRIPTION'];

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    if (node.subname) {
      output.push(QuoteUtils.quoteString(node.subname));
    }

    if (node.behavior) {
      switch (node.behavior) {
        case 'DROP_CASCADE':
          output.push('CASCADE');
          break;
        case 'DROP_RESTRICT':
          output.push('RESTRICT');
          break;
      }
    }

    return output.join(' ');
  }

  DoStmt(node: t.DoStmt, context: DeparserContext): string {
    const output: string[] = ['DO'];

    if (node.args && node.args.length > 0) {
      const doContext = context.spawn('DoStmt');
      const args = ListUtils.unwrapList(node.args);

      const processedArgs: string[] = [];

      for (const arg of args) {
        const nodeType = this.getNodeType(arg);
        if (nodeType === 'DefElem') {
          const defElem = this.getNodeData(arg) as any;
          if (defElem.defname === 'language') {
            const langValue = this.visit(defElem.arg, doContext);
            processedArgs.push(`LANGUAGE ${langValue}`);
          } else if (defElem.defname === 'as') {
            // Handle code block with configurable delimiter
            const argNodeType = this.getNodeType(defElem.arg);
            if (argNodeType === 'String') {
              const stringNode = this.getNodeData(defElem.arg) as any;
              const delimiter = this.getFunctionDelimiter(stringNode.sval);
              processedArgs.push(`${delimiter}${stringNode.sval}${delimiter}`);
            } else {
              processedArgs.push(this.visit(defElem.arg, doContext));
            }
          }
        }
      }

      output.push(...processedArgs);
    }

    return output.join(' ');
  }

  private generateUniqueDollarTag(content: string): string {
    // Check if content contains nested dollar quotes
    const dollarQuotePattern = /\$[a-zA-Z0-9_]*\$/g;
    const matches = content.match(dollarQuotePattern) || [];

    if (matches.length === 0) {
      return '$$';
    }

    const existingTags = new Set(matches);

    // Check if $$ is already used
    if (existingTags.has('$$')) {
      let counter = 1;
      let tag = `$do${counter}$`;

      while (existingTags.has(tag)) {
        counter++;
        tag = `$do${counter}$`;
      }

      return tag;
    }

    return '$$';
  }

  InlineCodeBlock(node: t.InlineCodeBlock, context: DeparserContext): string {
    if (node.source_text) {
      const delimiter = this.getFunctionDelimiter(node.source_text);
      return `${delimiter}${node.source_text}${delimiter}`;
    }
    const delimiter = this.options.functionDelimiter || '$$';
    return `${delimiter}${delimiter}`;
  }

  CallContext(node: t.CallContext, context: DeparserContext): string {
    if (node.atomic !== undefined) {
      return node.atomic ? 'ATOMIC' : 'NOT ATOMIC';
    }
    return '';
  }

  ConstraintsSetStmt(node: t.ConstraintsSetStmt, context: DeparserContext): string {
    const output: string[] = ['SET', 'CONSTRAINTS'];

    if (node.constraints && node.constraints.length > 0) {
      const constraints = ListUtils.unwrapList(node.constraints).map(constraint => this.visit(constraint, context));
      output.push(constraints.join(', '));
    } else {
      output.push('ALL');
    }

    output.push(node.deferred ? 'DEFERRED' : 'IMMEDIATE');

    return output.join(' ');
  }

  AlterSystemStmt(node: t.AlterSystemStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'SYSTEM'];

    if (node.setstmt) {
      const setStmt = this.VariableSetStmt(node.setstmt, context);
      const setStmtWithoutPrefix = setStmt.replace(/^SET\s+/, '');
      output.push('SET', setStmtWithoutPrefix);
    }

    return output.join(' ');
  }

  VacuumRelation(node: t.VacuumRelation, context: DeparserContext): string {
    const output: string[] = [];

    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));
    }

    if (node.va_cols && node.va_cols.length > 0) {
      output.push('(');
      const columns = ListUtils.unwrapList(node.va_cols).map(col => this.visit(col, context));
      output.push(columns.join(', '));
      output.push(')');
    }

    return output.join(' ');
  }

  DropOwnedStmt(node: t.DropOwnedStmt, context: DeparserContext): string {
    const output: string[] = ['DROP', 'OWNED', 'BY'];

    if (node.roles && node.roles.length > 0) {
      const roles = ListUtils.unwrapList(node.roles).map(role => this.visit(role, context));
      output.push(roles.join(', '));
    }

    if (node.behavior) {
      switch (node.behavior) {
        case 'DROP_CASCADE':
          output.push('CASCADE');
          break;
        case 'DROP_RESTRICT':
          output.push('RESTRICT');
          break;
      }
    }

    return output.join(' ');
  }

  ReassignOwnedStmt(node: t.ReassignOwnedStmt, context: DeparserContext): string {
    const output: string[] = ['REASSIGN', 'OWNED', 'BY'];

    if (node.roles && node.roles.length > 0) {
      const roles = ListUtils.unwrapList(node.roles).map(role => this.visit(role, context));
      output.push(roles.join(', '));
    }

    output.push('TO');

    if (node.newrole) {
      output.push(this.RoleSpec(node.newrole, context));
    }

    return output.join(' ');
  }

  AlterTSDictionaryStmt(node: t.AlterTSDictionaryStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'TEXT', 'SEARCH', 'DICTIONARY'];

    if (node.dictname && node.dictname.length > 0) {
      const dictName = ListUtils.unwrapList(node.dictname).map(name => this.visit(name, context));
      output.push(dictName.join('.'));
    }

    if (node.options && node.options.length > 0) {
      output.push('(');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, context));
      output.push(options.join(', '));
      output.push(')');
    }

    return output.join(' ');
  }

  AlterTSConfigurationStmt(node: t.AlterTSConfigurationStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'TEXT', 'SEARCH', 'CONFIGURATION'];

    if (node.cfgname && node.cfgname.length > 0) {
      const cfgName = ListUtils.unwrapList(node.cfgname).map(name => this.visit(name, context));
      output.push(cfgName.join('.'));
    }

    if (node.kind) {
      switch (node.kind) {
        case 'ALTER_TSCONFIG_ADD_MAPPING':
          output.push('ADD', 'MAPPING', 'FOR');
          if (node.tokentype && node.tokentype.length > 0) {
            const tokenTypes = ListUtils.unwrapList(node.tokentype).map(token => this.visit(token, context));
            output.push(tokenTypes.join(', '));
          }
          if (node.dicts && node.dicts.length > 0) {
            output.push('WITH');
            const dictNames = ListUtils.unwrapList(node.dicts).map(dict => {
              if (dict.List && dict.List.items) {
                return ListUtils.unwrapList(dict.List.items).map(item => this.visit(item, context)).join('.');
              }
              return this.visit(dict, context);
            });
            output.push(dictNames.join(', '));
          }
          break;
        case 'ALTER_TSCONFIG_ALTER_MAPPING_FOR_TOKEN':
          output.push('ALTER', 'MAPPING', 'FOR');
          if (node.tokentype && node.tokentype.length > 0) {
            const tokenTypes = ListUtils.unwrapList(node.tokentype).map(token => this.visit(token, context));
            output.push(tokenTypes.join(', '));
          }
          if (node.dicts && node.dicts.length > 0) {
            output.push('WITH');
            const dictNames = ListUtils.unwrapList(node.dicts).map(dict => {
              if (dict.List && dict.List.items) {
                return ListUtils.unwrapList(dict.List.items).map(item => this.visit(item, context)).join('.');
              }
              return this.visit(dict, context);
            });
            output.push(dictNames.join(', '));
          }
          break;
        case 'ALTER_TSCONFIG_REPLACE_DICT':
          output.push('ALTER', 'MAPPING', 'REPLACE');
          if (node.dicts && node.dicts.length >= 2) {
            const dictNames = ListUtils.unwrapList(node.dicts).map(dict => {
              if (dict.List && dict.List.items) {
                return ListUtils.unwrapList(dict.List.items).map(item => this.visit(item, context)).join('.');
              }
              return this.visit(dict, context);
            });
            output.push(dictNames[0], 'WITH', dictNames.slice(1).join(', '));
          }
          break;
        case 'ALTER_TSCONFIG_REPLACE_DICT_FOR_TOKEN':
          output.push('ALTER', 'MAPPING', 'FOR');
          if (node.tokentype && node.tokentype.length > 0) {
            const tokenTypes = ListUtils.unwrapList(node.tokentype).map(token => this.visit(token, context));
            output.push(tokenTypes.join(', '));
          }
          if (node.dicts && node.dicts.length >= 2) {
            output.push('REPLACE');
            const dictNames = ListUtils.unwrapList(node.dicts).map(dict => {
              if (dict.List && dict.List.items) {
                return ListUtils.unwrapList(dict.List.items).map(item => this.visit(item, context)).join('.');
              }
              return this.visit(dict, context);
            });
            output.push(dictNames[0], 'WITH', dictNames.slice(1).join(', '));
          }
          break;
        case 'ALTER_TSCONFIG_DROP_MAPPING':
          output.push('DROP', 'MAPPING', 'FOR');
          if (node.tokentype && node.tokentype.length > 0) {
            const tokenTypes = ListUtils.unwrapList(node.tokentype).map(token => this.visit(token, context));
            output.push(tokenTypes.join(', '));
          }
          break;
        default:
          throw new Error(`Unsupported AlterTSConfigurationStmt kind: ${node.kind}`);
      }
    }

    return output.join(' ');
  }

  ClosePortalStmt(node: t.ClosePortalStmt, context: DeparserContext): string {
    const output: string[] = ['CLOSE'];

    if (node.portalname) {
      output.push(QuoteUtils.quote(node.portalname));
    } else {
      output.push('ALL');
    }

    return output.join(' ');
  }

  FetchStmt(node: t.FetchStmt, context: DeparserContext): string {
    const output: string[] = [node.ismove ? 'MOVE' : 'FETCH'];

    // Check if howMany represents "ALL" (PostgreSQL uses LONG_MAX as sentinel)
    const isAll = (node.howMany as any) === 9223372036854776000;

    // Handle direction first, then check for ALL within each direction
    if (node.direction) {
      switch (node.direction) {
        case 'FETCH_FORWARD':
          if (isAll) {
            output.push('FORWARD', 'ALL');
          } else if (node.howMany !== undefined && node.howMany !== null) {
            output.push('FORWARD', node.howMany.toString());
          } else {
            output.push('FORWARD');
          }
          break;
        case 'FETCH_BACKWARD':
          if (isAll) {
            output.push('BACKWARD', 'ALL');
          } else if (node.howMany !== undefined && node.howMany !== null) {
            output.push('BACKWARD', node.howMany.toString());
          } else {
            output.push('BACKWARD');
          }
          break;
        case 'FETCH_ABSOLUTE':
          if (node.howMany !== undefined && node.howMany !== null) {
            output.push('ABSOLUTE', node.howMany.toString());
          }
          break;
        case 'FETCH_RELATIVE':
          if (node.howMany !== undefined && node.howMany !== null) {
            output.push('RELATIVE', node.howMany.toString());
          } else {
            output.push('RELATIVE', '0');
          }
          break;
        default:
          throw new Error(`Unsupported FetchStmt direction: ${node.direction}`);
      }
    } else if (isAll) {
      // Handle plain "ALL" without direction
      output.push('ALL');
    }

    if (node.portalname) {
      output.push(QuoteUtils.quote(node.portalname));
    }

    return output.join(' ');
  }

  AlterStatsStmt(node: t.AlterStatsStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'STATISTICS'];

    if (node.defnames && node.defnames.length > 0) {
      const names = ListUtils.unwrapList(node.defnames).map(name => this.visit(name, context));
      output.push(names.join('.'));
    }

    output.push('SET', 'STATISTICS');

    if (node.stxstattarget) {
      output.push(this.visit(node.stxstattarget, context));
    }

    return output.join(' ');
  }

  ObjectWithArgs(node: t.ObjectWithArgs, context: DeparserContext): string {
    let result = '';

    if (node.objname && node.objname.length > 0) {
      const objContext = context.spawn('ObjectWithArgs');
      const names = ListUtils.unwrapList(node.objname).map(name => this.visit(name, objContext));
      result = names.join('.');
    }

    if (node.objfuncargs && node.objfuncargs.length > 0) {
      const funcArgs = ListUtils.unwrapList(node.objfuncargs).map(arg => this.visit(arg, context));
      result += `(${funcArgs.join(', ')})`;
    } else if (node.objargs && node.objargs.length > 0) {
      const args = ListUtils.unwrapList(node.objargs).map(arg => {
        // Handle empty objects that represent NONE in operator definitions
        if (!arg || Object.keys(arg).length === 0) {
          return 'NONE';
        }
        return this.visit(arg, context);
      });
      result += `(${args.join(', ')})`;
    } else if (node.args_unspecified) {
      // For functions with unspecified args, don't add parentheses
    } else {
      if ((context.parentNodeTypes.includes('CommentStmt') || context.parentNodeTypes.includes('DropStmt')) &&
          context.objtype === 'OBJECT_AGGREGATE') {
        result += '(*)';
      } else if (context.parentNodeTypes.includes('CreateOpClassItem')) {
        // For operator class items, don't add empty parentheses for operators without arguments
      } else {
        result += '()';
      }
    }

    return result;
  }

  AlterOperatorStmt(node: t.AlterOperatorStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'OPERATOR'];

    if (node.opername) {
      output.push(this.ObjectWithArgs(node.opername, context));
    }

    output.push('SET');

    if (node.options && node.options.length > 0) {
      const alterOpContext = context.spawn('AlterOperatorStmt');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, alterOpContext));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  AlterFdwStmt(node: t.AlterFdwStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'FOREIGN', 'DATA', 'WRAPPER'];

    if (node.fdwname) {
      output.push(QuoteUtils.quote(node.fdwname));
    }

    if (node.func_options && node.func_options.length > 0) {
      const fdwContext = context.spawn('AlterFdwStmt');
      const funcOptions = ListUtils.unwrapList(node.func_options).map(opt => this.visit(opt, fdwContext));
      output.push(funcOptions.join(' '));
    }

    if (node.options && node.options.length > 0) {
      output.push('OPTIONS');
      const fdwContext = context.spawn('AlterFdwStmt');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, fdwContext));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  CreateForeignServerStmt(node: t.CreateForeignServerStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'SERVER'];

    if (node.if_not_exists) {
      output.push('IF', 'NOT', 'EXISTS');
    }

    if (node.servername) {
      output.push(QuoteUtils.quote(node.servername));
    }

    if (node.servertype) {
      output.push('TYPE', QuoteUtils.escape(node.servertype));
    }

    if (node.version) {
      output.push('VERSION', QuoteUtils.escape(node.version));
    }

    if (node.fdwname) {
      output.push('FOREIGN', 'DATA', 'WRAPPER', QuoteUtils.quote(node.fdwname));
    }

    if (node.options && node.options.length > 0) {
      output.push('OPTIONS');
      output.push('(');
      const optionsContext = context.spawn('CreateForeignServerStmt');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, optionsContext));
      output.push(options.join(', '));
      output.push(')');
    }

    return output.join(' ');
  }

  AlterForeignServerStmt(node: t.AlterForeignServerStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'SERVER'];

    if (node.servername) {
      output.push(QuoteUtils.quote(node.servername));
    }

    if (node.version) {
      output.push('VERSION', QuoteUtils.escape(node.version));
    }

    if (node.options && node.options.length > 0) {
      output.push('OPTIONS');
      output.push('(');
      const optionsContext = context.spawn('AlterForeignServerStmt');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, optionsContext));
      output.push(options.join(', '));
      output.push(')');
    }

    return output.join(' ');
  }

  AlterUserMappingStmt(node: t.AlterUserMappingStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'USER', 'MAPPING', 'FOR'];

    if (node.user) {
      output.push(this.RoleSpec(node.user, context));
    } else {
      output.push('CURRENT_USER');
    }

    output.push('SERVER');

    if (node.servername) {
      output.push(QuoteUtils.quote(node.servername));
    }

    if (node.options && node.options.length > 0) {
      output.push('OPTIONS');
      const userMappingContext = context.spawn('AlterUserMappingStmt');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, userMappingContext));
      output.push(`(${options.join(', ')})`);
    }

    return output.join(' ');
  }

  DropUserMappingStmt(node: t.DropUserMappingStmt, context: DeparserContext): string {
    const output: string[] = ['DROP', 'USER', 'MAPPING'];

    if (node.missing_ok) {
      output.push('IF', 'EXISTS');
    }

    output.push('FOR');

    if (node.user) {
      output.push(this.RoleSpec(node.user, context));
    } else {
      output.push('CURRENT_USER');
    }

    output.push('SERVER');

    if (node.servername) {
      output.push(QuoteUtils.quote(node.servername));
    }

    return output.join(' ');
  }

  ImportForeignSchemaStmt(node: t.ImportForeignSchemaStmt, context: DeparserContext): string {
    const output: string[] = ['IMPORT', 'FOREIGN', 'SCHEMA'];

    if (node.remote_schema) {
      output.push(QuoteUtils.quote(node.remote_schema));
    }

    if (node.list_type) {
      switch (node.list_type) {
        case 'FDW_IMPORT_SCHEMA_ALL':
          break;
        case 'FDW_IMPORT_SCHEMA_LIMIT_TO':
          output.push('LIMIT', 'TO');
          if (node.table_list && node.table_list.length > 0) {
            const tables = ListUtils.unwrapList(node.table_list).map(table => this.visit(table, context));
            output.push(`(${tables.join(', ')})`);
          }
          break;
        case 'FDW_IMPORT_SCHEMA_EXCEPT':
          output.push('EXCEPT');
          if (node.table_list && node.table_list.length > 0) {
            const tables = ListUtils.unwrapList(node.table_list).map(table => this.visit(table, context));
            output.push(`(${tables.join(', ')})`);
          }
          break;
        default:
          throw new Error(`Unsupported ImportForeignSchemaStmt list_type: ${node.list_type}`);
      }
    }

    output.push('FROM', 'SERVER');

    if (node.server_name) {
      output.push(QuoteUtils.quote(node.server_name));
    }

    output.push('INTO');

    if (node.local_schema) {
      output.push(QuoteUtils.quote(node.local_schema));
    }

    if (node.options && node.options.length > 0) {
      const importSchemaContext = context.spawn('ImportForeignSchemaStmt');
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, importSchemaContext));
      output.push(`OPTIONS (${options.join(', ')})`);
    }

    return output.join(' ');
  }

  ClusterStmt(node: t.ClusterStmt, context: DeparserContext): string {
    const output: string[] = ['CLUSTER'];

    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));

      if (node.indexname) {
        output.push('USING', QuoteUtils.quoteString(node.indexname));
      }
    }

    if (node.params && node.params.length > 0) {
      const params = ListUtils.unwrapList(node.params).map(param => this.visit(param, context));
      output.push(`(${params.join(', ')})`);
    }

    return output.join(' ');
  }

  VacuumStmt(node: t.VacuumStmt, context: DeparserContext): string {
    const output: string[] = [node.is_vacuumcmd ? 'VACUUM' : 'ANALYZE'];

    if (node.options && node.options.length > 0) {
      const options = ListUtils.unwrapList(node.options).map(option => this.visit(option, context));
      output.push(`(${options.join(', ')})`);
    }

    if (node.rels && node.rels.length > 0) {
      const relations = ListUtils.unwrapList(node.rels).map(rel => this.visit(rel, context));
      output.push(relations.join(', '));
    }

    return output.join(' ');
  }

  ExplainStmt(node: t.ExplainStmt, context: DeparserContext): string {
    const output: string[] = ['EXPLAIN'];

    if (node.options && node.options.length > 0) {
      const explainContext = context.spawn('ExplainStmt');
      const options = ListUtils.unwrapList(node.options).map(option => this.visit(option, explainContext));
      output.push(`(${options.join(', ')})`);
    }

    if (node.query) {
      output.push(this.visit(node.query, context));
    }

    return output.join(' ');
  }

  ReindexStmt(node: t.ReindexStmt, context: DeparserContext): string {
    const output: string[] = ['REINDEX'];

    if (node.params && node.params.length > 0) {
      const params = ListUtils.unwrapList(node.params).map(param => this.visit(param, context));
      output.push(`(${params.join(', ')})`);
    }

    if (node.kind) {
      switch (node.kind) {
        case 'REINDEX_OBJECT_INDEX':
          output.push('INDEX');
          break;
        case 'REINDEX_OBJECT_TABLE':
          output.push('TABLE');
          break;
        case 'REINDEX_OBJECT_SCHEMA':
          output.push('SCHEMA');
          break;
        case 'REINDEX_OBJECT_SYSTEM':
          output.push('SYSTEM');
          break;
        case 'REINDEX_OBJECT_DATABASE':
          output.push('DATABASE');
          break;
        default:
          throw new Error(`Unsupported ReindexStmt kind: ${node.kind}`);
      }
    }

    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));
    }

    if (node.name) {
      output.push(QuoteUtils.quoteString(node.name));
    }

    return output.join(' ');
  }

  CallStmt(node: t.CallStmt, context: DeparserContext): string {
    const output: string[] = ['CALL'];

    if (node.funccall) {
      const funcCall = node.funccall as any;

      if (funcCall.funcname && funcCall.funcname.length > 0) {
        const funcNameParts = funcCall.funcname.map((nameNode: any) => {
          if (nameNode.String) {
            return nameNode.String.sval;
          }
          return this.visit(nameNode, context);
        });
        const funcName = funcNameParts.join('.');

        let argsStr = '';
        if (funcCall.args && funcCall.args.length > 0) {
          const argStrs = funcCall.args.map((arg: any) => this.visit(arg, context));
          argsStr = `(${argStrs.join(', ')})`;
        } else {
          argsStr = '()';
        }

        output.push(`${funcName}${argsStr}`);
      }
    } else if (node.funcexpr) {
      output.push(this.FuncExpr(node.funcexpr, context));
    } else {
      throw new Error('CallStmt requires either funccall or funcexpr');
    }

    return output.join(' ');
  }

  CreatedbStmt(node: t.CreatedbStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE DATABASE'];

    if (!node.dbname) {
      throw new Error('CreatedbStmt requires dbname');
    }

    output.push(QuoteUtils.quoteString(node.dbname));

    if (node.options && node.options.length > 0) {
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, context))
        .join(' ');
      output.push('WITH', options);
    }

    return output.join(' ');
  }

  DropdbStmt(node: t.DropdbStmt, context: DeparserContext): string {
    const output: string[] = ['DROP DATABASE'];

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    if (!node.dbname) {
      throw new Error('DropdbStmt requires dbname');
    }

    output.push(QuoteUtils.quoteString(node.dbname));

    if (node.options && node.options.length > 0) {
      const options = ListUtils.unwrapList(node.options)
        .map(option => this.visit(option, context))
        .join(' ');
      output.push('WITH', options);
    }

    return output.join(' ');
  }

  RenameStmt(node: t.RenameStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER'];

    if (!node.renameType) {
      throw new Error('RenameStmt requires renameType');
    }

    switch (node.renameType) {
      case 'OBJECT_TABLE':
        output.push('TABLE');
        break;
      case 'OBJECT_VIEW':
        output.push('VIEW');
        break;
      case 'OBJECT_INDEX':
        output.push('INDEX');
        break;
      case 'OBJECT_SEQUENCE':
        output.push('SEQUENCE');
        break;
      case 'OBJECT_FUNCTION':
        output.push('FUNCTION');
        break;
      case 'OBJECT_PROCEDURE':
        output.push('PROCEDURE');
        break;
      case 'OBJECT_SCHEMA':
        output.push('SCHEMA');
        break;
      case 'OBJECT_DATABASE':
        output.push('DATABASE');
        break;
      case 'OBJECT_COLUMN':
        if (node.relationType === 'OBJECT_FOREIGN_TABLE') {
          output.push('FOREIGN TABLE');
        } else if (node.relationType === 'OBJECT_VIEW') {
          output.push('VIEW');
        } else {
          output.push('TABLE');
        }
        break;
      case 'OBJECT_DOMAIN':
        output.push('DOMAIN');
        break;
      case 'OBJECT_TYPE':
        output.push('TYPE');
        break;
      case 'OBJECT_DOMCONSTRAINT':
        output.push('DOMAIN');
        break;
      case 'OBJECT_TABCONSTRAINT':
        output.push('TABLE');
        break;
      case 'OBJECT_AGGREGATE':
        output.push('AGGREGATE');
        break;
      case 'OBJECT_COLLATION':
        output.push('COLLATION');
        break;
      case 'OBJECT_CONVERSION':
        output.push('CONVERSION');
        break;
      case 'OBJECT_EXTENSION':
        output.push('EXTENSION');
        break;
      case 'OBJECT_FOREIGN_SERVER':
        output.push('SERVER');
        break;
      case 'OBJECT_FOREIGN_TABLE':
        output.push('FOREIGN TABLE');
        break;
      case 'OBJECT_LANGUAGE':
        output.push('LANGUAGE');
        break;
      case 'OBJECT_MATVIEW':
        output.push('MATERIALIZED VIEW');
        break;
      case 'OBJECT_OPCLASS':
        output.push('OPERATOR CLASS');
        break;
      case 'OBJECT_OPERATOR':
        output.push('OPERATOR');
        break;
      case 'OBJECT_OPFAMILY':
        output.push('OPERATOR FAMILY');
        break;
      case 'OBJECT_POLICY':
        output.push('POLICY');
        if (node.subname) {
          output.push(QuoteUtils.quote(node.subname));
        }
        break;
      case 'OBJECT_PUBLICATION':
        output.push('PUBLICATION');
        break;
      case 'OBJECT_ROLE':
        output.push('ROLE');
        break;
      case 'OBJECT_RULE':
        output.push('RULE');
        break;
      case 'OBJECT_SUBSCRIPTION':
        output.push('SUBSCRIPTION');
        break;
      case 'OBJECT_TABLESPACE':
        output.push('TABLESPACE');
        break;
      case 'OBJECT_TRIGGER':
        output.push('TRIGGER');
        break;
      case 'OBJECT_TSCONFIGURATION':
        output.push('TEXT SEARCH CONFIGURATION');
        break;
      case 'OBJECT_TSDICTIONARY':
        output.push('TEXT SEARCH DICTIONARY');
        break;
      case 'OBJECT_TSPARSER':
        output.push('TEXT SEARCH PARSER');
        break;
      case 'OBJECT_TSTEMPLATE':
        output.push('TEXT SEARCH TEMPLATE');
        break;
      case 'OBJECT_FDW':
        output.push('FOREIGN DATA WRAPPER');
        break;
      case 'OBJECT_EVENT_TRIGGER':
        output.push('EVENT TRIGGER');
        break;
      case 'OBJECT_ATTRIBUTE':
        if (node.relationType === 'OBJECT_TYPE') {
          output.push('TYPE');
        } else {
          output.push('TABLE'); // fallback for other relation types
        }
        break;
      case 'OBJECT_ROUTINE':
        output.push('ROUTINE');
        break;
      default:
        throw new Error(`Unsupported RenameStmt renameType: ${node.renameType}`);
    }

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    // Handle OBJECT_RULE special case: rule_name ON table_name format
    if (node.renameType === 'OBJECT_RULE' && node.subname && node.relation) {
      output.push(QuoteUtils.quote(node.subname));
      output.push('ON');
      output.push(this.RangeVar(node.relation, context));
    } else if (node.relation) {
      const rangeVarContext = context.spawn('RenameStmt', { objtype: node.relationType });

      // Add ON keyword for policy operations
      if (node.renameType === 'OBJECT_POLICY') {
        output.push('ON');
      }

      output.push(this.RangeVar(node.relation, rangeVarContext));
    } else if (node.object) {
      // Handle operator family and operator class objects specially to format name USING access_method correctly
      if ((node.renameType === 'OBJECT_OPFAMILY' || node.renameType === 'OBJECT_OPCLASS') && (node.object as any).List) {
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const accessMethod = items[0].String?.sval || '';
          const objectName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(objectName)} USING ${accessMethod}`);
        } else {
          output.push(this.visit(node.object, context));
        }
      } else if (node.renameType === 'OBJECT_SCHEMA' && (node.object as any).List) {
        // Handle schema names - extract from List structure
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length > 0 && items[0].String) {
          output.push(this.quoteIfNeeded(items[0].String.sval));
        } else {
          output.push(this.visit(node.object, context));
        }
      } else {
        output.push(this.visit(node.object, context));
      }
    }

        if (node.renameType === 'OBJECT_COLUMN' && node.subname) {
          output.push('RENAME COLUMN', QuoteUtils.quoteString(node.subname), 'TO');
        } else if (node.renameType === 'OBJECT_DOMCONSTRAINT' && node.subname) {
          output.push('RENAME CONSTRAINT', QuoteUtils.quoteString(node.subname), 'TO');
        } else if (node.renameType === 'OBJECT_TABCONSTRAINT' && node.subname) {
          output.push('RENAME CONSTRAINT', QuoteUtils.quoteString(node.subname), 'TO');
        } else if (node.renameType === 'OBJECT_ATTRIBUTE' && node.subname) {
          output.push('RENAME ATTRIBUTE', QuoteUtils.quoteString(node.subname), 'TO');
        } else if (node.renameType === 'OBJECT_ROLE' && node.subname) {
          output.push(QuoteUtils.quoteString(node.subname), 'RENAME TO');
    } else if (node.renameType === 'OBJECT_SCHEMA' && node.subname) {
      output.push(this.quoteIfNeeded(node.subname), 'RENAME TO');
    } else if (node.renameType === 'OBJECT_RULE') {
      output.push('RENAME TO');
    } else {
      output.push('RENAME TO');
    }

    if (!node.newname) {
      throw new Error('RenameStmt requires newname');
    }

    output.push(QuoteUtils.quote(node.newname));

    // Handle CASCADE/RESTRICT behavior for RENAME operations
    if (node.behavior === 'DROP_CASCADE') {
      output.push('CASCADE');
    }

    return output.join(' ');
  }

  AlterOwnerStmt(node: t.AlterOwnerStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER'];

    if (!node.objectType) {
      throw new Error('AlterOwnerStmt requires objectType');
    }

    output.push(this.getObjectTypeKeyword(node.objectType));

    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));
    } else if (node.object) {
      // Handle operator family and operator class objects specially to format name USING access_method correctly
      if ((node.objectType === 'OBJECT_OPFAMILY' || node.objectType === 'OBJECT_OPCLASS') && (node.object as any).List) {
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const accessMethod = items[0].String?.sval || '';
          const objectName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(objectName)} USING ${accessMethod}`);
        } else {
          output.push(this.visit(node.object, context));
        }
      } else {
        output.push(this.visit(node.object, context));
      }
    }

    output.push('OWNER TO');

    if (!node.newowner) {
      throw new Error('AlterOwnerStmt requires newowner');
    }

    output.push(this.RoleSpec(node.newowner, context));

    return output.join(' ');
  }

  GrantStmt(node: t.GrantStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.is_grant) {
      output.push('GRANT');
    } else {
      output.push('REVOKE');
      if (node.grant_option) {
        output.push('GRANT OPTION FOR');
      }
    }

    if (node.privileges && node.privileges.length > 0) {
      const privilegeContext = context.spawn('GrantStmt');
      const privileges = ListUtils.unwrapList(node.privileges)
        .map(priv => this.visit(priv, privilegeContext))
        .join(', ');
      output.push(privileges);
    } else {
      output.push('ALL');
    }

    output.push('ON');

    // Handle object type specification only for ALTER DEFAULT PRIVILEGES context
    if (node.objtype && node.targtype === 'ACL_TARGET_DEFAULTS') {
      switch (node.objtype) {
        case 'OBJECT_TABLE':
          output.push('TABLES');
          break;
        case 'OBJECT_SEQUENCE':
          output.push('SEQUENCES');
          break;
        case 'OBJECT_FUNCTION':
          output.push('FUNCTIONS');
          break;
        case 'OBJECT_PROCEDURE':
          output.push('PROCEDURES');
          break;
        case 'OBJECT_ROUTINE':
          output.push('ROUTINES');
          break;
        case 'OBJECT_TYPE':
          output.push('TYPES');
          break;
        case 'OBJECT_SCHEMA':
          output.push('SCHEMAS');
          break;
        default:
          break;
      }
    }

    switch (node.targtype) {
      case 'ACL_TARGET_OBJECT':
        if (node.objtype === 'OBJECT_SCHEMA') {
          output.push('SCHEMA');
        } else if (node.objtype === 'OBJECT_LANGUAGE') {
          output.push('LANGUAGE');
        } else if (node.objtype === 'OBJECT_FUNCTION') {
          output.push('FUNCTION');
        } else if (node.objtype === 'OBJECT_PROCEDURE') {
          output.push('PROCEDURE');
        } else if (node.objtype === 'OBJECT_TYPE') {
          output.push('TYPE');
        } else if (node.objtype === 'OBJECT_DOMAIN') {
          output.push('DOMAIN');
        } else if (node.objtype === 'OBJECT_LARGEOBJECT') {
          output.push('LARGE OBJECT');
        } else if (node.objtype === 'OBJECT_FDW') {
          output.push('FOREIGN', 'DATA', 'WRAPPER');
        } else if (node.objtype === 'OBJECT_FOREIGN_SERVER') {
          output.push('FOREIGN', 'SERVER');
        } else if (node.objtype === 'OBJECT_DATABASE') {
          output.push('DATABASE');
        }
        if (node.objects && node.objects.length > 0) {
          const objects = ListUtils.unwrapList(node.objects)
            .map(obj => this.visit(obj, context))
            .join(', ');
          output.push(objects);
        }
        break;
      case 'ACL_TARGET_ALL_IN_SCHEMA':
        // Handle different object types for ALL ... IN SCHEMA syntax
        switch (node.objtype) {
          case 'OBJECT_TABLE':
            output.push('ALL TABLES IN SCHEMA');
            break;
          case 'OBJECT_SEQUENCE':
            output.push('ALL SEQUENCES IN SCHEMA');
            break;
          case 'OBJECT_FUNCTION':
            output.push('ALL FUNCTIONS IN SCHEMA');
            break;
          case 'OBJECT_PROCEDURE':
            output.push('ALL PROCEDURES IN SCHEMA');
            break;
          case 'OBJECT_ROUTINE':
            output.push('ALL ROUTINES IN SCHEMA');
            break;
          case 'OBJECT_TYPE':
            output.push('ALL TYPES IN SCHEMA');
            break;
          default:
            output.push('ALL TABLES IN SCHEMA'); // Default fallback
            break;
        }
        if (node.objects && node.objects.length > 0) {
          const schemas = ListUtils.unwrapList(node.objects)
            .map(schema => this.visit(schema, context))
            .join(', ');
          output.push(schemas);
        }
        break;
      default:
        if (node.objects && node.objects.length > 0) {
          const objects = ListUtils.unwrapList(node.objects)
            .map(obj => this.visit(obj, context))
            .join(', ');
          output.push(objects);
        }
    }

    if (node.is_grant) {
      output.push('TO');
    } else {
      output.push('FROM');
    }

    if (node.grantees && node.grantees.length > 0) {
      const grantees = ListUtils.unwrapList(node.grantees)
        .map(grantee => this.visit(grantee, context))
        .join(', ');
      output.push(grantees);
    }

    if (node.grant_option && node.is_grant) {
      output.push('WITH GRANT OPTION');
    }

    // Only add behavior clauses for REVOKE statements, not for GRANT statements in ALTER DEFAULT PRIVILEGES
    if (!node.is_grant) {
      if (node.behavior === 'DROP_CASCADE') {
        output.push('CASCADE');
      } else if (node.behavior === 'DROP_RESTRICT') {
        output.push('RESTRICT');
      }
    }

    return output.join(' ');
  }

  GrantRoleStmt(node: t.GrantRoleStmt, context: DeparserContext): string {
    const output: string[] = [];

    // Check for inherit, admin, and set options first to place them correctly
    let hasInheritOption = false;
    let hasAdminOption = false;
    let hasSetOption = false;
    let inheritValue: boolean | undefined;
    let adminValue: boolean | undefined;
    let setValue: boolean | undefined;

    if (node.opt && node.opt.length > 0) {
      const options = ListUtils.unwrapList(node.opt);

      const inheritOption = options.find(opt =>
        opt.DefElem && opt.DefElem.defname === 'inherit'
      );

      const adminOption = options.find(opt =>
        (opt.String && opt.String.sval === 'admin') ||
        (opt.DefElem && opt.DefElem.defname === 'admin')
      );

      const setOption = options.find(opt =>
        opt.DefElem && opt.DefElem.defname === 'set'
      );

      if (inheritOption && inheritOption.DefElem) {
        hasInheritOption = true;
        inheritValue = inheritOption.DefElem.arg?.Boolean?.boolval;
      }

      if (adminOption) {
        hasAdminOption = true;
        if (adminOption.DefElem && adminOption.DefElem.arg) {
          adminValue = adminOption.DefElem.arg.Boolean?.boolval;
        }
      }

      if (setOption && setOption.DefElem) {
        hasSetOption = true;
        setValue = setOption.DefElem.arg?.Boolean?.boolval;
      }
    }

    if (node.is_grant) {
      output.push('GRANT');
    } else {
      output.push('REVOKE');

      if (hasInheritOption) {
        output.push('INHERIT OPTION FOR');
      } else if (hasAdminOption) {
        output.push('ADMIN OPTION FOR');
      }
    }

    if (node.granted_roles && node.granted_roles.length > 0) {
      const roles = ListUtils.unwrapList(node.granted_roles)
        .map(role => this.visit(role, context))
        .join(', ');
      output.push(roles);
    }

    if (node.is_grant) {
      output.push('TO');
    } else {
      output.push('FROM');
    }

    if (node.grantee_roles && node.grantee_roles.length > 0) {
      const grantees = ListUtils.unwrapList(node.grantee_roles)
        .map(grantee => this.visit(grantee, context))
        .join(', ');
      output.push(grantees);
    }

    if (node.is_grant) {
      const withOptions: string[] = [];

      if (hasAdminOption) {
        if (adminValue === true) {
          withOptions.push('ADMIN OPTION');
        } else if (adminValue === false) {
          withOptions.push('ADMIN FALSE');
        } else {
          withOptions.push('ADMIN OPTION');
        }
      }

      if (hasInheritOption) {
        if (inheritValue === true) {
          withOptions.push('INHERIT OPTION');
        } else if (inheritValue === false) {
          withOptions.push('INHERIT FALSE');
        }
      }

      if (hasSetOption) {
        if (setValue === true) {
          withOptions.push('SET TRUE');
        } else if (setValue === false) {
          withOptions.push('SET FALSE');
        }
      }

      if (withOptions.length > 0) {
        output.push('WITH', withOptions.join(', '));
      }
    }

    return output.join(' ');
  }

  SecLabelStmt(node: t.SecLabelStmt, context: DeparserContext): string {
    const output: string[] = ['SECURITY LABEL'];

    if (node.provider) {
      output.push('FOR', QuoteUtils.quoteString(node.provider));
    }

    output.push('ON');

    if (node.objtype) {
      switch (node.objtype) {
        case 'OBJECT_TABLE':
          output.push('TABLE');
          break;
        case 'OBJECT_COLUMN':
          output.push('COLUMN');
          break;
        case 'OBJECT_FUNCTION':
          output.push('FUNCTION');
          break;
        case 'OBJECT_SCHEMA':
          output.push('SCHEMA');
          break;
        case 'OBJECT_DATABASE':
          output.push('DATABASE');
          break;
        case 'OBJECT_ROLE':
          output.push('ROLE');
          break;
        default:
          output.push(node.objtype.replace('OBJECT_', ''));
      }
    }

    if (node.object) {
      output.push(this.visit(node.object, context));
    }

    output.push('IS');

    if (node.label) {
      output.push(`'${node.label}'`);
    } else {
      output.push('NULL');
    }

    return output.join(' ');
  }

  AlterDefaultPrivilegesStmt(node: t.AlterDefaultPrivilegesStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER DEFAULT PRIVILEGES'];

    if (node.options && node.options.length > 0) {
      const options = ListUtils.unwrapList(node.options);
      for (const option of options) {
        const optionData = this.getNodeData(option);
        if (optionData.defname === 'schemas') {
          output.push('IN SCHEMA');
          if (optionData.arg) {
            const schemas = ListUtils.unwrapList(optionData.arg)
              .map(schema => this.visit(schema, context))
              .join(', ');
            output.push(schemas);
          }
        } else if (optionData.defname === 'roles') {
          output.push('FOR ROLE');
          if (optionData.arg) {
            const roles = ListUtils.unwrapList(optionData.arg)
              .map(role => this.visit(role, context))
              .join(', ');
            output.push(roles);
          }
        }
      }
    }

    if (node.action) {
      const actionStr = this.GrantStmt(node.action, context);
      if (context.isPretty()) {
        return output.join(' ') + context.newline() + context.indent(actionStr);
      } else {
        output.push(actionStr);
      }
    }

    return output.join(' ');
  }

  CreateConversionStmt(node: t.CreateConversionStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.def) {
      output.push('DEFAULT');
    }

    output.push('CONVERSION');

    if (node.conversion_name && node.conversion_name.length > 0) {
      const conversionName = ListUtils.unwrapList(node.conversion_name)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(conversionName);
    }

    if (node.for_encoding_name) {
      output.push('FOR', `'${node.for_encoding_name}'`);
    }

    if (node.to_encoding_name) {
      output.push('TO', `'${node.to_encoding_name}'`);
    }

    if (node.func_name && node.func_name.length > 0) {
      output.push('FROM');
      const funcName = ListUtils.unwrapList(node.func_name)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(funcName);
    }

    return output.join(' ');
  }

  CreateCastStmt(node: t.CreateCastStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE CAST'];

    output.push('(');
    if (node.sourcetype) {
      output.push(this.TypeName(node.sourcetype, context));
    }
    output.push('AS');
    if (node.targettype) {
      output.push(this.TypeName(node.targettype, context));
    }
    output.push(')');

    if (node.func) {
      output.push('WITH FUNCTION');
      output.push(this.ObjectWithArgs(node.func, context));
    } else if (node.inout) {
      output.push('WITH INOUT');
    } else {
      output.push('WITHOUT FUNCTION');
    }

    if (node.context) {
      switch (node.context) {
        case 'COERCION_IMPLICIT':
          output.push('AS IMPLICIT');
          break;
        case 'COERCION_ASSIGNMENT':
          output.push('AS ASSIGNMENT');
          break;
        case 'COERCION_EXPLICIT':
          break;
        default:
          throw new Error(`Unsupported CreateCastStmt context: ${node.context}`);
      }
    }else if (node.context === 'COERCION_ASSIGNMENT') {
      output.push('AS ASSIGNMENT');
    }

    return output.join(' ');
  }

  CreatePLangStmt(node: t.CreatePLangStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.replace) {
      output.push('OR REPLACE');
    }

    if (node.pltrusted) {
      output.push('TRUSTED');
    }

    output.push('LANGUAGE');

    if (node.plname) {
      output.push(QuoteUtils.quote(node.plname));
    }

    if (node.plhandler && node.plhandler.length > 0) {
      output.push('HANDLER');
      const handlerName = ListUtils.unwrapList(node.plhandler)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(handlerName);
    }

    if (node.plinline && node.plinline.length > 0) {
      output.push('INLINE');
      const inlineName = ListUtils.unwrapList(node.plinline)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(inlineName);
    }

    if (node.plvalidator && node.plvalidator.length > 0) {
      output.push('VALIDATOR');
      const validatorName = ListUtils.unwrapList(node.plvalidator)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(validatorName);
    }

    return output.join(' ');
  }

  CreateTransformStmt(node: t.CreateTransformStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.replace) {
      output.push('OR REPLACE');
    }

    output.push('TRANSFORM FOR');

    if (node.type_name) {
      output.push(this.TypeName(node.type_name, context));
    }

    output.push('LANGUAGE');

    if (node.lang) {
      output.push(QuoteUtils.quote(node.lang));
    }

    output.push('(');

    const transforms: string[] = [];
    if (node.fromsql) {
      // Handle ObjectWithArgs directly to avoid visitor routing issues
      const fromSqlName = this.ObjectWithArgs(node.fromsql as any, context);
      transforms.push(`FROM SQL WITH FUNCTION ${fromSqlName}`);
    }

    if (node.tosql) {
      // Handle ObjectWithArgs directly to avoid visitor routing issues
      const toSqlName = this.ObjectWithArgs(node.tosql as any, context);
      transforms.push(`TO SQL WITH FUNCTION ${toSqlName}`);
    }

    output.push(transforms.join(', '));
    output.push(')');

    return output.join(' ');
  }

  CreateTrigStmt(node: t.CreateTrigStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.replace) {
      output.push('OR REPLACE');
    }

    if (node.isconstraint) {
      output.push('CONSTRAINT');
    }

    output.push('TRIGGER');

    if (node.trigname) {
      output.push(QuoteUtils.quote(node.trigname));
    }

    if (context.isPretty()) {
      const components: string[] = [];

      const timing: string[] = [];
      if (node.timing & 2) timing.push('BEFORE');
      else if (node.timing & 64) timing.push('INSTEAD OF');
      else timing.push('AFTER');

      const events: string[] = [];
      if (node.events & 4) events.push('INSERT');
      if (node.events & 8) events.push('DELETE');
      if (node.events & 16) {
        let updateStr = 'UPDATE';
        if (node.columns && node.columns.length > 0) {
          const columnNames = ListUtils.unwrapList(node.columns)
            .map(col => this.visit(col, context))
            .join(', ');
          updateStr += ' OF ' + columnNames;
        }
        events.push(updateStr);
      }
      if (node.events & 32) events.push('TRUNCATE');

      components.push(context.indent(timing.join(' ') + ' ' + events.join(' OR ')));

      if (node.relation) {
        components.push(context.indent('ON ' + this.RangeVar(node.relation, context)));
      }

      if (node.transitionRels && node.transitionRels.length > 0) {
        const transitionClauses = ListUtils.unwrapList(node.transitionRels)
          .map(rel => this.visit(rel, context))
          .join(' ');
        components.push(context.indent('REFERENCING ' + transitionClauses));
      }

      if (node.deferrable) {
        components.push(context.indent('DEFERRABLE'));
      }

      if (node.initdeferred) {
        components.push(context.indent('INITIALLY DEFERRED'));
      }

      if (node.row) {
        components.push(context.indent('FOR EACH ROW'));
      } else {
        components.push(context.indent('FOR EACH STATEMENT'));
      }

      if (node.whenClause) {
        const whenStr = 'WHEN (' + this.visit(node.whenClause, context) + ')';
        components.push(context.indent(whenStr));
      }

      let executeStr = 'EXECUTE';
      if (node.funcname && node.funcname.length > 0) {
        const funcName = ListUtils.unwrapList(node.funcname)
          .map(name => this.visit(name, context))
          .join('.');
        executeStr += ' PROCEDURE ' + funcName;
      }

      if (node.args && node.args.length > 0) {
        const argContext = context.spawn('CreateTrigStmt', { isStringLiteral: true });
        const args = ListUtils.unwrapList(node.args)
          .map(arg => this.visit(arg, argContext))
          .join(', ');
        executeStr += '(' + args + ')';
      } else {
        executeStr += '()';
      }

      components.push(context.indent(executeStr));

      return output.join(' ') + context.newline() + components.join(context.newline());
    } else {
      const timing: string[] = [];
      if (node.timing & 2) timing.push('BEFORE');
      else if (node.timing & 64) timing.push('INSTEAD OF');
      else timing.push('AFTER');
      output.push(timing.join(' '));

      const events: string[] = [];
      if (node.events & 4) events.push('INSERT');
      if (node.events & 8) events.push('DELETE');
      if (node.events & 16) events.push('UPDATE');
      if (node.events & 32) events.push('TRUNCATE');
      output.push(events.join(' OR '));

      if (node.columns && node.columns.length > 0) {
        output.push('OF');
        const columnNames = ListUtils.unwrapList(node.columns)
          .map(col => this.visit(col, context))
          .join(', ');
        output.push(columnNames);
      }

      output.push('ON');
      if (node.relation) {
        output.push(this.RangeVar(node.relation, context));
      }

      if (node.constrrel) {
        output.push('FROM');
        output.push(this.RangeVar(node.constrrel, context));
      }

      if (node.deferrable) {
        output.push('DEFERRABLE');
      }

      if (node.initdeferred) {
        output.push('INITIALLY DEFERRED');
      }

      if (node.transitionRels && node.transitionRels.length > 0) {
        output.push('REFERENCING');
        const transitionClauses = ListUtils.unwrapList(node.transitionRels)
          .map(rel => this.visit(rel, context))
          .join(' ');
        output.push(transitionClauses);
      }

      if (node.row) {
        output.push('FOR EACH ROW');
      } else {
        output.push('FOR EACH STATEMENT');
      }

      if (node.whenClause) {
        output.push('WHEN');
        output.push('(');
        output.push(this.visit(node.whenClause, context));
        output.push(')');
      }

      output.push('EXECUTE');
      if (node.funcname && node.funcname.length > 0) {
        const funcName = ListUtils.unwrapList(node.funcname)
          .map(name => this.visit(name, context))
          .join('.');
        output.push('FUNCTION', funcName);
      }

      if (node.args && node.args.length > 0) {
        output.push('(');
        const argContext = context.spawn('CreateTrigStmt', { isStringLiteral: true });
        const args = ListUtils.unwrapList(node.args)
          .map(arg => this.visit(arg, argContext))
          .join(', ');
        output.push(args);
        output.push(')');
      } else {
        output.push('()');
      }

      return output.join(' ');
    }
  }

  TriggerTransition(node: t.TriggerTransition, context: DeparserContext): string {
    const output: string[] = [];

    if (node.isNew) {
      output.push('NEW TABLE AS');
    } else {
      output.push('OLD TABLE AS');
    }

    if (node.name) {
      output.push(QuoteUtils.quote(node.name));
    }

    return output.join(' ');
  }

  CreateEventTrigStmt(node: t.CreateEventTrigStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE EVENT TRIGGER'];

    if (node.trigname) {
      output.push(QuoteUtils.quote(node.trigname));
    }

    output.push('ON');

    if (node.eventname) {
      output.push(node.eventname);
    }

    if (node.whenclause && node.whenclause.length > 0) {
      output.push('WHEN');
      const eventTriggerContext = context.spawn('CreateEventTrigStmt');
      const conditions = ListUtils.unwrapList(node.whenclause)
        .map(condition => this.visit(condition, eventTriggerContext))
        .join(' AND ');
      output.push(conditions);
    }

    output.push('EXECUTE');

    if (node.funcname && node.funcname.length > 0) {
      const funcName = ListUtils.unwrapList(node.funcname)
        .map(name => this.visit(name, context))
        .join('.');
      output.push('PROCEDURE', funcName + '()');
    }

    return output.join(' ');
  }

  AlterEventTrigStmt(node: t.AlterEventTrigStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER EVENT TRIGGER'];

    if (node.trigname) {
      output.push(QuoteUtils.quote(node.trigname));
    }

    if (node.tgenabled) {
      switch (node.tgenabled) {
        case 'O':
          output.push('ENABLE');
          break;
        case 'D':
          output.push('DISABLE');
          break;
        case 'R':
          output.push('ENABLE REPLICA');
          break;
        case 'A':
          output.push('ENABLE ALWAYS');
          break;
        default:
          throw new Error(`Unsupported trigger enable state: ${node.tgenabled}`);
      }
    }

    return output.join(' ');
  }

  CreateOpClassStmt(node: t.CreateOpClassStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE OPERATOR CLASS'];

    if (node.opclassname && node.opclassname.length > 0) {
      const className = ListUtils.unwrapList(node.opclassname)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(className);
    }

    if (node.isDefault) {
      output.push('DEFAULT');
    }

    output.push('FOR TYPE');

    if (node.datatype) {
      output.push(this.TypeName(node.datatype, context));
    }

    output.push('USING');

    if (node.amname) {
      output.push(node.amname);
    }

    if (node.opfamilyname && node.opfamilyname.length > 0) {
      output.push('FAMILY');
      const familyName = ListUtils.unwrapList(node.opfamilyname)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(familyName);
    }

    output.push('AS');

    if (node.items && node.items.length > 0) {
      const items = ListUtils.unwrapList(node.items)
        .map(item => this.visit(item, context))
        .join(', ');
      output.push(items);
    }

    return output.join(' ');
  }

  CreateOpFamilyStmt(node: t.CreateOpFamilyStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE OPERATOR FAMILY'];

    if (node.opfamilyname && node.opfamilyname.length > 0) {
      const familyName = ListUtils.unwrapList(node.opfamilyname)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(familyName);
    }

    output.push('USING');

    if (node.amname) {
      output.push(node.amname);
    }

    return output.join(' ');
  }

  AlterOpFamilyStmt(node: t.AlterOpFamilyStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER OPERATOR FAMILY'];

    if (node.opfamilyname && node.opfamilyname.length > 0) {
      const familyName = ListUtils.unwrapList(node.opfamilyname)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(familyName);
    }

    output.push('USING');

    if (node.amname) {
      output.push(node.amname);
    }

    if (node.isDrop) {
      output.push('DROP');
    } else {
      output.push('ADD');
    }

    if (node.items && node.items.length > 0) {
      const items = ListUtils.unwrapList(node.items)
        .map(item => this.visit(item, context))
        .join(', ');
      output.push(items);
    }

    return output.join(' ');
  }

  MergeStmt(node: t.MergeStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (node.withClause) {
      output.push(this.WithClause(node.withClause, context));
    }

    output.push('MERGE INTO');

    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));
    }

    if (node.sourceRelation) {
      output.push('USING');
      output.push(this.visit(node.sourceRelation, context));
    }

    if (node.joinCondition) {
      output.push('ON');
      output.push(this.visit(node.joinCondition, context));
    }

    if (node.mergeWhenClauses && node.mergeWhenClauses.length > 0) {
      const whenClauses = ListUtils.unwrapList(node.mergeWhenClauses)
        .map(clause => this.visit(clause, context))
        .join(' ');
      output.push(whenClauses);
    }

    return output.join(' ');
  }

  AlterTableMoveAllStmt(node: t.AlterTableMoveAllStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER'];

    if (node.objtype === 'OBJECT_TABLE') {
      output.push('TABLE');
    } else if (node.objtype === 'OBJECT_INDEX') {
      output.push('INDEX');
    } else {
      output.push('TABLE');
    }

    output.push('ALL', 'IN', 'TABLESPACE');

    if (node.orig_tablespacename) {
      output.push(QuoteUtils.quote(node.orig_tablespacename));
    }

    output.push('SET', 'TABLESPACE');

    if (node.new_tablespacename) {
      output.push(QuoteUtils.quote(node.new_tablespacename));
    }

    if (node.nowait) {
      output.push('NOWAIT');
    }

    return output.join(' ');
  }

  CreateSeqStmt(node: t.CreateSeqStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    // Check if this is a temporary sequence
    if (node.sequence) {
      const seq = node.sequence as any;
      if (seq.relpersistence === 't') {
        output.push('TEMPORARY');
      }
    }

    output.push('SEQUENCE');

    if (node.if_not_exists) {
      output.push('IF NOT EXISTS');
    }

    if (node.sequence) {
      const sequenceName: string[] = [];
      const seq = node.sequence as any;
      if (seq.schemaname) {
        sequenceName.push(QuoteUtils.quote(seq.schemaname));
      }
      if (seq.relname) {
        sequenceName.push(QuoteUtils.quote(seq.relname));
      }
      output.push(sequenceName.join('.'));
    }

    if (node.options && node.options.length > 0) {
      const seqContext = context.spawn('CreateSeqStmt');
      const optionStrs = ListUtils.unwrapList(node.options)
        .filter(option => option != null && this.getNodeType(option) !== 'undefined')
        .map(option => {
          try {
            return this.visit(option, seqContext);
          } catch (error) {
            console.warn(`Error processing option in CreateSeqStmt: ${error instanceof Error ? error.message : String(error)}`);
            return '';
          }
        })
        .filter(str => str !== '')
        .join(' ');
      if (optionStrs) {
        output.push(optionStrs);
      }
    }

    return output.join(' ');
  }

  AlterSeqStmt(node: t.AlterSeqStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'SEQUENCE'];

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    if (node.sequence) {
      const sequenceName: string[] = [];
      const seq = node.sequence as any;
      if (seq.schemaname) {
        sequenceName.push(QuoteUtils.quote(seq.schemaname));
      }
      if (seq.relname) {
        sequenceName.push(QuoteUtils.quote(seq.relname));
      }
      output.push(sequenceName.join('.'));
    }

    if (node.options && node.options.length > 0) {
      const seqContext = context.spawn('AlterSeqStmt');
      const optionStrs = ListUtils.unwrapList(node.options)
        .filter(option => option && option !== undefined)
        .map(option => {
          try {
            if (!option || this.getNodeType(option) === 'undefined') {
              return '';
            }
            return this.visit(option, seqContext);
          } catch (error) {
            console.warn(`Error processing option in AlterSeqStmt: ${error instanceof Error ? error.message : String(error)}`);
            return '';
          }
        })
        .filter(str => str && str.trim().length > 0)
        .join(' ');
      if (optionStrs) {
        output.push(optionStrs);
      }
    }

    if (node.for_identity) {
      output.push('FOR IDENTITY');
    }

    return output.join(' ');
  }

  CompositeTypeStmt(node: t.CompositeTypeStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'TYPE'];

    if (node.typevar) {
      const typeContext = context.spawn('CompositeTypeStmt');
      output.push(this.RangeVar(node.typevar, typeContext));
    }

    output.push('AS');

    if (node.coldeflist && node.coldeflist.length > 0) {
      const colDefs = ListUtils.unwrapList(node.coldeflist)
        .map(colDef => this.visit(colDef, context))
        .join(', ');
      output.push(`(${colDefs})`);
    } else {
      // Handle empty composite types - still need parentheses
      output.push('()');
    }

    return output.join(' ');
  }

  CreateRangeStmt(node: t.CreateRangeStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'TYPE'];

    if (node.typeName && node.typeName.length > 0) {
      const typeNameStr = ListUtils.unwrapList(node.typeName)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(typeNameStr);
    }

    output.push('AS', 'RANGE');

    if (node.params && node.params.length > 0) {
      const paramStrs = ListUtils.unwrapList(node.params).map(param => {
        const paramData = this.getNodeData(param);
        if (paramData.defname && paramData.arg) {
          const argValue = this.visit(paramData.arg, context);
          return `${paramData.defname} = ${argValue}`;
        }
        return this.visit(param, context);
      });
      output.push(`(${paramStrs.join(', ')})`);
    }

    return output.join(' ');
  }

  AlterEnumStmt(node: t.AlterEnumStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'TYPE'];

    if (node.typeName && node.typeName.length > 0) {
      const typeNameStr = ListUtils.unwrapList(node.typeName)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(typeNameStr);
    }

    if (node.oldVal && node.newVal) {
      const escapedOldVal = node.oldVal.replace(/'/g, "''");
      const escapedNewVal = node.newVal.replace(/'/g, "''");
      output.push('RENAME', 'VALUE', `'${escapedOldVal}'`, 'TO', `'${escapedNewVal}'`);
    } else if (node.newVal) {
      output.push('ADD', 'VALUE');
      if (node.skipIfNewValExists) {
        output.push('IF NOT EXISTS');
      }
      const escapedNewVal = node.newVal.replace(/'/g, "''");
      output.push(`'${escapedNewVal}'`);
      if (node.newValNeighbor) {
        const escapedNeighbor = node.newValNeighbor.replace(/'/g, "''");
        if (node.newValIsAfter) {
          output.push('AFTER', `'${escapedNeighbor}'`);
        } else {
          output.push('BEFORE', `'${escapedNeighbor}'`);
        }
      }
    }

    return output.join(' ');
  }

  AlterTypeStmt(node: t.AlterTypeStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'TYPE'];

    if (node.typeName && node.typeName.length > 0) {
      const typeNameStr = ListUtils.unwrapList(node.typeName)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(typeNameStr);
    }

    output.push('SET');

    if (node.options && node.options.length > 0) {
      const optionStrs = ListUtils.unwrapList(node.options).map(option => {
        const optionData = this.getNodeData(option);
        if (optionData.defname && optionData.arg) {
          const argValue = this.visit(optionData.arg, context);
          return `${optionData.defname} = ${argValue}`;
        }
        return this.visit(option, context);
      });
      output.push(`(${optionStrs.join(', ')})`);
    }

    return output.join(' ');
  }

  AlterRoleStmt(node: t.AlterRoleStmt, context: DeparserContext): string {
    // Check if this is an ALTER GROUP statement by looking for rolemembers DefElem
    const isGroupStatement = node.options &&
      ListUtils.unwrapList(node.options).some(option =>
        option.DefElem && option.DefElem.defname === 'rolemembers'
      );

    const output: string[] = ['ALTER', isGroupStatement ? 'GROUP' : 'ROLE'];

    if (node.role) {
      output.push(this.RoleSpec(node.role, context));
    }

    if (node.options) {
      const roleContext = context.spawn('AlterRoleStmt');

      // Handle GROUP operations specially based on action value
      if (isGroupStatement) {
        const roleMembersOption = ListUtils.unwrapList(node.options).find(option =>
          option.DefElem && option.DefElem.defname === 'rolemembers'
        );

        if (roleMembersOption && roleMembersOption.DefElem) {
          const operation = node.action === 1 ? 'ADD' : 'DROP';
          output.push(operation, 'USER');

          if (roleMembersOption.DefElem.arg && roleMembersOption.DefElem.arg.List) {
            const users = ListUtils.unwrapList(roleMembersOption.DefElem.arg.List.items)
              .map(user => this.visit(user, roleContext))
              .join(', ');
            output.push(users);
          }
        }
      } else {
        const options = ListUtils.unwrapList(node.options)
          .map(option => this.visit(option, roleContext))
          .join(' ');
        if (options) {
          output.push(options);
        }
      }
    }

    return output.join(' ');
  }

  DropRoleStmt(node: t.DropRoleStmt, context: DeparserContext): string {
    const output: string[] = ['DROP', 'ROLE'];

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    if (node.roles) {
      const roleNames = ListUtils.unwrapList(node.roles)
        .map(role => this.visit(role, context))
        .join(', ');
      output.push(roleNames);
    }

    return output.join(' ');
  }

  targetList(node: any, context: DeparserContext): string {
    if (!node || !Array.isArray(node)) {
      return '';
    }

    return node.map((target: any) => this.visit(target, context)).join(', ');
  }

  CreateAggregateStmt(node: t.DefineStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.replace) {
      output.push('OR REPLACE');
    }

    output.push('AGGREGATE');

    if (node.defnames && node.defnames.length > 0) {
      const aggName = ListUtils.unwrapList(node.defnames)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(aggName);
    }

    output.push('(');

    // Handle aggregate arguments/parameters
    if (node.args && node.args.length > 0) {
      const args = ListUtils.unwrapList(node.args)
        .map(arg => this.visit(arg, context))
        .join(', ');
      output.push(args);
    } else {
      output.push('*');
    }

    output.push(')');
    output.push('(');

    const options: string[] = [];

    if (node.definition && node.definition.length > 0) {
      const optionStrs = ListUtils.unwrapList(node.definition)
        .map(option => {
          const optionData = this.getNodeData(option);
          if (optionData.defname === 'sfunc' || optionData.defname === 'sfunc1') {
            const funcValue = this.visit(optionData.arg, context);
            return `SFUNC = ${funcValue}`;
          } else if (optionData.defname === 'stype' || optionData.defname === 'stype1') {
            const typeValue = this.visit(optionData.arg, context);
            return `STYPE = ${typeValue}`;
          } else if (optionData.defname === 'basetype') {
            const baseValue = this.visit(optionData.arg, context);
            return `BASETYPE = ${baseValue}`;
          } else if (optionData.defname === 'finalfunc') {
            const finalValue = this.visit(optionData.arg, context);
            return `FINALFUNC = ${finalValue}`;
          } else if (optionData.defname === 'initcond' || optionData.defname === 'initcond1') {
            const initValue = this.visit(optionData.arg, context);
            return `INITCOND = ${initValue}`;
          } else if (optionData.defname === 'combinefunc') {
            const combineValue = this.visit(optionData.arg, context);
            return `COMBINEFUNC = ${combineValue}`;
          } else if (optionData.defname === 'serialfunc') {
            const serialValue = this.visit(optionData.arg, context);
            return `SERIALFUNC = ${serialValue}`;
          } else if (optionData.defname === 'deserialfunc') {
            const deserialValue = this.visit(optionData.arg, context);
            return `DESERIALFUNC = ${deserialValue}`;
          } else if (optionData.defname === 'parallel') {
            const parallelValue = this.visit(optionData.arg, context);
            return `PARALLEL = ${parallelValue}`;
          }
          return this.visit(option, context);
        });
      options.push(...optionStrs);
    }

    output.push(options.join(', '));
    output.push(')');

    return output.join(' ');
  }

  CreateTableAsStmt(node: t.CreateTableAsStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.objtype === 'OBJECT_MATVIEW') {
      output.push('MATERIALIZED VIEW');
    } else {
      if (node.into && node.into.rel && node.into.rel.relpersistence === 't') {
        output.push('TEMPORARY TABLE');
      } else {
        output.push('TABLE');
      }
    }

    if (node.if_not_exists) {
      output.push('IF NOT EXISTS');
    }

    if (node.into && node.into.rel) {
      output.push(this.RangeVar(node.into.rel, context));
    }

    if (node.into && node.into.colNames && node.into.colNames.length > 0) {
      output.push('(');
      const colNames = ListUtils.unwrapList(node.into.colNames)
        .map(col => this.visit(col, context))
        .join(', ');
      output.push(colNames);
      output.push(')');
    }

    if (node.into && node.into.accessMethod) {
      output.push('USING');
      output.push(node.into.accessMethod);
    }

    if (node.into && node.into.onCommit && node.into.onCommit !== 'ONCOMMIT_NOOP') {
      output.push('ON COMMIT');
      switch (node.into.onCommit) {
        case 'ONCOMMIT_PRESERVE_ROWS':
          output.push('PRESERVE ROWS');
          break;
        case 'ONCOMMIT_DELETE_ROWS':
          output.push('DELETE ROWS');
          break;
        case 'ONCOMMIT_DROP':
          output.push('DROP');
          break;
      }
    }

    output.push('AS');

    if (node.query) {
      output.push(this.visit(node.query as any, context));
    }

    if (node.into && node.into.options && node.into.options.length > 0) {
      output.push('WITH');
      const options = ListUtils.unwrapList(node.into.options)
        .map(option => this.visit(option, context))
        .join(', ');
      output.push(`(${options})`);
    }

    if (node.into && node.into.skipData) {
      output.push('WITH NO DATA');
    }

    return output.join(' ');
  }

  RefreshMatViewStmt(node: t.RefreshMatViewStmt, context: DeparserContext): string {
    const output: string[] = ['REFRESH', 'MATERIALIZED', 'VIEW'];

    if (node.concurrent) {
      output.push('CONCURRENTLY');
    }

    if (node.relation) {
      output.push(this.visit(node.relation as any, context));
    }

    if (node.skipData) {
      output.push('WITH NO DATA');
    }

    return output.join(' ');
  }



  AccessPriv(node: t.AccessPriv, context: DeparserContext): string {
    const output: string[] = [];

    if (node.priv_name) {
      output.push(node.priv_name.toUpperCase());
    } else {
      output.push('ALL');
    }

    if (node.cols && node.cols.length > 0) {
      output.push('(');
      const colContext = context.spawn('AccessPriv');
      const columns = ListUtils.unwrapList(node.cols).map(col => this.visit(col, colContext));
      output.push(columns.join(', '));
      output.push(')');
    }

    return output.join(' ');
  }

  aliasname(node: any, context: DeparserContext): string {
    if (typeof node === 'string') {
      return QuoteUtils.quote(node);
    }
    return this.visit(node, context);
  }

  DefineStmt(node: t.DefineStmt, context: DeparserContext): string {
    const output: string[] = [];

    if (!node.kind) {
      throw new Error('DefineStmt requires kind property');
    }

    switch (node.kind) {
      case 'OBJECT_OPERATOR':
        output.push('CREATE OPERATOR');

        if (node.defnames && node.defnames.length > 0) {
          const names = ListUtils.unwrapList(node.defnames).map((name, index) => {
            if (index === node.defnames.length - 1) {
              const nodeData = this.getNodeData(name);
              if (nodeData && nodeData.sval) {
                return nodeData.sval; // Return operator symbol unquoted
              }
            }
            return this.visit(name, context); // Quote schema/namespace names normally
          });
          output.push(names.join('.'));
        }

        if (node.definition && node.definition.length > 0) {
          output.push('(');
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            if (def.DefElem) {
              const defElem = def.DefElem;
              const defName = defElem.defname;
              const defValue = defElem.arg;

                            if (defName && defValue) {
                              let preservedDefName;
                              if (QuoteUtils.needsQuotesForString(defName)) {
                                preservedDefName = QuoteUtils.quoteString(defName);
                              } else {
                                preservedDefName = this.preserveOperatorDefElemCase(defName);
                              }

                              if ((defName.toLowerCase() === 'commutator' || defName.toLowerCase() === 'negator') && defValue.List) {
                                const listItems = ListUtils.unwrapList(defValue.List.items);
                                if (listItems.length === 1 && listItems[0].String) {
                                  return `${preservedDefName} = ${listItems[0].String.sval}`;
                                }
                              }
                              // For commutator/negator, we already handled them above
                              if ((defName.toLowerCase() === 'commutator' || defName.toLowerCase() === 'negator')) {
                                return `${preservedDefName} = ${this.visit(defValue, context)}`;
                              }
                              return `${preservedDefName} = ${this.visit(defValue, context)}`;
                            } else if (defName && !defValue) {
                              // Handle boolean flags like HASHES, MERGES - preserve original case
                              if (defName === 'Hashes' || defName === 'Merges') {
                                return QuoteUtils.quoteString(defName);
                              }
                              return this.preserveOperatorDefElemCase(defName).toUpperCase();
                            }
            }
            return this.visit(def, context);
          });
          output.push(definitions.join(', '));
          output.push(')');
        }
        break;

      case 'OBJECT_TYPE':
        output.push('CREATE TYPE');

        if (node.defnames && node.defnames.length > 0) {
          output.push(ListUtils.unwrapList(node.defnames).map(name => this.visit(name, context)).join('.'));
        }

        if (node.definition && node.definition.length > 0) {
          const defineStmtContext = context.spawn('DefineStmt');
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            return this.visit(def, defineStmtContext);
          });
          output.push(`(${definitions.join(', ')})`);
        }
        break;

      case 'OBJECT_AGGREGATE':
        output.push('CREATE');
        if (node.replace) {
          output.push('OR REPLACE');
        }
        output.push('AGGREGATE');

        if (node.defnames && node.defnames.length > 0) {
          const nameStrs = ListUtils.unwrapList(node.defnames).map(name => this.visit(name, context));
          output.push(nameStrs.join('.'));
        }

        if (node.args && node.args.length > 0) {
          const args = ListUtils.unwrapList(node.args);

          // Check if this is an ordered-set aggregate (indicated by Integer(1) or empty Integer after List with FunctionParameter FUNC_PARAM_DEFAULT)
          const hasOrderedSetIndicator = args.some(arg => arg.Integer && arg.Integer.ival === 1);

          // Check for ORDER BY pattern: List with FunctionParameter FUNC_PARAM_DEFAULT followed by empty Integer
          const hasOrderByPattern = args.length >= 2 &&
            args[0].List &&
            args[0].List.items &&
            args[0].List.items.length === 1 &&
            args[0].List.items[0].FunctionParameter &&
            args[0].List.items[0].FunctionParameter.mode === 'FUNC_PARAM_DEFAULT' &&
            args[1].Integer && Object.keys(args[1].Integer).length === 0;

          const filteredArgs = args.filter(arg => {
            if (arg.Integer && (arg.Integer.ival === -1 || arg.Integer.ival === 1)) {
              return false;
            }
            if (arg.Integer && Object.keys(arg.Integer).length === 0 && hasOrderByPattern) {
              return false;
            }
            return true;
          });

          if (filteredArgs.length > 0) {
            if (hasOrderByPattern) {
              // Handle ORDER BY syntax for aggregates like myavg (ORDER BY numeric)
              const listArg = filteredArgs[0];
              if (listArg.List && listArg.List.items && listArg.List.items[0].FunctionParameter) {
                const functionParam = listArg.List.items[0].FunctionParameter;
                // Handle argType which has a TypeName-like structure with names array
                let paramStr;
                if (functionParam.argType && functionParam.argType.names) {
                  // Extract type name from names array (skip pg_catalog schema)
                  const names = functionParam.argType.names;
                  if (names.length >= 2 && names[0].String && names[0].String.sval === 'pg_catalog') {
                    paramStr = names[1].String.sval;
                  } else if (names.length >= 1 && names[0].String) {
                    paramStr = names[0].String.sval;
                  } else {
                    paramStr = 'unknown';
                  }
                } else {
                  // Fallback to visiting the argType as a TypeName
                  paramStr = this.visit({ TypeName: functionParam.argType }, context);
                }
                output.push(`(ORDER BY ${paramStr})`);
              } else {
                const paramStr = this.visit(listArg, context);
                output.push(`(ORDER BY ${paramStr})`);
              }
            } else if (hasOrderedSetIndicator && filteredArgs.length === 1 && filteredArgs[0].List) {
              // Handle ordered-set aggregate with ORDER BY syntax
              const listArg = filteredArgs[0].List;
              if (listArg.items && listArg.items.length >= 2) {
                const items = ListUtils.unwrapList(listArg.items);
                const firstItem = this.visit(items[0], context);
                const remainingItems = items.slice(1).map(item => this.visit(item, context));

                output.push(`(${firstItem} ORDER BY ${remainingItems.join(', ')})`);
              } else if (listArg.items && listArg.items.length === 1) {
                // Handle single VARIADIC parameter in ordered-set context
                const item = listArg.items[0];
                if (item.FunctionParameter && item.FunctionParameter.mode === 'FUNC_PARAM_VARIADIC') {
                  const paramStr = this.visit(item, context);
                  output.push(`(${paramStr} ORDER BY ${paramStr})`);
                } else {
                  const paramStr = this.visit(item, context);
                  output.push(`(${paramStr})`);
                }
              } else {
                // Fallback to regular processing if structure is unexpected
                const argStrs = filteredArgs.map(arg => {
                  if (Object.keys(arg).length === 0) {
                    return '*';
                  }
                  return this.visit(arg, context);
                });
                output.push(`(${argStrs.join(', ')})`);
              }
            } else {
              // Handle regular aggregate arguments
              const argStrs = filteredArgs.map(arg => {
                // Handle empty object representing * wildcard
                if (Object.keys(arg).length === 0) {
                  return '*';
                }
                return this.visit(arg, context);
              });
              output.push(`(${argStrs.join(', ')})`);
            }
          }
        }

        if (node.definition && node.definition.length > 0) {
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            if (def.DefElem) {
              const defElem = def.DefElem;
              const defName = defElem.defname;
              const defValue = defElem.arg;

                            if (defName && defValue) {
                              let preservedDefName;
                              if (QuoteUtils.needsQuotesForString(defName)) {
                                preservedDefName = QuoteUtils.quoteString(defName);
                              } else {
                                preservedDefName = defName;
                              }

                              // Handle String arguments with single quotes for string literals
                              if (defValue.String) {
                                return `${preservedDefName} = '${defValue.String.sval}'`;
                              }
                              return `${preservedDefName} = ${this.visit(defValue, context)}`;
                            }
            }
            return this.visit(def, context);
          });
          output.push(`(${definitions.join(', ')})`);
        }
        break;

      case 'OBJECT_TSDICTIONARY':
        output.push('CREATE TEXT SEARCH DICTIONARY');

        if (node.defnames && node.defnames.length > 0) {
          output.push(ListUtils.unwrapList(node.defnames).map(name => this.visit(name, context)).join('.'));
        }

        if (node.definition && node.definition.length > 0) {
          output.push('(');
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            if (def.DefElem) {
              const defElem = def.DefElem;
              const defName = defElem.defname;
              const defValue = defElem.arg;

              if (defName && defValue) {
                return `${defName} = ${this.visit(defValue, context)}`;
              }
            }
            return this.visit(def, context);
          });
          output.push(definitions.join(', '));
          output.push(')');
        }
        break;

      case 'OBJECT_TSCONFIGURATION':
        output.push('CREATE TEXT SEARCH CONFIGURATION');

        if (node.defnames && node.defnames.length > 0) {
          output.push(ListUtils.unwrapList(node.defnames).map(name => this.visit(name, context)).join('.'));
        }

        if (node.definition && node.definition.length > 0) {
          output.push('(');
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            if (def.DefElem) {
              const defElem = def.DefElem;
              const defName = defElem.defname;
              const defValue = defElem.arg;

              if (defName && defValue) {
                return `${defName} = ${this.visit(defValue, context)}`;
              }
            }
            return this.visit(def, context);
          });
          output.push(definitions.join(', '));
          output.push(')');
        }
        break;

      case 'OBJECT_TSPARSER':
        output.push('CREATE TEXT SEARCH PARSER');

        if (node.defnames && node.defnames.length > 0) {
          const names = ListUtils.unwrapList(node.defnames)
            .map(name => this.visit(name, context))
            .join('.');
          output.push(names);
        }

        if (node.definition && node.definition.length > 0) {
          output.push('(');
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            if (def.DefElem) {
              const defElem = def.DefElem;
              const defName = defElem.defname;
              const defValue = defElem.arg;

              if (defName && defValue) {
                return `${defName} = ${this.visit(defValue, context)}`;
              }
            }
            return this.visit(def, context);
          });
          output.push(definitions.join(', '));
          output.push(')');
        }
        break;

      case 'OBJECT_TSTEMPLATE':
        output.push('CREATE TEXT SEARCH TEMPLATE');

        if (node.defnames && node.defnames.length > 0) {
          const names = ListUtils.unwrapList(node.defnames)
            .map(name => this.visit(name, context))
            .join('.');
          output.push(names);
        }

        if (node.definition && node.definition.length > 0) {
          output.push('(');
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            if (def.DefElem) {
              const defElem = def.DefElem;
              const defName = defElem.defname;
              const defValue = defElem.arg;

              if (defName && defValue) {
                return `${defName} = ${this.visit(defValue, context)}`;
              }
            }
            return this.visit(def, context);
          });
          output.push(definitions.join(', '));
          output.push(')');
        }
        break;

      case 'OBJECT_COLLATION':
        output.push('CREATE COLLATION');

        if (node.defnames && node.defnames.length > 0) {
          output.push(ListUtils.unwrapList(node.defnames).map(name => this.visit(name, context)).join('.'));
        }

        if (node.definition && node.definition.length > 0) {
          const definitions = ListUtils.unwrapList(node.definition).map(def => {
            if (def.DefElem) {
              const defElem = def.DefElem;
              const defName = defElem.defname;
              const defValue = defElem.arg;

              if (defName && defValue) {
                // Handle FROM clause for collation definitions
                if (defName === 'from') {
                  return `FROM ${this.visit(defValue, context)}`;
                }

                // For CREATE COLLATION, ensure String nodes are quoted as string literals
                let valueStr;
                if (defValue.String) {
                  valueStr = `'${defValue.String.sval}'`;
                } else {
                  valueStr = this.visit(defValue, context);
                }
                return `${defName} = ${valueStr}`;
              }
            }
            return this.visit(def, context);
          });

          // Check if we have FROM clause or parameter definitions
          const hasFromClause = definitions.some(def => def.startsWith('FROM '));
          if (hasFromClause) {
            output.push(definitions.join(' '));
          } else {
            // Wrap parameter definitions in parentheses
            output.push(`(${definitions.join(', ')})`);
          }
        }
        break;

      default:
        throw new Error(`Unsupported DefineStmt kind: ${node.kind}`);
    }

    return output.join(' ');
  }

  AlterDatabaseStmt(node: t.AlterDatabaseStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'DATABASE'];

    if (node.dbname) {
      output.push(QuoteUtils.quote(node.dbname));
    }

    if (node.options && node.options.length > 0) {
      const options = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, context));
      output.push(options.join(' '));
    }

    return output.join(' ');
  }

  AlterDatabaseRefreshCollStmt(node: t.AlterDatabaseRefreshCollStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'DATABASE'];

    if (node.dbname) {
      output.push(QuoteUtils.quote(node.dbname));
    }

    output.push('REFRESH', 'COLLATION', 'VERSION');

    return output.join(' ');
  }

  AlterDatabaseSetStmt(node: t.AlterDatabaseSetStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'DATABASE'];

    if (node.dbname) {
      output.push(QuoteUtils.quote(node.dbname));
    }

    if (node.setstmt) {
      const setClause = this.VariableSetStmt(node.setstmt, context);
      output.push(setClause);
    }

    return output.join(' ');
  }

  DeclareCursorStmt(node: t.DeclareCursorStmt, context: DeparserContext): string {
    const output: string[] = ['DECLARE'];

    if (node.portalname) {
      output.push(QuoteUtils.quote(node.portalname));
    }

    // Handle cursor options before CURSOR keyword
    const cursorOptions: string[] = [];
    if (node.options) {

      if (node.options & 2) {
        cursorOptions.push('SCROLL');
      } else if (node.options & 4) {
        cursorOptions.push('NO SCROLL');
      }

      // Handle other cursor options
      if (node.options & 1) cursorOptions.push('BINARY');
      if (node.options & 8) cursorOptions.push('INSENSITIVE');
    }

    if (cursorOptions.length > 0) {
      output.push(...cursorOptions);
    }

    output.push('CURSOR');

    // Handle WITH HOLD after CURSOR keyword (0x0020 = 32)
    if (node.options && (node.options & 32)) {
      output.push('WITH HOLD');
    }

    output.push('FOR');

    if (node.query) {
      output.push(this.visit(node.query, context));
    }

    return output.join(' ');
  }

  PublicationObjSpec(node: t.PublicationObjSpec, context: DeparserContext): string {
    const output: string[] = [];

    if (node.pubobjtype === 'PUBLICATIONOBJ_TABLE') {
      output.push('TABLE');
      if (node.pubtable) {
        output.push(this.PublicationTable(node.pubtable, context));
      }
    } else if (node.pubobjtype === 'PUBLICATIONOBJ_TABLES_IN_SCHEMA') {
      output.push('TABLES IN SCHEMA');
      if (node.name) {
        output.push(QuoteUtils.quote(node.name));
      }
    } else if (node.pubobjtype === 'PUBLICATIONOBJ_TABLES_IN_CUR_SCHEMA') {
      output.push('TABLES IN SCHEMA CURRENT_SCHEMA');
    }

    return output.join(' ');
  }

  PublicationTable(node: t.PublicationTable, context: DeparserContext): string {
    const output: string[] = [];

    if (node.relation) {
      output.push(this.RangeVar(node.relation, context));
    }

    if (node.columns && node.columns.length > 0) {
      const columns = ListUtils.unwrapList(node.columns).map(col => this.visit(col, context));
      output.push(`(${columns.join(', ')})`);
    }

    if (node.whereClause) {
      output.push('WHERE');
      output.push(this.visit(node.whereClause, context));
    }

    return output.join(' ');
  }

  CreateAmStmt(node: t.CreateAmStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE', 'ACCESS', 'METHOD'];

    if (node.amname) {
      output.push(QuoteUtils.quote(node.amname));
    }

    output.push('TYPE');

    switch (node.amtype) {
      case 'i':
        output.push('INDEX');
        break;
      case 't':
        output.push('TABLE');
        break;
      default:
        // Fallback to the raw value if unknown
        output.push(node.amtype || '');
        break;
    }

    if (node.handler_name && node.handler_name.length > 0) {
      output.push('HANDLER');
      const handlerName = ListUtils.unwrapList(node.handler_name)
        .map(name => this.visit(name, context))
        .join('.');
      output.push(handlerName);
    }

    return output.join(' ');
  }

  IntoClause(node: t.IntoClause, context: DeparserContext): string {
    const output: string[] = [];

    if (node.rel) {
      output.push(this.RangeVar(node.rel, context));
    }

    if (node.colNames && node.colNames.length > 0) {
      const columns = ListUtils.unwrapList(node.colNames)
        .map(col => this.visit(col, context))
        .join(', ');
      output.push(`(${columns})`);
    }

    if (node.accessMethod) {
      output.push('USING', node.accessMethod);
    }

    if (node.options && node.options.length > 0) {
      output.push('WITH');
      const options = ListUtils.unwrapList(node.options)
        .map(opt => this.visit(opt, context))
        .join(', ');
      output.push(`(${options})`);
    }

    if (node.onCommit && node.onCommit !== 'ONCOMMIT_NOOP') {
      output.push('ON COMMIT');
      switch (node.onCommit) {
        case 'ONCOMMIT_PRESERVE_ROWS':
          output.push('PRESERVE ROWS');
          break;
        case 'ONCOMMIT_DELETE_ROWS':
          output.push('DELETE ROWS');
          break;
        case 'ONCOMMIT_DROP':
          output.push('DROP');
          break;
      }
    }

    if (node.tableSpaceName) {
      output.push('TABLESPACE', QuoteUtils.quote(node.tableSpaceName));
    }

    return output.join(' ');
  }

  OnConflictExpr(node: t.OnConflictExpr, context: DeparserContext): string {
    const output: string[] = ['ON CONFLICT'];

    if (node.arbiterElems && node.arbiterElems.length > 0) {
      const arbiters = ListUtils.unwrapList(node.arbiterElems)
        .map(elem => this.visit(elem, context))
        .join(', ');
      output.push(`(${arbiters})`);
    }

    if (node.arbiterWhere) {
      output.push('WHERE');
      output.push(this.visit(node.arbiterWhere, context));
    }

    if (node.action === 'ONCONFLICT_NOTHING') {
      output.push('DO NOTHING');
    } else if (node.action === 'ONCONFLICT_UPDATE') {
      output.push('DO UPDATE SET');
      if (node.onConflictSet && node.onConflictSet.length > 0) {
        const updates = ListUtils.unwrapList(node.onConflictSet)
          .map(set => this.visit(set, context))
          .join(', ');
        output.push(updates);
      }

      if (node.onConflictWhere) {
        output.push('WHERE');
        output.push(this.visit(node.onConflictWhere, context));
      }
    }

    return output.join(' ');
  }

  ScanToken(node: t.ScanToken, context: DeparserContext): string {
    return '';
  }

  CreateOpClassItem(node: t.CreateOpClassItem, context: DeparserContext): string {
    const output: string[] = [];

    if (node.itemtype === 1) {
      output.push('OPERATOR');
      // For operators, always include the number (default to 0 if undefined)
      const operatorNumber = node.number !== undefined ? node.number : 0;
      output.push(operatorNumber.toString());
      if (node.name) {
        const opClassContext = context.spawn('CreateOpClassItem');
        output.push(this.ObjectWithArgs(node.name, opClassContext));
      }
    } else if (node.itemtype === 2) {
      output.push('FUNCTION');
      // For functions, always include the number (default to 0 if undefined)
      const functionNumber = node.number !== undefined ? node.number : 0;
      output.push(functionNumber.toString());
      if (node.name) {
        const opClassContext = context.spawn('CreateOpClassItem');
        output.push(this.ObjectWithArgs(node.name, opClassContext));
      }
    }else if (node.itemtype === 3) {
      output.push('STORAGE');
      if (node.storedtype) {
        output.push(this.TypeName(node.storedtype, context));
      }
    }

    if (node.order_family && node.order_family.length > 0) {
      output.push('FOR ORDER BY');
      const orderFamily = ListUtils.unwrapList(node.order_family)
        .map(family => this.visit(family, context))
        .join('.');
      output.push(orderFamily);
    }

    if (node.class_args && node.class_args.length > 0) {
      const classArgs = ListUtils.unwrapList(node.class_args)
        .map(arg => this.visit(arg, context))
        .join(', ');
      output.push(`(${classArgs})`);
    }

    return output.join(' ');
  }

  Var(node: t.Var, context: DeparserContext): string {
    if (node.varno && node.varattno) {
      return `$${node.varno}.${node.varattno}`;
    }
    return '$var';
  }

  TableFunc(node: t.TableFunc, context: DeparserContext): string {
    const output: string[] = [];

    if (node.functype === 'TFT_XMLTABLE') {
      output.push('XMLTABLE');

      if (node.ns_names && node.ns_names.length > 0) {
        output.push('XMLNAMESPACES');
        const namespaces = ListUtils.unwrapList(node.ns_names)
          .map(ns => this.visit(ns, context))
          .join(', ');
        output.push(`(${namespaces})`);
      }

      if (node.rowexpr) {
        output.push(`(${this.visit(node.rowexpr, context)})`);
      }

      if (node.docexpr) {
        output.push('PASSING');
        output.push(this.visit(node.docexpr, context));
      }

      if (node.colexprs && node.colexprs.length > 0) {
        output.push('COLUMNS');
        const columns = ListUtils.unwrapList(node.colexprs)
          .map(col => this.visit(col, context))
          .join(', ');
        output.push(columns);
      }
    } else if (node.functype === 'TFT_JSON_TABLE') {
      output.push('JSON_TABLE');

      if (node.docexpr) {
        output.push(`(${this.visit(node.docexpr, context)})`);
      }

      if (node.rowexpr) {
        output.push(',');
        output.push(`'${this.visit(node.rowexpr, context)}'`);
      }

      if (node.colexprs && node.colexprs.length > 0) {
        output.push('COLUMNS');
        const columns = ListUtils.unwrapList(node.colexprs)
          .map(col => this.visit(col, context))
          .join(', ');
        output.push(`(${columns})`);
      }
    }

    return output.join(' ');
  }

  RangeTableFunc(node: t.RangeTableFunc, context: DeparserContext): string {
    const output: string[] = [];

    if (node.lateral) {
      output.push('LATERAL');
    }

    if (node.docexpr) {
      output.push(this.visit(node.docexpr, context));
    }

    if (node.rowexpr) {
      output.push('PASSING');
      output.push(this.visit(node.rowexpr, context));
    }

    if (node.columns && node.columns.length > 0) {
      output.push('COLUMNS');
      const columns = ListUtils.unwrapList(node.columns)
        .map(col => this.visit(col, context))
        .join(', ');
      output.push(`(${columns})`);
    }

    if (node.alias) {
      output.push(this.Alias(node.alias, context));
    }

    return output.join(' ');
  }

  RangeTableFuncCol(node: t.RangeTableFuncCol, context: DeparserContext): string {
    const output: string[] = [];

    if (node.colname) {
      output.push(QuoteUtils.quote(node.colname));
    }

    if (node.for_ordinality) {
      output.push('FOR ORDINALITY');
    } else if (node.typeName) {
      output.push(this.TypeName(node.typeName, context));
    }

    if (node.colexpr) {
      output.push('PATH');
      output.push(`'${this.visit(node.colexpr, context)}'`);
    }

    if (node.coldefexpr) {
      output.push('DEFAULT');
      output.push(this.visit(node.coldefexpr, context));
    }

    return output.join(' ');
  }

  JsonArrayQueryConstructor(node: t.JsonArrayQueryConstructor, context: DeparserContext): string {
    const output: string[] = ['JSON_ARRAYAGG'];

    if (node.query) {
      output.push(`(${this.visit(node.query, context)})`);
    }

    if (node.format) {
      output.push('FORMAT JSON');
    }

    if (node.output) {
      output.push('RETURNING TEXT');
    }

    if (node.absent_on_null) {
      output.push('ABSENT ON NULL');
    } else {
      output.push('NULL ON NULL');
    }

    return output.join(' ');
  }

  RangeFunction(node: t.RangeFunction, context: DeparserContext): string {
    const output: string[] = [];

    if (node.lateral) {
      output.push('LATERAL');
    }

    if (node.is_rowsfrom) {
      output.push('ROWS FROM');

      if (node.functions && node.functions.length > 0) {
        const functionStrs = ListUtils.unwrapList(node.functions)
          .filter(func => func != null)
          .map(func => {
            try {
              const nodeType = this.getNodeType(func);
              if (nodeType === 'List') {
                // Handle List containing [FuncCall, List of ColumnDefs]
                const listData = this.getNodeData(func) as any;
                if (listData && listData.items && Array.isArray(listData.items)) {
                  const items = listData.items;
                  if (items.length >= 2) {
                    const funcCall = this.visit(items[0], context);
                    const coldefList = this.getNodeData(items[1]) as any;
                    if (coldefList && coldefList.items && Array.isArray(coldefList.items)) {
                      const coldefs = coldefList.items
                        .map((coldef: any) => this.visit(coldef, context))
                        .filter((str: string) => str && str.trim());
                      if (coldefs.length > 0) {
                        return `${funcCall} AS (${coldefs.join(', ')})`;
                      }
                    }
                    return funcCall;
                  } else if (items.length === 1) {
                    return this.visit(items[0], context);
                  }
                }
              }
              return this.visit(func, context);
            } catch (error) {
              console.warn(`Error processing function in RangeFunction: ${error instanceof Error ? error.message : String(error)}`);
              return '';
            }
          })
          .filter(str => str && str.trim());

        if (functionStrs.length > 0) {
          output.push(`(${functionStrs.join(', ')})`);
        }
      }
    } else {
      if (node.functions && node.functions.length > 0) {
        const functionStrs = ListUtils.unwrapList(node.functions)
          .filter(func => func != null)
          .map(func => {
            try {
              const nodeType = this.getNodeType(func);
              if (nodeType === 'List') {
                // Handle List containing [FuncCall, potentially empty second item]
                const listData = this.getNodeData(func) as any;
                if (listData && listData.items && Array.isArray(listData.items)) {
                  const items = listData.items;
                  if (items.length >= 1) {
                    return this.visit(items[0], context);
                  }
                }
              }
              return this.visit(func, context);
            } catch (error) {
              console.warn(`Error processing function in RangeFunction: ${error instanceof Error ? error.message : String(error)}`);
              return '';
            }
          })
          .filter(str => str && str.trim());
        if (functionStrs.length > 0) {
          output.push(functionStrs.join(', '));
        }
      }
    }

    if (node.ordinality) {
      output.push('WITH ORDINALITY');
    }

    // Handle alias and column definitions together for proper PostgreSQL syntax
    if (node.alias) {
      if (node.coldeflist && node.coldeflist.length > 0) {
        const aliasName = node.alias.aliasname;
        const coldefs = ListUtils.unwrapList(node.coldeflist)
          .map(coldef => this.visit(coldef, context))
          .filter(str => str && str.trim());
        output.push(`${aliasName} (${coldefs.join(', ')})`);
      } else {
        // Regular alias without column definitions
        output.push(this.Alias(node.alias, context));
      }
    } else if (node.coldeflist && node.coldeflist.length > 0) {
      const coldefs = ListUtils.unwrapList(node.coldeflist)
        .map(coldef => this.visit(coldef, context))
        .filter(str => str && str.trim());
      output.push(`AS (${coldefs.join(', ')})`);
    }

    return output.join(' ');
  }

  XmlExpr(node: t.XmlExpr, context: DeparserContext): string {
    // Handle XMLPI with special syntax: xmlpi(name target, content)
    if (node.op === 'IS_XMLPI') {
      if (node.name && node.args && node.args.length > 0) {
        const argStrs = ListUtils.unwrapList(node.args).map(arg => this.visit(arg, context));
        return `xmlpi(name ${QuoteUtils.quote(node.name)}, ${argStrs.join(', ')})`;
      } else if (node.name) {
        return `xmlpi(name ${QuoteUtils.quote(node.name)})`;
      } else {
        return 'XMLPI()';
      }
    }

    const output: string[] = [];

    switch (node.op) {
      case 'IS_XMLCONCAT':
        output.push('XMLCONCAT');
        break;
      case 'IS_XMLELEMENT':
        output.push('XMLELEMENT');
        const elementParts: string[] = [];
        if (node.name) {
          elementParts.push(`NAME ${QuoteUtils.quote(node.name)}`);
        }
        if (node.named_args && node.named_args.length > 0) {
          const namedArgStrs = ListUtils.unwrapList(node.named_args).map(arg => this.visit(arg, context));
          elementParts.push(`XMLATTRIBUTES(${namedArgStrs.join(', ')})`);
        }
        if (node.args && node.args.length > 0) {
          const argStrs = ListUtils.unwrapList(node.args).map(arg => this.visit(arg, context));
          elementParts.push(...argStrs);
        }
        if (elementParts.length > 0) {
          output.push(`(${elementParts.join(', ')})`);
        }
        break;
      case 'IS_XMLFOREST':
        output.push('XMLFOREST');
        break;
      case 'IS_XMLPARSE':
        output.push('XMLPARSE');
        const parseParts: string[] = [];
        if (node.xmloption) {
          if (node.xmloption === 'XMLOPTION_DOCUMENT') {
            parseParts.push('DOCUMENT');
          } else if (node.xmloption === 'XMLOPTION_CONTENT') {
            parseParts.push('CONTENT');
          }
        }
        if (node.args && node.args.length > 0) {
          const argStrs = ListUtils.unwrapList(node.args).map(arg => this.visit(arg, context));
          if (argStrs.length > 0) {
            parseParts.push(argStrs[0]);
          }
        }
        if (parseParts.length > 0) {
          output.push(`(${parseParts.join(' ')})`);
        }
        break;
      case 'IS_XMLROOT':
        output.push('XMLROOT');
        if (node.args && node.args.length > 0) {
          const args = ListUtils.unwrapList(node.args);
          const rootParts: string[] = [];

          if (args[0]) {
            rootParts.push(this.visit(args[0], context));
          }

          if (args[1]) {
            const versionArg = args[1];
            if (versionArg.A_Const && versionArg.A_Const.isnull) {
              rootParts.push('version NO VALUE');
            } else {
              rootParts.push(`version ${this.visit(versionArg, context)}`);
            }
          }

          if (args[2]) {
            const standaloneArg = args[2];
            if (standaloneArg.A_Const && standaloneArg.A_Const.ival !== undefined) {
              if (standaloneArg.A_Const.ival.ival === 1) {
                rootParts.push('STANDALONE NO');
              } else if (standaloneArg.A_Const.ival.ival === 2) {
                rootParts.push('STANDALONE NO VALUE');
              } else if (standaloneArg.A_Const.ival.ival === 3) {
              } else if (Object.keys(standaloneArg.A_Const.ival).length === 0) {
                rootParts.push('STANDALONE YES');
              } else {
                rootParts.push(`STANDALONE ${this.visit(standaloneArg, context)}`);
              }
            } else {
              rootParts.push(`STANDALONE ${this.visit(standaloneArg, context)}`);
            }
          }

          if (rootParts.length > 0) {
            output.push(`(${rootParts.join(', ')})`);
          }
        }
        break;
      case 'IS_XMLSERIALIZE':
        output.push('XMLSERIALIZE');
        break;
      case 'IS_DOCUMENT':
        if (node.args && node.args.length > 0) {
          const argStrs = ListUtils.unwrapList(node.args).map(arg => this.visit(arg, context));
          output.push(`${argStrs[0]} IS DOCUMENT`);
        } else {
          output.push('IS DOCUMENT');
        }
        break;
      default:
        throw new Error(`Unsupported XmlExpr op: ${node.op}`);
    }

    // Handle name and args for operations that don't have special handling
    if (node.op !== 'IS_XMLELEMENT' && node.op !== 'IS_XMLPARSE' && node.op !== 'IS_XMLROOT' && node.op !== 'IS_DOCUMENT') {
      if (node.name) {
        const quotedName = QuoteUtils.quote(node.name);
        output.push(`NAME ${quotedName}`);
      }

      if (node.args && node.args.length > 0) {
        const argStrs = ListUtils.unwrapList(node.args).map(arg => this.visit(arg, context));
        output.push(`(${argStrs.join(', ')})`);
      }
    }

    if (node.named_args && node.named_args.length > 0 && node.op !== 'IS_XMLELEMENT') {
      const namedArgStrs = ListUtils.unwrapList(node.named_args).map(arg => this.visit(arg, context));
      if (node.op === 'IS_XMLFOREST') {
        output.push(`(${namedArgStrs.join(', ')})`);
      } else {
        output.push(`XMLATTRIBUTES(${namedArgStrs.join(', ')})`);
      }
    }

    return output.join(' ');
  }

  schemaname(node: any, context: DeparserContext): string {
    if (typeof node === 'string') {
      return QuoteUtils.quote(node);
    }
    if (node && node.String && node.String.sval) {
      return QuoteUtils.quote(node.String.sval);
    }
    // Handle other node types without recursion
    if (node && typeof node === 'object') {
      if (node.sval !== undefined) {
        return QuoteUtils.quote(node.sval);
      }
      // Handle List nodes that might contain schema names
      if (node.List && Array.isArray(node.List.items)) {
        const items = node.List.items;
        if (items.length > 0 && items[0].String && items[0].String.sval) {
          return QuoteUtils.quote(items[0].String.sval);
        }
      }
      // For other complex nodes, try to extract string value without recursion
      if (node.val !== undefined) {
        return QuoteUtils.quote(node.val);
      }
      return '';
    }
    return '';
  }

  RangeTableSample(node: t.RangeTableSample, context: DeparserContext): string {
    const output: string[] = [];

    if (node.relation) {
      output.push(this.visit(node.relation as any, context));
    }

    output.push('TABLESAMPLE');

    if (node.method && node.method.length > 0) {
      const methodParts = node.method.map((m: any) => this.visit(m, context));
      output.push(methodParts.join('.'));
    }

    if (node.args && node.args.length > 0) {
      const argStrs = node.args.map((arg: any) => this.visit(arg, context));
      output.push(`(${argStrs.join(', ')})`);
    }

    if (node.repeatable) {
      output.push('REPEATABLE');
      output.push(`(${this.visit(node.repeatable as any, context)})`);
    }

    return output.join(' ');
  }

  XmlSerialize(node: t.XmlSerialize, context: DeparserContext): string {
    const output: string[] = ['XMLSERIALIZE'];

    output.push('(');

    if (node.typeName) {
      if (node.xmloption === 'XMLOPTION_DOCUMENT') {
        output.push('DOCUMENT');
      } else {
        output.push('CONTENT');
      }

      output.push(this.visit(node.expr as any, context));
      output.push('AS');
      output.push(this.TypeName(node.typeName, context));
    }

    output.push(')');

    return output.join(' ');
  }

  ctes(node: any, context: DeparserContext): string {
    if (!node || !Array.isArray(node)) {
      return '';
    }

    const output: string[] = ['WITH'];

    // Check if any CTE is recursive by examining the first CTE's structure
    if (node.length > 0 && node[0] && node[0].CommonTableExpr && node[0].CommonTableExpr.recursive) {
      output.push('RECURSIVE');
    }

    const cteStrs = node.map(cte => this.visit(cte, context));
    output.push(cteStrs.join(', '));

    return output.join(' ');
  }

  RuleStmt(node: t.RuleStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE'];

    if (node.replace) {
      output.push('OR REPLACE');
    }

    output.push('RULE');

    if (node.rulename) {
      output.push(QuoteUtils.quote(node.rulename));
    }

    output.push('AS ON');

    if (node.event) {
      switch (node.event) {
        case 'CMD_SELECT':
          output.push('SELECT');
          break;
        case 'CMD_INSERT':
          output.push('INSERT');
          break;
        case 'CMD_UPDATE':
          output.push('UPDATE');
          break;
        case 'CMD_DELETE':
          output.push('DELETE');
          break;
        default:
          output.push(node.event.toString());
      }
    }

    output.push('TO');

    if (node.relation) {
      // Handle relation node directly as RangeVar since it contains the RangeVar properties
      output.push(this.RangeVar(node.relation as any, context));
    }

    if (node.whereClause) {
      output.push('WHERE');
      output.push(this.visit(node.whereClause, context));
    }

    output.push('DO');

    if (node.instead) {
      output.push('INSTEAD');
    }

    if (node.actions && node.actions.length > 0) {
      if (node.actions.length === 1) {
        output.push(this.visit(node.actions[0], context));
      } else {
        output.push('(');
        const actionStrs = ListUtils.unwrapList(node.actions).map(action => this.visit(action, context));
        output.push(actionStrs.join('; '));
        output.push(')');
      }
    } else {
      output.push('NOTHING');
    }

    return output.join(' ');
  }

  RangeSubselect(node: t.RangeSubselect, context: DeparserContext): string {
    const output: string[] = [];

    if (node.lateral) {
      output.push('LATERAL');
    }

    if (node.subquery) {
      output.push('(');
      output.push(this.visit(node.subquery, context));
      output.push(')');
    }

    if (node.alias) {
      output.push(this.Alias(node.alias, context));
    }

    return output.join(' ');
  }

  relname(node: any, context: DeparserContext): string {
    if (typeof node === 'string') {
      return QuoteUtils.quote(node);
    }
    if (node && node.String && node.String.sval) {
      return QuoteUtils.quote(node.String.sval);
    }
    if (node && typeof node === 'object' && node.relname) {
      return QuoteUtils.quote(node.relname);
    }
    return this.visit(node, context);
  }

  rel(node: any, context: DeparserContext): string {
    if (typeof node === 'string') {
      return QuoteUtils.quote(node);
    }
    if (node && node.String && node.String.sval) {
      return QuoteUtils.quote(node.String.sval);
    }
    if (node && node.RangeVar) {
      return this.RangeVar(node.RangeVar, context);
    }
    if (node && typeof node === 'object' && node.relname) {
      return QuoteUtils.quote(node.relname);
    }
    return this.visit(node, context);
  }

  objname(node: any, context: DeparserContext): string {
    if (typeof node === 'string') {
      return QuoteUtils.quote(node);
    }
    if (node && node.String && node.String.sval) {
      return QuoteUtils.quote(node.String.sval);
    }
    if (Array.isArray(node)) {
      const parts = node.map(part => {
        if (part && part.String && part.String.sval) {
          return QuoteUtils.quote(part.String.sval);
        }
        return this.visit(part, context);
      });
      return parts.join('.');
    }
    return this.visit(node, context);
  }

  SQLValueFunction(node: t.SQLValueFunction, context: DeparserContext): string {
    switch (node.op) {
      case 'SVFOP_CURRENT_DATE':
        return 'CURRENT_DATE';
      case 'SVFOP_CURRENT_TIME':
        return 'CURRENT_TIME';
      case 'SVFOP_CURRENT_TIME_N':
        return `CURRENT_TIME(${node.typmod || 0})`;
      case 'SVFOP_CURRENT_TIMESTAMP':
        return 'CURRENT_TIMESTAMP';
      case 'SVFOP_CURRENT_TIMESTAMP_N':
        return `CURRENT_TIMESTAMP(${node.typmod || 0})`;
      case 'SVFOP_LOCALTIME':
        return 'LOCALTIME';
      case 'SVFOP_LOCALTIME_N':
        return `LOCALTIME(${node.typmod || 0})`;
      case 'SVFOP_LOCALTIMESTAMP':
        return 'LOCALTIMESTAMP';
      case 'SVFOP_LOCALTIMESTAMP_N':
        return `LOCALTIMESTAMP(${node.typmod || 0})`;
      case 'SVFOP_CURRENT_ROLE':
        return 'CURRENT_ROLE';
      case 'SVFOP_CURRENT_USER':
        return 'CURRENT_USER';
      case 'SVFOP_USER':
        return 'USER';
      case 'SVFOP_SESSION_USER':
        return 'SESSION_USER';
      case 'SVFOP_CURRENT_CATALOG':
        return 'CURRENT_CATALOG';
      case 'SVFOP_CURRENT_SCHEMA':
        return 'CURRENT_SCHEMA';
      default:
        throw new Error(`Unsupported SQLValueFunction op: ${node.op}`);
    }
  }

  GroupingFunc(node: t.GroupingFunc, context: DeparserContext): string {
    const output: string[] = ['GROUPING'];

    if (node.args && node.args.length > 0) {
      const argStrs = ListUtils.unwrapList(node.args).map(arg => this.visit(arg, context));
      output.push(`(${argStrs.join(', ')})`);
    } else {
      output.push('()');
    }

    return output.join('');
  }

  MultiAssignRef(node: t.MultiAssignRef, context: DeparserContext): string {
    const output: string[] = [];

    if (node.source) {
      output.push(this.visit(node.source, context));
    }

    if (node.colno > 0) {
      output.push(`[${node.colno}]`);
    }

    return output.join('');
  }

  SetToDefault(node: t.SetToDefault, context: DeparserContext): string {
    return 'DEFAULT';
  }

  CurrentOfExpr(node: t.CurrentOfExpr, context: DeparserContext): string {
    const output: string[] = ['CURRENT OF'];

    if (node.cursor_name) {
      output.push(QuoteUtils.quote(node.cursor_name));
    }

    if (node.cursor_param > 0) {
      output.push(`$${node.cursor_param}`);
    }

    return output.join(' ');
  }

  TableLikeClause(node: t.TableLikeClause, context: DeparserContext): string {
    const output: string[] = ['LIKE'];

    if (node.relation) {
      output.push(this.visit(node.relation as any, context));
    }

    if (node.options && typeof node.options === 'number') {
      // Handle special case for INCLUDING ALL (all bits set)
      if (node.options === 2147483647 || node.options === 0x7FFFFFFF) {
        output.push('INCLUDING ALL');
      } else {
        const optionStrs: string[] = [];

        // Handle bitfield options for CREATE TABLE LIKE
        if (node.options & 0x01) optionStrs.push('INCLUDING COMMENTS');
        if (node.options & 0x04) optionStrs.push('INCLUDING CONSTRAINTS');
        if (node.options & 0x08) optionStrs.push('INCLUDING DEFAULTS');
        if (node.options & 0x10) optionStrs.push('INCLUDING GENERATED');
        if (node.options & 0x20) optionStrs.push('INCLUDING IDENTITY');
        if (node.options & 0x40) optionStrs.push('INCLUDING INDEXES');
        if (node.options & 0x80) optionStrs.push('INCLUDING STATISTICS');
        if (node.options & 0x100) optionStrs.push('INCLUDING STORAGE');

        if (optionStrs.length > 0) {
          output.push(optionStrs.join(' '));
        }
      }
    }

    return output.join(' ');
  }

  AlterFunctionStmt(node: t.AlterFunctionStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER'];

    if (node.objtype === 'OBJECT_PROCEDURE') {
      output.push('PROCEDURE');
    } else {
      output.push('FUNCTION');
    }

    if (node.func) {
      output.push(this.ObjectWithArgs(node.func, context));
    }

    if (node.actions && node.actions.length > 0) {
      const alterFunctionContext = context.spawn('AlterFunctionStmt');
      const actionStrs = ListUtils.unwrapList(node.actions).map(action => this.visit(action, alterFunctionContext));
      output.push(actionStrs.join(' '));
    }

    return output.join(' ');
  }

  AlterObjectSchemaStmt(node: t.AlterObjectSchemaStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER'];

    try {
      output.push(this.getObjectTypeKeyword(node.objectType));
    } catch {
      // Fallback to objectType string if not supported
      output.push(node.objectType.toString());
    }

    if (node.missing_ok) {
      output.push('IF EXISTS');
    }

    if (node.relation && (node.objectType === 'OBJECT_TABLE' || node.objectType === 'OBJECT_FOREIGN_TABLE' || node.objectType === 'OBJECT_MATVIEW')) {
      output.push(this.RangeVar(node.relation, context));
    } else if (node.object) {
      // Handle domain objects specially to format schema.domain correctly
      if (node.objectType === 'OBJECT_DOMAIN' && (node.object as any).List) {
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const schemaName = items[0].String?.sval || '';
          const domainName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(domainName)}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_TYPE' && (node.object as any).List) {
        // Handle type objects specially to format schema.type correctly
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const schemaName = items[0].String?.sval || '';
          const typeName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(typeName)}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_CONVERSION' && (node.object as any).List) {
        // Handle conversion objects specially to format schema.conversion correctly
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const schemaName = items[0].String?.sval || '';
          const conversionName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(conversionName)}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_TSPARSER' && (node.object as any).List) {
        // Handle text search parser objects specially to format schema.parser correctly
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const schemaName = items[0].String?.sval || '';
          const parserName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(parserName)}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_TSCONFIGURATION' && (node.object as any).List) {
        // Handle text search configuration objects specially to format schema.config correctly
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const schemaName = items[0].String?.sval || '';
          const configName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(configName)}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_TSTEMPLATE' && (node.object as any).List) {
        // Handle text search template objects specially to format schema.template correctly
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const schemaName = items[0].String?.sval || '';
          const templateName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(templateName)}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_TSDICTIONARY' && (node.object as any).List) {
        // Handle text search dictionary objects specially to format schema.dictionary correctly
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const schemaName = items[0].String?.sval || '';
          const dictionaryName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(dictionaryName)}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_OPCLASS' && (node.object as any).List) {
        // Handle operator class objects: ALTER OPERATOR CLASS name USING access_method
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const accessMethod = items[0].String?.sval || '';
          const opClassName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(opClassName)} USING ${accessMethod}`);
        } else if (items.length === 3) {
          const accessMethod = items[0].String?.sval || '';
          const schemaName = items[1].String?.sval || '';
          const opClassName = items[2].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(opClassName)} USING ${accessMethod}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      } else if (node.objectType === 'OBJECT_OPFAMILY' && (node.object as any).List) {
        // Handle operator family objects: ALTER OPERATOR FAMILY name USING access_method
        const items = ListUtils.unwrapList(node.object as any);
        if (items.length === 2) {
          const accessMethod = items[0].String?.sval || '';
          const opFamilyName = items[1].String?.sval || '';
          output.push(`${QuoteUtils.quote(opFamilyName)} USING ${accessMethod}`);
        } else if (items.length === 3) {
          const accessMethod = items[0].String?.sval || '';
          const schemaName = items[1].String?.sval || '';
          const opFamilyName = items[2].String?.sval || '';
          output.push(`${QuoteUtils.quote(schemaName)}.${QuoteUtils.quote(opFamilyName)} USING ${accessMethod}`);
        } else {
          output.push(this.visit(node.object as any, context));
        }
      }else {
        output.push(this.visit(node.object as any, context));
      }
    }

    output.push('SET SCHEMA');

    if (node.newschema) {
      output.push(QuoteUtils.quote(node.newschema));
    }

    return output.join(' ');
  }

  AlterRoleSetStmt(node: t.AlterRoleSetStmt, context: DeparserContext): string {
    const output: string[] = ['ALTER', 'ROLE'];

    if (node.role) {
      output.push(this.RoleSpec(node.role, context));
    } else {
      output.push('ALL');
    }

    if (node.database) {
      output.push('IN DATABASE');
      output.push(this.quoteIfNeeded(node.database));
    }

    if (node.setstmt) {
      if (node.setstmt.kind === 'VAR_RESET') {
        output.push('RESET');
        if (node.setstmt.name) {
          output.push(node.setstmt.name);
        }
      } else {
        output.push('SET');
        if (node.setstmt.name) {
          output.push(node.setstmt.name);
        }

        if (node.setstmt.args && node.setstmt.args.length > 0) {
          output.push('TO');
          const args = ListUtils.unwrapList(node.setstmt.args)
            .map(arg => this.visit(arg, context))
            .join(', ');
          output.push(args);
        }
      }
    }

    return output.join(' ');
  }

  CreateForeignTableStmt(node: t.CreateForeignTableStmt, context: DeparserContext): string {
    const output: string[] = ['CREATE FOREIGN TABLE'];

    if (node.base && node.base.relation) {
      const relationContext = context.spawn('CreateForeignTableStmt');
      // Handle relation node directly as RangeVar since it contains the RangeVar properties
      output.push(this.RangeVar(node.base.relation as any, relationContext));
    }

    if (node.base && node.base.tableElts) {
      const elementStrs = ListUtils.unwrapList(node.base.tableElts).map(el => this.visit(el, context));
      output.push(`(${elementStrs.join(', ')})`);
    } else if (!node.base?.partbound) {
      // Only add empty parentheses if this is not a partition table
      output.push('()');
    }

    if (node.base && node.base.inhRelations && node.base.inhRelations.length > 0) {
      if (node.base.partbound) {
        const inheritStrs = ListUtils.unwrapList(node.base.inhRelations).map(rel => this.visit(rel, context));
        output.push(`PARTITION OF ${inheritStrs.join(', ')}`);
        if (node.base.partbound.is_default) {
          output.push('DEFAULT');
        }
      } else {
        const inheritStrs = ListUtils.unwrapList(node.base.inhRelations).map(rel => this.visit(rel, context));
        output.push(`INHERITS (${inheritStrs.join(', ')})`);
      }
    }

    if (node.servername) {
      output.push('SERVER');
      output.push(QuoteUtils.quote(node.servername));
    }

    if (node.options && node.options.length > 0) {
      const foreignTableContext = context.spawn('CreateForeignTableStmt');
      const optionStrs = ListUtils.unwrapList(node.options).map(opt => this.visit(opt, foreignTableContext));
      output.push(`OPTIONS (${optionStrs.join(', ')})`);
    }

    return output.join(' ');
  }

  private containsMultilineStringLiteral(content: string): boolean {
    const stringLiteralRegex = /'[^']*\n[^']*'/g;
    return stringLiteralRegex.test(content);
  }
}
